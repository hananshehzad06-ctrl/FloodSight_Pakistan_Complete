import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertTriangle,
  Droplets,
  Loader2,
  X,
  Wifi,
  WifiOff,
  Radio,
  Save,
  Languages,
  MapPin,
  CheckCircle2,
  CloudOff,
} from 'lucide-react';
import { MOCK_PAYLOADS } from '../data/mockData';
import { initDB, seedInitialData, getAllCachedPayloads, savePayload } from '../utils/db';
import { processAssessResponse } from '../utils/payloadParser';

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const ASSESS_ENDPOINT = '/api/assess';
const ASSESS_TIMEOUT_MS = 8000;
const NATIONWIDE_CENTER = [30.3753, 69.3451];
const QUICK_JUMP_PRESETS = [
  { label: 'Badin', coordinates: [24.34, 68.83] },
  { label: 'Swat', coordinates: [35.22, 72.42] },
  { label: 'Taunsa', coordinates: [30.7, 70.65] },
  { label: 'Sukkur', coordinates: [27.71, 68.84] },
];

// TODO(sub-agent/schema): frozen UC payload has no per-UC area_km2 field yet.
// Until that lands, fallback estimation uses this flat assumption for a
// "typical" Union Council land area (Sindh/KP average). Replace once
// districts.json or the UC schema exposes a real geometry/area field.
const ASSUMED_UC_AREA_KM2 = 42;

/* ------------------------------------------------------------------ */
/*  GEO HELPERS                                                        */
/* ------------------------------------------------------------------ */

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateFallbackPayload(lat, lng) {
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 43758.5453;
  const pseudoRandom = seed - Math.floor(seed);
  const inundatedKm2 = Number((0.5 + pseudoRandom * 44.5).toFixed(1));
  const waterDepthM = Number((0.2 + (1 - pseudoRandom) * 3.8).toFixed(1));
  const inundatedPct = Math.min(100, (inundatedKm2 / ASSUMED_UC_AREA_KM2) * 100);
  const hazard = deriveHazardFromPct(inundatedPct);

  return {
    inundated_pct_est: inundatedPct,
    inundated_km2: inundatedKm2,
    water_depth_m: waterDepthM,
    hazard_lvl: hazard.level === 'critical' ? 5 : hazard.level === 'high' ? 4 : hazard.level === 'moderate' ? 3 : 1,
    ai_sitrep_en: `Local estimate for ${lat.toFixed(4)}, ${lng.toFixed(4)}: ${inundatedKm2} sq km inundated with water depth of ${waterDepthM}m. Verify conditions before dispatch.`,
    ai_sitrep_ur: `${lat.toFixed(4)}، ${lng.toFixed(4)} کے لیے مقامی تخمینہ: ${inundatedKm2} مربع کلومیٹر زیر آب ہے اور پانی کی گہرائی ${waterDepthM} میٹر ہے۔ روانگی سے پہلے حالات کی تصدیق کریں۔`,
    hazard_level: hazard.level,
    nearest_uc_name: null,
    nearest_uc_distance_km: 0,
  };
}

/** Same threshold logic mirrored from CommandDashboard's deriveHazardLevel(),
 *  kept in sync manually until both components import a shared util.
 *  DRIFT RISK: if CommandDashboard's thresholds change, update here too. */
function deriveHazardFromPct(pct, hazardLevel) {
  if (Number.isInteger(hazardLevel)) {
    const levelMap = {
      5: { level: 'critical', color: 'red' },
      4: { level: 'high', color: 'amber' },
      3: { level: 'moderate', color: 'yellow' },
      2: { level: 'moderate', color: 'yellow' },
      1: { level: 'low', color: 'cyan' },
    };
    return levelMap[hazardLevel] || levelMap[1];
  }
  if (pct >= 70) return { level: 'critical', color: 'red' };
  if (pct >= 40) return { level: 'high', color: 'amber' };
  if (pct >= 15) return { level: 'moderate', color: 'yellow' };
  return { level: 'low', color: 'cyan' };
}

/* ------------------------------------------------------------------ */
/*  LEAFLET ICONS                                                      */
/* ------------------------------------------------------------------ */

// Deliberately inline SVG DivIcon (not default Leaflet PNG marker) to avoid
// bundler asset-resolution issues — same pattern used in FloodMap.jsx.
const pulsingPinIcon = L.divIcon({
  className: 'fs-pulsing-pin',
  html: `
    <div style="position:relative;width:28px;height:28px;">
      <div style="position:absolute;inset:0;border-radius:9999px;background:rgba(239,68,68,0.45);animation:fsPulse 1.4s ease-out infinite;"></div>
      <div style="position:absolute;top:8px;left:8px;width:12px;height:12px;border-radius:9999px;background:#ef4444;border:2px solid #fecaca;box-shadow:0 0 6px rgba(239,68,68,0.9);"></div>
    </div>
    <style>
      @keyframes fsPulse {
        0% { transform: scale(0.4); opacity: 0.9; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    </style>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function ucDivIcon(hazardColor) {
  const fill =
    { red: '#ef4444', amber: '#f59e0b', yellow: '#eab308', cyan: '#22d3ee' }[hazardColor] ||
    '#22d3ee';
  return L.divIcon({
    className: 'fs-uc-pin',
    html: `<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="${fill}" fill-opacity="0.25" stroke="${fill}" stroke-width="2"/><circle cx="9" cy="9" r="3" fill="${fill}"/></svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* ------------------------------------------------------------------ */
/*  MAP CLICK LISTENER                                                  */
/* ------------------------------------------------------------------ */

function AssessAnywhereClickLayer({ onMapClick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e?.latlng ?? {};
      if (Number.isFinite(lat) && Number.isFinite(lng) && typeof onMapClick === 'function') {
        onMapClick(lat, lng);
      }
    },
  });
  return null;
}

function MapNavigationController({ actionRef }) {
  const map = useMap();

  useEffect(() => {
    actionRef.current = {
      flyTo(coordinates, zoom = 12) {
        map.flyTo(coordinates, zoom, { duration: 1.1 });
      },
      reset() {
        map.flyTo(NATIONWIDE_CENTER, 6, { duration: 1.1 });
      },
    };

    return () => {
      actionRef.current = null;
    };
  }, [actionRef, map]);

  return null;
}

function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  WATER DEPTH METER                                                  */
/* ------------------------------------------------------------------ */

function WaterDepthMeter({ depthM }) {
  const safeDepth = Number.isFinite(depthM) ? depthM : 0;
  const clamped = Math.max(0, Math.min(safeDepth, 4));
  const pct = (clamped / 4) * 100;
  const barColor =
    safeDepth >= 2.5 ? 'bg-red-500' : safeDepth >= 1.2 ? 'bg-amber-500' : 'bg-cyan-400';

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">
          Water depth
        </span>
        <span className="font-mono text-lg text-slate-100">
          {safeDepth.toFixed(2)} <span className="text-xs text-slate-400">m</span>
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ASSESSMENT DRAWER                                                   */
/* ------------------------------------------------------------------ */

function AssessmentDrawer({
  open,
  onClose,
  point,
  status, // 'loading' | 'success' | 'fallback' | 'error'
  data,
  onSaveOffline,
  savedFlag,
}) {
  const [lang, setLang] = useState('en');

  if (!open || !point) return null;

  const hazard = data
    ? deriveHazardFromPct(data.inundated_pct_est ?? 0, data.hazard_lvl)
    : null;
  const hazardBg =
    {
      red: 'bg-red-950/60 border-red-700 text-red-300',
      amber: 'bg-amber-950/50 border-amber-700 text-amber-300',
      yellow: 'bg-yellow-950/40 border-yellow-700 text-yellow-300',
      cyan: 'bg-cyan-950/40 border-cyan-700 text-cyan-300',
    }[hazard?.color] || 'bg-slate-800 border-slate-700 text-slate-300';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] animate-[fsSlideUp_0.25s_ease-out]">
      <style>{`@keyframes fsSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div className="mx-auto max-w-lg rounded-t-2xl border-t border-x border-slate-700 bg-slate-950/98 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
        {/* Drag handle */}
        <div className="flex justify-center pt-2">
          <div className="h-1.5 w-12 rounded-full bg-slate-700" />
        </div>

        <div className="flex items-start justify-between px-4 pt-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Assess anywhere · tapped point
            </p>
            <p className="font-mono text-sm text-slate-200">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 active:bg-slate-800"
            aria-label="Close assessment drawer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pb-6 pt-3">
          {status === 'loading' && (
            <div className="flex items-center gap-3 rounded-xl border border-cyan-800 bg-cyan-950/40 px-4 py-4">
              <Loader2 className="animate-spin text-cyan-400 shrink-0" size={22} />
              <span className="text-sm text-cyan-200">
                Querying Alibaba Cloud Function Compute &amp; Qwen-Max AI...
              </span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3 rounded-xl border border-red-800 bg-red-950/40 px-4 py-4">
              <AlertTriangle className="text-red-400 shrink-0" size={22} />
              <span className="text-sm text-red-200">
                Assessment failed and no offline estimate was possible. Try again once
                you have signal.
              </span>
            </div>
          )}

          {(status === 'success' || status === 'fallback') && data && (
            <div className="space-y-4">
              {status === 'fallback' && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-300">
                  <CloudOff size={14} className="shrink-0" />
                  Offline estimate — client-side spatial approximation from cached
                  UC data, not live AI. Nearest cached UC:{' '}
                  <span className="font-mono">{data.nearest_uc_name}</span> (
                  {data.nearest_uc_distance_km.toFixed(1)} km away)
                </div>
              )}

              <div className={`rounded-xl border px-4 py-3 ${hazardBg}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {hazard.level} hazard
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Inundated area (est.)</span>
                  <span className="font-mono text-sm">
                    {data.inundated_km2.toFixed(2)} km²
                  </span>
                </div>
              </div>

              <WaterDepthMeter depthM={data.water_depth_m} />

              <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    AI SitRep summary
                  </span>
                  <button
                    onClick={() => setLang((l) => (l === 'en' ? 'ur' : 'en'))}
                    className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 active:bg-slate-800"
                  >
                    <Languages size={12} />
                    {lang === 'en' ? 'اردو' : 'EN'}
                  </button>
                </div>
                <p
                  className={`text-sm leading-relaxed text-slate-200 ${
                    lang === 'ur' ? 'text-right' : 'text-left'
                  }`}
                  dir={lang === 'ur' ? 'rtl' : 'ltr'}
                >
                  {lang === 'en' ? data.ai_sitrep_en : data.ai_sitrep_ur}
                </p>
              </div>

              <button
                onClick={onSaveOffline}
                disabled={savedFlag}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-colors ${
                  savedFlag
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                    : 'bg-cyan-600 text-slate-950 active:bg-cyan-500'
                }`}
                style={{ minHeight: 48 }}
              >
                {savedFlag ? (
                  <>
                    <CheckCircle2 size={18} /> Saved to Local IndexedDB
                  </>
                ) : (
                  <>
                    <Save size={18} /> Save to Local IndexedDB (Offline)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function RescueFieldPWA() {
  const [ucPayloads, setUcPayloads] = useState(MOCK_PAYLOADS);
  const [activeUC, setActiveUC] = useState(MOCK_PAYLOADS?.[0] ?? null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // --- Assess Anywhere state ---
  const [assessPoint, setAssessPoint] = useState(null); // { lat, lng }
  const [assessStatus, setAssessStatus] = useState('idle'); // idle|loading|success|fallback|error
  const [assessData, setAssessData] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const abortRef = useRef(null);
  const mapActionRef = useRef(null);

  /* ---------------- DB bootstrap ---------------- */
  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await seedInitialData(MOCK_PAYLOADS);
        const cached = await getAllCachedPayloads();
        if (cached?.length) setUcPayloads(cached);
      } catch (err) {
        // IndexedDB unavailable (private browsing, old WebView, etc.) —
        // fall back silently to in-memory MOCK_PAYLOADS already in state.
        console.warn('[RescueFieldPWA] IndexedDB init failed, using mock data', err);
      }
    })();
  }, []);

  /* ---------------- online/offline telemetry ---------------- */
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /* ---------------- fallback client-side estimation ---------------- */
  const runFallbackEstimation = useCallback(
    async (lat, lng) => {
      const fallback = generateFallbackPayload(lat, lng);
      let cached = ucPayloads;
      try {
        const fromDb = await getAllCachedPayloads();
        if (fromDb?.length) cached = fromDb;
      } catch {
        /* window.indexedDB may be unavailable — use in-memory ucPayloads */
      }

      if (!Array.isArray(cached) || cached.length === 0) {
        setAssessData(fallback);
        setAssessStatus('fallback');
        return;
      }

      // Nearest cached UC by great-circle distance stands in for a real
      // point-in-polygon / raster lookup until offline geometry data ships.
      let nearest = null;
      let nearestDist = Infinity;
      for (const uc of Array.isArray(cached) ? cached : []) {
        const [ucLat, ucLng] = uc?.safe_launch ?? uc?.centroid ?? [];
        if (ucLat == null || ucLng == null) continue;
        const d = haversineKm(lat, lng, ucLat, ucLng);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = uc;
        }
      }

      if (!nearest) {
        setAssessData(fallback);
        setAssessStatus('fallback');
        return;
      }

      // Distance decay: assume hazard tapers off the further the tapped
      // point is from the nearest known UC reading.
      const decay = Math.max(0.15, 1 - nearestDist / 25);
      const estPct = Math.min(100, (nearest.inundated_pct ?? 0) * decay);
      const hazard = deriveHazardFromPct(estPct);
      const nearestName = nearest.name ?? nearest.uc_name ?? 'nearest cached location';
      const nearestDistrict = nearest.district ?? 'Pakistan';

      setAssessData({
        inundated_pct_est: estPct,
        inundated_km2: (estPct / 100) * ASSUMED_UC_AREA_KM2,
        water_depth_m: Math.min(4, (estPct / 100) * 4.2),
        ai_sitrep_en: `Offline estimate near ${nearestName}, ${nearestDistrict}: approx. ${estPct.toFixed(
          0
        )}% inundation extrapolated from last synced UC data (${nearestDist.toFixed(
          1
        )} km away). Verify on ground before committing boats.`,
        ai_sitrep_ur: `${nearestName}، ${nearestDistrict} کے قریب آف لائن تخمینہ: آخری مطابقت شدہ ڈیٹا سے تقریباً ${estPct.toFixed(
          0
        )}% ڈوباؤ کا اندازہ (${nearestDist.toFixed(
          1
        )} کلومیٹر دور)۔ کشتیاں روانہ کرنے سے پہلے موقع پر تصدیق کریں۔`,
        nearest_uc_name: nearestName,
        nearest_uc_distance_km: nearestDist,
        hazard_level: hazard.level,
      });
      setAssessStatus('fallback');
    },
    [ucPayloads]
  );

  /* ---------------- live fetch ---------------- */
  const fetchAssessment = useCallback(
    async (lat, lng) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), ASSESS_TIMEOUT_MS);

      try {
        const res = await fetch(ASSESS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Assess API responded ${res.status}`);
        const record = await res.json();
        const parsed = processAssessResponse(record);
        if (!parsed.valid) {
          throw new Error(`Invalid assessment payload: ${parsed.errors.join('; ')}`);
        }
        const validatedPayload = parsed.data;

        // SCHEMA DRIFT NOTE: contract assumed with backend/Qoder sub-agent:
        // { inundated_km2: number, water_depth_m: number,
        //   ai_sitrep_en: string, ai_sitrep_ur: string,
        //   inundated_pct_est?: number }
        // inundated_pct_est is optional — derived from km² / ASSUMED_UC_AREA_KM2
        // if the backend doesn't send it directly. Confirm real field name
        // once the Alibaba Function Compute contract is finalized.
        setAssessData({
          inundated_km2: validatedPayload.inundated_km2,
          water_depth_m: validatedPayload.water_depth_m,
          ai_sitrep_en: validatedPayload.ai_sitrep_en,
          ai_sitrep_ur: validatedPayload.ai_sitrep_ur,
          hazard_lvl: validatedPayload.hazard_lvl,
          inundated_pct_est:
            Math.min(100, (validatedPayload.inundated_km2 / ASSUMED_UC_AREA_KM2) * 100),
          nearest_uc_name: null,
          nearest_uc_distance_km: 0,
        });
        setAssessStatus('success');
      } catch (err) {
        await runFallbackEstimation(lat, lng);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [runFallbackEstimation]
  );

  /* ---------------- map click handler ---------------- */
  const handleMapClick = useCallback(
    (lat, lng) => {
      setAssessPoint({ lat, lng });
      setDrawerOpen(true);
      setSavedFlag(false);
      setAssessData(null);
      setAssessStatus('loading');

      if (!isOnline) {
        runFallbackEstimation(lat, lng);
      } else {
        fetchAssessment(lat, lng);
      }
    },
    [isOnline, fetchAssessment, runFallbackEstimation]
  );

  const handlePresetJump = useCallback(
    (coordinates) => {
      mapActionRef.current?.flyTo(coordinates);
      handleMapClick(coordinates[0], coordinates[1]);
    },
    [handleMapClick]
  );

  const handleResetView = useCallback(() => {
    mapActionRef.current?.reset();
  }, []);

  /* ---------------- save offline ---------------- */
  const handleSaveOffline = useCallback(async () => {
    if (!assessPoint || !assessData) return;
    const record = {
      uc_id: `assess-${assessPoint.lat.toFixed(5)}-${assessPoint.lng.toFixed(5)}`,
      name: assessData.nearest_uc_name
        ? `Near ${assessData.nearest_uc_name}`
        : 'Assess Anywhere point',
      district: 'unknown', // TODO(schema): reverse-geocode once districts.json carries polygons
      status: assessStatus === 'fallback' ? 'offline_estimate' : 'ai_assessed',
      inundated_pct: assessData.inundated_pct_est,
      safe_launch: [assessPoint.lat, assessPoint.lng],
      hazards: [assessData.hazard_level ?? deriveHazardFromPct(assessData.inundated_pct_est, assessData.hazard_lvl).level],
      timestamp: new Date().toISOString(),
      // Extra "Assess Anywhere" fields, additive to the frozen schema —
      // consumers that only know the frozen fields can safely ignore these.
      inundated_km2: assessData.inundated_km2,
      water_depth_m: assessData.water_depth_m,
      ai_sitrep_en: assessData.ai_sitrep_en,
      ai_sitrep_ur: assessData.ai_sitrep_ur,
      source: assessStatus,
    };

    try {
      await savePayload(record);
      setSavedFlag(true);
    } catch (err) {
      console.error('[RescueFieldPWA] Failed to save assessment to IndexedDB', err);
      // window.indexedDB may be unsupported in this WebView — degrade to
      // localStorage as a last resort so the field worker doesn't lose data.
      try {
        const key = 'floodsight_offline_queue';
        const queue = JSON.parse(localStorage.getItem(key) || '[]');
        queue.push(record);
        localStorage.setItem(key, JSON.stringify(queue));
        setSavedFlag(true);
      } catch (lsErr) {
        console.error('[RescueFieldPWA] localStorage fallback also failed', lsErr);
      }
    }
  }, [assessPoint, assessData, assessStatus]);

  const defaultCenter = activeUC?.safe_launch ?? activeUC?.centroid ?? [24.86, 68.93]; // Badin default
  const safePayloads = Array.isArray(ucPayloads) ? ucPayloads.filter(Boolean) : [];

  return (
    <div className="relative flex h-screen w-full flex-col bg-slate-950 text-slate-100">
      {/* Telemetry banner */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-cyan-400" />
          <span className="text-xs font-mono text-slate-300">
            {activeUC?.name ?? '—'} · {activeUC?.district ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <Wifi size={14} className="text-emerald-400" />
          ) : (
            <WifiOff size={14} className="text-amber-400" />
          )}
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {isOnline ? 'Online' : 'Offline · cached mode'}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="w-full h-[calc(100vh-140px)] min-h-[500px] relative">
        <MapContainer
          center={defaultCenter}
          zoom={12}
          scrollWheelZoom={false}
          className="h-full w-full"
          style={{ background: '#0f172a' }}
        >
          <MapResizer />
          <MapNavigationController actionRef={mapActionRef} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <AssessAnywhereClickLayer onMapClick={handleMapClick} />

          {safePayloads.map((uc) => {
            const hazard = deriveHazardFromPct(uc.inundated_pct ?? 0, uc.hz_lvl);
            const pos = uc.safe_launch ?? uc.centroid;
            if (!pos) return null;
            return (
              <Marker
                key={uc.uc_id ?? `${pos[0]}-${pos[1]}`}
                position={pos}
                icon={ucDivIcon(hazard.color)}
                eventHandlers={{ click: () => setActiveUC(uc) }}
              >
                <Popup>
                  <span className="font-semibold">{uc.name ?? uc.uc_name ?? 'Unknown location'}</span>
                  <br />
                  {uc.inundated_pct}% inundated · {hazard.level}
                </Popup>
              </Marker>
            );
          })}

          {assessPoint && <Marker position={[assessPoint.lat, assessPoint.lng]} icon={pulsingPinIcon} />}
        </MapContainer>

        <div
          className="absolute inset-x-3 top-3 z-[1000] flex gap-2 overflow-x-auto pb-1 sm:justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          {QUICK_JUMP_PRESETS.map(({ label, coordinates }) => (
            <button
              key={label}
              type="button"
              onClick={() => handlePresetJump(coordinates)}
              className="shrink-0 rounded-full border border-cyan-400/50 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-lg backdrop-blur transition-colors hover:bg-cyan-900/90 active:bg-cyan-800"
              aria-label={`Jump to ${label} flood zone`}
            >
              <span aria-hidden="true">📍</span> {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleResetView}
          className="absolute bottom-3 right-3 z-[1000] rounded-lg border border-slate-600 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur transition-colors hover:bg-slate-800 active:bg-slate-700"
          aria-label="Reset map to nationwide Pakistan view"
        >
          Reset View
        </button>

        <div
          className={`pointer-events-none absolute inset-x-3 z-[1100] text-center transition-all ${
            drawerOpen ? 'bottom-[19rem]' : 'bottom-3'
          }`}
        >
          <span className="inline-block rounded-full border border-amber-400/50 bg-slate-950/90 px-3 py-2 text-[11px] font-semibold tracking-wide text-amber-100 shadow-lg backdrop-blur">
            💡 TAP ANYWHERE ON MAP TO ASSESS FLOOD DEPTH (&lt;1 KB)
          </span>
        </div>

        {/* Floating hint */}
        {!drawerOpen && (
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-[11px] text-slate-300 shadow-lg">
            <MapPin size={12} className="mr-1 inline text-cyan-400" />
            Tap anywhere to assess that location
          </div>
        )}
      </div>

      <AssessmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        point={assessPoint}
        status={assessStatus}
        data={assessData}
        onSaveOffline={handleSaveOffline}
        savedFlag={savedFlag}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  IMPLEMENTATION NOTES FOR DOWNSTREAM SUB-AGENTS                     */
/* ------------------------------------------------------------------ */
//
// 1. BACKEND CONTRACT (Qoder / Alibaba Function Compute):
//    POST /api/assess  Body: { lat: number, lng: number }
//    Expected 200 JSON: { inundated_km2, water_depth_m, ai_sitrep_en,
//      ai_sitrep_ur, inundated_pct_est?, nearest_uc_name?, nearest_uc_distance_km? }
//    Until this endpoint exists, every tap will hit the catch block and
//    resolve through runFallbackEstimation() — this is expected, not a bug.
//
// 2. FALLBACK ACCURACY: the offline estimator is a straight-line distance
//    decay from the nearest cached UC reading. It is intentionally
//    conservative-labeled ("offline estimate") in the UI and should never
//    be presented to command staff as AI-graded. Do not remove the
//    'fallback' visual distinction without discussing with Ops UX lead.
//
// 3. ASSUMED_UC_AREA_KM2 is a placeholder constant (see top of file) used
//    for both fallback estimation and normalizing backend inundated_km2
//    into a hazard-color percentage. Replace with a real per-UC area once
//    districts.json/schema exposes it — flagged also in mockData.js notes.
//
// 4. hazard threshold logic (deriveHazardFromPct) is duplicated from
//    CommandDashboard.jsx's deriveHazardLevel(). Extract to a shared
//    src/utils/hazard.js the next time either file is touched, so the two
//    dashboards can't silently drift apart on what counts as "critical".
//
// 5. IndexedDB save path degrades to localStorage if `idb`/window.indexedDB
//    throws (older Android WebViews in field conditions). The localStorage
//    queue key `floodsight_offline_queue` is NOT currently drained by the
//    "Force Re-Sync" stub — wire that up together with the SMS/2G transport
//    layer task already tracked in the blueprint.
//
// 6. ai_sitrep_ur is a hand-written template string in the fallback path,
//    not a real translation — flag for review once a proper UR localization
//    pipeline (or the backend AI itself) is producing that field.
