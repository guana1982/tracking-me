import { ArrowRight, PiggyBank, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { useCreateReallocation, useReallocationPreview } from '../hooks/useQueries';
import type { ReallocationPreviewDTO } from '@budget/shared';

interface ReallocationCardProps {
  periodKey: string;
}

export function ReallocationCard({ periodKey }: ReallocationCardProps) {
  const { data: preview, isLoading } = useReallocationPreview(periodKey);
  const createReallocation = useCreateReallocation(periodKey);

  if (isLoading || !preview) return null;
  if (!preview.available || preview.suggestedAmount <= 0) return null;

  const handleReallocate = async () => {
    if (!preview.suggestedAmount) return;

    try {
      await createReallocation.mutateAsync({
        fromCategory: 'NEEDS',
        toCategory: 'SAVINGS',
        amount: preview.suggestedAmount,
        reason: 'Trasferimento automatico avanzo NEEDS',
      });
    } catch (error) {
      console.error('Failed to reallocate:', error);
    }
  };

  return (
    <div className="card bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          <PiggyBank className="w-6 h-6 text-blue-600" />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 mb-1">
            Avanzo disponibile
          </h3>
          <p className="text-sm text-slate-600 mb-3">
            {preview.isAfterCutoff
              ? `Siamo oltre il giorno ${preview.cutoffDay}. `
              : ''}
            Hai {formatCurrency(preview.needsRemainder)} non spesi in Necessità.
            Vuoi spostarli nei Risparmi?
          </p>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-medium">
                NEEDS
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                SAVINGS
              </span>
            </div>

            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(preview.suggestedAmount)}
            </span>
          </div>
        </div>

        <button
          onClick={handleReallocate}
          disabled={createReallocation.isPending}
          className="btn btn-primary whitespace-nowrap"
        >
          {createReallocation.isPending ? 'Trasferendo...' : 'Trasferisci'}
        </button>
      </div>
    </div>
  );
}
