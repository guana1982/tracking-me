import { ListPlus } from 'lucide-react';
import { QuickEntryBar } from '../QuickEntryBar';
import { useCreateActivity } from '../../hooks/useActivityQueries';

interface ActivityQuickBarProps {
  /** The day the task lands on, exactly the day the modal would preselect */
  selectedDate: string;
  /**
   * Called after a task is created, so the page can make sure the list it is
   * showing is a list the new card can appear in
   */
  onCreated: () => void;
  multiline?: boolean;
  autoFocus?: boolean;
}

/**
 * A task in one line. Same field as the diary's comment bar, because the
 * moment is the same one: something arrives while you are looking at the day,
 * and opening a form to write six words is how it gets lost instead.
 *
 * What it writes is exactly what the modal writes with its defaults untouched
 * - a task, on the selected day, medium priority, no type. Anything beyond
 * that is what the modal is still there for.
 */
export function ActivityQuickBar({
  selectedDate,
  onCreated,
  multiline = false,
  autoFocus = false,
}: ActivityQuickBarProps) {
  const createActivity = useCreateActivity();

  const save = async (title: string) => {
    await createActivity.mutateAsync({
      title,
      scheduledFor: selectedDate,
      kind: 'TASK',
      scope: 'DAY',
      priority: 'MEDIUM',
      typeKey: null,
    });
    onCreated();
  };

  return (
    <QuickEntryBar
      id={multiline ? 'activity-quick-sheet' : 'activity-quick-input'}
      icon={ListPlus}
      title="Aggiungi un’attività al volo"
      hint="finisce nel giorno selezionato con priorità media; per scadenze, tipologia e note usa «Nuova attività»"
      placeholder="Cosa c’è da fare?"
      submitLabel="Aggiungi attività"
      isPending={createActivity.isPending}
      onSubmit={save}
      multiline={multiline}
      autoFocus={autoFocus}
    />
  );
}
