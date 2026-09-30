import React, { useState } from "react";
import "leaflet/dist/leaflet.css";
import RescueFieldPWA from "./components/RescueFieldPWA";
import CommandDashboard from "./components/CommandDashboard";

const VIEWS = {
  field: { label: "Tactical Field PWA", short: "Field" },
  command: { label: "Macro Command Dashboard", short: "Command" },
};

export default function App() {
  const [view, setView] = useState("command");

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 font-sans">
      {/* View toggle */}
      <nav className="sticky top-0 z-[2000] bg-slate-950 border-b border-slate-800 flex">
        {Object.entries(VIEWS).map(([key, { label, short }]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex-1 sm:flex-none sm:px-6 py-3 text-sm font-bold tracking-wide transition-colors relative ${
              view === key ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
            {view === key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
            )}
          </button>
        ))}
      </nav>

      {view === "field" ? <RescueFieldPWA /> : <CommandDashboard />}
    </div>
  );
}
