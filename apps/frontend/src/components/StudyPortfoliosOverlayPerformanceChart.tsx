import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { portfolioApi } from '../lib/api';
import type { PortfolioStaticPerformanceMetricDTO } from '@budget/shared';
import { PORTFOLIO_PERFORMANCE_METRIC_OPTIONS } from './InvestedPortfolioPerformanceChart';

type OverlayPosition = {
  isin: string;
  amount: number;
};

export type OverlayPortfolio = {
  id: string;
  name: string;
  positions: OverlayPosition[];
  error?: string | null;
};

type OverlaySeriesPoint = {
  date: string;
  dateLabel: string;
  value: number;
};

type OverlaySeries = {
  id: string;
  name: string;
  color: string;
  points: OverlaySeriesPoint[];
  etfCount: number;
};

type OverlayRow = {
  date: string;
  dateLabel: string;
} & Record<string, string | number | undefined>;

type StudyPortfoliosOverlayPerformanceChartProps = {
  portfolios: OverlayPortfolio[];
  metric?: PortfolioStaticPerformanceMetricDTO;
  height?: number;
  title?: string;
  showMetricSelector?: boolean;
};

type RangeKey = '1G' | '1M' | '3M' | '6M' | '1A' | '2A' | '3A' | '4A' | '5A' | '6A' | 'MAX';
type RangeMode = 'preset' | 'custom';

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

const SERIES_COLORS = [
  '#0ea5e9',
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
  '#8b5cf6',
  '#f97316',
  '#22c55e',
  '#64748b',
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

function normalizePositions(positions: OverlayPosition[]): OverlayPosition[] {
  const byIsin = new Map<string, number>();
  positions.forEach((position) => {
    const isin = position.isin.trim().toUpperCase();
    const amount = Number(position.amount);
    if (!isin || !Number.isFinite(amount) || amount <= 0) return;
    byIsin.set(isin, (byIsin.get(isin) ?? 0) + amount);
  });
  return Array.from(byIsin.entries()).map(([isin, amount]) => ({ isin, amount }));
}

function buildRebasedSubset(points: OverlaySeriesPoint[], startDate: string | null, endDate: string | null): OverlaySeriesPoint[] {
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

function mergeSeriesRows(series: OverlaySeries[]): OverlayRow[] {
  const byDate = new Map<string, OverlayRow>();

  series.forEach((item) => {
    item.points.forEach((point) => {
      const existing = byDate.get(point.date) ?? { date: point.date, dateLabel: point.dateLabel };
      existing[item.id] = point.value;
      byDate.set(point.date, existing);
    });
  });

  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function getSeriesFinalReturn(seriesId: string, rows: OverlayRow[]): number | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const value = rows[i][seriesId];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function StudyPortfoliosOverlayPerformanceChart({
  portfolios,
  metric = 'relative',
  height = 420,
  title = 'Curva sovrapposta portafogli',
  showMetricSelector = false,
}: StudyPortfoliosOverlayPerformanceChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<PortfolioStaticPerformanceMetricDTO>(metric);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('MAX');
  const [rangeMode, setRangeMode] = useState<RangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<OverlaySeries[]>([]);

  useEffect(() => {
    setSelectedMetric(metric);
  }, [metric]);

  const validPortfolios = useMemo(
    () =>
      portfolios
        .map((portfolio, index) => ({
          ...portfolio,
          color: SERIES_COLORS[index % SERIES_COLORS.length],
          positions: normalizePositions(portfolio.positions),
        }))
        .filter((portfolio) => !portfolio.error && portfolio.positions.length > 0),
    [portfolios],
  );

  const portfoliosSignature = useMemo(
    () =>
      validPortfolios
        .map((portfolio) =>
          `${portfolio.id}:${portfolio.positions
            .map((position) => `${position.isin}:${position.amount.toFixed(4)}`)
            .sort()
            .join(',')}`,
        )
        .sort()
        .join('|'),
    [validPortfolios],
  );

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (validPortfolios.length === 0) {
        setSeries([]);
        setError('Nessun portafoglio valido da sovrapporre.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const settled = await Promise.allSettled(
          validPortfolios.map(async (portfolio) => {
            const response = await portfolioApi.getInvestedStaticPerformance({
              positions: portfolio.positions,
              metric: selectedMetric,
            });

            return {
              id: portfolio.id,
              name: portfolio.name,
              color: portfolio.color,
              etfCount: response.etfCount,
              points: response.points.map((point) => ({
                date: point.date,
                dateLabel: formatDateLabel(point.date),
                value: point.value,
              })),
            };
          }),
        );

        if (isCancelled) return;

        const nextSeries = settled
          .filter((result): result is PromiseFulfilledResult<OverlaySeries> => result.status === 'fulfilled')
          .map((result) => result.value)
          .filter((result) => result.points.length >= 2);

        if (nextSeries.length === 0) {
          setSeries([]);
          setError('Nessuna serie storica disponibile per i portafogli selezionati.');
          return;
        }

        setSeries(nextSeries);
      } catch (err) {
        if (isCancelled) return;
        setSeries([]);
        setError(err instanceof Error ? err.message : 'Errore caricamento grafico sovrapposto');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [portfoliosSignature, selectedMetric, validPortfolios]);

  const fullSeriesStartDate = useMemo(() => {
    const starts = series.map((item) => item.points[0]?.date).filter(Boolean) as string[];
    return starts.length > 0 ? starts.sort((a, b) => a.localeCompare(b))[0] : '';
  }, [series]);

  const fullSeriesEndDate = useMemo(() => {
    const ends = series.map((item) => item.points[item.points.length - 1]?.date).filter(Boolean) as string[];
    return ends.length > 0 ? ends.sort((a, b) => a.localeCompare(b))[ends.length - 1] : '';
  }, [series]);

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

  const rangeRowsMap = useMemo(() => {
    const map = new Map<RangeKey, OverlayRow[]>();

    if (series.length === 0 || !fullSeriesEndDate) {
      RANGE_OPTIONS.forEach((range) => map.set(range.key, []));
      return map;
    }

    const endDate = parseIsoDate(fullSeriesEndDate);

    RANGE_OPTIONS.forEach((range) => {
      const startDate = getRangeStartDate(endDate, range.key);
      const startIso = startDate ? startDate.toISOString().slice(0, 10) : null;
      const rangeSeries = series
        .map((item) => ({
          ...item,
          points: buildRebasedSubset(item.points, startIso, null),
        }))
        .filter((item) => item.points.length >= 2);

      map.set(range.key, mergeSeriesRows(rangeSeries));
    });

    return map;
  }, [fullSeriesEndDate, series]);

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
      availability[range.key] = (rangeRowsMap.get(range.key)?.length ?? 0) >= 2;
    });

    return availability;
  }, [rangeRowsMap]);

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

  const customRows = useMemo(() => {
    if (customRangeError) return [];
    if (!customStartDate || !customEndDate) return [];
    const slicedSeries = series
      .map((item) => ({
        ...item,
        points: buildRebasedSubset(item.points, customStartDate, customEndDate),
      }))
      .filter((item) => item.points.length >= 2);
    return mergeSeriesRows(slicedSeries);
  }, [customEndDate, customRangeError, customStartDate, series]);

  const displayedRows = useMemo(() => {
    if (rangeMode === 'custom') return customRows;
    return rangeRowsMap.get(selectedRange) ?? [];
  }, [customRows, rangeMode, rangeRowsMap, selectedRange]);

  const activeSeriesIds = useMemo(() => {
    const ids = new Set<string>();
    displayedRows.forEach((row) => {
      series.forEach((item) => {
        if (typeof row[item.id] === 'number') ids.add(item.id);
      });
    });
    return ids;
  }, [displayedRows, series]);

  const displayedSeries = useMemo(
    () => series.filter((item) => activeSeriesIds.has(item.id)),
    [activeSeriesIds, series],
  );

  const displayedStartDate = displayedRows[0]?.date ?? null;
  const displayedEndDate = displayedRows[displayedRows.length - 1]?.date ?? null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Curve sovrapposte a pesi statici iniziali, ribasate a 0% all&apos;inizio del periodo selezionato.
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
          Caricamento grafico sovrapposto...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : displayedRows.length === 0 || displayedSeries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {rangeMode === 'custom' && customRangeError
            ? customRangeError
            : 'Nessun dato storico disponibile per il periodo selezionato.'}
        </div>
      ) : (
        <>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayedRows} margin={{ top: 8, right: 12, bottom: 6, left: 6 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="dateLabel" minTickGap={28} />
                <YAxis tickFormatter={(value) => formatPercent(Number(value), 1)} />
                <Tooltip
                  wrapperStyle={{ zIndex: 60, pointerEvents: 'none' }}
                  labelFormatter={(_label, payload) => formatDateFull((payload?.[0]?.payload?.date as string) ?? '')}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const validPayload = payload
                      .filter((entry) => typeof entry.value === 'number' && Number.isFinite(Number(entry.value)))
                      .sort((a, b) => Number(b.value) - Number(a.value));
                    if (validPayload.length === 0) return null;

                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg min-w-[220px]">
                        <p className="text-xs font-semibold text-slate-900 mb-1">
                          {formatDateFull(String((payload[0]?.payload as OverlayRow | undefined)?.date ?? label ?? ''))}
                        </p>
                        <div className="space-y-1">
                          {validPayload.map((entry) => (
                            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 text-slate-700">
                                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                {entry.name}
                              </span>
                              <span className="font-semibold text-slate-900 tabular-nums">{formatPercent(Number(entry.value))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', paddingBottom: 6 }}
                />
                {displayedSeries.map((item) => (
                  <Line
                    key={item.id}
                    type="monotone"
                    dataKey={item.id}
                    stroke={item.color}
                    strokeWidth={2}
                    dot={false}
                    name={item.name}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
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

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Portafogli</p>
              <p className="font-semibold text-slate-800">{displayedSeries.length}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">ETF totali</p>
              <p className="font-semibold text-slate-800">
                {displayedSeries.reduce((sum, item) => sum + item.etfCount, 0)}
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

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 text-xs">
            {displayedSeries.map((item) => {
              const finalReturn = getSeriesFinalReturn(item.id, displayedRows);
              return (
                <div key={`overlay-final-${item.id}`} className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <p className="text-slate-500 truncate">{item.name}</p>
                  <p className="font-semibold text-slate-800">{finalReturn === null ? 'N/A' : formatPercent(finalReturn)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
