import { FormEvent, useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react';
import { cn, formatCurrency, getCategoryColor, getCategoryLabel } from '../lib/utils';
import {
  useApplyFixedExpenseTemplates,
  useCreateFixedExpenseTemplate,
  useDeleteFixedExpenseTemplate,
  useFixedExpenseTemplates,
  useUpdateFixedExpenseTemplate,
} from '../hooks/useQueries';
import type { FixedExpenseCategory, FixedExpenseTemplateDTO } from '@budget/shared';

interface FixedExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodKey: string;
  category: FixedExpenseCategory;
}

function parseAmountInput(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function FixedExpensesModal({ isOpen, onClose, periodKey, category }: FixedExpensesModalProps) {
  const { data: templates, isLoading } = useFixedExpenseTemplates(category);
  const createTemplate = useCreateFixedExpenseTemplate(periodKey);
  const updateTemplate = useUpdateFixedExpenseTemplate(periodKey);
  const deleteTemplate = useDeleteFixedExpenseTemplate(periodKey);
  const applyTemplates = useApplyFixedExpenseTemplates(periodKey);
  const colors = getCategoryColor(category);

  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingAmount, setEditingAmount] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setNewLabel('');
    setNewAmount('');
    setEditingId(null);
    setEditingLabel('');
    setEditingAmount('');
    setFeedbackMessage(null);
  }, [isOpen, category]);

  const isMutating =
    createTemplate.isPending ||
    updateTemplate.isPending ||
    deleteTemplate.isPending ||
    applyTemplates.isPending;

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const label = newLabel.trim();
    const amount = parseAmountInput(newAmount);
    if (!label || amount === null) return;

    try {
      await createTemplate.mutateAsync({ category, label, amount });
      setNewLabel('');
      setNewAmount('');
    } catch (error) {
      console.error('Failed to create fixed expense template:', error);
    }
  };

  const startEdit = (template: FixedExpenseTemplateDTO) => {
    setEditingId(template.id);
    setEditingLabel(template.label);
    setEditingAmount(template.amount.toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingLabel('');
    setEditingAmount('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const label = editingLabel.trim();
    const amount = parseAmountInput(editingAmount);
    if (!label || amount === null) return;

    try {
      await updateTemplate.mutateAsync({
        id: editingId,
        data: { label, amount },
      });
      cancelEdit();
    } catch (error) {
      console.error('Failed to update fixed expense template:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      if (editingId === id) {
        cancelEdit();
      }
    } catch (error) {
      console.error('Failed to delete fixed expense template:', error);
    }
  };

  const handleApplyAll = async () => {
    try {
      const result = await applyTemplates.mutateAsync({ category });
      if (result.createdCount > 0) {
        setFeedbackMessage(
          `${result.createdCount} ${result.createdCount === 1 ? 'spesa fissa aggiunta' : 'spese fisse aggiunte'} al mese`
        );
      } else {
        setFeedbackMessage('Nessuna nuova spesa da aggiungere (gia presente nel mese)');
      }
    } catch (error) {
      console.error('Failed to apply fixed expense templates:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Spese fisse ricorrenti</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Template {getCategoryLabel(category)} da riusare ogni mese.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Chiudi modale spese fisse"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <input
              type="text"
              className="input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Descrizione spesa fissa"
              required
            />
            <input
              type="text"
              inputMode="decimal"
              className="input sm:w-32"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0,00"
              required
            />
            <button
              type="submit"
              disabled={isMutating}
              className={cn('btn btn-secondary inline-flex items-center justify-center gap-1.5', colors.text)}
            >
              <Plus className="w-4 h-4" />
              Aggiungi
            </button>
          </form>

          {feedbackMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {feedbackMessage}
            </div>
          )}

          <div className="space-y-2">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Caricamento spese fisse...
              </div>
            )}

            {!isLoading && (templates?.length ?? 0) === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Nessun template salvato per questa categoria.
              </div>
            )}

            {templates?.map((template) => {
              const isEditing = editingId === template.id;
              return (
                <div
                  key={template.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        className="input py-1.5"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-800 truncate">{template.label}</p>
                    )}
                  </div>

                  <div className="w-28">
                    {isEditing ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input py-1.5 text-right"
                        value={editingAmount}
                        onChange={(e) => setEditingAmount(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-800 text-right">
                        {formatCurrency(template.amount)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Salva"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                          title="Annulla"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(template)}
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors"
                        title="Modifica"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(template.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Le spese qui salvate restano disponibili anche nei mesi successivi.
          </p>
          <button
            type="button"
            onClick={handleApplyAll}
            disabled={isMutating || isLoading || (templates?.length ?? 0) === 0}
            className={cn('btn btn-primary inline-flex items-center gap-2', colors.text)}
          >
            {applyTemplates.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
            Aggiungi tutte al mese
          </button>
        </div>
      </div>
    </div>
  );
}
