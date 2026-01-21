import { formatCurrency, formatDate, getCategoryColor, getCategoryLabel } from '../lib/utils';
import type { ExpenseDTO } from '@budget/shared';
import { ShoppingBag, Wallet, PiggyBank } from 'lucide-react';

interface RecentExpensesProps {
  expenses: ExpenseDTO[];
}

const categoryIcons = {
  NEEDS: ShoppingBag,
  WANTS: Wallet,
  SAVINGS: PiggyBank,
};

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold text-slate-900 mb-4">Spese recenti</h3>
        <p className="text-slate-500 text-center py-8">
          Nessuna spesa registrata questo mese
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-semibold text-slate-900 mb-4">Spese recenti</h3>
      <div className="space-y-3">
        {expenses.map((expense) => {
          const colors = getCategoryColor(expense.category);
          const Icon = categoryIcons[expense.category];

          return (
            <div
              key={expense.id}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <Icon className={`w-4 h-4 ${colors.text}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">
                  {expense.label}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(expense.date)} · {getCategoryLabel(expense.category)}
                </p>
              </div>

              <p className="font-semibold text-slate-900">
                {formatCurrency(expense.amount)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
