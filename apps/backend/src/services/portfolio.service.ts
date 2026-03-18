import type {
  PortfolioHistoryHorizonDTO,
  PortfolioHistoryPointDTO,
  PortfolioHistoryResponseDTO,
  PortfolioSymbolHistoryDTO,
} from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

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

type InputValueMode = 'quote' | 'quote_with_dividends';

const JUSTETF_CHART_BASE_URL = 'https://www.justetf.com/api/etfs';
const JUSTETF_CHART_DEFAULT_PARAMS = {
  locale: 'en',
  valuesType: 'MARKET_VALUE',
  reduceData: 'false',
  includeDividends: 'false',
  features: 'DIVIDENDS',
};
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

const HORIZON_OUTPUT_SIZE: Record<PortfolioHistoryHorizonDTO, number> = {
  '1Y': 13,
  '3Y': 37,
  '5Y': 61,
};

export class PortfolioService {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<PortfolioHistoryPointDTO[]>>();

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
      const points = await this.getSymbolHistory(symbol, horizon);
      series.push({ symbol, points });
    }

    return {
      horizon,
      generatedAt: new Date().toISOString(),
      series,
    };
  }

  async getJustEtfRawChart(isin: string): Promise<JustEtfChartPayload> {
    const normalizedIsin = isin.trim().toUpperCase();
    if (!ISIN_REGEX.test(normalizedIsin)) {
      throw new AppError(
        `Invalid ISIN '${isin}'.`,
        422,
        'PROVIDER_SYMBOL_ERROR'
      );
    }

    return this.fetchJustEtfChartPayload(normalizedIsin);
  }

  private async getSymbolHistory(
    symbol: string,
    horizon: PortfolioHistoryHorizonDTO
  ): Promise<PortfolioHistoryPointDTO[]> {
    const cacheKey = `${symbol}|${horizon}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.points;
    }

    const existingPromise = this.inFlight.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const nextPromise = this.fetchFromProvider(symbol, horizon)
      .then((points) => {
        this.cache.set(cacheKey, {
          points,
          expiresAt: Date.now() + this.cacheTtlMs,
        });
        return points;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, nextPromise);
    return nextPromise;
  }

  private async fetchFromProvider(
    symbol: string,
    horizon: PortfolioHistoryHorizonDTO
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
      this.inputValueMode
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
          throw new AppError(
            `ISIN '${isin}' not found on justETF`,
            422,
            'PROVIDER_SYMBOL_ERROR'
          );
        }

        throw new AppError(
          `justETF provider error (${response.status})`,
          502,
          'PROVIDER_ERROR'
        );
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
    valueMode: InputValueMode
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

  private get cacheTtlMs(): number {
    const minutes = Number(process.env.PORTFOLIO_CACHE_TTL_MINUTES ?? '360');
    if (!Number.isFinite(minutes) || minutes <= 0) return 6 * 60 * 1000;
    return minutes * 60 * 1000;
  }

  private get inputValueMode(): InputValueMode {
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
