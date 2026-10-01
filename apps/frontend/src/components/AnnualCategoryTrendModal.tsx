import type { SpendingBreakdownItemDTO } from '@budget/shared';
import { BarChart3, Loader2, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAllExpensesGlobal } from '../hooks/useQueries';
import { formatCurrency } from '../lib/utils';

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

interface AnnualCategoryTrendModalProps {
  selected: SpendingBreakdownItemDTO;
  year: number;
  onClose: () => void;
  onSelectMonth: (periodKey: string) => void;
}

export function AnnualCategoryTrendModal({ selected, year, onClose, onSelectMonth }: AnnualCategoryTrendModalProps) {
  const { data, isLoading } = useAllExpensesGlobal(true);
  const monthlyData = MONTH_NAMES.map((month, index) => {
    const periodKey = `${year}-${String(index + 1).padStart(2, '0')}`;
    const amount = (data ?? [])
      .filter((expense) =>
        expense.periodKey === periodKey &&
        expense.category !== 'SAVINGS' &&
        (expense.spendingCategoryId ?? null) === selected.categoryId
      )
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { month, periodKey, amount: Math.round(amount * 100) / 100 };
  });
  const annualTotal = monthlyData.reduce((sum, month) => sum + month.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg p-2" style={{ backgroundColor: `${selected.color}20` }}>
              <BarChart3 className="h-5 w-5" style={{ color: selected.color }} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900">{selected.name}</h2>
              <p className="text-sm text-slate-500">Andamento mensile {year} · {formatCurrency(annualTotal)} totali</p>
              <p className="text-xs text-slate-400">Clicca su una barra per vedere le spese del mese</p>
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label="Chiudi andamento annuale">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-[420px] p-4 sm:p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 12, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis tickFormatter={(value: number) => `${value} €`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), selected.name]} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="amount" fill={selected.color} radius={[5, 5, 0, 0]} maxBarSize={46} className="cursor-pointer" onClick={(entry) => onSelectMonth(entry.periodKey)} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
