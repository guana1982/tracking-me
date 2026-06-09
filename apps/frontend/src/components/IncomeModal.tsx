import { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Pencil, Landmark } from 'lucide-react';
import { cn, formatCurrency, formatPeriodKey } from '../lib/utils';
import { useIncomes, useCreateIncome, useUpdateIncome, useDeleteIncome } from '../hooks/useQueries';
import type { IncomeDTO } from '@budget/shared';

interface IncomeModalProps {
  periodKey: string;
  isOpen: boolean;
  onClose: () => void;
}

interface EditingIncome {
  id: string;
  field: 'label' | 'amount';
  value: string;
}

export function IncomeModal({ periodKey, isOpen, onClose }: IncomeModalProps) {
  const { data: incomes, isLoading } = useIncomes(periodKey);
  const createIncome = useCreateIncome(periodKey);
  const updateIncome = useUpdateIncome(periodKey);
  const deleteIncome = useDeleteIncome(periodKey);

  const [editing, setEditing] = useState<EditingIncome | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const newLabelRef = useRef<HTMLInputElement>(null);

  // Reset transient state on open
  useEffect(() => {
    if (isOpen) {
      setEditing(null);
      setNewLabel('');
      setNewAmount('');
    }
  }, [isOpen]);

  // Focus input when editing
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing?.id, editing?.field]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editing, onClose]);

  if (!isOpen) return null;

  const totalIncome = incomes?.reduce((sum, i) => sum + i.amount, 0) || 0;

  const startEditing = (income: IncomeDTO, field: 'label' | 'amount') => {
    setEditing({
      id: income.id,
      field,
      value: field === 'amount' ? income.amount.toString() : income.label,
    });
  };

  const saveEditing = async () => {
    if (!editing) return;

    const income = incomes?.find((i) => i.id === editing.id);
    if (!income) return;

    if (editing.field === 'label') {
      if (editing.value.trim() === '' || editing.value.trim() === income.label) {
        setEditing(null);
        return;
      }
      await updateIncome.mutateAsync({ id: editing.id, data: { label: editing.value.trim() } });
    } else {
      const amount = parseFloat(editing.value.replace(',', '.'));
      if (isNaN(amount) || amount <= 0 || amount === income.amount) {
        setEditing(null);
        return;
      }
      await updateIncome.mutateAsync({ id: editing.id, data: { amount } });
    }
    setEditing(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteIncome.mutateAsync(id);
  };

  const handleAdd = async () => {
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!newLabel.trim() || isNaN(amount) || amount <= 0) return;

    await createIncome.mutateAsync({ label: newLabel.trim(), amount });
    setNewLabel('');
    setNewAmount('');
    newLabelRef.current?.focus();
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newLabel.trim() && newAmount) {
      handleAdd();
    }
  };

  const canAdd = newLabel.trim() !== '' && newAmount.trim() !== '' && !createIncome.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-50">
              <Landmark className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Entrate del mese</h2>
              <p className="text-xs text-slate-400 capitalize">{formatPeriodKey(periodKey)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Income list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-[120px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !incomes || incomes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              Nessuna entrata registrata: aggiungi la prima qui sotto.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incomes.map((income) => (
                <div
                  key={income.id}
                  className="flex items-center gap-3 py-3 group"
                >
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    {editing?.id === income.id && editing.field === 'label' ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editing.value}
                        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={handleEditKeyDown}
                        onBlur={saveEditing}
                        className="w-full text-sm font-medium text-slate-900 bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(income, 'label')}
                        className="flex items-center gap-1.5 max-w-full text-left text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                        title="Modifica descrizione"
                      >
                        <span className="truncate">{income.label}</span>
                        <Pencil className="w-3 h-3 flex-shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>

                  {/* Amount */}
                  {editing?.id === income.id && editing.field === 'amount' ? (
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="decimal"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={handleEditKeyDown}
                      onBlur={saveEditing}
                      className="w-28 text-sm font-semibold text-slate-900 bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditing(income, 'amount')}
                      className="text-sm font-semibold text-slate-900 hover:text-sky-600 transition-colors whitespace-nowrap"
                      title="Modifica importo"
                    >
                      {formatCurrency(income.amount)}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(income.id)}
                    disabled={deleteIncome.isPending}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Elimina entrata"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add income form - always visible */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <p className="text-xs font-medium text-slate-500 mb-2">Aggiungi entrata</p>
          <div className="flex items-center gap-2">
            <input
              ref={newLabelRef}
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Descrizione (es. Stipendio)"
              className="flex-1 min-w-0 text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
            <div className="relative w-28 flex-shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
              <input
                type="text"
                inputMode="decimal"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder="0,00"
                className="w-full text-sm bg-white border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                canAdd
                  ? 'bg-sky-600 text-white hover:bg-sky-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              )}
            >
              {createIncome.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Aggiungi
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white rounded-b-none sm:rounded-b-2xl">
          <span className="text-sm font-medium">Totale entrate</span>
          <span className="text-lg font-bold">{formatCurrency(totalIncome)}</span>
        </div>
      </div>
    </div>
  );
}
