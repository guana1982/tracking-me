import { FormEvent, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'budget-cashflow-checks-v2';
const LEGACY_STORAGE_KEY = 'budget-cashflow-checks-v1';
const SETTINGS_STORAGE_KEY = 'budget-cashflow-settings-v1';

type CashFlowRow = {
  id: string;
  checkLabel: string;
  date: string;
  bbva: number;
  tradeRepublic: number;
  webankCc: number;
  webankObbl: number;
  etfLordo: number;
  rendimentoLordo: number;
  bper: number;
  tricount: number;
  cartaWebank: number;
  edenred: number;
  notes: string;
};

type CashFlowSettings = {
  commissionPerEtf: number;
  etfCount: number;
};

type CashFlowFormState = {
  checkLabel: string;
  date: string;
  bbva: string;
  tradeRepublic: string;
  webankCc: string;
  webankObbl: string;
  etfLordo: string;
  rendimentoLordo: string;
  bper: string;
  tricount: string;
  cartaWebank: string;
  edenred: string;
  notes: string;
};

type ComputedCashFlowRow = CashFlowRow & {
  diffBbva: number | null;
  diffTradeRepublic: number | null;
  diffWebankCc: number | null;
  diffWebankObbl: number | null;
  tasseComm: number;
  rendimentoNetto: number;
  azionarioNetto: number;
  diffAzionarioNetto: number | null;
  diffBper: number | null;
  total: number;
  diffTotal: number | null;
};

const today = new Date().toISOString().slice(0, 10);

const INITIAL_FORM: CashFlowFormState = {
  checkLabel: '',
  date: today,
  bbva: '',
  tradeRepublic: '',
  webankCc: '',
  webankObbl: '',
  etfLordo: '',
  rendimentoLordo: '',
  bper: '',
  tricount: '',
  cartaWebank: '',
  edenred: '',
  notes: '',
};

const INITIAL_SETTINGS: CashFlowSettings = {
  commissionPerEtf: 12,
  etfCount: 12,
};

function parseAmount(value: string): number {
  if (!value.trim()) return 0;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return parseAmount(value);
  }
  return 0;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function buildCheckLabel(input: string, index: number): string {
  const trimmed = input.trim();
  if (trimmed) return trimmed;
  return `CHECK ${index + 1}`;
}

function computeStockValues(
  row: Pick<CashFlowRow, 'etfLordo' | 'rendimentoLordo'>,
  settings: CashFlowSettings
) {
  const commissionTotal = settings.commissionPerEtf * settings.etfCount;
  const tasseComm = (row.rendimentoLordo * 26) / 100 + commissionTotal;
  const rendimentoNetto = row.rendimentoLordo - tasseComm;
  const azionarioNetto = row.etfLordo - tasseComm;

  return { tasseComm, rendimentoNetto, azionarioNetto };
}

function computeTotal(row: CashFlowRow, settings: CashFlowSettings): number {
  const { azionarioNetto } = computeStockValues(row, settings);

  return (
    row.bbva +
    row.tradeRepublic +
    row.webankCc +
    row.webankObbl +
    azionarioNetto +
    row.bper +
    row.tricount +
    row.cartaWebank +
    row.edenred
  );
}

function normalizeStoredRows(raw: unknown): CashFlowRow[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;

      return {
        id: typeof row.id === 'string' ? row.id : `${Date.now()}-${index}`,
        checkLabel: normalizeString(row.checkLabel) || `CHECK ${index + 1}`,
        date: normalizeString(row.date) || today,
        bbva: normalizeNumber(row.bbva),
        tradeRepublic: normalizeNumber(row.tradeRepublic),
        webankCc: normalizeNumber(row.webankCc),
        webankObbl: normalizeNumber(row.webankObbl),
        etfLordo: normalizeNumber(row.etfLordo ?? row.etfNetto),
        rendimentoLordo: normalizeNumber(row.rendimentoLordo),
        bper: normalizeNumber(row.bper),
        tricount: normalizeNumber(row.tricount),
        cartaWebank: normalizeNumber(row.cartaWebank),
        edenred: normalizeNumber(row.edenred),
        notes: normalizeString(row.notes),
      } satisfies CashFlowRow;
    })
    .filter((row): row is CashFlowRow => row !== null);
}

function diffClass(value: number | null): string {
  if (value === null) return 'text-slate-400';
  if (value >= 0) return 'text-emerald-600 font-medium';
  return 'text-red-600 font-medium';
}

function diffDisplay(value: number | null): string {
  if (value === null) return 'N/A';
  return formatCurrency(value);
}

export function CashFlow() {
  const [rows, setRows] = useState<CashFlowRow[]>([]);
  const [form, setForm] = useState<CashFlowFormState>(INITIAL_FORM);
  const [settings, setSettings] = useState<CashFlowSettings>(INITIAL_SETTINGS);

  useEffect(() => {
    try {
      const rowsRaw = localStorage.getItem(STORAGE_KEY);
      const legacyRowsRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      const source = rowsRaw ?? legacyRowsRaw;

      if (source) {
        const normalized = normalizeStoredRows(JSON.parse(source));
        setRows(normalized);
      }
    } catch (error) {
      console.error('Failed to read cash flow rows from localStorage:', error);
    }

    try {
      const settingsRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (settingsRaw) {
        const parsed = JSON.parse(settingsRaw) as Partial<CashFlowSettings>;
        setSettings({
          commissionPerEtf:
            typeof parsed.commissionPerEtf === 'number' && Number.isFinite(parsed.commissionPerEtf)
              ? parsed.commissionPerEtf
              : INITIAL_SETTINGS.commissionPerEtf,
          etfCount:
            typeof parsed.etfCount === 'number' && Number.isFinite(parsed.etfCount)
              ? parsed.etfCount
              : INITIAL_SETTINGS.etfCount,
        });
      }
    } catch (error) {
      console.error('Failed to read cash flow settings from localStorage:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch (error) {
      console.error('Failed to save cash flow rows to localStorage:', error);
    }
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save cash flow settings to localStorage:', error);
    }
  }, [settings]);

  const rowsWithComputed = useMemo<ComputedCashFlowRow[]>(() => {
    return rows.map((row, index) => {
      const previous = index > 0 ? rows[index - 1] : null;
      const { tasseComm, rendimentoNetto, azionarioNetto } = computeStockValues(row, settings);
      const total = computeTotal(row, settings);

      let prevAzionarioNetto: number | null = null;
      let prevTotal: number | null = null;

      if (previous) {
        prevAzionarioNetto = computeStockValues(previous, settings).azionarioNetto;
        prevTotal = computeTotal(previous, settings);
      }

      return {
        ...row,
        diffBbva: previous ? row.bbva - previous.bbva : null,
        diffTradeRepublic: previous ? row.tradeRepublic - previous.tradeRepublic : null,
        diffWebankCc: previous ? row.webankCc - previous.webankCc : null,
        diffWebankObbl: previous ? row.webankObbl - previous.webankObbl : null,
        tasseComm,
        rendimentoNetto,
        azionarioNetto,
        diffAzionarioNetto:
          prevAzionarioNetto === null ? null : azionarioNetto - prevAzionarioNetto,
        diffBper: previous ? row.bper - previous.bper : null,
        total,
        diffTotal: prevTotal === null ? null : total - prevTotal,
      };
    });
  }, [rows, settings]);

  const latestRow =
    rowsWithComputed.length > 0 ? rowsWithComputed[rowsWithComputed.length - 1] : null;
  const positiveDiffCount = rowsWithComputed.filter((row) => (row.diffTotal ?? 0) > 0).length;

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
      etfLordo: parseAmount(form.etfLordo),
      rendimentoLordo: parseAmount(form.rendimentoLordo),
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

  const commissionTotal = settings.commissionPerEtf * settings.etfCount;

  return (
    <div className="sm:ml-16 space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Cash Flow Patrimonio</h2>
        <p className="text-sm text-slate-500 mt-1">
          Struttura allineata al file Excel: colonne input, differenze sul check precedente e blocco
          azionario calcolato automaticamente.
        </p>
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Commissione per ETF</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={settings.commissionPerEtf}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                commissionPerEtf: parseAmount(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="label">Numero ETF totali</label>
          <input
            type="number"
            step="1"
            min="0"
            className="input"
            value={settings.etfCount}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                etfCount: Math.max(0, Math.floor(parseAmount(e.target.value))),
              }))
            }
          />
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-wide text-slate-500">Y5 = Comm. Totali</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
            {formatCurrency(commissionTotal)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Check totali</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {rowsWithComputed.length}
          </p>
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
            <label className="label">BBVA c/c (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.bbva}
              onChange={(e) => handleInputChange('bbva', e.target.value)}
            />
          </div>
          <div>
            <label className="label">TRADE REP. (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.tradeRepublic}
              onChange={(e) => handleInputChange('tradeRepublic', e.target.value)}
            />
          </div>
          <div>
            <label className="label">WEBANK c/c (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.webankCc}
              onChange={(e) => handleInputChange('webankCc', e.target.value)}
            />
          </div>
          <div>
            <label className="label">WEBANK Obbl (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.webankObbl}
              onChange={(e) => handleInputChange('webankObbl', e.target.value)}
            />
          </div>
          <div>
            <label className="label">ETF tutti LORDO (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.etfLordo}
              onChange={(e) => handleInputChange('etfLordo', e.target.value)}
            />
          </div>
          <div>
            <label className="label">RENDIM. LORDO (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.rendimentoLordo}
              onChange={(e) => handleInputChange('rendimentoLordo', e.target.value)}
            />
          </div>
          <div>
            <label className="label">BPER c/c (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.bper}
              onChange={(e) => handleInputChange('bper', e.target.value)}
            />
          </div>
          <div>
            <label className="label">TRIC DEB/CRED (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.tricount}
              onChange={(e) => handleInputChange('tricount', e.target.value)}
            />
          </div>
          <div>
            <label className="label">CartaWeBank (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.cartaWebank}
              onChange={(e) => handleInputChange('cartaWebank', e.target.value)}
            />
          </div>
          <div>
            <label className="label">EDENRED (input)</label>
            <input
              type="number"
              step="0.01"
              className="input bg-emerald-50"
              value={form.edenred}
              onChange={(e) => handleInputChange('edenred', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">Note</label>
            <input
              className="input"
              placeholder="Annotazioni libere"
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
            <table className="min-w-[2300px] w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-3">Check</th>
                  <th className="text-left py-2 pr-3">Data</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">BBVA c/c</th>
                  <th className="text-right py-2 px-2">Diff BBVA</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">TRADE REP.</th>
                  <th className="text-right py-2 px-2">Diff TR</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">WEBANK c/c</th>
                  <th className="text-right py-2 px-2">Diff WEBANK</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">WEBANK Obbl</th>
                  <th className="text-right py-2 px-2">Diff OBBLIG</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">ETF tutti LORDO</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">RENDIM. LORDO</th>
                  <th className="text-right py-2 px-2">TASSE+COMM</th>
                  <th className="text-right py-2 px-2">REND. NETTO</th>
                  <th className="text-right py-2 px-2">AZIONARIO NETTO</th>
                  <th className="text-right py-2 px-2">Diff AZ. NETTO</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">BPER c/c</th>
                  <th className="text-right py-2 px-2">Diff BPER</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">TRIC DEB/CRED</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">CartaWeBank</th>
                  <th className="text-right py-2 px-2 bg-emerald-50/70">EDENRED</th>
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
                    className={
                      index % 2 === 0
                        ? 'bg-slate-50/50 border-b border-slate-100'
                        : 'border-b border-slate-100'
                    }
                  >
                    <td className="py-2 pr-3 font-medium text-slate-800">{row.checkLabel}</td>
                    <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{formatDate(row.date)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.bbva)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffBbva)}`}>{diffDisplay(row.diffBbva)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.tradeRepublic)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffTradeRepublic)}`}>{diffDisplay(row.diffTradeRepublic)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.webankCc)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffWebankCc)}`}>{diffDisplay(row.diffWebankCc)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.webankObbl)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffWebankObbl)}`}>{diffDisplay(row.diffWebankObbl)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.etfLordo)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.rendimentoLordo)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.tasseComm)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.rendimentoNetto)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{formatCurrency(row.azionarioNetto)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffAzionarioNetto)}`}>{diffDisplay(row.diffAzionarioNetto)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.bper)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffBper)}`}>{diffDisplay(row.diffBper)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.tricount)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.cartaWebank)}</td>
                    <td className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">{formatCurrency(row.edenred)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-700">{formatCurrency(row.total)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffTotal)}`}>{diffDisplay(row.diffTotal)}</td>
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
