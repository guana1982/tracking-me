import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { portfolioApi } from '../lib/api';
import type {
  PortfolioStaticPerformanceMetricDTO,
  PortfolioStaticPerformanceResponseDTO,
} from '@budget/shared';

type Position = {
  isin: string;
  amount: number;
};

type InvestedPortfolioPerformanceChartProps = {
  positions: Position[];
  metric?: PortfolioStaticPerformanceMetricDTO;
  height?: number;
  title?: string;
  showMetricSelector?: boolean;
};

type RangeKey = '1G' | '1M' | '3M' | '6M' | '1A' | '2A' | '3A' | '4A' | '5A' | '6A' | 'MAX';
type RangeMode = 'preset' | 'custom';

export const PORTFOLIO_PERFORMANCE_METRIC_OPTIONS: Array<{ value: PortfolioStaticPerformanceMetricDTO; label: string }> = [
  { value: 'relative', label: 'relative' },
  { value: 'relative_with_reinvested_dividends', label: 'relative_with_reinvested_dividends' },
];

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '1G', label: '1G' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1A', label: '1A' },
  { key: '2A', label: '2A' },
  { key: '3A', label: '3A' },
  { key: '4A', label: '4A' },
  { key: '5A', label: '5A' },
  { key: '6A', label: '6A' },
  { key: 'MAX', label: 'MAX' },
];

function formatPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDateLabel(date: string): string {
  return new Date(date).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
}

function formatDateFull(date: string): string {
  return new Date(date).toLocaleDateString('it-IT');
}

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function buildRebasedSubset(
  points: Array<{ date: string; dateLabel: string; value: number }>,
  startDate: string | null,
  endDate: string | null,
): Array<{ date: string; dateLabel: string; value: number }> {
  const filtered = points.filter((point) => {
    if (startDate && point.date < startDate) return false;
    if (endDate && point.date > endDate) return false;
    return true;
  });

  if (filtered.length < 2) return [];

  const baseLevel = 1 + filtered[0].value;
  if (!Number.isFinite(baseLevel) || baseLevel <= 0) return [];

  return filtered.map((point) => ({
    ...point,
    value: ((1 + point.value) / baseLevel) - 1,
  }));
}

function getRangeStartDate(endDate: Date, range: RangeKey): Date | null {
  if (range === 'MAX') return null;

  const start = new Date(endDate.getTime());

  switch (range) {
    case '1G':
      start.setUTCDate(start.getUTCDate() - 1);
      return start;
    case '1M':
      start.setUTCMonth(start.getUTCMonth() - 1);
      return start;
    case '3M':
      start.setUTCMonth(start.getUTCMonth() - 3);
      return start;
    case '6M':
      start.setUTCMonth(start.getUTCMonth() - 6);
      return start;
    case '1A':
      start.setUTCFullYear(start.getUTCFullYear() - 1);
      return start;
    case '2A':
      start.setUTCFullYear(start.getUTCFullYear() - 2);
      return start;
    case '3A':
      start.setUTCFullYear(start.getUTCFullYear() - 3);
      return start;
    case '4A':
      start.setUTCFullYear(start.getUTCFullYear() - 4);
      return start;
    case '5A':
      start.setUTCFullYear(start.getUTCFullYear() - 5);
      return start;
    case '6A':
      start.setUTCFullYear(start.getUTCFullYear() - 6);
      return start;
    default:
      return null;
  }
}

export function InvestedPortfolioPerformanceChart({
  positions,
  metric = 'relative',
  height = 320,
  title = 'Andamento Storico Portafoglio (pesi statici)',
  showMetricSelector = true,
}: InvestedPortfolioPerformanceChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<PortfolioStaticPerformanceMetricDTO>(metric);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('MAX');
  const [rangeMode, setRangeMode] = useState<RangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioStaticPerformanceResponseDTO | null>(null);

  useEffect(() => {
    setSelectedMetric(metric);
  }, [metric]);

  const normalizedPositions = useMemo(() => {
    const byIsin = new Map<string, number>();
    positions.forEach((position) => {
      const isin = position.isin.trim().toUpperCase();
      const amount = Number(position.amount);
      if (!isin || !Number.isFinite(amount) || amount <= 0) return;
      byIsin.set(isin, (byIsin.get(isin) ?? 0) + amount);
    });
    return Array.from(byIsin.entries()).map(([isin, amount]) => ({ isin, amount }));
  }, [positions]);

  const positionsSignature = useMemo(
    () => normalizedPositions.map((position) => `${position.isin}:${position.amount.toFixed(2)}`).sort().join('|'),
    [normalizedPositions],
  );

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (normalizedPositions.length === 0) {
        setResult(null);
        setError('Nessuna posizione valida con ISIN e importo > 0');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await portfolioApi.getInvestedStaticPerformance({
          positions: normalizedPositions,
          metric: selectedMetric,
        });
        if (isCancelled) return;
        setResult(response);
      } catch (err) {
        if (isCancelled) return;
        setResult(null);
        setError(err instanceof Error ? err.message : 'Errore caricamento andamento storico');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [positionsSignature, normalizedPositions, selectedMetric]);

  const chartData = useMemo(
    () =>
      (result?.points ?? []).map((point) => ({
        date: point.date,
        dateLabel: formatDateLabel(point.date),
        value: point.value,
      })),
    [result?.points],
  );

  const fullSeriesStartDate = chartData[0]?.date ?? '';
  const fullSeriesEndDate = chartData[chartData.length - 1]?.date ?? '';

  const rangeDataMap = useMemo(() => {
    const map = new Map<RangeKey, Array<{ date: string; dateLabel: string; value: number }>>();
    if (chartData.length < 2) {
      RANGE_OPTIONS.forEach((range) => map.set(range.key, []));
      return map;
    }

    const endDate = parseIsoDate(chartData[chartData.length - 1].date);

    RANGE_OPTIONS.forEach((range) => {
      const startDate = getRangeStartDate(endDate, range.key);
      const startIso = startDate ? startDate.toISOString().slice(0, 10) : null;
      map.set(range.key, buildRebasedSubset(chartData, startIso, null));
    });

    return map;
  }, [chartData]);

  useEffect(() => {
    if (!fullSeriesStartDate || !fullSeriesEndDate) {
      setCustomStartDate('');
      setCustomEndDate('');
      return;
    }

    setCustomStartDate((prev) => {
      if (!prev) return fullSeriesStartDate;
      if (prev < fullSeriesStartDate) return fullSeriesStartDate;
      if (prev > fullSeriesEndDate) return fullSeriesStartDate;
      return prev;
    });

    setCustomEndDate((prev) => {
      if (!prev) return fullSeriesEndDate;
      if (prev > fullSeriesEndDate) return fullSeriesEndDate;
      if (prev < fullSeriesStartDate) return fullSeriesEndDate;
      return prev;
    });
  }, [fullSeriesStartDate, fullSeriesEndDate]);

  const availableRangeMap = useMemo(() => {
    const availability: Record<RangeKey, boolean> = {
      '1G': false,
      '1M': false,
      '3M': false,
      '6M': false,
      '1A': false,
      '2A': false,
      '3A': false,
      '4A': false,
      '5A': false,
      '6A': false,
      MAX: false,
    };
    RANGE_OPTIONS.forEach((range) => {
      availability[range.key] = (rangeDataMap.get(range.key)?.length ?? 0) >= 2;
    });
    return availability;
  }, [rangeDataMap]);

  useEffect(() => {
    if (availableRangeMap[selectedRange]) return;
    const fallback = RANGE_OPTIONS.find((range) => availableRangeMap[range.key])?.key ?? 'MAX';
    setSelectedRange(fallback);
  }, [availableRangeMap, selectedRange]);

  const customRangeError = useMemo(() => {
    if (rangeMode !== 'custom') return null;
    if (!customStartDate || !customEndDate) return 'Seleziona data inizio e fine.';
    if (customStartDate > customEndDate) return 'La data di inizio deve essere precedente o uguale alla data di fine.';
    if (customStartDate < fullSeriesStartDate || customEndDate > fullSeriesEndDate) {
      return 'Intervallo custom fuori dallo storico disponibile.';
    }
    return null;
  }, [customEndDate, customStartDate, fullSeriesEndDate, fullSeriesStartDate, rangeMode]);

  const customRangeData = useMemo(() => {
    if (customRangeError) return [];
    if (!customStartDate || !customEndDate) return [];
    return buildRebasedSubset(chartData, customStartDate, customEndDate);
  }, [chartData, customEndDate, customRangeError, customStartDate]);

  const displayedData = useMemo(() => {
    if (rangeMode === 'custom') return customRangeData;
    return rangeDataMap.get(selectedRange) ?? [];
  }, [customRangeData, rangeDataMap, rangeMode, selectedRange]);

  const displayedStartDate = displayedData[0]?.date ?? null;
  const displayedEndDate = displayedData[displayedData.length - 1]?.date ?? null;
  const displayedFinalReturn = displayedData[displayedData.length - 1]?.value ?? null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Curva aggregata a pesi iniziali fissi, ribasata a 0% alla data iniziale.
          </p>
        </div>
        {showMetricSelector && (
          <select
            className="input text-xs min-w-[220px]"
            value={selectedMetric}
            onChange={(event) => setSelectedMetric(event.target.value as PortfolioStaticPerformanceMetricDTO)}
          >
            {PORTFOLIO_PERFORMANCE_METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-16 flex items-center justify-center text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Caricamento andamento storico...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : displayedData.length === 0 || !result ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {rangeMode === 'custom' && customRangeError
            ? customRangeError
            : 'Nessun dato storico disponibile per il periodo selezionato.'}
        </div>
      ) : (
        <>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayedData} margin={{ top: 8, right: 10, bottom: 6, left: 6 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" minTickGap={28} />
                <YAxis tickFormatter={(value) => formatPercent(Number(value), 1)} />
                <Tooltip
                  formatter={(value: number | string) => formatPercent(Number(value))}
                  labelFormatter={(_label, payload) => formatDateFull((payload?.[0]?.payload?.date as string) ?? '')}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  name="Rendimento cumulato"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((range) => {
              const isActive = selectedRange === range.key;
              const isAvailable = availableRangeMap[range.key];
              return (
                <button
                  key={range.key}
                  type="button"
                  disabled={!isAvailable}
                  title={isAvailable ? `Visualizza ${range.label}` : `Periodo ${range.label} non disponibile`}
                  onClick={() => {
                    setRangeMode('preset');
                    setSelectedRange(range.key);
                  }}
                  className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                    rangeMode === 'preset' && isActive
                      ? 'border-sky-500 bg-sky-500 text-white'
                      : isAvailable
                        ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          <div className={`mt-2 rounded-md border px-2.5 py-2 ${rangeMode === 'custom' ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-xs text-slate-600 font-medium mr-1">Intervallo custom</span>
              <label className="text-xs text-slate-500">
                Da
                <input
                  type="date"
                  className="input mt-1 h-8 text-xs"
                  value={customStartDate}
                  min={fullSeriesStartDate || undefined}
                  max={customEndDate || fullSeriesEndDate || undefined}
                  onChange={(event) => {
                    setRangeMode('custom');
                    setCustomStartDate(event.target.value);
                  }}
                />
              </label>
              <label className="text-xs text-slate-500">
                A
                <input
                  type="date"
                  className="input mt-1 h-8 text-xs"
                  value={customEndDate}
                  min={customStartDate || fullSeriesStartDate || undefined}
                  max={fullSeriesEndDate || undefined}
                  onChange={(event) => {
                    setRangeMode('custom');
                    setCustomEndDate(event.target.value);
                  }}
                />
              </label>
              <button
                type="button"
                className="btn py-1 px-2 text-xs h-8"
                onClick={() => {
                  setRangeMode('preset');
                  setSelectedRange('MAX');
                }}
              >
                Torna a MAX
              </button>
            </div>
            {rangeMode === 'custom' && customRangeError && (
              <p className="text-xs text-red-600 mt-2">{customRangeError}</p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">ETF</p>
              <p className="font-semibold text-slate-800">{result.etfCount}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Rendimento finale</p>
              <p className="font-semibold text-slate-800">
                {displayedFinalReturn === null ? 'N/A' : formatPercent(displayedFinalReturn)}
              </p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Inizio serie</p>
              <p className="font-semibold text-slate-800">{displayedStartDate ? formatDateFull(displayedStartDate) : 'N/A'}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Fine serie</p>
              <p className="font-semibold text-slate-800">{displayedEndDate ? formatDateFull(displayedEndDate) : 'N/A'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
