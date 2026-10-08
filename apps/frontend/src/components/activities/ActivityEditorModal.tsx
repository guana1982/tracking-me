import { useEffect } from 'react';
import type { ActivityDTO, ActivityTypeDTO } from '@budget/shared';
import { ActivityEditorPanel, type ActivityEditorData } from './ActivityEditorPanel';

interface ActivityEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Null means a new activity for the selected date */
  activity: ActivityDTO | null;
  selectedDate: string;
  types: ActivityTypeDTO[];
  isSaving: boolean;
  onSave: (data: ActivityEditorData) => Promise<void>;
}

/**
 * The form used to live in a column that was empty most of the time. Behind a
 * button it costs one click and gives the list the whole width; the panel
 * inside is the same one, so nothing about writing a task changed.
 */
export function ActivityEditorModal({
  isOpen,
  onClose,
  activity,
  selectedDate,
  types,
  isSaving,
  onSave,
}: ActivityEditorModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={activity ? 'Modifica attività' : 'Nuova attività'}
      >
        <ActivityEditorPanel
          activity={activity}
          selectedDate={selectedDate}
          types={types}
          isSaving={isSaving}
          onSave={onSave}
          onCancelEdit={onClose}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
