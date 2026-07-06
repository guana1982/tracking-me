import { cn, formatCurrency, getCategoryColor, getCategoryLabel } from '../lib/utils';
import type { CategorySummary } from '@budget/shared';
import { ShoppingBag, Wallet, PiggyBank, Loader2 } from 'lucide-react';

interface CategoryCardProps {
  summary: CategorySummary;
  // When set, renders a button that moves the category's leftover to SAVINGS
  reallocation?: {
    amount: number;
    onMove: () => void;
    isPending: boolean;
  };
}

const categoryIcons = {
  NEEDS: ShoppingBag,
  WANTS: Wallet,
  SAVINGS: PiggyBank,
};

export function CategoryCard({ summary, reallocation }: CategoryCardProps) {
  const { category, targetAmount, actualAmount, remaining, percentage, status } = summary;
  const colors = getCategoryColor(category);
  const Icon = categoryIcons[category];
  const isOverBudget = remaining < 0;

  return (
    <div className={cn('card py-3 shadow-sm', colors.bg, colors.border, 'border')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', colors.bg)}>
            <Icon className={cn('w-4 h-4', colors.text)} />
          </div>
          <h3 className={cn('font-semibold text-sm', colors.text)}>
            {getCategoryLabel(category)}
          </h3>
        </div>
        <div
          className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            status === 'ok' && 'bg-green-100 text-green-700',
            status === 'warning' && 'bg-yellow-100 text-yellow-700',
            status === 'danger' && 'bg-red-100 text-red-700'
          )}
        >
          {percentage.toFixed(0)}%
        </div>
      </div>

      {/* Progress Bar - thicker with percentage label */}
      <div className="mb-3">
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              status === 'ok' && 'bg-gradient-to-r from-green-400 to-green-500',
              status === 'warning' && 'bg-gradient-to-r from-yellow-400 to-yellow-500',
              status === 'danger' && 'bg-gradient-to-r from-red-400 to-red-500'
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Speso</span>
            <p className="font-semibold text-slate-700">{formatCurrency(actualAmount)}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Budget</span>
            <p className="font-medium text-slate-600">{formatCurrency(targetAmount)}</p>
          </div>
        </div>

        {/* Remaining badge */}
        <div
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-bold',
            isOverBudget
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          )}
        >
          {isOverBudget ? '-' : '+'}{formatCurrency(Math.abs(remaining))}
        </div>
      </div>

      {/* Move leftover to SAVINGS */}
      {reallocation && (
        <button
          onClick={reallocation.onMove}
          disabled={reallocation.isPending}
          title="Crea una riallocazione verso i Risparmi: il bonifico reale resta a carico tuo"
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 py-1.5 px-3 text-xs font-semibold text-white hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reallocation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PiggyBank className="w-3.5 h-3.5" />
          )}
          Sposta {formatCurrency(reallocation.amount)} nei Risparmi
        </button>
      )}
    </div>
  );
}
