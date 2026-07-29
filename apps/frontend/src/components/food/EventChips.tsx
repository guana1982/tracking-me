import { useEffect, useRef, useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RatingDefinitionDTO } from '@budget/shared';

interface EventChipsProps {
  definitions: RatingDefinitionDTO[];
  onLog: (ratingKey: string) => void;
}

const CONFIRMATION_MS = 1200;

/**
 * Episodes: one tap on the type and it is recorded, nothing else asked.
 * Trigger and intensity are added afterwards from the recap in the timeline
 * (§4.3) - the point of this grid is that logging an episode while it is
 * happening must cost nothing.
 */
export function EventChips({ definitions, onLog }: EventChipsProps) {
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const handleTap = (key: string) => {
    onLog(key);
    setJustLogged(key);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustLogged(null), CONFIRMATION_MS);
  };

  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
        È appena successo
      </p>
      <div className="flex flex-wrap gap-1.5">
        {definitions.map((definition) => {
          const isConfirming = justLogged === definition.key;
          return (
            <button
              key={definition.key}
              type="button"
              onClick={() => handleTap(definition.key)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors',
                isConfirming
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400'
              )}
            >
              {isConfirming ? <Check className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {definition.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Registrato subito. Innesco e intensità si aggiungono dopo, dal riepilogo qui sotto.
      </p>
    </div>
  );
}
