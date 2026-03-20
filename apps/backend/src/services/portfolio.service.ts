import type {
  CreatePortfolioAssetClassDTO,
  CreatePortfolioInstrumentDTO,
  PortfolioCompareRequestDTO,
  PortfolioCompareResponseDTO,
  PortfolioComparisonResultDTO,
  PortfolioAssetClassDTO,
  PortfolioGeographicExposureRequestDTO,
  PortfolioGeographicExposureResponseDTO,
  PortfolioSectorExposureRequestDTO,
  PortfolioSectorExposureResponseDTO,
  PortfolioHistoryHorizonDTO,
  PortfolioHistoryPointDTO,
  PortfolioHistoryResponseDTO,
  PortfolioInstrumentDTO,
  PortfolioInvestedPositionDTO,
  PortfolioInvestedStateDTO,
  PortfolioInputValueModeDTO,
  PortfolioStaticPerformanceMetricDTO,
  PortfolioStaticPerformanceRequestDTO,
  PortfolioStaticPerformanceResponseDTO,
  PortfolioSymbolHistoryDTO,
  UpdatePortfolioAssetClassDTO,
  UpdatePortfolioInstrumentDTO,
  UpdatePortfolioInvestedStateDTO,
  PortfolioUniverseItemDTO,
} from '@budget/shared';
import { AppError } from '../lib/error-handler.js';
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

type CacheEntry = {
  expiresAt: number;
  points: PortfolioHistoryPointDTO[];
};

type JustEtfDataPoint = {
  date?: string;
  value?: { raw?: number } | number;
};

type JustEtfChartPayload = {
  series?: JustEtfDataPoint[];
  features?: {
    DIVIDENDS?: JustEtfDataPoint[];
  };
};

type JustEtfOverviewItem = {
  isin?: string;
  name?: string;
  ticker?: string;
  currency?: string;
  strategy?: string;
};

type JustEtfOverviewPayload = {
  data?: JustEtfOverviewItem[];
};

type JustEtfCountryAllocation = {
  country: string;
  percentage: number;
};

type JustEtfSectorAllocation = {
  sector: string;
  percentage: number;
};

type GeographicExposureCacheEntry = {
  expiresAt: number;
  countries: JustEtfCountryAllocation[];
};

type SectorExposureCacheEntry = {
  expiresAt: number;
  sectors: JustEtfSectorAllocation[];
};

type GeographicInstrumentMetadata = {
  symbol: string;
  assetClass: string;
};

type InvestedPositionJson = {
  symbol?: unknown;
  amount?: unknown;
};

type DefaultInstrumentSeed = {
  symbol: string;
  name: string;
  isin: string;
  assetClassName: string;
};

const JUSTETF_CHART_BASE_URL = 'https://www.justetf.com/api/etfs';
const JUSTETF_OVERVIEW_URL = 'https://www.justetf.com/en/search-api/etfs';
const JUSTETF_PROFILE_URL = 'https://www.justetf.com/en/etf-profile.html';
const JUSTETF_COUNTRIES_LOAD_MORE_PATH = '0-1.0-holdingsSection-countries-loadMoreCountries';
const JUSTETF_SECTORS_LOAD_MORE_PATH = '0-1.0-holdingsSection-sectors-loadMoreSectors';
const JUSTETF_OVERVIEW_STRATEGIES = ['epg-longOnly', 'epg-activeEtfs', 'epg-shortAndLeveraged'] as const;
const JUSTETF_CHART_DEFAULT_PARAMS = {
  locale: 'en',
  valuesType: 'MARKET_VALUE',
  reduceData: 'false',
  includeDividends: 'false',
  features: 'DIVIDENDS',
};
const JUSTETF_OVERVIEW_BASE_PARAMS = {
  page: 1,
  pageSize: 10,
  sortField: 'name',
  sortOrder: 'asc',
  tab: 'overview',
  search: 'ETF',
  quoteCurrency: 'EUR',
  cmp: 'etf-comparison',
  distributionPolicy: 'distributionPolicy-unknown',
  dataInterval: 'dataInterval-unknown',
  stockExchange: '',
  sector: '',
  assetClass: '',
  region: '',
  country: '',
  index: '',
};

const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const MONTHS_IN_YEAR = 12;

const HORIZON_OUTPUT_SIZE: Record<PortfolioHistoryHorizonDTO, number> = {
  '1Y': 13,
  '3Y': 37,
  '5Y': 61,
};

const DEFAULT_ASSET_CLASS_NAMES = ['AZIONARIO', 'OBBLIGAZIONARIO', 'COMMODITIES', 'MONETARIO'] as const;

const DEFAULT_INSTRUMENT_SEEDS: DefaultInstrumentSeed[] = [
  { symbol: 'XEON', isin: 'LU0290358497', name: 'Xtrackers EUR Overnight', assetClassName: 'MONETARIO' },
  { symbol: 'GOLD', isin: 'IE00B579F325', name: 'WisdomTree Physical Gold', assetClassName: 'COMMODITIES' },
  { symbol: 'AMUNDI_EMERGING', isin: 'LU1681045370', name: 'Amundi Emerging', assetClassName: 'AZIONARIO' },
  { symbol: 'PACIFIC_EXJP', isin: 'IE00B52MJY50', name: 'iShares Pacific ex Japan', assetClassName: 'AZIONARIO' },
  { symbol: 'WORLD', isin: 'IE00B4L5Y983', name: 'iShares MSCI World', assetClassName: 'AZIONARIO' },
  { symbol: 'JP_SMALLCAP', isin: 'IE00B2QWDY88', name: 'Japan Small Cap', assetClassName: 'AZIONARIO' },
  { symbol: 'LG_CLEAN_ENERGY', isin: 'IE00BK5BCH80', name: 'L&G Clean Energy', assetClassName: 'AZIONARIO' },
  { symbol: 'WORLD_SMALL_CAP', isin: 'IE00BCBJG560', name: 'World Small Cap', assetClassName: 'AZIONARIO' },
  { symbol: 'WISDOM_AI', isin: 'IE00BDVPNG13', name: 'Wisdom AI', assetClassName: 'AZIONARIO' },
  { symbol: 'EMERGING', isin: 'IE00BKM4GZ66', name: 'MSCI Emerging IMI', assetClassName: 'AZIONARIO' },
  { symbol: 'US_SMALLCAP', isin: 'IE00BJ38QD84', name: 'US Small Cap', assetClassName: 'AZIONARIO' },
  { symbol: 'WORLD_EX_USA', isin: 'IE000R4ZNTN3', name: 'World ex USA', assetClassName: 'AZIONARIO' },
  { symbol: 'UTILITIES', isin: 'IE00B4KBBD01', name: 'S&P500 Utilities', assetClassName: 'AZIONARIO' },
  { symbol: 'EM_EX_CHINA', isin: 'IE00BMG6Z448', name: 'EM ex China', assetClassName: 'AZIONARIO' },
  { symbol: 'SWITZERLAND', isin: 'LU0977261329', name: 'MSCI Switzerland', assetClassName: 'AZIONARIO' },
  { symbol: 'UK', isin: 'LU0950670850', name: 'MSCI UK', assetClassName: 'AZIONARIO' },
  { symbol: 'AI_BIGDATA', isin: 'IE00BGV5VN51', name: 'AI Big Data', assetClassName: 'AZIONARIO' },
  { symbol: 'JAPAN', isin: 'LU1781541252', name: 'MSCI Japan', assetClassName: 'AZIONARIO' },
  { symbol: 'EUROPE', isin: 'LU0908500753', name: 'MSCI Europe', assetClassName: 'AZIONARIO' },
  { symbol: 'CHINA-A', isin: 'IE00BQT3WG13', name: 'China A', assetClassName: 'AZIONARIO' },
  { symbol: 'BRAZIL', isin: 'LU1900066207', name: 'Brazil', assetClassName: 'AZIONARIO' },
  { symbol: 'SUSW', isin: 'IE00BYX2JD69', name: 'MSCI World SRI', assetClassName: 'AZIONARIO' },
  { symbol: 'S&P500', isin: 'IE00B5BMR087', name: 'S&P500', assetClassName: 'AZIONARIO' },
  { symbol: 'XTR_GOLD', isin: 'DE000A2T0VU5', name: 'Xtrackers Gold', assetClassName: 'COMMODITIES' },
  { symbol: 'MSCI_EUROPE_ENERGY', isin: 'IE00BKWQ0F09', name: 'Europe Energy', assetClassName: 'AZIONARIO' },
  { symbol: 'AMUNDI_SMART_OVERNOGHT', isin: 'LU1190417599', name: 'Amundi Smart Overnight', assetClassName: 'MONETARIO' },
  { symbol: 'USB_FOREIN_DIST', isin: 'LU0879397742', name: 'UBS US Bond Dist', assetClassName: 'OBBLIGAZIONARIO' },
  { symbol: 'AMUNDI_BLOOMERG_EX_AGRIC', isin: 'LU1829218749', name: 'Amundi Bloomberg Ex Agric', assetClassName: 'COMMODITIES' },
  { symbol: 'ISHARE_CINA_A', isin: 'IE00BJ5JPG56', name: 'iShares China A', assetClassName: 'AZIONARIO' },
  { symbol: 'MSCI_EMU', isin: 'IE00B53QG562', name: 'MSCI EMU', assetClassName: 'AZIONARIO' },
  { symbol: 'MSCI_SMALLCAP', isin: 'IE00BF4RFH31', name: 'MSCI Small Cap', assetClassName: 'AZIONARIO' },
];

export class PortfolioService {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<PortfolioHistoryPointDTO[]>>();
  private fullHistoryCache = new Map<string, CacheEntry>();
  private fullHistoryInFlight = new Map<string, Promise<PortfolioHistoryPointDTO[]>>();
  private geographicExposureCache = new Map<string, GeographicExposureCacheEntry>();
  private geographicExposureCacheVersion = 'v2';
  private sectorExposureCache = new Map<string, SectorExposureCacheEntry>();
  private sectorExposureCacheVersion = 'v1';

  async getHistory(
    symbols: string[],
    horizon: PortfolioHistoryHorizonDTO
  ): Promise<PortfolioHistoryResponseDTO> {
    const normalizedSymbols = Array.from(
      new Set(
        symbols
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean)
      )
    );

    if (normalizedSymbols.length === 0) {
      throw new AppError('At least one symbol is required', 400, 'VALIDATION_ERROR');
    }

    const series: PortfolioSymbolHistoryDTO[] = [];
    for (const symbol of normalizedSymbols) {
      const points = await this.getSymbolHistory(symbol, horizon, this.defaultInputValueMode);
      series.push({ symbol, points });
    }

    return {
      horizon,
      generatedAt: new Date().toISOString(),
      series,
    };
  }

  async comparePortfolios(input: PortfolioCompareRequestDTO): Promise<PortfolioCompareResponseDTO> {
    const universeByLabel = this.normalizeUniverse(input.universeByLabel);
    const usedLabels = this.getUsedLabels(input.portfolios);

    if (usedLabels.length === 0) {
      throw new AppError('At least one instrument weight must be provided', 400, 'VALIDATION_ERROR');
    }

    usedLabels.forEach((label) => {
      if (!universeByLabel[label]) {
        throw new AppError(`Instrument label '${label}' is missing in universe`, 400, 'VALIDATION_ERROR');
      }
    });

    const uniqueUsedIsins = Array.from(new Set(usedLabels.map((label) => universeByLabel[label])));
    const seriesByIsin = new Map<string, PortfolioHistoryPointDTO[]>();
    for (const isin of uniqueUsedIsins) {
      const points = await this.getSymbolHistory(isin, input.horizon, input.inputValue);
      seriesByIsin.set(isin, points);
    }

    const returnsByLabel = new Map<string, Map<string, number>>();
    const allReturnDates = new Set<string>();
    usedLabels.forEach((label) => {
      const isin = universeByLabel[label];
      const points = seriesByIsin.get(isin) ?? [];
      const returns = this.buildMonthlyReturns(points);
      returnsByLabel.set(label, returns);
      returns.forEach((_value, date) => allReturnDates.add(date));
    });
    const sortedReturnDates = Array.from(allReturnDates).sort((a, b) => a.localeCompare(b));

    const results: PortfolioComparisonResultDTO[] = input.portfolios.map((portfolio) => {
      const normalizedWeights = this.normalizeWeights(portfolio.weights, usedLabels);
      const selectedLabels = Object.keys(normalizedWeights);
      if (selectedLabels.length === 0) {
        throw new AppError(`Portfolio '${portfolio.name}' has no valid instrument weights`, 400, 'VALIDATION_ERROR');
      }

      const series = this.buildPortfolioReturnSeries(selectedLabels, normalizedWeights, returnsByLabel, sortedReturnDates);
      if (series.length < 2) {
        throw new AppError(
          `Portfolio '${portfolio.name}' has insufficient overlapping monthly data`,
          422,
          'INSUFFICIENT_HISTORY'
        );
      }

      const monthlyReturns = series.map((point) => point.value);
      const annualizedReturn = this.annualizedReturn(monthlyReturns);
      const annualizedVolatility = this.annualizedVolatility(monthlyReturns);
      const sharpe =
        annualizedVolatility > 0
          ? (annualizedReturn - input.riskFreeAnnual) / annualizedVolatility
          : null;
      const divers = this.effectiveNumberOfBets(normalizedWeights);
      const avgCorr = this.avgPairwiseCorrelation(selectedLabels, returnsByLabel, sortedReturnDates);
      const score = this.computeScore(annualizedReturn, annualizedVolatility, divers, avgCorr);

      return {
        name: portfolio.name,
        weights: normalizedWeights,
        metrics: {
          annualizedReturn: this.round6(annualizedReturn),
          annualizedVolatility: this.round6(annualizedVolatility),
          sharpe: sharpe === null ? null : this.round6(sharpe),
          nMonths: series.length,
          divers: this.round6(divers),
          avgCorr: avgCorr === null ? null : this.round6(avgCorr),
          score: score === null ? null : this.round6(score),
        },
        series: series.map((point) => ({
          date: point.date,
          value: this.round6(point.value),
        })),
      };
    });

    const ranking = [...results]
      .sort((a, b) => this.compareNullableNumbersDesc(a.metrics.score, b.metrics.score))
      .map((item) => item.name);

    const correlationBetweenPortfolios = this.computePortfolioCorrelationMatrix(results);
    const scatter = results.map((item) => ({
      name: item.name,
      annualizedReturn: item.metrics.annualizedReturn,
      annualizedVolatility: item.metrics.annualizedVolatility,
      divers: item.metrics.divers,
      avgCorr: item.metrics.avgCorr,
      score: item.metrics.score,
    }));

    const universe = await this.resolveUniverseFromOverview(universeByLabel);

    return {
      generatedAt: new Date().toISOString(),
      horizon: input.horizon,
      inputValue: input.inputValue,
      riskFreeAnnual: input.riskFreeAnnual,
      universe,
      portfolios: results,
      ranking,
      correlationBetweenPortfolios,
      scatter,
    };
  }

  async getGeographicExposure(
    userId: string,
    input: PortfolioGeographicExposureRequestDTO
  ): Promise<PortfolioGeographicExposureResponseDTO> {
    const positionsByIsin = new Map<string, number>();
    input.positions.forEach((position) => {
      const isin = position.isin.trim().toUpperCase();
      const amount = Number(position.amount);
      if (!ISIN_REGEX.test(isin) || !Number.isFinite(amount) || amount <= 0) return;
      positionsByIsin.set(isin, (positionsByIsin.get(isin) ?? 0) + amount);
    });

    if (positionsByIsin.size === 0) {
      throw new AppError('At least one valid ETF position is required', 400, 'VALIDATION_ERROR');
    }

    const totalAmount = Array.from(positionsByIsin.values()).reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new AppError('Invalid total amount for geographic exposure', 400, 'VALIDATION_ERROR');
    }

    type CountryAggregation = {
      ratio: number;
      assetClassRatioByName: Map<string, number>;
      etfs: Set<string>;
    };

    const countryAggregationByName = new Map<string, CountryAggregation>();
    const metadataByIsin = await this.resolveGeographicInstrumentMetadata(
      userId,
      Array.from(positionsByIsin.keys()),
    );

    const appendCountryContribution = (countryName: string, ratioContribution: number, metadata: GeographicInstrumentMetadata) => {
      const safeRatioContribution = Math.max(0, ratioContribution);
      if (safeRatioContribution <= 0) return;
      const normalizedCountryName = this.normalizeCountryName(countryName);
      if (!normalizedCountryName) return;

      const current = countryAggregationByName.get(normalizedCountryName) ?? {
        ratio: 0,
        assetClassRatioByName: new Map<string, number>(),
        etfs: new Set<string>(),
      };

      current.ratio += safeRatioContribution;
      current.assetClassRatioByName.set(
        metadata.assetClass,
        (current.assetClassRatioByName.get(metadata.assetClass) ?? 0) + safeRatioContribution,
      );
      if (metadata.symbol) current.etfs.add(metadata.symbol);
      countryAggregationByName.set(normalizedCountryName, current);
    };

    for (const [isin, amount] of positionsByIsin.entries()) {
      const metadata = metadataByIsin.get(isin) ?? {
        symbol: isin,
        assetClass: 'ALTRO',
      };
      const countries = await this.fetchCountryAllocationsByIsin(isin);
      const etfPortfolioWeight = amount / totalAmount;
      let coveredRatio = 0;

      countries.forEach((country) => {
        const ratio = this.normalizeCountryRatio(country.percentage);
        if (ratio <= 0) return;
        coveredRatio += ratio;
        appendCountryContribution(country.country, ratio * etfPortfolioWeight, metadata);
      });

      if (coveredRatio < 1) {
        appendCountryContribution('Altro', (1 - coveredRatio) * etfPortfolioWeight, metadata);
      }
    }

    if (countryAggregationByName.size === 0) {
      throw new AppError('Unable to resolve country allocations from justETF', 422, 'INSUFFICIENT_HISTORY');
    }

    const ratioTotal = Array.from(countryAggregationByName.values()).reduce((sum, value) => sum + value.ratio, 0);
    if (ratioTotal < 1 && ratioTotal > 0.99) {
      appendCountryContribution('Altro', 1 - ratioTotal, { symbol: '', assetClass: 'ALTRO' });
    }

    const countries = Array.from(countryAggregationByName.entries())
      .map(([country, aggregation]) => {
        const safeRatio = Math.max(0, aggregation.ratio);
        const assetClassBreakdown = Array.from(aggregation.assetClassRatioByName.entries())
          .map(([assetClass, assetClassRatio]) => {
            const safeAssetClassRatio = Math.max(0, assetClassRatio);
            return {
              assetClass,
              percentage: this.round6(safeAssetClassRatio),
              amount: this.roundToCents(safeAssetClassRatio * totalAmount),
            };
          })
          .filter((row) => row.percentage > 0)
          .sort((a, b) => b.amount - a.amount);

        return {
          country,
          percentage: this.round6(safeRatio),
          amount: this.roundToCents(safeRatio * totalAmount),
          assetClassBreakdown,
          etfs: Array.from(aggregation.etfs).sort((left, right) => left.localeCompare(right)),
        };
      })
      .filter((row) => row.percentage > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      generatedAt: new Date().toISOString(),
      totalAmount: this.roundToCents(totalAmount),
      countries,
    };
  }

  async getSectorExposure(
    input: PortfolioSectorExposureRequestDTO
  ): Promise<PortfolioSectorExposureResponseDTO> {
    const positionsByIsin = new Map<string, number>();
    input.positions.forEach((position) => {
      const isin = position.isin.trim().toUpperCase();
      const amount = Number(position.amount);
      if (!ISIN_REGEX.test(isin) || !Number.isFinite(amount) || amount <= 0) return;
      positionsByIsin.set(isin, (positionsByIsin.get(isin) ?? 0) + amount);
    });

    if (positionsByIsin.size === 0) {
      throw new AppError('At least one valid ETF position is required', 400, 'VALIDATION_ERROR');
    }

    const totalAmount = Array.from(positionsByIsin.values()).reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new AppError('Invalid total amount for sector exposure', 400, 'VALIDATION_ERROR');
    }

    const sectorRatioByName = new Map<string, number>();

    for (const [isin, amount] of positionsByIsin.entries()) {
      const sectors = await this.fetchSectorAllocationsByIsin(isin);
      if (sectors.length === 0) continue;

      const etfPortfolioWeight = amount / totalAmount;
      let coveredRatio = 0;

      sectors.forEach((sector) => {
        const ratio = this.normalizeAllocationRatio(sector.percentage);
        if (ratio <= 0) return;
        const sectorName = this.normalizeSectorName(sector.sector);
        if (!sectorName) return;
        coveredRatio += ratio;
        sectorRatioByName.set(sectorName, (sectorRatioByName.get(sectorName) ?? 0) + ratio * etfPortfolioWeight);
      });

      if (coveredRatio < 1) {
        sectorRatioByName.set('Altro', (sectorRatioByName.get('Altro') ?? 0) + (1 - coveredRatio) * etfPortfolioWeight);
      }
    }

    if (sectorRatioByName.size === 0) {
      throw new AppError('Unable to resolve sector allocations from justETF', 422, 'INSUFFICIENT_HISTORY');
    }

    const ratioTotal = Array.from(sectorRatioByName.values()).reduce((sum, value) => sum + value, 0);
    if (ratioTotal < 1) {
      sectorRatioByName.set('Altro', (sectorRatioByName.get('Altro') ?? 0) + (1 - ratioTotal));
    }

    const sectors = Array.from(sectorRatioByName.entries())
      .map(([sector, ratio]) => {
        const safeRatio = Math.max(0, ratio);
        return {
          sector,
          percentage: this.round6(safeRatio),
          amount: this.roundToCents(safeRatio * totalAmount),
        };
      })
      .filter((row) => row.percentage > 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      generatedAt: new Date().toISOString(),
      totalAmount: this.roundToCents(totalAmount),
      sectors,
    };
  }

  async getInvestedStaticPerformance(
    input: PortfolioStaticPerformanceRequestDTO
  ): Promise<PortfolioStaticPerformanceResponseDTO> {
    const positionsByIsin = new Map<string, number>();
    input.positions.forEach((position) => {
      const isin = position.isin.trim().toUpperCase();
      const amount = Number(position.amount);
      if (!ISIN_REGEX.test(isin) || !Number.isFinite(amount) || amount <= 0) return;
      positionsByIsin.set(isin, (positionsByIsin.get(isin) ?? 0) + amount);
    });

    if (positionsByIsin.size === 0) {
      throw new AppError('At least one valid ETF position is required', 400, 'VALIDATION_ERROR');
    }

    const totalAmount = Array.from(positionsByIsin.values()).reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      throw new AppError('Total portfolio amount must be greater than zero', 400, 'VALIDATION_ERROR');
    }

    // Strategy choice: no silent fallback across metrics.
    // If requested metric cannot be computed consistently, we fail with a clear error
    // to avoid mixing heterogeneous return definitions in one portfolio curve.
    const metric = input.metric ?? 'relative';
    const valueMode = this.metricToInputValueMode(metric);

    type EtfSeries = {
      isin: string;
      amount: number;
      weight: number;
      startDate: string;
      endDate: string;
      valueByDate: Map<string, number>;
    };

    const rawSeriesByEtf: Array<Omit<EtfSeries, 'weight'>> = [];

    for (const [isin, amount] of positionsByIsin.entries()) {
      try {
        const monthlySeries = await this.getSymbolFullHistory(isin, valueMode);
        if (monthlySeries.length < 2) {
          throw new AppError(`Insufficient history for ISIN ${isin}`, 422, 'INSUFFICIENT_HISTORY');
        }

        const base = monthlySeries[0].close;
        if (!Number.isFinite(base) || base <= 0) {
          throw new AppError(`Invalid base value for ISIN ${isin}`, 422, 'INSUFFICIENT_HISTORY');
        }

        const valueByDate = new Map<string, number>();
        monthlySeries.forEach((point) => {
          if (!point.date || !Number.isFinite(point.close)) return;
          valueByDate.set(point.date, (point.close / base) - 1);
        });

        if (valueByDate.size < 2) {
          throw new AppError(`Insufficient valid points for ISIN ${isin}`, 422, 'INSUFFICIENT_HISTORY');
        }

        const orderedDates = Array.from(valueByDate.keys()).sort((a, b) => a.localeCompare(b));
        rawSeriesByEtf.push({
          isin,
          amount,
          startDate: orderedDates[0],
          endDate: orderedDates[orderedDates.length - 1],
          valueByDate,
        });
      } catch (error) {
        if (error instanceof AppError && error.code === 'PROVIDER_SYMBOL_ERROR') {
          // Ignore non-justETF instruments (e.g. bonds/BTP) for static ETF portfolio chart.
          continue;
        }
        throw error;
      }
    }

    if (rawSeriesByEtf.length === 0) {
      throw new AppError('No justETF-compatible ETF positions available for historical chart', 422, 'INSUFFICIENT_HISTORY');
    }

    const includedTotalAmount = rawSeriesByEtf.reduce((sum, item) => sum + item.amount, 0);
    if (!Number.isFinite(includedTotalAmount) || includedTotalAmount <= 0) {
      throw new AppError('Invalid total amount for supported ETF positions', 422, 'INSUFFICIENT_HISTORY');
    }

    const seriesByEtf: EtfSeries[] = rawSeriesByEtf.map((item) => ({
      ...item,
      weight: item.amount / includedTotalAmount,
    }));

    const commonStartDate = seriesByEtf
      .map((item) => item.startDate)
      .sort((a, b) => b.localeCompare(a))[0];
    const commonEndDate = seriesByEtf
      .map((item) => item.endDate)
      .sort((a, b) => a.localeCompare(b))[0];

    if (!commonStartDate || !commonEndDate || commonStartDate > commonEndDate) {
      throw new AppError('No overlapping time window found across ETF histories', 422, 'INSUFFICIENT_HISTORY');
    }

    let commonDates: string[] | null = null;
    seriesByEtf.forEach((item) => {
      const availableDates = Array.from(item.valueByDate.keys()).filter(
        (date) => date >= commonStartDate && date <= commonEndDate
      );
      const availableDateSet = new Set(availableDates);
      commonDates = commonDates
        ? commonDates.filter((date) => availableDateSet.has(date))
        : availableDates;
    });

    const sortedCommonDates: string[] = commonDates ? [...commonDates] : [];
    sortedCommonDates.sort((a, b) => a.localeCompare(b));
    if (sortedCommonDates.length === 0) {
      throw new AppError(
        'No common dates found across ETF histories after applying overlap window',
        422,
        'INSUFFICIENT_HISTORY'
      );
    }

    const rawPoints = sortedCommonDates.map((date) => {
      let aggregated = 0;
      seriesByEtf.forEach((item) => {
        const value = item.valueByDate.get(date);
        if (!Number.isFinite(value)) {
          throw new AppError(`Missing metric value for ISIN ${item.isin} on ${date}`, 422, 'INSUFFICIENT_HISTORY');
        }
        aggregated += item.weight * (value as number);
      });

      return {
        date,
        value: aggregated,
      };
    });

    const baseLevel = 1 + rawPoints[0].value;
    if (!Number.isFinite(baseLevel) || baseLevel <= 0) {
      throw new AppError('Invalid base level for rebasing static portfolio series', 422, 'INSUFFICIENT_HISTORY');
    }

    // Rebase portfolio curve to 0% on the first common date so the final return
    // directly represents the gain/loss over the displayed interval.
    const points = rawPoints.map((point) => ({
      date: point.date,
      value: this.round6((1 + point.value) / baseLevel - 1),
    }));

    const startDate = points[0].date;
    const endDate = points[points.length - 1].date;
    const finalReturn = points[points.length - 1].value;

    return {
      generatedAt: new Date().toISOString(),
      metric,
      etfCount: seriesByEtf.length,
      startDate,
      endDate,
      finalReturn: this.round6(finalReturn),
      points,
    };
  }

  async getJustEtfRawChart(isin: string): Promise<JustEtfChartPayload> {
    const normalizedIsin = isin.trim().toUpperCase();
    if (!ISIN_REGEX.test(normalizedIsin)) {
      throw new AppError(`Invalid ISIN '${isin}'.`, 422, 'PROVIDER_SYMBOL_ERROR');
    }

    return this.fetchJustEtfChartPayload(normalizedIsin);
  }

  async getAssetClasses(userId: string): Promise<PortfolioAssetClassDTO[]> {
    await this.ensureDefaultInstrumentCatalog(userId);

    const rows = await prisma.portfolioAssetClass.findMany({
      where: { userId },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => this.toAssetClassDTO(row));
  }

  async createAssetClass(userId: string, input: CreatePortfolioAssetClassDTO): Promise<PortfolioAssetClassDTO> {
    const name = input.name.trim();
    if (!name) {
      throw new AppError('Asset class name is required', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.portfolioAssetClass.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(`Asset class '${name}' already exists`, 409, 'CONFLICT');
    }

    const row = await prisma.portfolioAssetClass.create({
      data: { userId, name },
    });

    return this.toAssetClassDTO(row);
  }

  async updateAssetClass(
    userId: string,
    assetClassId: string,
    input: UpdatePortfolioAssetClassDTO,
  ): Promise<PortfolioAssetClassDTO> {
    const name = input.name.trim();
    if (!name) {
      throw new AppError('Asset class name is required', 400, 'VALIDATION_ERROR');
    }

    const existing = await prisma.portfolioAssetClass.findFirst({
      where: { id: assetClassId, userId },
    });
    if (!existing) {
      throw new AppError('Asset class not found', 404, 'NOT_FOUND');
    }

    const conflict = await prisma.portfolioAssetClass.findFirst({
      where: {
        userId,
        id: { not: assetClassId },
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new AppError(`Asset class '${name}' already exists`, 409, 'CONFLICT');
    }

    const row = await prisma.portfolioAssetClass.update({
      where: { id: assetClassId },
      data: { name },
    });

    return this.toAssetClassDTO(row);
  }

  async getInstruments(userId: string): Promise<PortfolioInstrumentDTO[]> {
    await this.ensureDefaultInstrumentCatalog(userId);

    const rows = await prisma.portfolioInstrument.findMany({
      where: { userId },
      include: {
        assetClass: true,
      },
      orderBy: [{ symbol: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => this.toInstrumentDTO(row));
  }

  async createInstrument(
    userId: string,
    input: CreatePortfolioInstrumentDTO,
  ): Promise<PortfolioInstrumentDTO> {
    const symbol = this.normalizeInstrumentSymbol(input.symbol);
    const name = input.name.trim();
    const isin = this.normalizeIsin(input.isin);

    if (!name) {
      throw new AppError('Instrument name is required', 400, 'VALIDATION_ERROR');
    }

    await this.assertAssetClassOwnership(userId, input.assetClassId);

    try {
      const row = await prisma.portfolioInstrument.create({
        data: {
          userId,
          symbol,
          name,
          isin,
          assetClassId: input.assetClassId,
        },
        include: {
          assetClass: true,
        },
      });
      return this.toInstrumentDTO(row);
    } catch (error) {
      this.handleInstrumentUniqueError(error, symbol, isin);
      throw error;
    }
  }

  async updateInstrument(
    userId: string,
    instrumentId: string,
    input: UpdatePortfolioInstrumentDTO,
  ): Promise<PortfolioInstrumentDTO> {
    const existing = await prisma.portfolioInstrument.findFirst({
      where: { id: instrumentId, userId },
    });
    if (!existing) {
      throw new AppError('Instrument not found', 404, 'NOT_FOUND');
    }

    const symbol = input.symbol ? this.normalizeInstrumentSymbol(input.symbol) : undefined;
    const isin = input.isin ? this.normalizeIsin(input.isin) : undefined;
    const name = input.name !== undefined ? input.name.trim() : undefined;
    if (name !== undefined && !name) {
      throw new AppError('Instrument name is required', 400, 'VALIDATION_ERROR');
    }

    if (input.assetClassId) {
      await this.assertAssetClassOwnership(userId, input.assetClassId);
    }

    try {
      const row = await prisma.portfolioInstrument.update({
        where: { id: instrumentId },
        data: {
          symbol,
          name,
          isin,
          assetClassId: input.assetClassId,
        },
        include: {
          assetClass: true,
        },
      });
      return this.toInstrumentDTO(row);
    } catch (error) {
      this.handleInstrumentUniqueError(error, symbol ?? existing.symbol, isin ?? existing.isin);
      throw error;
    }
  }

  async getInvestedState(userId: string): Promise<PortfolioInvestedStateDTO> {
    const row = await prisma.investedPortfolio.findUnique({
      where: { userId },
      select: {
        positionsJson: true,
        updatedAt: true,
      },
    });

    if (!row) {
      return {
        hasSaved: false,
        updatedAt: null,
        positions: [],
      };
    }

    return {
      hasSaved: true,
      updatedAt: row.updatedAt.toISOString(),
      positions: this.normalizeInvestedPositions(row.positionsJson),
    };
  }

  async updateInvestedState(
    userId: string,
    input: UpdatePortfolioInvestedStateDTO
  ): Promise<PortfolioInvestedStateDTO> {
    const normalized = this.normalizeInvestedPositions(input.positions);

    const row = await prisma.investedPortfolio.upsert({
      where: { userId },
      update: {
        positionsJson: normalized as unknown as Prisma.InputJsonValue,
      },
      create: {
        userId,
        positionsJson: normalized as unknown as Prisma.InputJsonValue,
      },
      select: {
        positionsJson: true,
        updatedAt: true,
      },
    });

    return {
      hasSaved: true,
      updatedAt: row.updatedAt.toISOString(),
      positions: this.normalizeInvestedPositions(row.positionsJson),
    };
  }

  private normalizeUniverse(universeByLabel: Record<string, string>): Record<string, string> {
    return Object.entries(universeByLabel).reduce<Record<string, string>>((acc, [label, isin]) => {
      const cleanLabel = label.trim();
      const cleanIsin = isin.trim().toUpperCase();
      if (!cleanLabel || !cleanIsin) return acc;
      if (!ISIN_REGEX.test(cleanIsin)) {
        throw new AppError(`Invalid ISIN '${isin}' for label '${label}'`, 400, 'VALIDATION_ERROR');
      }
      acc[cleanLabel] = cleanIsin;
      return acc;
    }, {});
  }

  private normalizeInvestedPositions(value: unknown): PortfolioInvestedPositionDTO[] {
    if (!Array.isArray(value)) return [];

    const aggregated = new Map<string, number>();

    value.forEach((item) => {
      const row = item as InvestedPositionJson;
      const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : '';
      const amount = Number(row.amount);
      if (!symbol || !Number.isFinite(amount) || amount <= 0) return;
      aggregated.set(symbol, (aggregated.get(symbol) ?? 0) + amount);
    });

    return Array.from(aggregated.entries())
      .map(([symbol, amount]) => ({
        symbol: symbol.toUpperCase(),
        amount: this.roundToCents(amount),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  private normalizeInstrumentSymbol(symbol: string): string {
    const clean = symbol.trim().toUpperCase();
    if (!clean) {
      throw new AppError('Instrument symbol is required', 400, 'VALIDATION_ERROR');
    }
    if (!/^[A-Z0-9 _./&()+-]{1,60}$/.test(clean)) {
      throw new AppError(`Invalid instrument symbol '${symbol}'`, 400, 'VALIDATION_ERROR');
    }
    return clean;
  }

  private normalizeIsin(isin: string): string {
    const clean = isin.trim().toUpperCase();
    if (!ISIN_REGEX.test(clean)) {
      throw new AppError(`Invalid ISIN '${isin}'`, 400, 'VALIDATION_ERROR');
    }
    return clean;
  }

  private async assertAssetClassOwnership(userId: string, assetClassId: string): Promise<void> {
    const row = await prisma.portfolioAssetClass.findFirst({
      where: { id: assetClassId, userId },
      select: { id: true },
    });
    if (!row) {
      throw new AppError('Asset class not found', 404, 'NOT_FOUND');
    }
  }

  private handleInstrumentUniqueError(error: unknown, symbol: string, isin: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(
        `Instrument conflict: symbol '${symbol}' or ISIN '${isin}' already exists`,
        409,
        'CONFLICT',
      );
    }
  }

  private toAssetClassDTO(row: { id: string; name: string; createdAt: Date; updatedAt: Date }): PortfolioAssetClassDTO {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toInstrumentDTO(row: {
    id: string;
    symbol: string;
    name: string;
    isin: string;
    assetClassId: string;
    createdAt: Date;
    updatedAt: Date;
    assetClass: { name: string };
  }): PortfolioInstrumentDTO {
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      isin: row.isin,
      assetClassId: row.assetClassId,
      assetClassName: row.assetClass.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async ensureDefaultInstrumentCatalog(userId: string): Promise<void> {
    const classesCount = await prisma.portfolioAssetClass.count({ where: { userId } });
    if (classesCount > 0) return;

    await prisma.$transaction(async (tx) => {
      const insideCount = await tx.portfolioAssetClass.count({ where: { userId } });
      if (insideCount > 0) return;

      await tx.portfolioAssetClass.createMany({
        data: DEFAULT_ASSET_CLASS_NAMES.map((name) => ({ userId, name })),
      });

      const classes = await tx.portfolioAssetClass.findMany({
        where: { userId },
      });
      const classIdByName = new Map(classes.map((item) => [item.name, item.id]));

      const instruments = DEFAULT_INSTRUMENT_SEEDS.map((seed) => {
        const assetClassId = classIdByName.get(seed.assetClassName);
        if (!assetClassId) return null;
        return {
          userId,
          symbol: seed.symbol,
          name: seed.name,
          isin: seed.isin,
          assetClassId,
        };
      }).filter((item): item is { userId: string; symbol: string; name: string; isin: string; assetClassId: string } => item !== null);

      if (instruments.length > 0) {
        await tx.portfolioInstrument.createMany({
          data: instruments,
          skipDuplicates: true,
        });
      }
    });
  }

  private getUsedLabels(portfolios: PortfolioCompareRequestDTO['portfolios']): string[] {
    const labels = new Set<string>();
    portfolios.forEach((portfolio) => {
      Object.entries(portfolio.weights).forEach(([label, weight]) => {
        if (Number(weight) > 0) labels.add(label.trim());
      });
    });
    return Array.from(labels);
  }

  private normalizeWeights(
    weights: Record<string, number>,
    availableLabels: string[]
  ): Record<string, number> {
    const availableSet = new Set(availableLabels);
    const sanitizedEntries = Object.entries(weights)
      .map(([label, value]) => [label.trim(), Math.max(0, Number(value) || 0)] as const)
      .filter(([label, value]) => availableSet.has(label) && value > 0);

    if (sanitizedEntries.length === 0) return {};
    const total = sanitizedEntries.reduce((sum, [, value]) => sum + value, 0);
    if (!Number.isFinite(total) || total <= 0) return {};

    return sanitizedEntries.reduce<Record<string, number>>((acc, [label, value]) => {
      acc[label] = value / total;
      return acc;
    }, {});
  }

  private buildMonthlyReturns(points: PortfolioHistoryPointDTO[]): Map<string, number> {
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const returns = new Map<string, number>();

    for (let index = 1; index < sorted.length; index += 1) {
      const prev = sorted[index - 1].close;
      const curr = sorted[index].close;
      if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) continue;
      returns.set(sorted[index].date, curr / prev - 1);
    }

    return returns;
  }

  private buildPortfolioReturnSeries(
    labels: string[],
    normalizedWeights: Record<string, number>,
    returnsByLabel: Map<string, Map<string, number>>,
    sortedDates: string[]
  ): Array<{ date: string; value: number }> {
    const output: Array<{ date: string; value: number }> = [];

    sortedDates.forEach((date) => {
      const rowValues = labels.map((label) => returnsByLabel.get(label)?.get(date));
      if (rowValues.some((value) => !Number.isFinite(value))) return;

      const value = labels.reduce((sum, label, idx) => {
        const ret = rowValues[idx] as number;
        return sum + ret * (normalizedWeights[label] ?? 0);
      }, 0);

      if (Number.isFinite(value)) output.push({ date, value });
    });

    return output;
  }

  private annualizedReturn(monthlyReturns: number[]): number {
    if (monthlyReturns.length === 0) return Number.NaN;
    const mean = monthlyReturns.reduce((sum, value) => sum + value, 0) / monthlyReturns.length;
    return (1 + mean) ** MONTHS_IN_YEAR - 1;
  }

  private annualizedVolatility(monthlyReturns: number[]): number {
    const std = this.sampleStd(monthlyReturns);
    if (!Number.isFinite(std)) return Number.NaN;
    return std * Math.sqrt(MONTHS_IN_YEAR);
  }

  private sampleStd(values: number[]): number {
    if (values.length < 2) return Number.NaN;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private effectiveNumberOfBets(weights: Record<string, number>): number {
    const sumSquares = Object.values(weights).reduce((sum, weight) => sum + weight ** 2, 0);
    if (!Number.isFinite(sumSquares) || sumSquares <= 0) return Number.NaN;
    return 1 / sumSquares;
  }

  private avgPairwiseCorrelation(
    labels: string[],
    returnsByLabel: Map<string, Map<string, number>>,
    sortedDates: string[]
  ): number | null {
    if (labels.length < 2) return null;

    const values: number[] = [];
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        const lhs = labels[i];
        const rhs = labels[j];
        const pairedLhs: number[] = [];
        const pairedRhs: number[] = [];

        sortedDates.forEach((date) => {
          const lv = returnsByLabel.get(lhs)?.get(date);
          const rv = returnsByLabel.get(rhs)?.get(date);
          if (Number.isFinite(lv) && Number.isFinite(rv)) {
            pairedLhs.push(lv as number);
            pairedRhs.push(rv as number);
          }
        });

        const corr = this.pearsonCorrelation(pairedLhs, pairedRhs);
        if (corr !== null) values.push(corr);
      }
    }

    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private pearsonCorrelation(lhs: number[], rhs: number[]): number | null {
    if (lhs.length < 2 || rhs.length < 2 || lhs.length !== rhs.length) return null;

    const meanLhs = lhs.reduce((sum, value) => sum + value, 0) / lhs.length;
    const meanRhs = rhs.reduce((sum, value) => sum + value, 0) / rhs.length;

    let cov = 0;
    let sumSqLhs = 0;
    let sumSqRhs = 0;
    for (let index = 0; index < lhs.length; index += 1) {
      const dl = lhs[index] - meanLhs;
      const dr = rhs[index] - meanRhs;
      cov += dl * dr;
      sumSqLhs += dl ** 2;
      sumSqRhs += dr ** 2;
    }

    const denominator = Math.sqrt(sumSqLhs * sumSqRhs);
    if (!Number.isFinite(denominator) || denominator <= 0) return null;
    return cov / denominator;
  }

  private computeScore(
    annualizedReturn: number,
    annualizedVolatility: number,
    divers: number,
    avgCorr: number | null
  ): number | null {
    if (!Number.isFinite(annualizedReturn) || !Number.isFinite(annualizedVolatility) || annualizedVolatility <= 0) {
      return null;
    }
    if (!Number.isFinite(divers) || divers <= 0 || avgCorr === null || !Number.isFinite(avgCorr) || avgCorr <= -1) {
      return null;
    }
    return (annualizedReturn / annualizedVolatility) * (divers / (1 + avgCorr));
  }

  private computePortfolioCorrelationMatrix(results: PortfolioComparisonResultDTO[]): {
    labels: string[];
    values: Array<Array<number | null>>;
  } {
    const labels = results.map((item) => item.name);
    const valueByPortfolioDate = new Map<string, Map<string, number>>();

    results.forEach((portfolio) => {
      const dateMap = new Map<string, number>();
      portfolio.series.forEach((point) => dateMap.set(point.date, point.value));
      valueByPortfolioDate.set(portfolio.name, dateMap);
    });

    const commonDates = results
      .map((portfolio) => new Set(portfolio.series.map((point) => point.date)))
      .reduce<Set<string> | null>((acc, current) => {
        if (!acc) return new Set(current);
        return new Set(Array.from(acc).filter((date) => current.has(date)));
      }, null);

    const dates = Array.from(commonDates ?? []).sort((a, b) => a.localeCompare(b));
    const values = labels.map((lhsName, rowIndex) =>
      labels.map((rhsName, colIndex) => {
        if (rowIndex === colIndex) return 1;
        if (dates.length < 2) return null;

        const lhsValues: number[] = [];
        const rhsValues: number[] = [];
        dates.forEach((date) => {
          const lhs = valueByPortfolioDate.get(lhsName)?.get(date);
          const rhs = valueByPortfolioDate.get(rhsName)?.get(date);
          if (Number.isFinite(lhs) && Number.isFinite(rhs)) {
            lhsValues.push(lhs as number);
            rhsValues.push(rhs as number);
          }
        });

        const corr = this.pearsonCorrelation(lhsValues, rhsValues);
        return corr === null ? null : this.round6(corr);
      })
    );

    return { labels, values };
  }

  private async resolveUniverseFromOverview(
    universeByLabel: Record<string, string>
  ): Promise<PortfolioUniverseItemDTO[]> {
    const uniqueIsins = Array.from(new Set(Object.values(universeByLabel)));
    const metadataByIsin = new Map<string, Omit<PortfolioUniverseItemDTO, 'label' | 'isin'>>();

    for (const isin of uniqueIsins) {
      const metadata = await this.fetchOverviewMetadataByIsin(isin);
      metadataByIsin.set(isin, metadata);
    }

    return Object.entries(universeByLabel)
      .map(([label, isin]) => {
        const metadata = metadataByIsin.get(isin);
        return {
          label,
          isin,
          name: metadata?.name ?? null,
          ticker: metadata?.ticker ?? null,
          currency: metadata?.currency ?? null,
          strategy: metadata?.strategy ?? null,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private async fetchOverviewMetadataByIsin(
    isin: string
  ): Promise<Omit<PortfolioUniverseItemDTO, 'label' | 'isin'>> {
    for (const strategy of JUSTETF_OVERVIEW_STRATEGIES) {
      try {
        const payload = await this.fetchOverviewPayload(isin, strategy);
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const match = rows.find((item) => item.isin?.toUpperCase() === isin);
        if (!match) continue;

        return {
          name: typeof match.name === 'string' ? match.name : null,
          ticker: typeof match.ticker === 'string' ? match.ticker : null,
          currency: typeof match.currency === 'string' ? match.currency : null,
          strategy: typeof match.strategy === 'string' ? match.strategy : null,
        };
      } catch {
        // Ignore overview scraping failures: chart data analysis can still run.
      }
    }

    return {
      name: null,
      ticker: null,
      currency: null,
      strategy: null,
    };
  }

  private async fetchOverviewPayload(
    query: string,
    strategy: (typeof JUSTETF_OVERVIEW_STRATEGIES)[number]
  ): Promise<JustEtfOverviewPayload> {
    const body = JSON.stringify({
      ...JUSTETF_OVERVIEW_BASE_PARAMS,
      query,
      productGroup: strategy,
      quoteCurrency: this.justEtfCurrency,
    });

    const response = await fetch(JUSTETF_OVERVIEW_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      body,
    });

    if (!response.ok) {
      throw new AppError(`justETF overview provider error (${response.status})`, 502, 'PROVIDER_ERROR');
    }

    return (await response.json()) as JustEtfOverviewPayload;
  }

  private async fetchCountryAllocationsByIsin(isin: string): Promise<JustEtfCountryAllocation[]> {
    const cacheKey = `${this.geographicExposureCacheVersion}:${isin}`;
    const cached = this.geographicExposureCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.countries;
    }

    let profileHtml = '';
    let cookieHeader = '';

    try {
      const profile = await this.fetchProfileHtml(isin);
      profileHtml = profile.html;
      cookieHeader = profile.cookieHeader;
    } catch {
      // If profile fetch fails we still try to return from cache or empty data.
    }

    const baseCountries = this.parseCountryAllocationsFromMarkup(profileHtml);
    const expandedMarkup = await this.fetchLoadMoreCountriesMarkup(isin, cookieHeader);
    const expandedCountries = this.parseCountryAllocationsFromMarkup(expandedMarkup);

    const best = this.pickBestCountryAllocation(baseCountries, expandedCountries);

    this.geographicExposureCache.set(cacheKey, {
      countries: best,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return best;
  }

  private async fetchSectorAllocationsByIsin(isin: string): Promise<JustEtfSectorAllocation[]> {
    const cacheKey = `${this.sectorExposureCacheVersion}:${isin}`;
    const cached = this.sectorExposureCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.sectors;
    }

    let profileHtml = '';
    let cookieHeader = '';

    try {
      const profile = await this.fetchProfileHtml(isin);
      profileHtml = profile.html;
      cookieHeader = profile.cookieHeader;
    } catch {
      // If profile fetch fails we still try to return from cache or empty data.
    }

    const baseSectors = this.parseSectorAllocationsFromMarkup(profileHtml);
    const expandedMarkup = await this.fetchLoadMoreSectorsMarkup(isin, cookieHeader);
    const expandedSectors = this.parseSectorAllocationsFromMarkup(expandedMarkup);
    const best = this.pickBestSectorAllocation(baseSectors, expandedSectors);

    this.sectorExposureCache.set(cacheKey, {
      sectors: best,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return best;
  }

  private async fetchProfileHtml(isin: string): Promise<{ html: string; cookieHeader: string }> {
    const profileUrl = `${JUSTETF_PROFILE_URL}?isin=${encodeURIComponent(isin)}`;
    const response = await fetch(profileUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en',
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new AppError(`justETF profile provider error (${response.status})`, 502, 'PROVIDER_ERROR');
    }

    const html = await response.text();
    const cookieHeader = response.headers.get('set-cookie') ?? '';
    return { html, cookieHeader };
  }

  private async fetchLoadMoreCountriesMarkup(isin: string, cookieHeader: string): Promise<string> {
    const requestUrl = `${JUSTETF_PROFILE_URL}?${JUSTETF_COUNTRIES_LOAD_MORE_PATH}&isin=${encodeURIComponent(isin)}&_wicket=1`;
    const baseUrl = `en/etf-profile.html?isin=${isin}`;

    const headers: Record<string, string> = {
      Accept: 'text/xml; charset=UTF-8',
      'Accept-Language': 'en',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${JUSTETF_PROFILE_URL}?isin=${isin}`,
      'User-Agent': this.userAgent,
      'Wicket-Ajax': 'true',
      'Wicket-Ajax-BaseURL': baseUrl,
      'X-Requested-With': 'XMLHttpRequest',
    };

    const cleanCookie = this.toCookieHeader(cookieHeader);
    if (cleanCookie) {
      headers.Cookie = cleanCookie;
    }

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
      });
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    }
  }

  private async fetchLoadMoreSectorsMarkup(isin: string, cookieHeader: string): Promise<string> {
    const requestUrl = `${JUSTETF_PROFILE_URL}?${JUSTETF_SECTORS_LOAD_MORE_PATH}&isin=${encodeURIComponent(isin)}&_wicket=1`;
    const baseUrl = `en/etf-profile.html?isin=${isin}`;

    const headers: Record<string, string> = {
      Accept: 'text/xml; charset=UTF-8',
      'Accept-Language': 'en',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: `${JUSTETF_PROFILE_URL}?isin=${isin}`,
      'User-Agent': this.userAgent,
      'Wicket-Ajax': 'true',
      'Wicket-Ajax-BaseURL': baseUrl,
      'X-Requested-With': 'XMLHttpRequest',
    };

    const cleanCookie = this.toCookieHeader(cookieHeader);
    if (cleanCookie) {
      headers.Cookie = cleanCookie;
    }

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
      });
      if (!response.ok) return '';
      return await response.text();
    } catch {
      return '';
    }
  }

  private pickBestCountryAllocation(
    baseCountries: JustEtfCountryAllocation[],
    expandedCountries: JustEtfCountryAllocation[],
  ): JustEtfCountryAllocation[] {
    if (expandedCountries.length === 0) return baseCountries;
    if (baseCountries.length === 0) return expandedCountries;

    const baseScore = baseCountries.reduce((sum, row) => sum + this.normalizeCountryRatio(row.percentage), 0);
    const expandedScore = expandedCountries.reduce((sum, row) => sum + this.normalizeCountryRatio(row.percentage), 0);

    return expandedScore >= baseScore ? expandedCountries : baseCountries;
  }

  private pickBestSectorAllocation(
    baseSectors: JustEtfSectorAllocation[],
    expandedSectors: JustEtfSectorAllocation[],
  ): JustEtfSectorAllocation[] {
    if (expandedSectors.length === 0) return baseSectors;
    if (baseSectors.length === 0) return expandedSectors;

    const baseScore = baseSectors.reduce((sum, row) => sum + this.normalizeAllocationRatio(row.percentage), 0);
    const expandedScore = expandedSectors.reduce((sum, row) => sum + this.normalizeAllocationRatio(row.percentage), 0);

    return expandedScore >= baseScore ? expandedSectors : baseSectors;
  }

  private parseCountryAllocationsFromMarkup(markup: string): JustEtfCountryAllocation[] {
    if (!markup) return [];

    const byCountry = new Map<string, number>();
    const rowRegex = /<tr[^>]*data-testid="[^"]*countries[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;

    let rowMatch: RegExpExecArray | null = rowRegex.exec(markup);
    while (rowMatch) {
      const rowHtml = rowMatch[1];
      const nameMatch = /data-testid="[^"]*countries_value_name"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
      const percentageMatch = /data-testid="[^"]*countries_value_percentage"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);

      const country = this.normalizeCountryName(
        this.decodeHtmlEntities(this.stripHtmlTags(nameMatch?.[1] ?? '')).trim()
      );
      const percentageText = this.decodeHtmlEntities(this.stripHtmlTags(percentageMatch?.[1] ?? '')).trim();
      const percentage = Number(
        percentageText
          .replace('%', '')
          .replace(',', '.')
          .replace(/[^\d.-]/g, '')
      );

      if (country && Number.isFinite(percentage) && percentage > 0) {
        byCountry.set(country, (byCountry.get(country) ?? 0) + percentage);
      }

      rowMatch = rowRegex.exec(markup);
    }

    return Array.from(byCountry.entries())
      .map(([country, percentage]) => ({ country, percentage }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  private parseSectorAllocationsFromMarkup(markup: string): JustEtfSectorAllocation[] {
    if (!markup) return [];

    const bySector = new Map<string, number>();
    const rowRegex = /<tr[^>]*data-testid="[^"]*sectors[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;

    let rowMatch: RegExpExecArray | null = rowRegex.exec(markup);
    while (rowMatch) {
      const rowHtml = rowMatch[1];
      const nameMatch = /data-testid="[^"]*sectors_value_name"[^>]*>([\s\S]*?)<\/(?:td|span)>/i.exec(rowHtml);
      const percentageMatch = /data-testid="[^"]*sectors_value_percentage"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);

      const sector = this.normalizeSectorName(
        this.decodeHtmlEntities(this.stripHtmlTags(nameMatch?.[1] ?? '')).trim()
      );
      const percentageText = this.decodeHtmlEntities(this.stripHtmlTags(percentageMatch?.[1] ?? '')).trim();
      const percentage = Number(
        percentageText
          .replace('%', '')
          .replace(',', '.')
          .replace(/[^\d.-]/g, '')
      );

      if (sector && Number.isFinite(percentage) && percentage > 0) {
        bySector.set(sector, (bySector.get(sector) ?? 0) + percentage);
      }

      rowMatch = rowRegex.exec(markup);
    }

    return Array.from(bySector.entries())
      .map(([sector, percentage]) => ({ sector, percentage }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  private stripHtmlTags(value: string): string {
    return value.replace(/<[^>]*>/g, ' ');
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private toCookieHeader(rawCookieHeader: string): string {
    if (!rawCookieHeader) return '';
    return rawCookieHeader
      .split(',')
      .flatMap((chunk) => chunk.split(';'))
      .map((token) => token.trim())
      .filter((token) => token.includes('=') && !token.toLowerCase().startsWith('path=') && !token.toLowerCase().startsWith('expires=') && !token.toLowerCase().startsWith('max-age=') && !token.toLowerCase().startsWith('domain=') && !token.toLowerCase().startsWith('secure') && !token.toLowerCase().startsWith('httponly') && !token.toLowerCase().startsWith('samesite='))
      .join('; ');
  }

  private normalizeAllocationRatio(percentage: number): number {
    if (!Number.isFinite(percentage) || percentage <= 0) return 0;
    return percentage > 1 ? percentage / 100 : percentage;
  }

  private normalizeCountryRatio(percentage: number): number {
    return this.normalizeAllocationRatio(percentage);
  }

  private normalizeCountryName(country: string): string {
    if (!country) return '';

    const cleaned = country
      .replace(/\u00a0/g, ' ')
      .replace(/\s*\(?\d+(?:[.,]\d+)?\s*%?\)?\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const normalizedKey = cleaned
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (normalizedKey === 'uk' || normalizedKey === 'u.k.' || normalizedKey === 'united kingdom of great britain and northern ireland') {
      return 'United Kingdom';
    }
    if (normalizedKey === 'usa' || normalizedKey === 'u.s.a.' || normalizedKey === 'united states of america') {
      return 'United States';
    }

    return cleaned;
  }

  private normalizeSectorName(sector: string): string {
    if (!sector) return '';

    return sector
      .replace(/\u00a0/g, ' ')
      .replace(/\s*\(?\d+(?:[.,]\d+)?\s*%?\)?\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private normalizeAssetClassForExposure(name: string): string {
    if (!name) return 'ALTRO';

    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

    if (normalized.includes('AZIONARIO')) return 'AZIONARIO';
    if (normalized.includes('OBBLIGAZIONARIO')) return 'OBBLIGAZIONARIO';
    if (normalized.includes('COMMODITIES')) return 'COMMODITIES';
    if (normalized.includes('MONETARIO')) return 'MONETARIO';
    return 'ALTRO';
  }

  private async resolveGeographicInstrumentMetadata(
    userId: string,
    isins: string[],
  ): Promise<Map<string, GeographicInstrumentMetadata>> {
    const normalizedIsins = Array.from(new Set(isins.map((isin) => isin.trim().toUpperCase()).filter(Boolean)));
    if (normalizedIsins.length === 0) return new Map();

    const instruments = await prisma.portfolioInstrument.findMany({
      where: {
        userId,
        isin: { in: normalizedIsins },
      },
      select: {
        isin: true,
        symbol: true,
        assetClass: {
          select: {
            name: true,
          },
        },
      },
    });

    const out = new Map<string, GeographicInstrumentMetadata>();
    instruments.forEach((instrument) => {
      const isin = instrument.isin.trim().toUpperCase();
      out.set(isin, {
        symbol: instrument.symbol.trim().toUpperCase(),
        assetClass: this.normalizeAssetClassForExposure(instrument.assetClass.name),
      });
    });

    return out;
  }

  private metricToInputValueMode(metric: PortfolioStaticPerformanceMetricDTO): PortfolioInputValueModeDTO {
    return metric === 'relative_with_reinvested_dividends' ? 'quote_with_dividends' : 'quote';
  }

  private async getSymbolFullHistory(
    symbol: string,
    valueMode: PortfolioInputValueModeDTO
  ): Promise<PortfolioHistoryPointDTO[]> {
    const cacheKey = `${symbol}|FULL|${valueMode}`;
    const cached = this.fullHistoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.points;

    const existingPromise = this.fullHistoryInFlight.get(cacheKey);
    if (existingPromise) return existingPromise;

    const nextPromise = this.fetchFullFromProvider(symbol, valueMode)
      .then((points) => {
        this.fullHistoryCache.set(cacheKey, {
          points,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
        return points;
      })
      .finally(() => this.fullHistoryInFlight.delete(cacheKey));

    this.fullHistoryInFlight.set(cacheKey, nextPromise);
    return nextPromise;
  }

  private async getSymbolHistory(
    symbol: string,
    horizon: PortfolioHistoryHorizonDTO,
    valueMode: PortfolioInputValueModeDTO
  ): Promise<PortfolioHistoryPointDTO[]> {
    const cacheKey = `${symbol}|${horizon}|${valueMode}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.points;

    const existingPromise = this.inFlight.get(cacheKey);
    if (existingPromise) return existingPromise;

    const nextPromise = this.fetchFromProvider(symbol, horizon, valueMode)
      .then((points) => {
        this.cache.set(cacheKey, {
          points,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
        return points;
      })
      .finally(() => this.inFlight.delete(cacheKey));

    this.inFlight.set(cacheKey, nextPromise);
    return nextPromise;
  }

  private async fetchFullFromProvider(
    symbol: string,
    valueMode: PortfolioInputValueModeDTO
  ): Promise<PortfolioHistoryPointDTO[]> {
    if (!ISIN_REGEX.test(symbol)) {
      throw new AppError(
        `Invalid symbol '${symbol}'. justETF requires ISIN codes.`,
        422,
        'PROVIDER_SYMBOL_ERROR'
      );
    }

    const payload = await this.fetchJustEtfChartPayload(symbol);
    const dailyQuoteSeries = this.parseDailyQuotes(payload);
    if (dailyQuoteSeries.length < 2) {
      throw new AppError(`Insufficient history for ISIN ${symbol}`, 422, 'INSUFFICIENT_HISTORY');
    }

    const monthlyPoints = this.toMonthlySeries(
      dailyQuoteSeries,
      this.parseDividends(payload),
      valueMode
    );

    if (monthlyPoints.length < 2) {
      throw new AppError(`Insufficient monthly history for ISIN ${symbol}`, 422, 'INSUFFICIENT_HISTORY');
    }

    return monthlyPoints;
  }

  private async fetchFromProvider(
    symbol: string,
    horizon: PortfolioHistoryHorizonDTO,
    valueMode: PortfolioInputValueModeDTO
  ): Promise<PortfolioHistoryPointDTO[]> {
    if (!ISIN_REGEX.test(symbol)) {
      throw new AppError(
        `Invalid symbol '${symbol}'. justETF requires ISIN codes.`,
        422,
        'PROVIDER_SYMBOL_ERROR'
      );
    }

    const payload = await this.fetchJustEtfChartPayload(symbol);
    const dailyQuoteSeries = this.parseDailyQuotes(payload);
    if (dailyQuoteSeries.length < 2) {
      throw new AppError(`Insufficient history for ISIN ${symbol}`, 422, 'INSUFFICIENT_HISTORY');
    }

    const monthlyPoints = this.toMonthlySeries(
      dailyQuoteSeries,
      this.parseDividends(payload),
      valueMode
    );

    const outputSize = HORIZON_OUTPUT_SIZE[horizon];
    const output = monthlyPoints.slice(-outputSize);
    if (output.length < 2) {
      throw new AppError(`Insufficient monthly history for ISIN ${symbol}`, 422, 'INSUFFICIENT_HISTORY');
    }
    return output;
  }

  private async fetchJustEtfChartPayload(isin: string): Promise<JustEtfChartPayload> {
    const params = new URLSearchParams({
      ...JUSTETF_CHART_DEFAULT_PARAMS,
      currency: this.justEtfCurrency,
    });

    try {
      const response = await fetch(
        `${JUSTETF_CHART_BASE_URL}/${encodeURIComponent(isin)}/performance-chart?${params.toString()}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError(`ISIN '${isin}' not found on justETF`, 422, 'PROVIDER_SYMBOL_ERROR');
        }
        throw new AppError(`justETF provider error (${response.status})`, 502, 'PROVIDER_ERROR');
      }

      return (await response.json()) as JustEtfChartPayload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Unable to reach justETF provider', 502, 'PROVIDER_UNAVAILABLE');
    }
  }

  private parseDailyQuotes(payload: JustEtfChartPayload): Array<{ date: string; close: number }> {
    const series = Array.isArray(payload.series) ? payload.series : [];

    return series
      .map((sample) => {
        const rawDate = typeof sample.date === 'string' ? sample.date.slice(0, 10) : '';
        const rawValue =
          typeof sample.value === 'number'
            ? sample.value
            : sample.value && typeof sample.value === 'object'
              ? Number(sample.value.raw)
              : Number.NaN;

        if (!rawDate || !Number.isFinite(rawValue)) return null;
        return {
          date: rawDate,
          close: this.roundToCents(rawValue),
        };
      })
      .filter((point): point is { date: string; close: number } => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private parseDividends(payload: JustEtfChartPayload): Map<string, number> {
    const dividendsSeries = payload.features?.DIVIDENDS;
    if (!Array.isArray(dividendsSeries)) return new Map();

    const map = new Map<string, number>();
    dividendsSeries.forEach((sample) => {
      const rawDate = typeof sample.date === 'string' ? sample.date.slice(0, 10) : '';
      const rawValue =
        typeof sample.value === 'number'
          ? sample.value
          : sample.value && typeof sample.value === 'object'
            ? Number(sample.value.raw)
            : Number.NaN;

      if (!rawDate || !Number.isFinite(rawValue)) return;
      map.set(rawDate, (map.get(rawDate) ?? 0) + rawValue);
    });

    return map;
  }

  private toMonthlySeries(
    dailyQuoteSeries: Array<{ date: string; close: number }>,
    dividendsByDate: Map<string, number>,
    valueMode: PortfolioInputValueModeDTO
  ): PortfolioHistoryPointDTO[] {
    let cumulativeDividends = 0;
    const pointsByMonth = new Map<string, PortfolioHistoryPointDTO>();

    dailyQuoteSeries.forEach((point) => {
      cumulativeDividends += dividendsByDate.get(point.date) ?? 0;
      const close =
        valueMode === 'quote'
          ? point.close
          : this.roundToCents(point.close + cumulativeDividends);

      const monthKey = point.date.slice(0, 7);
      const existing = pointsByMonth.get(monthKey);
      if (!existing || point.date > existing.date) {
        pointsByMonth.set(monthKey, { date: point.date, close });
      }
    });

    return Array.from(pointsByMonth.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  private roundToCents(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round6(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }

  private compareNullableNumbersDesc(lhs: number | null, rhs: number | null): number {
    const left = lhs === null || Number.isNaN(lhs) ? Number.NEGATIVE_INFINITY : lhs;
    const right = rhs === null || Number.isNaN(rhs) ? Number.NEGATIVE_INFINITY : rhs;
    return right - left;
  }

  private get cacheTtlMs(): number {
    const minutes = Number(process.env.PORTFOLIO_CACHE_TTL_MINUTES ?? '360');
    if (!Number.isFinite(minutes) || minutes <= 0) return 6 * 60 * 1000;
    return minutes * 60 * 1000;
  }

  private get defaultInputValueMode(): PortfolioInputValueModeDTO {
    return (process.env.PORTFOLIO_JUSTETF_INPUT_VALUE || 'quote_with_dividends') === 'quote'
      ? 'quote'
      : 'quote_with_dividends';
  }

  private get justEtfCurrency(): string {
    const currency = (process.env.PORTFOLIO_JUSTETF_CURRENCY || 'EUR').trim().toUpperCase();
    return currency || 'EUR';
  }

  private get userAgent(): string {
    return (
      process.env.PORTFOLIO_JUSTETF_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    );
  }
}

export const portfolioService = new PortfolioService();
