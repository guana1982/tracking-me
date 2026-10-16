import { useState } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts';
import type { SavingsHistoryDTO } from '@budget/shared';
import { Maximize2 } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { usePeriodStore } from '../hooks/usePeriod';
import { RealBalanceChart } from './RealBalanceChart';
import { SavingsExpandedModal } from './SavingsExpandedModal';

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const BarChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 rounded-lg shadow-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-900">{label}</p>
        <p className={`text-xs ${payload[0].value < 0 ? 'text-red-600' : 'text-sky-600'}`}>
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

interface SavingsHistoryCardProps {
  history: SavingsHistoryDTO;
}

/**
 * Savings overview card (net monthly savings, real balance, total expenses).
 * The expand button opens the same card enlarged in a centered modal.
 */
export function SavingsHistoryCard({ history }: SavingsHistoryCardProps) {
  const { periodKey, setPeriodKey } = usePeriodStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const barData = history.months.map((m) => ({
    name: `${MONTH_LABELS[m.month - 1]} ${String(m.year).slice(2)}`,
    risparmio: m.savings,
    speseTotali: m.totalExpenses,
    periodKey: m.periodKey,
  }));

  // Computed by the backend over completed cycles, using the user's own payday
  const avgMonthlySavings = history.averageMonthlySavings ?? null;
  const completedMonthsCount = history.months.filter((m) => m.periodKey < history.livePeriodKey).length;

  if (barData.length === 0) return null;

  const renderCard = (expanded: boolean) => (
  <div className={cn('flex flex-col', expanded ? 'p-6' : 'card py-4 px-5')}>
    {/* Savings header with labels */}
    <div className={cn('flex justify-between items-start', expanded ? 'mb-6 gap-6' : 'mb-3')}>
      <div>
        <p className={cn('text-slate-500', expanded ? 'text-sm' : 'text-xs')}>Accantonato mese</p>
        <p className={cn(expanded ? 'text-3xl' : 'text-lg', 'font-bold', 'text-sky-600')}>
          {formatCurrency(history.currentMonthSavings)}
        </p>
      </div>
      <div className="text-center">
        <p className={cn('text-slate-500', expanded ? 'text-sm' : 'text-xs')}>Mesi precedenti</p>
        <p className={cn(expanded ? 'text-3xl' : 'text-lg', 'font-bold', 'text-slate-700')}>
          {formatCurrency(history.previousMonthsTotal)}
        </p>
      </div>
      {avgMonthlySavings !== null && (
        <div className="text-center" title={`Media dell'accantonato netto sui ${completedMonthsCount} mesi completi (mese in corso escluso)`}>
          <p className={cn('text-slate-500', expanded ? 'text-sm' : 'text-xs')}>Media / mese</p>
          <p className={cn(expanded ? 'text-3xl' : 'text-lg', 'font-bold', avgMonthlySavings >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {formatCurrency(avgMonthlySavings)}
          </p>
        </div>
      )}
      <div className="text-right">
        <p className={cn('text-slate-500', expanded ? 'text-sm' : 'text-xs')}>Accantonato netto</p>
        <p className={cn(expanded ? 'text-3xl' : 'text-lg', 'font-bold', 'text-sky-700')}>
          {formatCurrency(history.cumulativeTotal)}
        </p>
      </div>
      {!expanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="-mr-2 -mt-1 flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="Ingrandisci"
          aria-label="Ingrandisci risparmi"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}
    </div>

    {/* Monthly savings and total-expenses histograms */}
    <div className={cn('flex flex-1 flex-col justify-center min-h-0', expanded ? 'gap-8' : 'gap-4')}>
      <div>
        <p className={cn('mb-1 font-medium text-slate-500', expanded ? 'text-sm' : 'text-[11px]')}>Accantonato netto mensile</p>
        <div className={cn('w-full', expanded ? 'h-56' : 'h-28')}>
        <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={barData}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          onClick={(data) => {
            if (data?.activePayload?.[0]?.payload?.periodKey) {
              setPeriodKey(data.activePayload[0].payload.periodKey);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: expanded ? 12 : 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: expanded ? 12 : 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip content={<BarChartTooltip />} />
          {avgMonthlySavings !== null && (
            <ReferenceLine
              y={avgMonthlySavings}
              stroke="#059669"
              strokeDasharray="4 4"
              label={{ value: 'media', position: 'insideTopRight', fontSize: expanded ? 11 : 9, fill: '#059669' }}
            />
          )}
          <Bar
            dataKey="risparmio"
            radius={[3, 3, 0, 0]}
            cursor="pointer"
          >
            {barData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.risparmio < 0
                    ? entry.periodKey === periodKey ? '#dc2626' : '#fca5a5'
                    : entry.periodKey === periodKey ? '#0284c7' : '#bae6fd'
                }
                opacity={entry.periodKey === periodKey ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
        </div>
      </div>

      <RealBalanceChart history={history} periodKey={periodKey} onSelectPeriod={setPeriodKey} expanded={expanded} />

      <div>
        <p className={cn('mb-1 font-medium text-slate-500', expanded ? 'text-sm' : 'text-[11px]')}>Spese totali mensili</p>
        <div className={cn('w-full', expanded ? 'h-56' : 'h-28')}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              onClick={(data) => {
                if (data?.activePayload?.[0]?.payload?.periodKey) {
                  setPeriodKey(data.activePayload[0].payload.periodKey);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: expanded ? 12 : 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: expanded ? 12 : 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
              <Tooltip content={<BarChartTooltip />} />
              <Bar dataKey="speseTotali" radius={[3, 3, 0, 0]} cursor="pointer">
                {barData.map((entry, index) => (
                  <Cell
                    key={`total-cell-${index}`}
                    fill={entry.periodKey === periodKey ? '#4f46e5' : '#a5b4fc'}
                    opacity={entry.periodKey === periodKey ? 1 : 0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
  );

  return (
    <>
      {renderCard(false)}
      {isExpanded && (
        <SavingsExpandedModal onClose={() => setIsExpanded(false)}>
          {renderCard(true)}
        </SavingsExpandedModal>
      )}
    </>
  );
}
