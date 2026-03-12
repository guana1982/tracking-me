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

const HORIZON_OUTPUT_SIZE: Record<PortfolioHistoryHorizonDTO, number> = {
  '1Y': 13,
  '3Y': 37,
  '5Y': 61,
};

export class PortfolioService {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<PortfolioHistoryPointDTO[]>>();
  private dailyUsage = { dayKey: '', count: 0 };
  private minuteUsage = { minuteKey: '', count: 0 };

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
    const apiKey = (process.env.TWELVE_DATA_API_KEY || '').trim();
    if (!apiKey) {
      throw new AppError(
        'TWELVE_DATA_API_KEY is not configured',
        500,
        'PROVIDER_NOT_CONFIGURED'
      );
    }

    this.reserveQuota();

    const outputSize = HORIZON_OUTPUT_SIZE[horizon];
    const params = new URLSearchParams({
      symbol,
      interval: '1month',
      outputsize: String(outputSize),
      order: 'ASC',
      timezone: 'UTC',
      format: 'JSON',
      apikey: apiKey,
    });

    let payload: unknown;
    try {
      const response = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`);
      payload = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'message' in payload &&
          typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : `Provider error (${response.status})`;

        throw new AppError(message, 502, 'PROVIDER_ERROR');
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Unable to reach market data provider', 502, 'PROVIDER_UNAVAILABLE');
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'status' in payload &&
      (payload as { status?: unknown }).status === 'error'
    ) {
      const message =
        'message' in payload && typeof (payload as { message?: unknown }).message === 'string'
          ? (payload as { message: string }).message
          : `Provider rejected symbol ${symbol}`;
      throw new AppError(message, 422, 'PROVIDER_SYMBOL_ERROR');
    }

    const values =
      typeof payload === 'object' &&
      payload !== null &&
      'values' in payload &&
      Array.isArray((payload as { values?: unknown }).values)
        ? ((payload as { values: Array<{ datetime?: string; close?: string | number }> }).values ?? [])
        : [];

    const points = values
      .map((item) => {
        const rawDate = typeof item.datetime === 'string' ? item.datetime : '';
        const date = rawDate.slice(0, 10);
        const close = Number(item.close);
        if (!date || !Number.isFinite(close)) return null;
        return { date, close: Math.round(close * 100) / 100 };
      })
      .filter((point): point is PortfolioHistoryPointDTO => point !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (points.length < 2) {
      throw new AppError(`Insufficient history for symbol ${symbol}`, 422, 'INSUFFICIENT_HISTORY');
    }

    return points.slice(-outputSize);
  }

  private reserveQuota(): void {
    const now = new Date();

    const dayKey = now.toISOString().slice(0, 10);
    if (this.dailyUsage.dayKey !== dayKey) {
      this.dailyUsage = { dayKey, count: 0 };
    }

    const minuteKey = now.toISOString().slice(0, 16);
    if (this.minuteUsage.minuteKey !== minuteKey) {
      this.minuteUsage = { minuteKey, count: 0 };
    }

    if (this.dailyUsage.count >= this.maxRequestsPerDay) {
      throw new AppError(
        `Daily provider quota reached (${this.maxRequestsPerDay} requests/day)`,
        429,
        'PROVIDER_DAILY_LIMIT'
      );
    }

    if (this.minuteUsage.count >= this.maxRequestsPerMinute) {
      throw new AppError(
        `Provider minute quota reached (${this.maxRequestsPerMinute} requests/minute). Retry in a moment.`,
        429,
        'PROVIDER_MINUTE_LIMIT'
      );
    }

    this.dailyUsage.count += 1;
    this.minuteUsage.count += 1;
  }

  private get cacheTtlMs(): number {
    const minutes = Number(process.env.PORTFOLIO_CACHE_TTL_MINUTES ?? '360');
    if (!Number.isFinite(minutes) || minutes <= 0) return 6 * 60 * 1000;
    return minutes * 60 * 1000;
  }

  private get maxRequestsPerDay(): number {
    const value = Number(process.env.TWELVE_DATA_MAX_REQUESTS_PER_DAY ?? '700');
    if (!Number.isFinite(value) || value <= 0) return 700;
    return Math.floor(value);
  }

  private get maxRequestsPerMinute(): number {
    const value = Number(process.env.TWELVE_DATA_MAX_REQUESTS_PER_MINUTE ?? '7');
    if (!Number.isFinite(value) || value <= 0) return 7;
    return Math.floor(value);
  }
}

export const portfolioService = new PortfolioService();

