import { useState } from 'react';
import { Send, Loader2, PenLine } from 'lucide-react';
import { useCreateQuickLog } from '../../hooks/useFoodQueries';
import { loggedAtFor } from '../../lib/foodUtils';

interface QuickLogBarProps {
  onSaved: (message: string) => void;
  /** The diary day on screen: a note written here belongs to it, not to now */
  date: string;
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
export function QuickLogBar({ onSaved, date }: QuickLogBarProps) {
  const [text, setText] = useState('');
  const createLog = useCreateQuickLog();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="day-note-input"
        className="mb-1 flex items-baseline gap-1.5 text-[11px] leading-tight"
      >
        <PenLine className="w-3 h-3 shrink-0 self-center text-slate-400" />
        <span className="font-medium text-slate-600">Commento libero sulla giornata</span>
        <span className="hidden sm:inline text-slate-400">
          — pensieri e considerazioni: finiscono nell’export per l’analisi AI, non nei grafici
        </span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id="day-note-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Com’è andata? Pensieri, considerazioni, cosa ha inciso..."
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
