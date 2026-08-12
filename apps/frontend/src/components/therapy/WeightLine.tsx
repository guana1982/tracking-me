import { useState } from 'react';
import { Check, Loader2, Scale, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSaveWeight, useWeight } from '../../hooks/useTherapyPlanQueries';
import { WEIGHT_INTERVAL_DAYS } from '@budget/shared';

interface WeightLineProps {
  /** The diary day on screen: a weight typed here belongs to it */
  date: string;
}

/**
 * Weight, weekly (§3.6). The line only asks when the week has come round
 * again; the rest of the time it just states the last value, quietly. Never
 * daily, and never with a comment on the direction it moved.
 */
export function WeightLine({ date }: WeightLineProps) {
  const summary = useWeight();
  const saveWeight = useSaveWeight();
  const [draft, setDraft] = useState<string | null>(null);

  if (summary.isLoading) return null;

  const last = summary.data?.last ?? null;
  const daysSince = summary.data?.daysSinceLast ?? null;
  const isDue = daysSince === null || daysSince >= WEIGHT_INTERVAL_DAYS;

  const commit = async () => {
    if (draft === null) return;
    const value = Number(draft.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setDraft(null);
      return;
    }
    await saveWeight.mutateAsync({ date, weightKg: Math.round(value * 10) / 10 });
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <div className="mb-3 flex items-center gap-2">
        <Scale className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          step="0.1"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void commit();
            if (event.key === 'Escape') setDraft(null);
          }}
          placeholder="kg"
          className="w-24 px-2 py-1 rounded-md border border-slate-300 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void commit()}
          disabled={saveWeight.isPending}
          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
          title="Salva peso"
        >
          {saveWeight.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
          title="Annulla"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(last ? String(last.weightKg) : '')}
      className={cn(
        'mb-3 w-full flex items-center justify-center gap-1.5 text-xs transition-colors',
        isDue ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-600'
      )}
    >
      <Scale className="w-3.5 h-3.5" />
      {last === null
        ? 'Registra il peso di partenza'
        : isDue
          ? `Peso: tocca a questa settimana (ultimo ${last.weightKg} kg)`
          : `Peso ${last.weightKg} kg · ${daysSince === 0 ? 'oggi' : `${daysSince} g fa`}`}
    </button>
  );
}
