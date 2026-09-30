import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import TacticalFieldView from "./components/TacticalFieldView.jsx";
import { fetchFloodAssessment } from "./utils/api.js";

const PIN_ZOOM = 10;

const SUMMARY_CARDS = [
  {
    key: "inundated_area_km2",
    label: "Inundated Area",
    unit: "km²",
    format: (value) => value.toLocaleString("en-US", { maximumFractionDigits: 1 }),
  },
  {
    key: "displaced_population",
    label: "Displaced Population",
    unit: "",
    format: (value) => value.toLocaleString("en-US"),
  },
  {
    key: "active_boats",
    label: "Active Boats",
    unit: "",
    format: (value) => value.toLocaleString("en-US"),
  },
  {
    key: "relief_camps",
    label: "Relief Camps Needed",
    unit: "",
    format: (value) => value.toLocaleString("en-US"),
  },
];

const RISK_BADGES = {
  "LVL 5": "bg-red-500/20 text-red-400 border border-red-500/40",
  "LVL 4": "bg-orange-500/20 text-orange-400 border border-orange-500/40",
  "LVL 3": "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
  "LVL 2": "bg-lime-500/20 text-lime-400 border border-lime-500/40",
  "LVL 1": "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
};
const RISK_BADGE_FALLBACK =
  "bg-slate-700/40 text-slate-400 border border-slate-600";

const isNum = (value) => typeof value === "number" && Number.isFinite(value);

const normLevel = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const buildSitRepRef = (isoTs) => {
  const date = new Date(isoTs || Date.now());
  const pad = (number) => String(number).padStart(2, "0");
  return `NDMA/FS/${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
};

const formatPKT = (isoTs) =>
  new Date(isoTs || Date.now()).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    dateStyle: "long",
    timeStyle: "short",
  }) + " PKT";

const toLatLng = (hotspot) => {
  const lat = Number(hotspot?.lat);
  const lng = Number(hotspot?.long ?? hotspot?.lng ?? hotspot?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
};

function MapController({ target }) {
  const map = useMap();

  useEffect(() => {
    if (target?.center) {
      map.flyTo(target.center, PIN_ZOOM, { duration: 1.2 });
    }
  }, [target, map]);

  return null;
}

function DashboardSkeleton() {
  return (
    <main
      aria-label="Loading flood assessment"
      className="flex min-h-0 flex-1 flex-col gap-4 p-5"
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: SUMMARY_CARDS.length }, (_, index) => (
          <div
            key={index}
            className="rounded-lg border border-slate-800 bg-slate-900 p-4"
          >
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
            <div className="mt-4 h-8 w-1/2 animate-pulse rounded bg-slate-800" />
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-h-[300px] animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
        <div className="min-h-[300px] space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-8 animate-pulse rounded bg-slate-800"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("macro");
  const [lastSynced, setLastSynced] = useState(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [activePin, setActivePin] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleExportSitRep = () => {
    const previousTitle = document.title;
    document.title = `NDMA_SitRep_${buildSitRepRef(dataRef.current?.timestamp)}`;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    window.print();
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchFloodAssessment()
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
          setLastSynced(new Date());
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason?.message || "Failed to load flood assessment");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const hotspots = useMemo(
    () =>
      (Array.isArray(data?.pinned_hotspots) ? data.pinned_hotspots : []).filter(
        (hotspot) => toLatLng(hotspot),
      ),
    [data],
  );
  const ranking = Array.isArray(data?.priority_risk_ranking)
    ? data.priority_risk_ranking
    : [];
  const summary = data?.macro_summary ?? {};
  const initialBounds = useMemo(() => hotspots.map(toLatLng), [hotspots]);
  const updatedAt = data?.timestamp ? new Date(data.timestamp) : null;

  const handlePin = (hotspot, index) => {
    setActivePin(index);
    setFlyTarget({ center: toLatLng(hotspot) });
  };

  return (
    <div className="print-root flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="no-print border-b border-slate-800 bg-slate-950 px-4 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-cyan-400">
                FloodSight Pakistan
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-100">
                {viewMode === "macro"
                  ? "Flood Assessment Command Dashboard"
                  : "Tactical Field View"}
              </h1>
            </div>
            {updatedAt && Number.isFinite(updatedAt.getTime()) && (
              <p className="font-mono text-xs text-slate-400">
                Updated {updatedAt.toLocaleString("en-GB")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div
              role="group"
              aria-label="Dashboard view"
              className="grid w-full grid-cols-2 rounded-lg border border-slate-700 bg-slate-900 p-1 sm:w-fit"
            >
            <button
              id="macro"
              type="button"
              aria-pressed={viewMode === "macro"}
              onClick={() => setViewMode("macro")}
              className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300 ${viewMode === "macro" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="md:hidden">Macro</span>
              <span className="hidden md:inline">
                NDMA Macro Command Dashboard
              </span>
            </button>
            <button
              id="field"
              type="button"
              aria-pressed={viewMode === "field"}
              onClick={() => setViewMode("field")}
              className={`min-h-11 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300 ${viewMode === "field" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
            >
              <span className="md:hidden">Field</span>
              <span className="hidden md:inline">
                Tactical Field PWA (Rescue 1122)
              </span>
            </button>
            </div>
            {viewMode === "macro" && (
              <button
                type="button"
                onClick={handleExportSitRep}
                disabled={loading || !data}
                aria-label="Export NDMA Situation Report as PDF"
                className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-cyan-300 bg-cyan-400 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
              >
                Export SitRep PDF
              </button>
            )}
          </div>

          {viewMode === "macro" && (
          <nav
            aria-label="Pinned hotspots"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 font-mono text-xs uppercase text-slate-500">
              Hotspots
            </span>
            {loading
              ? Array.from({ length: 4 }, (_, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className="h-8 w-20 animate-pulse rounded-md bg-slate-800"
                  />
                ))
              : hotspots.map((hotspot, index) => (
                  <button
                    key={`${hotspot.name}-${index}`}
                    type="button"
                    onClick={() => handlePin(hotspot, index)}
                    aria-pressed={activePin === index}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${activePin === index ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/60"}`}
                  >
                    {hotspot.name}
                  </button>
                ))}
          </nav>
          )}
        </div>
      </header>

      {loading && <DashboardSkeleton />}

      {!loading && error && (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center"
        >
          <p className="text-slate-300">Could not load flood assessment</p>
          <p className="font-mono text-xs text-slate-500">{error}</p>
          <button
            type="button"
            onClick={load}
            className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        viewMode === "field" ? (
          <TacticalFieldView
            ranking={ranking}
            summary={summary}
            timestamp={data.timestamp}
            lastSynced={lastSynced}
          />
        ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 sm:p-5">
          <div className="no-print flex min-h-0 flex-1 flex-col gap-4">
          <section
            aria-label="Flood response summary"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            {SUMMARY_CARDS.map(({ key, label, unit, format }) => (
              <div
                key={key}
                className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4"
              >
                <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 font-mono text-2xl font-bold text-cyan-300 sm:text-3xl">
                  {isNum(summary[key]) ? format(summary[key]) : "—"}
                  {unit && isNum(summary[key]) && (
                    <span className="ml-1 text-base text-slate-500">
                      {unit}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <section
              aria-label="Flood hotspot map"
              className="h-[420px] min-h-[300px] overflow-hidden rounded-lg border border-slate-800 lg:h-auto"
            >
              {initialBounds.length > 0 ? (
                <MapContainer
                  bounds={initialBounds}
                  boundsOptions={{ padding: [40, 40] }}
                  className="h-full min-h-[300px] w-full bg-slate-950"
                >
                  <TileLayer
                    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <MapController target={flyTarget} />
                  {hotspots.map((hotspot, index) => (
                    <CircleMarker
                      key={`${hotspot.name}-${index}`}
                      center={toLatLng(hotspot)}
                      radius={activePin === index ? 11 : 8}
                      pathOptions={{ color: "#22d3ee", fillOpacity: 0.5 }}
                      eventHandlers={{
                        click: () => handlePin(hotspot, index),
                      }}
                    >
                      <Tooltip>{hotspot.name}</Tooltip>
                    </CircleMarker>
                  ))}
                </MapContainer>
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center text-sm text-slate-500">
                  No hotspot coordinates returned
                </div>
              )}
            </section>

            <section className="min-h-0 overflow-auto rounded-lg border border-slate-800 bg-slate-900">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-900 font-mono text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Union Council
                    </th>
                    <th scope="col" className="px-4 py-3">
                      District
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Risk
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Hazards
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Boats Rec.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ranking.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No ranked areas returned.
                      </td>
                    </tr>
                  )}
                  {ranking.map((row, index) => {
                    const level = normLevel(row.risk_level);
                    return (
                      <tr
                        key={`${row.uc_name ?? "area"}-${index}`}
                        className="hover:bg-slate-800/50"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-100">
                          {row.uc_name ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {row.district ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold ${RISK_BADGES[level] ?? RISK_BADGE_FALLBACK}`}
                          >
                            {level || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          {isNum(row.hazard_count) ? row.hazard_count : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-cyan-300">
                          {isNum(row.recommended_boats)
                            ? row.recommended_boats
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
          </div>
        </main>
        )
      )}

      {viewMode === "macro" && data && (
        <section className="print-only" aria-hidden="true">
          <div className="sitrep-letterhead">
            <div className="org">
              GOVERNMENT OF PAKISTAN · NATIONAL DISASTER MANAGEMENT AUTHORITY
            </div>
            <div className="title">Flood Situation Report (SitRep)</div>
            <div className="sitrep-meta">
              <span>REF: {buildSitRepRef(data.timestamp)}</span>
              <span>AS OF: {formatPKT(data.timestamp)}</span>
              <span>CLASSIFICATION: OFFICIAL USE</span>
            </div>
          </div>

          <h2 className="sitrep-h2">1. Macro Situation Summary</h2>
          <div className="sitrep-metrics">
            {[
              [
                "Inundated Area",
                `${data.macro_summary?.inundated_area_km2?.toLocaleString() ?? "—"} km²`,
              ],
              [
                "Displaced Population",
                data.macro_summary?.displaced_population?.toLocaleString() ?? "—",
              ],
              [
                "Active Boats Deployed",
                data.macro_summary?.active_boats?.toLocaleString() ?? "—",
              ],
              [
                "Relief Camps Open",
                data.macro_summary?.relief_camps?.toLocaleString() ?? "—",
              ],
            ].map(([label, value]) => (
              <div className="sitrep-metric" key={label}>
                <div className="label">{label}</div>
                <div className="value">{value}</div>
              </div>
            ))}
          </div>

          {data.pinned_hotspots?.length > 0 && (
            <>
              <h2 className="sitrep-h2">2. Priority Hotspots</h2>
              <p className="font-mono text-sm">
                {data.pinned_hotspots.map((hotspot) => hotspot.name).join(" · ")}
              </p>
            </>
          )}

          <h2 className="sitrep-h2">
            3. Union Council Priority Risk Ranking
          </h2>
          <table className="sitrep-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Union Council</th>
                <th>District</th>
                <th>Risk</th>
                <th>Hazards</th>
                <th>Boats Req.</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(data.priority_risk_ranking)
                ? data.priority_risk_ranking
                : []
              ).map((unionCouncil, index) => {
                const level = String(unionCouncil.risk_level ?? "").replace(
                  /\D/g,
                  "",
                );
                return (
                  <tr key={`${unionCouncil.uc_name}-${index}`}>
                    <td className="mono">{index + 1}</td>
                    <td>{unionCouncil.uc_name}</td>
                    <td>{unionCouncil.district}</td>
                    <td>
                      <span className="lvl-badge" data-lvl={level}>
                        {unionCouncil.risk_level}
                      </span>
                    </td>
                    <td className="mono">{unionCouncil.hazard_count}</td>
                    <td className="mono">
                      {unionCouncil.recommended_boats}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="sitrep-footer">
            <span>
              Generated by FloodSight Pakistan Decision Support Ecosystem
            </span>
            <span>Risk scale: LVL 1 (lowest) to LVL 5 (critical)</span>
          </div>
        </section>
      )}
    </div>
  );
}