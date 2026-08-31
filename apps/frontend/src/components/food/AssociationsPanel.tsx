import { Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { todayLocal, addDaysLocal } from '../../lib/foodUtils';
import { useFoodAssociations } from '../../hooks/useFoodQueries';
import type { FoodAssociationEntryDTO } from '@budget/shared';

function Ranking({
  title,
  icon,
  entries,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  entries: FoodAssociationEntryDTO[];
  accent: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${accent}`}>
        {icon}
        {title}
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">Nessuna occorrenza.</p>
      ) : (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.foodName} className="flex justify-between text-sm">
              <span className="text-slate-700 truncate">{entry.foodName}</span>
              {/* Conteggi, non percentuali: con pochi dati le % ingannano */}
              <span className="text-slate-400 tabular-nums shrink-0">{entry.count}×</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Alimenti ricorrenti nei pasti che precedono sensazioni positive/negative */
export function AssociationsPanel() {
  const to = todayLocal();
  const from = addDaysLocal(to, -89);
  const associations = useFoodAssociations(from, to);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-900 mb-1">
        Alimenti e sensazioni post-pasto
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Ultimi 90 giorni · basato su {associations.data?.linkedFeelingLogs ?? 0} note agganciate ai
        pasti. Associazioni, non cause.
      </p>

      {associations.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : (associations.data?.linkedFeelingLogs ?? 0) === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          Ancora nessuna nota di sensazione agganciata a un pasto: scrivi come ti senti dopo aver
          mangiato e l'aggancio avverrà da solo.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-6">
          <Ranking
            title="Prima di sensazioni negative"
            icon={<ThumbsDown className="w-3.5 h-3.5" />}
            entries={associations.data?.negative ?? []}
            accent="text-red-600"
          />
          <Ranking
            title="Prima di sensazioni positive"
            icon={<ThumbsUp className="w-3.5 h-3.5" />}
            entries={associations.data?.positive ?? []}
            accent="text-emerald-600"
          />
        </div>
      )}
    </div>
  );
}
