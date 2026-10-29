import { useState } from 'react';
import { Check, Loader2, Repeat, Settings2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useHabitDay, useSetHabit } from '../../hooks/useHabitQueries';
import { HabitManager } from './HabitManager';
import type { HabitDayItemDTO, HabitStatusDTO } from '@budget/shared';

interface DailyHabitsCardProps {
  date: string;
}

/**
 * The habits expected today, answered the same way as the intakes: one tap
 * per line, done or not. Habits scheduled on other weekdays are not here at
 * all - a rest day is not a skipped day.
 *
 * With an empty catalogue it collapses to a single quiet line, so whoever
 * does not track habits never meets the feature.
 */
export function DailyHabitsCard({ date }: DailyHabitsCardProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const day = useHabitDay(date);
  const setHabit = useSetHabit();

  if (day.isLoading) return null;

  const total = day.data?.total ?? 0;

  if (total === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="mb-3 min-h-11 w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-white/70 text-xs font-medium text-slate-500 hover:border-sky-200 hover:bg-sky-50/40 hover:text-sky-700 transition-colors"
        >
          <Repeat className="w-3.5 h-3.5" />
          Traccia anche le tue abitudini
        </button>
        <HabitManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
      </>
    );
  }

  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-sky-50 shrink-0">
            <Repeat className="w-4 h-4 text-sky-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Abitudini</p>
            {/* Factual, never a score: how many are answered, not how well */}
            <p className="text-[11px] text-slate-400">
              {day.data!.answered} di {total} registrate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {setHabit.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
          <button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Gestisci le abitudini"
            aria-label="Gestisci le abitudini"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {day.data!.groups.map((group) => (
          <div key={group.moment || 'default'}>
            {group.moment && (
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                {group.moment}
              </p>
            )}
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <HabitRow
                  key={item.habitKey}
                  item={item}
                  onSet={(status, value) =>
                    setHabit.mutate({ date, habitKey: item.habitKey, status, value })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {setHabit.error && (
        <p className="mt-2 text-xs text-red-600">
          {setHabit.error instanceof Error ? setHabit.error.message : 'Registrazione non riuscita'}
        </p>
      )}

      <HabitManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}

function HabitRow({
  item,
  onSet,
}: {
  item: HabitDayItemDTO;
  onSet: (status: HabitStatusDTO | null, value: number | null) => void;
}) {
  const [amount, setAmount] = useState(item.value === null ? '' : String(item.value));
  const needsAmount = item.measure !== 'DONE';

  // Tapping the active answer clears it: a wrong tap is fully undoable
  const toggle = (status: HabitStatusDTO) => {
    if (item.status === status) {
      onSet(null, null);
      setAmount('');
      return;
    }
    const parsed = Number(amount);
    onSet(status, needsAmount && Number.isFinite(parsed) && amount !== '' ? parsed : null);
  };

  const commitAmount = () => {
    if (!needsAmount || item.status !== 'DONE') return;
    const parsed = Number(amount);
    const next = amount !== '' && Number.isFinite(parsed) ? parsed : null;
    if (next !== item.value) onSet('DONE', next);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 truncate">{item.name}</p>
        {(item.target !== null || item.unit) && (
          <p className="text-[11px] text-slate-400 truncate">
            {item.target !== null ? `obiettivo ${item.target} ${item.unit}`.trim() : item.unit}
          </p>
        )}
      </div>

      {/* The amount only appears once the habit is marked done: asking "how
          much" before "did you" would be asking in the wrong order */}
      {needsAmount && item.status === 'DONE' && (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onBlur={commitAmount}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            placeholder="—"
            className="w-14 px-1.5 py-1 rounded-md border border-slate-200 text-xs text-right focus:border-sky-400 focus:outline-none"
          />
          {item.unit && <span className="text-[11px] text-slate-400">{item.unit}</span>}
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => toggle('DONE')}
          aria-pressed={item.status === 'DONE'}
          className={cn(
            'w-9 h-9 rounded-lg border flex items-center justify-center transition-colors',
            item.status === 'DONE'
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
          )}
          title="Fatto"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => toggle('SKIPPED')}
          aria-pressed={item.status === 'SKIPPED'}
          className={cn(
            'w-9 h-9 rounded-lg border flex items-center justify-center transition-colors',
            item.status === 'SKIPPED'
              ? 'border-slate-400 bg-slate-400 text-white'
              : 'border-slate-200 text-slate-400 hover:border-slate-400'
          )}
          title="Non fatto"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
