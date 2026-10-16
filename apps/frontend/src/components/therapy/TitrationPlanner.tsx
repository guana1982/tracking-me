import { useState } from 'react';
import { Check, Loader2, Plus, TrendingUp, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useApplyTitrationStep,
  useCreateTitrationStep,
  useDeleteTitrationStep,
  useTitration,
} from '../../hooks/useTherapyPlanQueries';
import type { TreatmentDefinitionDTO } from '@budget/shared';

interface TitrationPlannerProps {
  treatment: TreatmentDefinitionDTO;
}

/**
 * The planned dose changes of one treatment (§3.1). Written down in advance
 * so the schedule can warn about them and so the weekly charts can mark the
 * day the dose moved - the single most useful thing to see next to a curve.
 *
 * Applying a step is an explicit act: the app must not claim the dose changed
 * in real life just because a date went by.
 */
export function TitrationPlanner({ treatment }: TitrationPlannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState('');
  const [dose, setDose] = useState('');

  const titration = useTitration();
  const createStep = useCreateTitrationStep();
  const applyStep = useApplyTitrationStep();
  const deleteStep = useDeleteTitrationStep();

  const steps = (titration.data ?? []).filter((step) => step.treatmentKey === treatment.key);
  const isPending = createStep.isPending || applyStep.isPending || deleteStep.isPending;

  const handleAdd = async () => {
    if (!date || !dose.trim()) return;
    await createStep.mutateAsync({ treatmentKey: treatment.key, date, dose: dose.trim() });
    setDate('');
    setDose('');
    setIsOpen(false);
  };

  return (
    <div className="mt-1">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-1.5 text-[11px]">
          <TrendingUp className="w-3 h-3 text-teal-600 shrink-0" />
          <span className={cn(step.applied ? 'text-slate-400' : 'text-teal-800')}>
            dal {step.date.split('-').reverse().join('/')} → {step.dose}
          </span>
          {step.applied ? (
            <span className="text-slate-400">· applicato</span>
          ) : (
            <button
              type="button"
              onClick={() => applyStep.mutate(step.id)}
              disabled={isPending}
              className="text-teal-700 hover:underline disabled:opacity-50"
            >
              applica
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteStep.mutate(step.id)}
            disabled={isPending}
            className="text-slate-300 hover:text-red-500 disabled:opacity-50"
            aria-label="Elimina tappa"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}

      {isOpen ? (
        <div className="mt-1 flex items-center gap-1">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="px-1.5 py-0.5 rounded border border-slate-200 text-[11px]"
          />
          <input
            value={dose}
            onChange={(event) => setDose(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleAdd();
              if (event.key === 'Escape') setIsOpen(false);
            }}
            placeholder="nuova dose"
            maxLength={60}
            className="w-24 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={!date || !dose.trim() || isPending}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-40"
            aria-label="Salva tappa"
          >
            {createStep.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 hover:text-teal-700"
        >
          <Plus className="w-3 h-3" />
          Programma un cambio di dose
        </button>
      )}
    </div>
  );
}
