import { useEffect } from 'react';
import { PenLine, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { QuickLogBar } from './QuickLogBar';

interface DayNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** The day the comment belongs to, named in the header so it is never a guess */
  date: string;
}

/**
 * The comment field on mobile, one tap from anywhere in the day.
 *
 * The field itself lives under the calendar, where it reads as the sentence
 * that explains the rest of the page. That works until the day is long and
 * scrolled: a thought arrives while reading back dinner, and the field is a
 * screen away. This is the way back to it - a sheet, not a bar pinned over the
 * content, so nothing is permanently covered to serve an occasional tap.
 */
export function DayNoteModal({ isOpen, onClose, onSaved, date }: DayNoteModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
              <PenLine className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Commento</h2>
              <p className="text-xs text-slate-400 truncate capitalize">
                {format(parseISO(date), 'EEEE d MMMM', { locale: it })}
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
          <QuickLogBar
            date={date}
            multiline
            autoFocus
            // Saved and gone: the sheet has one job, and staying open after it
            // is done would only ask "and now?"
            onSaved={(message) => {
              onSaved(message);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
