import { useState, useEffect, useRef } from 'react';
import { X, Wallet, ShoppingBag, PiggyBank, Plane, Calendar, Users } from 'lucide-react';
import { cn, getCategoryColor, getCategoryLabel, formatCurrency } from '../lib/utils';
import { useCreateExpense } from '../hooks/useQueries';
import type { Category, TricountType } from '@budget/shared';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodKey: string;
  defaultCategory?: Category;
}

const categories: { value: Category; icon: React.ElementType }[] = [
  { value: 'NEEDS', icon: ShoppingBag },
  { value: 'WANTS', icon: Wallet },
  { value: 'SAVINGS', icon: PiggyBank },
  { value: 'EXTRA', icon: Plane },
];

export function QuickAddModal({ isOpen, onClose, periodKey, defaultCategory }: QuickAddModalProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>(defaultCategory || 'NEEDS');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isFixed, setIsFixed] = useState(false);
  const [tricountType, setTricountType] = useState<TricountType | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const createExpense = useCreateExpense(periodKey);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setAmount('');
      setCategory(defaultCategory || 'NEEDS');
      setLabel('');
      setDate(new Date().toISOString().split('T')[0]);
      setIsFixed(false);
      setTricountType(null);

      // Focus amount input
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [isOpen, defaultCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!label.trim()) return;

    try {
      await createExpense.mutateAsync({
        date,
        category,
        label: label.trim(),
        amount: parsedAmount,
        isFixed,
        tricountType,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create expense:', error);
    }
  };

  // Calculate preview amount for tricount
  const parsedAmountPreview = parseFloat(amount.replace(',', '.'));
  const previewAmount = !isNaN(parsedAmountPreview) && tricountType
    ? parsedAmountPreview / 2
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Nuova spesa</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="label">Importo</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                €
              </span>
              <input
                ref={amountRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="input pl-8 text-2xl font-semibold"
                required
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label">Categoria</label>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((cat) => {
                const colors = getCategoryColor(cat.value);
                const isSelected = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                      isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text}`
                        : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'
                    )}
                  >
                    <cat.icon className="w-5 h-5" />
                    <span className="text-xs font-medium">
                      {getCategoryLabel(cat.value)}
                    </span>
                  </button>
                );
              })}
            </div>
            {category === 'EXTRA' && (
              <p className="mt-2 text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2">
                Spesa fuori budget (Trade Republic): non incide su Speso e Rimanente del mese.
              </p>
            )}
          </div>

          {/* Label */}
          <div>
            <label className="label">Descrizione</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Es. Spesa supermercato"
              className="input"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              required
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="label">Opzioni</label>

            {/* Fixed expense checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <Calendar className="w-4 h-4 text-violet-500" />
              <span className="text-sm text-slate-700">Fisso mese</span>
            </label>

            {/* Tricount toggle */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Tricount:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTricountType(null)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full transition-all',
                    tricountType === null
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setTricountType('IO')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full transition-all',
                    tricountType === 'IO'
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  )}
                >
                  Io
                </button>
                <button
                  type="button"
                  onClick={() => setTricountType('FRA')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full transition-all',
                    tricountType === 'FRA'
                      ? 'bg-pink-500 text-white'
                      : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                  )}
                >
                  Fra
                </button>
              </div>
            </div>

            {/* Preview for tricount */}
            {previewAmount !== null && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                Verrà salvato: <span className="font-semibold text-slate-700">{formatCurrency(previewAmount)}</span> (metà)
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={createExpense.isPending}
            className="w-full btn btn-primary py-3 text-base"
          >
            {createExpense.isPending ? 'Salvataggio...' : 'Aggiungi spesa'}
          </button>
        </form>
      </div>
    </div>
  );
}
