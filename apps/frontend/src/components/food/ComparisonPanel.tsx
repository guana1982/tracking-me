import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { todayLocal, addDaysLocal } from '../../lib/foodUtils';
import { useFoodComparison } from '../../hooks/useFoodQueries';
import type { FoodComparisonConditionDTO, FoodComparisonGroupDTO } from '@budget/shared';

const CONDITIONS: { value: FoodComparisonConditionDTO; label: string }[] = [
  { value: 'WORKOUT', label: 'Allenamento sì/no' },
  { value: 'DINNER_AFTER_21', label: 'Cena prima/dopo le 21' },
  { value: 'FOOD', label: 'Alimento nel giorno' },
  { value: 'SUPPLEMENT_PERIOD', label: 'Periodo integratore' },
];

function GroupBar({ group }: { group: FoodComparisonGroupDTO }) {
  const state = group.avgState;
  // Map [-1, +1] to [0%, 100%] for the bar
  const widthPct = state === null ? 0 : ((state + 1) / 2) * 100;
  const barColor =
    state === null
      ? 'bg-slate-200'
      : state > 0.15
        ? 'bg-emerald-400'
        : state < -0.15
          ? 'bg-red-400'
          : 'bg-amber-300';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{group.label}</p>
        {/* Numerosità sempre visibile: onestà statistica */}
        <p className="text-xs text-slate-500 shrink-0">{group.days} giorni</p>
      </div>
      <div className="mt-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${widthPct}%` }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500 tabular-nums">
        <span>
          Fisico medio: <span className="font-semibold text-slate-700">{state ?? 'n.d.'}</span>
        </span>
        <span>
          Umore medio:{' '}
          <span className="font-semibold text-fuchsia-700">{group.avgMoodState ?? 'n.d.'}</span>
        </span>
        <span>Sonno: {group.avgSleepValence ?? 'n.d.'}</span>
        <span>Sensazioni: {group.avgFeelingValence ?? 'n.d.'}</span>
      </div>
    </div>
  );
}

interface ComparisonPanelProps {
  supplementNames: string[];
}

/** Confronto condizionato: stato medio nei giorni con/senza una condizione */
export function ComparisonPanel({ supplementNames }: ComparisonPanelProps) {
  const [condition, setCondition] = useState<FoodComparisonConditionDTO>('WORKOUT');
  const [foodValue, setFoodValue] = useState('');
  const [supplementValue, setSupplementValue] = useState('');

  const to = todayLocal();
  const from = addDaysLocal(to, -89);
  const value =
    condition === 'FOOD' ? foodValue : condition === 'SUPPLEMENT_PERIOD' ? supplementValue : undefined;
  const comparison = useFoodComparison(condition, value || undefined, from, to);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">Confronto condizionato</h3>
      <p className="text-xs text-slate-400 mb-3">
        Ultimi 90 giorni. Mostra associazioni, non cause.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as FoodComparisonConditionDTO)}
          className="input w-auto text-sm"
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {condition === 'FOOD' && (
          <input
            type="text"
            value={foodValue}
            onChange={(e) => setFoodValue(e.target.value)}
            placeholder="Es. pasta al pomodoro"
            className="input w-52 text-sm"
          />
        )}
        {condition === 'SUPPLEMENT_PERIOD' && (
          <select
            value={supplementValue}
            onChange={(e) => setSupplementValue(e.target.value)}
            className="input w-44 text-sm"
          >
            <option value="">Scegli integratore</option>
            {supplementNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      {comparison.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : comparison.data ? (
        <>
          {comparison.data.lowReliability && (
            <p className="mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Gruppi con meno di {comparison.data.minReliableDays} giorni: confronto poco affidabile.
            </p>
          )}
          <div className="space-y-4">
            <GroupBar group={comparison.data.withGroup} />
            <GroupBar group={comparison.data.withoutGroup} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500 py-4 text-center">
          {condition === 'FOOD'
            ? "Scrivi il nome di un alimento per confrontare i giorni."
            : condition === 'SUPPLEMENT_PERIOD'
              ? supplementNames.length === 0
                ? 'Nessun periodo integratore rilevato nei quick log.'
                : 'Scegli un integratore per confrontare i periodi.'
              : 'Nessun dato disponibile.'}
        </p>
      )}
    </div>
  );
}
