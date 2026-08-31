import { PenLine } from 'lucide-react';
import { QuickEntryBar } from '../QuickEntryBar';
import { useCreateQuickLog } from '../../hooks/useFoodQueries';
import { loggedAtFor } from '../../lib/foodUtils';

const TITLE = 'Commento libero sulla giornata';
const HINT = 'pensieri e considerazioni: finiscono nell’export per l’analisi AI, non nei grafici';
const PLACEHOLDER = 'Com’è andata? Pensieri, considerazioni, cosa ha inciso...';

interface QuickLogBarProps {
  onSaved: (message: string) => void;
  /** The diary day on screen: a note written here belongs to it, not to now */
  date: string;
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
  const createLog = useCreateQuickLog();

  const save = async (text: string) => {
    // Explicit nulls rather than an omission: they pin the note as
    // unclassified, so neither the dictionaries on save nor a later
    // "Ricalcola classificazioni" can hand it a valence and a way into the
    // day state
    await createLog.mutateAsync({
      text,
      loggedAt: loggedAtFor(date),
      derivedCategory: null,
      derivedValence: null,
    });
    onSaved('Commento salvato nella giornata');
  };

  return (
    <QuickEntryBar
      id={multiline ? 'day-note-sheet' : 'day-note-input'}
      icon={PenLine}
      title={TITLE}
      hint={HINT}
      placeholder={PLACEHOLDER}
      submitLabel="Salva commento"
      isPending={createLog.isPending}
      onSubmit={save}
      multiline={multiline}
      autoFocus={autoFocus}
    />
  );
}
