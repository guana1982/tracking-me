import { useState } from 'react';
import { CalendarClock, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useApplyTitrationStep, useSchedule } from '../../hooks/useTherapyPlanQueries';
import { MilestoneManager } from './MilestoneManager';
import type { ScheduleItemDTO } from '@budget/shared';

/** How far ahead is worth showing in the diary. Beyond this it is just noise */
const HORIZON_DAYS = 14;

function whenLabel(daysAway: number): string {
  if (daysAway === 0) return 'oggi';
  if (daysAway === 1) return 'domani';
  if (daysAway > 0) return `tra ${daysAway} giorni`;
  if (daysAway === -1) return 'ieri';
  return `${Math.abs(daysAway)} giorni fa`;
}

/**
 * What is coming up, in the diary (§4.1: the home shows the imminent
 * milestone and nothing more). Overdue items stay visible - a forgotten exam
 * is exactly what a schedule is for - but nothing here nags or scores.
 */
export function ScheduleLine() {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const schedule = useSchedule();
  const applyStep = useApplyTitrationStep();

  if (schedule.isLoading) return null;

  const items = (schedule.data ?? []).filter(
    (item) => !item.isDone && item.daysAway <= HORIZON_DAYS
  );

  if (items.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="mb-3 min-h-11 w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-white/70 text-xs font-medium text-slate-500 hover:border-teal-200 hover:bg-teal-50/40 hover:text-teal-700 transition-colors"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Aggiungi controllo o esame
        </button>
        <MilestoneManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
      </>
    );
  }

  return (
    <div className="card mb-3 border-teal-100 bg-teal-50/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="w-4 h-4 text-teal-600 shrink-0" />
          <p className="text-sm font-semibold text-slate-900">In arrivo</p>
        </div>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="text-xs text-teal-700 hover:underline shrink-0"
        >
          Gestisci
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <ScheduleRow
            key={item.id}
            item={item}
            isApplying={applyStep.isPending}
            onApply={() => applyStep.mutate(item.id)}
          />
        ))}
      </div>

      <MilestoneManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}

function ScheduleRow({
  item,
  isApplying,
  onApply,
}: {
  item: ScheduleItemDTO;
  isApplying: boolean;
  onApply: () => void;
}) {
  const isOverdue = item.daysAway < 0;
  const isDoseChange = item.kind === 'DOSE_CHANGE';

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-slate-800 min-w-0 truncate">{item.title}</p>
        <span
          className={cn(
            'text-[11px] shrink-0',
            isOverdue ? 'text-amber-700 font-medium' : 'text-slate-400'
          )}
        >
          {whenLabel(item.daysAway)}
        </span>
      </div>

      {/* The dose is written down only when the user says it changed for real */}
      {isDoseChange && item.daysAway <= 0 && (
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying}
          className="mt-1 flex items-center gap-1 text-[11px] text-teal-700 hover:underline disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Aggiorna la dose in terapia
        </button>
      )}

      {item.items.length > 0 && (
        <p className="mt-0.5 text-[11px] text-slate-500">{item.items.join(' · ')}</p>
      )}

      {/* Shown as soon as the item is in the horizon: an advisory read the day
          before the exam is an advisory that arrived too late */}
      {item.advisories.map((advisory) => (
        <p
          key={advisory}
          className="mt-1 text-[11px] text-amber-800 bg-amber-100/70 rounded px-1.5 py-0.5"
        >
          {advisory}
        </p>
      ))}
    </div>
  );
}
