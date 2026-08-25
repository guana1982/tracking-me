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
import { ACTIVITY_PRIORITIES, ACTIVITY_PRIORITY_LABELS, ACTIVITY_STATUS_LABELS } from '@budget/shared';
import { cn } from '../../lib/utils';

/**
 * Priority is shown twice on purpose, and the two are not redundant.
 *
 * The rail down the left edge is read without being read: scanning fifteen
 * cards, the eye finds the red ones before it has parsed a single word. The
 * badge carries the exact value, and is the way to change it. Colour alone
 * would fail anyone who cannot see it, which is why the word stays.
 */
const PRIORITY_RAIL: Record<ActivityPriorityDTO, string> = {
  LOW: 'border-l-slate-200',
  MEDIUM: 'border-l-blue-400',
  HIGH: 'border-l-amber-400',
  URGENT: 'border-l-red-500',
};

const PRIORITY_BADGE: Record<ActivityPriorityDTO, string> = {
  LOW: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  HIGH: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  URGENT: 'bg-red-50 text-red-700 hover:bg-red-100',
};

const PRIORITY_DOT: Record<ActivityPriorityDTO, string> = {
  LOW: 'bg-slate-300',
  MEDIUM: 'bg-blue-400',
  HIGH: 'bg-amber-400',
  URGENT: 'bg-red-500',
};

/** Roughly what the priority menu measures, used only to keep it on screen */
const MENU_WIDTH = 180;
const MENU_HEIGHT = 176;
const MENU_MARGIN = 8;

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
  /** Renaming is the commonest edit of all: it must not cost a trip through the form */
  onSaveTitle: (activity: ActivityDTO, title: string) => Promise<void>;
  onSetPriority: (activity: ActivityDTO, priority: ActivityPriorityDTO) => Promise<void>;
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
  onSaveTitle,
  onSetPriority,
  onPickDate,
}: ActivityCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(activity.notes ?? '');
  const [displayNote, setDisplayNote] = useState(activity.notes ?? '');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(activity.title);
  const [displayTitle, setDisplayTitle] = useState(activity.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Fixed, not absolute: the list lives inside a card with overflow hidden, and
  // an absolutely placed menu on the last row would be cut in half by it
  const [priorityMenu, setPriorityMenu] = useState<{ x: number; y: number } | null>(null);

  const isDone = activity.status === 'DONE';
  const isOverdue = !isDone && activity.dueDate !== null && activity.dueDate < today;
  const isEditing = isEditingNote || isEditingTitle;
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

  useEffect(() => {
    setTitleValue(activity.title);
    setDisplayTitle(activity.title);
  }, [activity.title]);

  useEffect(() => {
    if (!priorityMenu) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPriorityMenu(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [priorityMenu]);

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

  const cancelTitle = () => {
    setTitleValue(displayTitle);
    setTitleError(null);
    setIsEditingTitle(false);
  };

  /**
   * Blur saves, Escape reverts. An emptied field is a cancel and never an
   * error: a task with no name cannot be saved anyway, and nobody clears a
   * title meaning to destroy it.
   */
  const saveTitle = async () => {
    const title = titleValue.trim();
    if (!title || title === displayTitle) {
      cancelTitle();
      return;
    }
    setIsSavingTitle(true);
    setTitleError(null);
    try {
      await onSaveTitle(activity, title);
      setDisplayTitle(title);
      setIsEditingTitle(false);
    } catch (cause) {
      setTitleError(cause instanceof Error ? cause.message : 'Impossibile salvare il titolo.');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const openPriorityMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPriorityMenu({
      x: Math.max(MENU_MARGIN, Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_MARGIN)),
      y: Math.max(
        MENU_MARGIN,
        Math.min(rect.bottom + 4, window.innerHeight - MENU_HEIGHT - MENU_MARGIN)
      ),
    });
  };

  const choosePriority = async (priority: ActivityPriorityDTO) => {
    setPriorityMenu(null);
    if (priority === activity.priority) return;
    await onSetPriority(activity, priority);
  };

  return (
    <article
      {...dragProps}
      // Off while a field is open, or the browser would drag the card instead
      // of letting the text be selected
      draggable={canDrag && !isEditing}
      className={cn(
        'group flex items-start gap-2 rounded-xl border border-l-4 border-slate-200 bg-white px-2.5 py-2.5 shadow-sm transition-colors hover:border-slate-300',
        // A finished task has no urgency left to advertise
        isDone ? 'border-l-slate-200 bg-slate-50/60' : PRIORITY_RAIL[activity.priority],
        canDrag && !isEditing && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50'
      )}
    >
      <button
        type="button"
        data-drag-handle=""
        {...restDragHandleProps}
        className={cn(
          'w-8 h-10 sm:w-6 sm:h-8 -ml-1 rounded-lg flex items-center justify-center shrink-0 touch-none cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-500 hover:bg-slate-50',
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
          'w-10 h-10 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors disabled:opacity-50',
          isDone
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'bg-white border-slate-300 text-slate-300 hover:border-emerald-400 hover:text-emerald-500'
        )}
      >
        {isDone ? <Check className="w-4 h-4" /> : <Circle className="w-3.5 h-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        {/*
          The title has the row to itself and is the biggest thing on the card.
          Everything that used to sit beside it - the kind icon, the badges, the
          hour - moved down a line: those all answer "which one is this", and
          they only matter once the title has been found.

          Left aligned, and it stays that way. Centring reads well on a single
          hero element, but in a list it moves the start of every line: scanning
          fifteen tasks stops being one movement of the eye down a straight edge
          and becomes fifteen separate searches.
        */}
        {isEditingTitle ? (
          <form
            data-no-drag=""
            onSubmit={(event) => {
              event.preventDefault();
              void saveTitle();
            }}
          >
            <input
              autoFocus
              value={titleValue}
              onChange={(event) => setTitleValue(event.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelTitle();
                }
              }}
              maxLength={160}
              disabled={isSavingTitle}
              aria-label="Titolo dell’attività"
              // Same size and weight as the text it replaces, so the line does
              // not resize the moment it becomes editable
              className="input w-full min-h-9 px-2 py-1 text-base sm:text-lg font-semibold leading-snug"
            />
          </form>
        ) : (
          <button
            type="button"
            data-no-drag=""
            onClick={() => setIsEditingTitle(true)}
            title="Clicca per rinominare"
            // No horizontal padding: the highlight has to start exactly where
            // the text does, or the title sits off the line below it
            className={cn(
              'block w-full rounded py-0.5 text-left text-base sm:text-lg font-semibold leading-snug break-words transition-colors',
              isDone
                ? 'text-slate-400 line-through hover:bg-slate-100'
                : 'text-slate-900 hover:bg-slate-100'
            )}
          >
            {displayTitle}
            {isSavingTitle && (
              <Loader2 className="ml-1.5 inline w-3.5 h-3.5 animate-spin text-slate-400" />
            )}
          </button>
        )}
        {titleError && <p className="mt-0.5 text-[11px] text-red-600">{titleError}</p>}

        {/* Everything that qualifies the task, on one quiet line under it */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] text-slate-400">
          {activity.kind === 'DEADLINE' ? (
            <CalendarClock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          ) : (
            <CheckSquare2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          )}

          <button
            type="button"
            data-no-drag=""
            onClick={openPriorityMenu}
            aria-haspopup="menu"
            aria-expanded={priorityMenu !== null}
            title="Cambia priorità"
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
              PRIORITY_BADGE[activity.priority]
            )}
          >
            {ACTIVITY_PRIORITY_LABELS[activity.priority]}
          </button>

          {activity.status === 'IN_PROGRESS' && (
            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              {ACTIVITY_STATUS_LABELS.IN_PROGRESS}
            </span>
          )}
          {isBacklog && (
            <span
              title="Pianificata per un giorno precedente e ancora aperta"
              className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
            >
              Arretrato
            </span>
          )}

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
          {activity.dueTime && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 className="w-3 h-3" />
              {activity.dueTime}
            </span>
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
            data-no-drag=""
            onClick={() => setIsEditingNote(true)}
            className={cn(
              'mt-1 block w-full text-left text-xs italic whitespace-pre-wrap break-words transition-colors',
              displayNote
                ? isDone
                  ? 'text-slate-400'
                  : 'text-slate-500 hover:text-slate-700'
                : 'text-slate-300 hover:text-blue-600'
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
          title="Apri il modulo completo"
          aria-label={`Modifica ${displayTitle}`}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-700 hover:bg-slate-100"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-no-drag=""
          onClick={() => onDelete(activity)}
          title="Elimina"
          aria-label={`Elimina ${displayTitle}`}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {priorityMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPriorityMenu(null)} />
          <div
            role="menu"
            aria-label="Priorità"
            className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
            style={{ left: priorityMenu.x, top: priorityMenu.y }}
          >
            {ACTIVITY_PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                role="menuitemradio"
                aria-checked={priority === activity.priority}
                onClick={() => void choosePriority(priority)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-slate-50',
                  priority === activity.priority ? 'font-semibold text-slate-900' : 'text-slate-600'
                )}
              >
                <span className={cn('w-2 h-2 shrink-0 rounded-full', PRIORITY_DOT[priority])} />
                {ACTIVITY_PRIORITY_LABELS[priority]}
                {priority === activity.priority && (
                  <Check className="ml-auto w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </article>
  );
}
