import { useState } from 'react';
import {
  useSinkingFunds,
  useCreateSinkingFund,
  useUpdateSinkingFund,
  useDeleteSinkingFund,
  useSpendingCategories,
} from '../hooks/useQueries';
import { cn, formatCurrency, formatPeriodKey } from '../lib/utils';
import { Vault, ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';

// Sinking funds ("accantonamenti"): irregular expenses paid in monthly
// installments. Each fund accrues monthlyAmount per period and is drained by
// the expenses classified under its linked spending category, so withdrawals
// are automatic — no manual tagging
export function SinkingFundsCard() {
  const { data: funds, isLoading } = useSinkingFunds();
  const { data: spendingCategories } = useSpendingCategories();
  const createFund = useCreateSinkingFund();
  const updateFund = useUpdateSinkingFund();
  const deleteFund = useDeleteSinkingFund();

  const [expanded, setExpanded] = useState(false);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');

  const totalBalance = (funds ?? []).reduce((sum, fund) => sum + fund.balance, 0);
  const totalMonthly = (funds ?? []).reduce((sum, fund) => sum + fund.monthlyAmount, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!newName.trim() || !newCategoryId || isNaN(amount) || amount <= 0) return;
    try {
      await createFund.mutateAsync({
        name: newName.trim(),
        monthlyAmount: Math.round(amount * 100) / 100,
        spendingCategoryId: newCategoryId,
      });
      setNewName('');
      setNewAmount('');
      setNewCategoryId('');
    } catch (error) {
      console.error('Failed to create sinking fund:', error);
    }
  };

  const saveAmount = async (fundId: string) => {
    const amount = parseFloat(editingAmountValue.replace(',', '.'));
    setEditingAmountId(null);
    if (isNaN(amount) || amount <= 0) return;
    try {
      await updateFund.mutateAsync({
        id: fundId,
        data: { monthlyAmount: Math.round(amount * 100) / 100 },
      });
    } catch (error) {
      console.error('Failed to update sinking fund:', error);
    }
  };

  const handleDelete = async (fundId: string, name: string) => {
    if (confirm(`Eliminare l'accantonamento "${name}"? Le spese collegate non vengono toccate.`)) {
      try {
        await deleteFund.mutateAsync(fundId);
      } catch (error) {
        console.error('Failed to delete sinking fund:', error);
      }
    }
  };

  return (
    <div className="card py-3 shadow-sm bg-white border border-slate-200">
      {/* Accordion header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 text-left"
        title={expanded ? 'Chiudi gli accantonamenti' : 'Apri gli accantonamenti'}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <div className="p-1.5 rounded-lg bg-teal-50 flex-shrink-0">
          <Vault className="w-4 h-4 text-teal-600" />
        </div>
        <h3 className="font-semibold text-sm text-slate-700">Accantonamenti</h3>
        {funds && funds.length > 0 && (
          <span className="text-xs text-slate-400 truncate">
            {funds.length} {funds.length === 1 ? 'fondo' : 'fondi'} ·{' '}
            {formatCurrency(totalMonthly)}/mese · saldo{' '}
            <span className={cn('font-semibold', totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {formatCurrency(totalBalance)}
            </span>
          </span>
        )}
        {funds && funds.length === 0 && (
          <span className="text-xs text-slate-400">
            ratealizza le spese irregolari (vacanze, bollo, regali...)
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {(funds ?? []).map((fund) => {
                const spentRatio =
                  fund.totalAccrued > 0 ? Math.min(1, fund.totalSpent / fund.totalAccrued) : 1;
                return (
                  <div key={fund.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: fund.spendingCategoryColor }}
                      title={`Alimentato dalle spese classificate "${fund.spendingCategoryName}"`}
                    />
                    <div className="w-44 min-w-0 flex-shrink-0">
                      <p className="font-medium text-slate-700 truncate">{fund.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {editingAmountId === fund.id ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={editingAmountValue}
                            onChange={(e) => setEditingAmountValue(e.target.value)}
                            onBlur={() => saveAmount(fund.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveAmount(fund.id);
                              if (e.key === 'Escape') setEditingAmountId(null);
                            }}
                            className="w-16 rounded border border-sky-300 px-1 py-0 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-400"
                          />
                        ) : (
                          <button
                            className="hover:text-slate-600 hover:underline"
                            title="Clicca per modificare la rata mensile"
                            onClick={() => {
                              setEditingAmountId(fund.id);
                              setEditingAmountValue(fund.monthlyAmount.toFixed(2));
                            }}
                          >
                            {formatCurrency(fund.monthlyAmount)}/mese
                          </button>
                        )}{' '}
                        · da {formatPeriodKey(fund.startPeriodKey)} · {fund.spendingCategoryName}
                      </p>
                    </div>
                    {/* Accrued vs spent bar */}
                    <div
                      className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"
                      title={`Accantonati ${formatCurrency(fund.totalAccrued)} (${fund.monthsAccrued} mesi) · spesi ${formatCurrency(fund.totalSpent)}`}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          fund.balance >= 0 ? 'bg-teal-400' : 'bg-red-400'
                        )}
                        style={{ width: `${Math.max(3, spentRatio * 100)}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'w-24 text-right font-bold flex-shrink-0',
                        fund.balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                      )}
                      title={
                        fund.balance >= 0
                          ? 'Disponibile nel fondo: la prossima spesa di questa categoria è già coperta fino a qui'
                          : 'Fondo in rosso: hai speso più di quanto accantonato, valuta di alzare la rata'
                      }
                    >
                      {formatCurrency(fund.balance)}
                    </span>
                    <button
                      onClick={() => handleDelete(fund.id, fund.name)}
                      disabled={deleteFund.isPending}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                      title="Elimina fondo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* New fund form */}
              <form
                onSubmit={handleCreate}
                className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100"
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome (es. Vacanze)"
                  className="input text-sm flex-1"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="€/mese"
                  className="input text-sm w-full sm:w-24"
                />
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  className="input text-sm flex-1"
                  title="Le spese classificate in questa categoria attingono automaticamente dal fondo"
                >
                  <option value="">Categoria collegata...</option>
                  {(spendingCategories ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    createFund.isPending || !newName.trim() || !newCategoryId || !newAmount.trim()
                  }
                  className="btn btn-primary text-sm"
                >
                  {createFund.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </form>
              <p className="text-[11px] text-slate-400">
                Il fondo accumula la rata ogni mese e si svuota da solo con le spese della
                categoria collegata: niente da taggare a mano. Saldo verde = la spesa irregolare è
                già "pagata" dalle rate accantonate.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
