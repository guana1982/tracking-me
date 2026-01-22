import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getCategoryColor, getCategoryLabel, formatCurrency } from '../lib/utils';
import type { CategorySummary } from '@budget/shared';

interface BudgetChartProps {
  categories: CategorySummary[];
  totalIncome: number;
  compact?: boolean;
}

export function BudgetChart({ categories, totalIncome, compact = false }: BudgetChartProps) {
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
