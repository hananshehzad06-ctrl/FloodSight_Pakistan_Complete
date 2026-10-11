import React, { useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  BarChart3,
  Users,
  Ship,
  Tent,
  FileDown,
  ShieldAlert,
  ChevronRight,
  Printer,
} from "lucide-react";
import { floodAssessmentData } from "../data/floodAssessmentData.js";

/* ------------------------------------------------------------------ */
/*  Hazard-level fallback                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Badge component                                                    */
/* ------------------------------------------------------------------ */

const LEVEL_STYLES = {
  1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  2: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  3: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  4: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  5: "bg-red-500/15 text-red-400 border-red-500/40",
};

const LEVEL_ROW_GLOW = {
  1: "",
  2: "",
  3: "",
  4: "border-l-orange-500/50",
  5: "border-l-red-500/60",
};

function LevelBadge({ level }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-[11px] font-bold tracking-widest tabular-nums ${LEVEL_STYLES[level] || LEVEL_STYLES[3]}`}
    >
      LVL&nbsp;{level}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Metric card                                                        */
/* ------------------------------------------------------------------ */

function MetricCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="metric-card bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accent}`} strokeWidth={2.5} />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-100 leading-none">
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dashboard                                                     */
/* ------------------------------------------------------------------ */

export default function CommandDashboard({ onGenerateSitRep }) {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState("Badin");
  const currentDistrict =
    floodAssessmentData[selectedDistrict] || floodAssessmentData.Badin;
  const currentMetrics = currentDistrict.metrics;
  const currentUCs = currentDistrict.unionCouncils;

  /* Enrich + sort ---------------------------------------------------- */
  const ranked = currentUCs.map((uc) => ({
    ...uc,
    uc_id: uc.name,
    uc_name: uc.name,
    _level: Number.parseInt(uc.risk.replace("LVL ", ""), 10),
  }));

  /* Aggregates ------------------------------------------------------ */
  const totalHazards = currentUCs.reduce((total, uc) => total + uc.hazards, 0);
  const totalBoats = currentUCs.reduce((total, uc) => total + uc.boats, 0);

  const handleSitRep = () => {
    if (typeof onGenerateSitRep === "function") {
      onGenerateSitRep();
    } else {
      window.print();
    }
  };

  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-cyan-400" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight leading-tight">
              NDMA / PDMA Macro Command
            </h1>
            <p className="text-[11px] text-slate-500 font-medium tabular-nums">
              FloodSight Pakistan &middot; {selectedDistrict} district assessment
            </p>
          </div>
        </div>
        <span className="no-print hidden sm:inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold px-3 py-1 rounded-md tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          LIVE CONSOLE
        </span>
      </header>

      {/* ── Content ───────────────────────────────────────────────── */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-8 max-w-6xl mx-auto w-full">
        <nav
          aria-label="Flood hotspots"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
            Hotspots
          </span>
          {Object.keys(floodAssessmentData).map((district) => (
            <button
              key={district}
              type="button"
              onClick={() => setSelectedDistrict(district)}
              aria-pressed={selectedDistrict === district}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                selectedDistrict === district
                  ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-cyan-500/60"
              }`}
            >
              {district}
            </button>
          ))}
        </nav>

        {/* Metric cards --------------------------------------------- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={BarChart3}
            label="Inundated Area"
            value={currentMetrics.inundatedArea}
            accent="text-cyan-400"
          />
          <MetricCard
            icon={Users}
            label="Displaced Population"
            value={currentMetrics.displacedPopulation}
            accent="text-amber-400"
          />
          <MetricCard
            icon={Ship}
            label="Active Rescue Boats"
            value={currentMetrics.activeBoats}
            accent="text-emerald-400"
          />
          <MetricCard
            icon={Tent}
            label="Relief Camps Needed"
            value={currentMetrics.campsNeeded}
            accent="text-red-400"
          />
        </section>

        <section
          aria-label={`${selectedDistrict} hotspot map`}
          className="h-[360px] overflow-hidden rounded-xl border border-slate-800"
        >
          <MapContainer
            key={selectedDistrict}
            center={currentDistrict.center}
            zoom={currentDistrict.zoom}
            className="h-full w-full bg-slate-950"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
            />
            {Object.entries(floodAssessmentData).map(([district, entry]) => (
              <CircleMarker
                key={district}
                center={entry.center}
                radius={district === selectedDistrict ? 11 : 7}
                pathOptions={{
                  color: "#22d3ee",
                  fillOpacity: district === selectedDistrict ? 0.8 : 0.45,
                }}
                eventHandlers={{ click: () => setSelectedDistrict(district) }}
              >
                <Tooltip>{district}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </section>

        {/* Priority Risk Ranking ------------------------------------ */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-sm tracking-wide uppercase text-slate-300">
              Priority Risk Ranking
            </h2>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {ranked.length} UCs &middot; {totalHazards} hazards &middot;{" "}
              {totalBoats} boats
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-semibold w-10">#</th>
                  <th className="text-left px-3 py-3 font-semibold">
                    Union Council
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">District</th>
                  <th className="text-center px-3 py-3 font-semibold">Level</th>
                  <th className="text-center px-3 py-3 font-semibold tabular-nums">
                    Hazards
                  </th>
                  <th className="text-center px-3 py-3 font-semibold tabular-nums">
                    Boats
                  </th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {ranked.map((uc, idx) => {
                  const isHover = hoveredRow === uc.uc_id;
                  return (
                    <tr
                      key={uc.uc_id}
                      onMouseEnter={() => setHoveredRow(uc.uc_id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`table-row border-b border-slate-800/60 transition-colors border-l-2 ${LEVEL_ROW_GLOW[uc._level] || "border-l-transparent"} ${isHover ? "bg-slate-800/50" : ""}`}
                    >
                      <td className="px-5 py-3.5 tabular-nums text-slate-500 font-mono text-xs">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="px-3 py-3.5 font-bold text-slate-100">
                        {uc.uc_name}
                      </td>
                      <td className="px-3 py-3.5 text-slate-400">
                        {uc.district}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <LevelBadge level={uc._level} />
                      </td>
                      <td className="px-3 py-3.5 text-center tabular-nums font-mono text-slate-300">
                        {uc.hazards}
                      </td>
                      <td className="px-3 py-3.5 text-center tabular-nums font-mono text-emerald-400">
                        {uc.boats}
                      </td>
                      <td className="px-3 py-3.5">
                        <ChevronRight
                          className={`w-4 h-4 transition-colors ${isHover ? "text-cyan-400" : "text-slate-700"}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SitRep export banner ------------------------------------- */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-cyan-400" strokeWidth={2.5} />
              Generate Consolidated SitRep
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Export the {selectedDistrict} situation report covering{" "}
              {ranked.length} Union Councils, {totalHazards} active hazards,
              and {currentMetrics.displacedPopulation} displaced persons.
            </p>
          </div>
          <button
            onClick={handleSitRep}
            className="no-print shrink-0 inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm px-5 py-3 rounded-xl active:scale-[0.97] transition-transform min-h-[48px]"
          >
            <Printer className="w-4 h-4" strokeWidth={2.5} />
            Export SitRep
          </button>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 px-5 py-3 text-[11px] text-slate-600 tabular-nums text-center">
        FloodSight Pakistan &middot; NDMA/PDMA Command Console &middot;{" "}
        {selectedDistrict}
      </footer>
    </div>
  );
}
