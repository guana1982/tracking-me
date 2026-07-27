import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCreateMood, useDeleteMood, useMoods, useUpdateMood } from '../../hooks/useFoodQueries';
import type { QuickLogValenceDTO } from '@budget/shared';

interface MoodManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const VALENCES: { value: QuickLogValenceDTO; label: string; active: string; idle: string }[] = [
  {
    value: 'POSITIVE',
    label: 'Positivo',
    active: 'border-emerald-500 bg-emerald-500 text-white',
    idle: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
  },
  {
    value: 'NEUTRAL',
    label: 'Neutro',
    active: 'border-slate-500 bg-slate-500 text-white',
    idle: 'border-slate-200 text-slate-600 hover:bg-slate-50',
  },
  {
    value: 'NEGATIVE',
    label: 'Negativo',
    active: 'border-rose-500 bg-rose-500 text-white',
    idle: 'border-rose-200 text-rose-700 hover:bg-rose-50',
  },
];

const VALENCE_LABEL: Record<QuickLogValenceDTO, string> = {
  POSITIVE: 'Positivo',
  NEUTRAL: 'Neutro',
  NEGATIVE: 'Negativo',
};

const VALENCE_DOT: Record<QuickLogValenceDTO, string> = {
  POSITIVE: 'bg-emerald-500',
  NEUTRAL: 'bg-slate-400',
  NEGATIVE: 'bg-rose-500',
};

function ValencePicker({
  value,
  onChange,
  disabled,
}: {
  value: QuickLogValenceDTO;
  onChange: (valence: QuickLogValenceDTO) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {VALENCES.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'px-2 py-1 rounded-full border text-[11px] font-medium transition-colors disabled:opacity-50',
            value === option.value ? option.active : option.idle
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Full CRUD over the mood catalog, mirroring "Gestisci tipi pasto" but with
 * the extra dimension moods carry: their valence. Past mood logs keep their
 * own text and valence, so editing or deleting here never rewrites history.
 */
export function MoodManager({ isOpen, onClose }: MoodManagerProps) {
  const moods = useMoods();
  const createMood = useCreateMood();
  const updateMood = useUpdateMood();
  const deleteMood = useDeleteMood();

  const [newName, setNewName] = useState('');
  const [newValence, setNewValence] = useState<QuickLogValenceDTO>('POSITIVE');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewName('');
      setNewValence('POSITIVE');
      setEditingKey(null);
      setEditingName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const error = createMood.error || updateMood.error || deleteMood.error || moods.error;
  const isPending = createMood.isPending || updateMood.isPending || deleteMood.isPending;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    await createMood.mutateAsync({ name: newName.trim(), valence: newValence });
    setNewName('');
  };

  const handleRename = async (key: string) => {
    if (!editingName.trim()) return;
    await updateMood.mutateAsync({ key, data: { name: editingName.trim() } });
    setEditingKey(null);
    setEditingName('');
  };

  const handleDelete = (key: string, name: string, isUsed: boolean) => {
    const warning = isUsed
      ? `"${name}" è già stato usato in alcune giornate. Le registrazioni passate restano invariate. Eliminarlo dall'elenco?`
      : `Eliminare "${name}" dall'elenco degli umori?`;
    if (window.confirm(warning)) {
      deleteMood.mutate(key);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-900">Gestisci stati d'umore</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalizza le voci proposte dal selettore.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Create */}
          <form onSubmit={handleCreate} className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="input flex-1"
                placeholder="Es. Nervosismo"
                maxLength={40}
              />
              <button
                type="submit"
                className="btn btn-primary shrink-0"
                disabled={!newName.trim() || isPending}
              >
                {createMood.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span className="ml-1">Aggiungi</span>
              </button>
            </div>
            <ValencePicker value={newValence} onChange={setNewValence} disabled={isPending} />
          </form>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error instanceof Error ? error.message : 'Operazione non riuscita'}
            </p>
          )}

          {moods.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {moods.data?.map((mood) => (
                <div key={mood.key} className="p-3">
                  {editingKey === mood.key ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="input flex-1"
                          maxLength={40}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleRename(mood.key);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleRename(mood.key)}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-700"
                          disabled={!editingName.trim() || isPending}
                          aria-label="Salva nome"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                      <ValencePicker
                        value={mood.valence}
                        disabled={isPending}
                        onChange={(valence) =>
                          updateMood.mutate({ key: mood.key, data: { valence } })
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn('w-2 h-2 rounded-full shrink-0', VALENCE_DOT[mood.valence])}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{mood.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {VALENCE_LABEL[mood.valence]}
                          {mood.isDefault ? ' · predefinito' : ' · personalizzato'}
                          {mood.isUsed ? ' · presente nello storico' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(mood.key);
                          setEditingName(mood.name);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label={`Modifica ${mood.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(mood.key, mood.name, mood.isUsed)}
                        disabled={isPending}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Elimina ${mood.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateMood.mutate({
                            key: mood.key,
                            data: { isActive: !mood.isActive },
                          })
                        }
                        disabled={isPending}
                        className={cn(
                          'relative w-10 h-6 rounded-full transition-colors shrink-0',
                          mood.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        )}
                        aria-label={mood.isActive ? `Disattiva ${mood.name}` : `Attiva ${mood.name}`}
                      >
                        <span
                          className={cn(
                            'absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform',
                            mood.isActive ? 'translate-x-4' : 'translate-x-0'
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Gli umori disattivati restano nelle giornate già registrate, ma non vengono più
            proposti. L'eliminazione toglie la voce dall'elenco senza modificare lo storico.
          </p>
        </div>
      </div>
    </div>
  );
}
