import React, { useState, useEffect, useCallback } from 'react';
import RescueFieldPWA from './components/RescueFieldPWA.jsx';
import CommandDashboard from './components/CommandDashboard.jsx';
import { initDB, seedInitialData } from './utils/db.js';

// ---------------------------------------------------------------------------
// Error Boundary — isolates view-level crashes (e.g. malformed UC payload,
// missing districts.json key) so the shell/navbar stays usable.
// ---------------------------------------------------------------------------
class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[FloodSight] View render error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] bg-slate-950 text-slate-200 px-6 text-center">
          <p className="font-mono text-red-400 text-sm mb-2">VIEW RENDER FAILURE</p>
          <p className="text-slate-400 text-xs mb-4 max-w-md">
            {this.state.error?.message ?? 'Unknown error while rendering this view.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            Retry View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// App Shell
// ---------------------------------------------------------------------------
const VIEWS = {
  FIELD: 'field',
  COMMAND: 'command',
};

export default function App() {
  const [activeView, setActiveView] = useState(VIEWS.FIELD);
  const [dbStatus, setDbStatus] = useState('initializing'); // 'initializing' | 'ready' | 'error'
  const [dbError, setDbError] = useState(null);

  // Initialize IndexedDB once on mount. Both views depend on cached payloads
  // being available offline, so this lives at the shell level.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await initDB();
        await seedInitialData();
        if (!cancelled) setDbStatus('ready');
      } catch (err) {
        console.error('[FloodSight] IndexedDB bootstrap failed:', err);
        if (!cancelled) {
          setDbError(err?.message ?? 'Unknown IndexedDB error');
          setDbStatus('error');
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleViewChange = useCallback((view) => {
    setActiveView(view === VIEWS.COMMAND ? VIEWS.COMMAND : VIEWS.FIELD);
  }, []);

  const currentView = activeView === VIEWS.COMMAND ? VIEWS.COMMAND : VIEWS.FIELD;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Sticky Navbar                                                      */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <h1 className="font-mono text-sm sm:text-base font-semibold tracking-wide text-slate-100">
              FloodSight <span className="text-cyan-400">Pakistan</span>
            </h1>
            <DbStatusBadge status={dbStatus} error={dbError} />
          </div>

          <nav className="flex gap-2" role="tablist" aria-label="View selector">
            <ToggleButton
              label="Tactical Field PWA (Rescue 1122)"
              isActive={activeView === VIEWS.FIELD}
              onClick={() => handleViewChange(VIEWS.FIELD)}
            />
            <ToggleButton
              label="NDMA Macro Command Dashboard"
              isActive={activeView === VIEWS.COMMAND}
              onClick={() => handleViewChange(VIEWS.COMMAND)}
            />
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Active View                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 min-h-0">
          <ViewErrorBoundary key={currentView}>
          {currentView === VIEWS.FIELD ? (
            <RescueFieldPWA dbReady={dbStatus === 'ready'} />
          ) : (
            <CommandDashboard dbReady={dbStatus === 'ready'} />
          )}
        </ViewErrorBoundary>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToggleButton({ label, isActive, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={[
        'px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors',
        'min-h-[44px] sm:min-h-0 whitespace-nowrap',
        isActive
          ? 'bg-cyan-600 text-white shadow-inner'
          : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function DbStatusBadge({ status, error }) {
  const config = {
    initializing: { text: 'DB: INIT', className: 'text-amber-400 border-amber-400/40 bg-amber-400/10' },
    ready: { text: 'DB: SYNCED', className: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10' },
    error: { text: 'DB: OFFLINE', className: 'text-red-400 border-red-400/40 bg-red-400/10' },
  };

  const { text, className } = config[status] ?? config.error;

  return (
    <span
      title={error ?? undefined}
      className={`ml-2 font-mono text-[10px] px-1.5 py-0.5 rounded border ${className}`}
    >
      {text}
    </span>
  );
}