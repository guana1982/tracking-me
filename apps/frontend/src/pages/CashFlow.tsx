import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Trash2, Pencil, Check, X, Loader2, Eye, EyeOff, ChevronUp, ChevronDown, GripVertical, TrendingUp, TrendingDown, Minus, Columns3, Tags, Download, BarChart3, Maximize2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import {
  useCashFlowChecks,
  useCashFlowColumns,
  useCashFlowSettings,
  useCreateCashFlowCheck,
  useUpdateCashFlowCheck,
  useDeleteCashFlowCheck,
  useUpdateCashFlowSettings,
  useCreateCashFlowColumn,
  useUpdateCashFlowColumn,
  useDeleteCashFlowColumn,
  useSwapCashFlowColumns,
  useCashFlowClassifications,
  useCreateCashFlowClassification,
  useUpdateCashFlowClassification,
  useDeleteCashFlowClassification,
} from '../hooks/useQueries';
import type { CashFlowCheckDTO, CashFlowColumnDTO } from '@budget/shared';

type CashFlowRow = CashFlowCheckDTO;
type CashFlowColumn = CashFlowColumnDTO;



type CashFlowSettings = {
  commissionPerEtf: number;
  etfCount: number;
};

type FormState = {
  checkLabel: string;
  date: string;
  notes: string;
  values: Record<string, string>;
};

type RowWithMetrics = CashFlowRow & {
  total: number;
  diffTotal: number | null;
  diffByColumn: Record<string, number | null>;
};

type AllocationGroupSlice = {
  key: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
};

type AllocationColumnSlice = {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  percentage: number;
  color: string;
  groupKey: string;
  groupLabel: string;
};

type ValuedColumn = {
  column: CashFlowColumn;
  value: number;
};

type AllocationGroupDraft = {
  key: string;
  label: string;
  columns: ValuedColumn[];
};

const CLASSIFICATION_COLORS = ['#10B981', '#0EA5E9', '#F59E0B', '#94A3B8', '#14B8A6', '#38BDF8', '#FBBF24', '#CBD5E1'];
const UNCLASSIFIED_GROUP_KEY = '__unclassified';
const PIE_LABEL_MIN_GAP = 12;
const PIE_LABEL_OUTER_OFFSET = 12;
const PIE_LABEL_SIDE_OFFSET = 20;
const TREND_LINE_COLORS: Record<string, string> = {
  bbva: '#38bdf8',
  tradeRepublic: '#f59e0b',
  webankCc: '#92400e',
  webankObbl: '#8b5cf6',
  etfLordo: '#16a34a',
  rendimentoLordo: '#14b8a6',
  bper: '#dc2626',
  tricount: '#6366f1',
  cartaWebank: '#ec4899',
  edenred: '#84cc16',
};
const FALLBACK_TREND_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#dc2626', '#ec4899', '#84cc16'];
const LEGACY_COLUMN_KEYS = new Set([
  'bbva',
  'tradeRepublic',
  'webankCc',
  'webankObbl',
  'etfLordo',
  'rendimentoLordo',
  'bper',
  'tricount',
  'cartaWebank',
  'edenred',
]);

const STOCK_KEYS = new Set(['etfLordo', 'rendimentoLordo']);
// Deseasonalization: a ~1-month centered moving average removes the monthly
// salary sawtooth so the trend stats reflect the underlying trajectory.
const SMOOTHING_WINDOW_DAYS = 30;
const SMOOTHING_MIN_SPAN_DAYS = 45;
const SMOOTHING_MIN_POINTS = 4;
const SMOOTHED_LINE_COLOR = '#8b5cf6';
const MONTH_LABELS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const idx = Number(month) - 1;
  return `${MONTH_LABELS_IT[idx] ?? month} ${year}`;
}

function signedCurrency(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;
}

// Plain-language reading built ENTIRELY from the data: it states the sign of the
// two views (monthly savings = end-of-month snapshots; trend = regression on all
// checks) and names the bucket that drives it up / down using the actual €/month.
// No hard-coded causes — every clause is derived from the numbers.
function savingsVerdict(
  saving: number | null,
  trendPct: number | null,
  perMonth: { azionario: number; obbligazionario: number; liquidita: number } | null
): string {
  if (saving === null || trendPct === null || !perMonth) {
    return 'Servono più mesi completi per un giudizio affidabile.';
  }
  const s = saving >= 0;
  const t = trendPct >= 0;

  let head: string;
  if (s && t) head = 'Crescita confermata: risparmio mensile e traiettoria di fondo sono entrambi positivi.';
  else if (!s && t) head = 'Quadro misto: mese su mese il patrimonio è in calo, ma la traiettoria di fondo (su tutti i check) resta positiva.';
  else if (s && !t) head = 'Quadro misto: accantoni mese su mese, ma la traiettoria di fondo è in calo.';
  else head = 'In calo: sia il risparmio mensile sia la traiettoria di fondo sono negativi.';

  const sorted = [
    { label: 'Azionario', v: perMonth.azionario },
    { label: 'Obbligazionario', v: perMonth.obbligazionario },
    { label: 'Liquidità', v: perMonth.liquidita },
  ].sort((a, b) => b.v - a.v);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  let attr = '';
  if (top.v > 0) attr += ` A spingere in alto è soprattutto ${top.label} (${signedCurrency(top.v)}/mese).`;
  if (bottom.v < 0) attr += ` A frenare di più è ${bottom.label} (${signedCurrency(bottom.v)}/mese).`;

  const note = s !== t
    ? ' I due numeri divergono per il metodo di calcolo: il risparmio confronta pochi saldi di fine mese (sensibili al giorno del check), il trend è la regressione su tutti i punti.'
    : '';

  return head + attr + note;
}

const today = new Date().toISOString().slice(0, 10);
const INITIAL_SETTINGS: CashFlowSettings = { commissionPerEtf: 12, etfCount: 12 };
const LEGACY_DIFF_LABELS: Record<string, string> = {
  bbva: 'Diff BBVA',
  tradeRepublic: 'Diff TR',
  webankCc: 'Diff WEBANK',
  webankObbl: 'Diff OBBLIG',
  etfLordo: 'Diff ETF',
  rendimentoLordo: 'Diff REND',
  bper: 'Diff BPER',
  tricount: 'Diff TRIC',
  cartaWebank: 'Diff CARTA',
  edenred: 'Diff EDEN',
};
const LEGACY_PIE_SHORT_LABELS: Record<string, string> = {
  bbva: 'BBVA',
  tradeRepublic: 'TR',
  webankCc: 'WBK',
  webankObbl: 'OBBL',
  etfLordo: 'ETF',
  rendimentoLordo: 'REND',
  bper: 'BPER',
  tricount: 'TRIC',
  cartaWebank: 'CARTA',
  edenred: 'EDEN',
};

function parseAmount(value: string): number {
  if (!value.trim()) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRowValue(row: CashFlowRow, key: string): number {
  const value = row.values?.[key];
  return Number.isFinite(value) ? Number(value) : 0;
}

function makeEmptyForm(columns: CashFlowColumn[], checkLabel = ''): FormState {
  const values: Record<string, string> = {};
  columns.forEach((column) => {
    values[column.key] = '';
  });
  return { checkLabel, date: today, notes: '', values };
}

function toForm(row: CashFlowRow, columns: CashFlowColumn[]): FormState {
  const values: Record<string, string> = {};
  columns.forEach((column) => {
    values[column.key] = String(row.values?.[column.key] ?? 0);
  });
  Object.entries(row.values ?? {}).forEach(([key, value]) => {
    if (!(key in values)) values[key] = String(value);
  });
  return {
    checkLabel: row.checkLabel,
    date: row.date.slice(0, 10),
    notes: row.notes ?? '',
    values,
  };
}

function buildValuesPayload(values: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(values).forEach(([key, value]) => {
    out[key] = parseAmount(value);
  });
  return out;
}

function computeYAxis(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const pad = Math.max((max - min) * 0.2, 50);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
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

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvAmount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return value.toFixed(2).replace('.', ',');
}

function buildCashFlowCsv(rows: RowWithMetrics[], columns: CashFlowColumn[]): string {
  const headers = ['Check', 'Data'];
  columns.forEach((column) => {
    headers.push(column.label, getDiffHeaderLabel(column));
  });
  headers.push('Totale', 'Diff Tot', 'Note');

  const lines = [
    headers.map(csvCell).join(';'),
    ...rows.map((row) => {
      const cells: Array<string | number | null | undefined> = [
        row.checkLabel,
        row.date.slice(0, 10),
      ];

      columns.forEach((column) => {
        cells.push(csvAmount(getRowValue(row, column.key)));
        cells.push(csvAmount(row.diffByColumn[column.key] ?? null));
      });

      cells.push(csvAmount(row.total));
      cells.push(csvAmount(row.diffTotal));
      cells.push(row.notes ?? '');

      return cells.map(csvCell).join(';');
    }),
  ];

  return lines.join('\r\n');
}

function getDiffHeaderLabel(column: CashFlowColumn): string {
  return LEGACY_DIFF_LABELS[column.key] ?? `Diff ${column.label}`;
}

function getPieShortLabel(column: CashFlowColumn): string {
  return LEGACY_PIE_SHORT_LABELS[column.key] ?? (column.label.length > 6 ? `${column.label.slice(0, 6)}.` : column.label);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3 ? normalized.split('').map((char) => `${char}${char}`).join('') : normalized;
  const value = Number.parseInt(expanded, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function mixHexColors(colorA: string, colorB: string, weight: number): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const clampedWeight = Math.max(0, Math.min(1, weight));

  return rgbToHex(
    Math.round(a.r + (b.r - a.r) * clampedWeight),
    Math.round(a.g + (b.g - a.g) * clampedWeight),
    Math.round(a.b + (b.b - a.b) * clampedWeight)
  );
}

function getColumnShade(baseColor: string, index: number, total: number): string {
  if (total <= 1) return mixHexColors(baseColor, '#ffffff', 0.1);
  const ratio = 0.04 + (index / Math.max(1, total - 1)) * 0.24;
  return mixHexColors(baseColor, '#ffffff', ratio);
}

export function CashFlow() {
  const { data: checksData, isLoading: isLoadingChecks, isError: isErrorChecks } = useCashFlowChecks();
  const { data: columnsData, isLoading: isLoadingColumns, isError: isErrorColumns } = useCashFlowColumns();
  const { data: settingsData, isLoading: isLoadingSettings } = useCashFlowSettings();

  const createCheck = useCreateCashFlowCheck();
  const updateCheck = useUpdateCashFlowCheck();
  const deleteCheck = useDeleteCashFlowCheck();
  const updateSettings = useUpdateCashFlowSettings();
  const createColumn = useCreateCashFlowColumn();
  const updateColumn = useUpdateCashFlowColumn();
  const deleteColumn = useDeleteCashFlowColumn();
  const swapColumns = useSwapCashFlowColumns();
  const { data: classificationsData } = useCashFlowClassifications();
  const createClassification = useCreateCashFlowClassification();
  const updateClassification = useUpdateCashFlowClassification();
  const deleteClassification = useDeleteCashFlowClassification();

  const [settings, setSettings] = useState<CashFlowSettings>(INITIAL_SETTINGS);
  const settingsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editingColumnLabel, setEditingColumnLabel] = useState('');
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [newClassificationLabel, setNewClassificationLabel] = useState('');
  const [editingClassificationKey, setEditingClassificationKey] = useState<string | null>(null);
  const [editingClassificationLabel, setEditingClassificationLabel] = useState('');
  const [isTableDragScrolling, setIsTableDragScrolling] = useState(false);
  const [dragColumnKey, setDragColumnKey] = useState<string | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null);

  const [isChartsOpen, setIsChartsOpen] = useState(true);
  const [showTotalTrend, setShowTotalTrend] = useState(true);
  const [visibleTrendKeys, setVisibleTrendKeys] = useState<Set<string>>(new Set());
  const [showSmoothedLine, setShowSmoothedLine] = useState(false);
  const [showRawLine, setShowRawLine] = useState(true);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [columnsModalTab, setColumnsModalTab] = useState<'columns' | 'classifications'>('columns');
  const [isCompactTable, setIsCompactTable] = useState(false);
  const [form, setForm] = useState<FormState>({ checkLabel: '', date: today, notes: '', values: {} });
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableDragActiveRef = useRef(false);
  const tableDragStartXRef = useRef(0);
  const tableDragStartYRef = useRef(0);
  const tableDragStartScrollLeftRef = useRef(0);
  const tableDragStartScrollTopRef = useRef(0);

  const rows: CashFlowRow[] = checksData ?? [];
  const columns: CashFlowColumn[] = useMemo(
    () => [...(columnsData ?? [])].sort((a, b) => a.position - b.position),
    [columnsData]
  );
  const classifications = useMemo(
    () => [...(classificationsData ?? [])].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)),
    [classificationsData]
  );
  const activeColumns = useMemo(() => columns.filter((column) => column.isActive), [columns]);

  useEffect(() => {
    if (settingsData) {
      setSettings({
        commissionPerEtf: Number(settingsData.commissionPerEtf) || INITIAL_SETTINGS.commissionPerEtf,
        etfCount: Number(settingsData.etfCount) || INITIAL_SETTINGS.etfCount,
      });
    }
  }, [settingsData]);

  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev, values: { ...prev.values } };
      columns.forEach((column) => {
        if (!(column.key in next.values)) next.values[column.key] = '';
      });
      return next;
    });
  }, [columns]);

  useEffect(() => {
    return () => {
      if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
    };
  }, []);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => +new Date(b.date) - +new Date(a.date)), [rows]);

  const rowsWithMetrics = useMemo<RowWithMetrics[]>(() => {
    const commissionTotal = settings.commissionPerEtf * settings.etfCount;

    const computeTotal = (row: CashFlowRow) => {
      const baseSum = activeColumns
        .filter((col) => !STOCK_KEYS.has(col.key))
        .reduce((sum, col) => sum + getRowValue(row, col.key), 0);
      const etfLordo = getRowValue(row, 'etfLordo');
      const rendimentoLordo = getRowValue(row, 'rendimentoLordo');
      const tasseComm = (rendimentoLordo * 26 / 100) + commissionTotal;
      const azionarioNetto = etfLordo - tasseComm;
      return baseSum + azionarioNetto;
    };

    return sortedRows.map((row, index) => {
      const total = computeTotal(row);
      const previous = index < sortedRows.length - 1 ? sortedRows[index + 1] : null;
      const previousTotal = previous ? computeTotal(previous) : null;
      const diffByColumn: Record<string, number | null> = {};

      activeColumns.forEach((column) => {
        const currentValue = getRowValue(row, column.key);
        const previousValue = previous ? getRowValue(previous, column.key) : null;
        diffByColumn[column.key] = previousValue === null ? null : currentValue - previousValue;
      });

      return {
        ...row,
        total,
        diffTotal: previousTotal === null ? null : total - previousTotal,
        diffByColumn,
      };
    });
  }, [sortedRows, activeColumns, settings]);

  const handleExportCsv = () => {
    const csv = buildCashFlowCsv(rowsWithMetrics, activeColumns);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cash-flow-check-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const latestRow = rowsWithMetrics[0] ?? null;
  const positiveDiffCount = rowsWithMetrics.filter((row) => (row.diffTotal ?? 0) > 0).length;

  // Monthly savings & where they come from. Everything is built from the same
  // month-over-month deltas (end-of-month balances) so every figure reconciles
  // with the per-month list. The net total is split into 3 buckets
  // (Azionario / Obbligazionario / Liquidità) whose deltas sum to the total.
  // The headline average is the mean over COMPLETE months (the in-progress
  // current month is shown but excluded from the average).
  const savingsBreakdown = useMemo(() => {
    const points = rowsWithMetrics.slice().reverse(); // chronological ascending
    if (points.length < 2) return null;
    const commissionTotal = settings.commissionPerEtf * settings.etfCount;
    const obblActive = activeColumns.some((c) => c.key === 'webankObbl');
    const baseCols = activeColumns.filter((c) => !STOCK_KEYS.has(c.key));

    const buckets = (row: CashFlowRow) => {
      const azionario = getRowValue(row, 'etfLordo') - getRowValue(row, 'rendimentoLordo') * 0.26 - commissionTotal;
      const obbligazionario = obblActive ? getRowValue(row, 'webankObbl') : 0;
      const base = baseCols.reduce((s, c) => s + getRowValue(row, c.key), 0);
      const liquidita = base - obbligazionario;
      return { azionario, obbligazionario, liquidita, total: base + azionario };
    };

    const byMonth = new Map<string, { date: string; b: ReturnType<typeof buckets> }>();
    points.forEach((p) => byMonth.set(String(p.date).slice(0, 7), { date: String(p.date), b: buckets(p) }));
    const monthsArr = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
    const monthly = monthsArr.map(([month, cur], idx) => {
      const prev = idx > 0 ? monthsArr[idx - 1][1].b : null;
      return {
        month,
        date: cur.date,
        total: prev ? cur.b.total - prev.total : null,
        azionario: prev ? cur.b.azionario - prev.azionario : null,
        obbligazionario: prev ? cur.b.obbligazionario - prev.obbligazionario : null,
        liquidita: prev ? cur.b.liquidita - prev.liquidita : null,
      };
    });

    const lastMonthKey = monthsArr[monthsArr.length - 1][0];
    const lastInProgress = lastMonthKey === today.slice(0, 7);

    const deltas = monthly.filter((m) => m.total !== null);
    const complete = lastInProgress ? deltas.filter((m) => m.month !== lastMonthKey) : deltas;
    const monthsUsed = complete.length;
    const mean = (sel: 'azionario' | 'obbligazionario' | 'liquidita' | 'total') =>
      monthsUsed > 0 ? complete.reduce((s, m) => s + (m[sel] as number), 0) / monthsUsed : 0;

    const perMonth = monthsUsed > 0
      ? { azionario: mean('azionario'), obbligazionario: mean('obbligazionario'), liquidita: mean('liquidita') }
      : null;
    const totalPerMonth = monthsUsed > 0 ? mean('total') : null;

    // Underlying trend of the net total: regression over all checks (elapsed
    // days), as % over the period. Robust to endpoint timing — this is the
    // "direction" figure, complementary to the snapshot-based monthly average.
    let netTrendPct: number | null = null;
    const t0 = +new Date(points[0].date);
    const xs = points.map((p) => (+new Date(p.date) - t0) / 86_400_000);
    const ys = points.map((p) => p.total);
    const nP = points.length;
    const sX = xs.reduce((s, x) => s + x, 0);
    const sY = ys.reduce((s, y) => s + y, 0);
    const sXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sX2 = xs.reduce((s, x) => s + x * x, 0);
    const den = nP * sX2 - sX * sX;
    if (den !== 0) {
      const slope = (nP * sXY - sX * sY) / den;
      const intercept = (sY - slope * sX) / nP;
      const fittedStart = intercept;
      const fittedEnd = intercept + slope * xs[nP - 1];
      if (fittedStart !== 0) netTrendPct = ((fittedEnd - fittedStart) / Math.abs(fittedStart)) * 100;
    }

    return { perMonth, totalPerMonth, monthly, monthsUsed, lastInProgress, lastMonthKey, netTrendPct };
  }, [rowsWithMetrics, activeColumns, settings]);
  const trendData = useMemo(
    () =>
      rowsWithMetrics
        .slice()
        .reverse()
        .map((row) => {
          const selectedTotal = showTotalTrend
            ? row.total
            : activeColumns
              .filter((col) => visibleTrendKeys.has(col.key))
              .reduce((sum, col) => sum + getRowValue(row, col.key), 0);
          const point: Record<string, string | number> = {
            date: row.date,
            dateLabel: formatDate(row.date),
            checkLabel: row.checkLabel,
            total: row.total,
            selectedTotal,
          };
          activeColumns.forEach((col) => {
            point[col.key] = getRowValue(row, col.key);
          });
          return point;
        }),
    [rowsWithMetrics, activeColumns, showTotalTrend, visibleTrendKeys]
  );

  const toggleTotalTrend = () => {
    const willEnable = !showTotalTrend;
    setShowTotalTrend(willEnable);
    // "Totale" is mutually exclusive with the per-column series.
    if (willEnable) setVisibleTrendKeys(new Set());
  };

  const toggleTrendKey = (key: string) => {
    const willAdd = !visibleTrendKeys.has(key);
    setVisibleTrendKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // Selecting any per-column series turns "Totale" off.
    if (willAdd) setShowTotalTrend(false);
  };

  const getTrendColor = (key: string, index: number): string =>
    TREND_LINE_COLORS[key] ?? FALLBACK_TREND_COLORS[index % FALLBACK_TREND_COLORS.length];

  const hasVisibleTrendSeries = showTotalTrend || visibleTrendKeys.size > 0;
  const trendLineLabel = showTotalTrend ? 'Totale' : 'Selezione';
  const trendLineColor = showTotalTrend ? '#2563eb' : '#0f766e';

  // Centered ~1-month moving average that strips the monthly salary cycle.
  const smoothing = useMemo<{ active: boolean; smoothed: number[]; cycleAmplitude: number }>(() => {
    const n = trendData.length;
    const raw = trendData.map((point) => Number(point.selectedTotal));
    if (n === 0) return { active: false, smoothed: raw, cycleAmplitude: 0 };
    const dates = trendData.map((point) => +new Date(String(point.date)));
    const spanDays = (dates[n - 1] - dates[0]) / 86_400_000;
    const active = n >= SMOOTHING_MIN_POINTS && spanDays >= SMOOTHING_MIN_SPAN_DAYS;
    if (!active) return { active: false, smoothed: raw, cycleAmplitude: 0 };

    const half = (SMOOTHING_WINDOW_DAYS / 2) * 86_400_000;
    const smoothed = dates.map((center, i) => {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < n; j += 1) {
        if (Math.abs(dates[j] - center) <= half) {
          sum += raw[j];
          count += 1;
        }
      }
      return count > 0 ? sum / count : raw[i];
    });

    // Typical monthly swing = peak-to-peak of the residual around the smoothed trend.
    const residuals = raw.map((v, i) => v - smoothed[i]);
    const cycleAmplitude = Math.max(...residuals) - Math.min(...residuals);
    return { active: true, smoothed, cycleAmplitude };
  }, [trendData]);

  // Least-squares linear regression + at-a-glance stats. Computed on the
  // deseasonalized (smoothed) series so the monthly salary cycle does not
  // bias the trend, drawdown or period change.
  const trendRegression = useMemo<{
    slope: number;
    intercept: number;
    changePct: number | null;
    r2: number;
    absChange: number;
    maxDrawdownPct: number | null;
  } | null>(() => {
    const ys = smoothing.smoothed;
    const n = ys.length;
    if (n < 2) return null;
    const sumX = ((n - 1) * n) / 2;
    const sumX2 = ((n - 1) * n * (2 * n - 1)) / 6;
    const sumY = ys.reduce((sum, y) => sum + y, 0);
    const sumXY = ys.reduce((sum, y, i) => sum + i * y, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const fittedStart = intercept;
    const fittedEnd = intercept + slope * (n - 1);
    const changePct = fittedStart !== 0 ? ((fittedEnd - fittedStart) / Math.abs(fittedStart)) * 100 : null;

    // R²: how well the linear trend explains the series (1 = perfect, ~0 = lateral/noisy).
    const mean = sumY / n;
    const ssTot = ys.reduce((sum, y) => sum + (y - mean) ** 2, 0);
    const ssRes = ys.reduce((sum, y, i) => sum + (y - (intercept + slope * i)) ** 2, 0);
    const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

    // Absolute change first -> last (concrete euro delta over the period).
    const absChange = ys[n - 1] - ys[0];

    // Max drawdown: worst peak-to-trough drop along the period.
    let peak = ys[0];
    let maxDrawdownPct = 0;
    ys.forEach((y) => {
      if (y > peak) peak = y;
      if (peak > 0) {
        const dd = ((y - peak) / peak) * 100;
        if (dd < maxDrawdownPct) maxDrawdownPct = dd;
      }
    });

    return { slope, intercept, changePct, r2, absChange, maxDrawdownPct };
  }, [smoothing]);

  // Plotted dataset augmented with the regression line + smoothed value per point.
  const chartData = useMemo(() => {
    if (!trendRegression) return trendData;
    const { slope, intercept } = trendRegression;
    return trendData.map((point, i) => ({
      ...point,
      trendFit: intercept + slope * i,
      ...(smoothing.active ? { trendSmooth: smoothing.smoothed[i] } : {}),
    }));
  }, [trendData, trendRegression, smoothing]);

  const trendChangePct = trendRegression?.changePct ?? null;

  // Full statistics for the details modal, computed on the currently plotted series.
  const detailedStats = useMemo(() => {
    if (trendData.length < 2 || !trendRegression) return null;
    const points = trendData;
    const n = points.length;
    const first = points[0];
    const last = points[n - 1];
    const values = points.map((p) => Number(p.selectedTotal));
    const startVal = values[0];
    const endVal = values[n - 1];
    const startDate = String(first.date);
    const endDate = String(last.date);
    const days = Math.max(0, Math.round((+new Date(endDate) - +new Date(startDate)) / 86_400_000));

    // Deseasonalized series (smoothed) drives the trend-related figures.
    const sValues = smoothing.smoothed;
    const sStart = sValues[0];
    const sEnd = sValues[n - 1];

    // Period change: deseasonalized when smoothing is active, else raw endpoints.
    const absChange = smoothing.active ? sEnd - sStart : endVal - startVal;
    const changeBase = smoothing.active ? sStart : startVal;
    const pctChange = changeBase !== 0 ? (absChange / Math.abs(changeBase)) * 100 : null;

    // Annualized return (CAGR) on the (deseasonalized) endpoints when positive.
    const cagrStart = smoothing.active ? sStart : startVal;
    const cagrEnd = smoothing.active ? sEnd : endVal;
    const cagr = days > 0 && cagrStart > 0 && cagrEnd > 0
      ? (Math.pow(cagrEnd / cagrStart, 365 / days) - 1) * 100
      : null;

    // Per-check deltas: best/worst single move + volatility of % moves.
    let best: { delta: number; label: string; date: string } | null = null;
    let worst: { delta: number; label: string; date: string } | null = null;
    const pctMoves: number[] = [];
    for (let i = 1; i < n; i += 1) {
      const delta = values[i] - values[i - 1];
      const entry = { delta, label: String(points[i].checkLabel), date: String(points[i].date) };
      if (!best || delta > best.delta) best = entry;
      if (!worst || delta < worst.delta) worst = entry;
      if (values[i - 1] !== 0) pctMoves.push((delta / Math.abs(values[i - 1])) * 100);
    }
    const meanMove = pctMoves.reduce((s, v) => s + v, 0) / (pctMoves.length || 1);
    const volatility = pctMoves.length > 0
      ? Math.sqrt(pctMoves.reduce((s, v) => s + (v - meanMove) ** 2, 0) / pctMoves.length)
      : 0;

    // Min / Max with dates.
    let minPoint = { value: values[0], date: startDate };
    let maxPoint = { value: values[0], date: startDate };
    values.forEach((v, i) => {
      if (v < minPoint.value) minPoint = { value: v, date: String(points[i].date) };
      if (v > maxPoint.value) maxPoint = { value: v, date: String(points[i].date) };
    });

    // Max drawdown (peak -> trough) on the deseasonalized series, so the
    // regular pre-salary dip is not counted as a real loss.
    const ddValues = smoothing.active ? sValues : values;
    let peakVal = ddValues[0];
    let peakDate = startDate;
    let drawdown = { pct: 0, amount: 0, peakDate, troughDate: startDate };
    ddValues.forEach((v, i) => {
      if (v > peakVal) {
        peakVal = v;
        peakDate = String(points[i].date);
      }
      if (peakVal > 0) {
        const ddPct = ((v - peakVal) / peakVal) * 100;
        if (ddPct < drawdown.pct) {
          drawdown = { pct: ddPct, amount: v - peakVal, peakDate, troughDate: String(points[i].date) };
        }
      }
    });

    // Monthly: last value of each month + month-over-month change.
    const monthMap = new Map<string, number>();
    points.forEach((p) => {
      monthMap.set(String(p.date).slice(0, 7), Number(p.selectedTotal));
    });
    const monthly = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value], idx, arr) => {
        const prev = idx > 0 ? arr[idx - 1][1] : null;
        const delta = prev === null ? null : value - prev;
        const deltaPct = prev !== null && prev !== 0 ? (delta! / Math.abs(prev)) * 100 : null;
        return { month, value, delta, deltaPct };
      });
    const monthlyMaxAbs = Math.max(...monthly.map((m) => Math.abs(m.delta ?? 0)), 1);

    // Attribution: per-column contribution to the period change.
    const attrColumns = showTotalTrend
      ? activeColumns
      : activeColumns.filter((col) => visibleTrendKeys.has(col.key));
    const attribution = attrColumns
      .map((col) => {
        const delta = Number(last[col.key] ?? 0) - Number(first[col.key] ?? 0);
        // Match the "Totale" formula: rendimentoLordo enters net at -26% tax.
        const contribution = showTotalTrend && col.key === 'rendimentoLordo' ? -0.26 * delta : delta;
        return { key: col.key, label: col.label, contribution };
      })
      .filter((item) => Math.abs(item.contribution) >= 0.005)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const attributionMaxAbs = Math.max(...attribution.map((a) => Math.abs(a.contribution)), 1);
    const attributionTotal = attribution.reduce((sum, item) => sum + item.contribution, 0);

    return {
      n,
      startVal,
      endVal,
      startDate,
      endDate,
      days,
      absChange,
      pctChange,
      cagr,
      volatility,
      best,
      worst,
      minPoint,
      maxPoint,
      drawdown,
      monthly,
      monthlyMaxAbs,
      attribution,
      attributionMaxAbs,
      attributionTotal,
      r2: trendRegression.r2,
      regChangePct: trendRegression.changePct,
      slopePerCheck: trendRegression.slope,
      smoothingActive: smoothing.active,
      cycleAmplitude: smoothing.cycleAmplitude,
    };
  }, [trendData, trendRegression, smoothing, showTotalTrend, visibleTrendKeys, activeColumns]);

  const trendYDomain = useMemo<[number, number]>(() => {
    const values: number[] = [];
    trendData.forEach((point) => {
      const v = Number(point.selectedTotal);
      if (Number.isFinite(v)) values.push(v);
    });
    return computeYAxis(values);
  }, [trendData]);

  const allocationChart = useMemo(() => {
    if (!latestRow) {
      return { groups: [] as AllocationGroupSlice[], columns: [] as AllocationColumnSlice[], total: 0 };
    }

    // Exclude rendimentoLordo from the pie: it is the (gross) gain already
    // contained in etfLordo, so showing it as its own slice would double-count
    // the equity. The etfLordo slice uses its NET value (matching the Totale
    // formula) so the slices reconcile with the net portfolio.
    const commissionTotal = settings.commissionPerEtf * settings.etfCount;
    const pieValueFor = (column: CashFlowColumn): number => {
      if (column.key === 'etfLordo') {
        const rendimentoLordo = getRowValue(latestRow, 'rendimentoLordo');
        return getRowValue(latestRow, 'etfLordo') - (rendimentoLordo * 26 / 100) - commissionTotal;
      }
      return getRowValue(latestRow, column.key);
    };

    const pieColumns = activeColumns.filter(
      (column) => column.showInPie && column.key !== 'rendimentoLordo'
    );

    const valuedColumns: ValuedColumn[] = pieColumns
      .map((column) => ({
        column,
        value: Math.max(0, pieValueFor(column)),
      }))
      .filter((entry) => entry.value > 0);

    if (valuedColumns.length === 0) {
      return { groups: [] as AllocationGroupSlice[], columns: [] as AllocationColumnSlice[], total: 0 };
    }

    const valuedColumnsByKey = new Map<string, ValuedColumn>(valuedColumns.map((entry) => [entry.column.key, entry]));
    const groupedColumns: AllocationGroupDraft[] = classifications
      .map((classification) => ({
        key: classification.key,
        label: classification.label,
        columns: classification.columnKeys
          .map((columnKey: string) => valuedColumnsByKey.get(columnKey))
          .filter((entry: ValuedColumn | undefined): entry is ValuedColumn => Boolean(entry))
          .sort((a: ValuedColumn, b: ValuedColumn) => a.column.position - b.column.position),
      }))
      .filter((group) => group.columns.length > 0);

    const groupedKeys = new Set(groupedColumns.flatMap((group) => group.columns.map((entry) => entry.column.key)));
    const unclassifiedColumns = valuedColumns
      .filter((entry) => !groupedKeys.has(entry.column.key))
      .sort((a, b) => a.column.position - b.column.position);

    const orderedGroups = [
      ...groupedColumns,
      ...(unclassifiedColumns.length > 0
        ? [{ key: UNCLASSIFIED_GROUP_KEY, label: 'Non classificate', columns: unclassifiedColumns }]
        : []),
    ];

    const total = orderedGroups.reduce(
      (sum, group) => sum + group.columns.reduce((groupSum: number, entry: ValuedColumn) => groupSum + entry.value, 0),
      0
    );

    const groups: AllocationGroupSlice[] = orderedGroups.map((group, index) => {
      const value = group.columns.reduce((sum: number, entry: ValuedColumn) => sum + entry.value, 0);
      const color = group.key === UNCLASSIFIED_GROUP_KEY
        ? '#CBD5E1'
        : CLASSIFICATION_COLORS[index % CLASSIFICATION_COLORS.length];

      return {
        key: group.key,
        label: group.label,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color,
      };
    });

    const groupColors = new Map(groups.map((group) => [group.key, group.color]));
    const columnsData: AllocationColumnSlice[] = orderedGroups.flatMap((group) => {
      const baseColor = groupColors.get(group.key) ?? '#94a3b8';
      return group.columns.map((entry: ValuedColumn, index: number) => ({
        key: entry.column.key,
        label: entry.column.label,
        shortLabel: getPieShortLabel(entry.column),
        value: entry.value,
        percentage: total > 0 ? (entry.value / total) * 100 : 0,
        color: getColumnShade(baseColor, index, group.columns.length),
        groupKey: group.key,
        groupLabel: group.label,
      }));
    });

    return { groups, columns: columnsData, total };
  }, [activeColumns, classifications, latestRow, settings]);

  const renderColumnPieLabel = useMemo(() => {
    const slotsBySide: Record<'left' | 'right', Array<{ index: number; y: number }>> = {
      left: [],
      right: [],
    };

    const reserveY = (side: 'left' | 'right', index: number, desiredY: number, yMin: number, yMax: number): number => {
      const slots = slotsBySide[side];
      slots.push({ index, y: clamp(desiredY, yMin, yMax) });
      slots.sort((a, b) => a.y - b.y);

      for (let i = 1; i < slots.length; i += 1) {
        if (slots[i].y - slots[i - 1].y < PIE_LABEL_MIN_GAP) {
          slots[i].y = slots[i - 1].y + PIE_LABEL_MIN_GAP;
        }
      }

      if (slots.length > 0 && slots[slots.length - 1].y > yMax) {
        slots[slots.length - 1].y = yMax;
        for (let i = slots.length - 2; i >= 0; i -= 1) {
          if (slots[i + 1].y - slots[i].y < PIE_LABEL_MIN_GAP) {
            slots[i].y = slots[i + 1].y - PIE_LABEL_MIN_GAP;
          }
        }
      }

      if (slots.length > 0 && slots[0].y < yMin) {
        const shift = yMin - slots[0].y;
        slots.forEach((slot) => {
          slot.y = clamp(slot.y + shift, yMin, yMax);
        });
      }

      return slots.find((slot) => slot.index === index)?.y ?? clamp(desiredY, yMin, yMax);
    };

    return (props: { cx: number; cy: number; midAngle: number; outerRadius: number; index: number }) => {
      const point = allocationChart.columns[props.index];
      if (!point) return null;

      const angle = (-props.midAngle * Math.PI) / 180;
      const isRightSide = Math.cos(angle) >= 0;
      const side: 'left' | 'right' = isRightSide ? 'right' : 'left';
      const yMin = props.cy - (props.outerRadius + 18);
      const yMax = props.cy + (props.outerRadius + 18);
      const desiredY = props.cy + Math.sin(angle) * (props.outerRadius + PIE_LABEL_OUTER_OFFSET);
      const y = reserveY(side, props.index, desiredY, yMin, yMax);
      const startX = props.cx + Math.cos(angle) * (props.outerRadius + 1);
      const startY = props.cy + Math.sin(angle) * (props.outerRadius + 1);
      const elbowX = props.cx + (isRightSide ? 1 : -1) * (props.outerRadius + 8);
      const labelX = props.cx + (isRightSide ? 1 : -1) * (props.outerRadius + PIE_LABEL_SIDE_OFFSET);
      const anchor = isRightSide ? 'start' : 'end';
      const text = `${point.shortLabel} ${point.percentage.toFixed(1)}%`;

      return (
        <g>
          <path
            d={`M ${startX} ${startY}
               L ${elbowX} ${y}
               L ${labelX} ${y}`}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={1}
          />
          <text
            x={labelX + (isRightSide ? 2 : -2)}
            y={y}
            textAnchor={anchor}
            dominantBaseline="central"
            fontSize={8.5}
            fontWeight={600}
            fill="#334155"
          >
            {text}
          </text>
        </g>
      );
    };
  }, [allocationChart.columns]);

  const handleSettingsChange = (next: CashFlowSettings) => {
    setSettings(next);
    if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
    settingsDebounceRef.current = setTimeout(() => updateSettings.mutate(next), 800);
  };

  const openNewModal = () => {
    setEditingRowId(null);
    setForm(makeEmptyForm(columns, `CHECK ${rows.length + 1}`));
    setIsModalOpen(true);
  };

  const openEditModal = (row: CashFlowRow) => {
    setEditingRowId(row.id);
    setForm(toForm(row, columns));
    setIsModalOpen(true);
  };

  const submitModal = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      checkLabel: form.checkLabel.trim() || `CHECK ${rows.length + 1}`,
      date: form.date || today,
      notes: form.notes.trim(),
      values: buildValuesPayload(form.values),
    };

    if (editingRowId) {
      updateCheck.mutate(
        { id: editingRowId, data: payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingRowId(null);
          },
        }
      );
      return;
    }

    createCheck.mutate(payload, {
      onSuccess: () => {
        setIsModalOpen(false);
      },
    });
  };

  const stopTableDragScroll = () => {
    tableDragActiveRef.current = false;
    setIsTableDragScrolling(false);
  };

  const canStartTableDrag = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea, button, select, a, [role="button"]')) return false;
    return true;
  };

  const handleTableMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = tableScrollRef.current;
    if (!container) return;
    if (!canStartTableDrag(event.target)) return;

    tableDragActiveRef.current = true;
    tableDragStartXRef.current = event.clientX;
    tableDragStartYRef.current = event.clientY;
    tableDragStartScrollLeftRef.current = container.scrollLeft;
    tableDragStartScrollTopRef.current = container.scrollTop;
    setIsTableDragScrolling(true);
  };

  const handleTableMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!tableDragActiveRef.current) return;
    const container = tableScrollRef.current;
    if (!container) return;

    const deltaX = event.clientX - tableDragStartXRef.current;
    const deltaY = event.clientY - tableDragStartYRef.current;
    container.scrollLeft = tableDragStartScrollLeftRef.current - deltaX;
    container.scrollTop = tableDragStartScrollTopRef.current - deltaY;
    event.preventDefault();
  };

  useEffect(() => {
    if (!isTableDragScrolling) return;

    const handleWindowMouseUp = () => stopTableDragScroll();
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [isTableDragScrolling]);

  if (isLoadingChecks || isLoadingColumns || isLoadingSettings) {
    return (
      <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (isErrorChecks || isErrorColumns) {
    return (
      <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 flex items-center justify-center h-64">
        <p className="text-red-600">Errore nel caricamento dei dati CashFlow.</p>
      </div>
    );
  }

  return (
    <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 space-y-2 md:h-full md:flex md:flex-col md:space-y-2">
      <div className="card !p-3 flex-shrink-0 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cash Flow Patrimonio</h2>
          <p className="text-xs text-slate-500 mt-0.5">Colonne dinamiche con storico su DB.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn"
            onClick={() => setIsColumnsModalOpen(true)}
          >
            Gestisci colonne
          </button>
          <button type="button" className="btn btn-primary" onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            Nuovo check
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => savingsBreakdown?.totalPerMonth != null && setIsSavingsModalOpen(true)}
          disabled={savingsBreakdown?.totalPerMonth == null}
          className="card !p-3 text-left w-full group transition-colors hover:border-sky-300 hover:bg-sky-50/30 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-inherit"
          title="Apri il dettaglio: risparmio mese per mese e da dove deriva"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Risparmio medio / mese</p>
            <Maximize2 className="w-3 h-3 text-slate-300 group-hover:text-sky-500 transition-colors" />
          </div>
          {savingsBreakdown?.totalPerMonth != null ? (
            <div className="flex items-baseline gap-2">
              <p className={`text-lg font-bold tabular-nums ${savingsBreakdown.totalPerMonth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {savingsBreakdown.totalPerMonth >= 0 ? '+' : ''}{formatCurrency(savingsBreakdown.totalPerMonth)}
              </p>
              <span className="text-[10px] text-sky-600 tabular-nums">dettagli →</span>
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-400 tabular-nums">—</p>
          )}
        </button>
        <div className="card !p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500" title="Trend del patrimonio reale (regressione sui giorni). Dato 'grezzo': il grafico usa la media mobile, quindi può differire di poco.">Trend reale</p>
          {savingsBreakdown?.netTrendPct != null ? (
            <div className="flex items-baseline gap-1">
              {savingsBreakdown.netTrendPct >= 0
                ? <TrendingUp className="w-4 h-4 text-emerald-600 self-center" />
                : <TrendingDown className="w-4 h-4 text-red-600 self-center" />}
              <p className={`text-lg font-bold tabular-nums ${savingsBreakdown.netTrendPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {savingsBreakdown.netTrendPct >= 0 ? '+' : ''}{savingsBreakdown.netTrendPct.toFixed(1)}%
              </p>
            </div>
          ) : (
            <p className="text-lg font-bold text-slate-400 tabular-nums">—</p>
          )}
        </div>
        <div className="card !p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Ultimo Tot Attuale</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-slate-900 tabular-nums">
              {latestRow ? formatCurrency(latestRow.total) : formatCurrency(0)}
            </p>
          </div>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Check in crescita</p>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{positiveDiffCount}</p>
            {rowsWithMetrics.length > 1 && (
              <span className="text-xs text-slate-400 tabular-nums">/ {rowsWithMetrics.length - 1}</span>
            )}
          </div>
        </div>
      </div>

      <div className="card !p-3 flex-shrink-0">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 w-full text-left"
          onClick={() => setIsSettingsOpen((prev) => !prev)}
        >
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isSettingsOpen ? 'rotate-0' : '-rotate-90'}`} />
          Parametri ETF
          <span className="text-xs font-normal text-slate-500 ml-1">
            — Comm. totali: {formatCurrency(settings.commissionPerEtf * settings.etfCount)}
          </span>
        </button>
        {isSettingsOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            <div>
              <label className="label text-xs">Commissione per ETF</label>
              <input
                type="number"
                step="0.01"
                className="input h-8 text-sm"
                value={settings.commissionPerEtf}
                onChange={(e) => handleSettingsChange({ ...settings, commissionPerEtf: parseAmount(e.target.value) })}
              />
            </div>
            <div>
              <label className="label text-xs">Numero ETF</label>
              <input
                type="number"
                step="1"
                min="0"
                className="input h-8 text-sm"
                value={settings.etfCount}
                onChange={(e) =>
                  handleSettingsChange({ ...settings, etfCount: Math.max(0, Math.floor(parseAmount(e.target.value))) })
                }
              />
            </div>
            <div className="flex flex-col justify-end">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Commissioni Teoriche Totali</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">
                {formatCurrency(settings.commissionPerEtf * settings.etfCount)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="card !p-3 flex-shrink-0">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 w-full text-left"
          onClick={() => setIsChartsOpen((prev) => !prev)}
        >
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isChartsOpen ? 'rotate-0' : '-rotate-90'}`} />
          Andamento e Suddivisione
        </button>
        {isChartsOpen && (
          <div className="grid grid-cols-1 xl:grid-cols-[620px,1fr] mt-2">
        <div className="pr-4 xl:border-r xl:border-slate-200">
          <p className="text-xs font-semibold text-slate-800 mb-1">Suddivisione Ultimo Check</p>
          <p className="text-[10px] text-slate-500">Totale allocato: {formatCurrency(allocationChart.total)}</p>
          <p className="text-[10px] text-slate-400 mb-2">ETF al netto (tasse + commissioni); il centro coincide con la somma delle fette.</p>
          {allocationChart.columns.length === 0 ? (
            <p className="text-xs text-slate-500">Nessun dato disponibile.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {allocationChart.groups.map((group) => (
                  <div
                    key={`group-${group.key}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/70 px-2.5 py-1"
                  >
                    <span className="text-[10px] font-semibold text-slate-700">{group.label}</span>
                    <span className="text-[10px] text-slate-500">{group.percentage.toFixed(1)}%</span>
                    <span className="text-[10px] font-semibold text-slate-900 tabular-nums">{formatCurrency(group.value)}</span>
                  </div>
                ))}
              </div>
              <div className="min-w-0 h-60 max-w-[440px] mx-auto relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 12, right: 28, bottom: 12, left: 28 }}>
                    <Pie
                      data={allocationChart.columns}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={74}
                      minAngle={2}
                      paddingAngle={1}
                      startAngle={90}
                      endAngle={-270}
                      stroke="#ffffff"
                      strokeWidth={2}
                      labelLine={false}
                      label={renderColumnPieLabel}
                    >
                      {allocationChart.columns.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const point = payload[0]?.payload as AllocationColumnSlice | undefined;
                        if (!point) return null;

                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                            <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                            <p className="text-xs text-slate-500">Classificazione: {point.groupLabel}</p>
                            <p className="text-sm text-slate-700">{formatCurrency(point.value)}</p>
                            <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-3">
                  <p className="text-sm font-bold text-slate-700 tabular-nums whitespace-nowrap">
                    {formatCurrency(allocationChart.total)}
                  </p>
                </div>
              </div>
            </div>
              )}
        </div>
        <div className="flex flex-col pl-4 xl:min-h-0">
          <div className="flex items-center gap-2 mb-2">
            {hasVisibleTrendSeries && trendRegression && (
              <div className="flex items-center gap-2 shrink-0">
                {trendChangePct !== null && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${trendChangePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    title={`Trend ${trendLineLabel} — regressione lineare${smoothing.active ? ' sulla media mobile 30g (destagionalizzato)' : " sull'intero periodo"}`}
                  >
                    {trendChangePct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {trendChangePct >= 0 ? '+' : ''}{trendChangePct.toFixed(1)}%
                  </span>
                )}
                <span
                  className={`hidden sm:inline-flex items-baseline gap-1 text-[10px] tabular-nums ${trendRegression.absChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                  title={smoothing.active ? 'Variazione destagionalizzata sul periodo (media mobile 30g)' : "Variazione assoluta dal primo all'ultimo check del periodo"}
                >
                  <span className="text-slate-400 font-medium uppercase tracking-wide">Δ</span>
                  {trendRegression.absChange >= 0 ? '+' : ''}{formatCurrency(trendRegression.absChange)}
                </span>
                {trendRegression.maxDrawdownPct !== null && trendRegression.maxDrawdownPct < 0 && (
                  <span
                    className="hidden md:inline-flex items-baseline gap-1 text-[10px] tabular-nums text-red-600"
                    title={smoothing.active ? 'Max drawdown sul trend destagionalizzato (esclude il calo ciclico pre-stipendio)' : 'Max drawdown: calo massimo da un picco nel periodo'}
                  >
                    <span className="text-slate-400 font-medium uppercase tracking-wide">DD</span>
                    {trendRegression.maxDrawdownPct.toFixed(1)}%
                  </span>
                )}
                <span
                  className="hidden md:inline-flex items-baseline gap-1 text-[10px] tabular-nums text-slate-500"
                  title="R²: solidità del trend (1 = netto, vicino a 0 = laterale/rumoroso)"
                >
                  <span className="text-slate-400 font-medium uppercase tracking-wide">R²</span>
                  {trendRegression.r2.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsStatsModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 hover:text-sky-700 hover:underline"
                  title="Apri statistiche dettagliate dell'andamento"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Statistiche</span>
                </button>
              </div>
            )}
            <div className="flex flex-1 items-center justify-end gap-1.5 overflow-x-auto pb-1 scrollbar-thin min-w-0">
            <label className="inline-flex items-center gap-1.5 select-none rounded-full border border-slate-200 bg-white px-2 py-0.5 shrink-0">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
              <span className="text-[10px] text-slate-600">Totale</span>
              <button
                type="button"
                aria-pressed={showTotalTrend}
                onClick={toggleTotalTrend}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showTotalTrend ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showTotalTrend ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </label>
            {activeColumns.map((col, idx) => {
              const color = getTrendColor(col.key, idx);
              const isOn = visibleTrendKeys.has(col.key);
              return (
                <label key={col.key} className="inline-flex items-center gap-1.5 select-none rounded-full border border-slate-200 bg-white px-2 py-0.5 shrink-0">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-slate-600">{getPieShortLabel(col)}</span>
                  <button
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggleTrendKey(col.key)}
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors`}
                    style={{ backgroundColor: isOn ? color : '#cbd5e1' }}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${isOn ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              );
            })}
            </div>
          </div>
          {trendData.length < 2 ? (
            <p className="text-xs text-slate-500">Aggiungi almeno 2 check per visualizzare il trend.</p>
          ) : !hasVisibleTrendSeries ? (
            <p className="text-xs text-slate-500">Attiva almeno una linea per visualizzare il trend.</p>
          ) : (
            <div className="h-52 xl:h-auto xl:min-h-[260px] xl:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fill: '#64748b', fontSize: 11, dy: 8 }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis domain={trendYDomain} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v: number) => { if (v >= 1000 || v <= -1000) { const k = v / 1000; return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`; } return String(v); }} width={52} tickCount={5} />
                  <Tooltip
                    cursor={{ stroke: '#93c5fd', strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0]?.payload as Record<string, string | number> | undefined;
                      if (!point) return null;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                          <p className="text-[10px] text-slate-500">{point.dateLabel}</p>
                          <p className="text-xs font-semibold text-slate-900">{point.checkLabel}</p>
                          {showRawLine && (
                            <p className="text-xs font-bold" style={{ color: trendLineColor }}>
                              {trendLineLabel}: {formatCurrency(Number(point.selectedTotal))}
                            </p>
                          )}
                          {smoothing.active && showSmoothedLine && point.trendSmooth !== undefined && (
                            <p className="text-[10px] font-semibold" style={{ color: SMOOTHED_LINE_COLOR }}>
                              Media mobile 30g: {formatCurrency(Number(point.trendSmooth))}
                            </p>
                          )}
                          {!showTotalTrend && activeColumns.map((col, idx) => {
                            if (!visibleTrendKeys.has(col.key)) return null;
                            return (
                              <p key={col.key} className="text-[10px] font-semibold" style={{ color: getTrendColor(col.key, idx) }}>
                                {col.label}: {formatCurrency(Number(point[col.key] ?? 0))}
                              </p>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  {smoothing.active && showSmoothedLine && (
                    <Line
                      type="monotone"
                      dataKey="trendSmooth"
                      name="Media mobile 30g"
                      stroke={SMOOTHED_LINE_COLOR}
                      strokeWidth={2.4}
                      strokeOpacity={0.85}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {showRawLine && (
                    <Line type="monotone" dataKey="selectedTotal" name={trendLineLabel} stroke={trendLineColor} strokeWidth={1.8} dot={false} activeDot={{ r: 3, fill: trendLineColor, stroke: '#fff', strokeWidth: 2 }} />
                  )}
                  {trendRegression && (
                    <Line
                      type="linear"
                      dataKey="trendFit"
                      name="Trend"
                      stroke={trendChangePct !== null && trendChangePct < 0 ? '#dc2626' : '#16a34a'}
                      strokeWidth={1.4}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {hasVisibleTrendSeries && trendData.length >= 2 && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                aria-pressed={showRawLine}
                onClick={() => setShowRawLine((prev) => !prev)}
                className="inline-flex items-center gap-1.5 select-none rounded-full border border-slate-200 bg-white px-2 py-0.5 shrink-0"
                title="Mostra/nascondi la linea principale sul grafico"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: trendLineColor }} />
                <span className="text-[10px] text-slate-600">{trendLineLabel}</span>
                <span
                  className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                  style={{ backgroundColor: showRawLine ? trendLineColor : '#cbd5e1' }}
                >
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showRawLine ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </span>
              </button>
              {smoothing.active && (
                <button
                  type="button"
                  aria-pressed={showSmoothedLine}
                  onClick={() => setShowSmoothedLine((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 select-none rounded-full border border-slate-200 bg-white px-2 py-0.5 shrink-0"
                  title="Mostra/nascondi la media mobile a 30g sul grafico (non cambia le statistiche)"
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SMOOTHED_LINE_COLOR }} />
                  <span className="text-[10px] text-slate-600">MM 30g</span>
                  <span
                    className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                    style={{ backgroundColor: showSmoothedLine ? SMOOTHED_LINE_COLOR : '#cbd5e1' }}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showSmoothedLine ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              )}
              {smoothing.active && showSmoothedLine && (
                <span className="text-[10px] text-slate-400">Media mobile 30g — patrimonio ripulito dal ciclo mensile dello stipendio.</span>
              )}
            </div>
          )}
        </div>
          </div>
        )}
      </div>

      <div className="card !p-3 md:flex-1 md:min-h-0 md:flex md:flex-col">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Storico Check</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              onClick={handleExportCsv}
              disabled={rowsWithMetrics.length === 0}
              title="Esporta tabella in CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={() => setIsCompactTable((prev) => !prev)}
            >
              {isCompactTable ? <Columns3 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              {isCompactTable ? 'Espandi' : 'Compatto'}
            </button>
          </div>
        </div>
        {rowsWithMetrics.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun check inserito.</p>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-2 overflow-y-auto">
            {rowsWithMetrics.map((row) => (
              <div key={`mobile-${row.id}`} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.checkLabel}</p>
                    <p className="text-xs text-slate-500">{formatDate(row.date)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors" onClick={() => openEditModal(row)}><Pencil className="w-4 h-4" /></button>
                    {deletingRowId === row.id ? (
                      <>
                        <button type="button" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" onClick={() => { deleteCheck.mutate(row.id); setDeletingRowId(null); }}><Check className="w-4 h-4" /></button>
                        <button type="button" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" onClick={() => setDeletingRowId(null)}><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <button type="button" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" onClick={() => setDeletingRowId(row.id)}><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Totale</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(row.total)}</span>
                </div>
                {row.diffTotal !== null && (
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs uppercase tracking-wide text-slate-500">Variazione</span>
                    <span className={`text-sm font-medium tabular-nums ${diffClass(row.diffTotal)}`}>{diffDisplay(row.diffTotal)}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 border-t border-slate-200">
                  {activeColumns.map((column) => (
                    <div key={column.key} className="flex items-baseline justify-between">
                      <span className="text-[10px] text-slate-500 truncate mr-1">{column.label}</span>
                      <span className="text-xs tabular-nums text-slate-700">{formatCurrency(getRowValue(row, column.key))}</span>
                    </div>
                  ))}
                </div>
                {row.notes && (
                  <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200 truncate" title={row.notes}>{row.notes}</p>
                )}
              </div>
            ))}
          </div>
          {/* Desktop table view */}
          <div className="relative md:flex-1 md:min-h-0 hidden md:block">
            <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10 bg-gradient-to-l from-white to-transparent" />
          <div
            ref={tableScrollRef}
            className={`overflow-auto h-full ${isTableDragScrolling ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            onMouseDown={handleTableMouseDown}
            onMouseMove={handleTableMouseMove}
            onMouseUp={stopTableDragScroll}
            onMouseLeave={stopTableDragScroll}
          >
            <table className="w-full text-sm" style={{ minWidth: `${900 + activeColumns.length * (isCompactTable ? 130 : 260)}px` }}>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left py-2 pl-2 pr-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur w-[76px] min-w-[76px]">Azioni</th>
                  <th className="text-left py-2 pr-3 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">Check</th>
                  <th className="text-left py-2 pr-3 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">Data</th>
                  {activeColumns.flatMap((column) => [
                    <th key={`${column.key}-value`} className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-emerald-50/95">{column.label}</th>,
                    ...(!isCompactTable ? [<th key={`${column.key}-diff`} className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">{getDiffHeaderLabel(column)}</th>] : []),
                  ])}
                  <th className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-emerald-200/80">Totale</th>
                  {!isCompactTable && <th className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">Diff Tot</th>}
                  {!isCompactTable && <th className="text-left py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur w-[260px] min-w-[260px] max-w-[260px]">Note</th>}
                </tr>
              </thead>
              <tbody>
                {rowsWithMetrics.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'bg-slate-50/50 border-b border-slate-100' : 'border-b border-slate-100'}>
                    <td className="py-2 pl-2 pr-2">
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors" onClick={() => openEditModal(row)}><Pencil className="w-4 h-4" /></button>
                        {deletingRowId === row.id ? (
                          <>
                            <button type="button" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" onClick={() => { deleteCheck.mutate(row.id); setDeletingRowId(null); }}><Check className="w-4 h-4" /></button>
                            <button type="button" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" onClick={() => setDeletingRowId(null)}><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <button type="button" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" onClick={() => setDeletingRowId(row.id)}><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-medium">{row.checkLabel}</td>
                    <td className="py-2 pr-3">{formatDate(row.date)}</td>
                    {activeColumns.flatMap((column) => [
                      <td key={`${row.id}-${column.key}-value`} className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">
                        {formatCurrency(getRowValue(row, column.key))}
                      </td>,
                      ...(!isCompactTable ? [<td key={`${row.id}-${column.key}-diff`} className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffByColumn[column.key] ?? null)}`}>
                        {diffDisplay(row.diffByColumn[column.key] ?? null)}
                      </td>] : []),
                    ])}
                    <td className="py-2 px-2 text-right tabular-nums font-semibold bg-emerald-100/90">{formatCurrency(row.total)}</td>
                    {!isCompactTable && <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffTotal)}`}>{diffDisplay(row.diffTotal)}</td>}
                    {!isCompactTable && (
                      <td className="py-2 px-2 text-slate-600 w-[260px] min-w-[260px] max-w-[260px]">
                        <span className="block truncate" title={row.notes || '-'}>
                          {row.notes || '-'}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
          </>
        )}
      </div>

      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsStatsModalOpen(false)} />
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-sky-600" />
                  Statistiche andamento — {trendLineLabel}
                </h3>
                {detailedStats && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {formatDate(detailedStats.startDate)} → {formatDate(detailedStats.endDate)} · {detailedStats.n} check · {detailedStats.days} giorni
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsStatsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-5">
              {!detailedStats ? (
                <p className="text-sm text-slate-500">Servono almeno 2 check per calcolare le statistiche.</p>
              ) : (
                <>
                  {detailedStats.smoothingActive && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 text-[11px] text-slate-600">
                      <span className="font-semibold text-violet-700">Serie destagionalizzata.</span>{' '}
                      Trend, variazione e drawdown sono calcolati su una <span className="font-medium">media mobile a 30 giorni</span> (linea viola sul grafico), così il ciclo mensile dello stipendio non altera l'andamento di fondo. L'oscillazione mensile attesa è riportata come <span className="font-medium">Ampiezza ciclo</span>.
                    </div>
                  )}
                  {/* A) KPI di periodo */}
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Riepilogo periodo</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Valore iniziale → finale</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(detailedStats.startVal)} → {formatCurrency(detailedStats.endVal)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Variazione periodo{detailedStats.smoothingActive ? ' (destag.)' : ''}</p>
                        <p className={`text-sm font-bold tabular-nums ${detailedStats.absChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {signedCurrency(detailedStats.absChange)}{detailedStats.pctChange !== null ? ` (${detailedStats.pctChange >= 0 ? '+' : ''}${detailedStats.pctChange.toFixed(1)}%)` : ''}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Trend (regressione)</p>
                        <p className={`text-sm font-bold tabular-nums ${detailedStats.regChangePct !== null && detailedStats.regChangePct < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {detailedStats.regChangePct !== null ? `${detailedStats.regChangePct >= 0 ? '+' : ''}${detailedStats.regChangePct.toFixed(1)}%` : 'N/A'}
                          <span className="text-[10px] font-normal text-slate-400"> · {signedCurrency(detailedStats.slopePerCheck)}/check</span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Rendimento annuo (CAGR)</p>
                        <p className={`text-sm font-bold tabular-nums ${detailedStats.cagr === null ? 'text-slate-400' : detailedStats.cagr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {detailedStats.cagr === null ? 'N/A' : `${detailedStats.cagr >= 0 ? '+' : ''}${detailedStats.cagr.toFixed(1)}%`}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        {detailedStats.smoothingActive ? (
                          <>
                            <p className="text-[10px] uppercase tracking-wide text-slate-500" title="Oscillazione mensile attesa (ciclo stipendio), non un rischio">Ampiezza ciclo · R²</p>
                            <p className="text-sm font-bold text-violet-700 tabular-nums">{formatCurrency(detailedStats.cycleAmplitude)} <span className="text-[10px] font-normal text-slate-400">· R² {detailedStats.r2.toFixed(2)}</span></p>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Volatilità · R²</p>
                            <p className="text-sm font-bold text-slate-900 tabular-nums">±{detailedStats.volatility.toFixed(1)}% <span className="text-[10px] font-normal text-slate-400">· R² {detailedStats.r2.toFixed(2)}</span></p>
                          </>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Max drawdown{detailedStats.smoothingActive ? ' (destag.)' : ''}</p>
                        <p className="text-sm font-bold text-red-600 tabular-nums">
                          {detailedStats.drawdown.pct.toFixed(1)}% <span className="text-[10px] font-normal text-slate-400">({signedCurrency(detailedStats.drawdown.amount)})</span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Minimo periodo</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(detailedStats.minPoint.value)}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(detailedStats.minPoint.date)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Massimo periodo</p>
                        <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrency(detailedStats.maxPoint.value)}</p>
                        <p className="text-[10px] text-slate-400">{formatDate(detailedStats.maxPoint.date)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Miglior / peggior check</p>
                        <p className="text-sm font-bold tabular-nums">
                          <span className="text-emerald-600">{detailedStats.best ? signedCurrency(detailedStats.best.delta) : 'N/A'}</span>
                          <span className="text-slate-300"> / </span>
                          <span className="text-red-600">{detailedStats.worst ? signedCurrency(detailedStats.worst.delta) : 'N/A'}</span>
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* B) Andamento mensile */}
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Andamento mensile (mese su mese)</h4>
                    <div className="space-y-1">
                      {detailedStats.monthly.map((m) => {
                        const widthPct = Math.min(100, (Math.abs(m.delta ?? 0) / detailedStats.monthlyMaxAbs) * 100);
                        const positive = (m.delta ?? 0) >= 0;
                        return (
                          <div key={m.month} className="flex items-center gap-2 text-xs">
                            <span className="w-16 shrink-0 text-slate-500 capitalize">{monthLabel(m.month)}</span>
                            <span className="w-20 shrink-0 text-right tabular-nums font-medium text-slate-700">{formatCurrency(m.value)}</span>
                            <div className="flex-1 flex items-center gap-1.5 min-w-0">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${widthPct}%` }} />
                              </div>
                              <span className={`w-24 shrink-0 text-right tabular-nums ${m.delta === null ? 'text-slate-400' : positive ? 'text-emerald-600' : 'text-red-600'}`}>
                                {m.delta === null ? '—' : `${signedCurrency(m.delta)}${m.deltaPct !== null ? ` (${m.deltaPct >= 0 ? '+' : ''}${m.deltaPct.toFixed(0)}%)` : ''}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* C) Attribuzione per voce */}
                  {detailedStats.attribution.length > 0 && (
                    <section>
                      <div className="flex items-baseline justify-between mb-2">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Contributo per voce alla variazione di periodo
                        </h4>
                        <span className={`text-[11px] font-semibold tabular-nums ${detailedStats.attributionTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          Totale: {signedCurrency(detailedStats.attributionTotal)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {detailedStats.attribution.map((item) => {
                          const widthPct = Math.min(100, (Math.abs(item.contribution) / detailedStats.attributionMaxAbs) * 100);
                          const positive = item.contribution >= 0;
                          return (
                            <div key={item.key} className="flex items-center gap-2 text-xs">
                              <span className="w-24 shrink-0 truncate text-slate-600" title={item.label}>{item.label}</span>
                              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div className={`h-full rounded-full ${positive ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${widthPct}%` }} />
                                </div>
                                <span className={`w-24 shrink-0 text-right tabular-nums font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {signedCurrency(item.contribution)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        Δ grezzo di ogni voce dal primo all'ultimo check del periodo{showTotalTrend ? ' (rendimento al netto del 26%)' : ''}. Le barre sommano al «Totale» qui sopra, non alla variazione destagionalizzata in cima.
                      </p>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isSavingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setIsSavingsModalOpen(false)} />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-sky-600" />
                  Risparmio mensile e composizione
                </h3>
                {savingsBreakdown?.totalPerMonth != null && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Media <span className={`font-semibold ${savingsBreakdown.totalPerMonth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{savingsBreakdown.totalPerMonth >= 0 ? '+' : ''}{formatCurrency(savingsBreakdown.totalPerMonth)}/mese</span> · su {savingsBreakdown.monthsUsed} {savingsBreakdown.monthsUsed === 1 ? 'mese completo' : 'mesi completi'}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setIsSavingsModalOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-5">
              {!savingsBreakdown ? (
                <p className="text-sm text-slate-500">Servono almeno 2 check per il calcolo.</p>
              ) : (
                <>
                  {/* Come leggere: due metriche + verdetto dinamico */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-700 mb-2">Come leggere questi numeri</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400" title="Media delle variazioni dei saldi di fine mese (mesi completi). Sensibile alle spese del singolo mese.">Risparmio medio / mese</p>
                        <p className={`text-sm font-bold tabular-nums ${savingsBreakdown.totalPerMonth != null && savingsBreakdown.totalPerMonth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {savingsBreakdown.totalPerMonth == null ? '—' : `${savingsBreakdown.totalPerMonth >= 0 ? '+' : ''}${formatCurrency(savingsBreakdown.totalPerMonth)}`}
                        </p>
                        <p className="text-[9px] text-slate-400">saldi di fine mese</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400" title="Pendenza della regressione su tutti i check: la direzione di fondo del patrimonio, robusta al timing.">Trend di fondo</p>
                        <p className={`text-sm font-bold tabular-nums ${savingsBreakdown.netTrendPct != null && savingsBreakdown.netTrendPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {savingsBreakdown.netTrendPct == null ? '—' : `${savingsBreakdown.netTrendPct >= 0 ? '+' : ''}${savingsBreakdown.netTrendPct.toFixed(1)}%`}
                        </p>
                        <p className="text-[9px] text-slate-400">regressione su tutti i check</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {savingsVerdict(savingsBreakdown.totalPerMonth, savingsBreakdown.netTrendPct, savingsBreakdown.perMonth)}
                    </p>
                  </div>

                  {/* Composizione del risparmio medio/mese */}
                  {savingsBreakdown.perMonth && savingsBreakdown.totalPerMonth != null && (
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Da dove arriva (media €/mese, mesi completi)</h4>
                    <div className="space-y-2.5">
                      {([
                        { key: 'azionario', label: 'Azionario (ETF)', color: '#6366f1', value: savingsBreakdown.perMonth.azionario },
                        { key: 'obbligazionario', label: 'Obbligazionario (BTP)', color: '#f59e0b', value: savingsBreakdown.perMonth.obbligazionario },
                        { key: 'liquidita', label: 'Liquidità (tuoi risparmi)', color: '#0ea5e9', value: savingsBreakdown.perMonth.liquidita },
                      ] as const).map((bucket) => {
                        const pm = savingsBreakdown.perMonth!;
                        const maxAbs = Math.max(Math.abs(pm.azionario), Math.abs(pm.obbligazionario), Math.abs(pm.liquidita), 1);
                        const scale = Math.min(1, Math.abs(bucket.value) / maxAbs);
                        const positive = bucket.value >= 0;
                        const pct = Math.abs(savingsBreakdown.totalPerMonth!) > 0.5
                          ? (bucket.value / savingsBreakdown.totalPerMonth!) * 100
                          : null;
                        return (
                          <div key={bucket.key} className="flex items-center gap-2 text-xs">
                            <span className="w-40 shrink-0 flex items-center gap-1.5 text-slate-600">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: bucket.color }} />
                              {bucket.label}
                            </span>
                            <div className="relative flex-1 h-2 rounded bg-slate-100 min-w-0">
                              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300" />
                              <div
                                className={`absolute top-0 bottom-0 ${positive ? 'rounded-r bg-emerald-500' : 'rounded-l bg-red-500'}`}
                                style={positive ? { left: '50%', width: `${scale * 50}%` } : { right: '50%', width: `${scale * 50}%` }}
                              />
                            </div>
                            <span className={`w-20 shrink-0 text-right tabular-nums font-semibold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {signedCurrency(bucket.value)}
                            </span>
                            <span className="w-12 shrink-0 text-right tabular-nums text-slate-400">
                              {pct === null ? '—' : `${pct >= 0 ? '' : ''}${pct.toFixed(0)}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Le percentuali sono il contributo di ogni voce alla media (sommano a 100%; un valore negativo significa che la voce ha frenato il risparmio).
                    </p>
                  </section>
                  )}

                  {/* Mese per mese */}
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Quanto hai accantonato, mese per mese</h4>
                    <p className="text-[10px] text-slate-400 mb-2">Variazione del patrimonio netto in ogni mese e da quale fonte arriva.</p>
                    <div className="space-y-1.5">
                      {savingsBreakdown.monthly.filter((m) => m.total !== null).map((m, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        const total = m.total as number;
                        const sources = [
                          { label: 'Azionario', color: '#6366f1', value: m.azionario as number },
                          { label: 'Obblig.', color: '#f59e0b', value: m.obbligazionario as number },
                          { label: 'Liquidità', color: '#0ea5e9', value: m.liquidita as number },
                        ];
                        return (
                          <div key={m.month} className="rounded-lg border border-slate-200 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-700 capitalize flex items-center gap-1">
                                {monthLabel(m.month)}
                                {isLast && <span className="text-[9px] font-normal text-amber-500" title="Mese in corso / parziale">• in corso</span>}
                              </span>
                              <span className={`text-sm font-bold tabular-nums ${total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {signedCurrency(total)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                              {sources.map((s) => (
                                <span key={s.label} className="inline-flex items-center gap-1">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                  {s.label}
                                  <span className={`tabular-nums font-medium ${s.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{signedCurrency(s.value)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      Confronto tra i saldi di fine mese. La media in alto è la media di questi mesi (escluso quello in corso): sommando i mesi completi e dividendo per il loro numero ottieni lo stesso valore.
                    </p>
                  </section>

                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 text-[11px] text-slate-600">
                    <span className="font-semibold text-violet-700">Nota.</span> La voce «Azionario» mescola <span className="font-medium">rendimento di mercato</span> e <span className="font-medium">nuovi versamenti</span> in ETF: se sposti risparmi dalla liquidità agli ETF, parte di questa crescita è denaro tuo, non solo guadagno di mercato.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isColumnsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setColumnsModalTab('columns')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${columnsModalTab === 'columns' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  Colonne
                </button>
                <button
                  type="button"
                  onClick={() => setColumnsModalTab('classifications')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${columnsModalTab === 'classifications' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <Tags className="w-3.5 h-3.5" />
                  Classificazioni
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsColumnsModalOpen(false);
                  setEditingColumnKey(null);
                  setEditingColumnLabel('');
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-3">
              {columnsModalTab === 'columns' && <>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="input sm:max-w-sm"
                  value={newColumnLabel}
                  onChange={(e) => setNewColumnLabel(e.target.value)}
                  placeholder="Nuova colonna"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    createColumn.mutate(
                      { label: newColumnLabel.trim() },
                      { onSuccess: () => setNewColumnLabel('') }
                    )
                  }
                >
                  Aggiungi
                </button>
              </div>

              <div className="space-y-2">
                {columns.map((column) => (
                  <div
                    key={column.key}
                    draggable
                    onDragStart={(e) => {
                      setDragColumnKey(column.key);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverColumnKey(column.key);
                    }}
                    onDragLeave={() => {
                      if (dragOverColumnKey === column.key) setDragOverColumnKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragColumnKey && dragColumnKey !== column.key) {
                        swapColumns.mutate({ keyA: dragColumnKey, keyB: column.key });
                      }
                      setDragColumnKey(null);
                      setDragOverColumnKey(null);
                    }}
                    onDragEnd={() => {
                      setDragColumnKey(null);
                      setDragOverColumnKey(null);
                    }}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                      dragColumnKey === column.key
                        ? 'border-sky-400 bg-sky-50 opacity-50'
                        : dragOverColumnKey === column.key
                          ? 'border-sky-400 bg-sky-50'
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                      {editingColumnKey === column.key ? (
                        <input
                          className="input h-9 w-56"
                          value={editingColumnLabel}
                          onChange={(e) => setEditingColumnLabel(e.target.value)}
                        />
                      ) : (
                        <span className="font-medium text-slate-900">{column.label}</span>
                      )}
                      {!column.isActive && <span className="text-xs text-amber-600">nascosta</span>}
                      {!column.showInPie && <span className="text-xs text-slate-500">no torta</span>}
                      {LEGACY_COLUMN_KEYS.has(column.key) && <span className="text-xs text-sky-600">base</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-slate-100"
                        onClick={() => {
                          if (column.position <= 0) return;
                          const neighbor = columns.find((c) => c.position === column.position - 1);
                          if (!neighbor) return;
                          swapColumns.mutate({ keyA: column.key, keyB: neighbor.key });
                        }}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-slate-100"
                        onClick={() => {
                          if (column.position >= columns.length - 1) return;
                          const neighbor = columns.find((c) => c.position === column.position + 1);
                          if (!neighbor) return;
                          swapColumns.mutate({ keyA: column.key, keyB: neighbor.key });
                        }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-slate-100"
                        onClick={() => updateColumn.mutate({ key: column.key, data: { isActive: !column.isActive } })}
                        title={column.isActive ? 'Nascondi colonna nel check' : 'Mostra colonna nel check'}
                      >
                        {column.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <label className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5">
                        <span className="text-[10px] text-slate-600">Torta</span>
                        <button
                          type="button"
                          aria-pressed={column.showInPie}
                          onClick={() => updateColumn.mutate({ key: column.key, data: { showInPie: !column.showInPie } })}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${column.showInPie ? 'bg-sky-600' : 'bg-slate-300'}`}
                          title={column.showInPie ? 'Mostra spicchio nel grafico a torta' : 'Nascondi spicchio nel grafico a torta'}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${column.showInPie ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>
                      </label>
                      {editingColumnKey === column.key ? (
                        <>
                          <button
                            type="button"
                            className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                            onClick={() =>
                              updateColumn.mutate(
                                { key: column.key, data: { label: editingColumnLabel.trim() } },
                                { onSuccess: () => setEditingColumnKey(null) }
                              )
                            }
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-slate-100"
                            onClick={() => setEditingColumnKey(null)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="p-1.5 rounded text-sky-600 hover:bg-sky-50"
                          onClick={() => {
                            setEditingColumnKey(column.key);
                            setEditingColumnLabel(column.label);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-1.5 rounded text-red-600 hover:bg-red-50"
                        onClick={() => deleteColumn.mutate(column.key)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </>}

              {columnsModalTab === 'classifications' && <>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    className="input sm:max-w-sm"
                    value={newClassificationLabel}
                    onChange={(e) => setNewClassificationLabel(e.target.value)}
                    placeholder="Nuova classificazione"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      createClassification.mutate(
                        { label: newClassificationLabel.trim() },
                        { onSuccess: () => setNewClassificationLabel('') }
                      )
                    }
                  >
                    Aggiungi
                  </button>
                </div>

                {(classificationsData ?? []).map((cls) => (
                  <div key={cls.key} className="mb-3 rounded-lg border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {editingClassificationKey === cls.key ? (
                          <input
                            className="input h-8 w-48"
                            value={editingClassificationLabel}
                            onChange={(e) => setEditingClassificationLabel(e.target.value)}
                          />
                        ) : (
                          <span className="font-medium text-slate-800 text-sm">{cls.label}</span>
                        )}
                        <span className="text-xs text-slate-500">{cls.columnKeys.length} colonne</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {editingClassificationKey === cls.key ? (
                          <>
                            <button
                              type="button"
                              className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"
                              onClick={() =>
                                updateClassification.mutate(
                                  { key: cls.key, data: { label: editingClassificationLabel.trim() } },
                                  { onSuccess: () => setEditingClassificationKey(null) }
                                )
                              }
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded hover:bg-slate-100"
                              onClick={() => setEditingClassificationKey(null)}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="p-1.5 rounded text-sky-600 hover:bg-sky-50"
                            onClick={() => {
                              setEditingClassificationKey(cls.key);
                              setEditingClassificationLabel(cls.label);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          onClick={() => deleteClassification.mutate(cls.key)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {columns.map((col) => {
                        const isInThis = cls.columnKeys.includes(col.key);
                        const isInOther = !isInThis && (classificationsData ?? []).some(
                          (other) => other.key !== cls.key && other.columnKeys.includes(col.key)
                        );
                        return (
                          <label
                            key={col.key}
                            className={`flex items-center gap-2 text-sm py-0.5 ${isInOther ? 'opacity-40' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={isInThis}
                              disabled={isInOther}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...cls.columnKeys, col.key]
                                  : cls.columnKeys.filter((k: string) => k !== col.key);
                                updateClassification.mutate({ key: cls.key, data: { columnKeys: next } });
                              }}
                            />
                            <span className={isInThis ? 'text-slate-900' : 'text-slate-500'}>{col.label}</span>
                            {isInOther && <span className="text-xs text-slate-400">(in altra classif.)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {(classificationsData ?? []).length > 0 && columns.some(
                  (col) => !(classificationsData ?? []).some((cls) => cls.columnKeys.includes(col.key))
                ) && (
                  <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 mt-2">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Non classificate</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {columns
                        .filter((col) => !(classificationsData ?? []).some((cls) => cls.columnKeys.includes(col.key)))
                        .map((col) => (
                          <span key={col.key} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5">
                            {col.label}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              </>}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">{editingRowId ? 'Modifica Check' : 'Nuovo Check'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitModal} className="flex flex-col min-h-0">
              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="label">Nome check</label>
                    <input className="input" value={form.checkLabel} onChange={(e) => setForm((prev) => ({ ...prev, checkLabel: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Data</label>
                    <input type="date" className="input" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
                  </div>
                  {activeColumns.map((column) => (
                    <div key={column.key}>
                      <label className="label">{column.label}</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={form.values[column.key] ?? ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            values: { ...prev.values, [column.key]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="label">Note</label>
                    <input className="input" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} disabled={createCheck.isPending || updateCheck.isPending}>Annulla</button>
                <button type="submit" className="btn btn-primary" disabled={createCheck.isPending || updateCheck.isPending}>
                  {(createCheck.isPending || updateCheck.isPending) && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
