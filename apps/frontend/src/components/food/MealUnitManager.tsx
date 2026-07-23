import { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, X } from 'lucide-react';
import {
  useCreateMealUnit,
  useMealUnits,
  useUpdateMealUnit,
} from '../../hooks/useFoodQueries';

interface MealUnitManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (key: string) => void;
}

export function MealUnitManager({ isOpen, onClose, onCreated }: MealUnitManagerProps) {
  const mealUnits = useMealUnits();
  const createMealUnit = useCreateMealUnit();
  const updateMealUnit = useUpdateMealUnit();
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

  const error = createMealUnit.error || updateMealUnit.error || mealUnits.error;
  const isPending = createMealUnit.isPending || updateMealUnit.isPending;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await createMealUnit.mutateAsync({ name: newName.trim() });
    setNewName('');
    onCreated?.(created.key);
  };

  const handleRename = async (key: string) => {
    if (!editingName.trim()) return;
    await updateMealUnit.mutateAsync({ key, data: { name: editingName.trim() } });
    setEditingKey(null);
    setEditingName('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h3 className="font-semibold text-slate-900">Gestisci unità</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalizza le unità disponibili per gli alimenti.
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
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className="input flex-1"
              placeholder="Es. fetta"
              maxLength={24}
            />
            <button
              type="submit"
              className="btn btn-primary shrink-0"
              disabled={!newName.trim() || isPending}
            >
              {createMealUnit.isPending ? (
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

          {mealUnits.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {mealUnits.data?.map((unit) => (
                <div key={unit.key} className="p-3">
                  {editingKey === unit.key ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="input flex-1"
                        maxLength={24}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleRename(unit.key);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(unit.key)}
                        className="p-2 rounded-lg bg-emerald-50 text-emerald-700"
                        disabled={!editingName.trim() || isPending}
                        aria-label="Salva nome"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{unit.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {unit.isDefault ? 'Unità predefinita' : 'Unità personalizzata'}
                          {unit.isUsed ? ' · presente nello storico' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(unit.key);
                          setEditingName(unit.name);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                        aria-label={`Rinomina ${unit.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateMealUnit.mutate({
                            key: unit.key,
                            data: { isActive: !unit.isActive },
                          })
                        }
                        disabled={isPending}
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          unit.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        aria-label={unit.isActive ? `Disattiva ${unit.name}` : `Attiva ${unit.name}`}
                      >
                        <span
                          className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            unit.isActive ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Le unità disattivate restano nello storico, ma non vengono proposte nei nuovi alimenti.
          </p>
        </div>
      </div>
    </div>
  );
}
