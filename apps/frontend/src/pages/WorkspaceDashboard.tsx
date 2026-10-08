import { useState } from 'react';
import { usePeriodStore } from '../hooks/usePeriod';
import { useDashboard, useSavingsHistory, useSavingsPace, useReallocations, useReallocationPreview, useCreateReallocation, useDeleteReallocation, useCarryoverPreview, useCreateCarryover, useSurplusForwardPreview, useCreateSurplusForward, useDeleteSurplusForward, usePeriod, useCloseMonth, useReopenMonth } from '../hooks/useQueries';
import { CategoryCard } from '../components/CategoryCard';
import { ReallocationChoiceModal } from '../components/ReallocationChoiceModal';
import { ExtraCard } from '../components/ExtraCard';
import { BudgetChart } from '../components/BudgetChart';
import { SavingsGauge } from '../components/SavingsGauge';
import { ExpensesList } from '../components/RecentExpenses';
import { InteractiveSpendingBreakdownCard } from '../components/InteractiveSpendingBreakdownCard';
import { KpiPanel } from '../components/KpiPanel';
import { SinkingFundsCard } from '../components/SinkingFundsCard';
import { WealthGoalsCard } from '../components/WealthGoalsCard';
import { Loader2, RefreshCw, Lock, Unlock, ArrowRightCircle, ChevronDown, ChevronRight, LayoutDashboard, Check } from 'lucide-react';
import { cn, formatCurrency, formatPeriodKey } from '../lib/utils';

export function WorkspaceDashboard() {
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
  const { data: surplusForwardPreview } = useSurplusForwardPreview(periodKey);
  const createSurplusForward = useCreateSurplusForward(periodKey);
  const deleteSurplusForward = useDeleteSurplusForward(periodKey);
  const closeMonth = useCloseMonth(periodKey);
  const reopenMonth = useReopenMonth(periodKey);

  // Charts block accordion (donut + gauge + savings chart): open by default,
  // collapsible to leave more room for the expense tables below
  const [showCharts, setShowCharts] = useState(true);
  const [showSecondaryExpenses, setShowSecondaryExpenses] = useState(false);

  // Reallocation choice popup (savings vs. carry surplus to next month)
  const [showReallocModal, setShowReallocModal] = useState(false);

  // Check if the month is closed (fall back to the dashboard summary so the two sources can't disagree)
  const isClosed = monthPeriod?.isClosed ?? data?.monthPeriod.isClosed ?? false;

  // Check if reallocations exist for current period (one for NEEDS, one for WANTS)
  const needsReallocation = reallocations?.find(r => r.fromCategory === 'NEEDS' && r.toCategory === 'SAVINGS');
  const wantsReallocation = reallocations?.find(r => r.fromCategory === 'WANTS' && r.toCategory === 'SAVINGS');
  const hasReallocation = !!(needsReallocation || wantsReallocation);
  const savingsReallocatedAmount = reallocations
    ?.filter(r => r.toCategory === 'SAVINGS')
    .reduce((sum, r) => sum + r.amount, 0) ?? 0;

  // Surplus carried forward to the next month (positive reallocation)
  const forwardActive = surplusForwardPreview?.carried ?? false;
  const forwardAmount = surplusForwardPreview?.carriedAmount ?? 0;
  const surplusAmount = surplusForwardPreview?.availableAmount ?? reallocationPreview?.suggestedAmount ?? 0;
  const nextMonthLabel = surplusForwardPreview
    ? formatPeriodKey(surplusForwardPreview.nextPeriodKey)
    : '';

  // Show the reallocation button after the cutoff when there is a surplus to
  // place, or when one destination is already active (so it can be managed/undone)
  const canShowReallocationButton = reallocationPreview?.isAfterCutoff &&
    (reallocationPreview.suggestedAmount > 0 || hasReallocation || forwardActive);

  const isReallocating =
    createReallocation.isPending ||
    deleteReallocation.isPending ||
    createSurplusForward.isPending ||
    deleteSurplusForward.isPending;

  // Per-card reallocation: moves a single category's leftover to SAVINGS.
  // Shown after the cutoff, like the global button; remainders are already
  // net of executed reallocations so the button disappears once used.
  const cardReallocation = (from: 'NEEDS' | 'WANTS') => {
    // Hidden once the surplus is carried forward: the two destinations are exclusive
    if (isClosed || !reallocationPreview?.isAfterCutoff || forwardActive) return undefined;
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

  const doSavingsReallocation = async () => {
    if (!reallocationPreview) return;
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
  };

  const undoSavingsReallocation = async () => {
    if (needsReallocation) {
      await deleteReallocation.mutateAsync(needsReallocation.id);
    }
    if (wantsReallocation) {
      await deleteReallocation.mutateAsync(wantsReallocation.id);
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

  // On xl each column (and each expense table inside it) scrolls on its own; a
  // closed month blocks clicks on the content but must keep them scrollable.
  const frozenScrollColumn = isClosed && cn(
    'xl:pointer-events-auto xl:[&>*]:pointer-events-none',
    'xl:[&_.overflow-y-auto]:pointer-events-auto xl:[&_.overflow-y-auto>*]:pointer-events-none'
  );

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
      {/* CFO KPI panel: savings rate, fixed costs, runway, net worth, invested share */}
      <div className="flex-shrink-0">
        <KpiPanel periodKey={periodKey} />
      </div>

      {/* Dashboard workspace: fixed analytical sidebars and a wider expense workspace. */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setShowCharts((prev) => !prev)}
          className="w-full flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm text-left hover:bg-slate-50 transition-colors"
          title={showCharts ? 'Nascondi la panoramica laterale' : 'Mostra la panoramica laterale'}
        >
          {showCharts ? (
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <LayoutDashboard className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span className="font-semibold text-sm text-slate-700">Panoramica mese</span>
          {!showCharts && (
            <span className="text-xs text-slate-400 truncate">
              Speso {formatCurrency(data.totalSpent)} · Entrate {formatCurrency(totalIncome)} · Extra {formatCurrency(data.extraSpent)}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(250px,0.8fr)_minmax(560px,2.2fr)_minmax(320px,1fr)]">
        {/* Left rail: budget donut and savings pace gauge. */}
        {showCharts && (
          <aside className={cn('space-y-4 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pr-1', frozenScrollColumn)}>
            <BudgetChart
              categories={categories}
              totalIncome={totalIncome}
              extraSpent={data.extraSpent}
              compact
              showStats
              savingsHistory={savingsHistory}
              isClosed={isClosed}
              visiblePanel="overview"
            />
            <SavingsGauge pace={savingsPace} />
          </aside>
        )}

        {/* Main workspace: the expense tables get most of the horizontal room. */}
        <main className={cn('min-w-0 space-y-4 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:px-1', !showCharts && 'xl:col-span-2', frozenScrollColumn)}>
          {/* Reallocation actions stay close to the tables they affect. */}
          {canShowReallocationButton && (
            <button
              onClick={() => setShowReallocModal(true)}
              className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                (hasReallocation || forwardActive)
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {(hasReallocation || forwardActive) ? <Check className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              {forwardActive
                ? `Surplus spostato a ${nextMonthLabel} · gestisci`
                : hasReallocation
                ? `${formatCurrency(savingsReallocatedAmount)} nei risparmi · gestisci`
                : `Rialloca il surplus (${formatCurrency(surplusAmount)})`}
            </button>
          )}

          {carryoverPreview?.isAfterCutoff && carryoverPreview.available && (
            <button
              onClick={() => createCarryover.mutate(undefined)}
              disabled={createCarryover.isPending}
              title="Registra gli sforamenti come spese fisse del mese successivo, riducendone il budget disponibile"
              className="w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createCarryover.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}
              Riporta {formatCurrency(carryoverPreview.pendingTotal)} di sforamento a {nextPeriodLabel}
            </button>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:min-h-[24rem] xl:flex-1 xl:grid-rows-[minmax(0,1fr)]">
            <div className="space-y-4 md:flex md:min-h-[32rem] md:flex-col xl:min-h-0">
              <div className="flex-shrink-0">
                <CategoryCard summary={categories.find((c) => c.category === 'NEEDS')!} reallocation={cardReallocation('NEEDS')} carryover={cardCarryover('NEEDS')} />
              </div>
              <ExpensesList expenses={needsExpenses} periodKey={periodKey} title="Spese Necessarie" category="NEEDS" emptyMessage="Nessuna spesa necessaria" isClosed={isClosed} />
            </div>
            <div className="space-y-4 md:flex md:min-h-[32rem] md:flex-col xl:min-h-0">
              <div className="flex-shrink-0">
                <CategoryCard summary={categories.find((c) => c.category === 'WANTS')!} reallocation={cardReallocation('WANTS')} carryover={cardCarryover('WANTS')} />
              </div>
              <ExpensesList expenses={wantsExpenses} periodKey={periodKey} title="Spese Svago" category="WANTS" emptyMessage="Nessuna spesa svago" isClosed={isClosed} />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowSecondaryExpenses((current) => !current)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
            >
              {showSecondaryExpenses ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              <span className="text-sm font-semibold text-slate-700">Risparmi ed Extra &amp; Vacanze</span>
              <span className="ml-auto text-xs text-slate-400">{savingsExpenses.length + extraExpenses.length} voci</span>
            </button>
            {showSecondaryExpenses && (
              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 bg-slate-50/50 p-4 md:grid-cols-2">
                <div className="space-y-4">
                  <CategoryCard summary={categories.find((c) => c.category === 'SAVINGS')!} />
                  <ExpensesList expenses={savingsExpenses} periodKey={periodKey} title="Risparmi" category="SAVINGS" emptyMessage="Nessun risparmio" reallocations={reallocations} isClosed={isClosed} />
                </div>
                <div className="space-y-4">
                  <ExtraCard spent={data.extraSpent} count={extraExpenses.length} />
                  <ExpensesList expenses={extraExpenses} periodKey={periodKey} title="Extra & Vacanze" category="EXTRA" emptyMessage="Nessuna spesa extra" isClosed={isClosed} />
                </div>
              </div>
            )}
          </section>
        </main>

        {/* Right rail: historical charts and long-term planning widgets. */}
        <aside className={cn('space-y-4 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:pl-1', frozenScrollColumn)}>
          {showCharts && (
            <BudgetChart
              categories={categories}
              totalIncome={totalIncome}
              extraSpent={data.extraSpent}
              compact
              showStats
              savingsHistory={savingsHistory}
              isClosed={isClosed}
              visiblePanel="history"
            />
          )}
          <InteractiveSpendingBreakdownCard periodKey={periodKey} />
          <SinkingFundsCard />
          <WealthGoalsCard />
        </aside>
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

      <ReallocationChoiceModal
        isOpen={showReallocModal}
        onClose={() => setShowReallocModal(false)}
        monthLabel={formatPeriodKey(periodKey)}
        nextMonthLabel={nextMonthLabel}
        surplusAmount={surplusAmount}
        savingsActive={hasReallocation}
        savingsAmount={savingsReallocatedAmount}
        forwardActive={forwardActive}
        forwardAmount={forwardAmount}
        isPending={isReallocating}
        onSavings={doSavingsReallocation}
        onForward={() => createSurplusForward.mutate()}
        onUndoSavings={undoSavingsReallocation}
        onUndoForward={() => deleteSurplusForward.mutate()}
      />
    </div>
  );
}
