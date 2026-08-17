import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Check, Circle, Clock3, Pencil, Trash2 } from 'lucide-react';
import type { ActivityDTO, ActivityPriorityDTO } from '@budget/shared';
import { ACTIVITY_PRIORITY_LABELS, ACTIVITY_STATUS_LABELS } from '@budget/shared';
import { cn } from '../../lib/utils';

const PRIORITY_STYLES: Record<ActivityPriorityDTO, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-50 text-amber-700',
  URGENT: 'bg-red-50 text-red-700',
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
    <article className={cn('group flex gap-3 px-3 sm:px-4 py-3 border-t border-slate-100 first:border-t-0', isDone && 'bg-slate-50/70')}>
      <button
        type="button"
        onClick={() => onToggle(activity)}
        disabled={isBusy}
        aria-label={isDone ? 'Segna come da fare' : 'Segna come completata'}
        className={cn(
          'mt-0.5 w-11 h-11 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors',
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-400'
        )}
      >
        {isDone ? <Check className="w-5 h-5" /> : <Circle className="w-3 h-3 text-slate-300" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className={cn('min-w-0 flex-1 text-sm font-medium text-slate-900 break-words', isDone && 'line-through text-slate-400')}>
            {activity.title}
          </h3>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', PRIORITY_STYLES[activity.priority])}>
            {ACTIVITY_PRIORITY_LABELS[activity.priority]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] text-slate-500">
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{contextLabel}</span>
          {activity.typeName && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.typeColor ?? '#94a3b8' }} />
              {activity.typeName}
            </span>
          )}
          {activity.status === 'IN_PROGRESS' && <span className="text-blue-600">{ACTIVITY_STATUS_LABELS.IN_PROGRESS}</span>}
          {dueLabel && (
            <span className={cn('inline-flex items-center gap-1', isOverdue && 'font-semibold text-red-600')}>
              <Clock3 className="w-3 h-3" />
              {isOverdue ? 'Scaduta ' : ''}{dueLabel}{activity.dueTime ? ` · ${activity.dueTime}` : ''}
            </span>
          )}
        </div>
        {activity.notes && <p className={cn('mt-1.5 text-xs text-slate-500 whitespace-pre-wrap break-words', isDone && 'text-slate-400')}>{activity.notes}</p>}
      </div>

      <div className="flex shrink-0 self-start">
        <button type="button" onClick={() => onEdit(activity)} title="Modifica" className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <Pencil className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => onDelete(activity)} title="Elimina" className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}
