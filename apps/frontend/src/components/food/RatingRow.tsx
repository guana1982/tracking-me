import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, MessageSquare, Smile } from 'lucide-react';
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
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [sentValue, setSentValue] = useState<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    []
  );

  useEffect(() => {
    if (isNoteOpen) noteInputRef.current?.focus();
  }, [isNoteOpen]);

  const boxes = Array.from({ length: definition.maxValue }, (_, index) => index + 1);

  const handleVote = (box: number) => {
    onSubmit(box, noteDraft.trim() || null);
    setNoteDraft('');
    setIsNoteOpen(false);
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
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsNoteOpen((open) => !open)}
            className={cn(
              'min-h-11 sm:min-h-8 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
              noteDraft.trim()
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-500 hover:border-indigo-200 hover:text-indigo-600'
            )}
          >
            <MessageSquare className="w-3 h-3" />
            Nota
          </button>
          {onOpenLinkedForm && (
            <button
              type="button"
              onClick={onOpenLinkedForm}
              className={cn(
                'min-h-11 sm:min-h-8 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
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
      </div>

      <div
        className="rating-scale-grid grid gap-1"
        style={{ '--rating-columns': definition.maxValue } as CSSProperties}
      >
        {boxes.map((box) => {
          const isConfirming = sentValue !== null && box <= sentValue;
          return (
            <button
              key={box}
              type="button"
              onClick={() => handleVote(box)}
              className={cn(
                'h-11 rounded-md border text-xs font-medium transition-colors',
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

      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>1 · basso</span>
        <span>{definition.maxValue} · alto</span>
      </div>

      <input
        ref={noteInputRef}
        type="text"
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
        placeholder="Nota…"
        className={cn(
          'mt-1.5 min-h-11 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:border-indigo-300 focus:outline-none',
          isNoteOpen ? 'block' : 'hidden'
        )}
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
