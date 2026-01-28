import { usePeriodStore } from '../hooks/usePeriod';
import { useDashboard, useSavingsHistory } from '../hooks/useQueries';
import { CategoryCard } from '../components/CategoryCard';
import { BudgetChart } from '../components/BudgetChart';
import { ReallocationCard } from '../components/ReallocationCard';
import { ExpensesList } from '../components/RecentExpenses';
import { Loader2 } from 'lucide-react';

export function Dashboard() {
  const { periodKey } = usePeriodStore();
  const { data, isLoading, error } = useDashboard(periodKey);
  const { data: savingsHistory } = useSavingsHistory(periodKey);

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

  const { totalIncome, categories, recentExpenses } = data;

  // Filter expenses by category
  const needsExpenses = recentExpenses.filter((e) => e.category === 'NEEDS');
  const wantsExpenses = recentExpenses.filter((e) => e.category === 'WANTS');
  const savingsExpenses = recentExpenses.filter((e) => e.category === 'SAVINGS');

  return (
    <div className="sm:ml-16 space-y-6">
      {/* Chart with Stats - Full width responsive */}
      <BudgetChart categories={categories} totalIncome={totalIncome} compact showStats savingsHistory={savingsHistory} />

      {/* Category Cards + Expense Lists - Aligned in columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Necessità Column */}
        <div className="space-y-4">
          <CategoryCard summary={categories.find((c) => c.category === 'NEEDS')!} />
          <ExpensesList
            expenses={needsExpenses}
            periodKey={periodKey}
            title="Spese Necessarie"
            category="NEEDS"
            emptyMessage="Nessuna spesa necessaria"
          />
        </div>

        {/* Svago Column */}
        <div className="space-y-4">
          <CategoryCard summary={categories.find((c) => c.category === 'WANTS')!} />
          <ExpensesList
            expenses={wantsExpenses}
            periodKey={periodKey}
            title="Spese Svago"
            category="WANTS"
            emptyMessage="Nessuna spesa svago"
          />
        </div>

        {/* Risparmi Column */}
        <div className="space-y-4">
          <CategoryCard summary={categories.find((c) => c.category === 'SAVINGS')!} />
          <ExpensesList
            expenses={savingsExpenses}
            periodKey={periodKey}
            title="Risparmi"
            category="SAVINGS"
            emptyMessage="Nessun risparmio"
          />
        </div>
      </div>

      {/* Reallocation Card (if available) */}
      <ReallocationCard periodKey={periodKey} />
    </div>
  );
}
