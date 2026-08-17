import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import type {
  ActivityKindDTO,
  ActivityOverviewDTO,
  ActivityTypeDTO,
  CreateActivityTypeDTO,
  UpdateActivityTypeDTO,
} from '@budget/shared';

interface ActivityToolsPanelProps {
  summary: ActivityOverviewDTO['summary'];
  types: ActivityTypeDTO[];
  isBusy: boolean;
  isManualOrder: boolean;
  isResettingOrder: boolean;
  onResetOrder: () => Promise<void>;
  onInstallDefaults: () => Promise<void>;
  onCreate: (data: CreateActivityTypeDTO) => Promise<void>;
  onUpdate: (key: string, data: UpdateActivityTypeDTO) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

export function ActivityToolsPanel({
  summary,
  types,
  isBusy,
  isManualOrder,
  isResettingOrder,
  onResetOrder,
  onInstallDefaults,
  onCreate,
  onUpdate,
  onDelete,
}: ActivityToolsPanelProps) {
  const [editing, setEditing] = useState<ActivityTypeDTO | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [kind, setKind] = useState<ActivityKindDTO>('TASK');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEditing(null);
    setName('');
    setColor('#3b82f6');
    setKind('TASK');
    setError(null);
  };

  const startEdit = (type: ActivityTypeDTO) => {
    setEditing(type);
    setName(type.name);
    setColor(type.color);
    setKind(type.kind);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Inserisci un nome.');
    try {
      if (editing) await onUpdate(editing.key, { name: name.trim(), color });
      else await onCreate({ name: name.trim(), color, kind });
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare la tipologia.');
    }
  };

  const remove = async (type: ActivityTypeDTO) => {
    if (
      !window.confirm(
        `Eliminare la tipologia “${type.name}”? Le attività restano, e conservano l’etichetta “${type.name}”.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await onDelete(type.key);
      if (editing?.key === type.key) reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile eliminare la tipologia.');
    }
  };

  const toggle = async (type: ActivityTypeDTO) => {
    setError(null);
    try {
      await onUpdate(type.key, { isActive: !type.isActive });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile aggiornare la tipologia.');
    }
  };

  const install = async () => {
    setError(null);
    try {
      await onInstallDefaults();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile aggiungere le tipologie.');
    }
  };

  return (
    <div className="space-y-3">
      <section className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Riepilogo</h2>
          <p className="text-[11px] text-slate-500">Situazione della data selezionata.</p>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-slate-500">Giornata</span><strong>{summary.todayCompleted}/{summary.todayTotal}</strong></div>
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-slate-500">Settimana</span><strong>{summary.weekCompleted}/{summary.weekTotal}</strong></div>
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-slate-500">Arretrate</span><strong className={summary.backlog > 0 ? 'text-amber-600' : 'text-emerald-600'}>{summary.backlog}</strong></div>
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-slate-500">Scadute</span><strong className={summary.overdue > 0 ? 'text-red-600' : 'text-emerald-600'}>{summary.overdue}</strong></div>
        </div>
        <p className="px-4 pb-3 text-[11px] text-slate-400">
          «Arretrate» sono aperte da giorni precedenti, «scadute» hanno superato la data entro cui
          dovevano chiudersi: un’attività può essere l’una, l’altra o entrambe.
        </p>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Tipologie</h2>
            <p className="text-[11px] text-slate-500">Categorie e colori.</p>
          </div>
          <button type="button" onClick={() => void install()} disabled={isBusy} title="Aggiungi suggerite" className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-violet-600 hover:bg-violet-50">
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {(['TASK', 'DEADLINE'] as ActivityKindDTO[]).map((groupKind) => {
            const group = types.filter((type) => type.kind === groupKind);
            return (
              <div key={groupKind}>
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{groupKind === 'TASK' ? 'Attività' : 'Scadenze'}</h3>
                {group.length === 0 ? (
                  <p className="py-1 text-xs text-slate-400">Nessuna tipologia.</p>
                ) : (
                  <div className="space-y-1">
                    {group.map((type) => (
                      <div key={type.key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                        <span className={`min-w-0 flex-1 truncate text-xs font-medium ${type.isActive ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{type.name}</span>
                        <button type="button" onClick={() => void toggle(type)} title={type.isActive ? 'Disattiva' : 'Riattiva'} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
                          {type.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button type="button" onClick={() => startEdit(type)} title="Modifica" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => void remove(type)} title="Elimina" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <form onSubmit={submit} className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-700">{editing ? 'Modifica tipologia' : 'Nuova tipologia'}</h3>
              {editing && <button type="button" onClick={reset} className="text-[10px] text-blue-600">Annulla</button>}
            </div>
            {!editing && (
              <div className="grid grid-cols-2 gap-1">
                <button type="button" onClick={() => setKind('TASK')} className={`min-h-9 rounded-lg text-xs font-medium ${kind === 'TASK' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>Attività</button>
                <button type="button" onClick={() => setKind('DEADLINE')} className={`min-h-9 rounded-lg text-xs font-medium ${kind === 'DEADLINE' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>Scadenza</button>
              </div>
            )}
            <div className="flex gap-1.5">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Colore" className="w-10 min-h-10 rounded-lg border border-slate-200 bg-white p-1" />
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Nome" className="input min-w-0 flex-1 min-h-10 px-2 text-xs" />
              <button type="submit" disabled={isBusy} title={editing ? 'Salva' : 'Aggiungi'} className="w-10 min-h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center disabled:opacity-50">
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-600">{error}</p>}
          </form>
        </div>
      </section>

      <section className="card p-3 text-[11px] text-slate-500">
        <p className="font-semibold text-slate-700 mb-1.5">Ordine della lista</p>
        {isManualOrder ? (
          <>
            <p>
              Stai usando un ordine tuo: hai trascinato almeno una scheda, quindi priorità e
              scadenze non decidono più la posizione.
            </p>
            <button
              type="button"
              onClick={() => void onResetOrder()}
              disabled={isResettingOrder}
              className="btn btn-secondary mt-2 min-h-9 w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isResettingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Torna all’ordine automatico
            </button>
          </>
        ) : (
          <p>Urgente → Alta → Media → Bassa. A parità, prima le scadenze più vicine.</p>
        )}
      </section>
    </div>
  );
}
