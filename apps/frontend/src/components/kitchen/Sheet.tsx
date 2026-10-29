import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** A bottom sheet on a phone, a centred dialog from sm up */
export function Sheet({ isOpen, onClose, title, subtitle, icon, footer, children }: SheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0">{icon}</div>}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
              {subtitle && <div className="text-xs text-slate-500 truncate">{subtitle}</div>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 shrink-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto overscroll-contain">{children}</div>

        {footer && <div className="px-4 py-3 border-t border-slate-100 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
