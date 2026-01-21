import { usePeriodStore } from '../hooks/usePeriod';
import { useDashboard } from '../hooks/useQueries';
import { CategoryCard } from '../components/CategoryCard';
import { BudgetChart } from '../components/BudgetChart';
import { ReallocationCard } from '../components/ReallocationCard';
import { RecentExpenses } from '../components/RecentExpenses';
import { formatCurrency } from '../lib/utils';
import { Loader2, TrendingUp, Wallet, PiggyBank } from 'lucide-react';

export function Dashboard() {
  const { periodKey } = usePeriodStore();
  const { data, isLoading, error } = useDashboard(periodKey);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-red-600 mb-2">Errore nel caricamento dei dati</p>
        <p className="text-slate-500 text-sm">
          Assicurati che il backend sia in esecuzione
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { totalIncome, totalSpent, categories, recentExpenses, budgetRule } = data;
  const remaining = totalIncome - totalSpent;

  // Default budget rule if not set
  const displayRule = budgetRule || { needsPct: 65, wantsPct: 25, savingsPct: 10 };

  return (
    <div className="space-y-6 sm:ml-16">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-sm">Entrate</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Speso</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(totalSpent)}
          </p>
        </div>

        <div className="card col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <PiggyBank className="w-4 h-4" />
            <span className="text-sm">Rimanente</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              remaining >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(remaining)}
          </p>
        </div>

        <div className="card hidden sm:block">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <span className="text-sm">Regola budget</span>
          </div>
          <p className="text-xl font-bold text-slate-900">
            {displayRule.needsPct}/{displayRule.wantsPct}/{displayRule.savingsPct}
          </p>
        </div>
      </div>

      {/* Reallocation Card (if available) */}
      <ReallocationCard periodKey={periodKey} />

      {/* Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {categories.map((category) => (
          <CategoryCard key={category.category} summary={category} />
        ))}
      </div>

      {/* Charts & Recent Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative">
          <BudgetChart categories={categories} totalIncome={totalIncome} />
        </div>
        <RecentExpenses expenses={recentExpenses} />
      </div>
    </div>
  );
}
