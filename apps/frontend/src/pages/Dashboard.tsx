import { usePeriodStore } from '../hooks/usePeriod';
import { useDashboard, useSavingsHistory, useReallocations } from '../hooks/useQueries';
import { CategoryCard } from '../components/CategoryCard';
import { BudgetChart } from '../components/BudgetChart';
import { ReallocationCard } from '../components/ReallocationCard';
import { ExpensesList } from '../components/RecentExpenses';
import { Loader2 } from 'lucide-react';

export function Dashboard() {
  const { periodKey } = usePeriodStore();
  const { data, isLoading, error } = useDashboard(periodKey);
  const { data: savingsHistory } = useSavingsHistory(periodKey);
  const { data: reallocations } = useReallocations(periodKey);

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
    <div className="sm:ml-16 space-y-4 md:h-full md:flex md:flex-col md:space-y-4">
      {/* Chart with Stats - Full width responsive */}
      <div className="flex-shrink-0">
        <BudgetChart categories={categories} totalIncome={totalIncome} compact showStats savingsHistory={savingsHistory} />
      </div>

      {/* Category Cards + Expense Lists - Aligned in columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:flex-1 md:min-h-0">
        {/* Necessità Column */}
        <div className="space-y-4 md:flex md:flex-col md:min-h-0">
          <div className="flex-shrink-0">
            <CategoryCard summary={categories.find((c) => c.category === 'NEEDS')!} />
          </div>
          <ExpensesList
            expenses={needsExpenses}
            periodKey={periodKey}
            title="Spese Necessarie"
            category="NEEDS"
            emptyMessage="Nessuna spesa necessaria"
          />
        </div>

        {/* Svago Column */}
        <div className="space-y-4 md:flex md:flex-col md:min-h-0">
          <div className="flex-shrink-0">
            <CategoryCard summary={categories.find((c) => c.category === 'WANTS')!} />
          </div>
          <ExpensesList
            expenses={wantsExpenses}
            periodKey={periodKey}
            title="Spese Svago"
            category="WANTS"
            emptyMessage="Nessuna spesa svago"
          />
        </div>

        {/* Risparmi Column */}
        <div className="space-y-4 md:flex md:flex-col md:min-h-0">
          <div className="flex-shrink-0">
            <CategoryCard summary={categories.find((c) => c.category === 'SAVINGS')!} />
          </div>
          <ExpensesList
            expenses={savingsExpenses}
            periodKey={periodKey}
            title="Risparmi"
            category="SAVINGS"
            emptyMessage="Nessun risparmio"
            reallocations={reallocations}
          />
        </div>
      </div>

      {/* Reallocation Card - hidden on desktop to prevent scroll */}
      <div className="md:hidden">
        <ReallocationCard periodKey={periodKey} />
      </div>
    </div>
  );
}
