import { useState, type ReactNode } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { RealBalanceChart } from './RealBalanceChart';
import { cn, getCategoryColor, getCategoryLabel, formatCurrency } from '../lib/utils';
import type { CategorySummary, SavingsHistoryDTO } from '@budget/shared';
import { usePeriodStore } from '../hooks/usePeriod';
import { IncomeModal } from './IncomeModal';
import { Pencil, Lock, Maximize2 } from 'lucide-react';
import { SavingsExpandedModal } from './SavingsExpandedModal';

interface BudgetChartProps {
  categories: CategorySummary[];
  totalIncome: number;
  extraSpent?: number; // EXTRA expenses total — shown as recap only, never part of the budget math
  compact?: boolean;
  showStats?: boolean;
  savingsHistory?: SavingsHistoryDTO | null;
  isClosed?: boolean;
  middleSlot?: ReactNode;
  visiblePanel?: 'all' | 'overview' | 'history';
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function CompactBudgetChart({ categories, totalIncome, extraSpent = 0, compact = false, showStats = false, savingsHistory, isClosed = false, middleSlot, visiblePanel = 'all' }: BudgetChartProps) {
  const { periodKey, setPeriodKey } = usePeriodStore();
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isSavingsExpanded, setIsSavingsExpanded] = useState(false);

  // Parse periodKey to get month label
  const [year, month] = periodKey.split('-');
  const currentMonthLabel = `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`;

  const data = categories.map((cat) => ({
    name: getCategoryLabel(cat.category),
    value: cat.actualAmount,
    color: getCategoryColor(cat.category).fill,
    percentage: cat.percentage,
  }));

  const totalSpent = categories.reduce((sum, cat) => sum + cat.actualAmount, 0);
  const unspent = Math.max(0, totalIncome - totalSpent);

  // Add unspent portion
  if (unspent > 0) {
    data.push({
      name: 'Non speso',
      value: unspent,
      color: '#e2e8f0', // slate-200
      percentage: (unspent / totalIncome) * 100,
    });
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-medium text-slate-900">{data.name}</p>
          <p className="text-slate-600">{formatCurrency(data.value)}</p>
          <p className="text-sm text-slate-500">{data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

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

  const remaining = totalIncome - totalSpent;

  if (compact && showStats) {
    const barData = savingsHistory?.months.map((m: { month: number; year: number; savings: number; totalExpenses: number; periodKey: string }) => ({
      name: `${MONTH_LABELS[m.month - 1]} ${String(m.year).slice(2)}`,
      risparmio: m.savings,
      speseTotali: m.totalExpenses,
      periodKey: m.periodKey,
    })) ?? [];

    // Computed by the backend over completed cycles, using the user's own payday
    const avgMonthlySavings = savingsHistory?.averageMonthlySavings ?? null;
    const completedMonthsCount = savingsHistory?.months.filter(
      (m: { periodKey: string }) => m.periodKey < savingsHistory.livePeriodKey
    ).length ?? 0;

    // Savings card: shown in the rail and, enlarged, inside the modal.
    const renderSavingsCard = (history: SavingsHistoryDTO, expanded: boolean) => (
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
              onClick={() => setIsSavingsExpanded(true)}
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
      <div className={cn(
        'grid grid-cols-1 gap-4',
        visiblePanel === 'all' && (middleSlot ? 'md:grid-cols-3' : 'md:grid-cols-2')
      )}>
        {/* Card 1: Budget overview */}
        {(visiblePanel === 'all' || visiblePanel === 'overview') && <div className={cn(
          'card flex flex-col',
          visiblePanel === 'overview' ? 'px-4 py-3 [&_p]:text-[10px] [&_span]:text-[10px]' : 'py-4 px-5'
        )}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">{currentMonthLabel}</p>
          <div className={cn(
            'flex-1 flex flex-col gap-4',
            visiblePanel !== 'overview' && 'sm:flex-row sm:items-center sm:gap-6'
          )}>
            {/* Donut chart - larger */}
            <div className={cn(
              'relative flex-shrink-0 mx-auto sm:mx-0',
              visiblePanel === 'overview' ? 'h-32 w-32' : 'h-36 w-36'
            )}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={visiblePanel === 'overview' ? 34 : 42}
                    outerRadius={visiblePanel === 'overview' ? 54 : 68}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    allowEscapeViewBox={{ x: true, y: true }}
                    wrapperStyle={{ zIndex: 50, outline: 'none', pointerEvents: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm font-bold text-slate-700">
                  {formatCurrency(totalSpent)}
                </p>
              </div>
            </div>

            {/* Legend + Stats */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* Legend */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1">
                {data.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-slate-600">{entry.name}</span>
                    <span className="text-xs font-medium text-slate-800">
                      {entry.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Stats: Entrate, Speso, Rimanente */}
              <div className={cn(
                'flex justify-center gap-4 pt-2 border-t border-slate-100',
                visiblePanel === 'overview' ? 'flex-wrap' : 'sm:justify-start sm:gap-6'
              )}>
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-1">
                    <p className="text-xs text-slate-500">Entrate</p>
                    {isClosed && <Lock className="w-3 h-3 text-slate-400" />}
                  </div>
                  <p className={`text-sm font-bold ${isClosed ? 'text-slate-500' : 'text-slate-900'}`}>
                    {formatCurrency(totalIncome)}
                  </p>
                  {!isClosed && (
                    <button
                      onClick={() => setIsIncomeModalOpen(true)}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded-md px-1.5 py-0.5 sm:-ml-1.5 transition-colors"
                      title="Gestisci le entrate del mese"
                    >
                      <Pencil className="w-3 h-3" />
                      Modifica
                    </button>
                  )}
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">Speso</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">Rimanente</p>
                  <p className={`text-sm font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(remaining)}
                  </p>
                </div>
                <div className="text-center sm:text-left pl-6 border-l border-dashed border-violet-200" title="Spese Extra & Vacanze (Trade Republic) — fuori budget">
                  <p className="text-xs text-violet-500">Extra</p>
                  <p className="text-sm font-bold text-violet-600">
                    {formatCurrency(extraSpent)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>}

        {/* Card 2: Middle slot (e.g. savings gauge) */}
        {visiblePanel === 'all' && middleSlot}

        {/* Card 3: Savings overview */}
        {(visiblePanel === 'all' || visiblePanel === 'history') && savingsHistory && barData.length > 0 && (
          <>
            {renderSavingsCard(savingsHistory, false)}
            {isSavingsExpanded && (
              <SavingsExpandedModal onClose={() => setIsSavingsExpanded(false)}>
                {renderSavingsCard(savingsHistory, true)}
              </SavingsExpandedModal>
            )}
          </>
        )}

        <IncomeModal
          periodKey={periodKey}
          isOpen={isIncomeModalOpen}
          onClose={() => setIsIncomeModalOpen(false)}
        />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="card py-3 px-4">
        <div className="flex items-center gap-4">
          {/* Mini donut chart */}
          <div className="w-20 h-20 relative flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={36}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip />}
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 50, outline: 'none', pointerEvents: 'none' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs font-bold text-slate-700">
                {formatCurrency(totalSpent)}
              </p>
            </div>
          </div>
          {/* Legend inline */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {data.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-slate-600">{entry.name}</span>
                <span className="text-xs font-medium text-slate-800">
                  {entry.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full">
      <h3 className="font-semibold text-slate-900 mb-4">Distribuzione spese</h3>
      <div className="h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip />}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 50, outline: 'none', pointerEvents: 'none' }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-slate-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text - positioned relative to the chart container */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: '36px' }}>
          <div className="text-center">
            <p className="text-sm text-slate-500">Totale</p>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(totalSpent)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
