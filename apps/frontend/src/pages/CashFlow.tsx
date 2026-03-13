import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Trash2, Pencil, Check, X, Loader2, Eye, EyeOff, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
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
  shortLabel: string;
  value: number;
  percentage: number;
  color: string;
  columnCount: number;
  level: 'classification';
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
  level: 'column';
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

const CLASSIFICATION_COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#65a30d', '#ea580c'];
const UNCLASSIFIED_GROUP_KEY = '__unclassified';
const MAX_LEGEND_ITEMS = 8;
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

function getDiffHeaderLabel(column: CashFlowColumn): string {
  return LEGACY_DIFF_LABELS[column.key] ?? `Diff ${column.label}`;
}

function getPieShortLabel(column: CashFlowColumn): string {
  return LEGACY_PIE_SHORT_LABELS[column.key] ?? (column.label.length > 8 ? `${column.label.slice(0, 8)}…` : column.label);
}

function getGroupShortLabel(label: string): string {
  return label.length > 14 ? `${label.slice(0, 14)}...` : label;
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
  if (total <= 1) return mixHexColors(baseColor, '#ffffff', 0.12);
  const ratio = 0.08 + (index / Math.max(1, total - 1)) * 0.32;
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
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

  const latestRow = rowsWithMetrics[0] ?? null;
  const positiveDiffCount = rowsWithMetrics.filter((row) => (row.diffTotal ?? 0) > 0).length;
  const trendData = useMemo(
    () =>
      rowsWithMetrics
        .slice()
        .reverse()
        .map((row) => {
          const point: Record<string, string | number> = {
            dateLabel: formatDate(row.date),
            checkLabel: row.checkLabel,
            total: row.total,
          };
          activeColumns.forEach((col) => {
            point[col.key] = getRowValue(row, col.key);
          });
          return point;
        }),
    [rowsWithMetrics, activeColumns]
  );

  const toggleTrendKey = (key: string) => {
    setVisibleTrendKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getTrendColor = (key: string, index: number): string =>
    TREND_LINE_COLORS[key] ?? FALLBACK_TREND_COLORS[index % FALLBACK_TREND_COLORS.length];

  const hasVisibleTrendSeries = showTotalTrend || visibleTrendKeys.size > 0;

  const trendYDomain = useMemo<[number, number]>(() => {
    const values: number[] = [];
    trendData.forEach((point) => {
      if (showTotalTrend) values.push(Number(point.total));
      visibleTrendKeys.forEach((key) => {
        const v = Number(point[key]);
        if (Number.isFinite(v)) values.push(v);
      });
    });
    return computeYAxis(values);
  }, [trendData, showTotalTrend, visibleTrendKeys]);

  const allocationChart = useMemo(() => {
    if (!latestRow) {
      return { groups: [] as AllocationGroupSlice[], columns: [] as AllocationColumnSlice[], total: 0 };
    }

    const valuedColumns: ValuedColumn[] = activeColumns
      .map((column) => ({
        column,
        value: Math.max(0, getRowValue(latestRow, column.key)),
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
        ? '#94a3b8'
        : CLASSIFICATION_COLORS[index % CLASSIFICATION_COLORS.length];

      return {
        key: group.key,
        label: group.label,
        shortLabel: getGroupShortLabel(group.label),
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color,
        columnCount: group.columns.length,
        level: 'classification',
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
        level: 'column',
      }));
    });

    return { groups, columns: columnsData, total };
  }, [activeColumns, classifications, latestRow]);

  const legendGroups = useMemo(() => {
    if (allocationChart.groups.length <= MAX_LEGEND_ITEMS) return allocationChart.groups;

    const visible = allocationChart.groups.slice(0, MAX_LEGEND_ITEMS - 1);
    const hidden = allocationChart.groups.slice(MAX_LEGEND_ITEMS - 1);

    const hiddenValue = hidden.reduce((sum, group) => sum + group.value, 0);
    const hiddenPercentage = hidden.reduce((sum, group) => sum + group.percentage, 0);
    const hiddenColumns = hidden.reduce((sum, group) => sum + group.columnCount, 0);

    return [
      ...visible,
      {
        key: '__legend_other',
        label: `Altre ${hidden.length}`,
        shortLabel: 'Altre',
        value: hiddenValue,
        percentage: hiddenPercentage,
        color: '#64748b',
        columnCount: hiddenColumns,
        level: 'classification' as const,
      },
    ];
  }, [allocationChart.groups]);

  const renderColumnPieLabel = (props: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    index: number;
  }) => {
    const { cx, cy, midAngle, outerRadius, index } = props;
    const point = allocationChart.columns[index];
    const showLabel = allocationChart.columns.length <= 6 ? point?.percentage >= 2.5 : point?.percentage >= 5;
    if (!point || !showLabel) return null;

    const angle = (-midAngle * Math.PI) / 180;
    const radius = outerRadius + 10;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const anchor = x > cx ? 'start' : 'end';

    return (
      <text x={x} y={y} textAnchor={anchor} fill="#334155">
        <tspan x={x} dy="0" fontSize={10} fontWeight={600}>
          {point.shortLabel}
        </tspan>
        <tspan x={x} dy="12" fontSize={10} fill="#64748b">
          {point.percentage.toFixed(1)}%
        </tspan>
      </text>
    );
  };

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
      <div className="sm:ml-16 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (isErrorChecks || isErrorColumns) {
    return (
      <div className="sm:ml-16 flex items-center justify-center h-64">
        <p className="text-red-600">Errore nel caricamento dei dati CashFlow.</p>
      </div>
    );
  }

  return (
    <div className="sm:ml-16 space-y-2 md:h-full md:flex md:flex-col md:space-y-2">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-shrink-0">
        <div className="card !p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Check totali</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">{rowsWithMetrics.length}</p>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Ultimo Tot Attuale</p>
          <p className="text-lg font-bold text-slate-900 tabular-nums">
            {latestRow ? formatCurrency(latestRow.total) : formatCurrency(0)}
          </p>
        </div>
        <div className="card !p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Check in crescita</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{positiveDiffCount}</p>
        </div>
      </div>

      <div className="card !p-3 flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-2">
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
          <p className="text-[10px] text-slate-400 mb-2">Anello interno: classificazioni. Anello esterno: colonne.</p>
          {allocationChart.columns.length === 0 ? (
            <p className="text-xs text-slate-500">Nessun dato disponibile.</p>
          ) : (
            <div className="grid h-60 grid-cols-[300px,minmax(0,1fr)] items-center gap-4">
              <div className="min-w-0 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationChart.groups}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={56}
                      paddingAngle={3}
                      stroke="#ffffff"
                      strokeWidth={2}
                    >
                      {allocationChart.groups.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Pie>
                    <Pie
                      data={allocationChart.columns}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={95}
                      paddingAngle={1}
                      stroke="#ffffff"
                      strokeWidth={2}
                      labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                      label={renderColumnPieLabel}
                    >
                      {allocationChart.columns.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const point = payload[0]?.payload as
                          | AllocationGroupSlice
                          | AllocationColumnSlice
                          | undefined;
                        if (!point) return null;

                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                            <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                            {point.level === 'column' && (
                              <p className="text-xs text-slate-500">Classificazione: {point.groupLabel}</p>
                            )}
                            {point.level === 'classification' && (
                              <p className="text-xs text-slate-500">{point.columnCount} colonne</p>
                            )}
                            <p className="text-sm text-slate-700">{formatCurrency(point.value)}</p>
                            <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0">
                <div className="grid h-full grid-cols-2 content-center gap-x-2.5 gap-y-2">
                  {legendGroups.map((group) => (
                    <div key={group.key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                      <div className="grid grid-cols-[minmax(0,1fr),42px] items-start gap-x-1">
                        <div className="min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                            <span className="text-[11px] leading-tight font-semibold text-slate-800 whitespace-normal break-words">{group.label}</span>
                          </div>
                          <p className="pl-[18px] mt-0.5 text-[9px] leading-tight text-slate-500">
                            {group.columnCount} {group.columnCount === 1 ? 'colonna' : 'colonne'}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[9px] font-semibold text-slate-500">{group.percentage.toFixed(1)}%</span>
                      </div>
                      <p className="mt-1 pl-[18px] text-[11px] leading-tight font-semibold text-slate-900 tabular-nums">{formatCurrency(group.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              )}
        </div>
        <div className="flex flex-col pl-4">
          <div className="flex flex-wrap items-center justify-end gap-1.5 mb-2">
            <label className="inline-flex items-center gap-1.5 select-none rounded-full border border-slate-200 bg-white px-2 py-0.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
              <span className="text-[10px] text-slate-600">Totale</span>
              <button
                type="button"
                aria-pressed={showTotalTrend}
                onClick={() => setShowTotalTrend((prev) => !prev)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showTotalTrend ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${showTotalTrend ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </label>
            {activeColumns.map((col, idx) => {
              const color = getTrendColor(col.key, idx);
              const isOn = visibleTrendKeys.has(col.key);
              return (
                <label key={col.key} className="inline-flex items-center gap-1.5 select-none rounded-full border border-slate-200 bg-white px-2 py-0.5">
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
          {trendData.length < 2 ? (
            <p className="text-xs text-slate-500">Aggiungi almeno 2 check per visualizzare il trend.</p>
          ) : !hasVisibleTrendSeries ? (
            <p className="text-xs text-slate-500">Attiva almeno una linea per visualizzare il trend.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
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
                          {showTotalTrend && <p className="text-xs font-bold text-blue-600">Totale: {formatCurrency(Number(point.total))}</p>}
                          {activeColumns.map((col, idx) => {
                            if (!visibleTrendKeys.has(col.key)) return null;
                            return (
                              <p key={col.key} className="text-xs font-semibold" style={{ color: getTrendColor(col.key, idx) }}>
                                {col.label}: {formatCurrency(Number(point[col.key] ?? 0))}
                              </p>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  {showTotalTrend && (
                    <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={1.8} dot={false} activeDot={{ r: 3, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2 }} />
                  )}
                  {activeColumns.map((col, idx) => {
                    if (!visibleTrendKeys.has(col.key)) return null;
                    const color = getTrendColor(col.key, idx);
                    return (
                      <Line key={col.key} type="monotone" dataKey={col.key} stroke={color} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 2 }} />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
          </div>
        )}
      </div>

      <div className="card !p-3 md:flex-1 md:min-h-0 md:flex md:flex-col">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Storico Check</h3>
        </div>
        {rowsWithMetrics.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun check inserito.</p>
        ) : (
          <div
            ref={tableScrollRef}
            className={`overflow-auto md:flex-1 md:min-h-0 ${isTableDragScrolling ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            onMouseDown={handleTableMouseDown}
            onMouseMove={handleTableMouseMove}
            onMouseUp={stopTableDragScroll}
            onMouseLeave={stopTableDragScroll}
          >
            <table className="w-full text-sm" style={{ minWidth: `${900 + activeColumns.length * 260}px` }}>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left py-2 pl-2 pr-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur w-[76px] min-w-[76px]">Azioni</th>
                  <th className="text-left py-2 pr-3 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">Check</th>
                  <th className="text-left py-2 pr-3 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">Data</th>
                  {activeColumns.flatMap((column) => [
                    <th key={`${column.key}-value`} className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-emerald-50/95">{column.label}</th>,
                    <th key={`${column.key}-diff`} className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">{getDiffHeaderLabel(column)}</th>,
                  ])}
                  <th className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-emerald-200/80">Totale</th>
                  <th className="text-right py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">Diff Tot</th>
                  <th className="text-left py-2 px-2 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur w-[260px] min-w-[260px] max-w-[260px]">Note</th>
                  <th className="text-right py-2 pl-3 sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur w-[76px] min-w-[76px]">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithMetrics.map((row, index) => (
                  <tr key={row.id} className={index % 2 === 0 ? 'bg-slate-50/50 border-b border-slate-100' : 'border-b border-slate-100'}>
                    <td className="py-2 pl-2 pr-2">
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors" onClick={() => openEditModal(row)}><Pencil className="w-4 h-4" /></button>
                        <button type="button" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" onClick={() => deleteCheck.mutate(row.id)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                    <td className="py-2 pr-3 font-medium">{row.checkLabel}</td>
                    <td className="py-2 pr-3">{formatDate(row.date)}</td>
                    {activeColumns.flatMap((column) => [
                      <td key={`${row.id}-${column.key}-value`} className="py-2 px-2 text-right tabular-nums bg-emerald-50/40">
                        {formatCurrency(getRowValue(row, column.key))}
                      </td>,
                      <td key={`${row.id}-${column.key}-diff`} className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffByColumn[column.key] ?? null)}`}>
                        {diffDisplay(row.diffByColumn[column.key] ?? null)}
                      </td>,
                    ])}
                    <td className="py-2 px-2 text-right tabular-nums font-semibold bg-emerald-100/90">{formatCurrency(row.total)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffClass(row.diffTotal)}`}>{diffDisplay(row.diffTotal)}</td>
                    <td className="py-2 px-2 text-slate-600 w-[260px] min-w-[260px] max-w-[260px]">
                      <span className="block truncate" title={row.notes || '-'}>
                        {row.notes || '-'}
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors" onClick={() => openEditModal(row)}><Pencil className="w-4 h-4" /></button>
                        <button type="button" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" onClick={() => deleteCheck.mutate(row.id)}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isColumnsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Gestione Colonne</h3>
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
                      >
                        {column.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
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

              <div className="mt-6 border-t border-slate-200 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Classificazioni</h4>
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
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Annulla</button>
                <button type="submit" className="btn btn-primary">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
