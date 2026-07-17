import { Loader2 } from 'lucide-react';
import { useFoodStats } from '../../hooks/useFoodQueries';

interface StatsPanelProps {
  from: string;
  to: string;
  title?: string;
  compact?: boolean;
}

/** Andamento del periodo: costanza, orari medi, allenamenti, valenze, top alimenti */
export function StatsPanel({ from, to, title, compact = false }: StatsPanelProps) {
  const stats = useFoodStats(from, to);

  if (stats.isLoading) {
    return (
      <div className="card flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!stats.data) {
    return <div className="card text-sm text-slate-500">Nessun dato disponibile.</div>;
  }

  const data = stats.data;
  const cells: { label: string; value: string }[] = [
    { label: 'Giorni con pasti', value: `${data.daysWithMeals}/${data.totalDays}` },
    { label: 'Stato medio', value: data.avgDayState !== null ? String(data.avgDayState) : 'n.d.' },
    { label: 'Pranzo medio', value: data.avgLunchTime ?? 'n.d.' },
    { label: 'Cena media', value: data.avgDinnerTime ?? 'n.d.' },
    { label: 'Allenamenti', value: String(data.workoutCount) },
    { label: 'Sonno +/−', value: `${data.sleepPositive}/${data.sleepNegative}` },
    { label: 'Sensazioni +/−', value: `${data.feelingPositive}/${data.feelingNegative}` },
  ];

  return (
    <div className="card">
      {title && <h3 className="text-sm font-semibold text-slate-900 mb-3">{title}</h3>}
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-2 sm:grid-cols-4 gap-2'}>
        {cells.map((cell) => (
          <div key={cell.label} className="bg-slate-50 rounded-xl px-3 py-2">
            <p className="text-[11px] text-slate-500">{cell.label}</p>
            <p className="text-sm font-semibold text-slate-900 tabular-nums">{cell.value}</p>
          </div>
        ))}
      </div>

      {data.topFoods.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Top alimenti</p>
          <ul className="space-y-1">
            {data.topFoods.slice(0, compact ? 5 : 10).map((food) => (
              <li key={food.foodName} className="flex justify-between text-sm">
                <span className="text-slate-700 truncate">{food.foodName}</span>
                <span className="text-slate-400 tabular-nums shrink-0">{food.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
