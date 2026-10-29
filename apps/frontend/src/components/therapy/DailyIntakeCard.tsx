import { useState } from 'react';
import { Loader2, Pill, Settings2 } from 'lucide-react';
import { useIntakeDay, useSetIntakes } from '../../hooks/useTherapyQueries';
import { IntakeChecklist } from './IntakeChecklist';
import { TreatmentManager } from './TreatmentManager';
import type { IntakeStatusDTO } from '@budget/shared';

interface DailyIntakeCardProps {
  date: string;
}

/**
 * The intakes of the day, inside the diary rather than in a section of their
 * own. With an empty catalogue it collapses to a single quiet line, so the
 * module only exists for whoever asks for it.
 */
export function DailyIntakeCard({ date }: DailyIntakeCardProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const day = useIntakeDay(date);
  const setIntakes = useSetIntakes();

  const handleSet = (treatmentKey: string, slot: string, status: IntakeStatusDTO | null) => {
    setIntakes.mutate([{ date, treatmentKey, slot, status }]);
  };

  if (day.isLoading) return null;

  const hasSomething = (day.data?.total ?? 0) > 0;

  if (!hasSomething) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="mb-3 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Pill className="w-3.5 h-3.5" />
          Monitora anche farmaci o integratori
        </button>
        <TreatmentManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
      </>
    );
  }

  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-violet-50 shrink-0">
            <Pill className="w-4 h-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Assunzioni</p>
            <p className="text-[11px] text-slate-400">
              {day.data!.answered} di {day.data!.total} registrate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {setIntakes.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
          <button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Gestisci cosa assumi"
            aria-label="Gestisci cosa assumi"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <IntakeChecklist slots={day.data!.slots} onSet={handleSet} />

      {setIntakes.error && (
        <p className="mt-2 text-xs text-red-600">
          {setIntakes.error instanceof Error
            ? setIntakes.error.message
            : 'Registrazione non riuscita'}
        </p>
      )}

      <TreatmentManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}
