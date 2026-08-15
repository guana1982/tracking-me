import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type {
  ActivityKindDTO,
  ActivityTypeDTO,
  CreateActivityTypeDTO,
  UpdateActivityTypeDTO,
} from '@budget/shared';

interface ActivityTypeManagerProps {
  isOpen: boolean;
  types: ActivityTypeDTO[];
  isBusy: boolean;
  onClose: () => void;
  onInstallDefaults: () => Promise<void>;
  onCreate: (data: CreateActivityTypeDTO) => Promise<void>;
  onUpdate: (key: string, data: UpdateActivityTypeDTO) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

const DEFAULT_COLOR = '#3b82f6';

export function ActivityTypeManager({
  isOpen,
  types,
  isBusy,
  onClose,
  onInstallDefaults,
  onCreate,
  onUpdate,
  onDelete,
}: ActivityTypeManagerProps) {
  const [editing, setEditing] = useState<ActivityTypeDTO | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [kind, setKind] = useState<ActivityKindDTO>('TASK');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEditing(null);
    setName('');
    setColor(DEFAULT_COLOR);
    setKind('TASK');
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditing(null);
    setName('');
    setColor(DEFAULT_COLOR);
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
      resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile salvare la tipologia.');
    }
  };

  const remove = async (type: ActivityTypeDTO) => {
    if (!window.confirm(`Eliminare la tipologia “${type.name}”? Le attività rimarranno salvate.`)) return;
    try {
      await onDelete(type.key);
      if (editing?.key === type.key) resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile eliminare la tipologia.');
    }
  };

  const installDefaults = async () => {
    setError(null);
    try {
      await onInstallDefaults();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile aggiungere le tipologie.');
    }
  };

  const toggleActive = async (type: ActivityTypeDTO) => {
    setError(null);
    try {
      await onUpdate(type.key, { isActive: !type.isActive });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossibile aggiornare la tipologia.');
    }
  };

  const groups: { kind: ActivityKindDTO; title: string }[] = [
    { kind: 'TASK', title: 'Tipologie attività' },
    { kind: 'DEADLINE', title: 'Tipologie scadenza' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <button type="button" aria-label="Chiudi" className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-4 bg-white border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Tipologie</h2>
            <p className="text-xs text-slate-500 mt-0.5">Personalizza categorie e colori.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <button
            type="button"
            onClick={() => void installDefaults()}
            disabled={isBusy}
            className="btn btn-secondary min-h-11 w-full flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Aggiungi le tipologie suggerite
          </button>

          {groups.map((group) => {
            const entries = types.filter((type) => type.kind === group.kind);
            return (
              <section key={group.kind}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{group.title}</h3>
                <div className="space-y-2">
                  {entries.length === 0 && <p className="text-sm text-slate-400 py-2">Nessuna tipologia.</p>}
                  {entries.map((type) => (
                    <div key={type.key} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
                      <span className={`flex-1 min-w-0 text-sm font-medium truncate ${type.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{type.name}</span>
                      <button type="button" title={type.isActive ? 'Disattiva' : 'Riattiva'} onClick={() => void toggleActive(type)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        {type.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button type="button" title="Modifica" onClick={() => startEdit(type)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" title="Elimina" onClick={() => void remove(type)} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <form onSubmit={submit} className="rounded-xl bg-slate-50 border border-slate-200 p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">{editing ? 'Modifica tipologia' : 'Nuova tipologia'}</h3>
              {editing && <button type="button" onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-800">Annulla modifica</button>}
            </div>
            {!editing && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setKind('TASK')} className={`btn min-h-10 ${kind === 'TASK' ? 'btn-primary' : 'btn-secondary'}`}>Attività</button>
                <button type="button" onClick={() => setKind('DEADLINE')} className={`btn min-h-10 ${kind === 'DEADLINE' ? 'btn-primary' : 'btn-secondary'}`}>Scadenza</button>
              </div>
            )}
            <div className="flex gap-2">
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Colore" className="w-12 min-h-11 rounded-lg border border-slate-200 bg-white p-1" />
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Nome tipologia" className="input min-w-0 flex-1 min-h-11" />
              <button type="submit" disabled={isBusy} className="btn btn-primary min-h-11 px-4 flex items-center gap-1.5">
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="hidden sm:inline">{editing ? 'Salva' : 'Aggiungi'}</span>
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
