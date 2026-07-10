import { usePeriodStore } from '../hooks/usePeriod';
import { useDashboard, useSavingsHistory, useSavingsPace, useReallocations, useReallocationPreview, useCreateReallocation, useDeleteReallocation, useCarryoverPreview, useCreateCarryover, usePeriod, useCloseMonth, useReopenMonth } from '../hooks/useQueries';
import { CategoryCard } from '../components/CategoryCard';
import { ExtraCard } from '../components/ExtraCard';
import { BudgetChart } from '../components/BudgetChart';
import { SavingsGauge } from '../components/SavingsGauge';
import { ExpensesList } from '../components/RecentExpenses';
import { SpendingBreakdownCard } from '../components/SpendingBreakdownCard';
import { Loader2, RefreshCw, Undo2, Lock, Unlock, Download, ArrowRightCircle } from 'lucide-react';
import { cn, formatCurrency, formatPeriodKey } from '../lib/utils';
import { buildExpensesCsv, downloadCsv } from '../lib/csv';

export function Dashboard() {
  const { periodKey } = usePeriodStore();
  const { data, isLoading, error } = useDashboard(periodKey);
  const { data: savingsHistory } = useSavingsHistory(periodKey);
  const { data: savingsPace } = useSavingsPace(periodKey);
  const { data: reallocations } = useReallocations(periodKey);
  const { data: reallocationPreview } = useReallocationPreview(periodKey);
  const { data: carryoverPreview } = useCarryoverPreview(periodKey);
  const { data: monthPeriod } = usePeriod(periodKey);
  const createReallocation = useCreateReallocation(periodKey);
  const deleteReallocation = useDeleteReallocation(periodKey);
  const createCarryover = useCreateCarryover(periodKey);
  const closeMonth = useCloseMonth(periodKey);
  const reopenMonth = useReopenMonth(periodKey);

  // Check if the month is closed (fall back to the dashboard summary so the two sources can't disagree)
  const isClosed = monthPeriod?.isClosed ?? data?.monthPeriod.isClosed ?? false;

  // Check if reallocations exist for current period (one for NEEDS, one for WANTS)
  const needsReallocation = reallocations?.find(r => r.fromCategory === 'NEEDS' && r.toCategory === 'SAVINGS');
  const wantsReallocation = reallocations?.find(r => r.fromCategory === 'WANTS' && r.toCategory === 'SAVINGS');
  const hasReallocation = !!(needsReallocation || wantsReallocation);

  // Check if we can show the reallocation button (after cutoff day and has available amount)
  const canShowReallocationButton = reallocationPreview?.isAfterCutoff &&
    (reallocationPreview?.suggestedAmount > 0 || hasReallocation);

  const handleExportExpensesCsv = () => {
    if (!data?.recentExpenses.length) return;

    downloadCsv(buildExpensesCsv(data.recentExpenses), `spese-${periodKey}.csv`);
  };

  // Per-card reallocation: moves a single category's leftover to SAVINGS.
  // Shown after the cutoff, like the global button; remainders are already
  // net of executed reallocations so the button disappears once used.
  const cardReallocation = (from: 'NEEDS' | 'WANTS') => {
    if (isClosed || !reallocationPreview?.isAfterCutoff) return undefined;
    const amount = from === 'NEEDS'
      ? reallocationPreview.needsRemainder
      : reallocationPreview.wantsRemainder;
    if (amount <= 0) return undefined;

    return {
      amount,
      isPending: createReallocation.isPending,
      onMove: () =>
        createReallocation.mutate({
          fromCategory: from,
          toCategory: 'SAVINGS',
          amount,
          reason: from === 'NEEDS'
            ? 'Riallocazione manuale - Necessità'
            : 'Riallocazione manuale - Svago',
        }),
    };
  };

  // Per-card carry-over: registers a category's over-budget deficit as a
  // fixed expense of the NEXT month. Shown after the cutoff, like the
  // reallocation; the backend marker makes it idempotent, so once carried
  // the button disappears.
  const nextPeriodLabel = carryoverPreview ? formatPeriodKey(carryoverPreview.nextPeriodKey) : '';

  const cardCarryover = (from: 'NEEDS' | 'WANTS') => {
    if (isClosed || !carryoverPreview?.isAfterCutoff) return undefined;
    const carried = from === 'NEEDS' ? carryoverPreview.needsCarried : carryoverPreview.wantsCarried;
    const amount = from === 'NEEDS' ? carryoverPreview.needsDeficit : carryoverPreview.wantsDeficit;
    if (carried || amount <= 0) return undefined;

    return {
      amount,
      nextPeriodLabel,
      isPending: createCarryover.isPending,
      onCarry: () => createCarryover.mutate(from),
    };
  };

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
  const extraExpenses = recentExpenses.filter((e) => e.category === 'EXTRA');

  return (
    <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 md:h-full md:flex md:flex-col">
      {/* Closed month banner - the only interactive element while the month is frozen */}
      {isClosed && (
        <div className="flex-shrink-0 mb-3 flex items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-amber-100 flex-shrink-0">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800">Mese chiuso</p>
              <p className="text-xs text-amber-600">
                La pagina è in sola lettura: sblocca il mese per modificare spese, entrate e riallocazioni.
              </p>
            </div>
          </div>
          <button
            onClick={() => reopenMonth.mutate()}
            disabled={reopenMonth.isPending}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reopenMonth.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            Sblocca mese
          </button>
        </div>
      )}

      {/* Page content - fully frozen (no clicks) while the month is closed */}
      <div
        aria-disabled={isClosed}
        className={cn(
          'space-y-3 xl:space-y-4 md:flex-1 md:min-h-0 md:flex md:flex-col md:space-y-3',
          isClosed && 'pointer-events-none select-none opacity-60'
        )}
      >
      {/* Chart with Stats - Full width responsive */}
      <div className="flex-shrink-0">
        <BudgetChart
          categories={categories}
          totalIncome={totalIncome}
          extraSpent={data.extraSpent}
          compact
          showStats
          savingsHistory={savingsHistory}
          isClosed={isClosed}
          middleSlot={<SavingsGauge pace={savingsPace} />}
        />
      </div>

      {/* Reallocation Button - visible after cutoff day; frozen (non-clickable) while the month is closed */}
      {canShowReallocationButton && (
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

      {/* Carry-over button - carries all pending over-budget deficits to next month */}
      {carryoverPreview?.isAfterCutoff && carryoverPreview.available && (
        <div className="flex-shrink-0">
          <button
            onClick={() => createCarryover.mutate(undefined)}
            disabled={createCarryover.isPending}
            title="Registra gli sforamenti come spese fisse del mese successivo, riducendone il budget disponibile"
            className="w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createCarryover.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRightCircle className="w-4 h-4" />
            )}
            Riporta {formatCurrency(carryoverPreview.pendingTotal)} di sforamento a {nextPeriodLabel}
          </button>
        </div>
      )}

      <div className="flex flex-shrink-0 justify-end">
        <button
          type="button"
          onClick={handleExportExpensesCsv}
          disabled={recentExpenses.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          title="Esporta tutte le spese del mese in CSV"
        >
          <Download className="w-4 h-4" />
          CSV spese mese
        </button>
      </div>

      {/* Category Cards + Expense Lists - Aligned in columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:flex-1 md:min-h-0">
        {/* Necessità Column */}
        <div className="space-y-4 md:flex md:flex-col md:min-h-0">
          <div className="flex-shrink-0">
            <CategoryCard summary={categories.find((c) => c.category === 'NEEDS')!} reallocation={cardReallocation('NEEDS')} carryover={cardCarryover('NEEDS')} />
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
            <CategoryCard summary={categories.find((c) => c.category === 'WANTS')!} reallocation={cardReallocation('WANTS')} carryover={cardCarryover('WANTS')} />
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

        {/* Extra & Vacanze Column - tracked outside the 65/25/10 budget */}
        <div className="space-y-4 md:flex md:flex-col md:min-h-0">
          <div className="flex-shrink-0">
            <ExtraCard spent={data.extraSpent} count={extraExpenses.length} />
          </div>
          <ExpensesList
            expenses={extraExpenses}
            periodKey={periodKey}
            title="Extra & Vacanze"
            category="EXTRA"
            emptyMessage="Nessuna spesa extra"
            isClosed={isClosed}
          />
        </div>
      </div>

      {/* Spending breakdown by auto-classified category (Spesa, Bollette, Auto, ...) */}
      <div className="flex-shrink-0">
        <SpendingBreakdownCard periodKey={periodKey} />
      </div>

      {/* Close Month Button - visible after cutoff day; unlock happens from the banner above */}
      {reallocationPreview?.isAfterCutoff && !isClosed && (
        <div className="flex-shrink-0 mt-4">
          <button
            onClick={() => closeMonth.mutate()}
            disabled={closeMonth.isPending}
            className="w-full py-3 px-4 rounded-lg font-semibold text-base flex items-center justify-center gap-2 transition-all bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {closeMonth.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            Chiusura mese
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
