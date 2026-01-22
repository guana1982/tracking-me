import { useState, useRef, useEffect } from 'react';
import { formatCurrency, formatDate, getCategoryColor, cn } from '../lib/utils';
import type { ExpenseDTO, Category } from '@budget/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useUpdateExpense, useDeleteExpense } from '../hooks/useQueries';
import { QuickAddModal } from './QuickAddModal';

interface ExpensesListProps {
  expenses: ExpenseDTO[];
  periodKey: string;
  title: string;
  category: Category;
  emptyMessage?: string;
}

type EditingField = {
  id: string;
  field: 'label' | 'amount' | 'date';
  value: string;
};

export function ExpensesList({ expenses, periodKey, title, category, emptyMessage = 'Nessuna spesa registrata' }: ExpensesListProps) {
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateExpense = useUpdateExpense(periodKey);
  const deleteExpense = useDeleteExpense(periodKey);
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

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense.mutateAsync(id);
      setEditing(null);
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const colors = getCategoryColor(category);

  const headerContent = (
    <div className={cn('flex items-center justify-between px-4 py-2 -mx-4 -mt-4 mb-3 rounded-t-xl border-b', colors.bg, colors.border)}>
      <h3 className={cn('font-semibold', colors.text)}>{title}</h3>
      <button
        onClick={() => setIsAddModalOpen(true)}
        className={cn('p-1 rounded transition-colors', colors.text, 'hover:opacity-70')}
        title="Aggiungi spesa"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );

  if (expenses.length === 0) {
    return (
      <div className="card h-full border border-slate-200">
        {headerContent}
        <p className="text-slate-500 text-center py-8">
          {emptyMessage}
        </p>
        <QuickAddModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          periodKey={periodKey}
          defaultCategory={category}
        />
      </div>
    );
  }

  return (
    <div className="card flex flex-col max-h-[calc(100vh-340px)] border border-slate-200">
      {headerContent}
      <div className="flex-1 overflow-y-auto -mx-4 px-4 min-h-0">
        <div className="divide-y divide-slate-100">
          {expenses.map((expense) => {
            const isEditingThis = editing?.id === expense.id;

            return (
              <div
                key={expense.id}
                className="flex items-center gap-2 py-2 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
              >
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

                {isEditingThis && (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleDelete(expense.id);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors ml-1"
                    title="Elimina spesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <QuickAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        periodKey={periodKey}
        defaultCategory={category}
      />
    </div>
  );
}
