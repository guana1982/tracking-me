import { useState } from 'react';
import { Check, Crosshair, Gauge, Loader2, Pill, Smile, Trash2, X, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { describeIntensity } from '@budget/shared';
import { localTimeOf, quickLogValenceLabel, valenceColor } from '../../lib/foodUtils';
import { useTriggers, useUpdateRatingEntry } from '../../hooks/useRatingQueries';
import { useUpdateQuickLog } from '../../hooks/useFoodQueries';
import type { QuickLogDTO, RatingEntryDTO } from '@budget/shared';

interface RatingNoteProps {
  entry: RatingEntryDTO;
  /** The mood entry opened from this row, shown here instead of on its own */
  linkedLog?: QuickLogDTO;
  onDelete: (entry: RatingEntryDTO) => void;
}

/**
 * The recap of a vote, at the minute it was given, and the only place where
 * that vote can be corrected: mark, note and the states picked in the popup
 * are all edited in place here - no modal, and the time never moves.
 */
export function RatingNote({ entry, linkedLog, onDelete }: RatingNoteProps) {
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [linkedDraft, setLinkedDraft] = useState<string | null>(null);
  const [triggerDraft, setTriggerDraft] = useState<string | null>(null);

  const updateEntry = useUpdateRatingEntry();
  const updateLog = useUpdateQuickLog();
  const isSideEffect = entry.kind === 'SIDE_EFFECT';
  // Both are moments rather than periodic marks, and read the same way
  const isEvent = entry.kind === 'EVENT' || isSideEffect;
  // Only fetched while the trigger is actually being edited
  const triggers = useTriggers(triggerDraft !== null);

  const linkedColors = valenceColor(linkedLog?.derivedValence ?? null);
  const boxes = Array.from({ length: entry.maxValue }, (_, index) => index + 1);
  const isSaving = updateEntry.isPending || updateLog.isPending;

  const commitTrigger = () => {
    if (triggerDraft === null) return;
    const trimmed = triggerDraft.trim();
    if (trimmed !== (entry.trigger ?? '')) {
      updateEntry.mutate({ id: entry.id, data: { trigger: trimmed || null } });
    }
    setTriggerDraft(null);
  };

  const commitNote = () => {
    if (noteDraft === null) return;
    const trimmed = noteDraft.trim();
    if (trimmed !== (entry.note ?? '')) {
      updateEntry.mutate({ id: entry.id, data: { note: trimmed || null } });
    }
    setNoteDraft(null);
  };

  const commitLinked = () => {
    if (linkedDraft === null || !linkedLog) return;
    const trimmed = linkedDraft.trim();
    if (trimmed && trimmed !== linkedLog.text) {
      updateLog.mutate({ id: linkedLog.id, data: { text: trimmed } });
    }
    setLinkedDraft(null);
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        isSideEffect
          ? 'border-rose-200 bg-rose-50/50'
          : isEvent
            ? 'border-amber-200 bg-amber-50/50'
            : 'border-indigo-100 bg-indigo-50/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {isSideEffect ? (
            <Pill className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          ) : isEvent ? (
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <Gauge className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          )}
          <span className="text-xs text-slate-400">{localTimeOf(entry.loggedAt)}</span>
          <span className="text-sm font-medium text-slate-800 truncate">{entry.ratingName}</span>
          {/* The mark is the handle: one tap opens the boxes right here */}
          <button
            type="button"
            onClick={() => setIsEditingValue((open) => !open)}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-semibold transition-colors',
              entry.value === null
                ? cn(
                    'border border-dashed',
                    isEvent
                      ? 'border-amber-400 text-amber-700'
                      : 'border-indigo-300 text-indigo-500'
                  )
                : isEvent
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600'
            )}
            title={isEvent ? 'Intensità' : 'Modifica il voto'}
          >
            {entry.value === null
              ? isEvent
                ? 'intensità'
                : 'voto'
              : isSideEffect
                ? describeIntensity(entry.value, entry.maxValue)
                : `${entry.value}/${entry.maxValue}`}
          </button>
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
        </div>
        <button
          onClick={() => onDelete(entry)}
          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0"
          title="Elimina"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {isEditingValue && (
        <div
          className={cn(
            'mt-2',
            // Named steps read as words, so they need room to breathe
            isSideEffect ? 'flex flex-wrap gap-1.5' : 'grid gap-1'
          )}
          style={
            isSideEffect
              ? undefined
              : { gridTemplateColumns: `repeat(${entry.maxValue}, minmax(0, 1fr))` }
          }
        >
          {boxes.map((box) => (
            <button
              key={box}
              type="button"
              onClick={() => {
                if (box !== entry.value) {
                  updateEntry.mutate({ id: entry.id, data: { value: box } });
                }
                setIsEditingValue(false);
              }}
              className={cn(
                'border text-[11px] font-medium transition-colors',
                isSideEffect
                  ? 'min-h-9 px-3 py-1 rounded-full'
                  : 'aspect-square rounded-md',
                entry.value !== null && box <= entry.value
                  ? isEvent
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-400 hover:text-indigo-500'
              )}
              aria-label={`Correggi in ${box} su ${entry.maxValue}`}
            >
              {isSideEffect ? describeIntensity(box, entry.maxValue) : box}
            </button>
          ))}
        </div>
      )}

      {/* The trigger, on episodes only: a side effect is caused by the drug,
          not by a moment, so asking what set it off would be misleading */}
      {isEvent &&
        !isSideEffect &&
        (triggerDraft !== null ? (
          <div className="mt-2">
            <div className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <input
                autoFocus
                type="text"
                list={`triggers-${entry.id}`}
                value={triggerDraft}
                onChange={(event) => setTriggerDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitTrigger();
                  if (event.key === 'Escape') setTriggerDraft(null);
                }}
                placeholder="Cosa l'ha innescato?"
                className="flex-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
                maxLength={80}
              />
              {/* Autocomplete from the triggers already used: the vocabulary
                  has to converge, otherwise the ranking never adds up */}
              <datalist id={`triggers-${entry.id}`}>
                {(triggers.data ?? []).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={commitTrigger}
                className="p-1.5 text-emerald-600 hover:bg-white/70 rounded-lg"
                title="Salva innesco"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTriggerDraft(null)}
                className="p-1.5 text-slate-400 hover:bg-white/70 rounded-lg"
                title="Annulla"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {(triggers.data ?? []).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(triggers.data ?? []).slice(0, 6).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTriggerDraft(option)}
                    className="px-2 py-0.5 rounded-full border border-amber-200 bg-white text-[11px] text-amber-800 hover:border-amber-400"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTriggerDraft(entry.trigger ?? '')}
            className="mt-2 flex items-center gap-1.5 text-xs rounded px-1 -mx-1 hover:bg-white/70 transition-colors"
            title="Modifica l'innesco"
          >
            <Crosshair className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className={entry.trigger ? 'text-amber-900 font-medium' : 'text-slate-400 italic'}>
              {entry.trigger ?? 'Aggiungi un innesco'}
            </span>
          </button>
        ))}

      {/* Note: the text itself is the edit affordance */}
      {noteDraft !== null ? (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            autoFocus
            type="text"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitNote();
              if (event.key === 'Escape') setNoteDraft(null);
            }}
            placeholder="Nota…"
            className="flex-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
            maxLength={500}
          />
          <button
            type="button"
            onClick={commitNote}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
            title="Salva nota"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setNoteDraft(null)}
            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
            title="Annulla"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNoteDraft(entry.note ?? '')}
          className={cn(
            'mt-1.5 block w-full text-left text-sm rounded px-1 -mx-1 hover:bg-white/70 transition-colors',
            entry.note ? 'text-slate-700' : 'text-slate-400 italic'
          )}
          title="Modifica la nota"
        >
          {entry.note ?? 'Aggiungi una nota'}
        </button>
      )}

      {linkedLog && (
        <div
          className={cn(
            'mt-2 rounded-lg border px-2 py-1.5',
            linkedColors.border,
            linkedColors.bg
          )}
        >
          {linkedDraft !== null ? (
            <div className="flex items-center gap-1.5">
              <Smile className={cn('w-3.5 h-3.5 shrink-0', linkedColors.text)} />
              <input
                autoFocus
                type="text"
                value={linkedDraft}
                onChange={(event) => setLinkedDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitLinked();
                  if (event.key === 'Escape') setLinkedDraft(null);
                }}
                className="flex-1 px-2 py-0.5 rounded-md border border-slate-300 bg-white text-xs text-slate-700 focus:border-slate-500 focus:outline-none"
                maxLength={500}
              />
              <button
                type="button"
                onClick={commitLinked}
                className="p-1 text-emerald-600 hover:bg-white/70 rounded"
                title="Salva"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLinkedDraft(null)}
                className="p-1 text-slate-400 hover:bg-white/70 rounded"
                title="Annulla"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            // Hidden from the timeline as a note of its own, so this is the
            // only place it can still be corrected
            <button
              type="button"
              onClick={() => setLinkedDraft(linkedLog.text)}
              className="flex items-start gap-2 w-full text-left"
              title="Modifica gli stati registrati"
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
            </button>
          )}
        </div>
      )}

      {updateEntry.error && (
        <p className="mt-1.5 text-xs text-red-600">
          {updateEntry.error instanceof Error ? updateEntry.error.message : 'Modifica non riuscita'}
        </p>
      )}
    </div>
  );
}
