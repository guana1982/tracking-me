import { cn, formatCurrency, getCategoryColor, getCategoryLabel, getStatusColor } from '../lib/utils';
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
    <div className={cn('card', colors.bg, colors.border, 'border')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn('p-2 rounded-lg', colors.bg)}>
            <Icon className={cn('w-5 h-5', colors.text)} />
          </div>
          <h3 className={cn('font-semibold', colors.text)}>
            {getCategoryLabel(category)}
          </h3>
        </div>
        <div
          className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            status === 'ok' && 'bg-green-100 text-green-700',
            status === 'warning' && 'bg-yellow-100 text-yellow-700',
            status === 'danger' && 'bg-red-100 text-red-700'
          )}
        >
          {percentage.toFixed(0)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">Speso</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatCurrency(actualAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Budget</p>
          <p className="text-lg font-semibold text-slate-700">
            {formatCurrency(targetAmount)}
          </p>
        </div>
      </div>

      {/* Remaining */}
      <div className={cn('mt-4 pt-4 border-t', colors.border)}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {isOverBudget ? 'Sforato di' : 'Disponibile'}
          </span>
          <div className="flex items-center gap-1">
            {isOverBudget ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <TrendingUp className="w-4 h-4 text-green-500" />
            )}
            <span
              className={cn(
                'text-lg font-bold',
                isOverBudget ? 'text-red-600' : 'text-green-600'
              )}
            >
              {formatCurrency(Math.abs(remaining))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
