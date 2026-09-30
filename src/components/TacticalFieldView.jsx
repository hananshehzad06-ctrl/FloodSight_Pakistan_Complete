import { useEffect, useMemo, useState } from "react";

function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

const RISK_SOLID = {
  "LVL 5": "bg-red-600 text-white",
  "LVL 4": "bg-orange-500 text-black",
  "LVL 3": "bg-yellow-400 text-black",
  "LVL 2": "bg-lime-400 text-black",
  "LVL 1": "bg-emerald-400 text-black",
};
const RISK_BORDER = {
  "LVL 5": "border-red-500",
  "LVL 4": "border-orange-500",
  "LVL 3": "border-yellow-400",
  "LVL 2": "border-lime-400",
  "LVL 1": "border-emerald-400",
};

const normLevel = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
const levelRank = (value) => Number(normLevel(value).match(/[1-5]/)?.[0] ?? 0);
const isNum = (value) => typeof value === "number" && Number.isFinite(value);

function formatLaunch(safeLaunch) {
  if (!safeLaunch) return null;
  if (typeof safeLaunch === "string") {
    return { text: safeLaunch, href: null };
  }

  const lat = Number(safeLaunch.lat);
  const lng = Number(safeLaunch.long ?? safeLaunch.lng ?? safeLaunch.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    text: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    href: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}

function ConnectivityBadge({ online }) {
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs font-bold ${
        online ? "bg-emerald-400 text-black" : "bg-amber-400 text-black"
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          online ? "bg-emerald-900" : "animate-pulse bg-amber-900"
        }`}
      />
      {online ? "ONLINE" : "OFFLINE · CACHED"}
    </span>
  );
}

function SyncBadge({ lastSynced, online }) {
  const label = lastSynced
    ? lastSynced.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "never";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
        online
          ? "border-cyan-400 text-cyan-300"
          : "border-amber-400 text-amber-300"
      }`}
    >
      {online ? "SYNCED" : "LAST SYNC"} {label}
    </span>
  );
}

function FieldCard({ row }) {
  const level = normLevel(row.risk_level);
  const launch = formatLaunch(row.safe_launch);
  const tags = Array.isArray(row.hazards) ? row.hazards : [];

  return (
    <article
      className={`rounded-xl border-l-8 bg-slate-900 p-4 ${
        RISK_BORDER[level] ?? "border-slate-600"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-white">
            {row.uc_name ?? "Unknown UC"}
          </h3>
          <p className="text-sm text-slate-400">{row.district ?? "—"}</p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-sm font-extrabold ${
            RISK_SOLID[level] ?? "bg-slate-600 text-white"
          }`}
        >
          {level || "N/A"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-950 p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Boats
          </p>
          <p className="font-mono text-3xl font-extrabold text-cyan-300">
            {isNum(row.recommended_boats) ? row.recommended_boats : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-950 p-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Hazards
          </p>
          <p className="font-mono text-3xl font-extrabold text-red-400">
            {isNum(row.hazard_count) ? row.hazard_count : "—"}
          </p>
        </div>
      </div>

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <li
              key={`${tag}-${index}`}
              className="rounded bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/50"
            >
              ⚠ {String(tag)}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-lg border border-slate-700 p-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
          Safe boat launch
        </p>
        {launch ? (
          launch.href ? (
            <a
              href={launch.href}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block min-h-[44px] py-2 font-mono text-base font-bold text-cyan-300 underline"
            >
              {launch.text}
            </a>
          ) : (
            <p className="mt-1 font-mono text-base font-bold text-cyan-300">
              {launch.text}
            </p>
          )
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Not provided by assessment
          </p>
        )}
      </div>
    </article>
  );
}

export default function TacticalFieldView({
  ranking = [],
  summary = {},
  timestamp = null,
  lastSynced = null,
}) {
  const online = useOnlineStatus();
  const sorted = useMemo(
    () =>
      [...ranking].sort(
        (first, second) =>
          levelRank(second.risk_level) - levelRank(first.risk_level),
      ),
    [ranking],
  );
  const totalRecommended = useMemo(
    () =>
      ranking.reduce(
        (sum, row) =>
          sum + (isNum(row.recommended_boats) ? row.recommended_boats : 0),
        0,
      ),
    [ranking],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950 px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                FloodSight Pakistan
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-white">
                Tactical Field View
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ConnectivityBadge online={online} />
              <SyncBadge lastSynced={lastSynced} online={online} />
            </div>
          </div>
          {timestamp && (
            <p className="font-mono text-xs text-slate-400">
              Data as of {new Date(timestamp).toLocaleString("en-GB")}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl">
        <section
          aria-label="Boat deployment summary"
          className="grid grid-cols-2 gap-3 p-4"
        >
          <div className="rounded-xl bg-cyan-500/15 p-3 ring-1 ring-cyan-400/50">
            <p className="font-mono text-[11px] uppercase text-cyan-200">
              Boats deployed
            </p>
            <p className="font-mono text-3xl font-extrabold text-cyan-300">
              {isNum(summary.active_boats)
                ? summary.active_boats.toLocaleString("en-US")
                : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-800 p-3">
            <p className="font-mono text-[11px] uppercase text-slate-300">
              Recommended (listed)
            </p>
            <p className="font-mono text-3xl font-extrabold text-white">
              {totalRecommended.toLocaleString("en-US")}
            </p>
          </div>
        </section>

        <section
          aria-label="Union council field assessments"
          className="space-y-3 px-4 pb-8"
        >
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              No active assessments.
            </p>
          ) : (
            sorted.map((row, index) => (
              <FieldCard key={`${row.uc_name}-${index}`} row={row} />
            ))
          )}
        </section>
      </main>
    </div>
  );
}
