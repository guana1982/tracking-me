import { useState } from 'react';
import {
  ComposedChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { SavingsHistoryDTO } from '@budget/shared';
import { cn, formatCurrency } from '../lib/utils';

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

interface RealBalanceChartProps {
  history: SavingsHistoryDTO;
  periodKey: string;
  onSelectPeriod: (periodKey: string) => void;
  /** Larger chart and labels, used by the expanded savings modal. */
  expanded?: boolean;
}

interface RealBalanceRow {
  name: string;
  periodKey: string;
  saldo: number | null;
  // In-progress cycle only: balance so far (the bar shows the projection)
  finora: number | null;
  cumulato: number | null;
  inProgress: boolean;
}

/**
 * Monthly real balance (income - real outflows) with its average and a
 * year-to-date cumulative line. The in-progress cycle is drawn apart and kept
 * out of average and cumulative; the toggle drops extraordinary income to show
 * the structural balance (what the salary alone leaves).
 */
export function RealBalanceChart({ history, periodKey, onSelectPeriod, expanded = false }: RealBalanceChartProps) {
  const [structural, setStructural] = useState(false);
  const { livePeriodKey } = history;
  const liveYear = livePeriodKey.slice(0, 4);

  const valueOf = (m: { realBalance: number; extraordinaryIncome: number }) =>
    structural ? m.realBalance - m.extraordinaryIncome : m.realBalance;

  const projectionOf = (m: { projectedRealBalance: number | null; extraordinaryIncome: number }) =>
    m.projectedRealBalance != null
      ? m.projectedRealBalance - (structural ? m.extraordinaryIncome : 0)
      : null;

  let running = 0;
  const rows: RealBalanceRow[] = history.months.map((m) => {
    const inProgress = m.periodKey === livePeriodKey;
    const completed = m.periodKey < livePeriodKey;
    // Year-to-date: the cumulative restarts with the live cycle's year
    if (completed && m.periodKey.startsWith(liveYear)) running += valueOf(m);
    return {
      name: `${MONTH_LABELS[m.month - 1]} ${String(m.year).slice(2)}`,
      periodKey: m.periodKey,
      saldo: completed
        ? round2(valueOf(m))
        : inProgress
          ? round2(projectionOf(m) ?? valueOf(m))
          : null,
      finora: inProgress ? round2(valueOf(m)) : null,
      cumulato: completed && m.periodKey.startsWith(liveYear) ? Math.round(running * 100) / 100 : null,
      inProgress,
    };
  });

  const completedCount = history.months.filter((m) => m.periodKey < livePeriodKey).length;
  const average = structural ? history.averageStructuralBalance : history.averageRealBalance;
  const live = history.months.find((m) => m.periodKey === livePeriodKey);
  const liveProjection = live ? projectionOf(live) : null;
  const ytd = rows.some((r) => r.cumulato !== null) ? running : null;

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as RealBalanceRow;
    if (row.saldo === null) return null;
    return (
      <div className="bg-white p-2 rounded-lg shadow-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-900">
          {label}
          {row.inProgress && <span className="ml-1 font-normal text-slate-400">(in corso)</span>}
        </p>
        <p className={`text-xs ${row.saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {row.inProgress ? 'Proiezione a fine periodo' : structural ? 'Saldo strutturale' : 'Saldo del mese'}{' '}
          {formatCurrency(row.saldo)}
        </p>
        {row.finora !== null && (
          <p className="text-xs text-slate-500">Finora {formatCurrency(row.finora)}</p>
        )}
        {row.cumulato !== null && (
          <p className="text-xs text-indigo-600">Da inizio anno {formatCurrency(row.cumulato)}</p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className="text-[11px] font-medium text-slate-500"
          title="Entrate del mese meno tutte le uscite reali (Necessità, Svago, Extra). I bonifici in Risparmi non sono uscite; riporti e avanzi portati avanti sono esclusi."
        >
          {structural ? 'Saldo strutturale mensile' : 'Saldo reale mensile'}
        </p>
        <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={structural}
            onChange={(e) => setStructural(e.target.checked)}
            className="h-3 w-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          Escludi entrate straordinarie
        </label>
      </div>
      <div className="mb-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
        {average !== null && (
          <span title="Solo mesi chiusi: il mese in corso è escluso">
            media{' '}
            <span className={cn('font-semibold', average >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatCurrency(average)}
            </span>{' '}
            su {completedMonths(completedCount)}
          </span>
        )}
        {ytd !== null && (
          <span>
            da inizio anno{' '}
            <span className={cn('font-semibold', ytd >= 0 ? 'text-indigo-600' : 'text-red-600')}>
              {formatCurrency(ytd)}
            </span>
          </span>
        )}
        {liveProjection !== null && (
          <span title="Uscite fisse come registrate, variabili al ritmo giornaliero attuale fino al payday">
            in corso, proiezione{' '}
            <span className={cn('font-semibold', liveProjection >= 0 ? 'text-slate-700' : 'text-red-600')}>
              {formatCurrency(liveProjection)}
            </span>
          </span>
        )}
      </div>
      <div className={cn('w-full', expanded ? 'h-56' : 'h-28')}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            onClick={(data) => {
              if (data?.activePayload?.[0]?.payload?.periodKey) {
                onSelectPeriod(data.activePayload[0].payload.periodKey);
              }
            }}
          >
            <defs>
              <pattern id="real-balance-in-progress" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="4" fill="#e2e8f0" />
                <line x1="0" y1="0" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1.5" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: expanded ? 12 : 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: expanded ? 12 : 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
            <Tooltip content={renderTooltip} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            {average !== null && (
              <ReferenceLine
                y={average}
                stroke="#059669"
                strokeDasharray="4 4"
                label={{ value: 'media', position: 'insideTopRight', fontSize: 9, fill: '#059669' }}
              />
            )}
            <Bar dataKey="saldo" radius={[3, 3, 0, 0]} cursor="pointer">
              {rows.map((row, index) => {
                const selected = row.periodKey === periodKey;
                if (row.inProgress) {
                  return (
                    <Cell
                      key={`real-cell-${index}`}
                      fill="url(#real-balance-in-progress)"
                      stroke="#94a3b8"
                      strokeDasharray="3 2"
                    />
                  );
                }
                return (
                  <Cell
                    key={`real-cell-${index}`}
                    fill={
                      (row.saldo ?? 0) < 0
                        ? selected ? '#dc2626' : '#fca5a5'
                        : selected ? '#059669' : '#a7f3d0'
                    }
                    opacity={selected ? 1 : 0.75}
                  />
                );
              })}
            </Bar>
            <Line
              dataKey="finora"
              stroke="none"
              dot={{ r: 3, fill: '#475569', stroke: '#fff', strokeWidth: 1 }}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cumulato"
              stroke="#4f46e5"
              strokeWidth={1.5}
              dot={{ r: 2, fill: '#4f46e5' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function completedMonths(count: number): string {
  return count === 1 ? '1 mese' : `${count} mesi`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
