import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, CheckSquare2, Loader2, X } from 'lucide-react';
import type {
  ActivityDTO,
  ActivityKindDTO,
  ActivityPriorityDTO,
  ActivityScopeDTO,
  ActivityStatusDTO,
  ActivityTypeDTO,
  CreateActivityDTO,
} from '@budget/shared';
import { ACTIVITY_PRIORITY_LABELS, ACTIVITY_STATUS_LABELS } from '@budget/shared';
import { cn } from '../../lib/utils';

export interface ActivityFormData extends CreateActivityDTO {
  status?: ActivityStatusDTO;
}

interface ActivityFormModalProps {
  isOpen: boolean;
  activity: ActivityDTO | null;
  initialKind: ActivityKindDTO;
  initialScope: ActivityScopeDTO;
  initialDate: string;
  types: ActivityTypeDTO[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (data: ActivityFormData) => Promise<void>;
}

const PRIORITIES: ActivityPriorityDTO[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export function ActivityFormModal({
  isOpen,
  activity,
  initialKind,
  initialScope,
  initialDate,
  types,
  isSaving,
  onClose,
  onSave,
}: ActivityFormModalProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<ActivityKindDTO>('TASK');
  const [scope, setScope] = useState<ActivityScopeDTO>('DAY');
  const [scheduledFor, setScheduledFor] = useState(initialDate);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<ActivityPriorityDTO>('MEDIUM');
  const [status, setStatus] = useState<ActivityStatusDTO>('TODO');
  const [typeKey, setTypeKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(activity?.title ?? '');
    setNotes(activity?.notes ?? '');
    setKind(activity?.kind ?? initialKind);
    setScope(activity?.scope ?? initialScope);
    setScheduledFor(activity?.scheduledFor ?? initialDate);
    setDueDate(activity?.dueDate ?? (initialKind === 'DEADLINE' ? initialDate : ''));
    setDueTime(activity?.dueTime ?? '');
    setPriority(activity?.priority ?? 'MEDIUM');
    setStatus(activity?.status ?? 'TODO');
    setTypeKey(activity?.typeKey ?? '');
    setError(null);
  }, [activity, initialDate, initialKind, initialScope, isOpen]);

  const availableTypes = useMemo(
    () => types.filter((type) => type.kind === kind && (type.isActive || type.key === typeKey)),
    [kind, typeKey, types]
  );

  if (!isOpen) return null;

  const changeKind = (nextKind: ActivityKindDTO) => {
    setKind(nextKind);
    setTypeKey('');
    if (nextKind === 'DEADLINE') {
      setScope('DAY');
      setDueDate((current) => current || scheduledFor);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Inserisci un titolo.');
      return;
    }
    if (kind === 'DEADLINE' && !dueDate) {
      setError('Inserisci la data di scadenza.');
      return;
    }
    try {
      await onSave({
        title: title.trim(),
        notes: notes.trim() || null,
        kind,
        scope: kind === 'DEADLINE' ? 'DAY' : scope,
        scheduledFor: kind === 'DEADLINE' ? dueDate : scheduledFor,
        dueDate: dueDate || null,
        dueTime: dueDate && dueTime ? dueTime : null,
        priority,
        typeKey: typeKey || null,
        ...(activity ? { status } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare l’attività.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <button type="button" aria-label="Chiudi" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-4 bg-white border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {activity ? 'Modifica' : 'Nuova'} {kind === 'DEADLINE' ? 'scadenza' : 'attività'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Organizza cosa fare e quando.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button type="button" onClick={() => changeKind('TASK')} className={cn('min-h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2', kind === 'TASK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              <CheckSquare2 className="w-4 h-4" /> Attività
            </button>
            <button type="button" onClick={() => changeKind('DEADLINE')} className={cn('min-h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2', kind === 'DEADLINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
              <CalendarClock className="w-4 h-4" /> Scadenza
            </button>
          </div>

          <div>
            <label htmlFor="activity-title" className="label">Titolo</label>
            <input id="activity-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder={kind === 'DEADLINE' ? 'Es. Rinnovare assicurazione' : 'Es. Chiamare il commercialista'} className="input w-full min-h-11" />
          </div>

          {kind === 'TASK' && (
            <div>
              <span className="label">Pianificazione</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setScope('DAY')} className={cn('btn min-h-11', scope === 'DAY' ? 'btn-primary' : 'btn-secondary')}>Nella giornata</button>
                <button type="button" onClick={() => setScope('WEEK')} className={cn('btn min-h-11', scope === 'WEEK' ? 'btn-primary' : 'btn-secondary')}>Nella settimana</button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {kind === 'TASK' && (
              <div>
                <label htmlFor="activity-date" className="label">{scope === 'WEEK' ? 'Settimana che contiene' : 'Giorno'}</label>
                <input id="activity-date" type="date" required value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="input w-full min-h-11" />
              </div>
            )}
            <div>
              <label htmlFor="activity-due-date" className="label">{kind === 'DEADLINE' ? 'Data di scadenza' : 'Scadenza opzionale'}</label>
              <input id="activity-due-date" type="date" required={kind === 'DEADLINE'} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="input w-full min-h-11" />
            </div>
            <div>
              <label htmlFor="activity-due-time" className="label">Orario opzionale</label>
              <input id="activity-due-time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} className="input w-full min-h-11 disabled:bg-slate-50 disabled:text-slate-300" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="activity-priority" className="label">Priorità</label>
              <select id="activity-priority" value={priority} onChange={(event) => setPriority(event.target.value as ActivityPriorityDTO)} className="input w-full min-h-11">
                {PRIORITIES.map((value) => <option key={value} value={value}>{ACTIVITY_PRIORITY_LABELS[value]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="activity-type" className="label">Tipologia</label>
              <select id="activity-type" value={typeKey} onChange={(event) => setTypeKey(event.target.value)} className="input w-full min-h-11">
                <option value="">Nessuna tipologia</option>
                {availableTypes.map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
              </select>
            </div>
          </div>

          {activity && (
            <div>
              <label htmlFor="activity-status" className="label">Stato</label>
              <select id="activity-status" value={status} onChange={(event) => setStatus(event.target.value as ActivityStatusDTO)} className="input w-full min-h-11">
                {(['TODO', 'IN_PROGRESS', 'DONE'] as ActivityStatusDTO[]).map((value) => <option key={value} value={value}>{ACTIVITY_STATUS_LABELS[value]}</option>)}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="activity-notes" className="label">Note</label>
            <textarea id="activity-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="Dettagli, riferimenti o cosa serve per completarla…" className="input w-full resize-y" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 p-4 sm:px-5 bg-white border-t border-slate-100">
          <button type="button" onClick={onClose} disabled={isSaving} className="btn btn-secondary min-h-11">Annulla</button>
          <button type="submit" disabled={isSaving} className="btn btn-primary min-h-11 flex items-center justify-center gap-2">
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {activity ? 'Salva modifiche' : 'Aggiungi'}
          </button>
        </div>
      </form>
    </div>
  );
}
