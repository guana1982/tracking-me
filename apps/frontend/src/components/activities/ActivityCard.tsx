import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarClock, Check, CheckSquare2, Circle, Clock3, GripVertical, Loader2, Pencil, Trash2, X } from 'lucide-react';
import type { ActivityDTO, ActivityPriorityDTO } from '@budget/shared';
import { ACTIVITY_PRIORITY_LABELS, ACTIVITY_STATUS_LABELS } from '@budget/shared';
import { cn } from '../../lib/utils';

const PRIORITY_STYLES: Record<ActivityPriorityDTO, string> = {
  LOW: 'border-slate-200 text-slate-500',
  MEDIUM: 'border-blue-200 text-blue-700',
  HIGH: 'border-amber-200 text-amber-700',
  URGENT: 'border-red-200 text-red-700',
};

interface ActivityCardProps {
  activity: ActivityDTO;
  today: string;
  /** Left open on an earlier day, and shown here so it is not forgotten */
  isBacklog?: boolean;
  isBusy: boolean;
  /**
   * Applied to the whole card: a task moves by grabbing it anywhere, the way
   * an expense moves between categories on the dashboard. Aiming at a 6px
   * handle was the reason reordering felt like a chore.
   */
  dragProps: HTMLAttributes<HTMLElement>;
  /** False while a filter or a search is on, when neighbours are not real neighbours */
  canDrag: boolean;
  isDragging?: boolean;
  /** The grip is now an affordance and the keyboard route, not the only grab point */
  dragHandleProps: ButtonHTMLAttributes<HTMLButtonElement>;
  onToggle: (activity: ActivityDTO) => void;
  onEdit: (activity: ActivityDTO) => void;
  onDelete: (activity: ActivityDTO) => void;
  onSaveNote: (activity: ActivityDTO, notes: string | null) => Promise<void>;
  /**
   * Opens the month next to the date that was clicked. Moving a task by a day
   * is the commonest edit there is, and it should not cost a trip through the
   * whole form.
   */
  onPickDate: (
    activity: ActivityDTO,
    field: 'scheduledFor' | 'dueDate',
    event: ReactMouseEvent<HTMLButtonElement>
  ) => void;
}

const DATE_BUTTON_CLASS =
  'rounded px-1 -mx-1 underline decoration-dotted underline-offset-2 transition-colors hover:bg-slate-100 hover:text-slate-700';

export function ActivityCard({
  activity,
  today,
  isBacklog = false,
  isBusy,
  dragProps,
  canDrag,
  isDragging = false,
  dragHandleProps,
  onToggle,
  onEdit,
  onDelete,
  onSaveNote,
  onPickDate,
}: ActivityCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(activity.notes ?? '');
  const [displayNote, setDisplayNote] = useState(activity.notes ?? '');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const isDone = activity.status === 'DONE';
  const isOverdue = !isDone && activity.dueDate !== null && activity.dueDate < today;
  const dueLabel = activity.dueDate
    ? format(parseISO(activity.dueDate), 'EEE d MMM', { locale: it })
    : null;
  const contextLabel =
    activity.kind === 'DEADLINE'
      ? 'Scadenza'
      : activity.scope === 'WEEK'
        ? `Settimana ${format(parseISO(activity.scheduledFor), 'd MMM', { locale: it })}`
        : format(parseISO(activity.scheduledFor), 'EEE d MMM', { locale: it });
  const { className: dragHandleClassName, ...restDragHandleProps } = dragHandleProps;

  useEffect(() => {
    setNoteValue(activity.notes ?? '');
    setDisplayNote(activity.notes ?? '');
  }, [activity.notes]);

  const cancelNote = () => {
    setNoteValue(displayNote);
    setNoteError(null);
    setIsEditingNote(false);
  };

  const saveNote = async (event: FormEvent) => {
    event.preventDefault();
    const notes = noteValue.trim() || null;
    if (notes === (displayNote || null)) {
      setIsEditingNote(false);
      return;
    }
    setIsSavingNote(true);
    setNoteError(null);
    try {
      await onSaveNote(activity, notes);
      setDisplayNote(notes ?? '');
      setIsEditingNote(false);
    } catch (cause) {
      setNoteError(cause instanceof Error ? cause.message : 'Impossibile salvare la nota.');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <article
      {...dragProps}
      // Off while the note is open, or the browser would drag the card instead
      // of letting the text be selected
      draggable={canDrag && !isEditingNote}
      className={cn(
        'group flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm transition-colors hover:border-slate-300',
        canDrag && !isEditingNote && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <button
        type="button"
        data-drag-handle=""
        {...restDragHandleProps}
        className={cn(
          'w-8 h-10 sm:w-6 sm:h-7 -ml-1 rounded-lg flex items-center justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-500 hover:bg-slate-50',
          dragHandleClassName
        )}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        type="button"
        data-no-drag=""
        onClick={() => onToggle(activity)}
        disabled={isBusy}
        aria-label={isDone ? 'Segna come da fare' : 'Segna come completata'}
        className={cn(
          'w-10 h-10 sm:w-7 sm:h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors disabled:opacity-50',
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'bg-white border-slate-300 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
        )}
      >
        {isDone ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-h-7">
          {activity.kind === 'DEADLINE' ? (
            <CalendarClock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          ) : (
            <CheckSquare2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          )}
          {activity.dueTime && (
            <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-slate-400">
              <Clock3 className="w-3 h-3" />
              {activity.dueTime}
            </span>
          )}
          <h3 className={cn('min-w-0 text-xs sm:text-sm font-semibold text-slate-900 break-words', isDone && 'line-through text-slate-400')}>
            {activity.title}
          </h3>
          <span className={cn('shrink-0 rounded-full border bg-white px-1.5 py-0.5 text-[10px] font-semibold', PRIORITY_STYLES[activity.priority])}>
            {ACTIVITY_PRIORITY_LABELS[activity.priority]}
          </span>
          {activity.status === 'IN_PROGRESS' && (
            <span className="shrink-0 rounded-full border border-blue-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              {ACTIVITY_STATUS_LABELS.IN_PROGRESS}
            </span>
          )}
          {isBacklog && (
            <span
              title="Pianificata per un giorno precedente e ancora aperta"
              className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
            >
              Arretrato
            </span>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-slate-400">
          {activity.kind === 'TASK' ? (
            <button
              type="button"
              data-no-drag=""
              onClick={(event) => onPickDate(activity, 'scheduledFor', event)}
              title={activity.scope === 'WEEK' ? 'Sposta a un’altra settimana' : 'Sposta a un altro giorno'}
              className={DATE_BUTTON_CLASS}
            >
              {contextLabel}
            </button>
          ) : (
            <span>{contextLabel}</span>
          )}
          {activity.typeName && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activity.typeColor ?? '#94a3b8' }} />
              {activity.typeName}
            </span>
          )}
          {dueLabel ? (
            <button
              type="button"
              data-no-drag=""
              onClick={(event) => onPickDate(activity, 'dueDate', event)}
              title="Cambia la data entro cui chiudere"
              className={cn(
                'inline-flex items-center gap-1',
                DATE_BUTTON_CLASS,
                isOverdue && 'font-semibold text-red-600 hover:text-red-700'
              )}
            >
              <Clock3 className="w-3 h-3" />
              {isOverdue ? 'Scaduta ' : 'Entro '}{dueLabel}
            </button>
          ) : (
            activity.kind === 'TASK' && (
              <button
                type="button"
                data-no-drag=""
                onClick={(event) => onPickDate(activity, 'dueDate', event)}
                title="Imposta una data entro cui chiudere"
                className={cn(DATE_BUTTON_CLASS, 'hover:text-blue-600')}
              >
                + entro il
              </button>
            )
          )}
        </div>

        {isEditingNote ? (
          <form onSubmit={saveNote} data-no-drag="" className="mt-1.5">
            <div className="flex items-start gap-1.5">
              <textarea
                autoFocus
                value={noteValue}
                onChange={(event) => setNoteValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelNote();
                  } else if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={2000}
                rows={1}
                placeholder="Nota..."
                disabled={isSavingNote}
                className="input min-h-9 flex-1 resize-y py-2 text-xs"
              />
              <button
                type="submit"
                disabled={isSavingNote}
                aria-label="Salva nota"
                title="Salva nota"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              >
                {isSavingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={cancelNote}
                disabled={isSavingNote}
                aria-label="Annulla nota"
                title="Annulla"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {noteError && <p className="mt-1 text-[11px] text-red-600">{noteError}</p>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingNote(true)}
            className={cn(
              'mt-1 block w-full text-left text-xs italic whitespace-pre-wrap break-words transition-colors',
              displayNote ? (isDone ? 'text-slate-400' : 'text-slate-500 hover:text-slate-700') : 'text-slate-400 hover:text-blue-600'
            )}
          >
            {displayNote || 'Aggiungi una nota'}
          </button>
        )}
      </div>

      <div className="flex shrink-0 self-start">
        <button
          type="button"
          data-no-drag=""
          onClick={() => onEdit(activity)}
          title="Modifica"
          aria-label={`Modifica ${activity.title}`}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-no-drag=""
          onClick={() => onDelete(activity)}
          title="Elimina"
          aria-label={`Elimina ${activity.title}`}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}
