import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useCreateQuickLog } from '../../hooks/useFoodQueries';
import { loggedAtFor, quickLogCategoryLabel, quickLogValenceLabel } from '../../lib/foodUtils';
import type { QuickLogDTO } from '@budget/shared';

interface QuickLogBarProps {
  onSaved: (message: string) => void;
  /** The diary day on screen: a note written here belongs to it, not to now */
  date: string;
}

/**
 * Says how the note was read, so a week of use teaches which wordings the
 * dictionaries recognise - and makes it obvious when one was not read at all,
 * which is now the case where the note stays out of the day score.
 */
function describeClassification(log: QuickLogDTO): string {
  if (!log.derivedValence) {
    return 'Nota salvata · senza valenza, fuori dal grafico';
  }
  const category = log.derivedCategory ? quickLogCategoryLabel(log.derivedCategory) : 'Nota';
  return `${category} · ${quickLogValenceLabel(log.derivedValence).toLowerCase()}`;
}

/**
 * Always-visible free-text bar: one tap, type or dictate, send. No fields,
 * no dropdowns, no confirmation - classification happens silently and is
 * reported back afterwards, never asked for.
 */
export function QuickLogBar({ onSaved, date }: QuickLogBarProps) {
  const [text, setText] = useState('');
  const createLog = useCreateQuickLog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || createLog.isPending) return;
    const log = await createLog.mutateAsync({ text: trimmed, loggedAt: loggedAtFor(date) });
    setText('');
    onSaved(describeClassification(log));
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Come ti senti? Allenamento, sonno, sensazioni..."
        className="input flex-1"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={!text.trim() || createLog.isPending}
        className="btn btn-primary p-2.5 shrink-0"
        title="Salva nota"
      >
        {createLog.isPending ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </form>
  );
}
