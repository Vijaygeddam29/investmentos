import { db } from "@workspace/db";
import { factorSnapshotsTable, priceHistoryTable } from "@workspace/db/schema";
import { eq, desc, and, gte, lte, inArray } from "drizzle-orm";

export type Strategy    = "fortress" | "rocket" | "wave";
export type WeightMethod = "equal" | "score" | "risk";

export interface BacktestConfig {
  strategy:       Strategy;
  startDate:      string;
  endDate:        string;
  portfolioSize:  number;
  rebalanceDays:  number;
  weightMethod:   WeightMethod;
  sectorCap?:     number;
}

export interface Position {
  ticker:     string;
  score:      number;
  weight:     number;
  volatility?: number;
}

export interface PortfolioResult {
  date:  string;
  value: number;
  positions?: Position[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Walk back up to 7 days to find the nearest date with price data for this ticker. */
async function findNearestTradingDate(ticker: string, targetDate: string): Promise<string | null> {
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - offset);
    const dateStr = formatDate(d);
    const [row] = await db
      .select({ date: priceHistoryTable.date })
      .from(priceHistoryTable)
      .where(and(eq(priceHistoryTable.ticker, ticker), eq(priceHistoryTable.date, dateStr)))
      .limit(1);
    if (row) return dateStr;
  }
  return null;
}

/** Nearest snapshot date at or before the requested date. */
async function findNearestSnapshotDate(targetDate: string): Promise<string | null> {
  const [row] = await db
    .select({ date: factorSnapshotsTable.date })
    .from(factorSnapshotsTable)
    .where(lte(factorSnapshotsTable.date, targetDate))
    .orderBy(desc(factorSnapshotsTable.date))
    .limit(1);
  return row?.date ?? null;
}

// ─── PortfolioEngine ──────────────────────────────────────────────────────────

export class PortfolioEngine {

  /** Top N stocks ranked by strategy score on or before a given date. */
  async getTopStocks(date: string, strategy: Strategy, limit: number): Promise<Position[]> {
    const snapshotDate = await findNearestSnapshotDate(date);
    if (!snapshotDate) return [];

    const scoreField =
      strategy === "fortress" ? factorSnapshotsTable.fortressScore :
      strategy === "rocket"   ? factorSnapshotsTable.rocketScore   :
                                factorSnapshotsTable.waveScore;

    const rows = await db
      .select()
      .from(factorSnapshotsTable)
      .where(eq(factorSnapshotsTable.date, snapshotDate))
      .orderBy(desc(scoreField))
      .limit(limit * 3); // over-fetch to allow sector-cap filtering

    const getScore = (r: typeof rows[0]) =>
      (strategy === "fortress" ? r.fortressScore :
       strategy === "rocket"   ? r.rocketScore   :
                                 r.waveScore) ?? 0;

    return rows.map((r) => ({ ticker: r.ticker, score: getScore(r), weight: 0 }));
  }

  /** 90-day annualised volatility for a ticker. */
  async computeVolatility(ticker: string, endDate: string): Promise<number> {
    const cutoff = formatDate(addDays(new Date(endDate), -95));
    const prices = await db
      .select({ close: priceHistoryTable.close, date: priceHistoryTable.date })
      .from(priceHistoryTable)
      .where(
        and(
          eq(priceHistoryTable.ticker, ticker),
          gte(priceHistoryTable.date, cutoff),
          lte(priceHistoryTable.date, endDate)
        )
      )
      .orderBy(priceHistoryTable.date);

    if (prices.length < 5) return 0.25;

    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1].close ?? 0;
      const curr = prices[i].close     ?? 0;
      if (prev > 0) returns.push((curr - prev) / prev);
    }
    if (!returns.length) return 0.25;

    const mean     = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    return Math.max(0.05, Math.sqrt(variance * 252));
  }

  /** Apply weighting to a list of positions (mutates weight in place). */
  async applyWeights(positions: Position[], method: WeightMethod, date: string): Promise<Position[]> {
    if (method === "equal") {
      const w = 1 / positions.length;
      positions.forEach((p) => (p.weight = w));
      return positions;
    }

    if (method === "score") {
      const total = positions.reduce((s, p) => s + p.score, 0) || 1;
      positions.forEach((p) => (p.weight = p.score / total));
      return positions;
    }

    // risk-adjusted: weight = score / volatility, then normalise
    for (const p of positions) {
      p.volatility = await this.computeVolatility(p.ticker, date);
    }
    const raws  = positions.map((p) => p.score / Math.max(0.05, p.volatility ?? 0.25));
    const total = raws.reduce((a, b) => a + b, 0) || 1;
    positions.forEach((p, i) => (p.weight = raws[i] / total));
    return positions;
  }

  /** Build a portfolio for a given date. */
  async buildPortfolio(
    date:         string,
    strategy:     Strategy,
    size:         number,
    weightMethod: WeightMethod,
    sectorCap = 2
  ): Promise<Position[]> {
    const stocks = await this.getTopStocks(date, strategy, size * 3);
    const positions = stocks.slice(0, size).map((s) => ({ ...s, weight: 0 }));
    return this.applyWeights(positions, weightMethod, date);
  }

  /** Get close price for a ticker on or near a date. */
  async getPrice(ticker: string, date: string): Promise<number | null> {
    const nearest = await findNearestTradingDate(ticker, date);
    if (!nearest) return null;
    const [row] = await db
      .select({ close: priceHistoryTable.close })
      .from(priceHistoryTable)
      .where(and(eq(priceHistoryTable.ticker, ticker), eq(priceHistoryTable.date, nearest)))
      .limit(1);
    return row?.close ?? null;
  }

  /** Batch-fetch prices for multiple tickers on or near a date. */
  async batchGetPrices(tickers: string[], date: string): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    const cutoff = formatDate(addDays(new Date(date), -5));

    const rows = await db
      .select({ ticker: priceHistoryTable.ticker, date: priceHistoryTable.date, close: priceHistoryTable.close })
      .from(priceHistoryTable)
      .where(
        and(
          inArray(priceHistoryTable.ticker, tickers),
          gte(priceHistoryTable.date, cutoff),
          lte(priceHistoryTable.date, date)
        )
      )
      .orderBy(priceHistoryTable.ticker, desc(priceHistoryTable.date));

    const seen = new Set<string>();
    for (const r of rows) {
      if (!seen.has(r.ticker) && r.close != null) {
        result[r.ticker] = r.close;
        seen.add(r.ticker);
      }
    }
    return result;
  }

  /** Run a backtest over a date range with periodic rebalancing. */
  async runBacktest(config: BacktestConfig): Promise<PortfolioResult[]> {
    const results: PortfolioResult[] = [];
    let portfolioValue = 1;

    let currentDate = new Date(config.startDate);
    const endDate   = new Date(config.endDate);

    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);
      const nextDate = addDays(currentDate, config.rebalanceDays);
      const nextStr  = formatDate(nextDate);

      const portfolio = await this.buildPortfolio(
        dateStr,
        config.strategy,
        config.portfolioSize,
        config.weightMethod,
        config.sectorCap ?? 2
      );

      if (portfolio.length > 0) {
        const tickers      = portfolio.map((p) => p.ticker);
        const pricesNow    = await this.batchGetPrices(tickers, dateStr);
        const pricesNext   = await this.batchGetPrices(tickers, nextStr);

        let periodReturn = 0;
        for (const p of portfolio) {
          const pNow  = pricesNow[p.ticker]  ?? 0;
          const pNext = pricesNext[p.ticker] ?? 0;
          if (pNow > 0 && pNext > 0) {
            periodReturn += ((pNext - pNow) / pNow) * p.weight;
          }
        }
        portfolioValue *= 1 + periodReturn;
      }

      results.push({ date: dateStr, value: +portfolioValue.toFixed(6) });
      currentDate = nextDate;
    }

    return results;
  }
}
