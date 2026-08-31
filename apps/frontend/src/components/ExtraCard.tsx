import { cn, formatCurrency, getCategoryColor } from '../lib/utils';
import { Plane } from 'lucide-react';

interface ExtraCardProps {
  spent: number;
  count: number;
}

// Card for EXTRA expenses (Trade Republic): tracked outside the 65/25/10 budget,
// so no target/progress — just the running total for the month.
export function ExtraCard({ spent, count }: ExtraCardProps) {
  const colors = getCategoryColor('EXTRA');

  return (
    <div className={cn('card py-3 shadow-sm', colors.bg, colors.border, 'border')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', colors.bg)}>
            <Plane className={cn('w-4 h-4', colors.text)} />
          </div>
          <h3 className={cn('font-semibold text-sm', colors.text)}>
            Extra & Vacanze
          </h3>
        </div>
        <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
          Fuori budget
        </div>
      </div>

      {/* Separator aligned with the progress bar of the other cards */}
      <div className="mb-3">
        <div className="h-3 flex items-center">
          <div className="w-full border-t border-dashed border-violet-200" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-slate-400 text-xs">Speso</span>
            <p className="font-semibold text-slate-700">{formatCurrency(spent)}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs">Conto</span>
            <p className="font-medium text-slate-600">Trade Republic</p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-lg text-sm font-bold bg-violet-100 text-violet-700">
          {count} {count === 1 ? 'voce' : 'voci'}
        </div>
      </div>
    </div>
  );
}
