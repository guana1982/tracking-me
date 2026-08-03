import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useCheckInScales,
  useCreateCheckInScale,
  useDeleteCheckInScale,
  useTreatments,
  useUpdateCheckInScale,
} from '../../hooks/useTherapyQueries';
import { SideEffectPicker } from './SideEffectPicker';
import { SIDE_EFFECT_LEVELS } from '@budget/shared';

interface SideEffectManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Everything about the side effects in one place: what is being watched, what
 * the therapy suggests watching, and a free-text field for the one nobody
 * predicted (the spec's "Altro").
 *
 * Reachable straight from the diary block, because "how do I add one" was not
 * answerable before.
 */
export function SideEffectManager({ isOpen, onClose }: SideEffectManagerProps) {
  const scales = useCheckInScales();
  const treatments = useTreatments();
  const createScale = useCreateCheckInScale();
  const updateScale = useUpdateCheckInScale();
  const deleteScale = useDeleteCheckInScale();

  const [newName, setNewName] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setNewName('');
      setEditingKey(null);
      setEditingName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const installed = (scales.data ?? []).filter((scale) => scale.isSideEffect);
  const isPending = createScale.isPending || updateScale.isPending || deleteScale.isPending;
  const error = createScale.error || updateScale.error || deleteScale.error || scales.error;

  const nameOf = (key: string) =>
    treatments.data?.find((treatment) => treatment.key === key)?.name ?? null;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    await createScale.mutateAsync({
      name: newName.trim(),
      // Same shape as the suggested ones: named steps, optional, physical
      levelLabels: SIDE_EFFECT_LEVELS,
      isPositive: false,
      isCore: false,
      isSideEffect: true,
      track: 'BODY',
    });
    setNewName('');
  };

  const handleRename = async (key: string) => {
    if (!editingName.trim()) return;
    await updateScale.mutateAsync({ key, data: { name: editingName.trim() } });
    setEditingKey(null);
    setEditingName('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Effetti collaterali</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cosa tenere d'occhio, e sotto quale farmaco.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <SideEffectPicker />

          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="input flex-1"
              placeholder="Altro effetto, con parole tue"
              maxLength={60}
            />
            <button
              type="submit"
              className="btn btn-primary shrink-0"
              disabled={!newName.trim() || isPending}
            >
              {createScale.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span className="ml-1">Aggiungi</span>
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error instanceof Error ? error.message : 'Operazione non riuscita'}
            </p>
          )}

          {scales.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : installed.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              Nessun effetto collaterale seguito. Finché resta vuoto, nel diario non compare nulla.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {installed.map((scale) => (
                <div key={scale.key} className="p-3">
                  {editingKey === scale.key ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleRename(scale.key);
                          }
                        }}
                        className="input flex-1"
                        maxLength={60}
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(scale.key)}
                        disabled={!editingName.trim() || isPending}
                        className="p-2 rounded-lg bg-emerald-50 text-emerald-700"
                        aria-label="Salva nome"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            scale.isActive ? 'text-slate-800' : 'text-slate-400 line-through'
                          )}
                        >
                          {scale.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {scale.sourceTreatmentKeys
                            .map(nameOf)
                            .filter((name): name is string => name !== null)
                            .join(', ') || 'terapia in corso'}
                          {scale.isUsed ? ' · presente nello storico' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(scale.key);
                          setEditingName(scale.name);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label={`Modifica ${scale.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const warning = scale.isUsed
                            ? `"${scale.name}" è già stato segnalato in alcune giornate. Lo storico resta invariato. Toglierlo dall'elenco?`
                            : `Togliere "${scale.name}" dagli effetti seguiti?`;
                          if (window.confirm(warning)) deleteScale.mutate(scale.key);
                        }}
                        disabled={isPending}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label={`Elimina ${scale.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateScale.mutate({
                            key: scale.key,
                            data: { isActive: !scale.isActive },
                          })
                        }
                        disabled={isPending}
                        className={cn(
                          'relative w-10 h-6 rounded-full transition-colors shrink-0',
                          scale.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        )}
                        aria-label={scale.isActive ? `Disattiva ${scale.name}` : `Attiva ${scale.name}`}
                      >
                        <span
                          className={cn(
                            'absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform',
                            scale.isActive ? 'translate-x-4' : 'translate-x-0'
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
            Un effetto disattivato sparisce dal diario ma resta nelle giornate già registrate.
            Le proposte arrivano dal file di configurazione della terapia: si modificano lì, senza
            toccare l'app.
          </p>
        </div>
      </div>
    </div>
  );
}
