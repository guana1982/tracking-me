import { useState } from 'react';
import {
  useWealthGoals,
  useCreateWealthGoal,
  useDeleteWealthGoal,
} from '../hooks/useQueries';
import { cn, formatCurrency } from '../lib/utils';
import {
  Target,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Info,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { InfoModal } from './InfoModal';
import type { WealthGoalDTO, WealthGoalStatus } from '@budget/shared';

// Wealth goals ("arrivare a 60k"): corporate-style target tracking on the net
// cash-flow total. The backend computes progress, the median monthly pace with
// a P25/P75 band (robust to one-off jumps), the ETA at each pace and — when a
// deadline is set — the required vs actual pace comparison
const STATUS_META: Record<WealthGoalStatus, { label: string; className: string }> = {
  achieved: { label: 'Raggiunto', className: 'bg-emerald-100 text-emerald-700' },
  on_track: { label: 'In linea', className: 'bg-emerald-50 text-emerald-600' },
  at_risk: { label: 'A rischio', className: 'bg-amber-50 text-amber-600' },
  off_track: { label: 'Fuori rotta', className: 'bg-red-50 text-red-600' },
  no_data: { label: 'Pochi dati', className: 'bg-slate-100 text-slate-500' },
};

function addMonths(periodKey: string, n: number): string {
  const [year, month] = periodKey.split('-').map(Number);
  const total = year * 12 + (month - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

function shortPeriod(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  return `${month}/${year.slice(2)}`;
}

type ChartPoint = {
  periodKey: string;
  storico?: number;
  p25?: number;
  p50?: number;
  p75?: number;
};

// History + three dashed projection lines anchored to the last real point
function buildChartData(goal: WealthGoalDTO): ChartPoint[] {
  const { history, paceP25, paceP50, paceP75, monthsToTargetP25, monthsToTargetP50 } = goal.stats;
  if (history.length === 0) return [];

  const data: ChartPoint[] = history.map((p) => ({ periodKey: p.periodKey, storico: p.value }));
  if (paceP50 === null) return data;

  const last = history[history.length - 1];
  const connector = data[data.length - 1];
  connector.p25 = last.value;
  connector.p50 = last.value;
  connector.p75 = last.value;

  const horizon = Math.min(36, Math.max(6, monthsToTargetP25 ?? monthsToTargetP50 ?? 12));
  for (let i = 1; i <= horizon; i++) {
    data.push({
      periodKey: addMonths(last.periodKey, i),
      p25: paceP25 !== null ? Math.round((last.value + paceP25 * i) * 100) / 100 : undefined,
      p50: Math.round((last.value + paceP50 * i) * 100) / 100,
      p75: paceP75 !== null ? Math.round((last.value + paceP75 * i) * 100) / 100 : undefined,
    });
  }
  return data;
}

const CHART_SERIES: { key: keyof ChartPoint; name: string }[] = [
  { key: 'storico', name: 'Storico' },
  { key: 'p75', name: 'Ottimistico (P75)' },
  { key: 'p50', name: 'Mediano (P50)' },
  { key: 'p25', name: 'Prudente (P25)' },
];

export function WealthGoalsCard() {
  const { data: goals, isLoading } = useWealthGoals();
  const createGoal = useCreateWealthGoal();
  const deleteGoal = useDeleteWealthGoal();

  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [chartGoalId, setChartGoalId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState('');

  const headerGoal = (goals ?? [])[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!newName.trim() || isNaN(amount) || amount <= 0) return;
    try {
      await createGoal.mutateAsync({
        name: newName.trim(),
        targetAmount: Math.round(amount * 100) / 100,
        targetDate: newDate || null,
      });
      setNewName('');
      setNewAmount('');
      setNewDate('');
    } catch (error) {
      console.error('Failed to create wealth goal:', error);
    }
  };

  const handleDelete = async (goalId: string, name: string) => {
    if (confirm(`Eliminare l'obiettivo "${name}"?`)) {
      try {
        await deleteGoal.mutateAsync(goalId);
      } catch (error) {
        console.error('Failed to delete wealth goal:', error);
      }
    }
  };

  return (
    <div className="card py-3 shadow-sm bg-white border border-slate-200">
      {/* Accordion header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex flex-1 items-center gap-2 text-left min-w-0"
          title={expanded ? 'Chiudi gli obiettivi' : 'Apri gli obiettivi'}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <div className="p-1.5 rounded-lg bg-indigo-50 flex-shrink-0">
            <Target className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="font-semibold text-sm text-slate-700">Obiettivi di patrimonio</h3>
          {goals && goals.length > 0 && headerGoal && (
            <span className="text-xs text-slate-400 truncate">
              {goals.length} {goals.length === 1 ? 'obiettivo' : 'obiettivi'} ·{' '}
              {headerGoal.name}{' '}
              {headerGoal.stats.progressPct !== null && (
                <span className="font-semibold text-indigo-500">
                  {Math.round(headerGoal.stats.progressPct)}%
                </span>
              )}
            </span>
          )}
          {goals && goals.length === 0 && (
            <span className="text-xs text-slate-400">
              fissa un traguardo (es. 60.000 €) e vedi quando lo raggiungi
            </span>
          )}
        </button>
        <button
          onClick={() => setShowInfo(true)}
          className="p-1 text-slate-300 hover:text-indigo-500 transition-colors flex-shrink-0"
          title="Come funzionano gli obiettivi di patrimonio?"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <InfoModal title="Obiettivi di patrimonio" onClose={() => setShowInfo(false)}>
          <p>
            Un obiettivo è un traguardo sul <strong>totale netto</strong> dei tuoi check di
            cash-flow (la stessa cifra della pagina Cash Flow, già al netto della fiscalità e
            immune ai trasferimenti tra conti). Esempio: "arrivare a 60.000 €".
          </p>
          <p>
            <strong>Il ritmo:</strong> guardiamo di quanto è cresciuto il patrimonio mese per
            mese e prendiamo la <strong>mediana</strong>, non la media — così un mese anomalo
            (uno scorporo, un rimborso una tantum) non falsa la previsione. È il "run-rate" che
            usano le aziende nei forecast.
          </p>
          <p>
            <strong>La forbice:</strong> invece di una data secca (che sarebbe falsa precisione)
            mostriamo tre traiettorie: prudente (P25 = il ritmo dei tuoi mesi peggiori), mediana
            (P50) e ottimistica (P75 = i mesi migliori). La verità starà quasi sempre in mezzo.
          </p>
          <p>
            <strong>Con una scadenza:</strong> se imposti anche una data, calcoliamo il ritmo
            richiesto — quanto dovresti accumulare al mese per farcela — e lo confrontiamo col
            tuo ritmo reale: <span className="text-emerald-600 font-medium">In linea</span> se la
            mediana basta, <span className="text-amber-600 font-medium">A rischio</span> se ce la
            fai solo nello scenario ottimistico,{' '}
            <span className="text-red-600 font-medium">Fuori rotta</span> se nemmeno quello
            basta.
          </p>
          <p>
            <strong>Attenzione:</strong> servono almeno due mesi con un check per stimare il
            ritmo, e le prime stime ballano parecchio — più check accumuli, più la proiezione
            diventa affidabile.
          </p>
        </InfoModal>
      )}

      {expanded && (
        <div className="mt-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {(goals ?? []).map((goal) => {
                const { stats } = goal;
                const meta = STATUS_META[stats.status];
                const progress =
                  stats.progressPct !== null ? Math.max(0, Math.min(100, stats.progressPct)) : 0;
                const chartOpen = chartGoalId === goal.id;
                const chartData = chartOpen ? buildChartData(goal) : [];

                return (
                  <div key={goal.id} className="space-y-1.5">
                    {/* Name + status + actions */}
                    <div className="flex items-center gap-2 text-sm">
                      <p className="font-medium text-slate-700 truncate">{goal.name}</p>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0',
                          meta.className
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="flex-1" />
                      <button
                        onClick={() => setChartGoalId(chartOpen ? null : goal.id)}
                        className={cn(
                          'p-1.5 rounded transition-colors flex-shrink-0',
                          chartOpen
                            ? 'text-indigo-500 bg-indigo-50'
                            : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'
                        )}
                        title="Mostra/nascondi il grafico di proiezione"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id, goal.name)}
                        disabled={deleteGoal.isPending}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                        title="Elimina obiettivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            stats.status === 'achieved' ? 'bg-emerald-400' : 'bg-indigo-400'
                          )}
                          style={{ width: `${Math.max(2, progress)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 w-10 text-right flex-shrink-0">
                        {stats.progressPct !== null ? `${Math.round(stats.progressPct)}%` : '—'}
                      </span>
                    </div>

                    {/* Numbers + projections */}
                    <p className="text-[11px] text-slate-400">
                      {stats.currentValue !== null ? (
                        <>
                          {formatCurrency(stats.currentValue)} di{' '}
                          {formatCurrency(goal.targetAmount)}
                          {stats.remaining !== null && stats.remaining > 0 && (
                            <> · mancano {formatCurrency(stats.remaining)}</>
                          )}
                        </>
                      ) : (
                        'Nessun check di cash-flow: aggiungi il primo check per iniziare'
                      )}
                    </p>
                    {stats.status !== 'achieved' && stats.paceP50 !== null && (
                      <p className="text-[11px] text-slate-400">
                        Ritmo mediano ~{formatCurrency(stats.paceP50)}/mese
                        {stats.monthsToTargetP50 !== null && stats.etaPeriodP50 !== null && (
                          <>
                            {' '}
                            → arrivo stimato {shortPeriod(stats.etaPeriodP50)} (
                            {stats.monthsToTargetP50}{' '}
                            {stats.monthsToTargetP50 === 1 ? 'mese' : 'mesi'}
                            {stats.monthsToTargetP75 !== null &&
                              stats.monthsToTargetP25 !== null &&
                              stats.monthsToTargetP25 !== stats.monthsToTargetP75 && (
                                <>
                                  , forbice {stats.monthsToTargetP75}–{stats.monthsToTargetP25}
                                </>
                              )}
                            )
                          </>
                        )}
                        {stats.monthsToTargetP50 === null && ' → a questo ritmo non ci arrivi'}
                      </p>
                    )}
                    {stats.status !== 'achieved' && stats.requiredMonthlyPace !== null && goal.targetDate && (
                      <p className="text-[11px] text-slate-400">
                        Entro {shortPeriod(goal.targetDate.slice(0, 7))}: servono{' '}
                        <span className="font-semibold text-slate-500">
                          {formatCurrency(stats.requiredMonthlyPace)}/mese
                        </span>
                        {stats.paceP50 !== null && (
                          <>
                            , viaggi a ~
                            <span
                              className={cn(
                                'font-semibold',
                                stats.paceP50 >= stats.requiredMonthlyPace
                                  ? 'text-emerald-600'
                                  : 'text-red-500'
                              )}
                            >
                              {formatCurrency(stats.paceP50)}/mese
                            </span>
                          </>
                        )}
                      </p>
                    )}
                    {stats.paceP50 === null && stats.currentValue !== null && (
                      <p className="text-[11px] text-slate-400">
                        Servono check in almeno 2 mesi diversi per stimare il ritmo di crescita
                      </p>
                    )}

                    {/* Projection chart: history solid, three dashed scenarios, target line */}
                    {chartOpen && chartData.length > 0 && (
                      <div className="h-48 mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                              dataKey="periodKey"
                              tickFormatter={shortPeriod}
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: '#94a3b8' }}
                              tickFormatter={(value: number) =>
                                `${Math.round(value / 1000)}k`
                              }
                              width={35}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                formatCurrency(value),
                                CHART_SERIES.find((s) => s.key === name)?.name ?? name,
                              ]}
                              labelFormatter={(label: string) => shortPeriod(label)}
                              contentStyle={{ fontSize: 11, borderRadius: 8 }}
                            />
                            <ReferenceLine
                              y={goal.targetAmount}
                              stroke="#6366f1"
                              strokeDasharray="6 3"
                              label={{
                                value: `Obiettivo ${formatCurrency(goal.targetAmount)}`,
                                position: 'insideTopRight',
                                fontSize: 10,
                                fill: '#6366f1',
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="storico"
                              stroke="#0f172a"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="p75"
                              stroke="#10b981"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="p50"
                              stroke="#6366f1"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="p25"
                              stroke="#f59e0b"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {chartOpen && (
                      <p className="text-[10px] text-slate-400">
                        Linea nera = storico · tratteggiate ={' '}
                        <span className="text-emerald-600">ottimistica</span> /{' '}
                        <span className="text-indigo-500">mediana</span> /{' '}
                        <span className="text-amber-600">prudente</span> · viola = obiettivo
                      </p>
                    )}
                  </div>
                );
              })}

              {/* New goal form */}
              <form
                onSubmit={handleCreate}
                className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome (es. Quota 60k)"
                  className="input text-sm flex-1"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="Importo €"
                  className="input text-sm w-full sm:w-28"
                />
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="input text-sm w-full sm:w-40"
                  title="Scadenza opzionale: attiva il confronto ritmo richiesto vs reale"
                />
                <button
                  type="submit"
                  disabled={createGoal.isPending || !newName.trim() || !newAmount.trim()}
                  className="btn btn-primary text-sm"
                >
                  {createGoal.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </form>
              <p className="text-[11px] text-slate-400">
                Il progresso usa il totale netto dei check di cash-flow. La data è opzionale:
                se la metti, ti diciamo anche quanto dovresti accumulare al mese per farcela.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
