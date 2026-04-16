import { useState, useRef, type ReactNode } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getCategoryColor, getCategoryLabel, formatCurrency } from '../lib/utils';
import type { CategorySummary, SavingsHistoryDTO } from '@budget/shared';
import { usePeriodStore } from '../hooks/usePeriod';
import { IncomePopover } from './IncomePopover';
import { Pencil, Lock } from 'lucide-react';

interface BudgetChartProps {
  categories: CategorySummary[];
  totalIncome: number;
  compact?: boolean;
  showStats?: boolean;
  savingsHistory?: SavingsHistoryDTO | null;
  isClosed?: boolean;
  middleSlot?: ReactNode;
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function BudgetChart({ categories, totalIncome, compact = false, showStats = false, savingsHistory, isClosed = false, middleSlot }: BudgetChartProps) {
  const { periodKey, setPeriodKey } = usePeriodStore();
  const [isIncomePopoverOpen, setIsIncomePopoverOpen] = useState(false);
  const incomeRef = useRef<HTMLDivElement>(null);

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
          <p className="text-xs text-sky-600">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const remaining = totalIncome - totalSpent;

  if (compact && showStats) {
    const barData = savingsHistory?.months.map((m: { month: number; year: number; savings: number; periodKey: string }) => ({
      name: `${MONTH_LABELS[m.month - 1]} ${String(m.year).slice(2)}`,
      risparmio: m.savings,
      periodKey: m.periodKey,
    })) ?? [];

    return (
      <div className={`grid grid-cols-1 gap-4 ${middleSlot ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {/* Card 1: Budget overview */}
        <div className="card py-4 px-5 flex flex-col">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">{currentMonthLabel}</p>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* Donut chart - larger */}
            <div className="w-36 h-36 relative flex-shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
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
              <div className="flex justify-center sm:justify-start gap-6 pt-2 border-t border-slate-100">
                <div className="text-center sm:text-left relative" ref={incomeRef}>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-slate-500">Entrate</p>
                    {isClosed && <Lock className="w-3 h-3 text-slate-400" />}
                  </div>
                  {isClosed ? (
                    <p className="text-sm font-bold text-slate-500">
                      {formatCurrency(totalIncome)}
                    </p>
                  ) : (
                    <button
                      onClick={() => setIsIncomePopoverOpen(!isIncomePopoverOpen)}
                      className="group flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-sky-600 transition-colors"
                    >
                      {formatCurrency(totalIncome)}
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                  <IncomePopover
                    periodKey={periodKey}
                    isOpen={isIncomePopoverOpen}
                    onClose={() => setIsIncomePopoverOpen(false)}
                    anchorRef={incomeRef}
                  />
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
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Middle slot (e.g. savings gauge) */}
        {middleSlot}

        {/* Card 3: Savings overview */}
        {savingsHistory && barData.length > 0 && (
          <div className="card py-4 px-5 flex flex-col">
            {/* Savings header with labels */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-slate-500">Risparmi mese</p>
                <p className="text-lg font-bold text-sky-600">
                  {formatCurrency(savingsHistory.currentMonthSavings)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500">Mesi precedenti</p>
                <p className="text-lg font-bold text-slate-700">
                  {formatCurrency(savingsHistory.previousMonthsTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Totale risparmi</p>
                <p className="text-lg font-bold text-sky-700">
                  {formatCurrency(savingsHistory.cumulativeTotal)}
                </p>
              </div>
            </div>

            {/* Bar chart - full width, vertically centered in remaining card space */}
            <div className="flex-1 flex items-center min-h-0">
              <div className="h-28 w-full">
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
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip content={<BarChartTooltip />} />
                  <Bar
                    dataKey="risparmio"
                    radius={[3, 3, 0, 0]}
                    cursor="pointer"
                  >
                    {barData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.periodKey === periodKey ? '#0284c7' : '#bae6fd'}
                        opacity={entry.periodKey === periodKey ? 1 : 0.7}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
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
