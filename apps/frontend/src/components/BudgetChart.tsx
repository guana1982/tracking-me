import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getCategoryColor, getCategoryLabel, formatCurrency } from '../lib/utils';
import type { CategorySummary, SavingsHistoryDTO } from '@budget/shared';

interface BudgetChartProps {
  categories: CategorySummary[];
  totalIncome: number;
  compact?: boolean;
  showStats?: boolean;
  savingsHistory?: SavingsHistoryDTO | null;
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function BudgetChart({ categories, totalIncome, compact = false, showStats = false, savingsHistory }: BudgetChartProps) {
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
          <p className="text-xs text-blue-600">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const remaining = totalIncome - totalSpent;

  if (compact && showStats) {
    const barData = savingsHistory?.months.map((m: { month: number; year: number; savings: number }) => ({
      name: `${MONTH_LABELS[m.month - 1]} ${String(m.year).slice(2)}`,
      risparmio: m.savings,
    })) ?? [];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Budget overview */}
        <div className="card py-4 px-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* Donut chart - larger */}
            <div className="w-28 h-28 relative flex-shrink-0 mx-auto sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={52}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-xs font-bold text-slate-700">
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
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">Entrate</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">Speso</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-xs text-slate-500">Rimanente</p>
                  <p className={`text-sm font-bold ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(remaining)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Savings overview */}
        {savingsHistory && barData.length > 0 && (
          <div className="card py-4 px-5">
            {/* Savings header with labels */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-slate-500">Risparmi mese</p>
                <p className="text-lg font-bold text-blue-600">
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
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(savingsHistory.cumulativeTotal)}
                </p>
              </div>
            </div>

            {/* Bar chart - full width */}
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="risparmio" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
                <Tooltip content={<CustomTooltip />} />
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
            <Tooltip content={<CustomTooltip />} />
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
