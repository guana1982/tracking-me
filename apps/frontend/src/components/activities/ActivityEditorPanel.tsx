import { useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, CheckSquare2, Loader2, RotateCcw, Save } from 'lucide-react';
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

export interface ActivityEditorData extends CreateActivityDTO {
  status?: ActivityStatusDTO;
}

interface ActivityEditorPanelProps {
  activity: ActivityDTO | null;
  selectedDate: string;
  types: ActivityTypeDTO[];
  isSaving: boolean;
  onSave: (data: ActivityEditorData) => Promise<void>;
  onCancelEdit: () => void;
}

const PRIORITIES: ActivityPriorityDTO[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export function ActivityEditorPanel({
  activity,
  selectedDate,
  types,
  isSaving,
  onSave,
  onCancelEdit,
}: ActivityEditorPanelProps) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [notes, setNotes] = useState(activity?.notes ?? '');
  const [kind, setKind] = useState<ActivityKindDTO>(activity?.kind ?? 'TASK');
  const [scope, setScope] = useState<ActivityScopeDTO>(activity?.scope ?? 'DAY');
  const [scheduledFor, setScheduledFor] = useState(activity?.scheduledFor ?? selectedDate);
  const [dueDate, setDueDate] = useState(activity?.dueDate ?? '');
  const [dueTime, setDueTime] = useState(activity?.dueTime ?? '');
  const [priority, setPriority] = useState<ActivityPriorityDTO>(activity?.priority ?? 'MEDIUM');
  const [status, setStatus] = useState<ActivityStatusDTO>(activity?.status ?? 'TODO');
  const [typeKey, setTypeKey] = useState(activity?.typeKey ?? '');
  const [error, setError] = useState<string | null>(null);

  const availableTypes = useMemo(
    () => types.filter((type) => type.kind === kind && (type.isActive || type.key === typeKey)),
    [kind, typeKey, types]
  );

  const changeKind = (nextKind: ActivityKindDTO) => {
    setKind(nextKind);
    setTypeKey('');
    if (nextKind === 'DEADLINE') {
      setScope('DAY');
      setDueDate((current) => current || scheduledFor);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim()) return setError('Inserisci un titolo.');
    if (kind === 'DEADLINE' && !dueDate) return setError('Inserisci la data di scadenza.');

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
      if (!activity) {
        setTitle('');
        setNotes('');
        setDueDate('');
        setDueTime('');
        setTypeKey('');
        setPriority('MEDIUM');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare l’attività.');
    }
  };

  return (
    <section className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{activity ? 'Modifica attività' : 'Nuova attività'}</h2>
          <p className="text-[11px] text-slate-500">{activity ? 'Le modifiche agiscono sul task selezionato.' : 'Inserisci un task senza lasciare la pagina.'}</p>
        </div>
        {activity && (
          <button type="button" onClick={onCancelEdit} title="Annulla modifica" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={submit} className="p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button type="button" onClick={() => changeKind('TASK')} className={cn('min-h-10 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5', kind === 'TASK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
            <CheckSquare2 className="w-3.5 h-3.5" /> Attività
          </button>
          <button type="button" onClick={() => changeKind('DEADLINE')} className={cn('min-h-10 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5', kind === 'DEADLINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
            <CalendarClock className="w-3.5 h-3.5" /> Scadenza
          </button>
        </div>

        <div>
          <label htmlFor="activity-editor-title" className="label">Titolo</label>
          <input id="activity-editor-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Cosa devi fare?" className="input w-full min-h-11" />
        </div>

        {kind === 'TASK' && (
          <div>
            <span className="label">Quando</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setScope('DAY')} className={cn('btn min-h-10 text-xs', scope === 'DAY' ? 'btn-primary' : 'btn-secondary')}>Giornata</button>
              <button type="button" onClick={() => setScope('WEEK')} className={cn('btn min-h-10 text-xs', scope === 'WEEK' ? 'btn-primary' : 'btn-secondary')}>Settimana</button>
            </div>
          </div>
        )}

        {kind === 'TASK' && (
          <div>
            <label htmlFor="activity-editor-date" className="label">{scope === 'WEEK' ? 'Settimana che contiene' : 'Giorno'}</label>
            <input id="activity-editor-date" type="date" required value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="input w-full min-h-11" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="activity-editor-due" className="label">{kind === 'DEADLINE' ? 'Scadenza' : 'Entro il'}</label>
            <input id="activity-editor-due" type="date" required={kind === 'DEADLINE'} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="input w-full min-w-0 min-h-11 px-2" />
          </div>
          <div>
            <label htmlFor="activity-editor-time" className="label">Ora</label>
            <input id="activity-editor-time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} className="input w-full min-w-0 min-h-11 px-2 disabled:bg-slate-50 disabled:text-slate-300" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="activity-editor-priority" className="label">Priorità</label>
            <select id="activity-editor-priority" value={priority} onChange={(event) => setPriority(event.target.value as ActivityPriorityDTO)} className="input w-full min-h-11 px-2">
              {PRIORITIES.map((value) => <option key={value} value={value}>{ACTIVITY_PRIORITY_LABELS[value]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="activity-editor-type" className="label">Tipologia</label>
            <select id="activity-editor-type" value={typeKey} onChange={(event) => setTypeKey(event.target.value)} className="input w-full min-h-11 px-2">
              <option value="">Nessuna</option>
              {availableTypes.map((type) => <option key={type.key} value={type.key}>{type.name}</option>)}
            </select>
          </div>
        </div>

        {activity && (
          <div>
            <label htmlFor="activity-editor-status" className="label">Stato</label>
            <select id="activity-editor-status" value={status} onChange={(event) => setStatus(event.target.value as ActivityStatusDTO)} className="input w-full min-h-11">
              {(['TODO', 'IN_PROGRESS', 'DONE'] as ActivityStatusDTO[]).map((value) => <option key={value} value={value}>{ACTIVITY_STATUS_LABELS[value]}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="activity-editor-notes" className="label">Note</label>
          <textarea id="activity-editor-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="Dettagli utili…" className="input w-full resize-y" />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="submit" disabled={isSaving} className="btn btn-primary w-full min-h-11 flex items-center justify-center gap-2">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {activity ? 'Salva modifiche' : 'Aggiungi attività'}
        </button>
        {activity && <button type="button" onClick={onCancelEdit} className="btn btn-secondary w-full min-h-10 text-xs">Torna al nuovo inserimento</button>}
      </form>
    </section>
  );
}
