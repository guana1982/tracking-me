import { cn, formatCurrency, getCategoryColor, getCategoryLabel } from '../lib/utils';
import type { CategorySummary } from '@budget/shared';
import { ShoppingBag, Wallet, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react';

interface CategoryCardProps {
  summary: CategorySummary;
}

const categoryIcons = {
  NEEDS: ShoppingBag,
  WANTS: Wallet,
  SAVINGS: PiggyBank,
};

export function CategoryCard({ summary }: CategoryCardProps) {
  const { category, targetAmount, actualAmount, remaining, percentage, status } = summary;
  const colors = getCategoryColor(category);
  const Icon = categoryIcons[category];
  const isOverBudget = remaining < 0;

  return (
    <div className={cn('card py-3', colors.bg, colors.border, 'border')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              status === 'ok' && 'bg-green-500',
              status === 'warning' && 'bg-yellow-500',
              status === 'danger' && 'bg-red-500'
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Stats & Remaining - Inline */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="text-slate-600">
            <span className="text-slate-400">Speso:</span> {formatCurrency(actualAmount)}
          </span>
          <span className="text-slate-600">
            <span className="text-slate-400">Budget:</span> {formatCurrency(targetAmount)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isOverBudget ? (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          )}
          <span
            className={cn(
              'font-bold',
              isOverBudget ? 'text-red-600' : 'text-green-600'
            )}
          >
            {formatCurrency(Math.abs(remaining))}
          </span>
        </div>
      </div>
    </div>
  );
}
