import { useState } from 'react';
import { usePeriodStore } from '../hooks/usePeriod';
import { useExpenses, useDeleteExpense } from '../hooks/useQueries';
import {
  formatCurrency,
  formatDate,
  getCategoryColor,
  getCategoryLabel,
  cn,
} from '../lib/utils';
import type { Category, ExpenseFilters } from '@budget/shared';
import {
  Loader2,
  Search,
  Trash2,
  ShoppingBag,
  Wallet,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const categoryIcons = {
  NEEDS: ShoppingBag,
  WANTS: Wallet,
  SAVINGS: PiggyBank,
};

const categories: (Category | undefined)[] = [undefined, 'NEEDS', 'WANTS', 'SAVINGS'];

export function Expenses() {
  const { periodKey } = usePeriodStore();
  const [filters, setFilters] = useState<ExpenseFilters>({
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading } = useExpenses(periodKey, filters);
  const deleteExpense = useDeleteExpense(periodKey);

  const handleCategoryFilter = (category: Category | undefined) => {
    setFilters((prev) => ({ ...prev, category, page: 1 }));
  };

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
      try {
        await deleteExpense.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete expense:', error);
      }
    }
  };

  return (
    <div className="space-y-6 sm:ml-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Spese</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca spese..."
            className="input pl-10 w-full sm:w-64"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat || 'all'}
            onClick={() => handleCategoryFilter(cat)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              filters.category === cat
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            {cat ? getCategoryLabel(cat) : 'Tutte'}
          </button>
        ))}
      </div>

      {/* Expenses List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">Nessuna spesa trovata</p>
        </div>
      ) : (
        <>
          <div className="card divide-y divide-slate-100">
            {data.items.map((expense) => {
              const colors = getCategoryColor(expense.category);
              const Icon = categoryIcons[expense.category];

              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className={cn('p-2 rounded-lg', colors.bg)}>
                    <Icon className={cn('w-5 h-5', colors.text)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {expense.label}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{formatDate(expense.date)}</span>
                      <span>·</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          colors.bg,
                          colors.text
                        )}
                      >
                        {getCategoryLabel(expense.category)}
                      </span>
                    </div>
                    {expense.notes && (
                      <p className="text-sm text-slate-500 mt-1 truncate">
                        {expense.notes}
                      </p>
                    )}
                  </div>

                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(expense.amount)}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deleteExpense.isPending}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Pagina {data.page} di {data.totalPages} ({data.total} spese)
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page <= 1}
                  className="btn btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page >= data.totalPages}
                  className="btn btn-secondary p-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
