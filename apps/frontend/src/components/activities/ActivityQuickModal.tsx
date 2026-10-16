import { useEffect } from 'react';
import { ListPlus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ActivityQuickBar } from './ActivityQuickBar';

interface ActivityQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The day the task lands on, named in the header so it is never a guess */
  selectedDate: string;
  onCreated: () => void;
}

/**
 * The quick field on mobile, one tap from anywhere in the list.
 *
 * The field itself lives under the days, where it reads as the way into the
 * list below it. That works until the list is long and scrolled: something
 * arrives while you are reading the bottom of it, and the field is a screen
 * away. This is the way back to it - a sheet, not a bar pinned over the
 * content, so no card is permanently covered to serve an occasional tap.
 */
export function ActivityQuickModal({
  isOpen,
  onClose,
  selectedDate,
  onCreated,
}: ActivityQuickModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-slate-100">
              <ListPlus className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Nuova attività</h2>
              <p className="text-xs text-slate-400 truncate capitalize">
                {format(parseISO(selectedDate), 'EEEE d MMMM', { locale: it })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 shrink-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <ActivityQuickBar
            selectedDate={selectedDate}
            multiline
            autoFocus
            // Saved and gone: the sheet has one job, and staying open after it
            // is done would only ask "and now?"
            onCreated={() => {
              onCreated();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
