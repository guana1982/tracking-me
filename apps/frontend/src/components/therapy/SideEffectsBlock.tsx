import { useMemo, useState } from 'react';
import { Loader2, Pill, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useCheckInDay,
  useSetCheckInValue,
  useTreatments,
} from '../../hooks/useTherapyQueries';
import { SideEffectManager } from './SideEffectManager';
import type { CheckInScaleDTO } from '@budget/shared';

interface SideEffectsBlockProps {
  date: string;
}

/** Side effects with no drug attached belong to the therapy as a whole */
const UNATTRIBUTED = '__therapy__';

/**
 * The side effects of the therapy, in the diary and named after the drug that
 * brought them up (§3.5). They used to live folded inside the check-in, where
 * nobody would find them - and a side effect nobody is asked about is a side
 * effect that gets noticed months late.
 *
 * Each answer is written on its own the moment it is tapped; the rest of the
 * day's check-in is untouched, the merge happens server-side.
 */
export function SideEffectsBlock({ date }: SideEffectsBlockProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const treatments = useTreatments();
  const day = useCheckInDay(date);
  const setValue = useSetCheckInValue(date);

  const activeTreatments = useMemo(
    () => (treatments.data ?? []).filter((treatment) => treatment.isActive),
    [treatments.data]
  );

  const scales = useMemo(
    () => (day.data?.scales ?? []).filter((scale) => scale.isSideEffect),
    [day.data]
  );

  // Grouped by the drug that suggested them; one scale suggested by two drugs
  // shows under both, because that is exactly the ambiguity worth seeing
  const groups = useMemo(() => {
    const byTreatment = new Map<string, CheckInScaleDTO[]>();
    for (const scale of scales) {
      const keys = scale.sourceTreatmentKeys.filter((key) =>
        activeTreatments.some((treatment) => treatment.key === key)
      );
      for (const key of keys.length > 0 ? keys : [UNATTRIBUTED]) {
        byTreatment.set(key, [...(byTreatment.get(key) ?? []), scale]);
      }
    }
    return [...byTreatment.entries()].map(([key, items]) => ({
      key,
      title:
        key === UNATTRIBUTED
          ? 'Effetti collaterali della terapia'
          : `Effetti collaterali di ${
              activeTreatments.find((treatment) => treatment.key === key)?.name ?? 'terapia'
            }`,
      items,
    }));
  }, [scales, activeTreatments]);

  const answers = useMemo(() => {
    const map = new Map<string, number>();
    for (const value of day.data?.entry?.values ?? []) map.set(value.key, value.value);
    return map;
  }, [day.data]);

  if (day.isLoading || treatments.isLoading) return null;

  // Nothing to watch and nothing being taken: the block does not exist
  if (scales.length === 0 && activeTreatments.length === 0) return null;

  if (scales.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="mt-4 pt-3 border-t border-slate-100 min-h-11 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-700 transition-colors"
        >
          <Pill className="w-3.5 h-3.5" />
          Segui gli effetti collaterali della terapia
        </button>
        <SideEffectManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
      </>
    );
  }

  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      {groups.map((group) => (
        <div key={group.key} className="mb-3 last:mb-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide min-w-0 truncate">
              {group.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {setValue.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
              <button
                type="button"
                onClick={() => setIsManagerOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                title="Aggiungi o modifica gli effetti collaterali"
                aria-label="Aggiungi o modifica gli effetti collaterali"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {group.items.map((scale) => (
              <SideEffectRow
                key={`${group.key}-${scale.key}`}
                scale={scale}
                value={answers.get(scale.key) ?? null}
                onSet={(value) => setValue.mutate({ date, key: scale.key, value })}
              />
            ))}
          </div>
        </div>
      ))}

      {setValue.error && (
        <p className="mt-1 text-xs text-red-600">
          {setValue.error instanceof Error ? setValue.error.message : 'Registrazione non riuscita'}
        </p>
      )}

      <SideEffectManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}

function SideEffectRow({
  scale,
  value,
  onSet,
}: {
  scale: CheckInScaleDTO;
  /** null = not answered today; deliberately not the same as "assente" */
  value: number | null;
  onSet: (value: number | null) => void;
}) {
  const steps =
    scale.levelLabels.length > 0
      ? scale.levelLabels
      : Array.from({ length: scale.maxValue + 1 }, (_, index) => String(index));

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <p className="text-sm text-slate-700 min-w-0 truncate">{scale.name}</p>
      <div className="flex flex-wrap gap-1 shrink-0">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            // Tapping the current answer clears it: back to "not answered"
            onClick={() => onSet(value === index ? null : index)}
            aria-pressed={value === index}
            className={cn(
              'min-h-9 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors',
              value === index
                ? index === 0
                  ? 'border-slate-400 bg-slate-400 text-white'
                  : 'border-amber-500 bg-amber-500 text-white'
                : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
