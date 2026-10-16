import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Crosshair, Info, Loader2, Pill, Scale, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTherapyTrends } from '../../hooks/useTherapyPlanQueries';
import { MIN_OBSERVATIONS_FOR_CORRELATION } from '@budget/shared';
import type { TherapyScaleSeriesDTO } from '@budget/shared';

// Distinct hues, all readable next to each other; the palette repeats only
// past seven scales, which is already more than the spec's core set
interface WeekRow {
  label: string;
  weekStart: string;
  isPartial: boolean;
  checkIns: number;
  /** Weekly mean of each scale, keyed by scale key */
  [scaleKey: string]: string | number | boolean | null;
}

const SERIES_COLORS = [
  '#0f172a',
  '#c026d3',
  '#0d9488',
  '#ea580c',
  '#4f46e5',
  '#65a30d',
  '#be123c',
];

/**
 * The weekly reading (§4.4). Weekly on purpose: the daily grain serves the
 * collection, the weekly one serves the reading.
 *
 * Nothing here says "better" or "worse" and nothing produces an insight in
 * assertive form. Every figure travels with the number of observations behind
 * it, and the running week is drawn from day one - flagged as still forming,
 * because a curve has to start somewhere.
 */
export function TherapyTrendsPanel() {
  const trends = useTherapyTrends();
  const [hidden, setHidden] = useState<string[]>([]);

  const symptomScales = useMemo(
    () => (trends.data?.scales ?? []).filter((scale) => !scale.isSideEffect),
    [trends.data]
  );

  // One row per week, with each scale flattened into its own key so Recharts
  // can address it by dataKey
  const chartData = useMemo<WeekRow[]>(
    () =>
      (trends.data?.weeks ?? []).map((week) => ({
        label: week.label,
        weekStart: week.weekStart,
        isPartial: week.isPartial,
        checkIns: week.checkIns,
        ...week.scales,
      })),
    [trends.data]
  );

  if (trends.isLoading) {
    return (
      <div className="card flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!trends.data) return null;

  const data = trends.data;
  const hasAnyScaleData = chartData.some((week) =>
    symptomScales.some((scale) => week[scale.key] !== null && week[scale.key] !== undefined)
  );
  const toggle = (key: string) =>
    setHidden((previous) =>
      previous.includes(key) ? previous.filter((item) => item !== key) : [...previous, key]
    );

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-slate-100 shrink-0">
              <Activity className="w-4 h-4 text-slate-700" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Terapia · andamento</h2>
          </div>
          <span className="text-[11px] text-slate-400 shrink-0">
            {data.totalCheckIns} check-in
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Medie settimanali, mai giornaliere. Una curva che scende su una scala di sintomo
          significa miglioramento.
        </p>

        {!hasAnyScaleData ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            Nessun check-in ancora registrato. La curva parte dal primo.
          </p>
        ) : (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number, name: string) => [value, name]}
                    labelFormatter={(label: string) => {
                      const week = chartData.find((item) => item.label === label);
                      return `${label} · ${week?.checkIns ?? 0} check-in${
                        week?.isPartial ? ' (settimana in corso)' : ''
                      }`;
                    }}
                  />
                  {/* The day a dose moved is the first thing to look for next
                      to a curve that changed shape */}
                  {data.doseChanges.map((marker) => {
                    const week = chartData.find((item) => item.weekStart === marker.weekStart);
                    if (!week) return null;
                    return (
                      <ReferenceLine
                        key={`${marker.date}-${marker.label}`}
                        x={week.label}
                        stroke="#0d9488"
                        strokeDasharray="4 3"
                        label={{ value: '↑ dose', position: 'top', fontSize: 9, fill: '#0d9488' }}
                      />
                    );
                  })}
                  {symptomScales
                    .filter((scale) => !hidden.includes(scale.key))
                    .map((scale, index) => (
                      <Line
                        key={scale.key}
                        type="monotone"
                        dataKey={scale.key}
                        name={scale.name}
                        stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                        strokeWidth={2}
                        // Dots on: with a single week there is no line to see
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {symptomScales.map((scale, index) => (
                <ScaleChip
                  key={scale.key}
                  scale={scale}
                  color={SERIES_COLORS[index % SERIES_COLORS.length]}
                  isHidden={hidden.includes(scale.key)}
                  onToggle={() => toggle(scale.key)}
                />
              ))}
            </div>
          </>
        )}

        {data.totalCheckIns < MIN_OBSERVATIONS_FOR_CORRELATION && data.totalCheckIns > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-2 py-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {data.totalCheckIns} osservazioni su {MIN_OBSERVATIONS_FOR_CORRELATION}: la curva si
            legge, ma non basta per dire che due cose vanno insieme.
          </p>
        )}
      </div>

      {/* Episodes per week */}
      {data.events.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">Episodi per settimana</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full min-w-max">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-left font-medium pr-3 pb-1">Tipo</th>
                  {data.weeks.map((week) => (
                    <th key={week.weekStart} className="px-1.5 pb-1 font-medium whitespace-nowrap">
                      {week.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.key} className="border-t border-slate-100">
                    <td className="pr-3 py-1 text-slate-700 whitespace-nowrap">{event.name}</td>
                    {data.weeks.map((week) => (
                      <td
                        key={week.weekStart}
                        className={cn(
                          'px-1.5 py-1 text-center tabular-nums',
                          week.events[event.key] ? 'text-slate-800 font-medium' : 'text-slate-300'
                        )}
                      >
                        {week.events[event.key] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trigger ranking - the point of logging episodes at all */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Crosshair className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Inneschi più frequenti
            <span className="ml-1.5 font-normal text-[11px] text-slate-400">
              ultimi {data.triggerWindowDays} giorni
            </span>
          </h3>
        </div>
        {data.triggers.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">
            Nessun innesco registrato. Si aggiunge dal riepilogo di un episodio, nel diario.
          </p>
        ) : (
          <div className="space-y-1.5">
            {data.triggers.slice(0, 10).map((entry) => {
              const max = data.triggers[0].count;
              return (
                <div key={entry.trigger} className="flex items-center gap-2">
                  <div className="w-32 sm:w-44 text-xs text-slate-700 truncate shrink-0">
                    {entry.trigger}
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(entry.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums w-6 text-right shrink-0">
                    {entry.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adherence */}
      {data.adherence.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-semibold text-slate-900">Aderenza</h3>
          </div>
          <div className="space-y-2">
            {data.adherence.map((item) => (
              <div key={item.treatmentKey}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 truncate">{item.name}</span>
                  <span className="text-slate-500 tabular-nums shrink-0">
                    {item.taken + item.late}/{item.expected}
                  </span>
                </div>
                <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full"
                    style={{ width: `${Math.min(100, item.takenPct)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {item.taken} prese · {item.late} in ritardo · {item.skipped} saltate ·{' '}
                  {item.recordedPct}% registrato
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side effects: when they appeared, not what shape they have */}
      {data.sideEffects.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Effetti collaterali</h3>
          <div className="space-y-1.5">
            {data.sideEffects.map((effect) => (
              <div key={effect.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-700 truncate">{effect.name}</span>
                <span className="text-slate-400 shrink-0 text-right">
                  {effect.firstSeen
                    ? `dal ${effect.firstSeen.split('-').reverse().join('/')} · ${
                        effect.daysPresent
                      } gg${effect.lastLabel ? ` · ora ${effect.lastLabel}` : ''}`
                    : 'mai segnalato'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight */}
      {data.weight && (
        <div className="card flex items-center gap-3">
          <Scale className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="text-xs text-slate-700">
            Peso: {data.weight.first.weightKg} kg → {data.weight.last.weightKg} kg
            <span className="ml-1.5 text-slate-400">
              ({data.weight.deltaKg > 0 ? '+' : ''}
              {data.weight.deltaKg} kg dal{' '}
              {data.weight.first.date.split('-').reverse().join('/')})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ScaleChip({
  scale,
  color,
  isHidden,
  onToggle,
}: {
  scale: TherapyScaleSeriesDTO;
  color: string;
  isHidden: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] transition-colors',
        isHidden
          ? 'border-slate-200 text-slate-300'
          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
      )}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: isHidden ? '#cbd5e1' : color }}
      />
      {scale.name}
      {scale.isPositive && <span className="text-slate-400">alto = meglio</span>}
    </button>
  );
}
