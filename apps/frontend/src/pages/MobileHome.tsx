import { Link, Navigate } from 'react-router-dom';
import { Wallet, UtensilsCrossed, ChevronRight } from 'lucide-react';

function isMobileViewport(): boolean {
  // Same breakpoint as the app's mobile layout (Tailwind sm: = 640px)
  return window.matchMedia('(max-width: 639px)').matches;
}

/**
 * Index route gate: on mobile the app opens on a simple mode chooser,
 * on desktop everything stays as-is (straight to the budget dashboard).
 */
export function HomeGate() {
  if (!isMobileViewport()) {
    return <Navigate to="/dashboard" replace />;
  }
  return <MobileHome />;
}

function MobileHome() {
  return (
    <div className="min-h-[70vh] flex flex-col justify-center gap-4 max-w-sm mx-auto">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold text-slate-900">Ciao!</h2>
        <p className="mt-1 text-sm text-slate-500">Cosa vuoi fare?</p>
      </div>

      <Link
        to="/dashboard"
        className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 active:scale-[0.98] transition-transform"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <Wallet className="w-7 h-7 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-slate-900">Finanza</p>
          <p className="text-xs text-slate-500">Spese, budget e cash flow</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </Link>

      <Link
        to="/food"
        className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 active:scale-[0.98] transition-transform"
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
          <UtensilsCrossed className="w-7 h-7 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-slate-900">Diario Alimentare</p>
          <p className="text-xs text-slate-500">Pasti, note rapide e andamento</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </Link>
    </div>
  );
}
