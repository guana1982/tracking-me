import { useEffect } from 'react';
import { X, PiggyBank, ArrowRightCircle, Undo2, Loader2, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

interface ReallocationChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthLabel: string; // current month, e.g. "luglio 2026"
  nextMonthLabel: string; // next month, e.g. "agosto 2026"
  surplusAmount: number; // surplus available to reallocate
  savingsActive: boolean; // surplus already sent to SAVINGS
  savingsAmount: number;
  forwardActive: boolean; // surplus already moved to the next month
  forwardAmount: number;
  isPending: boolean;
  onSavings: () => void;
  onForward: () => void;
  onUndoSavings: () => void;
  onUndoForward: () => void;
}

/**
 * Popup shown after the cutoff when a month has leftover surplus. Offers two
 * mutually exclusive destinations for it: keep it as savings (current month) or
 * carry it forward as an income line of the next month. When one is already
 * active, the modal shows that state and lets the user undo it.
 */
export function ReallocationChoiceModal({
  isOpen,
  onClose,
  monthLabel,
  nextMonthLabel,
  surplusAmount,
  savingsActive,
  savingsAmount,
  forwardActive,
  forwardAmount,
  isPending,
  onSavings,
  onForward,
  onUndoSavings,
  onUndoForward,
}: ReallocationChoiceModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const done = savingsActive || forwardActive;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => !isPending && onClose()} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-sky-50">
              <ArrowRightCircle className="w-5 h-5 text-sky-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">Rialloca il surplus</h2>
              <p className="text-xs text-slate-400 capitalize">{monthLabel}</p>
            </div>
          </div>
          <button
            onClick={() => !isPending && onClose()}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 overflow-y-auto">
          {/* Amount headline */}
          <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
            <p className="text-xs font-medium text-slate-500">
              {done ? 'Surplus riallocato' : 'Surplus disponibile'}
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(done ? (savingsActive ? savingsAmount : forwardAmount) : surplusAmount)}
            </p>
          </div>

          {savingsActive ? (
            /* Already sent to savings */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <PiggyBank className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-semibold">Destinato ai risparmi</p>
              </div>
              <p className="mt-1 text-xs text-emerald-600">
                Il surplus conta come risparmio di {monthLabel}. Per spostarlo al mese successivo,
                annulla prima questa riallocazione.
              </p>
              <button
                onClick={onUndoSavings}
                disabled={isPending}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm bg-white text-amber-700 border border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                Annulla riallocazione
              </button>
            </div>
          ) : forwardActive ? (
            /* Already moved to next month */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <ArrowRightCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-semibold capitalize">Spostato a {nextMonthLabel}</p>
              </div>
              <p className="mt-1 text-xs text-emerald-600">
                Aggiunto come entrata «Riallocazione positiva» del mese successivo. Per destinarlo
                invece ai risparmi, annulla prima lo spostamento.
              </p>
              <button
                onClick={onUndoForward}
                disabled={isPending}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm bg-white text-amber-700 border border-amber-300 hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                Annulla spostamento
              </button>
            </div>
          ) : (
            /* Neither done yet: offer the two choices */
            <div className="space-y-3">
              <button
                onClick={onSavings}
                disabled={isPending}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors',
                  'border-slate-200 hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <div className="p-2 rounded-lg bg-emerald-50 flex-shrink-0">
                  <PiggyBank className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Metti nei risparmi</p>
                  <p className="text-xs text-slate-500 capitalize">Conta come risparmio di {monthLabel}</p>
                </div>
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                )}
              </button>

              <button
                onClick={onForward}
                disabled={isPending}
                className={cn(
                  'w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors',
                  'border-slate-200 hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <div className="p-2 rounded-lg bg-sky-50 flex-shrink-0">
                  <ArrowRightCircle className="w-5 h-5 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 capitalize">Sposta a {nextMonthLabel}</p>
                  <p className="text-xs text-slate-500 capitalize">Diventa un'entrata di {nextMonthLabel}</p>
                </div>
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                )}
              </button>

              <p className="text-[11px] text-slate-400 text-center pt-1">
                Le due destinazioni sono alternative: lo stesso surplus va nei risparmi oppure al mese
                successivo, non entrambi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
