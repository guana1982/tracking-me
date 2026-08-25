import { useState } from 'react';
import { Send, Loader2, PenLine } from 'lucide-react';
import { useCreateQuickLog } from '../../hooks/useFoodQueries';
import { loggedAtFor } from '../../lib/foodUtils';

const TITLE = 'Commento libero sulla giornata';
// Lowercase at the source because the bar reads it as an aside after a dash;
// the sheet, where it is a line of its own, capitalises it in CSS
const HINT = 'pensieri e considerazioni: finiscono nell’export per l’analisi AI, non nei grafici';
const PLACEHOLDER = 'Com’è andata? Pensieri, considerazioni, cosa ha inciso...';

interface QuickLogBarProps {
  onSaved: (message: string) => void;
  /** The diary day on screen: a note written here belongs to it, not to now */
  date: string;
  /**
   * The sheet shape: a real text area and a full-width button. In the modal
   * the comment is the whole screen, so it gets the room to be more than a
   * line - which is what a comment on a day usually is
   */
  multiline?: boolean;
  autoFocus?: boolean;
}

/**
 * The day in the user's own words: free text, no fields, no dropdowns, and as
 * many entries a day as there are things to say.
 *
 * Deliberately unclassified. It used to be run through the keyword
 * dictionaries, which gave it a category and a valence and let it move the day
 * curves - a stray "stanco" was enough to redraw a day. What it is for is the
 * export: the notes are what lets a model read a day's numbers as something
 * other than numbers. So it is written straight through, and it stays out of
 * every score.
 */
export function QuickLogBar({ onSaved, date, multiline = false, autoFocus = false }: QuickLogBarProps) {
  const [text, setText] = useState('');
  const createLog = useCreateQuickLog();

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || createLog.isPending) return;
    // Explicit nulls rather than an omission: they pin the note as
    // unclassified, so neither the dictionaries on save nor a later
    // "Ricalcola classificazioni" can hand it a valence and a way into the
    // day state
    await createLog.mutateAsync({
      text: trimmed,
      loggedAt: loggedAtFor(date),
      derivedCategory: null,
      derivedValence: null,
    });
    setText('');
    onSaved('Commento salvato nella giornata');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
  };

  if (multiline) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="day-note-sheet" className="block">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <PenLine className="w-3.5 h-3.5 text-slate-400" />
            {TITLE}
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-400 first-letter:uppercase">
            {HINT}
          </span>
        </label>
        <textarea
          id="day-note-sheet"
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Enter is a new line here, as it should be in a text area; the
          // shortcut is there for whoever types on a keyboard
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
          }}
          rows={5}
          placeholder={PLACEHOLDER}
          className="input resize-y"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          autoFocus={autoFocus}
        />
        <button
          type="submit"
          disabled={!text.trim() || createLog.isPending}
          className="btn btn-primary w-full"
        >
          {createLog.isPending ? (
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-1.5" />
          )}
          Salva commento
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="day-note-input"
        className="mb-1 flex items-baseline gap-1.5 text-[11px] leading-tight"
      >
        <PenLine className="w-3 h-3 shrink-0 self-center text-slate-400" />
        <span className="font-medium text-slate-600">{TITLE}</span>
        <span className="hidden sm:inline text-slate-400">— {HINT}</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id="day-note-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
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
          title="Salva il commento"
        >
          {createLog.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </form>
  );
}
