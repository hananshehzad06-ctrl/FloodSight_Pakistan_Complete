"""
FloodSight Pakistan — SAR Ingestion Handler (Alibaba Cloud Function Compute)

Triggered by OSS events containing Sentinel-1 SAR GeoTIFF uploads.
Outputs a coarsened, simplified flood-boundary GeoJSON under 1 KB.
"""

import os
import json
import math
import oss2
import numpy as np
from osgeo import gdal, osr, ogr


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _auth_from_context(context):
    """Build an OSS auth object from Function Compute STS credentials."""
    creds = context.credentials
    return oss2.StsAuth(
        access_key_id=creds.access_key_id,
        access_key_secret=creds.access_key_secret,
        security_token=creds.security_token,
    )


def _parse_event(event):
    """Accept both raw dict and JSON-serialized FC event payloads."""
    if isinstance(event, dict):
        return event
    if isinstance(event, str):
        return json.loads(event)
    return json.loads(event.decode("utf-8"))


def _get_bucket_endpoint():
    """Allow override via env; otherwise default to internal endpoint pattern."""
    return os.environ.get("OSS_ENDPOINT", "oss-cn-beijing-internal.aliyuncs.com")


def _coarsen_and_simplify(geom, target_points=16):
    """
    Simplify an OGR geometry until its exterior ring has at most target_points.
    Also drops tiny interior rings to keep JSON small.
    """
    if geom is None or geom.IsEmpty():
        return None

    # Start with a moderate tolerance and increase until we hit the target.
    tolerance = 0.0001
    simplified = geom.SimplifyPreserveTopology(tolerance)
    while simplified and _point_count(simplified) > target_points and tolerance < 0.02:
        tolerance *= 1.8
        candidate = geom.SimplifyPreserveTopology(tolerance)
        if candidate and not candidate.IsEmpty():
            simplified = candidate
        else:
            break

    # Remove interior rings (holes) to save bytes; they rarely matter for SAR.
    if simplified.GetGeometryType() == ogr.wkbPolygon:
        ring = simplified.GetGeometryRef(0)
        poly = ogr.Geometry(ogr.wkbPolygon)
        poly.AddGeometry(ring)
        simplified = poly
    elif simplified.GetGeometryType() == ogr.wkbMultiPolygon:
        multi = ogr.Geometry(ogr.wkbMultiPolygon)
        for i in range(simplified.GetGeometryCount()):
            poly = simplified.GetGeometryRef(i)
            ring = poly.GetGeometryRef(0)
            new_poly = ogr.Geometry(ogr.wkbPolygon)
            new_poly.AddGeometry(ring)
            multi.AddGeometry(new_poly)
        simplified = multi

    return simplified


def _point_count(geom):
    if geom is None:
        return 0
    count = 0
    if geom.GetGeometryType() == ogr.wkbPolygon:
        count += geom.GetGeometryRef(0).GetPointCount()
    elif geom.GetGeometryType() == ogr.wkbMultiPolygon:
        for i in range(geom.GetGeometryCount()):
            count += geom.GetGeometryRef(i).GetGeometryRef(0).GetPointCount()
    return count


def _polygon_to_coords(geom):
    """Convert OGR polygon exterior ring to [[lat, lon], ...]."""
    if geom is None:
        return []

    coords = []
    ring = geom.GetGeometryRef(0)
    n = ring.GetPointCount()
    for i in range(n):
        x, y, _ = ring.GetPoint(i)
        # Round aggressively to keep payload tiny.
        coords.append([round(y, 4), round(x, 4)])
    return coords


def _reproject_to_wgs84(ds):
    """Warp dataset to EPSG:4326 in-memory; return a new GDAL MEM dataset."""
    src_srs = ds.GetProjection()
    if not src_srs:
        # Assume already WGS84 if no projection metadata.
        return ds

    src_wkt = src_srs
    dst_srs = osr.SpatialReference()
    dst_srs.ImportFromEPSG(4326)
    dst_wkt = dst_srs.ExportToWkt()

    options = gdal.WarpOptions(
        format="MEM",
        dstSRS=dst_wkt,
        resampleAlg="bilinear",
        creationOptions=["NUM_THREADS=ALL_CPUS"],
    )
    return gdal.Warp("", ds, options=options)


def _extract_flood_polygon(src_path, threshold_db=-15.0):
    """
    Read the first SAR band, threshold backscatter in dB, vectorize flood mask.
    Returns a WGS84 OGR geometry (Polygon or MultiPolygon).
    """
    ds = gdal.Open(src_path)
    if ds is None:
        raise RuntimeError(f"Unable to open raster: {src_path}")

    ds = _reproject_to_wgs84(ds)
    band = ds.GetRasterBand(1)
    arr = band.ReadAsArray().astype(np.float32)

    # Mask no-data values.
    nodata = band.GetNoDataValue()
    if nodata is not None:
        arr = np.where(np.isclose(arr, nodata), np.nan, arr)

    # Thresholding: values below threshold_db indicate standing water.
    # Works for both amplitude and pre-calibrated dB rasters.
    binary = np.where((arr > -999) & (arr < threshold_db), 1, 0).astype(np.uint8)

    # Write mask to a temporary MEM raster.
    driver = gdal.GetDriverByName("MEM")
    mask_ds = driver.Create("", ds.RasterXSize, ds.RasterYSize, 1, gdal.GDT_Byte)
    mask_ds.SetProjection(ds.GetProjection())
    mask_ds.SetGeoTransform(ds.GetGeoTransform())
    mask_ds.GetRasterBand(1).WriteArray(binary)

    # Polygonize.
    band = mask_ds.GetRasterBand(1)
    band.SetNoDataValue(0)

    drv = ogr.GetDriverByName("Memory")
    vec_ds = drv.CreateDataSource("flood")
    srs = osr.SpatialReference()
    srs.ImportFromWkt(ds.GetProjection())
    layer = vec_ds.CreateLayer("boundaries", srs=srs, geom_type=ogr.wkbPolygon)
    layer.CreateField(ogr.FieldDefn("value", ogr.OFTInteger))

    gdal.Polygonize(band, band.GetMaskBand(), layer, 0, ["8CONNECTED=8"], callback=None)

    # Collect all flood polygons and union them.
    multi = ogr.Geometry(ogr.wkbMultiPolygon)
    for feat in layer:
        geom = feat.GetGeometryRef().Clone()
        if geom and not geom.IsEmpty():
            multi.AddGeometry(geom)

    union = multi.UnionCascaded()
    if union is None or union.IsEmpty():
        return None
    return union


def _build_micro_payload(uc_id, district, coords, area_sq_km):
    """Assemble a sub-1 KB JSON payload for field sync."""
    payload = {
        "uc_id": uc_id,
        "district": district,
        "flood_boundary": coords,
        "area_sq_km": round(area_sq_km, 2),
        "ts": os.environ.get("FC_INVOCATION_TIME", "unknown"),
    }
    # Quick sanity check on size.
    raw = json.dumps(payload)
    if len(raw) > 1024:
        # Further prune by reducing coordinate precision.
        payload["flood_boundary"] = [[round(y, 3), round(x, 3)] for y, x in coords]
        if len(json.dumps(payload)) > 1024:
            payload["flood_boundary"] = payload["flood_boundary"][:32]
    return payload


# ---------------------------------------------------------------------------
# Function Compute handler
# ---------------------------------------------------------------------------

def process_sar_image(event, context):
    event_data = _parse_event(event)

    # --- 1. Parse OSS event --------------------------------------------------
    oss_event = event_data.get("events", [event_data])[0]
    bucket_name = oss_event.get("oss", {}).get("bucket", {}).get("name")
    object_key = oss_event.get("oss", {}).get("object", {}).get("key")
    if not bucket_name or not object_key:
        raise ValueError("Malformed OSS event: missing bucket or object key")

    dst_bucket = os.environ.get("DST_BUCKET", bucket_name)
    dst_prefix = os.environ.get("DST_PREFIX", "flood-results/")

    # --- 2. Authenticate and download source image ---------------------------
    auth = _auth_from_context(context)
    endpoint = _get_bucket_endpoint()
    src_bucket = oss2.Bucket(auth, endpoint, bucket_name)
    dst_bucket_obj = oss2.Bucket(auth, endpoint, dst_bucket)

    local_path = f"/tmp/{object_key.replace('/', '_')}"
    src_bucket.get_object_to_file(object_key, local_path)

    # --- 3. Extract flood boundary ------------------------------------------
    threshold = float(os.environ.get("FLOOD_THRESHOLD_DB", "-15.0"))
    geom_wgs84 = _extract_flood_polygon(local_path, threshold)

    if geom_wgs84 is None:
        result = {"status": "no_flood_detected", "bucket": bucket_name, "key": object_key}
        dst_key = f"{dst_prefix}{object_key.rsplit('.', 1)[0]}.json"
        dst_bucket_obj.put_object(dst_key, json.dumps(result))
        return result

    # --- 4. Coarsen / simplify ----------------------------------------------
    simplified = _coarsen_and_simplify(geom_wgs84, target_points=16)
    coords = _polygon_to_coords(simplified)

    # --- 5. Estimate area in sq km using rough planar approximation ----------
    area = 0.0
    if simplified:
        srs = osr.SpatialReference()
        srs.ImportFromEPSG(4326)
        # Compute area on a local UTM zone for accuracy.
        centroid = simplified.Centroid()
        lon, lat, _ = centroid.GetPoint()
        utm_zone = int((lon + 180) / 6) + 1
        utm_srs = osr.SpatialReference()
        hemisphere = 32600 + utm_zone if lat >= 0 else 32700 + utm_zone
        utm_srs.ImportFromEPSG(hemisphere)
        transform = osr.CoordinateTransformation(srs, utm_srs)
        geom_utm = simplified.Clone()
        geom_utm.Transform(transform)
        area = geom_utm.GetArea() / 1e6  # m^2 -> km^2

    # --- 6. Build and upload micro-JSON result -------------------------------
    # Derive UC identifiers from the object key, e.g. SD-BDN-BADIN1.tif
    base_name = object_key.rsplit(".", 1)[0].rsplit("/", 1)[-1]
    parts = base_name.split("_")
    uc_id = parts[0] if parts else base_name
    district = "Unknown"

    payload = _build_micro_payload(uc_id, district, coords, area)
    dst_key = f"{dst_prefix}{base_name}.json"
    dst_bucket_obj.put_object(dst_key, json.dumps(payload))

    return {
        "status": "success",
        "source": f"oss://{bucket_name}/{object_key}",
        "destination": f"oss://{dst_bucket}/{dst_key}",
        "area_sq_km": payload["area_sq_km"],
        "boundary_points": len(coords),
        "payload_bytes": len(json.dumps(payload)),
    }
