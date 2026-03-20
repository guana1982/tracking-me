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
};

const METRIC_OPTIONS: Array<{ value: PortfolioStaticPerformanceMetricDTO; label: string }> = [
  { value: 'relative', label: 'relative' },
  { value: 'relative_with_reinvested_dividends', label: 'relative_with_reinvested_dividends' },
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

export function InvestedPortfolioPerformanceChart({
  positions,
  metric = 'relative',
  height = 320,
  title = 'Andamento Storico Portafoglio (pesi statici)',
}: InvestedPortfolioPerformanceChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<PortfolioStaticPerformanceMetricDTO>(metric);
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

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            Curva storica aggregata a pesi iniziali fissi, senza ribilanciamento.
          </p>
        </div>
        <select
          className="input text-xs min-w-[220px]"
          value={selectedMetric}
          onChange={(event) => setSelectedMetric(event.target.value as PortfolioStaticPerformanceMetricDTO)}
        >
          {METRIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
      ) : chartData.length === 0 || !result ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Nessun dato storico disponibile.
        </div>
      ) : (
        <>
          <div style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 6, left: 6 }}>
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

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">ETF</p>
              <p className="font-semibold text-slate-800">{result.etfCount}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Rendimento finale</p>
              <p className="font-semibold text-slate-800">{formatPercent(result.finalReturn)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Inizio serie</p>
              <p className="font-semibold text-slate-800">{formatDateFull(result.startDate)}</p>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-2">
              <p className="text-slate-500">Fine serie</p>
              <p className="font-semibold text-slate-800">{formatDateFull(result.endDate)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

