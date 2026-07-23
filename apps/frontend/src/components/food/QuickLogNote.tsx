import { useState } from 'react';
import { Pencil, Trash2, StickyNote, Link2, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  localTimeOf,
  quickLogCategoryLabel,
  quickLogValenceLabel,
  valenceColor,
  categoryColor,
} from '../../lib/foodUtils';
import { useUpdateQuickLog, useDeleteQuickLog } from '../../hooks/useFoodQueries';
import { QUICK_LOG_CATEGORIES, QUICK_LOG_VALENCES } from '@budget/shared';
import type { QuickLogDTO } from '@budget/shared';

interface QuickLogNoteProps {
  log: QuickLogDTO;
}

/**
 * A quick log rendered as a "nota" interleaved in the diary. Category and
 * valence chips are tappable to correct the automatic classification.
 */
export function QuickLogNote({ log }: QuickLogNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(log.text);
  const [openPicker, setOpenPicker] = useState<'category' | 'valence' | null>(null);
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
    if (window.confirm('Eliminare questa nota?')) {
      deleteLog.mutate(log.id);
    }
  };

  return (
    <div className={cn('rounded-xl border border-dashed p-3', vColors.border, vColors.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StickyNote className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">{localTimeOf(log.loggedAt)}</span>

          {/* Category chip - tap to correct */}
          <div className="relative">
            <button
              onClick={() => setOpenPicker(openPicker === 'category' ? null : 'category')}
              className={cn('px-2 py-0.5 rounded-full text-xs font-medium', cColors.bg, cColors.text)}
              title="Correggi categoria"
            >
              {log.derivedCategory ? quickLogCategoryLabel(log.derivedCategory) : '—'}
            </button>
            {openPicker === 'category' && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                {QUICK_LOG_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      updateLog.mutate({ id: log.id, data: { derivedCategory: category } });
                      setOpenPicker(null);
                    }}
                    className={cn(
                      'block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 whitespace-nowrap',
                      category === log.derivedCategory && 'font-semibold'
                    )}
                  >
                    {quickLogCategoryLabel(category)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Valence chip - tap to correct */}
          <div className="relative">
            <button
              onClick={() => setOpenPicker(openPicker === 'valence' ? null : 'valence')}
              className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', vColors.text, vColors.border)}
              title="Correggi valenza"
            >
              {log.derivedValence ? quickLogValenceLabel(log.derivedValence) : '—'}
            </button>
            {openPicker === 'valence' && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                {QUICK_LOG_VALENCES.map((valence) => (
                  <button
                    key={valence}
                    onClick={() => {
                      updateLog.mutate({ id: log.id, data: { derivedValence: valence } });
                      setOpenPicker(null);
                    }}
                    className={cn(
                      'block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 whitespace-nowrap',
                      valence === log.derivedValence && 'font-semibold'
                    )}
                  >
                    {quickLogValenceLabel(valence)}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveText()}
            className="input text-sm"
            autoFocus
          />
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
      ) : (
        <p className="mt-1.5 text-sm text-slate-700">{log.text}</p>
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
