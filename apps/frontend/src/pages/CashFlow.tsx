import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'budget-cashflow-checks-v1';

type CashFlowRow = {
  id: string;
  checkLabel: string;
  date: string;
  bbva: number;
  tradeRepublic: number;
  webankCc: number;
  webankObbl: number;
  etfNetto: number;
  bper: number;
  tricount: number;
  cartaWebank: number;
  edenred: number;
  notes: string;
};

type CashFlowFormState = {
  checkLabel: string;
  date: string;
  bbva: string;
  tradeRepublic: string;
  webankCc: string;
  webankObbl: string;
  etfNetto: string;
  bper: string;
  tricount: string;
  cartaWebank: string;
  edenred: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const INITIAL_FORM: CashFlowFormState = {
  checkLabel: '',
  date: today,
  bbva: '',
  tradeRepublic: '',
  webankCc: '',
  webankObbl: '',
  etfNetto: '',
  bper: '',
  tricount: '',
  cartaWebank: '',
  edenred: '',
  notes: '',
};

function parseAmount(value: string): number {
  if (!value.trim()) return 0;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeTotal(row: CashFlowRow): number {
  return (
    row.bbva +
    row.tradeRepublic +
    row.webankCc +
    row.webankObbl +
    row.etfNetto +
    row.bper +
    row.tricount +
    row.cartaWebank +
    row.edenred
  );
}

function buildCheckLabel(input: string, index: number): string {
  const trimmed = input.trim();
  if (trimmed) return trimmed;
  return `CHECK ${index + 1}`;
}

export function CashFlow() {
  const [rows, setRows] = useState<CashFlowRow[]>([]);
  const [form, setForm] = useState<CashFlowFormState>(INITIAL_FORM);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CashFlowRow[];
      if (Array.isArray(parsed)) {
        setRows(parsed);
      }
    } catch (error) {
      console.error('Failed to read cash flow data from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error('Failed to save cash flow data to localStorage:', error);
    }
  }, [rows]);

  const rowsWithComputed = useMemo(() => {
    return rows.map((row, index) => {
      const total = computeTotal(row);
      const prevTotal = index > 0 ? computeTotal(rows[index - 1]) : null;
      const diff = prevTotal === null ? null : total - prevTotal;

      return {
        ...row,
        total,
        diff,
      };
    });
  }, [rows]);

  const latestRow = rowsWithComputed.length > 0 ? rowsWithComputed[rowsWithComputed.length - 1] : null;
  const positiveDiffCount = rowsWithComputed.filter((row) => (row.diff ?? 0) > 0).length;

  const handleInputChange = (key: keyof CashFlowFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const nextIndex = rows.length;
    const newRow: CashFlowRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      checkLabel: buildCheckLabel(form.checkLabel, nextIndex),
      date: form.date || today,
      bbva: parseAmount(form.bbva),
      tradeRepublic: parseAmount(form.tradeRepublic),
      webankCc: parseAmount(form.webankCc),
      webankObbl: parseAmount(form.webankObbl),
      etfNetto: parseAmount(form.etfNetto),
      bper: parseAmount(form.bper),
      tricount: parseAmount(form.tricount),
      cartaWebank: parseAmount(form.cartaWebank),
      edenred: parseAmount(form.edenred),
      notes: form.notes.trim(),
    };

    setRows((prev) => [...prev, newRow]);
    setForm((prev) => ({
      ...INITIAL_FORM,
      date: prev.date || today,
    }));
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <div className="sm:ml-16 space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Cash Flow Patrimonio</h2>
        <p className="text-sm text-slate-500 mt-1">
          Base iniziale: inserisci i check periodici, salva in locale e calcola Tot Attuale e Diff Tot.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Check totali</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{rowsWithComputed.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ultimo Tot Attuale</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {latestRow ? formatCurrency(latestRow.total) : formatCurrency(0)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Check in crescita</p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums mt-1">{positiveDiffCount}</p>
        </div>
      </div>

      <form className="card space-y-4" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Nuovo Check</h3>
          <button type="submit" className="btn btn-primary">
            <Plus className="w-4 h-4 mr-1.5" />
            Aggiungi riga
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Nome check</label>
            <input
              className="input"
              placeholder="Es. CHECK post stipendio"
              value={form.checkLabel}
              onChange={(e) => handleInputChange('checkLabel', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Data</label>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">BBVA c/c</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.bbva}
              onChange={(e) => handleInputChange('bbva', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Trade Republic</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.tradeRepublic}
              onChange={(e) => handleInputChange('tradeRepublic', e.target.value)}
            />
          </div>
          <div>
            <label className="label">WeBank c/c</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.webankCc}
              onChange={(e) => handleInputChange('webankCc', e.target.value)}
            />
          </div>
          <div>
            <label className="label">WeBank obbl.</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.webankObbl}
              onChange={(e) => handleInputChange('webankObbl', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Azionario netto</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.etfNetto}
              onChange={(e) => handleInputChange('etfNetto', e.target.value)}
            />
          </div>
          <div>
            <label className="label">BPER c/c</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.bper}
              onChange={(e) => handleInputChange('bper', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Tricount deb/cred</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.tricount}
              onChange={(e) => handleInputChange('tricount', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Carta WeBank</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.cartaWebank}
              onChange={(e) => handleInputChange('cartaWebank', e.target.value)}
            />
          </div>
          <div>
            <label className="label">Edenred</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.edenred}
              onChange={(e) => handleInputChange('edenred', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">Note</label>
            <input
              className="input"
              placeholder="Annotazioni libere (es. vacanze, stipendio, spese straordinarie...)"
              value={form.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
            />
          </div>
        </div>
      </form>

      <div className="card">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Storico Check</h3>

        {rowsWithComputed.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun check inserito.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-3">Check</th>
                  <th className="text-left py-2 pr-3">Data</th>
                  <th className="text-right py-2 px-2">BBVA</th>
                  <th className="text-right py-2 px-2">Trade</th>
                  <th className="text-right py-2 px-2">WeBank c/c</th>
                  <th className="text-right py-2 px-2">WeBank obbl.</th>
                  <th className="text-right py-2 px-2">Azionario netto</th>
                  <th className="text-right py-2 px-2">BPER</th>
                  <th className="text-right py-2 px-2">Tricount</th>
                  <th className="text-right py-2 px-2">Carta</th>
                  <th className="text-right py-2 px-2">Edenred</th>
                  <th className="text-right py-2 px-2">Tot Attuale</th>
                  <th className="text-right py-2 px-2">Diff Tot</th>
                  <th className="text-left py-2 px-2">Note</th>
                  <th className="text-right py-2 pl-3">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithComputed.map((row, index) => (
                  <tr
                    key={row.id}
                    className={index % 2 === 0 ? 'bg-slate-50/50 border-b border-slate-100' : 'border-b border-slate-100'}
                  >
                    <td className="py-2 pr-3 font-medium text-slate-800">{row.checkLabel}</td>
                    <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.bbva)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.tradeRepublic)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.webankCc)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.webankObbl)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.etfNetto)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.bper)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.tricount)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.cartaWebank)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.edenred)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-slate-900">
                      {formatCurrency(row.total)}
                    </td>
                    <td
                      className={
                        row.diff === null
                          ? 'py-2 px-2 text-right tabular-nums text-slate-400'
                          : row.diff >= 0
                            ? 'py-2 px-2 text-right tabular-nums text-emerald-600 font-medium'
                            : 'py-2 px-2 text-right tabular-nums text-red-600 font-medium'
                      }
                    >
                      {row.diff === null ? 'N/A' : formatCurrency(row.diff)}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{row.notes || '-'}</td>
                    <td className="py-2 pl-3 text-right">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                        onClick={() => handleDelete(row.id)}
                        title="Elimina riga"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

