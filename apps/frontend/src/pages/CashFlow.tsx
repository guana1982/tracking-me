import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Trash2, Pencil, Check, X, ChevronDown } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

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

type NumericFieldKey =
  | 'bbva'
  | 'tradeRepublic'
  | 'webankCc'
  | 'webankObbl'
  | 'etfLordo'
  | 'rendimentoLordo'
  | 'bper'
  | 'tricount'
  | 'cartaWebank'
  | 'edenred';

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

function getRowDateTimestamp(row: Pick<CashFlowRow, 'date'>): number {
  const timestamp = new Date(row.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortRowsByDateDesc(input: CashFlowRow[]): CashFlowRow[] {
  return [...input].sort((a, b) => getRowDateTimestamp(b) - getRowDateTimestamp(a));
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

function rowToFormState(row: CashFlowRow): CashFlowFormState {
  return {
    checkLabel: row.checkLabel,
    date: row.date.slice(0, 10),
    bbva: String(row.bbva),
    tradeRepublic: String(row.tradeRepublic),
    webankCc: String(row.webankCc),
    webankObbl: String(row.webankObbl),
    etfLordo: String(row.etfLordo),
    rendimentoLordo: String(row.rendimentoLordo),
    bper: String(row.bper),
    tricount: String(row.tricount),
    cartaWebank: String(row.cartaWebank),
    edenred: String(row.edenred),
    notes: row.notes,
  };
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

function formatCompactAmount(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function CashFlow() {
  const [rows, setRows] = useState<CashFlowRow[]>([]);
  const [form, setForm] = useState<CashFlowFormState>(INITIAL_FORM);
  const [settings, setSettings] = useState<CashFlowSettings>(INITIAL_SETTINGS);
  const [isNewCheckOpen, setIsNewCheckOpen] = useState(false);
  const [isTrendOpen, setIsTrendOpen] = useState(true);
  const [showAzionarioTrend, setShowAzionarioTrend] = useState(false);
  const [newInlineDraft, setNewInlineDraft] = useState<CashFlowFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CashFlowFormState | null>(null);

  useEffect(() => {
    try {
      const rowsRaw = localStorage.getItem(STORAGE_KEY);
      const legacyRowsRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      const source = rowsRaw ?? legacyRowsRaw;

      if (source) {
        const normalized = normalizeStoredRows(JSON.parse(source));
        setRows(sortRowsByDateDesc(normalized));
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

  const sortedRows = useMemo(() => sortRowsByDateDesc(rows), [rows]);

  const rowsWithComputed = useMemo<ComputedCashFlowRow[]>(() => {
    return sortedRows.map((row, index) => {
      const previous = index < sortedRows.length - 1 ? sortedRows[index + 1] : null;
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
  }, [sortedRows, settings]);

  const latestRow = rowsWithComputed.length > 0 ? rowsWithComputed[0] : null;
  const positiveDiffCount = rowsWithComputed.filter((row) => (row.diffTotal ?? 0) > 0).length;
  const trendData = useMemo(() => {
    const sorted = [...rowsWithComputed].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sorted.map((row) => ({
      id: row.id,
      checkLabel: row.checkLabel,
      dateLabel: formatDate(row.date),
      total: row.total,
      stockComparto: row.webankObbl + row.azionarioNetto,
    }));
  }, [rowsWithComputed]);
  const latestTrendPoint = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const newInlinePreview = useMemo(() => {
    if (!newInlineDraft) return null;

    const draftRow: CashFlowRow = {
      id: 'new-inline-row',
      checkLabel: newInlineDraft.checkLabel.trim() || `CHECK ${rows.length + 1}`,
      date: newInlineDraft.date || today,
      bbva: parseAmount(newInlineDraft.bbva),
      tradeRepublic: parseAmount(newInlineDraft.tradeRepublic),
      webankCc: parseAmount(newInlineDraft.webankCc),
      webankObbl: parseAmount(newInlineDraft.webankObbl),
      etfLordo: parseAmount(newInlineDraft.etfLordo),
      rendimentoLordo: parseAmount(newInlineDraft.rendimentoLordo),
      bper: parseAmount(newInlineDraft.bper),
      tricount: parseAmount(newInlineDraft.tricount),
      cartaWebank: parseAmount(newInlineDraft.cartaWebank),
      edenred: parseAmount(newInlineDraft.edenred),
      notes: newInlineDraft.notes.trim(),
    };

    const sortedWithDraft = sortRowsByDateDesc([...rows, draftRow]);
    const draftIndex = sortedWithDraft.findIndex((row) => row.id === draftRow.id);
    const previous =
      draftIndex >= 0 && draftIndex < sortedWithDraft.length - 1
        ? sortedWithDraft[draftIndex + 1]
        : null;
    const { tasseComm, rendimentoNetto, azionarioNetto } = computeStockValues(draftRow, settings);
    const total = computeTotal(draftRow, settings);
    const previousAzionario = previous ? computeStockValues(previous, settings).azionarioNetto : null;
    const previousTotal = previous ? computeTotal(previous, settings) : null;

    return {
      row: draftRow,
      tasseComm,
      rendimentoNetto,
      azionarioNetto,
      total,
      diffBbva: previous ? draftRow.bbva - previous.bbva : null,
      diffTradeRepublic: previous ? draftRow.tradeRepublic - previous.tradeRepublic : null,
      diffWebankCc: previous ? draftRow.webankCc - previous.webankCc : null,
      diffWebankObbl: previous ? draftRow.webankObbl - previous.webankObbl : null,
      diffAzionarioNetto:
        previousAzionario === null ? null : azionarioNetto - previousAzionario,
      diffBper: previous ? draftRow.bper - previous.bper : null,
      diffTotal: previousTotal === null ? null : total - previousTotal,
    };
  }, [newInlineDraft, rows, settings]);

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

    setRows((prev) => sortRowsByDateDesc([...prev, newRow]));
    setForm((prev) => ({
      ...INITIAL_FORM,
      date: prev.date || today,
    }));
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingDraft(null);
    }
  };

  const startInlineEdit = (row: CashFlowRow) => {
    setNewInlineDraft(null);
    setEditingId(row.id);
    setEditingDraft(rowToFormState(row));
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setEditingDraft(null);
  };

  const handleInlineChange = (key: keyof CashFlowFormState, value: string) => {
    setEditingDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveInlineEdit = () => {
    if (!editingId || !editingDraft) return;

    setRows((prev) =>
      sortRowsByDateDesc(prev.map((row, index) => {
        if (row.id !== editingId) return row;

        const nextLabel = editingDraft.checkLabel.trim() || row.checkLabel || `CHECK ${index + 1}`;
        return {
          ...row,
          checkLabel: nextLabel,
          date: editingDraft.date || row.date,
          bbva: parseAmount(editingDraft.bbva),
          tradeRepublic: parseAmount(editingDraft.tradeRepublic),
          webankCc: parseAmount(editingDraft.webankCc),
          webankObbl: parseAmount(editingDraft.webankObbl),
          etfLordo: parseAmount(editingDraft.etfLordo),
          rendimentoLordo: parseAmount(editingDraft.rendimentoLordo),
          bper: parseAmount(editingDraft.bper),
          tricount: parseAmount(editingDraft.tricount),
          cartaWebank: parseAmount(editingDraft.cartaWebank),
          edenred: parseAmount(editingDraft.edenred),
          notes: editingDraft.notes.trim(),
        };
      }))
    );

    setEditingId(null);
    setEditingDraft(null);
  };

  const handleInlineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveInlineEdit();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelInlineEdit();
    }
  };

  const openInlineNewRow = () => {
    setEditingId(null);
    setEditingDraft(null);
    setNewInlineDraft({
      ...INITIAL_FORM,
      date: today,
      checkLabel: `CHECK ${rows.length + 1}`,
    });
  };

  const handleNewInlineChange = (key: keyof CashFlowFormState, value: string) => {
    setNewInlineDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const cancelInlineNewRow = () => {
    setNewInlineDraft(null);
  };

  const saveInlineNewRow = () => {
    if (!newInlineDraft) return;

    const nextIndex = rows.length;
    const newRow: CashFlowRow = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      checkLabel: buildCheckLabel(newInlineDraft.checkLabel, nextIndex),
      date: newInlineDraft.date || today,
      bbva: parseAmount(newInlineDraft.bbva),
      tradeRepublic: parseAmount(newInlineDraft.tradeRepublic),
      webankCc: parseAmount(newInlineDraft.webankCc),
      webankObbl: parseAmount(newInlineDraft.webankObbl),
      etfLordo: parseAmount(newInlineDraft.etfLordo),
      rendimentoLordo: parseAmount(newInlineDraft.rendimentoLordo),
      bper: parseAmount(newInlineDraft.bper),
      tricount: parseAmount(newInlineDraft.tricount),
      cartaWebank: parseAmount(newInlineDraft.cartaWebank),
      edenred: parseAmount(newInlineDraft.edenred),
      notes: newInlineDraft.notes.trim(),
    };

    setRows((prev) => sortRowsByDateDesc([...prev, newRow]));
    setNewInlineDraft(null);
  };

  const handleNewInlineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveInlineNewRow();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelInlineNewRow();
    }
  };

  const commissionTotal = settings.commissionPerEtf * settings.etfCount;
  const inlineCellInputClass =
    'w-full min-w-[105px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-300';

  return (
    <div className="sm:ml-16 space-y-4 md:h-full md:flex md:flex-col md:space-y-4">
      <div className="card flex-shrink-0">
        <h2 className="text-lg font-semibold text-slate-900">Cash Flow Patrimonio</h2>
        <p className="text-sm text-slate-500 mt-1">
          Struttura allineata al file Excel: colonne input, differenze sul check precedente e blocco
          azionario calcolato automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
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

      <div className="card flex-shrink-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-base font-semibold text-slate-900"
            onClick={() => setIsTrendOpen((prev) => !prev)}
          >
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                isTrendOpen ? 'rotate-0' : '-rotate-90'
              }`}
            />
            Andamento Totale Nel Tempo
          </button>
          <div className="flex items-center gap-4">
            <p className="text-sm text-slate-500">
              Ultimo totale:{' '}
              <span className="font-semibold text-slate-800">
                {formatCurrency(latestTrendPoint?.total ?? 0)}
              </span>
            </p>
            {isTrendOpen && (
              <label className="inline-flex items-center gap-2 select-none">
                <span className="text-sm text-slate-600">Comparto azionario</span>
                <button
                  type="button"
                  aria-label="Mostra linea comparto azionario"
                  aria-pressed={showAzionarioTrend}
                  onClick={() => setShowAzionarioTrend((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showAzionarioTrend ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      showAzionarioTrend ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
          </div>
        </div>

        {isTrendOpen && (
          <>
            {trendData.length < 2 ? (
              <p className="text-sm text-slate-500">
                Aggiungi almeno 2 check per visualizzare il trend.
              </p>
            ) : (
              <div className="h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 12, left: 6, bottom: 6 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={20}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${formatCompactAmount(value)} EUR`}
                      width={58}
                    />
                    <Tooltip
                      cursor={{ stroke: '#93c5fd', strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const point = payload[0]?.payload as
                          | { checkLabel: string; dateLabel: string; total: number; stockComparto: number }
                          | undefined;
                        if (!point) return null;

                        const totalPoint = payload.find((entry) => entry.dataKey === 'total');
                        const stockPoint = payload.find((entry) => entry.dataKey === 'stockComparto');

                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                            <p className="text-xs text-slate-500">{point.dateLabel}</p>
                            <p className="text-sm font-semibold text-slate-900">{point.checkLabel}</p>
                            <p className="text-sm font-bold text-blue-600">
                              Totale: {formatCurrency(Number(totalPoint?.value ?? point.total))}
                            </p>
                            {showAzionarioTrend && (
                              <p className="text-sm font-semibold text-emerald-600">
                                Comparto azionario:{' '}
                                {formatCurrency(Number(stockPoint?.value ?? point.stockComparto))}
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={1.8}
                      dot={false}
                      activeDot={{ r: 4, fill: '#1d4ed8', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                    {showAzionarioTrend && (
                      <Line
                        type="monotone"
                        dataKey="stockComparto"
                        stroke="#16a34a"
                        strokeWidth={1.8}
                        dot={false}
                        activeDot={{ r: 4, fill: '#15803d', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      <form className="card flex-shrink-0" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-base font-semibold text-slate-900"
            onClick={() => setIsNewCheckOpen((prev) => !prev)}
          >
            <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform ${
                isNewCheckOpen ? 'rotate-0' : '-rotate-90'
              }`}
            />
            Nuovo Check
          </button>

          {isNewCheckOpen && (
            <button type="submit" className="btn btn-primary">
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi riga
            </button>
          )}
        </div>

        {isNewCheckOpen && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
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
          </div>
        )}
      </form>

      <div className="card md:flex-1 md:min-h-0 md:flex md:flex-col">
        <div className="mb-3 flex-shrink-0 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Storico Check</h3>
          <button
            type="button"
            onClick={openInlineNewRow}
            disabled={newInlineDraft !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Nuova riga direttamente in tabella"
          >
            <Plus className="w-4 h-4" />
            Nuova riga
          </button>
        </div>

        {rowsWithComputed.length === 0 && !newInlineDraft ? (
          <p className="text-sm text-slate-500">Nessun check inserito.</p>
        ) : (
          <div className="overflow-auto md:flex-1 md:min-h-0">
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
                {newInlineDraft && (
                  <tr className="bg-sky-50/70 border-b border-sky-200">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      <input
                        type="text"
                        className="w-full min-w-[190px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                        value={newInlineDraft.checkLabel}
                        onChange={(e) => handleNewInlineChange('checkLabel', e.target.value)}
                        onKeyDown={handleNewInlineKeyDown}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="date"
                        className="w-full min-w-[140px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                        value={newInlineDraft.date}
                        onChange={(e) => handleNewInlineChange('date', e.target.value)}
                        onKeyDown={handleNewInlineKeyDown}
                      />
                    </td>

                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.bbva} onChange={(e) => handleNewInlineChange('bbva', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffBbva ?? null)}`}>{diffDisplay(newInlinePreview?.diffBbva ?? null)}</td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.tradeRepublic} onChange={(e) => handleNewInlineChange('tradeRepublic', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffTradeRepublic ?? null)}`}>{diffDisplay(newInlinePreview?.diffTradeRepublic ?? null)}</td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.webankCc} onChange={(e) => handleNewInlineChange('webankCc', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffWebankCc ?? null)}`}>{diffDisplay(newInlinePreview?.diffWebankCc ?? null)}</td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.webankObbl} onChange={(e) => handleNewInlineChange('webankObbl', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffWebankObbl ?? null)}`}>{diffDisplay(newInlinePreview?.diffWebankObbl ?? null)}</td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.etfLordo} onChange={(e) => handleNewInlineChange('etfLordo', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.rendimentoLordo} onChange={(e) => handleNewInlineChange('rendimentoLordo', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(newInlinePreview?.tasseComm ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(newInlinePreview?.rendimentoNetto ?? 0)}</td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">{formatCurrency(newInlinePreview?.azionarioNetto ?? 0)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffAzionarioNetto ?? null)}`}>{diffDisplay(newInlinePreview?.diffAzionarioNetto ?? null)}</td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.bper} onChange={(e) => handleNewInlineChange('bper', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffBper ?? null)}`}>{diffDisplay(newInlinePreview?.diffBper ?? null)}</td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.tricount} onChange={(e) => handleNewInlineChange('tricount', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.cartaWebank} onChange={(e) => handleNewInlineChange('cartaWebank', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className="py-2 px-2 bg-emerald-50/40">
                      <input type="number" step="0.01" className={inlineCellInputClass} value={newInlineDraft.edenred} onChange={(e) => handleNewInlineChange('edenred', e.target.value)} onKeyDown={handleNewInlineKeyDown} />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-700">{formatCurrency(newInlinePreview?.total ?? 0)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(newInlinePreview?.diffTotal ?? null)}`}>{diffDisplay(newInlinePreview?.diffTotal ?? null)}</td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        className="w-full min-w-[220px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                        value={newInlineDraft.notes}
                        onChange={(e) => handleNewInlineChange('notes', e.target.value)}
                        onKeyDown={handleNewInlineKeyDown}
                      />
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                          onClick={saveInlineNewRow}
                          title="Salva nuova riga"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                          onClick={cancelInlineNewRow}
                          title="Annulla nuova riga"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {rowsWithComputed.map((row, index) => {
                  const isEditing = editingId === row.id && editingDraft !== null;

                  const renderNumericCell = (
                    key: NumericFieldKey,
                    value: number,
                    extraClass: string = ''
                  ) => (
                    <td className={`py-2 px-2 text-right tabular-nums ${extraClass}`}>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          className={inlineCellInputClass}
                          value={editingDraft[key]}
                          onChange={(e) => handleInlineChange(key, e.target.value)}
                          onKeyDown={handleInlineKeyDown}
                        />
                      ) : (
                        formatCurrency(value)
                      )}
                    </td>
                  );

                  return (
                    <tr
                      key={row.id}
                      className={
                        index % 2 === 0
                          ? 'bg-slate-50/50 border-b border-slate-100'
                          : 'border-b border-slate-100'
                      }
                    >
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {isEditing ? (
                          <input
                            type="text"
                            className="w-full min-w-[190px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                            value={editingDraft.checkLabel}
                            onChange={(e) => handleInlineChange('checkLabel', e.target.value)}
                            onKeyDown={handleInlineKeyDown}
                          />
                        ) : (
                          row.checkLabel
                        )}
                      </td>

                      <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            className="w-full min-w-[140px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                            value={editingDraft.date}
                            onChange={(e) => handleInlineChange('date', e.target.value)}
                            onKeyDown={handleInlineKeyDown}
                          />
                        ) : (
                          formatDate(row.date)
                        )}
                      </td>

                      {renderNumericCell('bbva', row.bbva, 'bg-emerald-50/40')}
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffBbva)}`}>
                        {diffDisplay(row.diffBbva)}
                      </td>
                      {renderNumericCell('tradeRepublic', row.tradeRepublic, 'bg-emerald-50/40')}
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffTradeRepublic)}`}>
                        {diffDisplay(row.diffTradeRepublic)}
                      </td>
                      {renderNumericCell('webankCc', row.webankCc, 'bg-emerald-50/40')}
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffWebankCc)}`}>
                        {diffDisplay(row.diffWebankCc)}
                      </td>
                      {renderNumericCell('webankObbl', row.webankObbl, 'bg-emerald-50/40')}
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffWebankObbl)}`}>
                        {diffDisplay(row.diffWebankObbl)}
                      </td>
                      {renderNumericCell('etfLordo', row.etfLordo, 'bg-emerald-50/40')}
                      {renderNumericCell('rendimentoLordo', row.rendimentoLordo, 'bg-emerald-50/40')}
                      <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.tasseComm)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(row.rendimentoNetto)}</td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {formatCurrency(row.azionarioNetto)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffAzionarioNetto)}`}>
                        {diffDisplay(row.diffAzionarioNetto)}
                      </td>
                      {renderNumericCell('bper', row.bper, 'bg-emerald-50/40')}
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffBper)}`}>
                        {diffDisplay(row.diffBper)}
                      </td>
                      {renderNumericCell('tricount', row.tricount, 'bg-emerald-50/40')}
                      {renderNumericCell('cartaWebank', row.cartaWebank, 'bg-emerald-50/40')}
                      {renderNumericCell('edenred', row.edenred, 'bg-emerald-50/40')}
                      <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-700">
                        {formatCurrency(row.total)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffTotal)}`}>
                        {diffDisplay(row.diffTotal)}
                      </td>

                      <td className="py-2 px-2 text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            className="w-full min-w-[220px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                            value={editingDraft.notes}
                            onChange={(e) => handleInlineChange('notes', e.target.value)}
                            onKeyDown={handleInlineKeyDown}
                          />
                        ) : (
                          row.notes || '-'
                        )}
                      </td>

                      <td className="py-2 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                onClick={saveInlineEdit}
                                title="Salva"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                onClick={cancelInlineEdit}
                                title="Annulla"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors"
                              onClick={() => startInlineEdit(row)}
                              title="Modifica riga"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            onClick={() => handleDelete(row.id)}
                            title="Elimina riga"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
