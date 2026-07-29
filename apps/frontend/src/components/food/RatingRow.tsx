import { useState } from 'react';
import { Smile } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { RatingDefinitionDTO, RatingEntryDTO } from '@budget/shared';

interface RatingRowProps {
  definition: RatingDefinitionDTO;
  entry?: RatingEntryDTO;
  onSetValue: (value: number | null) => void;
  onSetNote: (note: string) => void;
  /** Present only when the characteristic has a picker attached to it */
  onOpenLinkedForm?: () => void;
  hasLinkedEntry?: boolean;
}

/**
 * One characteristic: its name, a row of boxes to vote on, a thin note field
 * and - when the characteristic has one - the link to its picker.
 *
 * The parent remounts the row when the day changes, so the note field can
 * hold plain local state and never fight an incoming refetch.
 */
export function RatingRow({
  definition,
  entry,
  onSetValue,
  onSetNote,
  onOpenLinkedForm,
  hasLinkedEntry = false,
}: RatingRowProps) {
  const [noteDraft, setNoteDraft] = useState(entry?.note ?? '');
  const value = entry?.value ?? null;
  const boxes = Array.from({ length: definition.maxValue }, (_, index) => index + 1);

  const commitNote = () => {
    const trimmed = noteDraft.trim();
    if (trimmed === (entry?.note ?? '')) return;
    onSetNote(trimmed);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 truncate">{definition.name}</span>
          {value !== null && (
            <span className="text-xs text-slate-400 shrink-0">
              {value}/{definition.maxValue}
            </span>
          )}
        </div>
        {onOpenLinkedForm && (
          <button
            type="button"
            onClick={onOpenLinkedForm}
            className={cn(
              'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors',
              hasLinkedEntry
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
          const isFilled = value !== null && box <= value;
          return (
            <button
              key={box}
              type="button"
              // Tapping the current vote clears it: a wrong tap is undoable
              onClick={() => onSetValue(box === value ? null : box)}
              className={cn(
                'aspect-square rounded-md border text-[11px] font-medium transition-colors',
                isFilled
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500',
                box === value && 'ring-2 ring-indigo-200'
              )}
              aria-label={`${definition.name}: ${box} su ${definition.maxValue}`}
              aria-pressed={box === value}
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
        onBlur={commitNote}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder="Nota…"
        className="mt-1 w-full px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none"
        autoComplete="off"
      />
    </div>
  );
}
