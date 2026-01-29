import { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useIncomes, useCreateIncome, useUpdateIncome, useDeleteIncome } from '../hooks/useQueries';
import type { IncomeDTO } from '@budget/shared';

interface IncomePopoverProps {
  periodKey: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

interface EditingIncome {
  id: string;
  field: 'label' | 'amount';
  value: string;
}

export function IncomePopover({ periodKey, isOpen, onClose, anchorRef }: IncomePopoverProps) {
  const { data: incomes, isLoading } = useIncomes(periodKey);
  const createIncome = useCreateIncome(periodKey);
  const updateIncome = useUpdateIncome(periodKey);
  const deleteIncome = useDeleteIncome(periodKey);

  const [editing, setEditing] = useState<EditingIncome | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Focus input when editing
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(null);
        } else if (isAdding) {
          setIsAdding(false);
          setNewLabel('');
          setNewAmount('');
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editing, isAdding, onClose]);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    setIsAdding(false);
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newLabel.trim() && newAmount) {
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewLabel('');
      setNewAmount('');
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
      style={{ left: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900 text-sm">Entrate del mese</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : incomes?.length === 0 && !isAdding ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            Nessuna entrata registrata
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incomes?.map((income) => (
              <div
                key={income.id}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 group"
              >
                {/* Label */}
                <div className="flex-1 min-w-0">
                  {editing?.id === income.id && editing.field === 'label' ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEditing}
                      className="w-full text-sm font-medium text-slate-900 bg-white border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <p
                      className="text-sm font-medium text-slate-700 truncate cursor-pointer hover:text-slate-900 transition-colors"
                      onClick={() => startEditing(income, 'label')}
                      title="Clicca per modificare"
                    >
                      {income.label}
                    </p>
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
                    onKeyDown={handleKeyDown}
                    onBlur={saveEditing}
                    className="w-24 text-sm font-semibold text-slate-900 bg-white border border-blue-300 rounded px-2 py-0.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                ) : (
                  <p
                    className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => startEditing(income, 'amount')}
                    title="Clicca per modificare"
                  >
                    {formatCurrency(income.amount)}
                  </p>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(income.id)}
                  disabled={deleteIncome.isPending}
                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                  title="Elimina"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Add new income form */}
            {isAdding && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={handleAddKeyDown}
                  placeholder="Descrizione"
                  className="flex-1 text-sm bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  autoFocus
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  onKeyDown={handleAddKeyDown}
                  placeholder="Importo"
                  className="w-20 text-sm bg-white border border-slate-300 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newLabel.trim() || !newAmount || createIncome.isPending}
                  className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createIncome.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200">
        {/* Add button */}
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Aggiungi entrata
          </button>
        )}

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
          <span className="text-sm font-medium">Totale</span>
          <span className="text-base font-bold">{formatCurrency(totalIncome)}</span>
        </div>
      </div>
    </div>
  );
}
