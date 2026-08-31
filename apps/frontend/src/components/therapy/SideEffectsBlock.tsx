import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pill, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRatings } from '../../hooks/useRatingQueries';
import { useTreatments } from '../../hooks/useTherapyQueries';
import { SideEffectManager } from './SideEffectManager';
import type { RatingDefinitionDTO } from '@budget/shared';

interface SideEffectsBlockProps {
  onLog: (ratingKey: string) => void;
}

/** Side effects with no drug attached belong to the therapy as a whole */
const UNATTRIBUTED = '__therapy__';
const CONFIRMATION_MS = 1200;

/**
 * The side effects of the therapy, as chips in the diary, named after the drug
 * that can cause them (§3.5). One tap records that it happened; intensity and
 * comment are added afterwards from the recap in the timeline, exactly like an
 * episode - which is what a side effect is.
 *
 * Only occurrences are recorded. There is no nightly "absent" to tick: a chip
 * not tapped is simply a chip not tapped.
 */
export function SideEffectsBlock({ onLog }: SideEffectsBlockProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const ratings = useRatings();
  const treatments = useTreatments();

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const activeTreatments = useMemo(
    () => (treatments.data ?? []).filter((treatment) => treatment.isActive),
    [treatments.data]
  );

  const definitions = useMemo(
    () =>
      (ratings.data ?? []).filter(
        (definition) => definition.kind === 'SIDE_EFFECT' && definition.isActive
      ),
    [ratings.data]
  );

  // Grouped by the drug that suggested them. One effect suggested by two drugs
  // shows under both: that ambiguity is exactly what is worth seeing
  const groups = useMemo(() => {
    const byTreatment = new Map<string, RatingDefinitionDTO[]>();
    for (const definition of definitions) {
      const keys = definition.sourceTreatmentKeys.filter((key) =>
        activeTreatments.some((treatment) => treatment.key === key)
      );
      for (const key of keys.length > 0 ? keys : [UNATTRIBUTED]) {
        byTreatment.set(key, [...(byTreatment.get(key) ?? []), definition]);
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
  }, [definitions, activeTreatments]);

  if (ratings.isLoading || treatments.isLoading) return null;

  // Nothing to watch and nothing being taken: the block does not exist
  if (definitions.length === 0 && activeTreatments.length === 0) return null;

  const handleTap = (key: string) => {
    onLog(key);
    setJustLogged(key);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustLogged(null), CONFIRMATION_MS);
  };

  if (definitions.length === 0) {
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
            <button
              type="button"
              onClick={() => setIsManagerOpen(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
              title="Aggiungi o modifica gli effetti collaterali"
              aria-label="Aggiungi o modifica gli effetti collaterali"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {group.items.map((definition) => {
              const isConfirming = justLogged === definition.key;
              return (
                <button
                  key={`${group.key}-${definition.key}`}
                  type="button"
                  onClick={() => handleTap(definition.key)}
                  className={cn(
                    'min-h-11 sm:min-h-9 flex items-center gap-1.5 px-3 py-2 rounded-xl sm:rounded-full border text-xs font-medium transition-colors',
                    isConfirming
                      ? 'border-rose-500 bg-rose-500 text-white'
                      : 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400'
                  )}
                >
                  {isConfirming ? <Check className="w-3 h-3" /> : <Pill className="w-3 h-3" />}
                  {definition.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className="mt-1 text-[11px] text-slate-400">
        Tocca quello che stai avendo. Intensità e commento si aggiungono dopo, dal riepilogo qui
        sotto.
      </p>

      <SideEffectManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}
