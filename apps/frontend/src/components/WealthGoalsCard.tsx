import { useState } from 'react';
import {
  useWealthGoals,
  useCreateWealthGoal,
  useUpdateWealthGoal,
  useDeleteWealthGoal,
} from '../hooks/useQueries';
import { cn, formatCurrency } from '../lib/utils';
import {
  Target,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  Info,
  TrendingUp,
  SlidersHorizontal,
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
  avg?: number;
  p75?: number;
};

// History + three dashed projection lines anchored to the last real point
function buildChartData(goal: WealthGoalDTO): ChartPoint[] {
  const { history, paceP25, paceAvg, paceP75, monthsToTargetP25, monthsToTargetAvg } = goal.stats;
  if (history.length === 0) return [];

  const data: ChartPoint[] = history.map((p) => ({ periodKey: p.periodKey, storico: p.value }));
  if (paceAvg === null) return data;

  const last = history[history.length - 1];
  const connector = data[data.length - 1];
  connector.p25 = last.value;
  connector.avg = last.value;
  connector.p75 = last.value;

  const horizon = Math.min(36, Math.max(6, monthsToTargetP25 ?? monthsToTargetAvg ?? 12));
  for (let i = 1; i <= horizon; i++) {
    data.push({
      periodKey: addMonths(last.periodKey, i),
      p25: paceP25 !== null ? Math.round((last.value + paceP25 * i) * 100) / 100 : undefined,
      avg: Math.round((last.value + paceAvg * i) * 100) / 100,
      p75: paceP75 !== null ? Math.round((last.value + paceP75 * i) * 100) / 100 : undefined,
    });
  }
  return data;
}

const CHART_SERIES: { key: keyof ChartPoint; name: string }[] = [
  { key: 'storico', name: 'Storico' },
  { key: 'p75', name: 'Mesi migliori (P75)' },
  { key: 'avg', name: 'Ritmo medio' },
  { key: 'p25', name: 'Mesi peggiori (P25)' },
];

// Months + arrival period to reach `target` from `current` at `pace` €/month;
// nulls when the pace doesn't get there (zero/negative or >50 years away)
function projectEta(
  target: number,
  current: number,
  pace: number | null,
  fromPeriod: string
): { months: number; period: string } | null {
  if (target <= current) return { months: 0, period: fromPeriod };
  if (pace === null || pace <= 0) return null;
  const months = Math.ceil((target - current) / pace);
  if (months > 600) return null;
  return { months, period: addMonths(fromPeriod, months) };
}

export function WealthGoalsCard() {
  const { data: goals, isLoading } = useWealthGoals();
  const createGoal = useCreateWealthGoal();
  const updateGoal = useUpdateWealthGoal();
  const deleteGoal = useDeleteWealthGoal();

  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [chartGoalId, setChartGoalId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [simTarget, setSimTarget] = useState<number | null>(null);

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

  const startEdit = (goal: WealthGoalDTO) => {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditAmount(goal.targetAmount.toFixed(2));
    setEditDate(goal.targetDate ?? '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoalId) return;
    const amount = parseFloat(editAmount.replace(',', '.'));
    if (!editName.trim() || isNaN(amount) || amount <= 0) return;
    try {
      await updateGoal.mutateAsync({
        id: editingGoalId,
        data: {
          name: editName.trim(),
          targetAmount: Math.round(amount * 100) / 100,
          targetDate: editDate || null, // empty date clears the deadline
        },
      });
      setEditingGoalId(null);
    } catch (error) {
      console.error('Failed to update wealth goal:', error);
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

  // Target→date simulator: slide the amount, read the arrival date. Pace and
  // current value are goal-independent, so the first goal's stats serve
  const simStats = headerGoal?.stats;
  const simReady =
    simStats != null && simStats.currentValue !== null && simStats.paceAvg !== null;
  const simMin = simReady ? Math.ceil(simStats.currentValue! / 500) * 500 : 0;
  const simMax = simMin + 100_000;
  const simValue = Math.min(
    simMax,
    Math.max(simMin, Math.round(simTarget ?? headerGoal?.targetAmount ?? simMin))
  );
  const simFrom = simStats?.currentDate
    ? simStats.currentDate.slice(0, 7)
    : new Date().toISOString().slice(0, 7);
  const simEtaAvg = simReady
    ? projectEta(simValue, simStats.currentValue!, simStats.paceAvg, simFrom)
    : null;
  const simEtaBest = simReady
    ? projectEta(simValue, simStats.currentValue!, simStats.paceP75, simFrom)
    : null;
  const simEtaWorst = simReady
    ? projectEta(simValue, simStats.currentValue!, simStats.paceP25, simFrom)
    : null;

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
            <strong>Il ritmo medio:</strong> è la crescita totale del patrimonio divisa per i
            mesi trascorsi, contando solo i <strong>mesi completi</strong> (quello in corso è
            escluso: lo stipendio magari non è ancora arrivato e falserebbe tutto). È lo stesso
            numero del "Risparmio medio/mese" della pagina Cash Flow — il "run-rate" che usano
            le aziende nei forecast.
          </p>
          <p>
            <strong>La forbice:</strong> i singoli mesi ballano molto (un check fatto prima o
            dopo lo stipendio sposta centinaia di euro), quindi oltre al ritmo medio mostriamo
            come andrebbe se i prossimi mesi somigliassero ai tuoi <em>peggiori</em> (P25) o ai
            tuoi <em>migliori</em> (P75). La verità starà quasi sempre in mezzo.
          </p>
          <p>
            <strong>Con una scadenza:</strong> se imposti anche una data, calcoliamo il ritmo
            richiesto — quanto dovresti accumulare al mese per farcela — e lo confrontiamo col
            tuo ritmo medio: <span className="text-emerald-600 font-medium">In linea</span> se il
            ritmo medio basta, <span className="text-amber-600 font-medium">A rischio</span> se
            ce la fai solo se i prossimi mesi vanno come i tuoi migliori,{' '}
            <span className="text-red-600 font-medium">Fuori rotta</span> se nemmeno quello
            basta.
          </p>
          <p>
            <strong>Attenzione:</strong> servono check in almeno due mesi completi per stimare
            il ritmo, e le prime stime ballano parecchio — più mesi accumuli, più la proiezione
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
                const isEditing = editingGoalId === goal.id;

                return (
                  <div key={goal.id} className="space-y-1.5">
                    {isEditing ? (
                      /* Inline edit: name, target amount, optional deadline (clear = remove it) */
                      <form onSubmit={handleSaveEdit} className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nome"
                          className="input text-sm flex-1"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          placeholder="Importo €"
                          className="input text-sm w-full sm:w-28"
                        />
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="input text-sm w-full sm:w-40"
                          title="Scadenza: svuota il campo per toglierla"
                        />
                        <div className="flex gap-1">
                          <button
                            type="submit"
                            disabled={updateGoal.isPending || !editName.trim() || !editAmount.trim()}
                            className="btn btn-primary text-sm"
                            title="Salva le modifiche"
                          >
                            {updateGoal.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGoalId(null)}
                            className="btn text-sm text-slate-500 hover:text-slate-700"
                            title="Annulla"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Name + status + actions */
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
                          onClick={() => startEdit(goal)}
                          className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors flex-shrink-0"
                          title="Modifica nome, importo o scadenza"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
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
                    )}

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
                    {stats.status !== 'achieved' && stats.paceAvg !== null && (
                      <p className="text-[11px] text-slate-400">
                        Ritmo medio ~{formatCurrency(stats.paceAvg)}/mese
                        {stats.monthsToTargetAvg !== null && stats.etaPeriodAvg !== null && (
                          <>
                            {' '}
                            → arrivo stimato {shortPeriod(stats.etaPeriodAvg)} (
                            {stats.monthsToTargetAvg}{' '}
                            {stats.monthsToTargetAvg === 1 ? 'mese' : 'mesi'}
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
                        {stats.monthsToTargetAvg === null && ' → a questo ritmo non ci arrivi'}
                      </p>
                    )}
                    {stats.status !== 'achieved' && stats.requiredMonthlyPace !== null && goal.targetDate && (
                      <p className="text-[11px] text-slate-400">
                        Entro {shortPeriod(goal.targetDate.slice(0, 7))}: servono{' '}
                        <span className="font-semibold text-slate-500">
                          {formatCurrency(stats.requiredMonthlyPace)}/mese
                        </span>
                        {stats.paceAvg !== null && (
                          <>
                            , viaggi a ~
                            <span
                              className={cn(
                                'font-semibold',
                                stats.paceAvg >= stats.requiredMonthlyPace
                                  ? 'text-emerald-600'
                                  : 'text-red-500'
                              )}
                            >
                              {formatCurrency(stats.paceAvg)}/mese
                            </span>
                          </>
                        )}
                      </p>
                    )}
                    {stats.paceAvg === null && stats.currentValue !== null && (
                      <p className="text-[11px] text-slate-400">
                        Servono check in almeno 2 mesi completi per stimare il ritmo di crescita
                        (il mese in corso non conta finché non finisce)
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
                              dataKey="avg"
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
                        <span className="text-emerald-600">mesi migliori</span> /{' '}
                        <span className="text-indigo-500">ritmo medio</span> /{' '}
                        <span className="text-amber-600">mesi peggiori</span> · viola = obiettivo
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Target→date simulator: slide the amount, read the arrival date */}
              {simReady && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                      Se l'obiettivo fosse…
                    </p>
                    <p className="text-sm font-bold text-indigo-600 tabular-nums">
                      {formatCurrency(simValue)}
                    </p>
                  </div>
                  <input
                    type="range"
                    min={simMin}
                    max={simMax}
                    step={500}
                    value={simValue}
                    onChange={(e) => setSimTarget(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                    title="Trascina per esplorare: quanto patrimonio → quando lo raggiungi"
                  />
                  <div className="text-sm text-slate-700">
                    {simEtaAvg === null ? (
                      <span className="text-red-500 font-semibold">
                        al ritmo medio attuale non ci arrivi
                      </span>
                    ) : simEtaAvg.months === 0 ? (
                      <span className="text-emerald-600 font-semibold">già raggiunto ✓</span>
                    ) : (
                      <>
                        lo raggiungi a{' '}
                        <span className="font-bold text-slate-900">
                          {shortPeriod(simEtaAvg.period)}
                        </span>{' '}
                        <span className="text-slate-400">
                          ({simEtaAvg.months} {simEtaAvg.months === 1 ? 'mese' : 'mesi'} al ritmo
                          medio di {formatCurrency(simStats.paceAvg!)}/mese)
                        </span>
                      </>
                    )}
                  </div>
                  {simEtaAvg !== null && simEtaAvg.months > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-400">
                        Se i prossimi mesi somigliano ai tuoi{' '}
                        <span className="text-emerald-600">migliori</span>:{' '}
                        {simEtaBest ? shortPeriod(simEtaBest.period) : 'mai'} · ai{' '}
                        <span className="text-amber-600">peggiori</span>:{' '}
                        {simEtaWorst ? shortPeriod(simEtaWorst.period) : 'mai'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setNewAmount(String(simValue))}
                        className="text-[11px] text-indigo-500 hover:underline"
                        title="Copia questo importo nel form del nuovo obiettivo qui sotto"
                      >
                        Usa nel nuovo obiettivo ↓
                      </button>
                    </div>
                  )}
                </div>
              )}

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
