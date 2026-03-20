import { useState, useEffect } from 'react';
import { usePeriodStore } from '../hooks/usePeriod';
import {
  useDashboard,
  useIncomes,
  useCreateIncome,
  useDeleteIncome,
  useUpdateBudgetRule,
} from '../hooks/useQueries';
import { formatCurrency, cn } from '../lib/utils';
import { Loader2, Plus, Trash2, Save, AlertCircle } from 'lucide-react';

export function Settings() {
  const { periodKey } = usePeriodStore();
  const { data: dashboard, isLoading: dashboardLoading } = useDashboard(periodKey);
  const { data: incomes, isLoading: incomesLoading } = useIncomes(periodKey);

  const createIncome = useCreateIncome(periodKey);
  const deleteIncome = useDeleteIncome(periodKey);
  const updateBudgetRule = useUpdateBudgetRule(periodKey);

  // Budget rule state
  const [needsPct, setNeedsPct] = useState(65);
  const [wantsPct, setWantsPct] = useState(25);
  const [savingsPct, setSavingsPct] = useState(10);
  const [cutoffDay, setCutoffDay] = useState(26);
  const [autoReallocate, setAutoReallocate] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // New income state
  const [newIncomeLabel, setNewIncomeLabel] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');

  // Initialize from dashboard data
  useEffect(() => {
    if (dashboard?.budgetRule) {
      setNeedsPct(dashboard.budgetRule.needsPct);
      setWantsPct(dashboard.budgetRule.wantsPct);
      setSavingsPct(dashboard.budgetRule.savingsPct);
      setCutoffDay(dashboard.budgetRule.cutoffDay);
      setAutoReallocate(dashboard.budgetRule.autoReallocateNeedsRemainder);
      setHasChanges(false);
    }
  }, [dashboard?.budgetRule]);

  const totalPct = needsPct + wantsPct + savingsPct;
  const isValidPct = Math.abs(totalPct - 100) < 0.01;

  const handlePctChange = (
    setter: (val: number) => void,
    value: string
  ) => {
    const num = parseFloat(value) || 0;
    setter(Math.max(0, Math.min(100, num)));
    setHasChanges(true);
  };

  const handleSaveBudgetRule = async () => {
    if (!isValidPct) return;

    try {
      await updateBudgetRule.mutateAsync({
        needsPct,
        wantsPct,
        savingsPct,
        cutoffDay,
        autoReallocateNeedsRemainder: autoReallocate,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to update budget rule:', error);
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newIncomeAmount.replace(',', '.'));
    if (!newIncomeLabel.trim() || isNaN(amount) || amount <= 0) return;

    try {
      await createIncome.mutateAsync({
        label: newIncomeLabel.trim(),
        amount,
      });
      setNewIncomeLabel('');
      setNewIncomeAmount('');
    } catch (error) {
      console.error('Failed to create income:', error);
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa entrata?')) {
      try {
        await deleteIncome.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete income:', error);
      }
    }
  };

  if (dashboardLoading || incomesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 xl:space-y-8 sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Impostazioni</h1>

      {/* Budget Rule Section */}
      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Regola budget
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Definisci come allocare il tuo budget mensile tra le categorie.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <label className="label">Necessità (%)</label>
            <input
              type="number"
              value={needsPct}
              onChange={(e) => handlePctChange(setNeedsPct, e.target.value)}
              className="input text-center"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="label">Svago (%)</label>
            <input
              type="number"
              value={wantsPct}
              onChange={(e) => handlePctChange(setWantsPct, e.target.value)}
              className="input text-center"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label className="label">Risparmi (%)</label>
            <input
              type="number"
              value={savingsPct}
              onChange={(e) => handlePctChange(setSavingsPct, e.target.value)}
              className="input text-center"
              min="0"
              max="100"
            />
          </div>
        </div>

        {/* Total indicator */}
        <div
          className={cn(
            'flex items-center gap-2 p-3 rounded-lg mb-6',
            isValidPct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}
        >
          {!isValidPct && <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">
            Totale: {totalPct}%
            {!isValidPct && ' (deve essere 100%)'}
          </span>
        </div>

        {/* Reallocation settings */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h3 className="font-medium text-slate-900">Riallocazione automatica</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">
                Abilita riallocazione avanzo NEEDS
              </p>
              <p className="text-xs text-slate-500">
                Sposta automaticamente l'avanzo delle necessità nei risparmi
              </p>
            </div>
            <button
              onClick={() => {
                setAutoReallocate(!autoReallocate);
                setHasChanges(true);
              }}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                autoReallocate ? 'bg-green-500' : 'bg-slate-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  autoReallocate ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>

          <div>
            <label className="label">Giorno di cutoff</label>
            <input
              type="number"
              value={cutoffDay}
              onChange={(e) => {
                setCutoffDay(Math.max(1, Math.min(31, parseInt(e.target.value) || 26)));
                setHasChanges(true);
              }}
              className="input w-24"
              min="1"
              max="31"
            />
            <p className="text-xs text-slate-500 mt-1">
              Dal giorno {cutoffDay} sarà possibile riallocare l'avanzo
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-6">
          <button
            onClick={handleSaveBudgetRule}
            disabled={!hasChanges || !isValidPct || updateBudgetRule.isPending}
            className="btn btn-primary"
          >
            {updateBudgetRule.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salva modifiche
          </button>
        </div>
      </section>

      {/* Income Section */}
      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Entrate mensili
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Gestisci le tue entrate per questo mese. Il budget si calcola sulla
          base del totale delle entrate.
        </p>

        {/* Income List */}
        <div className="space-y-3 mb-6">
          {incomes?.length === 0 ? (
            <p className="text-slate-500 text-center py-4">
              Nessuna entrata registrata
            </p>
          ) : (
            incomes?.map((income) => (
              <div
                key={income.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-slate-900">{income.label}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(income.amount)}
                  </p>
                  <button
                    onClick={() => handleDeleteIncome(income.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        {incomes && incomes.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-slate-900 text-white rounded-lg mb-6">
            <span className="font-medium">Totale entrate</span>
            <span className="text-xl font-bold">
              {formatCurrency(incomes.reduce((sum, i) => sum + i.amount, 0))}
            </span>
          </div>
        )}

        {/* Add Income Form */}
        <form onSubmit={handleAddIncome} className="space-y-4">
          <h3 className="font-medium text-slate-900">Aggiungi entrata</h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={newIncomeLabel}
                onChange={(e) => setNewIncomeLabel(e.target.value)}
                placeholder="Descrizione (es. Stipendio)"
                className="input"
              />
            </div>
            <div className="w-32">
              <input
                type="text"
                inputMode="decimal"
                value={newIncomeAmount}
                onChange={(e) => setNewIncomeAmount(e.target.value)}
                placeholder="Importo"
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={createIncome.isPending}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
