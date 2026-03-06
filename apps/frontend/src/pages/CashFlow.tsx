import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { Plus, Trash2, Pencil, Check, X, ChevronDown, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  useCashFlowChecks,
  useCashFlowSettings,
  useCreateCashFlowCheck,
  useUpdateCashFlowCheck,
  useDeleteCashFlowCheck,
  useUpdateCashFlowSettings,
} from '../hooks/useQueries';
import type { CashFlowCheckDTO } from '@budget/shared';
const ALLOCATION_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#2563eb'];

type CashFlowRow = CashFlowCheckDTO;

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


function buildCheckLabel(input: string, index: number): string {
  const trimmed = input.trim();
  if (trimmed) return trimmed;
  return `CHECK ${index + 1}`;
}

function computeStockValues(
  row: Pick<CashFlowRow, 'etfLordo' | 'rendimentoLordo'>,
  settings: CashFlowSettings
) {
  const commPerEtf = Number(settings.commissionPerEtf) || 0;
  const numEtf = Number(settings.etfCount) || 0;
  const commissionTotal = commPerEtf * numEtf;
  const rendLordo = Number(row.rendimentoLordo) || 0;
  const etfL = Number(row.etfLordo) || 0;
  const tasseComm = (rendLordo * 26) / 100 + commissionTotal;
  const rendimentoNetto = rendLordo - tasseComm;
  const azionarioNetto = etfL - tasseComm;

  return { tasseComm, rendimentoNetto, azionarioNetto };
}

function computeTotal(row: CashFlowRow, settings: CashFlowSettings): number {
  const { azionarioNetto } = computeStockValues(row, settings);

  return (
    (Number(row.bbva) || 0) +
    (Number(row.tradeRepublic) || 0) +
    (Number(row.webankCc) || 0) +
    (Number(row.webankObbl) || 0) +
    azionarioNetto +
    (Number(row.bper) || 0) +
    (Number(row.tricount) || 0) +
    (Number(row.cartaWebank) || 0) +
    (Number(row.edenred) || 0)
  );
}

function getRowDateTimestamp(row: Pick<CashFlowRow, 'date'>): number {
  const timestamp = new Date(row.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortRowsByDateDesc(input: CashFlowRow[]): CashFlowRow[] {
  return [...input].sort((a, b) => getRowDateTimestamp(b) - getRowDateTimestamp(a));
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
  const { data: checksData, isLoading: isLoadingChecks, isError: isErrorChecks } = useCashFlowChecks();
  const { data: settingsData, isLoading: isLoadingSettings } = useCashFlowSettings();
  const createCheckMutation = useCreateCashFlowCheck();
  const updateCheckMutation = useUpdateCashFlowCheck();
  const deleteCheckMutation = useDeleteCashFlowCheck();
  const updateSettingsMutation = useUpdateCashFlowSettings();

  const rows: CashFlowRow[] = checksData ?? [];
  const [settings, setSettings] = useState<CashFlowSettings>(INITIAL_SETTINGS);
  const settingsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (settingsData) {
      setSettings({
        commissionPerEtf: Number(settingsData.commissionPerEtf) || INITIAL_SETTINGS.commissionPerEtf,
        etfCount: Number(settingsData.etfCount) || INITIAL_SETTINGS.etfCount,
      });
    }
  }, [settingsData]);

  const updateSettingsWithDebounce = useCallback(
    (next: CashFlowSettings) => {
      setSettings(next);
      if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
      settingsDebounceRef.current = setTimeout(() => {
        updateSettingsMutation.mutate(next);
      }, 800);
    },
    [updateSettingsMutation]
  );

  const [form, setForm] = useState<CashFlowFormState>(INITIAL_FORM);
  const [isNewCheckModalOpen, setIsNewCheckModalOpen] = useState(false);
  const [isTrendOpen, setIsTrendOpen] = useState(true);
  const [showAzionarioTrend, setShowAzionarioTrend] = useState(false);
  const [showBbvaTrend, setShowBbvaTrend] = useState(false);
  const [showTradeRepTrend, setShowTradeRepTrend] = useState(false);
  const [showWebankTrend, setShowWebankTrend] = useState(false);
  const [showBperTrend, setShowBperTrend] = useState(false);
  const [newInlineDraft, setNewInlineDraft] = useState<CashFlowFormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CashFlowFormState | null>(null);
  const [isTableDragScrolling, setIsTableDragScrolling] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableDragActiveRef = useRef(false);
  const tableDragStartXRef = useRef(0);
  const tableDragStartYRef = useRef(0);
  const tableDragStartScrollLeftRef = useRef(0);
  const tableDragStartScrollTopRef = useRef(0);

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
    // Use only one point per day (the first row for that day in table order) to avoid
    // duplicated x-axis labels and mismatched perception between table and chart.
    const perDay = new Map<
      string,
      {
        id: string;
        checkLabel: string;
        dateLabel: string;
        total: number;
        stockComparto: number;
        bbva: number;
        tradeRepublic: number;
        webankCc: number;
        bper: number;
      }
    >();

    rowsWithComputed.forEach((row) => {
      const dayKey = row.date.split('T')[0];
      if (perDay.has(dayKey)) return;

      perDay.set(dayKey, {
        id: row.id,
        checkLabel: row.checkLabel,
        dateLabel: formatDate(row.date),
        total: row.total,
        stockComparto: row.webankObbl + row.azionarioNetto,
        bbva: row.bbva,
        tradeRepublic: row.tradeRepublic,
        webankCc: row.webankCc,
        bper: row.bper,
      });
    });

    return Array.from(perDay.values()).reverse();
  }, [rowsWithComputed]);
  const latestTrendPoint = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const allocationData = useMemo(() => {
    if (!latestRow) return [];

    const raw = [
      { label: 'BPER-Hub', shortLabel: 'BPER', value: latestRow.bper },
      { label: 'BBVA-FondoEmergenze', shortLabel: 'BBVA', value: latestRow.bbva },
      { label: 'Trade Rep.-Vacanza&Extra', shortLabel: 'TR', value: latestRow.tradeRepublic },
      { label: 'WeBank-Investimenti', shortLabel: 'WBK', value: latestRow.webankCc },
      { label: 'Obbligazioni', shortLabel: 'OBBL', value: latestRow.webankObbl },
      { label: 'Azionario', shortLabel: 'AZ', value: latestRow.azionarioNetto },
    ];

    const sanitized = raw.map((item, index) => ({
      ...item,
      color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
      chartValue: Math.max(0, item.value),
    }));

    const total = sanitized.reduce((sum, item) => sum + item.chartValue, 0);

    return sanitized.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.chartValue / total) * 100 : 0,
    }));
  }, [latestRow]);
  const allocationTotal = allocationData.reduce((sum, item) => sum + item.chartValue, 0);
  const renderAllocationLabel = (props: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    index: number;
  }) => {
    const { cx, cy, midAngle, outerRadius, index } = props;
    const point = allocationData[index];
    if (!point || point.percentage <= 0) return null;

    const angle = (-midAngle * Math.PI) / 180;
    const radius = outerRadius + 22;
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
      createdAt: '',
      updatedAt: '',
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
    createCheckMutation.mutate(
      {
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
      },
      {
        onSuccess: () => {
          setForm((prev) => ({
            ...INITIAL_FORM,
            date: prev.date || today,
          }));
          setIsNewCheckModalOpen(false);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteCheckMutation.mutate(id);
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

    const existingRow = rows.find((r) => r.id === editingId);
    const fallbackLabel = existingRow?.checkLabel || `CHECK ${rows.indexOf(existingRow!) + 1}`;
    const nextLabel = editingDraft.checkLabel.trim() || fallbackLabel;

    updateCheckMutation.mutate(
      {
        id: editingId,
        data: {
          checkLabel: nextLabel,
          date: editingDraft.date || existingRow?.date || today,
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
        },
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditingDraft(null);
        },
      }
    );
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
    createCheckMutation.mutate(
      {
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
      },
      {
        onSuccess: () => {
          setNewInlineDraft(null);
        },
      }
    );
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

  const stopTableDragScroll = () => {
    tableDragActiveRef.current = false;
    setIsTableDragScrolling(false);
  };

  const canStartTableDrag = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('input, textarea, button, select, a, [role="button"]')) return false;
    if (target.closest('[data-row-editing="true"]')) return false;
    return true;
  };

  const handleTableMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
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

  const handleTableMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
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

    return () => {
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isTableDragScrolling]);

  const commissionTotal = settings.commissionPerEtf * settings.etfCount;
  const inlineCellInputClass =
    'w-full min-w-[105px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-sky-300';
  const totalHeaderClass = 'bg-emerald-200/80 border-l border-emerald-300';
  const totalCellClass = 'bg-emerald-100/90 border-l border-emerald-200';
  const diffTotColumnClass = 'w-[120px] min-w-[120px]';
  const noteColumnClass = 'w-[260px] min-w-[260px] max-w-[260px]';
  const actionsColumnClass = 'w-[76px] min-w-[76px]';
  const stickyHeaderBaseClass = 'sticky top-0 z-20 border-b border-slate-200';
  const stickyHeaderPlainClass = `${stickyHeaderBaseClass} bg-white/95 backdrop-blur`;
  const stickyHeaderInputClass = `${stickyHeaderBaseClass} bg-emerald-50/95`;

  if (isLoadingChecks || isLoadingSettings) {
    return (
      <div className="sm:ml-16 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (isErrorChecks) {
    return (
      <div className="sm:ml-16 flex items-center justify-center h-64">
        <p className="text-red-600">Errore nel caricamento dei dati CashFlow.</p>
      </div>
    );
  }

  return (
    <div className="sm:ml-16 space-y-4 md:h-full md:flex md:flex-col md:space-y-4">
      <div className="card flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cash Flow Patrimonio</h2>
            <p className="text-sm text-slate-500 mt-1">
              Struttura allineata al file Excel: colonne input, differenze sul check precedente e blocco
              azionario calcolato automaticamente.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary flex-shrink-0"
            onClick={() => setIsNewCheckModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nuovo check
          </button>
        </div>
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
            <span className="ml-2 text-xs font-normal text-slate-500">
              (ultimo check per ogni data)
            </span>
          </button>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <p className="text-sm text-slate-500">
              Ultimo totale:{' '}
              <span className="font-semibold text-slate-800">
                {formatCurrency(latestTrendPoint?.total ?? 0)}
              </span>
            </p>
            {isTrendOpen && (
              <label className="inline-flex items-center gap-2 select-none rounded-full border border-slate-200 bg-white px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
                <span className="text-xs text-slate-600">Comparto</span>
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
            {isTrendOpen && (
              <label className="inline-flex items-center gap-2 select-none rounded-full border border-slate-200 bg-white px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                <span className="text-xs text-slate-600">BBVA</span>
                <button
                  type="button"
                  aria-label="Mostra linea BBVA"
                  aria-pressed={showBbvaTrend}
                  onClick={() => setShowBbvaTrend((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showBbvaTrend ? 'bg-sky-400' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      showBbvaTrend ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
            {isTrendOpen && (
              <label className="inline-flex items-center gap-2 select-none rounded-full border border-slate-200 bg-white px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-xs text-slate-600">TRADE</span>
                <button
                  type="button"
                  aria-label="Mostra linea TRADE REP."
                  aria-pressed={showTradeRepTrend}
                  onClick={() => setShowTradeRepTrend((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showTradeRepTrend ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      showTradeRepTrend ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
            {isTrendOpen && (
              <label className="inline-flex items-center gap-2 select-none rounded-full border border-slate-200 bg-white px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-800" />
                <span className="text-xs text-slate-600">WeBank</span>
                <button
                  type="button"
                  aria-label="Mostra linea WeBank c/c"
                  aria-pressed={showWebankTrend}
                  onClick={() => setShowWebankTrend((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showWebankTrend ? 'bg-amber-800' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      showWebankTrend ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
            {isTrendOpen && (
              <label className="inline-flex items-center gap-2 select-none rounded-full border border-slate-200 bg-white px-2 py-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
                <span className="text-xs text-slate-600">BPER</span>
                <button
                  type="button"
                  aria-label="Mostra linea BPER c/c"
                  aria-pressed={showBperTrend}
                  onClick={() => setShowBperTrend((prev) => !prev)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showBperTrend ? 'bg-red-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      showBperTrend ? 'translate-x-4' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            )}
          </div>
        </div>

        {isTrendOpen && (
          <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">Suddivisione Ultimo Check</p>
              {allocationTotal <= 0 ? (
                <p className="text-sm text-slate-500">Dati insufficienti per visualizzare la torta.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="chartValue"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                        stroke="#ffffff"
                        strokeWidth={1}
                        labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        label={renderAllocationLabel}
                      >
                        {allocationData.map((item) => (
                          <Cell key={item.label} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const point = payload[0]?.payload as
                            | { label: string; value: number; percentage: number; color: string }
                            | undefined;
                          if (!point) return null;

                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                              <p className="text-sm font-semibold text-slate-900">{point.label}</p>
                              <p className="text-sm text-slate-700">{formatCurrency(point.value)}</p>
                              <p className="text-xs text-slate-500">{point.percentage.toFixed(1)}%</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
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
                            | {
                              checkLabel: string;
                              dateLabel: string;
                              total: number;
                              stockComparto: number;
                              bbva: number;
                              tradeRepublic: number;
                              webankCc: number;
                              bper: number;
                            }
                            | undefined;
                          if (!point) return null;

                          const totalPoint = payload.find((entry) => entry.dataKey === 'total');
                          const stockPoint = payload.find((entry) => entry.dataKey === 'stockComparto');
                          const bbvaPoint = payload.find((entry) => entry.dataKey === 'bbva');
                          const tradePoint = payload.find((entry) => entry.dataKey === 'tradeRepublic');
                          const webankPoint = payload.find((entry) => entry.dataKey === 'webankCc');
                          const bperPoint = payload.find((entry) => entry.dataKey === 'bper');

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
                              {showBbvaTrend && (
                                <p className="text-sm font-semibold text-sky-500">
                                  BBVA: {formatCurrency(Number(bbvaPoint?.value ?? point.bbva))}
                                </p>
                              )}
                              {showTradeRepTrend && (
                                <p className="text-sm font-semibold text-amber-500">
                                  TRADE REP.: {formatCurrency(Number(tradePoint?.value ?? point.tradeRepublic))}
                                </p>
                              )}
                              {showWebankTrend && (
                                <p className="text-sm font-semibold text-amber-800">
                                  WeBank c/c: {formatCurrency(Number(webankPoint?.value ?? point.webankCc))}
                                </p>
                              )}
                              {showBperTrend && (
                                <p className="text-sm font-semibold text-red-600">
                                  BPER c/c: {formatCurrency(Number(bperPoint?.value ?? point.bper))}
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
                      {showBbvaTrend && (
                        <Line
                          type="monotone"
                          dataKey="bbva"
                          stroke="#38bdf8"
                          strokeWidth={1.7}
                          dot={false}
                          activeDot={{ r: 4, fill: '#0ea5e9', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                      {showTradeRepTrend && (
                        <Line
                          type="monotone"
                          dataKey="tradeRepublic"
                          stroke="#f59e0b"
                          strokeWidth={1.7}
                          dot={false}
                          activeDot={{ r: 4, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                      {showWebankTrend && (
                        <Line
                          type="monotone"
                          dataKey="webankCc"
                          stroke="#92400e"
                          strokeWidth={1.7}
                          dot={false}
                          activeDot={{ r: 4, fill: '#78350f', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                      {showBperTrend && (
                        <Line
                          type="monotone"
                          dataKey="bper"
                          stroke="#dc2626"
                          strokeWidth={1.7}
                          dot={false}
                          activeDot={{ r: 4, fill: '#b91c1c', stroke: '#ffffff', strokeWidth: 2 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
          <div
            ref={tableScrollRef}
            className={`overflow-auto md:flex-1 md:min-h-0 ${
              isTableDragScrolling ? 'cursor-grabbing select-none' : 'cursor-grab'
            }`}
            onMouseDown={handleTableMouseDown}
            onMouseMove={handleTableMouseMove}
            onMouseUp={stopTableDragScroll}
            onMouseLeave={stopTableDragScroll}
          >
            <table className="min-w-[2300px] w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={`text-left py-2 pl-2 pr-2 ${stickyHeaderPlainClass} ${actionsColumnClass}`}>Azioni</th>
                  <th className={`text-left py-2 pr-3 ${stickyHeaderPlainClass}`}>Check</th>
                  <th className={`text-left py-2 pr-3 ${stickyHeaderPlainClass}`}>Data</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>BBVA c/c</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>Diff BBVA</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>TRADE REP.</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>Diff TR</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>WEBANK c/c</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>Diff WEBANK</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>WEBANK Obbl</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>Diff OBBLIG</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>ETF tutti LORDO</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>RENDIM. LORDO</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>TASSE+COMM</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>REND. NETTO</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>AZIONARIO NETTO</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>Diff AZ. NETTO</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>BPER c/c</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass}`}>Diff BPER</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>TRIC DEB/CRED</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>CartaWeBank</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderInputClass}`}>EDENRED</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderBaseClass} ${totalHeaderClass}`}>Tot Attuale</th>
                  <th className={`text-right py-2 px-2 ${stickyHeaderPlainClass} ${diffTotColumnClass}`}>Diff Tot</th>
                  <th className={`text-left py-2 px-2 ${stickyHeaderPlainClass} ${noteColumnClass}`}>Note</th>
                  <th className={`text-right py-2 pl-3 ${stickyHeaderPlainClass} ${actionsColumnClass}`}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {newInlineDraft && (
                  <tr className="bg-sky-50/70 border-b border-sky-200" data-row-editing="true">
                    <td className={`py-2 pl-2 pr-2 text-left ${actionsColumnClass}`}>
                      <div className="flex items-center gap-1.5">
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
                    <td className={`py-2 px-2 text-right tabular-nums font-semibold text-emerald-700 ${totalCellClass}`}>{formatCurrency(newInlinePreview?.total ?? 0)}</td>
                    <td className={`py-2 px-2 text-right tabular-nums ${diffTotColumnClass} ${diffClass(newInlinePreview?.diffTotal ?? null)}`}>{diffDisplay(newInlinePreview?.diffTotal ?? null)}</td>
                    <td className={`py-2 px-2 ${noteColumnClass}`}>
                      <input
                        type="text"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                        value={newInlineDraft.notes}
                        onChange={(e) => handleNewInlineChange('notes', e.target.value)}
                        onKeyDown={handleNewInlineKeyDown}
                      />
                    </td>
                    <td className={`py-2 pl-3 text-right ${actionsColumnClass}`}>
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
                      data-row-editing={isEditing ? 'true' : 'false'}
                      className={
                        index % 2 === 0
                          ? 'bg-slate-50/50 border-b border-slate-100'
                          : 'border-b border-slate-100'
                      }
                    >
                      <td className={`py-2 pl-2 pr-2 text-left ${actionsColumnClass}`}>
                        <div className="flex items-center gap-1.5">
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
                      <td className={`py-2 px-2 text-right tabular-nums font-semibold text-emerald-700 ${totalCellClass}`}>
                        {formatCurrency(row.total)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums ${diffTotColumnClass} ${diffClass(row.diffTotal)}`}>
                        {diffDisplay(row.diffTotal)}
                      </td>

                      <td className={`py-2 px-2 text-slate-600 ${noteColumnClass}`}>
                        {isEditing ? (
                          <input
                            type="text"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
                            value={editingDraft.notes}
                            onChange={(e) => handleInlineChange('notes', e.target.value)}
                            onKeyDown={handleInlineKeyDown}
                          />
                        ) : (
                          <span className="block truncate" title={row.notes || '-'}>
                            {row.notes || '-'}
                          </span>
                        )}
                      </td>

                      <td className={`py-2 pl-3 text-right ${actionsColumnClass}`}>
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

      {isNewCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Nuovo Check</h3>
              <button
                type="button"
                onClick={() => setIsNewCheckModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                aria-label="Chiudi modale nuovo check"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
              <div className="px-5 py-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div>
                    <label className="label">Commissione per ETF</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={settings.commissionPerEtf}
                      onChange={(e) =>
                        updateSettingsWithDebounce({
                          ...settings,
                          commissionPerEtf: parseAmount(e.target.value),
                        })
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
                        updateSettingsWithDebounce({
                          ...settings,
                          etfCount: Math.max(0, Math.floor(parseAmount(e.target.value))),
                        })
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

              <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
