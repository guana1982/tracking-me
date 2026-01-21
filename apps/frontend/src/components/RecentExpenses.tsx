import { useState, useRef, useEffect } from 'react';
import { formatCurrency, formatDate, getCategoryColor } from '../lib/utils';
import type { ExpenseDTO } from '@budget/shared';
import { ShoppingBag, Wallet, PiggyBank } from 'lucide-react';
import { useUpdateExpense } from '../hooks/useQueries';

interface RecentExpensesProps {
  expenses: ExpenseDTO[];
  periodKey: string;
}

const categoryIcons = {
  NEEDS: ShoppingBag,
  WANTS: Wallet,
  SAVINGS: PiggyBank,
};

type EditingField = {
  id: string;
  field: 'label' | 'amount' | 'date';
  value: string;
};

export function RecentExpenses({ expenses, periodKey }: RecentExpensesProps) {
  const [editing, setEditing] = useState<EditingField | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateExpense = useUpdateExpense(periodKey);
  const editingIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Solo focus quando si inizia un nuovo editing (id cambia)
    if (editing && editing.id !== editingIdRef.current && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      editingIdRef.current = editing.id;
    }
    if (!editing) {
      editingIdRef.current = null;
    }
  }, [editing?.id, editing?.field]);

  const startEditing = (expense: ExpenseDTO, field: 'label' | 'amount' | 'date') => {
    let value: string;
    if (field === 'amount') {
      value = expense.amount.toString();
    } else if (field === 'date') {
      value = expense.date.split('T')[0];
    } else {
      value = expense.label;
    }
    editingIdRef.current = null; // Reset per triggerare il focus
    setEditing({ id: expense.id, field, value });
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const saveEditing = async () => {
    if (!editing) return;

    const expense = expenses.find((e) => e.id === editing.id);
    if (!expense) return;

    let updateData: Record<string, unknown> = {};

    if (editing.field === 'label') {
      if (editing.value.trim() === '') return;
      updateData = { label: editing.value.trim() };
    } else if (editing.field === 'amount') {
      const amount = parseFloat(editing.value);
      if (isNaN(amount) || amount <= 0) return;
      updateData = { amount };
    } else if (editing.field === 'date') {
      if (!editing.value) return;
      updateData = { date: editing.value };
    }

    try {
      await updateExpense.mutateAsync({ id: editing.id, data: updateData });
      setEditing(null);
    } catch (error) {
      console.error('Failed to update expense:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="card h-full">
        <h3 className="font-semibold text-slate-900 mb-4">Spese recenti</h3>
        <p className="text-slate-500 text-center py-8">
          Nessuna spesa registrata questo mese
        </p>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      <h3 className="font-semibold text-slate-900 mb-3">Spese recenti</h3>
      <div className="flex-1 overflow-y-auto -mx-4 px-4" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        <div className="divide-y divide-slate-100">
          {expenses.map((expense) => {
            const colors = getCategoryColor(expense.category);
            const Icon = categoryIcons[expense.category];
            const isEditingThis = editing?.id === expense.id;

            return (
              <div
                key={expense.id}
                className="flex items-center gap-2 py-2 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
              >
                <div className={`p-1.5 rounded ${colors.bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                </div>

                <div className="flex-1 min-w-0">
                  {isEditingThis && editing.field === 'label' ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editing.value}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditing((prev) => prev ? { ...prev, value: newValue } : null);
                      }}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEditing}
                      className="text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  ) : (
                    <p
                      className="text-sm font-medium text-slate-900 truncate leading-tight cursor-pointer hover:text-slate-600"
                      onClick={() => startEditing(expense, 'label')}
                      title="Clicca per modificare"
                    >
                      {expense.label}
                    </p>
                  )}

                  {isEditingThis && editing.field === 'date' ? (
                    <input
                      ref={inputRef}
                      type="date"
                      value={editing.value}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setEditing((prev) => prev ? { ...prev, value: newValue } : null);
                      }}
                      onKeyDown={handleKeyDown}
                      onBlur={saveEditing}
                      className="text-xs text-slate-400 bg-white border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
                    />
                  ) : (
                    <p
                      className="text-xs text-slate-400 leading-tight cursor-pointer hover:text-slate-600"
                      onClick={() => startEditing(expense, 'date')}
                      title="Clicca per modificare"
                    >
                      {formatDate(expense.date)}
                    </p>
                  )}
                </div>

                {isEditingThis && editing.field === 'amount' ? (
                  <input
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editing.value}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setEditing((prev) => prev ? { ...prev, value: newValue } : null);
                    }}
                    onKeyDown={handleKeyDown}
                    onBlur={saveEditing}
                    className="text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded px-1 py-0.5 w-20 text-right focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                ) : (
                  <p
                    className="text-sm font-semibold text-slate-900 whitespace-nowrap cursor-pointer hover:text-slate-600"
                    onClick={() => startEditing(expense, 'amount')}
                    title="Clicca per modificare"
                  >
                    {formatCurrency(expense.amount)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
