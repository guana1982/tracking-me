import { useSpendingBreakdown, useReclassifyExpenses } from '../hooks/useQueries';
import { cn, formatCurrency } from '../lib/utils';
import { PieChart, Loader2, RefreshCw } from 'lucide-react';

// "Dove sono andati i soldi": per-category spending breakdown for the period.
// Categories are auto-assigned from the expense label by the backend classifier;
// the reclassify button re-runs it over the whole history (first run + new rules).
export function SpendingBreakdownCard({ periodKey }: { periodKey: string }) {
  const { data, isLoading } = useSpendingBreakdown(periodKey);
  const reclassify = useReclassifyExpenses();

  const items = data?.items ?? [];
  const maxTotal = items.length > 0 ? items[0].total : 0;

  return (
    <div className="card py-3 shadow-sm bg-white border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50">
            <PieChart className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-sm text-slate-700">Dove sono andati i soldi</h3>
          {data && (
            <span className="text-xs text-slate-400">
              {formatCurrency(data.total)} totali
            </span>
          )}
        </div>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">Nessuna spesa nel periodo</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          {items.map((item) => (
            <div
              key={item.categoryId ?? 'unclassified'}
              className="flex items-center gap-2 text-sm"
              title={`${item.count} ${item.count === 1 ? 'spesa' : 'spese'}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span
                className={cn(
                  'w-40 truncate flex-shrink-0',
                  item.categoryId ? 'text-slate-600' : 'text-slate-400 italic'
                )}
              >
                {item.name}
              </span>
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
      )}
    </div>
  );
}
