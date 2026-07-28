import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useCheckInScales,
  useCreateCheckInScale,
  useDeleteCheckInScale,
  useInstallDefaultScales,
  useUpdateCheckInScale,
} from '../../hooks/useTherapyQueries';
import type { CheckInScaleDTO } from '@budget/shared';

interface CheckInScaleManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  lowLabel: string;
  highLabel: string;
  levelLabels: string;
  isPositive: boolean;
  isCore: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  lowLabel: '',
  highLabel: '',
  levelLabels: '',
  isPositive: false,
  isCore: true,
};

function parseLevels(raw: string): string[] {
  return raw
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

/**
 * The scales are the part of the check-in most likely to change: what is
 * worth measuring today is not what will be worth measuring in six months.
 * Everything about them is editable, including how many there are.
 */
export function CheckInScaleManager({ isOpen, onClose }: CheckInScaleManagerProps) {
  const scales = useCheckInScales();
  const installDefaults = useInstallDefaultScales();
  const createScale = useCreateCheckInScale();
  const updateScale = useUpdateCheckInScale();
  const deleteScale = useDeleteCheckInScale();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForm(EMPTY_FORM);
      setEditingKey(null);
      setIsFormOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const error =
    createScale.error ||
    updateScale.error ||
    deleteScale.error ||
    installDefaults.error ||
    scales.error;
  const isPending =
    createScale.isPending ||
    updateScale.isPending ||
    deleteScale.isPending ||
    installDefaults.isPending;

  const startEdit = (scale: CheckInScaleDTO) => {
    setEditingKey(scale.key);
    setForm({
      name: scale.name,
      lowLabel: scale.lowLabel,
      highLabel: scale.highLabel,
      levelLabels: scale.levelLabels.join(', '),
      isPositive: scale.isPositive,
      isCore: scale.isCore,
    });
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingKey(null);
    setIsFormOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || isPending) return;
    const payload = {
      name: form.name.trim(),
      lowLabel: form.lowLabel.trim(),
      highLabel: form.highLabel.trim(),
      levelLabels: parseLevels(form.levelLabels),
      isPositive: form.isPositive,
      isCore: form.isCore,
    };
    if (editingKey) {
      await updateScale.mutateAsync({ key: editingKey, data: payload });
    } else {
      await createScale.mutateAsync(payload);
    }
    resetForm();
  };

  const handleDelete = (scale: CheckInScaleDTO) => {
    const warning = scale.isUsed
      ? `"${scale.name}" è già stata compilata in alcune giornate. I check-in passati restano invariati. Eliminarla dall'elenco?`
      : `Eliminare la scala "${scale.name}"?`;
    if (window.confirm(warning)) {
      deleteScale.mutate(scale.key);
      if (editingKey === scale.key) resetForm();
    }
  };

  const isEmpty = !scales.isLoading && (scales.data?.length ?? 0) === 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Scale del check-in</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Quante ne vuoi, con le etichette che vuoi.
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
          {isEmpty && (
            <button
              type="button"
              onClick={() => installDefaults.mutate()}
              disabled={isPending}
              className="w-full btn btn-secondary text-sm"
            >
              {installDefaults.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1.5" />
              )}
              Parti dal set suggerito
            </button>
          )}

          {!isFormOpen && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="btn btn-primary w-full text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi una scala
            </button>
          )}

          {isFormOpen && (
            <form
              onSubmit={handleSubmit}
              className="space-y-3 border border-slate-200 rounded-xl p-3 bg-slate-50"
            >
              <div>
                <label className="label">Nome</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="input"
                  placeholder="Es. Tensione"
                  maxLength={60}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estremo basso</label>
                  <input
                    value={form.lowLabel}
                    onChange={(event) => setForm({ ...form, lowLabel: event.target.value })}
                    className="input"
                    placeholder="Es. calmo"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="label">Estremo alto</label>
                  <input
                    value={form.highLabel}
                    onChange={(event) => setForm({ ...form, highLabel: event.target.value })}
                    className="input"
                    placeholder="Es. agitazione costante"
                    maxLength={80}
                  />
                </div>
              </div>

              <div>
                <label className="label">Livelli con nome (facoltativo)</label>
                <input
                  value={form.levelLabels}
                  onChange={(event) => setForm({ ...form, levelLabels: event.target.value })}
                  className="input"
                  placeholder="Es. nessuna, poche, molte, continue"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Separati da virgola: al posto del cursore 0–10 compaiono questi passi.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isPositive}
                  onChange={(event) => setForm({ ...form, isPositive: event.target.checked })}
                  className="rounded border-slate-300"
                />
                Alto = meglio (scala positiva)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isCore}
                  onChange={(event) => setForm({ ...form, isCore: event.target.checked })}
                  className="rounded border-slate-300"
                />
                Sempre visibile nel check-in
              </label>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!form.name.trim() || isPending}
                  className="btn btn-primary flex-1"
                >
                  {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {editingKey ? 'Salva modifiche' : 'Aggiungi'}
                </button>
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Annulla
                </button>
              </div>
            </form>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error instanceof Error ? error.message : 'Operazione non riuscita'}
            </p>
          )}

          {scales.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            (scales.data?.length ?? 0) > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {scales.data?.map((scale) => (
                  <div key={scale.key} className="p-3 flex items-center gap-2">
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
                        {scale.levelLabels.length > 0
                          ? scale.levelLabels.join(' · ')
                          : `0 ${scale.lowLabel ? `(${scale.lowLabel})` : ''} → ${scale.maxValue} ${
                              scale.highLabel ? `(${scale.highLabel})` : ''
                            }`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {scale.isPositive ? 'alto = meglio' : 'alto = sintomo più forte'}
                        {scale.isCore ? ' · sempre visibile' : ' · facoltativa'}
                        {scale.isUsed ? ' · presente nello storico' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(scale)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                      aria-label={`Modifica ${scale.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(scale)}
                      disabled={isPending}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Elimina ${scale.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateScale.mutate({ key: scale.key, data: { isActive: !scale.isActive } })
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
                ))}
              </div>
            )
          )}

          <p className="text-xs text-slate-500">
            Per non leggere mai una curva al contrario, conviene che ogni scala misuri
            l'intensità di un sintomo: 0 = assente, massimo = al peggio. Se una scala funziona
            all'opposto, segnala come positiva.
          </p>
        </div>
      </div>
    </div>
  );
}
