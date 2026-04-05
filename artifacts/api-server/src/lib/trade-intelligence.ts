/**
 * Trade Intelligence & Learning Engine
 *
 * Provides:
 *  - Scenario comparison (pre-trade) — 3 DTE or 3 premium-level configs
 *  - Daily trade P&L snapshot writer — mark-to-market using Yahoo Finance mid-prices
 *  - Signal quality stats updater — win/loss/assignment aggregate per (ticker, strategy, regime)
 *  - Trade story builder — daily snapshots + theta decay overlay + what-if projections
 */

import YahooFinanceClass from "yahoo-finance2";
import { db } from "@workspace/db";
import {
  optionsTradesTable,
  optionsTradeSnapshotsTable,
  signalQualityStatsTable,
  companiesTable,
  priceHistoryTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

// yahoo-finance2 has a named default export
const yf = (YahooFinanceClass as unknown as { default: typeof YahooFinanceClass }).default ?? YahooFinanceClass;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioPoint {
  day: number;        // day from opening (0 = open, DTE = expiry)
  pnl: number;        // cumulative P&L per contract (positive = profit)
  theoretical: number;
}

export interface Scenario {
  label: string;
  dte: number;
  strike: number;
  premium: number;        // per share (option mid-price)
  premiumPerContract: number;
  annualizedROC: number;
  capitalRequired: number;
  probabilityProfit: number | null;
  iv: number | null;
  delta: number | null;
  curve: ScenarioPoint[]; // theta decay curve — one point per day
  color: string;          // chart colour for this scenario line
}

export interface ScenariosResult {
  ticker: string;
  currentPrice: number;
  compareBy: "dte" | "premium";
  scenarios: Scenario[];
}

export interface StoryPoint {
  date: string;
  daysElapsed: number;
  markPnl: number | null;
  theoreticalPnl: number;
}

export interface WhatIfPath {
  label: string;
  points: { day: number; pnl: number }[];
  finalPnl: number;
  description: string;
}

export interface TradeStoryResult {
  tradeId: number;
  ticker: string;
  strike: number;
  expiry: string;
  right: string;
  premiumCollected: number;
  openedAt: string;
  closedAt: string | null;
  status: string;
  realisedPnl: number | null;
  initialDte: number;
  snapshots: StoryPoint[];
  whatIf: WhatIfPath[] | null;  // only for closed trades
}

// ─── Theta decay model ───────────────────────────────────────────────────────
// Simplified square-root-of-time decay model:
//   remaining_value(t) = premium × sqrt(remaining_dte / initial_dte)
// where t = elapsed days, remaining_dte = initial_dte - t.
// P&L at day t = premium - remaining_value(t)  (positive = profit for seller)

function theoreticalPnlAtDay(premium: number, initialDte: number, elapsedDays: number): number {
  const remainingDte = Math.max(0, initialDte - elapsedDays);
  const remainingValue = premium * Math.sqrt(remainingDte / initialDte);
  return premium - remainingValue;
}

function buildDecayCurve(premium: number, dte: number): ScenarioPoint[] {
  const points: ScenarioPoint[] = [];
  for (let day = 0; day <= dte; day++) {
    const theoretical = theoreticalPnlAtDay(premium, dte, day);
    points.push({ day, pnl: theoretical, theoretical });
  }
  return points;
}

// ─── Current price helper ────────────────────────────────────────────────────

interface YfQuoteResult {
  regularMarketPrice?: number;
}

async function getCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const quote = await yf.quote(ticker) as YfQuoteResult;
    const price = quote?.regularMarketPrice ?? null;
    if (price) return price;
  } catch { /* fall back to DB */ }

  const row = await db
    .select({ close: priceHistoryTable.close })
    .from(priceHistoryTable)
    .where(eq(priceHistoryTable.ticker, ticker))
    .orderBy(desc(priceHistoryTable.date))
    .limit(1);
  return row[0]?.close ?? null;
}

// ─── Scenario Comparison ──────────────────────────────────────────────────────

async function fetchOptionForScenario(
  ticker: string,
  targetDte: number,
  currentPrice: number,
  side: "put" | "call",
): Promise<{ strike: number; premium: number; iv: number | null; delta: number | null; oi: number | null } | null> {
  try {
    const today = new Date();
    const minDate = new Date(today.getTime() + (targetDte - 4) * 86400000);
    const maxDate = new Date(today.getTime() + (targetDte + 4) * 86400000);

    const chain = await yf.options(ticker, {}, { validateResult: false });
    if (!chain?.expirationDates?.length) return null;

    const expiries = (chain.expirationDates as Date[]).filter(
      (d) => d >= minDate && d <= maxDate,
    );
    const targetExpiry = expiries[0] ?? (chain.expirationDates as Date[]).find((d) => d >= minDate);
    if (!targetExpiry) return null;

    const expiryChain = await yf.options(ticker, { date: targetExpiry }, { validateResult: false });
    const contracts: any[] = side === "put"
      ? (expiryChain?.options?.[0]?.puts ?? [])
      : (expiryChain?.options?.[0]?.calls ?? []);

    // Find first OTM contract (put: strike < price, call: strike > price)
    const otm = side === "put"
      ? contracts.filter((c) => c.strike < currentPrice).sort((a, b) => b.strike - a.strike)
      : contracts.filter((c) => c.strike > currentPrice).sort((a, b) => a.strike - b.strike);

    if (!otm.length) return null;
    const c = otm[0];
    const bid = c.bid ?? 0;
    const ask = c.ask ?? 0;
    const mid = (bid + ask) / 2;
    if (mid <= 0) return null;

    return {
      strike: c.strike,
      premium: mid,
      iv: c.impliedVolatility != null ? Math.round(c.impliedVolatility * 100) : null,
      delta: c.delta ?? null,
      oi: c.openInterest ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchOptionForPremium(
  ticker: string,
  targetPremium: number,
  currentPrice: number,
  side: "put" | "call",
): Promise<{ strike: number; premium: number; dte: number; iv: number | null; delta: number | null } | null> {
  try {
    const chain = await yf.options(ticker, {}, { validateResult: false });
    if (!chain?.expirationDates?.length) return null;

    // Find expiry ~30 DTE (gives enough range of strikes)
    const today = new Date();
    const target30 = new Date(today.getTime() + 26 * 86400000);
    const expiry = (chain.expirationDates as Date[]).find((d) => d >= target30) ?? chain.expirationDates[0];

    const expiryChain = await yf.options(ticker, { date: expiry }, { validateResult: false });
    const contracts: any[] = side === "put"
      ? (expiryChain?.options?.[0]?.puts ?? [])
      : (expiryChain?.options?.[0]?.calls ?? []);

    const dte = Math.round(((expiry as Date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Find the contract whose mid is closest to targetPremium
    const withMid = contracts
      .map((c) => ({
        strike: c.strike,
        mid: ((c.bid ?? 0) + (c.ask ?? 0)) / 2,
        iv: c.impliedVolatility != null ? Math.round(c.impliedVolatility * 100) : null,
        delta: c.delta ?? null,
      }))
      .filter((c) => c.mid > 0);

    if (!withMid.length) return null;

    const closest = withMid.reduce((best, c) =>
      Math.abs(c.mid - targetPremium) < Math.abs(best.mid - targetPremium) ? c : best,
    );

    return { strike: closest.strike, premium: closest.mid, dte, iv: closest.iv, delta: closest.delta };
  } catch {
    return null;
  }
}

const SCENARIO_COLOURS = ["#f59e0b", "#3b82f6", "#8b5cf6"]; // amber, blue, violet

export async function buildScenariosResult(
  ticker: string,
  compareBy: "dte" | "premium",
  side: "put" | "call" = "put",
): Promise<ScenariosResult | null> {
  const currentPrice = await getCurrentPrice(ticker.toUpperCase());
  if (!currentPrice) return null;

  let scenarios: Scenario[] = [];

  if (compareBy === "dte") {
    const targets = [7, 15, 30];
    const results = await Promise.all(
      targets.map((dte) => fetchOptionForScenario(ticker.toUpperCase(), dte, currentPrice, side)),
    );

    scenarios = results
      .map((r, i) => {
        if (!r) return null;
        const dte = targets[i];
        const premium = r.premium;
        const premiumPerContract = premium * 100;
        const capitalRequired = side === "put" ? r.strike * 100 : currentPrice * 100;
        const annualizedROC = capitalRequired > 0
          ? Math.round(((premiumPerContract / capitalRequired) * (365 / dte)) * 10000) / 100
          : 0;
        const probabilityProfit = r.delta != null ? Math.round((1 - Math.abs(r.delta)) * 100) : null;

        return {
          label: `${dte} DTE`,
          dte,
          strike: r.strike,
          premium,
          premiumPerContract,
          annualizedROC,
          capitalRequired,
          probabilityProfit,
          iv: r.iv,
          delta: r.delta,
          curve: buildDecayCurve(premiumPerContract, dte),
          color: SCENARIO_COLOURS[i],
        } satisfies Scenario;
      })
      .filter((s): s is Scenario => s !== null);
  } else {
    // compareBy=premium: 3 target premiums (approximately $3 / $4.50 / $6 per share)
    const targetPremiums = [3, 4.5, 6];
    const results = await Promise.all(
      targetPremiums.map((p) => fetchOptionForPremium(ticker.toUpperCase(), p, currentPrice, side)),
    );

    scenarios = results
      .map((r, i) => {
        if (!r) return null;
        const premium = r.premium;
        const premiumPerContract = premium * 100;
        const capitalRequired = side === "put" ? r.strike * 100 : currentPrice * 100;
        const annualizedROC = capitalRequired > 0 && r.dte > 0
          ? Math.round(((premiumPerContract / capitalRequired) * (365 / r.dte)) * 10000) / 100
          : 0;
        const probabilityProfit = r.delta != null ? Math.round((1 - Math.abs(r.delta)) * 100) : null;

        return {
          label: `~$${targetPremiums[i]}/sh`,
          dte: r.dte,
          strike: r.strike,
          premium,
          premiumPerContract,
          annualizedROC,
          capitalRequired,
          probabilityProfit,
          iv: r.iv,
          delta: r.delta,
          curve: buildDecayCurve(premiumPerContract, r.dte),
          color: SCENARIO_COLOURS[i],
        } satisfies Scenario;
      })
      .filter((s): s is Scenario => s !== null);
  }

  if (!scenarios.length) return null;

  return { ticker: ticker.toUpperCase(), currentPrice, compareBy, scenarios };
}

// ─── Trade Story ──────────────────────────────────────────────────────────────

export async function buildTradeStory(tradeId: number, userId: number): Promise<TradeStoryResult | null> {
  const trades = await db
    .select()
    .from(optionsTradesTable)
    .where(and(eq(optionsTradesTable.id, tradeId), eq(optionsTradesTable.userId, userId)))
    .limit(1);

  if (!trades.length) return null;
  const trade = trades[0];

  const premium = trade.premiumCollected ?? 0;
  const openedAt = trade.openedAt;
  const closedAt = trade.closedAt;
  const totalDays = closedAt
    ? Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 86400000)
    : Math.round((Date.now() - new Date(openedAt).getTime()) / 86400000);

  // Calculate initial DTE from openedAt → expiry
  const initialDte = Math.max(1, Math.round(
    (new Date(trade.expiry + "T16:00:00").getTime() - new Date(openedAt).getTime()) / 86400000,
  ));

  // Load DB snapshots
  const rawSnapshots = await db
    .select()
    .from(optionsTradeSnapshotsTable)
    .where(eq(optionsTradeSnapshotsTable.tradeId, tradeId))
    .orderBy(optionsTradeSnapshotsTable.date);

  // Build unified story points — pad with theoretical if no snapshots yet
  const snapshotMap = new Map(rawSnapshots.map((s) => [s.date, s]));
  const storyPoints: StoryPoint[] = [];
  const daysToShow = Math.max(totalDays, 1);

  for (let d = 0; d <= daysToShow; d++) {
    const date = new Date(new Date(openedAt).getTime() + d * 86400000).toISOString().split("T")[0];
    const snap = snapshotMap.get(date);
    const theoretical = theoreticalPnlAtDay(premium, initialDte, d);
    storyPoints.push({
      date,
      daysElapsed: d,
      markPnl: snap?.markPnl ?? null,
      theoreticalPnl: Math.round(theoretical * 100) / 100,
    });
  }

  // What-if projections (only for closed trades)
  let whatIf: WhatIfPath[] | null = null;
  if (trade.status === "closed" || trade.status === "assigned") {
    const actualDaysHeld = totalDays;

    // Path 1: Held to expiry
    const heldToExpiry: { day: number; pnl: number }[] = [];
    for (let d = 0; d <= initialDte; d++) {
      heldToExpiry.push({ day: d, pnl: Math.round(theoreticalPnlAtDay(premium, initialDte, d) * 100) / 100 });
    }

    // Path 2: Closed at 25% profit
    const target25 = premium * 0.25;
    const dayAt25 = Math.round(initialDte * (1 - (target25 / premium) ** 2));
    const closed25: { day: number; pnl: number }[] = [];
    for (let d = 0; d <= dayAt25; d++) {
      closed25.push({ day: d, pnl: Math.round(theoreticalPnlAtDay(premium, initialDte, d) * 100) / 100 });
    }
    closed25.push({ day: dayAt25, pnl: target25 }); // flat after close

    // Path 3: Rolled at 21 DTE
    const rollDay = Math.max(0, initialDte - 21);
    const rollPremiumAtRoll = theoreticalPnlAtDay(premium, initialDte, rollDay);
    const rolledPath: { day: number; pnl: number }[] = [];
    for (let d = 0; d <= rollDay; d++) {
      rolledPath.push({ day: d, pnl: Math.round(theoreticalPnlAtDay(premium, initialDte, d) * 100) / 100 });
    }
    // After roll, continue earning ~80% of the remaining premium (rough estimate)
    const extraPremium = premium * 0.8;
    for (let d = rollDay; d <= rollDay + 30; d++) {
      const extraDecay = theoreticalPnlAtDay(extraPremium, 30, d - rollDay);
      rolledPath.push({ day: d, pnl: Math.round((rollPremiumAtRoll + extraDecay) * 100) / 100 });
    }

    whatIf = [
      {
        label: "Held to expiry",
        points: heldToExpiry,
        finalPnl: premium,
        description: `Full premium kept ($${premium.toFixed(0)}) but maximum time exposure`,
      },
      {
        label: "Closed at 25%",
        points: closed25,
        finalPnl: target25,
        description: `$${target25.toFixed(0)} profit at day ${dayAt25} — quick exit, frees up capital fastest`,
      },
      {
        label: "Rolled at 21 DTE",
        points: rolledPath,
        finalPnl: Math.round((rollPremiumAtRoll + extraPremium) * 100) / 100,
        description: `Capture remaining + extend theta for extra income`,
      },
    ];
  }

  return {
    tradeId,
    ticker: trade.ticker,
    strike: trade.strike,
    expiry: trade.expiry,
    right: trade.right,
    premiumCollected: premium,
    openedAt: trade.openedAt.toISOString(),
    closedAt: trade.closedAt?.toISOString() ?? null,
    status: trade.status,
    realisedPnl: trade.realisedPnl ?? null,
    initialDte,
    snapshots: storyPoints,
    whatIf,
  };
}

// ─── Daily P&L Snapshot Cron ──────────────────────────────────────────────────

export async function takeDailyTradeSnapshots(): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[TradeIntelligence] Taking daily P&L snapshots for ${today}`);

  try {
    const openTrades = await db
      .select()
      .from(optionsTradesTable)
      .where(eq(optionsTradesTable.status, "open"));

    if (!openTrades.length) {
      console.log("[TradeIntelligence] No open trades to snapshot");
      return;
    }

    let snapped = 0;
    const BATCH = 3;

    for (let i = 0; i < openTrades.length; i += BATCH) {
      const batch = openTrades.slice(i, i + BATCH);

      await Promise.all(batch.map(async (trade) => {
        try {
          const openedAt = new Date(trade.openedAt);
          const daysElapsed = Math.round((Date.now() - openedAt.getTime()) / 86400000);
          const initialDte = Math.max(1, Math.round(
            (new Date(trade.expiry + "T16:00:00").getTime() - openedAt.getTime()) / 86400000,
          ));
          const dteRemaining = Math.max(0, Math.round(
            (new Date(trade.expiry + "T16:00:00").getTime() - Date.now()) / 86400000,
          ));

          const premium = trade.premiumCollected ?? 0;

          // Try to fetch current mid price
          let midPrice: number | null = null;
          try {
            const optionChain = await yf.options(trade.ticker, {}, { validateResult: false });
            const expiryDate = (optionChain.expirationDates as Date[]).find((d) => {
              return Math.abs(d.getTime() - new Date(trade.expiry + "T00:00:00").getTime()) < 7 * 86400000;
            });

            if (expiryDate) {
              const expiryChain = await yf.options(trade.ticker, { date: expiryDate }, { validateResult: false });
              const isPut = trade.right === "PUT" || trade.right === "P";
              const contracts: Record<string, unknown>[] = isPut
                ? (expiryChain?.options?.[0]?.puts ?? [])
                : (expiryChain?.options?.[0]?.calls ?? []);

              const matching = contracts.find((c) => Math.abs((c.strike as number) - trade.strike) < 0.5);
              if (matching) {
                const bid = (matching.bid as number | null) ?? 0;
                const ask = (matching.ask as number | null) ?? 0;
                midPrice = (bid + ask) / 2;
              }
            }
          } catch { /* leave midPrice null */ }

          const markPnl = midPrice != null ? (premium - midPrice * 100) : null;
          const theoreticalPnl = theoreticalPnlAtDay(premium, initialDte, daysElapsed);

          await db
            .insert(optionsTradeSnapshotsTable)
            .values({
              tradeId: trade.id,
              date: today,
              midPrice,
              markPnl,
              theoreticalPnl: Math.round(theoreticalPnl * 100) / 100,
              daysElapsed,
              dteRemaining,
            })
            .onConflictDoNothing();

          snapped++;
        } catch (err) {
          console.warn(`[TradeIntelligence] Snapshot failed for trade ${trade.id}:`, (err as Error).message);
        }
      }));

      // Throttle between batches
      if (i + BATCH < openTrades.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    console.log(`[TradeIntelligence] Snapped ${snapped}/${openTrades.length} trades`);
  } catch (err) {
    console.error("[TradeIntelligence] Daily snapshot job failed:", err);
  }
}

// ─── Signal Quality Stats Updater ────────────────────────────────────────────

export async function updateSignalQualityStats(): Promise<void> {
  console.log("[TradeIntelligence] Updating signal quality stats...");

  try {
    // Get all closed trades with ticker/strategy/regime info
    const closedTrades = await db
      .select()
      .from(optionsTradesTable)
      .where(inArray(optionsTradesTable.status, ["closed", "assigned", "expired"]));

    if (!closedTrades.length) {
      console.log("[TradeIntelligence] No closed trades to compute stats from");
      return;
    }

    // Group by (ticker, strategy, regime)
    type Key = string;
    const groups = new Map<Key, typeof closedTrades>();

    for (const trade of closedTrades) {
      const strategy = trade.strategy ?? "SELL_PUT";
      const regime = trade.regime ?? "UNKNOWN";
      const key: Key = `${trade.ticker}|${strategy}|${regime}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(trade);
    }

    let updated = 0;
    for (const [key, trades] of groups) {
      const [ticker, strategy, regime] = key.split("|");

      const totalTrades = trades.length;
      const wins = trades.filter((t) => (t.realisedPnl ?? 0) > 0 && !t.isAssigned).length;
      const losses = trades.filter((t) => (t.realisedPnl ?? 0) < 0 && !t.isAssigned).length;
      const assignments = trades.filter((t) => t.isAssigned).length;

      const profitPcts = trades
        .filter((t) => t.premiumCollected && t.premiumCollected > 0 && t.realisedPnl != null)
        .map((t) => ((t.realisedPnl! / t.premiumCollected!) * 100));

      const avgProfitPct = profitPcts.length
        ? profitPcts.reduce((a, b) => a + b, 0) / profitPcts.length
        : null;

      const daysHeld = trades
        .filter((t) => t.closedAt)
        .map((t) => Math.round((new Date(t.closedAt!).getTime() - new Date(t.openedAt).getTime()) / 86400000));

      const avgDaysHeld = daysHeld.length
        ? daysHeld.reduce((a, b) => a + b, 0) / daysHeld.length
        : null;

      const closedCount = wins + losses;
      const winRate = closedCount > 0 ? wins / closedCount : null;
      const assignmentRate = totalTrades > 0 ? assignments / totalTrades : null;

      // Upsert to signal_quality_stats
      const existing = await db
        .select({ id: signalQualityStatsTable.id })
        .from(signalQualityStatsTable)
        .where(and(
          eq(signalQualityStatsTable.ticker, ticker),
          eq(signalQualityStatsTable.strategy, strategy),
          eq(signalQualityStatsTable.regime, regime),
        ))
        .limit(1);

      if (existing.length) {
        await db
          .update(signalQualityStatsTable)
          .set({ totalTrades, wins, losses, assignments, avgProfitPct, avgDaysHeld, winRate, assignmentRate, updatedAt: new Date() })
          .where(eq(signalQualityStatsTable.id, existing[0].id));
      } else {
        // Check if ticker exists in companies table to satisfy FK
        const company = await db
          .select({ ticker: companiesTable.ticker })
          .from(companiesTable)
          .where(eq(companiesTable.ticker, ticker))
          .limit(1);

        if (company.length) {
          await db
            .insert(signalQualityStatsTable)
            .values({ ticker, strategy, regime, totalTrades, wins, losses, assignments, avgProfitPct, avgDaysHeld, winRate, assignmentRate });
        }
      }

      updated++;
    }

    console.log(`[TradeIntelligence] Signal quality stats updated for ${updated} ticker/strategy/regime groups`);
  } catch (err) {
    console.error("[TradeIntelligence] Signal quality stats update failed:", err);
  }
}

// ─── Track Record Query ───────────────────────────────────────────────────────

export async function getTrackRecord(
  ticker: string,
  strategy?: string,
): Promise<{ wins: number; losses: number; assignments: number; winRate: number | null; avgProfitPct: number | null; assignmentRate: number | null } | null> {
  const conditions = [eq(signalQualityStatsTable.ticker, ticker.toUpperCase())];
  if (strategy) conditions.push(eq(signalQualityStatsTable.strategy, strategy));

  const rows = await db
    .select()
    .from(signalQualityStatsTable)
    .where(and(...conditions));

  if (!rows.length) return null;

  // Aggregate across all regimes
  const wins = rows.reduce((s, r) => s + r.wins, 0);
  const losses = rows.reduce((s, r) => s + r.losses, 0);
  const assignments = rows.reduce((s, r) => s + r.assignments, 0);
  const total = wins + losses;
  const winRate = total > 0 ? wins / total : null;
  const avgProfitPct = rows
    .filter((r) => r.avgProfitPct != null)
    .reduce((sum, r, _, arr) => sum + (r.avgProfitPct! / arr.length), 0);
  const assignmentRate = rows.reduce((s, r) => s + (r.totalTrades ?? 0), 0) > 0
    ? assignments / rows.reduce((s, r) => s + (r.totalTrades ?? 0), 0)
    : null;

  return {
    wins, losses, assignments,
    winRate,
    avgProfitPct: avgProfitPct || null,
    assignmentRate,
  };
}
