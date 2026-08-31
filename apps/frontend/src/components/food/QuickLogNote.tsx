import { useState } from 'react';
import { Pencil, Trash2, StickyNote, Link2, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { localTimeOf, quickLogCategoryLabel, valenceColor, categoryColor } from '../../lib/foodUtils';
import { useUpdateQuickLog, useDeleteQuickLog } from '../../hooks/useFoodQueries';
import type { QuickLogDTO } from '@budget/shared';

interface QuickLogNoteProps {
  log: QuickLogDTO;
}

/**
 * A note as it reads back in the diary.
 *
 * The category and valence chips used to be pickers here, so a free comment
 * could be filed and given a direction. That is gone: what is written in the
 * bar is a comment on the day and nothing else, and there is nothing to
 * correct about it. A category survives only on entries that were given one
 * explicitly (the mood picker) or by the old dictionaries, and it is shown
 * read-only - those still count in the day curves, so hiding the label would
 * hide why.
 */
export function QuickLogNote({ log }: QuickLogNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(log.text);
  const updateLog = useUpdateQuickLog();
  const deleteLog = useDeleteQuickLog();

  const vColors = valenceColor(log.derivedValence);
  const cColors = categoryColor(log.derivedCategory);

  const handleSaveText = async () => {
    if (editText.trim() && editText.trim() !== log.text) {
      await updateLog.mutateAsync({ id: log.id, data: { text: editText.trim() } });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Eliminare questo commento?')) {
      deleteLog.mutate(log.id);
    }
  };

  return (
    <div className={cn('rounded-xl border border-dashed p-3', vColors.border, vColors.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StickyNote className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">{localTimeOf(log.loggedAt)}</span>
          {log.derivedCategory ? (
            <span
              className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cColors.bg, cColors.text)}
            >
              {quickLogCategoryLabel(log.derivedCategory)}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500">Commento del giorno</span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => {
              setEditText(log.text);
              setIsEditing(true);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
            title="Modifica testo"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2 flex items-start gap-2">
          {/* A textarea, not a line: a comment on a day is allowed to be long,
              and revising one through a one-line field is how they stay short */}
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="input text-sm resize-y"
            autoFocus
          />
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={handleSaveText}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
              title="Salva"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
              title="Annulla"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-slate-700 whitespace-pre-wrap break-words">{log.text}</p>
      )}

      {log.linkedMeal && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
          <Link2 className="w-3 h-3" />
          {log.linkedMeal.mealTypeName} del {log.linkedMeal.date.split('-').reverse().join('/')}
        </p>
      )}
    </div>
  );
}
