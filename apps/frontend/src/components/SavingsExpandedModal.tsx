import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PiggyBank, X } from 'lucide-react';

interface SavingsExpandedModalProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * Large centered modal showing the savings card at full size.
 * Rendered in a portal so the sticky, scrollable dashboard rail does not clip it.
 */
export function SavingsExpandedModal({ onClose, children }: SavingsExpandedModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Risparmi"
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-6xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">Risparmi</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
