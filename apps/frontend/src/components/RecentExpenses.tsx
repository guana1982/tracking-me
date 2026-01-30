import { useState, useRef, useEffect } from 'react';
import { formatCurrency, formatDate, getCategoryColor, cn } from '../lib/utils';
import type { ExpenseDTO, Category, ReallocationDTO } from '@budget/shared';
import { Plus, Trash2, Receipt, RefreshCw, Lock } from 'lucide-react';
import { useUpdateExpense, useDeleteExpense } from '../hooks/useQueries';
import { QuickAddModal } from './QuickAddModal';

interface ExpensesListProps {
  expenses: ExpenseDTO[];
  periodKey: string;
  title: string;
  category: Category;
  emptyMessage?: string;
  reallocations?: ReallocationDTO[];
  isClosed?: boolean;
}

type EditingField = {
  id: string;
  field: 'label' | 'amount' | 'date';
  value: string;
};

export function ExpensesList({ expenses, periodKey, title, category, emptyMessage = 'Nessuna spesa registrata', reallocations = [], isClosed = false }: ExpensesListProps) {
  const [editing, setEditing] = useState<EditingField | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateExpense = useUpdateExpense(periodKey);
  const deleteExpense = useDeleteExpense(periodKey);
  const editingIdRef = useRef<string | null>(null);

  useEffect(() => {
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
    if (isClosed) return; // Don't allow editing when month is closed

    let value: string;
    if (field === 'amount') {
      value = expense.amount.toString();
    } else if (field === 'date') {
      value = expense.date.split('T')[0];
    } else {
      value = expense.label;
    }
    editingIdRef.current = null;
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

  // Filter reallocations that go TO this category (for SAVINGS)
  const savingsReallocations = reallocations.filter(r => r.toCategory === category);

  // Calculate totals including reallocations
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const reallocationsTotal = savingsReallocations.reduce((sum, r) => sum + r.amount, 0);
  const grandTotal = expensesTotal + reallocationsTotal;
  const totalItems = expenses.length + savingsReallocations.length;

  const headerContent = (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 -mx-5 -mt-5 mb-3 rounded-t-2xl flex-shrink-0',
      'bg-gradient-to-r',
      category === 'NEEDS' && 'from-emerald-50 to-emerald-100/50 border-b border-emerald-200',
      category === 'WANTS' && 'from-amber-50 to-amber-100/50 border-b border-amber-200',
      category === 'SAVINGS' && 'from-sky-50 to-sky-100/50 border-b border-sky-200'
    )}>
      <div className="flex items-center gap-2">
        <h3 className={cn('font-semibold', colors.text)}>{title}</h3>
        {isClosed && (
          <Lock className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>
      {!isClosed && (
        <button
          onClick={() => setIsAddModalOpen(true)}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            'bg-white/80 shadow-sm hover:shadow',
            colors.text,
            'hover:scale-105 active:scale-95'
          )}
          title="Aggiungi spesa"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  if (expenses.length === 0 && savingsReallocations.length === 0) {
    return (
      <div className={cn(
        "card border border-slate-200 shadow-sm md:flex-1 md:min-h-0 md:flex md:flex-col",
        isClosed && "opacity-75"
      )}>
        {headerContent}
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className={cn('p-3 rounded-full mb-3', colors.bg)}>
            <Receipt className={cn('w-6 h-6', colors.text, 'opacity-60')} />
          </div>
          <p className="text-slate-400 text-sm">
            {emptyMessage}
          </p>
          {!isClosed && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className={cn(
                'mt-3 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
                colors.text,
                colors.bg,
                'hover:opacity-80'
              )}
            >
              Aggiungi la prima
            </button>
          )}
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

  return (
    <div className={cn(
      "card flex flex-col max-h-[60vh] md:max-h-none md:flex-1 md:min-h-0 border border-slate-200 shadow-sm",
      isClosed && "opacity-75"
    )}>
      {headerContent}
      <div className="flex-1 overflow-y-auto -mx-4 px-4 min-h-0">
        <div className="space-y-0">
          {/* Reallocations - special sky entries */}
          {savingsReallocations.map((reallocation) => (
            <div
              key={`realloc-${reallocation.id}`}
              className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-xl bg-sky-50 border border-sky-200"
            >
              <div className="p-1.5 rounded-lg bg-sky-100">
                <RefreshCw className="w-4 h-4 text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sky-700 truncate leading-tight">
                  {reallocation.reason || 'Riallocazione automatica'}
                </p>
                <p className="text-xs text-sky-500 leading-tight mt-0.5">
                  {formatDate(reallocation.executedAt)}
                </p>
              </div>
              <p className="text-sm font-bold text-sky-700 whitespace-nowrap">
                {formatCurrency(reallocation.amount)}
              </p>
            </div>
          ))}

          {/* Regular expenses */}
          {expenses.map((expense, index) => {
            const isEditingThis = editing?.id === expense.id;
            // Account for reallocations when determining alternating row colors
            const adjustedIndex = index + savingsReallocations.length;
            const isEven = adjustedIndex % 2 === 0;

            return (
              <div
                key={expense.id}
                className={cn(
                  'flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-xl transition-all',
                  isEven ? 'bg-slate-50/50' : 'bg-white',
                  'hover:bg-slate-100/80',
                  isEditingThis && 'bg-sky-50/50 ring-1 ring-sky-200'
                )}
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
                      className="text-sm font-medium text-slate-900 bg-white border border-sky-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium text-slate-800 truncate leading-tight transition-colors',
                          !isClosed && 'cursor-pointer hover:text-slate-600'
                        )}
                        onClick={() => startEditing(expense, 'label')}
                        title={isClosed ? undefined : 'Clicca per modificare'}
                      >
                        {expense.label}
                      </p>
                      {expense.isFixed && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700 rounded">
                          Fisso
                        </span>
                      )}
                      {expense.tricountType && (
                        <span className={cn(
                          "flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded",
                          expense.tricountType === 'IO'
                            ? "bg-blue-100 text-blue-700"
                            : "bg-pink-100 text-pink-700"
                        )}>
                          {expense.tricountType === 'IO' ? 'Io' : 'Fra'}
                        </span>
                      )}
                    </div>
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
                      className="text-xs text-slate-500 bg-white border border-sky-300 rounded-lg px-2 py-0.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                  ) : (
                    <p
                      className={cn(
                        'text-xs text-slate-400 leading-tight transition-colors mt-0.5',
                        !isClosed && 'cursor-pointer hover:text-slate-500'
                      )}
                      onClick={() => startEditing(expense, 'date')}
                      title={isClosed ? undefined : 'Clicca per modificare'}
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
                    className="text-sm font-bold text-slate-900 bg-white border border-sky-300 rounded-lg px-2 py-1 w-24 text-right focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                ) : (
                  <p
                    className={cn(
                      'text-sm font-bold whitespace-nowrap transition-colors text-slate-800',
                      !isClosed && 'cursor-pointer hover:text-slate-600'
                    )}
                    onClick={() => startEditing(expense, 'amount')}
                    title={isClosed ? undefined : 'Clicca per modificare'}
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
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all ml-1"
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

      {/* Footer with total */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2.5 -mx-5 -mb-5 mt-3 rounded-b-2xl border-t flex-shrink-0',
        colors.bg,
        colors.border
      )}>
        <span className="text-xs font-medium text-slate-500">
          {totalItems} {totalItems === 1 ? 'voce' : 'voci'}
        </span>
        <span className={cn('text-sm font-bold', colors.text)}>
          {formatCurrency(grandTotal)}
        </span>
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
