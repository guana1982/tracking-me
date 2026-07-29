import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useCreateRating,
  useDeleteRating,
  useRatings,
  useUpdateRating,
} from '../../hooks/useRatingQueries';
import {
  RATING_LINKED_FORMS,
  RATING_LINKED_FORM_LABELS,
  RATING_MAX_MAX,
  RATING_MIN_MAX,
} from '@budget/shared';
import type { RatingLinkedFormDTO } from '@budget/shared';

interface RatingManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCALE_OPTIONS = Array.from(
  { length: RATING_MAX_MAX - RATING_MIN_MAX + 1 },
  (_, index) => RATING_MIN_MAX + index
);

function LinkedFormPicker({
  value,
  onChange,
  disabled,
}: {
  value: RatingLinkedFormDTO;
  onChange: (form: RatingLinkedFormDTO) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {RATING_LINKED_FORMS.map((form) => (
        <button
          key={form}
          type="button"
          disabled={disabled}
          onClick={() => onChange(form)}
          aria-pressed={value === form}
          className={cn(
            'px-2 py-1 rounded-full border text-[11px] font-medium transition-colors disabled:opacity-50',
            value === form
              ? 'border-fuchsia-500 bg-fuchsia-500 text-white'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          {RATING_LINKED_FORM_LABELS[form]}
        </button>
      ))}
    </div>
  );
}

/**
 * Full CRUD over the rated characteristics. The three installed at first run
 * have no special status here: they can be renamed, rescaled or removed like
 * any other, which is what makes the rows mean whatever the user needs.
 */
export function RatingManager({ isOpen, onClose }: RatingManagerProps) {
  const ratings = useRatings();
  const createRating = useCreateRating();
  const updateRating = useUpdateRating();
  const deleteRating = useDeleteRating();

  const [newName, setNewName] = useState('');
  const [newMax, setNewMax] = useState(10);
  const [newLinkedForm, setNewLinkedForm] = useState<RatingLinkedFormDTO>('NONE');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewName('');
      setNewMax(10);
      setNewLinkedForm('NONE');
      setEditingKey(null);
      setEditingName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const error = createRating.error || updateRating.error || deleteRating.error || ratings.error;
  const isPending = createRating.isPending || updateRating.isPending || deleteRating.isPending;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    await createRating.mutateAsync({
      name: newName.trim(),
      maxValue: newMax,
      linkedForm: newLinkedForm,
    });
    setNewName('');
    setNewLinkedForm('NONE');
  };

  const handleRename = async (key: string) => {
    if (!editingName.trim()) return;
    await updateRating.mutateAsync({ key, data: { name: editingName.trim() } });
    setEditingKey(null);
    setEditingName('');
  };

  const handleDelete = (key: string, name: string, isUsed: boolean) => {
    const warning = isUsed
      ? `"${name}" ha già dei voti registrati. I voti passati restano invariati. Eliminare la caratteristica?`
      : `Eliminare "${name}" dalle caratteristiche valutate?`;
    if (window.confirm(warning)) {
      deleteRating.mutate(key);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-900">Cosa vuoi valutare</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ogni caratteristica è una riga di caselle nel diario.
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
                placeholder="Es. Concentrazione"
                maxLength={60}
              />
              <button
                type="submit"
                className="btn btn-primary shrink-0"
                disabled={!newName.trim() || isPending}
              >
                {createRating.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span className="ml-1">Aggiungi</span>
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-[11px] text-slate-500">
                Voto massimo
                <select
                  value={newMax}
                  onChange={(event) => setNewMax(Number(event.target.value))}
                  className="ml-1.5 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs"
                >
                  {SCALE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-[11px] text-slate-500">Popup collegato</span>
              <LinkedFormPicker
                value={newLinkedForm}
                onChange={setNewLinkedForm}
                disabled={isPending}
              />
            </div>
          </form>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error instanceof Error ? error.message : 'Operazione non riuscita'}
            </p>
          )}

          {ratings.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {ratings.data?.map((rating) => (
                <div key={rating.key} className="p-3">
                  {editingKey === rating.key ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          className="input flex-1"
                          maxLength={60}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleRename(rating.key);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleRename(rating.key)}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-700"
                          disabled={!editingName.trim() || isPending}
                          aria-label="Salva nome"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-[11px] text-slate-500">
                          Voto massimo
                          <select
                            value={rating.maxValue}
                            onChange={(event) =>
                              updateRating.mutate({
                                key: rating.key,
                                data: { maxValue: Number(event.target.value) },
                              })
                            }
                            className="ml-1.5 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs"
                          >
                            {SCALE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        <LinkedFormPicker
                          value={rating.linkedForm}
                          disabled={isPending}
                          onChange={(linkedForm) =>
                            updateRating.mutate({ key: rating.key, data: { linkedForm } })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{rating.name}</p>
                        <p className="text-[11px] text-slate-400">
                          da 1 a {rating.maxValue}
                          {rating.linkedForm !== 'NONE'
                            ? ` · ${RATING_LINKED_FORM_LABELS[rating.linkedForm]}`
                            : ''}
                          {rating.isUsed ? ' · presente nello storico' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(rating.key);
                          setEditingName(rating.name);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label={`Modifica ${rating.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rating.key, rating.name, rating.isUsed)}
                        disabled={isPending}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Elimina ${rating.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateRating.mutate({
                            key: rating.key,
                            data: { isActive: !rating.isActive },
                          })
                        }
                        disabled={isPending}
                        className={cn(
                          'relative w-10 h-6 rounded-full transition-colors shrink-0',
                          rating.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        )}
                        aria-label={
                          rating.isActive ? `Disattiva ${rating.name}` : `Attiva ${rating.name}`
                        }
                      >
                        <span
                          className={cn(
                            'absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform',
                            rating.isActive ? 'translate-x-4' : 'translate-x-0'
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
            Le caratteristiche disattivate spariscono dal diario ma restano nei giorni già
            valutati. Cambiare il voto massimo vale da qui in avanti: i voti già dati mantengono
            la scala con cui erano stati registrati.
          </p>
        </div>
      </div>
    </div>
  );
}
