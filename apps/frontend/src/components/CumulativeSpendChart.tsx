import { Area, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { CumulativeSpendDTO } from '@budget/shared';
import { formatCurrency } from '../lib/utils';

interface CumulativeSpendChartProps {
  data?: CumulativeSpendDTO | null;
}

const CURRENT_COLOR = '#2563eb';
const AVERAGE_COLOR = '#64748b';

function periodLabel(periodKey: string) {
  const [year, month] = periodKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

function cycleDate(cycleStart: string, day: number) {
  const [y, m, d] = cycleStart.split('-').map(Number);
  return new Date(y, m - 1, d + day - 1).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const euroTick = (value: number) => `${Math.round(value)}\u00a0€`;

export function CumulativeSpendChart({ data }: CumulativeSpendChartProps) {
  if (!data) return null;

  const hasAverage = data.average.length > 0;
  const points = Array.from({ length: data.cycleLengthDays }, (_, i) => ({
    day: i + 1,
    current: i < data.current.length ? data.current[i] : undefined,
    average: hasAverage ? data.average[i] : undefined,
  }));

  const today = data.daysElapsed;
  const spentToday = data.current[today - 1] ?? 0;
  const usualToday = hasAverage ? data.average[today - 1] : 0;
  const deltaPct = usualToday > 0 ? Math.round(((spentToday - usualToday) / usualToday) * 100) : null;
  const ticks = points.filter((p) => (p.day - 1) % 4 === 0).map((p) => p.day);
  const comparisonCount = data.comparisonPeriodKeys.length;

  return (
    <div className="card py-4 px-5">
      <p className="text-sm font-semibold text-slate-900">
        {data.daysElapsed < data.cycleLengthDays ? 'Mese in corso' : 'Andamento del mese'}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">
        Spesa cumulata giorno per giorno, confrontata con la media dei mesi completi da gennaio
        {comparisonCount > 0 && ` (${comparisonCount} ${comparisonCount === 1 ? 'mese' : 'mesi'})`}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CURRENT_COLOR }} />
          {periodLabel(data.periodKey)}
        </span>
        {hasAverage && (
          <span className="flex items-center gap-1">
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: AVERAGE_COLOR }} />
            Media mesi completi
          </span>
        )}
      </div>

      <div className="h-44 mt-2 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, data.cycleLengthDays]}
              ticks={ticks}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tickFormatter={euroTick}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              labelFormatter={(day) => `Giorno ${day} · ${cycleDate(data.cycleStart, Number(day))}`}
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === 'current' ? periodLabel(data.periodKey) : 'Media mesi completi',
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            {hasAverage && (
              <Line
                dataKey="average"
                stroke={AVERAGE_COLOR}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Area
              dataKey="current"
              stroke={CURRENT_COLOR}
              strokeWidth={2}
              fill={CURRENT_COLOR}
              fillOpacity={0.12}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <ReferenceDot x={today} y={spentToday} r={4} fill={CURRENT_COLOR} stroke="#ffffff" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
        Al giorno {today} sei a <strong className="text-slate-900">{formatCurrency(spentToday)}</strong>
        {hasAverage ? (
          <>
            ; di solito a questo punto sei a {formatCurrency(usualToday)}
            {deltaPct !== null && (
              <span
                className={`ml-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  deltaPct <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {deltaPct > 0 ? '+' : ''}{deltaPct}%
              </span>
            )}
            .
          </>
        ) : (
          '. Non ci sono ancora mesi completi quest\'anno con cui confrontarlo.'
        )}
        {data.fixedSpend > 0 && ' Le spese fisse contano dal primo giorno, quindi la curva sale subito.'}
        {' Contano Necessità, Svago ed Extra & Vacanze; i versamenti nei Risparmi non sono uscite e restano fuori.'}
      </p>
    </div>
  );
}
