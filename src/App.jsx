import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import TacticalFieldView from "./components/TacticalFieldView.jsx";
import { floodAssessmentData } from "./data/floodAssessmentData.js";

const PIN_ZOOM = 10;

const SUMMARY_CARDS = [
  {
    key: "inundatedArea",
    label: "Inundated Area",
  },
  {
    key: "displacedPopulation",
    label: "Displaced Population",
  },
  {
    key: "activeBoats",
    label: "Active Boats",
  },
  {
    key: "campsNeeded",
    label: "Relief Camps Needed",
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

function MapController({ target }) {
  const map = useMap();

  useEffect(() => {
    if (target?.center) {
      map.flyTo(target.center, target.zoom ?? PIN_ZOOM, { duration: 1.2 });
    }
  }, [target, map]);

  return null;
}

export default function App() {
  const [viewMode, setViewMode] = useState("macro");
  const [selectedDistrict, setSelectedDistrict] = useState("Badin");
  const [lastSynced] = useState(() => new Date());
  const [flyTarget, setFlyTarget] = useState(null);
  const currentDistrict =
    floodAssessmentData[selectedDistrict] || floodAssessmentData.Badin;
  const currentMetrics = currentDistrict.metrics;
  const currentUCs = currentDistrict.unionCouncils;

  const handleExportSitRep = () => {
    const previousTitle = document.title;
    document.title = `NDMA_SitRep_${buildSitRepRef()}`;
    window.addEventListener(
      "afterprint",
      () => {
        document.title = previousTitle;
      },
      { once: true },
    );
    window.print();
  };

  const hotspots = useMemo(
    () => Object.entries(floodAssessmentData).map(([name, district]) => ({
      name,
      center: district.center,
      zoom: district.zoom,
    })),
    [],
  );
  const ranking = currentUCs.map((unionCouncil) => ({
    uc_name: unionCouncil.name,
    district: unionCouncil.district,
    risk_level: unionCouncil.risk,
    hazard_count: unionCouncil.hazards,
    recommended_boats: unionCouncil.boats,
  }));
  const summary = {
    active_boats: Number(currentMetrics.activeBoats.replaceAll(",", "")),
  };

  const handlePin = (hotspot) => {
    setSelectedDistrict(hotspot.name);
    setFlyTarget({ center: hotspot.center, zoom: hotspot.zoom });
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
            <p className="font-mono text-xs text-slate-400">
              {selectedDistrict} district assessment
            </p>
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
            {hotspots.map((hotspot) => (
                  <button
                    key={hotspot.name}
                    type="button"
                    onClick={() => handlePin(hotspot)}
                    aria-pressed={selectedDistrict === hotspot.name}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${selectedDistrict === hotspot.name ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/60"}`}
                  >
                    {hotspot.name}
                  </button>
                ))}
          </nav>
          )}
        </div>
      </header>

      {viewMode === "field" ? (
          <TacticalFieldView
            ranking={ranking}
            summary={summary}
            lastSynced={lastSynced}
          />
        ) : (
        <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 sm:p-5">
          <div className="no-print flex min-h-0 flex-1 flex-col gap-4">
          <section
            aria-label="Flood response summary"
            className="grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            {SUMMARY_CARDS.map(({ key, label }) => (
              <div
                key={key}
                className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-4"
              >
                <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-2 font-mono text-2xl font-bold text-cyan-300 sm:text-3xl">
                  {currentMetrics[key]}
                </p>
              </div>
            ))}
          </section>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <section
              aria-label="Flood hotspot map"
              className="h-[420px] min-h-[300px] overflow-hidden rounded-lg border border-slate-800 lg:h-auto"
            >
              <MapContainer
                  key={selectedDistrict}
                  center={currentDistrict.center}
                  zoom={currentDistrict.zoom}
                  className="h-full min-h-[300px] w-full bg-slate-950"
                >
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
                  />
                  <MapController target={flyTarget} />
                  {hotspots.map((hotspot) => (
                    <CircleMarker
                      key={hotspot.name}
                      center={hotspot.center}
                      radius={selectedDistrict === hotspot.name ? 11 : 8}
                      pathOptions={{ color: "#22d3ee", fillOpacity: 0.5 }}
                      eventHandlers={{
                        click: () => handlePin(hotspot),
                      }}
                    >
                      <Tooltip>{hotspot.name}</Tooltip>
                    </CircleMarker>
                  ))}
              </MapContainer>
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
                  {currentUCs.map((row, index) => {
                    const level = normLevel(row.risk);
                    return (
                      <tr
                        key={`${row.name}-${index}`}
                        className="hover:bg-slate-800/50"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-100">
                          {row.name}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">
                          {row.district}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-mono text-xs font-semibold ${RISK_BADGES[level] ?? RISK_BADGE_FALLBACK}`}
                          >
                            {level || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                          {isNum(row.hazards) ? row.hazards : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-cyan-300">
                          {isNum(row.boats) ? row.boats : "—"}
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
      )}

      {viewMode === "macro" && (
        <section className="print-only" aria-hidden="true">
          <div className="sitrep-letterhead">
            <div className="org">
              GOVERNMENT OF PAKISTAN · NATIONAL DISASTER MANAGEMENT AUTHORITY
            </div>
            <div className="title">Flood Situation Report (SitRep)</div>
            <div className="sitrep-meta">
              <span>REF: {buildSitRepRef()}</span>
              <span>AS OF: {formatPKT()}</span>
              <span>CLASSIFICATION: OFFICIAL USE</span>
            </div>
          </div>

          <h2 className="sitrep-h2">1. Macro Situation Summary</h2>
          <div className="sitrep-metrics">
            {[
              ["Inundated Area", currentMetrics.inundatedArea],
              ["Displaced Population", currentMetrics.displacedPopulation],
              ["Active Boats Deployed", currentMetrics.activeBoats],
              ["Relief Camps Needed", currentMetrics.campsNeeded],
            ].map(([label, value]) => (
              <div className="sitrep-metric" key={label}>
                <div className="label">{label}</div>
                <div className="value">{value}</div>
              </div>
            ))}
          </div>

          <h2 className="sitrep-h2">2. Priority Hotspot</h2>
          <p className="font-mono text-sm">{selectedDistrict}</p>

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
              {currentUCs.map((unionCouncil, index) => {
                const level = unionCouncil.risk.replace(/\D/g, "");
                return (
                  <tr key={`${unionCouncil.name}-${index}`}>
                    <td className="mono">{index + 1}</td>
                    <td>{unionCouncil.name}</td>
                    <td>{unionCouncil.district}</td>
                    <td>
                      <span className="lvl-badge" data-lvl={level}>
                        {unionCouncil.risk}
                      </span>
                    </td>
                    <td className="mono">{unionCouncil.hazards}</td>
                    <td className="mono">{unionCouncil.boats}</td>
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