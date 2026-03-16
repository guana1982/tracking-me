import { usePeriodStore } from '../hooks/usePeriod';
import { useDashboard, useSavingsHistory, useReallocations, useReallocationPreview, useCreateReallocation, useDeleteReallocation, usePeriod, useCloseMonth, useReopenMonth } from '../hooks/useQueries';
import { CategoryCard } from '../components/CategoryCard';
import { BudgetChart } from '../components/BudgetChart';
import { ExpensesList } from '../components/RecentExpenses';
import { Loader2, RefreshCw, Undo2, Lock, Unlock } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export function Dashboard() {
  const { periodKey } = usePeriodStore();
  const { data, isLoading, error } = useDashboard(periodKey);
  const { data: savingsHistory } = useSavingsHistory(periodKey);
  const { data: reallocations } = useReallocations(periodKey);
  const { data: reallocationPreview } = useReallocationPreview(periodKey);
  const { data: monthPeriod } = usePeriod(periodKey);
  const createReallocation = useCreateReallocation(periodKey);
  const deleteReallocation = useDeleteReallocation(periodKey);
  const closeMonth = useCloseMonth(periodKey);
  const reopenMonth = useReopenMonth(periodKey);

  // Check if the month is closed
  const isClosed = monthPeriod?.isClosed ?? false;

  // Check if reallocations exist for current period (one for NEEDS, one for WANTS)
  const needsReallocation = reallocations?.find(r => r.fromCategory === 'NEEDS' && r.toCategory === 'SAVINGS');
  const wantsReallocation = reallocations?.find(r => r.fromCategory === 'WANTS' && r.toCategory === 'SAVINGS');
  const hasReallocation = !!(needsReallocation || wantsReallocation);

  // Check if we can show the reallocation button (after cutoff day and has available amount)
  const canShowReallocationButton = reallocationPreview?.isAfterCutoff &&
    (reallocationPreview?.suggestedAmount > 0 || hasReallocation);

  const handleReallocation = async () => {
    if (hasReallocation) {
      // Undo all reallocations
      if (needsReallocation) {
        await deleteReallocation.mutateAsync(needsReallocation.id);
      }
      if (wantsReallocation) {
        await deleteReallocation.mutateAsync(wantsReallocation.id);
      }
    } else if (reallocationPreview) {
      // Create reallocations for both NEEDS and WANTS if they have remainders
      const promises: Promise<unknown>[] = [];

      if (reallocationPreview.needsRemainder > 0) {
        promises.push(createReallocation.mutateAsync({
          fromCategory: 'NEEDS',
          toCategory: 'SAVINGS',
          amount: reallocationPreview.needsRemainder,
          reason: 'Riallocazione automatica - Necessità',
        }));
      }

      if (reallocationPreview.wantsRemainder > 0) {
        promises.push(createReallocation.mutateAsync({
          fromCategory: 'WANTS',
          toCategory: 'SAVINGS',
          amount: reallocationPreview.wantsRemainder,
          reason: 'Riallocazione automatica - Svago',
        }));
      }

      await Promise.all(promises);
    }
  };

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
    <div className="sm:ml-60 space-y-4 md:h-full md:flex md:flex-col md:space-y-4">
      {/* Chart with Stats - Full width responsive */}
      <div className="flex-shrink-0">
        <BudgetChart categories={categories} totalIncome={totalIncome} compact showStats savingsHistory={savingsHistory} isClosed={isClosed} />
      </div>

      {/* Reallocation Button - visible only after cutoff day and when month is not closed */}
      {canShowReallocationButton && !isClosed && (
        <div className="flex-shrink-0">
          <button
            onClick={handleReallocation}
            disabled={createReallocation.isPending || deleteReallocation.isPending}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
              hasReallocation
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300'
                : 'bg-sky-600 text-white hover:bg-sky-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {(createReallocation.isPending || deleteReallocation.isPending) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : hasReallocation ? (
              <Undo2 className="w-4 h-4" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {hasReallocation
              ? 'Annulla riallocazione'
              : `Rialloca ${formatCurrency(reallocationPreview?.suggestedAmount || 0)} nei risparmi`}
          </button>
        </div>
      )}

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
            isClosed={isClosed}
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
            isClosed={isClosed}
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
            isClosed={isClosed}
          />
        </div>
      </div>

      {/* Close/Reopen Month Button - visible after cutoff day */}
      {reallocationPreview?.isAfterCutoff && (
        <div className="flex-shrink-0 mt-4">
          <button
            onClick={() => isClosed ? reopenMonth.mutate() : closeMonth.mutate()}
            disabled={closeMonth.isPending || reopenMonth.isPending}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-base flex items-center justify-center gap-2 transition-all ${
              isClosed
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-2 border-amber-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-emerald-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {(closeMonth.isPending || reopenMonth.isPending) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isClosed ? (
              <Unlock className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            {isClosed ? 'Riapri il mese' : 'Chiusura mese'}
          </button>
        </div>
      )}
    </div>
  );
}
