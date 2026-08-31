import { useState } from 'react';
import {
  useSpendingBreakdown,
  useGlobalSpendingBreakdown,
  useReclassifyExpenses,
  useAllExpensesForPeriod,
  useAllExpensesGlobal,
} from '../hooks/useQueries';
import { cn, formatCurrency, formatDate, formatPeriodKey } from '../lib/utils';
import type { SpendingBreakdownItemDTO } from '@budget/shared';
import {
  PieChart,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  History,
  X,
} from 'lucide-react';

// Selected category for the expenses modal: scope decides whether the list
// covers the current period or the whole history
interface SelectedCategory {
  scope: 'period' | 'global';
  categoryId: string | null;
  name: string;
  color: string;
}

// Shared bar list. Category names are clickable and open the expenses modal.
function BreakdownBars({
  items,
  onSelect,
}: {
  items: SpendingBreakdownItemDTO[];
  onSelect: (item: SpendingBreakdownItemDTO) => void;
}) {
  const maxTotal = items.length > 0 ? items[0].total : 0;

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">Nessuna spesa nel periodo</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
      {items.map((item) => (
        <div
          key={item.categoryId ?? 'unclassified'}
          className="flex items-center gap-2 text-sm"
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <button
            onClick={() => onSelect(item)}
            title={`Vedi le ${item.count} ${item.count === 1 ? 'spesa' : 'spese'} di "${item.name}"`}
            className={cn(
              'w-40 truncate flex-shrink-0 text-left hover:underline hover:text-indigo-600 transition-colors',
              item.categoryId ? 'text-slate-600' : 'text-slate-400 italic'
            )}
          >
            {item.name}
          </button>
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${maxTotal > 0 ? Math.max(2, (item.total / maxTotal) * 100) : 0}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="w-20 text-right font-semibold text-slate-700 flex-shrink-0">
            {formatCurrency(item.total)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Modal listing every expense of a category (period or whole history)
function CategoryExpensesModal({
  selected,
  periodKey,
  onClose,
}: {
  selected: SelectedCategory;
  periodKey: string;
  onClose: () => void;
}) {
  const isGlobal = selected.scope === 'global';
  const periodQuery = useAllExpensesForPeriod(periodKey, !isGlobal);
  const globalQuery = useAllExpensesGlobal(isGlobal);
  const { data, isLoading } = isGlobal ? globalQuery : periodQuery;

  // SAVINGS rows are transfers: excluded from the breakdown, so exclude them here too
  const expenses = (data ?? []).filter(
    (expense) =>
      expense.category !== 'SAVINGS' &&
      (expense.spendingCategoryId ?? null) === selected.categoryId
  );
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            <h2 className="text-lg font-semibold text-slate-900 truncate">{selected.name}</h2>
            <span className="text-sm text-slate-400 flex-shrink-0">
              {isGlobal ? 'da inizio storico' : formatPeriodKey(periodKey)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              Nessuna spesa in questa categoria
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  {isGlobal && <th className="pb-2 pr-3 font-medium">Mese</th>}
                  <th className="pb-2 pr-3 font-medium">Data</th>
                  <th className="pb-2 pr-3 font-medium">Descrizione</th>
                  <th className="pb-2 text-right font-medium">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    {isGlobal && (
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                        {'periodKey' in expense
                          ? formatPeriodKey(expense.periodKey as string)
                          : ''}
                      </td>
                    )}
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                      {formatDate(expense.date)}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{expense.label}</td>
                    <td className="py-2 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {expenses.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <span className="text-sm text-slate-500">
              {expenses.length} {expenses.length === 1 ? 'spesa' : 'spese'}
            </span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Modal with the global breakdown (whole history); categories open the
// expenses modal in global scope
function GlobalBreakdownModal({
  onClose,
  onSelectCategory,
}: {
  onClose: () => void;
  onSelectCategory: (item: SpendingBreakdownItemDTO) => void;
}) {
  const { data, isLoading } = useGlobalSpendingBreakdown(true);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50">
              <History className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Dove sono andati i soldi — da inizio storico
            </h2>
            {data && (
              <span className="text-sm text-slate-400">{formatCurrency(data.total)} totali</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <BreakdownBars items={data?.items ?? []} onSelect={onSelectCategory} />
          )}
        </div>
      </div>
    </div>
  );
}

// "Dove sono andati i soldi": collapsible per-category spending breakdown.
// Collapsed by default; the header still shows the period total at a glance.
export function SpendingBreakdownCard({ periodKey }: { periodKey: string }) {
  const { data, isLoading } = useSpendingBreakdown(periodKey);
  const reclassify = useReclassifyExpenses();

  const [expanded, setExpanded] = useState(false);
  const [showGlobal, setShowGlobal] = useState(false);
  const [selected, setSelected] = useState<SelectedCategory | null>(null);

  const openCategory = (scope: 'period' | 'global') => (item: SpendingBreakdownItemDTO) =>
    setSelected({ scope, categoryId: item.categoryId, name: item.name, color: item.color });

  return (
    <div className="card py-3 shadow-sm bg-white border border-slate-200">
      {/* Accordion header */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
          title={expanded ? 'Chiudi il dettaglio' : 'Apri il dettaglio per categoria'}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <div className="p-1.5 rounded-lg bg-indigo-50 flex-shrink-0">
            <PieChart className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-sm text-slate-700 truncate">
            Dove sono andati i soldi
          </h3>
          {data && (
            <span className="text-xs text-slate-400 flex-shrink-0">
              {formatCurrency(data.total)} totali
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowGlobal(true)}
            title="Mostra la classificazione di tutte le spese da inizio storico"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Da inizio storico
          </button>
          <button
            onClick={() => reclassify.mutate()}
            disabled={reclassify.isPending}
            title="Riesegue la classificazione automatica su tutto lo storico (le correzioni manuali restano)"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reclassify.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Riclassifica
          </button>
        </div>
      </div>

      {/* Accordion body */}
      {expanded && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <BreakdownBars items={data?.items ?? []} onSelect={openCategory('period')} />
          )}
        </div>
      )}

      {/* Modals */}
      {showGlobal && (
        <GlobalBreakdownModal
          onClose={() => setShowGlobal(false)}
          onSelectCategory={openCategory('global')}
        />
      )}
      {selected && (
        <CategoryExpensesModal
          selected={selected}
          periodKey={periodKey}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
