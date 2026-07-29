import { Gauge, Smile, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { localTimeOf, quickLogValenceLabel, valenceColor } from '../../lib/foodUtils';
import type { QuickLogDTO, RatingEntryDTO } from '@budget/shared';

interface RatingNoteProps {
  entry: RatingEntryDTO;
  /** The mood entry opened from this row, shown here instead of on its own */
  linkedLog?: QuickLogDTO;
  onDelete: (entry: RatingEntryDTO) => void;
}

/**
 * The recap of a vote, placed in the timeline at the minute it was given.
 * Everything the row collected - mark, note and the states picked in the
 * linked popup - is read here as one entry.
 */
export function RatingNote({ entry, linkedLog, onDelete }: RatingNoteProps) {
  const linkedColors = valenceColor(linkedLog?.derivedValence ?? null);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Gauge className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-xs text-slate-400">{localTimeOf(entry.loggedAt)}</span>
          <span className="text-sm font-medium text-slate-800 truncate">{entry.ratingName}</span>
          {entry.value !== null && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500 text-white text-xs font-semibold">
              {entry.value}/{entry.maxValue}
            </span>
          )}
        </div>
        <button
          onClick={() => onDelete(entry)}
          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0"
          title="Elimina"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {entry.note && <p className="mt-1.5 text-sm text-slate-700">{entry.note}</p>}

      {linkedLog && (
        <div
          className={cn(
            'mt-2 flex items-start gap-2 rounded-lg border px-2 py-1.5',
            linkedColors.border,
            linkedColors.bg
          )}
        >
          <Smile className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', linkedColors.text)} />
          <p className="text-xs text-slate-700 min-w-0">
            {linkedLog.text}
            {linkedLog.derivedValence && (
              <span className={cn('ml-1.5 text-[11px] font-medium', linkedColors.text)}>
                · {quickLogValenceLabel(linkedLog.derivedValence)}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
