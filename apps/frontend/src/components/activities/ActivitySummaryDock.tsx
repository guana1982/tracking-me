import { ArrowDownWideNarrow, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { ActivityOverviewDTO } from '@budget/shared';
import { cn } from '../../lib/utils';

interface ActivitySummaryDockProps {
  summary: ActivityOverviewDTO['summary'];
  /**
   * Owned by the page: it has to reserve the matching room at the end of the
   * list, and only it knows how tall the dock ends up being
   */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  isSorting: boolean;
  onSortByRule: () => Promise<void>;
}

/**
 * The one panel that stays: how the selected day is going is the reason to be
 * on this page, so it follows the scroll instead of sitting in a column the
 * list would rather have. Collapsible, because a fixed panel that cannot be
 * put away is in the way the moment it is not being read.
 */
export function ActivitySummaryDock({
  summary,
  isOpen,
  onOpenChange,
  isSorting,
  onSortByRule,
}: ActivitySummaryDockProps) {
  const attention = summary.overdue > 0 ? summary.overdue : summary.backlog;

  return (
    <div className="fixed z-30 bottom-20 left-3 sm:bottom-4 sm:left-[11.75rem] md:left-[12.75rem] lg:left-[13.75rem] 2xl:left-[14.75rem] w-56 max-w-[calc(100vw-1.5rem)]">
      {isOpen ? (
        <section className="card p-0 overflow-hidden shadow-xl" aria-label="Riepilogo della giornata">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold text-slate-900">Riepilogo</h2>
              <p className="text-[10px] text-slate-500">Data selezionata.</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
              aria-label="Riduci il riepilogo"
              aria-expanded="true"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between px-3 py-1.5"><span className="text-slate-500">Giornata</span><strong>{summary.todayCompleted}/{summary.todayTotal}</strong></div>
            <div className="flex items-center justify-between px-3 py-1.5"><span className="text-slate-500">Settimana</span><strong>{summary.weekCompleted}/{summary.weekTotal}</strong></div>
            <div className="flex items-center justify-between px-3 py-1.5"><span className="text-slate-500">Arretrate</span><strong className={summary.backlog > 0 ? 'text-amber-600' : 'text-emerald-600'}>{summary.backlog}</strong></div>
            <div className="flex items-center justify-between px-3 py-1.5"><span className="text-slate-500">Scadute</span><strong className={summary.overdue > 0 ? 'text-red-600' : 'text-emerald-600'}>{summary.overdue}</strong></div>
          </div>

          <p className="px-3 py-2 text-[10px] leading-snug text-slate-400 border-t border-slate-100">
            «Arretrate» sono aperte da giorni precedenti, «scadute» hanno superato la data entro cui
            dovevano chiudersi.
          </p>

          {/* Priority and due date are no longer a mode to go back to, so the
              rule is offered as something that rearranges the list once */}
          <div className="px-3 pb-3 text-[10px] leading-snug text-slate-500 border-t border-slate-100 pt-2">
            <p>L’ordine della lista è quello che dai tu trascinando le schede.</p>
            <button
              type="button"
              onClick={() => void onSortByRule()}
              disabled={isSorting}
              title="Dispone le schede per priorità e scadenza. Dopo puoi ritrascinarle come vuoi."
              className="btn btn-secondary mt-2 min-h-8 w-full px-2 text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSorting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownWideNarrow className="w-3 h-3" />}
              Riordina per priorità
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="card flex w-full items-center gap-2 px-3 py-2 shadow-xl text-xs font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Apri il riepilogo"
          aria-expanded="false"
        >
          <span className="text-slate-500">Riepilogo</span>
          <strong className="tabular-nums">{summary.todayCompleted}/{summary.todayTotal}</strong>
          {attention > 0 && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                summary.overdue > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
              )}
            >
              {attention} {summary.overdue > 0 ? 'scadute' : 'arretrate'}
            </span>
          )}
          <ChevronUp className="ml-auto w-3.5 h-3.5 shrink-0 text-slate-400" />
        </button>
      )}
    </div>
  );
}
