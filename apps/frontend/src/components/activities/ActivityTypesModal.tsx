import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import type {
  ActivityKindDTO,
  ActivityTypeDTO,
  CreateActivityTypeDTO,
  UpdateActivityTypeDTO,
} from '@budget/shared';

interface ActivityTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
  types: ActivityTypeDTO[];
  isBusy: boolean;
  onInstallDefaults: () => Promise<void>;
  onCreate: (data: CreateActivityTypeDTO) => Promise<void>;
  onUpdate: (key: string, data: UpdateActivityTypeDTO) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
}

/**
 * Categories are set up once and then left alone, so they no longer hold a
 * column open on every visit: they live behind a button and come back on
 * request.
 */
export function ActivityTypesModal({
  isOpen,
  onClose,
  types,
  isBusy,
  onInstallDefaults,
  onCreate,
  onUpdate,
  onDelete,
}: ActivityTypesModalProps) {
  const [editing, setEditing] = useState<ActivityTypeDTO | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [kind, setKind] = useState<ActivityKindDTO>('TASK');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-types-title"
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 id="activity-types-title" className="text-lg font-semibold text-slate-900">Tipologie</h2>
            <p className="text-xs text-slate-500 mt-0.5">Categorie e colori delle attività.</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void install()}
              disabled={isBusy}
              title="Aggiungi le tipologie suggerite"
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-violet-600 hover:bg-violet-50 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
        </div>

        <form onSubmit={submit} className="border-t border-slate-200 p-4 space-y-2">
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
    </div>
  );
}
