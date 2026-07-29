import { useEffect, useRef, useState } from 'react';
import { Check, Smile } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RatingDefinitionDTO } from '@budget/shared';

interface RatingRowProps {
  definition: RatingDefinitionDTO;
  /** Tapping a box submits the vote together with whatever sits next to it */
  onSubmit: (value: number, note: string | null) => void;
  /** Present only when the characteristic has a picker attached to it */
  onOpenLinkedForm?: () => void;
  /** A mood entry was picked and is waiting to travel with the next vote */
  hasPendingLink?: boolean;
}

/** How long the tapped box stays lit before the row goes back to empty */
const CONFIRMATION_MS = 900;

/**
 * One characteristic: its name, a row of boxes, a thin note field and - when
 * the characteristic has one - the link to its picker.
 *
 * The row is an input and keeps no memory of what it sent: after a vote it
 * clears, so voting again later in the day records a second moment instead of
 * correcting the first. What was voted is read in the timeline below.
 */
export function RatingRow({
  definition,
  onSubmit,
  onOpenLinkedForm,
  hasPendingLink = false,
}: RatingRowProps) {
  const [noteDraft, setNoteDraft] = useState('');
  const [sentValue, setSentValue] = useState<number | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const boxes = Array.from({ length: definition.maxValue }, (_, index) => index + 1);

  const handleVote = (box: number) => {
    onSubmit(box, noteDraft.trim() || null);
    setNoteDraft('');
    // Lit just long enough to confirm the tap, then the row is empty again
    setSentValue(box);
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setSentValue(null), CONFIRMATION_MS);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 truncate">{definition.name}</span>
          {sentValue !== null && (
            <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-medium text-emerald-600">
              <Check className="w-3 h-3" />
              {sentValue}/{definition.maxValue} registrato
            </span>
          )}
        </div>
        {onOpenLinkedForm && (
          <button
            type="button"
            onClick={onOpenLinkedForm}
            className={cn(
              'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
              hasPendingLink
                ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700'
                : 'border-slate-200 text-slate-500 hover:border-fuchsia-200 hover:text-fuchsia-600'
            )}
          >
            <Smile className="w-3 h-3" />
            Stati d'umore
          </button>
        )}
      </div>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${definition.maxValue}, minmax(0, 1fr))` }}
      >
        {boxes.map((box) => {
          const isConfirming = sentValue !== null && box <= sentValue;
          return (
            <button
              key={box}
              type="button"
              onClick={() => handleVote(box)}
              className={cn(
                'aspect-square rounded-md border text-[11px] font-medium transition-colors',
                isConfirming
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'
              )}
              aria-label={`${definition.name}: ${box} su ${definition.maxValue}`}
            >
              {box}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        placeholder="Nota…"
        className="mt-1 w-full px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none"
        autoComplete="off"
      />
      {(noteDraft.trim().length > 0 || hasPendingLink) && (
        <p className="mt-1 text-[11px] text-slate-400">
          Tocca un voto per registrare{hasPendingLink ? ' anche gli stati scelti' : ' la nota'}.
        </p>
      )}
    </div>
  );
}
