import { Check, Clock, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { INTAKE_STATUS_LABELS } from '@budget/shared';
import type { IntakeSlotDTO, IntakeStatusDTO } from '@budget/shared';

interface IntakeChecklistProps {
  slots: IntakeSlotDTO[];
  /** null clears the answer, so a wrong tap is always undoable */
  onSet: (treatmentKey: string, slot: string, status: IntakeStatusDTO | null) => void;
  disabled?: boolean;
  /** Off inside the meal form, where the slot is already the meal being logged */
  showSlotNames?: boolean;
}

const OPTIONS: {
  status: IntakeStatusDTO;
  icon: typeof Check;
  active: string;
  idle: string;
}[] = [
  {
    status: 'TAKEN',
    icon: Check,
    active: 'border-emerald-500 bg-emerald-500 text-white',
    idle: 'border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600',
  },
  {
    status: 'LATE',
    icon: Clock,
    active: 'border-amber-500 bg-amber-500 text-white',
    idle: 'border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600',
  },
  {
    status: 'SKIPPED',
    icon: X,
    active: 'border-rose-500 bg-rose-500 text-white',
    idle: 'border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600',
  },
];

/**
 * One tap per row. No streaks, no score, no red day: a skipped dose is a fact
 * to record, not a failure to flag - so nothing here ever congratulates or
 * scolds. Tapping the active state again clears the answer.
 */
export function IntakeChecklist({
  slots,
  onSet,
  disabled,
  showSlotNames = true,
}: IntakeChecklistProps) {
  return (
    <div className="space-y-3">
      {slots.map((slot) => (
        <div key={slot.slot}>
          {showSlotNames && (
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              {slot.slotName}
            </p>
          )}
          <div className="space-y-1.5">
            {slot.items.map((item) => (
              <div
                key={`${slot.slot}-${item.treatmentKey}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.doseLabel ?? 'dose libera'}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isActive = item.status === option.status;
                    return (
                      <button
                        key={option.status}
                        type="button"
                        disabled={disabled}
                        aria-pressed={isActive}
                        aria-label={`${item.name}: ${INTAKE_STATUS_LABELS[option.status]}`}
                        title={INTAKE_STATUS_LABELS[option.status]}
                        onClick={() =>
                          onSet(item.treatmentKey, slot.slot, isActive ? null : option.status)
                        }
                        className={cn(
                          'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-50',
                          isActive ? option.active : option.idle
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
