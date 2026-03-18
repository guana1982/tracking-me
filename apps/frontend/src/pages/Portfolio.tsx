import { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Loader2, RefreshCw, Plus, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { usePortfolioHistory } from '../hooks/useQueries';
import { portfolioApi } from '../lib/api';
import type {
  PortfolioHistoryHorizonDTO,
  PortfolioHistoryPointDTO,
  PortfolioSymbolHistoryDTO,
} from '@budget/shared';

type AssetClass = 'AZIONARIO' | 'OBBLIGAZIONARIO';
type Horizon = PortfolioHistoryHorizonDTO;
type InstrumentInsertType = 'ETF' | 'OBBLIGAZIONE';

type InstrumentDefinition = {
  symbol: string;
  name: string;
  isin: string;
  assetClass: AssetClass;
};

type InvestedPosition = {
  symbol: string;
  amount: number;
};

type StudyConfig = {
  symbol: string;
  enabled: boolean;
  weight: number;
};
type SeriesBySymbol = Record<string, PortfolioHistoryPointDTO[]>;

type PortfolioPoint = {
  date: string;
  value: number;
};

type PerformanceMetrics = {
  cumulativeReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  maxDrawdown: number;
};
const ENABLE_PORTFOLIO_HISTORY = false;

const INSTRUMENTS: InstrumentDefinition[] = [
  {
    symbol: 'WORLD',
    name: 'iShares Core MSCI World UCITS ETF USD (Acc)',
    isin: 'IE00B4L5Y983',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'PACIFIC_EXJP',
    name: 'iShares Core MSCI Pacific ex Japan UCITS ETF',
    isin: 'IE00B52MJY50',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'EM_EX_CHINA',
    name: 'iShares MSCI EM ex-China UCITS ETF',
    isin: 'IE00BMG6Z448',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'SWITZERLAND',
    name: 'UBS MSCI Switzerland 20/35 UCITS ETF',
    isin: 'LU0977261329',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'UK',
    name: 'UBS MSCI United Kingdom UCITS ETF',
    isin: 'LU0950670850',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'AI_BIGDATA',
    name: 'Xtrackers AI & Big Data UCITS ETF 1C',
    isin: 'IE00BGV5VN51',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'MSCI_SMALLCAP',
    name: 'SPDR MSCI World Small Cap UCITS ETF',
    isin: 'IE00BF4RFH31',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'S&P500',
    name: 'iShares Core S&P 500 UCITS ETF',
    isin: 'IE00B5BMR087',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'WORLD_EX_USA',
    name: 'iShares MSCI World ex-USA UCITS ETF USD (Acc)',
    isin: 'IE000R4ZNTN3',
    assetClass: 'AZIONARIO',
  },
  {
    symbol: 'XEON',
    name: 'Xtrackers II EUR Overnight Rate Swap UCITS ETF 1C',
    isin: 'LU0290358497',
    assetClass: 'OBBLIGAZIONARIO',
  },
  {
    symbol: 'AMUNDI_SMART_OVN',
    name: 'Amundi Smart Overnight Return UCITS ETF',
    isin: 'LU1190417599',
    assetClass: 'OBBLIGAZIONARIO',
  },
  {
    symbol: 'USB_FOREIGN_BOND',
    name: 'UBS Bloomberg US Liquid Corporates UCITS ETF (Dist)',
    isin: 'LU0879397742',
    assetClass: 'OBBLIGAZIONARIO',
  },
];

const DEFAULT_INVESTED_POSITIONS: InvestedPosition[] = [
  { symbol: 'WORLD', amount: 18000 },
  { symbol: 'PACIFIC_EXJP', amount: 7500 },
  { symbol: 'EM_EX_CHINA', amount: 6000 },
  { symbol: 'XEON', amount: 5000 },
];

function getInstrument(symbol: string): InstrumentDefinition | undefined {
  return INSTRUMENTS.find((item) => item.symbol === symbol);
}

function mapInsertTypeToAssetClass(type: InstrumentInsertType): AssetClass {
  return type === 'ETF' ? 'AZIONARIO' : 'OBBLIGAZIONARIO';
}

function formatMonthLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('it-IT', {
    month: 'short',
    year: '2-digit',
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function normalizeWeights(input: { symbol: string; weight: number }[]): Record<string, number> {
  const sanitized = input
    .map((item) => ({ symbol: item.symbol, weight: Math.max(0, item.weight) }))
    .filter((item) => item.weight > 0);

  if (sanitized.length === 0) return {};

  const total = sanitized.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    const equal = 1 / sanitized.length;
    return sanitized.reduce<Record<string, number>>((acc, item) => {
      acc[item.symbol] = equal;
      return acc;
    }, {});
  }

  return sanitized.reduce<Record<string, number>>((acc, item) => {
    acc[item.symbol] = item.weight / total;
    return acc;
  }, {});
}

function computePortfolioSeries(seriesBySymbol: SeriesBySymbol, weights: Record<string, number>): PortfolioPoint[] {
  const symbols = Object.keys(weights).filter((symbol) => seriesBySymbol[symbol]?.length > 0);
  if (symbols.length === 0) return [];

  const pointsCount = Math.min(...symbols.map((symbol) => seriesBySymbol[symbol].length));
  if (pointsCount < 2) return [];

  const basePrices = symbols.reduce<Record<string, number>>((acc, symbol) => {
    acc[symbol] = seriesBySymbol[symbol][0].close;
    return acc;
  }, {});

  const referenceSymbol = symbols[0];
  const result: PortfolioPoint[] = [];

  for (let index = 0; index < pointsCount; index += 1) {
    const date = seriesBySymbol[referenceSymbol][index].date;
    const value = symbols.reduce((sum, symbol) => {
      const normalized = (seriesBySymbol[symbol][index].close / basePrices[symbol]) * 100;
      return sum + normalized * weights[symbol];
    }, 0);

    result.push({ date, value });
  }

  return result;
}

function computePerformanceMetrics(series: PortfolioPoint[]): PerformanceMetrics | null {
  if (series.length < 2) return null;

  const values = series.map((point) => point.value);
  const start = values[0];
  const end = values[values.length - 1];
  if (start <= 0 || end <= 0) return null;

  const periods = values.length - 1;
  const monthlyReturns = values.slice(1).map((value, index) => value / values[index] - 1);
  const avgReturn = monthlyReturns.reduce((sum, value) => sum + value, 0) / monthlyReturns.length;
  const variance =
    monthlyReturns.reduce((sum, value) => sum + (value - avgReturn) ** 2, 0) /
    Math.max(1, monthlyReturns.length - 1);

  let peak = values[0];
  let maxDrawdown = 0;
  values.forEach((value) => {
    peak = Math.max(peak, value);
    const drawdown = value / peak - 1;
    maxDrawdown = Math.min(maxDrawdown, drawdown);
  });

  return {
    cumulativeReturn: end / start - 1,
    annualizedReturn: Math.pow(end / start, 12 / periods) - 1,
    annualizedVolatility: Math.sqrt(variance) * Math.sqrt(12),
    maxDrawdown,
  };
}

function buildInitialStudyConfig(positions: InvestedPosition[]): StudyConfig[] {
  const investedMap = normalizeWeights(
    positions.map((position) => ({
      symbol: position.symbol,
      weight: position.amount,
    }))
  );

  return INSTRUMENTS.map((instrument) => {
    const investedWeight = investedMap[instrument.symbol] ?? 0;
    return {
      symbol: instrument.symbol,
      enabled: investedWeight > 0,
      weight: Number((investedWeight * 100).toFixed(2)),
    };
  });
}

export function Portfolio() {
  const justEtfDebugCallDoneRef = useRef(false);
  const [investedPositions, setInvestedPositions] = useState<InvestedPosition[]>(
    DEFAULT_INVESTED_POSITIONS
  );
  const [horizon, setHorizon] = useState<Horizon>('3Y');
  const [studyConfig, setStudyConfig] = useState<StudyConfig[]>(
    buildInitialStudyConfig(DEFAULT_INVESTED_POSITIONS)
  );
  const [isAddInstrumentModalOpen, setIsAddInstrumentModalOpen] = useState(false);
  const [insertType, setInsertType] = useState<InstrumentInsertType>('ETF');
  const [insertSymbol, setInsertSymbol] = useState('');
  const [insertAmount, setInsertAmount] = useState('');
  const [insertError, setInsertError] = useState<string | null>(null);

  const investedTotal = useMemo(
    () => investedPositions.reduce((sum, position) => sum + Math.max(0, position.amount), 0),
    [investedPositions]
  );
  const investedSymbols = useMemo(
    () => new Set(investedPositions.map((position) => position.symbol)),
    [investedPositions]
  );
  const availableInstruments = useMemo(
    () => INSTRUMENTS.filter((instrument) => !investedSymbols.has(instrument.symbol)),
    [investedSymbols]
  );
  const availableInsertInstruments = useMemo(
    () =>
      availableInstruments.filter(
        (instrument) => instrument.assetClass === mapInsertTypeToAssetClass(insertType)
      ),
    [availableInstruments, insertType]
  );

  const investedWeightMap = useMemo(
    () =>
      normalizeWeights(
        investedPositions.map((position) => ({
          symbol: position.symbol,
          weight: Math.max(0, position.amount),
        }))
      ),
    [investedPositions]
  );

  const scenarioWeightMap = useMemo(
    () =>
      normalizeWeights(
        studyConfig
          .filter((item) => item.enabled)
          .map((item) => ({ symbol: item.symbol, weight: item.weight }))
      ),
    [studyConfig]
  );

  const symbolToIsin = useMemo<Record<string, string>>(
    () =>
      INSTRUMENTS.reduce<Record<string, string>>((acc, instrument) => {
        acc[instrument.symbol] = instrument.isin;
        return acc;
      }, {}),
    []
  );
  const isinToSymbol = useMemo<Record<string, string>>(
    () =>
      INSTRUMENTS.reduce<Record<string, string>>((acc, instrument) => {
        acc[instrument.isin] = instrument.symbol;
        return acc;
      }, {}),
    []
  );

  const isinsForSeries = useMemo(() => {
    const symbols = new Set([...Object.keys(investedWeightMap), ...Object.keys(scenarioWeightMap)]);
    const isins = Array.from(symbols)
      .map((symbol) => symbolToIsin[symbol])
      .filter((isin): isin is string => Boolean(isin));
    return Array.from(new Set(isins));
  }, [investedWeightMap, scenarioWeightMap, symbolToIsin]);

  const {
    data: portfolioHistory,
    isLoading: isSeriesLoading,
    isError: isSeriesError,
    error: portfolioHistoryError,
  } = usePortfolioHistory(
    isinsForSeries,
    horizon,
    ENABLE_PORTFOLIO_HISTORY && isinsForSeries.length > 0
  );

  const seriesBySymbol = useMemo<SeriesBySymbol>(() => {
    if (!portfolioHistory?.series) return {};

    return portfolioHistory.series.reduce<SeriesBySymbol>((acc, item: PortfolioSymbolHistoryDTO) => {
      const mappedSymbol = isinToSymbol[item.symbol];
      if (!mappedSymbol) return acc;
      acc[mappedSymbol] = item.points;
      return acc;
    }, {});
  }, [portfolioHistory, isinToSymbol]);

  const seriesError = isSeriesError
    ? portfolioHistoryError instanceof Error
      ? portfolioHistoryError.message
      : 'Impossibile caricare le serie storiche.'
    : null;

  useEffect(() => {
    if (justEtfDebugCallDoneRef.current) return;
    justEtfDebugCallDoneRef.current = true;

    portfolioApi
      .getJustEtfDebugRaw()
      .then((response) => {
        const usedIsin = response.isin;
        const payload = response.payload;
        console.groupCollapsed('[Portfolio][justETF debug]');
        console.log('ISIN', usedIsin);
        console.log('raw payload', payload);
        console.log('series length', Array.isArray(payload.series) ? payload.series.length : 0);
        console.log('first 5 series rows', Array.isArray(payload.series) ? payload.series.slice(0, 5) : []);
        console.groupEnd();
      })
      .catch((error: unknown) => {
        console.error('[Portfolio][justETF debug] call failed', error);
      });
  }, []);

  useEffect(() => {
    if (!isAddInstrumentModalOpen) return;
    if (availableInsertInstruments.length === 0) {
      setInsertSymbol('');
      return;
    }

    if (!availableInsertInstruments.some((instrument) => instrument.symbol === insertSymbol)) {
      setInsertSymbol(availableInsertInstruments[0].symbol);
    }
  }, [isAddInstrumentModalOpen, availableInsertInstruments, insertSymbol]);

  const currentPortfolioSeries = useMemo(
    () => computePortfolioSeries(seriesBySymbol, investedWeightMap),
    [seriesBySymbol, investedWeightMap]
  );

  const simulatedPortfolioSeries = useMemo(
    () => computePortfolioSeries(seriesBySymbol, scenarioWeightMap),
    [seriesBySymbol, scenarioWeightMap]
  );
  const hasCurrentSeries = currentPortfolioSeries.length >= 2;
  const hasSimulatedSeries = simulatedPortfolioSeries.length >= 2;

  const chartData = useMemo(() => {
    const currentLength = currentPortfolioSeries.length;
    const simulatedLength = simulatedPortfolioSeries.length;
    if (currentLength < 2 && simulatedLength < 2) return [];

    if (currentLength >= 2 && simulatedLength >= 2) {
      const points = Math.min(currentLength, simulatedLength);
      const output: Array<{ dateLabel: string; current?: number; simulated?: number }> = [];
      for (let i = 0; i < points; i += 1) {
        output.push({
          dateLabel: formatMonthLabel(simulatedPortfolioSeries[i].date),
          current: currentPortfolioSeries[i].value,
          simulated: simulatedPortfolioSeries[i].value,
        });
      }
      return output;
    }

    if (simulatedLength >= 2) {
      return simulatedPortfolioSeries.map((point) => ({
        dateLabel: formatMonthLabel(point.date),
        simulated: point.value,
      }));
    }

    return currentPortfolioSeries.map((point) => ({
      dateLabel: formatMonthLabel(point.date),
      current: point.value,
    }));
  }, [currentPortfolioSeries, simulatedPortfolioSeries]);

  const currentMetrics = useMemo(
    () => computePerformanceMetrics(currentPortfolioSeries),
    [currentPortfolioSeries]
  );
  const simulatedMetrics = useMemo(
    () => computePerformanceMetrics(simulatedPortfolioSeries),
    [simulatedPortfolioSeries]
  );

  const investedAssetMix = useMemo(() => {
    const equity = investedPositions.reduce((sum, position) => {
      const instrument = getInstrument(position.symbol);
      if (!instrument || instrument.assetClass !== 'AZIONARIO') return sum;
      return sum + Math.max(0, position.amount);
    }, 0);
    const bond = investedPositions.reduce((sum, position) => {
      const instrument = getInstrument(position.symbol);
      if (!instrument || instrument.assetClass !== 'OBBLIGAZIONARIO') return sum;
      return sum + Math.max(0, position.amount);
    }, 0);
    return { equity, bond };
  }, [investedPositions]);

  const openAddInstrumentModal = () => {
    setInsertError(null);
    setInsertAmount('');

    if (availableInstruments.length === 0) {
      setInsertType('ETF');
      setInsertSymbol('');
      setIsAddInstrumentModalOpen(true);
      return;
    }

    const hasEtf = availableInstruments.some((instrument) => instrument.assetClass === 'AZIONARIO');
    const nextType: InstrumentInsertType = hasEtf ? 'ETF' : 'OBBLIGAZIONE';
    setInsertType(nextType);
    const firstForType = availableInstruments.find(
      (instrument) => instrument.assetClass === mapInsertTypeToAssetClass(nextType)
    );
    setInsertSymbol(firstForType?.symbol ?? '');
    setIsAddInstrumentModalOpen(true);
  };

  const closeAddInstrumentModal = () => {
    setIsAddInstrumentModalOpen(false);
    setInsertError(null);
  };

  const removeInvestedPosition = (symbol: string) => {
    setInvestedPositions((prev) => prev.filter((position) => position.symbol !== symbol));
  };

  const updateInvestedAmount = (symbol: string, nextValue: string) => {
    const parsed = Number(nextValue);
    const amount = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setInvestedPositions((prev) =>
      prev.map((position) => (position.symbol === symbol ? { ...position, amount } : position))
    );
  };

  const addInvestedInstrument = () => {
    if (!insertSymbol) {
      setInsertError('Seleziona uno strumento da aggiungere.');
      return;
    }

    if (investedSymbols.has(insertSymbol)) {
      setInsertError('Questo strumento e gia presente in portafoglio.');
      return;
    }

    const parsed = Number(insertAmount.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setInsertError('Inserisci un importo valido maggiore di zero.');
      return;
    }

    setInvestedPositions((prev) => [...prev, { symbol: insertSymbol, amount: Math.round(parsed * 100) / 100 }]);
    setInsertAmount('');
    setInsertError(null);
    setIsAddInstrumentModalOpen(false);
  };

  const toggleScenarioInstrument = (symbol: string) => {
    setStudyConfig((prev) =>
      prev.map((item) =>
        item.symbol === symbol
          ? { ...item, enabled: !item.enabled, weight: item.enabled ? item.weight : Math.max(item.weight, 5) }
          : item
      )
    );
  };

  const updateScenarioWeight = (symbol: string, nextValue: string) => {
    const parsed = Number(nextValue);
    const weight = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
    setStudyConfig((prev) =>
      prev.map((item) => (item.symbol === symbol ? { ...item, weight } : item))
    );
  };

  const resetScenarioToInvested = () => {
    setStudyConfig(buildInitialStudyConfig(investedPositions));
  };

  const activeScenarioCount = Object.keys(scenarioWeightMap).length;
  const selectedInsertInstrument = useMemo(
    () => availableInsertInstruments.find((instrument) => instrument.symbol === insertSymbol) ?? null,
    [availableInsertInstruments, insertSymbol]
  );

  return (
    <div className="sm:ml-60 space-y-4">
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Portafoglio</h2>
          <p className="text-sm text-slate-500 mt-1">
            Studio portafoglio azionario/obbligazionario con confronto tra allocazione attuale e
            simulata.
          </p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Serie storiche mensili via justETF (provider backend su ISIN, cache attiva).
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <section className="card xl:col-span-2 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Portafoglio Investito</h3>
              <p className="text-sm text-slate-500 mt-1">
                Inserisci i capitali gia investiti per costruire il benchmark attuale.
              </p>
            </div>
            <button type="button" className="btn btn-secondary text-sm" onClick={openAddInstrumentModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              Aggiungi strumento
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Totale investito</p>
              <p className="text-base font-semibold text-slate-900 mt-1">{formatCurrency(investedTotal)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Azionario</p>
              <p className="text-base font-semibold text-slate-900 mt-1">
                {investedTotal > 0 ? `${((investedAssetMix.equity / investedTotal) * 100).toFixed(1)}%` : '0.0%'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Obbligazionario</p>
              <p className="text-base font-semibold text-slate-900 mt-1">
                {investedTotal > 0 ? `${((investedAssetMix.bond / investedTotal) * 100).toFixed(1)}%` : '0.0%'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {investedPositions.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 text-center">
                Nessuno strumento presente. Usa "Aggiungi strumento" per registrare ETF o obbligazioni.
              </div>
            )}
            {investedPositions.map((position) => {
              const instrument = getInstrument(position.symbol);
              if (!instrument) return null;

              const effectiveWeight = (investedWeightMap[position.symbol] ?? 0) * 100;

              return (
                <div
                  key={position.symbol}
                  className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{instrument.symbol}</p>
                      <p className="text-xs text-slate-500 truncate">{instrument.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                          instrument.assetClass === 'AZIONARIO'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        {instrument.assetClass}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeInvestedPosition(position.symbol)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Rimuovi strumento"
                        aria-label={`Rimuovi ${instrument.symbol}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-[1fr,96px] gap-2 items-center">
                    <label className="text-xs text-slate-500">Capitale investito</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-right tabular-nums"
                      value={Number.isFinite(position.amount) ? position.amount : 0}
                      onChange={(event) => updateInvestedAmount(position.symbol, event.target.value)}
                    />
                  </div>

                  <p className="text-xs text-slate-500">
                    Peso corrente: <span className="font-semibold text-slate-700">{effectiveWeight.toFixed(2)}%</span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card xl:col-span-3 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Laboratorio Portafoglio</h3>
              <p className="text-sm text-slate-500 mt-1">
                Attiva strumenti, imposta pesi e confronta scenario simulato vs portafoglio attuale.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={horizon}
                onChange={(event) => setHorizon(event.target.value as Horizon)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="1Y">Orizzonte 1 anno</option>
                <option value="3Y">Orizzonte 3 anni</option>
                <option value="5Y">Orizzonte 5 anni</option>
              </select>
              <button type="button" className="btn btn-secondary text-sm" onClick={resetScenarioToInvested}>
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Reset scenario
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2 max-h-[480px] overflow-auto">
              {studyConfig.map((item) => {
                const instrument = getInstrument(item.symbol);
                if (!instrument) return null;
                const normalizedWeight = (scenarioWeightMap[item.symbol] ?? 0) * 100;

                return (
                  <div key={item.symbol} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{instrument.symbol}</p>
                        <p className="text-xs text-slate-500 truncate">{instrument.name}</p>
                      </div>
                      <button
                        type="button"
                        aria-pressed={item.enabled}
                        onClick={() => toggleScenarioInstrument(item.symbol)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          item.enabled ? 'bg-slate-900' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            item.enabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-[1fr,68px] items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        disabled={!item.enabled}
                        value={item.weight}
                        onChange={(event) => updateScenarioWeight(item.symbol, event.target.value)}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        disabled={!item.enabled}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right tabular-nums"
                        value={item.weight}
                        onChange={(event) => updateScenarioWeight(item.symbol, event.target.value)}
                      />
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Peso effettivo: <span className="font-semibold text-slate-700">{normalizedWeight.toFixed(2)}%</span>
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Strumenti attivi</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">{activeScenarioCount}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Rend. annuo</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">
                    {simulatedMetrics ? formatPercent(simulatedMetrics.annualizedReturn) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Volatilita annua</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">
                    {simulatedMetrics ? formatPercent(simulatedMetrics.annualizedVolatility) : 'N/A'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Max drawdown</p>
                  <p className="text-base font-semibold text-red-600 mt-1">
                    {simulatedMetrics ? formatPercent(simulatedMetrics.maxDrawdown) : 'N/A'}
                  </p>
                </div>
              </div>

              {isSeriesLoading ? (
                <div className="h-72 flex items-center justify-center text-slate-500">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Caricamento serie storiche...
                </div>
              ) : seriesError ? (
                <div className="h-72 flex items-center justify-center text-red-600 text-sm">
                  {seriesError}
                </div>
              ) : chartData.length < 2 ? (
                <div className="h-72 flex items-center justify-center text-slate-500 text-sm">
                  Inserisci almeno 2 punti validi (portafoglio attuale o simulato) per visualizzare il grafico.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 6 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={20}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(value: number) => value.toFixed(0)}
                        width={44}
                      />
                      <Tooltip
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const current = payload.find((entry) => entry.dataKey === 'current');
                          const simulated = payload.find((entry) => entry.dataKey === 'simulated');

                          return (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
                              <p className="text-xs text-slate-500">{label}</p>
                              {hasCurrentSeries && (
                                <p className="text-sm font-semibold text-slate-700">
                                  Attuale: {Number(current?.value ?? 0).toFixed(2)}
                                </p>
                              )}
                              {hasSimulatedSeries && (
                                <p className="text-sm font-semibold text-sky-600">
                                  Simulato: {Number(simulated?.value ?? 0).toFixed(2)}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      />
                      {hasCurrentSeries && (
                        <Line
                          type="monotone"
                          dataKey="current"
                          stroke="#64748b"
                          strokeWidth={1.8}
                          dot={false}
                          name="Attuale"
                        />
                      )}
                      {hasSimulatedSeries && (
                        <Line
                          type="monotone"
                          dataKey="simulated"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                          name="Simulato"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Confronto scenario: cumulato{' '}
                <span className="font-semibold text-slate-800">
                  {simulatedMetrics ? formatPercent(simulatedMetrics.cumulativeReturn) : 'N/A'}
                </span>{' '}
                vs attuale{' '}
                <span className="font-semibold text-slate-800">
                  {currentMetrics ? formatPercent(currentMetrics.cumulativeReturn) : 'N/A'}
                </span>
                .
              </div>
            </div>
          </div>
        </section>
      </div>

      {isAddInstrumentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeAddInstrumentModal} />

          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Nuovo strumento in portafoglio</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registra ETF o obbligazioni e imposta il capitale investito.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddInstrumentModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Chiudi modale aggiungi strumento"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Tipo strumento</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['ETF', 'OBBLIGAZIONE'] as InstrumentInsertType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setInsertType(type);
                        setInsertError(null);
                      }}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        insertType === type
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {availableInsertInstruments.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Nessun {insertType.toLowerCase()} disponibile da aggiungere.
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Strumento</label>
                    <select
                      value={insertSymbol}
                      onChange={(event) => {
                        setInsertSymbol(event.target.value);
                        setInsertError(null);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {availableInsertInstruments.map((instrument) => (
                        <option key={instrument.symbol} value={instrument.symbol}>
                          {instrument.symbol} - {instrument.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Capitale investito</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={insertAmount}
                      onChange={(event) => {
                        setInsertAmount(event.target.value);
                        setInsertError(null);
                      }}
                      placeholder="Es. 5000"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums"
                    />
                  </div>

                  {selectedInsertInstrument && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{selectedInsertInstrument.symbol}</p>
                      <p className="text-xs text-slate-500">{selectedInsertInstrument.name}</p>
                    </div>
                  )}
                </>
              )}

              {insertError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {insertError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button type="button" className="btn btn-secondary text-sm" onClick={closeAddInstrumentModal}>
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm"
                onClick={addInvestedInstrument}
                disabled={availableInsertInstruments.length === 0}
              >
                Conferma strumento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
