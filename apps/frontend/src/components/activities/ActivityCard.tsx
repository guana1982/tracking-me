import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarClock, Check, CheckSquare2, Circle, Clock3, Pencil, Trash2 } from 'lucide-react';
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
  isBusy: boolean;
  onToggle: (activity: ActivityDTO) => void;
  onEdit: (activity: ActivityDTO) => void;
  onDelete: (activity: ActivityDTO) => void;
}

export function ActivityCard({ activity, today, isBusy, onToggle, onEdit, onDelete }: ActivityCardProps) {
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

  return (
    <article className="group flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 shadow-sm transition-colors hover:border-slate-300">
      <button
        type="button"
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
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px] text-slate-400">
          <span>{contextLabel}</span>
          {activity.typeName && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activity.typeColor ?? '#94a3b8' }} />
              {activity.typeName}
            </span>
          )}
          {dueLabel && (
            <span className={cn('inline-flex items-center gap-1', isOverdue && 'font-semibold text-red-600')}>
              <Clock3 className="w-3 h-3" />
              {isOverdue ? 'Scaduta ' : 'Entro '}{dueLabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onEdit(activity)}
          className={cn(
            'mt-1 block w-full text-left text-xs italic whitespace-pre-wrap break-words transition-colors',
            activity.notes ? (isDone ? 'text-slate-400' : 'text-slate-500 hover:text-slate-700') : 'text-slate-400 hover:text-blue-600'
          )}
        >
          {activity.notes || 'Aggiungi una nota'}
        </button>
      </div>

      <div className="flex shrink-0 self-start">
        <button
          type="button"
          onClick={() => onEdit(activity)}
          title="Modifica"
          aria-label={`Modifica ${activity.title}`}
          className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
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
