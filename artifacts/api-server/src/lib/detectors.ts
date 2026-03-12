import { db } from "@workspace/db";
import {
  financialMetricsTable,
  scoresTable,
  driftSignalsTable,
  opportunityAlertsTable,
  riskAlertsTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function detectDrift(ticker: string) {
  const metrics = await db.select().from(financialMetricsTable)
    .where(eq(financialMetricsTable.ticker, ticker))
    .orderBy(desc(financialMetricsTable.date))
    .limit(5);

  if (metrics.length < 2) return [];

  const latest = metrics[0];
  const historicalAvgs: Record<string, number> = {};
  const fields = [
    "roic", "grossMargin", "operatingMargin", "debtToEquity",
    "netDebtEbitda", "fcfYield", "revenueGrowth1y", "currentRatio",
    "interestCoverage", "fcfToNetIncome",
  ] as const;

  for (const field of fields) {
    const vals = metrics.slice(1).map(m => (m as any)[field]).filter((v: any) => v != null);
    if (vals.length) historicalAvgs[field] = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  }

  const signals: Array<{
    signalType: string;
    description: string;
    severity: string;
    factorName: string;
    currentValue: number | null;
    historicalAvg: number | null;
  }> = [];

  if (latest.roic != null && historicalAvgs.roic && latest.roic < historicalAvgs.roic * 0.8) {
    signals.push({
      signalType: "drift",
      description: `ROIC deterioration: ${(latest.roic * 100).toFixed(1)}% vs historical avg ${(historicalAvgs.roic * 100).toFixed(1)}%`,
      severity: latest.roic < historicalAvgs.roic * 0.6 ? "high" : "medium",
      factorName: "ROIC",
      currentValue: latest.roic,
      historicalAvg: historicalAvgs.roic,
    });
  }

  if (latest.debtToEquity != null && historicalAvgs.debtToEquity && latest.debtToEquity > historicalAvgs.debtToEquity * 1.5) {
    signals.push({
      signalType: "drift",
      description: `Debt rising: D/E ratio ${latest.debtToEquity.toFixed(2)} vs historical avg ${historicalAvgs.debtToEquity.toFixed(2)}`,
      severity: latest.debtToEquity > historicalAvgs.debtToEquity * 2 ? "high" : "medium",
      factorName: "Debt/Equity",
      currentValue: latest.debtToEquity,
      historicalAvg: historicalAvgs.debtToEquity,
    });
  }

  if (latest.operatingMargin != null && historicalAvgs.operatingMargin && latest.operatingMargin < historicalAvgs.operatingMargin * 0.8) {
    signals.push({
      signalType: "drift",
      description: `Margin compression: Operating margin ${(latest.operatingMargin * 100).toFixed(1)}% vs historical avg ${(historicalAvgs.operatingMargin * 100).toFixed(1)}%`,
      severity: "medium",
      factorName: "Operating Margin",
      currentValue: latest.operatingMargin,
      historicalAvg: historicalAvgs.operatingMargin,
    });
  }

  if (latest.grossMargin != null && historicalAvgs.grossMargin && latest.grossMargin < historicalAvgs.grossMargin * 0.9) {
    signals.push({
      signalType: "drift",
      description: `Gross margin decline: ${(latest.grossMargin * 100).toFixed(1)}% vs historical avg ${(historicalAvgs.grossMargin * 100).toFixed(1)}%`,
      severity: "medium",
      factorName: "Gross Margin",
      currentValue: latest.grossMargin,
      historicalAvg: historicalAvgs.grossMargin,
    });
  }

  if (latest.fcfYield != null && historicalAvgs.fcfYield && latest.fcfYield < historicalAvgs.fcfYield * 0.5) {
    signals.push({
      signalType: "drift",
      description: `FCF yield decline: ${(latest.fcfYield * 100).toFixed(1)}% vs historical avg ${(historicalAvgs.fcfYield * 100).toFixed(1)}%`,
      severity: "medium",
      factorName: "FCF Yield",
      currentValue: latest.fcfYield,
      historicalAvg: historicalAvgs.fcfYield,
    });
  }

  if (latest.interestCoverage != null && historicalAvgs.interestCoverage && latest.interestCoverage < historicalAvgs.interestCoverage * 0.6) {
    signals.push({
      signalType: "drift",
      description: `Interest coverage declining: ${latest.interestCoverage.toFixed(1)}x vs historical avg ${historicalAvgs.interestCoverage.toFixed(1)}x`,
      severity: latest.interestCoverage < 3 ? "high" : "medium",
      factorName: "Interest Coverage",
      currentValue: latest.interestCoverage,
      historicalAvg: historicalAvgs.interestCoverage,
    });
  }

  if (latest.currentRatio != null && latest.currentRatio < 1.0) {
    signals.push({
      signalType: "risk",
      description: `Current ratio below 1.0 (${latest.currentRatio.toFixed(2)}) — short-term liquidity concern`,
      severity: latest.currentRatio < 0.7 ? "high" : "medium",
      factorName: "Current Ratio",
      currentValue: latest.currentRatio,
      historicalAvg: historicalAvgs.currentRatio ?? null,
    });
  }

  if (latest.receivablesGrowthVsRevenue != null && latest.receivablesGrowthVsRevenue > 0.1) {
    signals.push({
      signalType: "risk",
      description: `Receivables growing faster than revenue by ${(latest.receivablesGrowthVsRevenue * 100).toFixed(1)}pp — possible channel stuffing`,
      severity: latest.receivablesGrowthVsRevenue > 0.2 ? "high" : "medium",
      factorName: "Receivables vs Revenue",
      currentValue: latest.receivablesGrowthVsRevenue,
      historicalAvg: 0,
    });
  }

  if (latest.inventoryGrowthVsRevenue != null && latest.inventoryGrowthVsRevenue > 0.15) {
    signals.push({
      signalType: "risk",
      description: `Inventory building faster than revenue by ${(latest.inventoryGrowthVsRevenue * 100).toFixed(1)}pp — demand risk`,
      severity: latest.inventoryGrowthVsRevenue > 0.3 ? "high" : "medium",
      factorName: "Inventory vs Revenue",
      currentValue: latest.inventoryGrowthVsRevenue,
      historicalAvg: 0,
    });
  }

  if (latest.altmanZScore != null && latest.altmanZScore < 1.8) {
    signals.push({
      signalType: "risk",
      description: `Altman Z-Score ${latest.altmanZScore.toFixed(2)} in distress zone (<1.8) — bankruptcy risk`,
      severity: "high",
      factorName: "Altman Z-Score",
      currentValue: latest.altmanZScore,
      historicalAvg: null,
    });
  }

  if (latest.stockBasedCompPct != null && latest.stockBasedCompPct > 0.10) {
    signals.push({
      signalType: "risk",
      description: `SBC at ${(latest.stockBasedCompPct * 100).toFixed(1)}% of revenue — significant shareholder dilution`,
      severity: latest.stockBasedCompPct > 0.20 ? "high" : "medium",
      factorName: "SBC / Revenue",
      currentValue: latest.stockBasedCompPct,
      historicalAvg: null,
    });
  }

  if (latest.accrualRatio != null && latest.accrualRatio > 0.10) {
    signals.push({
      signalType: "risk",
      description: `High accrual ratio (${(latest.accrualRatio * 100).toFixed(1)}%) — earnings quality concern`,
      severity: latest.accrualRatio > 0.20 ? "high" : "medium",
      factorName: "Accrual Ratio",
      currentValue: latest.accrualRatio,
      historicalAvg: null,
    });
  }

  // Insider-selling drift: net insider activity skewed heavily toward selling
  // insiderBuying is a 0-1 ratio where 1 = all buys, 0 = all sells
  if (latest.insiderBuying != null && latest.insiderBuying <= 0.15) {
    // Aggravated signal if paired with deteriorating fundamentals
    const fundamentalsDeteriorating =
      (latest.roic != null && historicalAvgs.roic && latest.roic < historicalAvgs.roic * 0.85) ||
      (latest.operatingMargin != null && historicalAvgs.operatingMargin &&
        latest.operatingMargin < historicalAvgs.operatingMargin * 0.85);
    signals.push({
      signalType: "drift",
      description: `Heavy insider selling detected (buy ratio: ${(latest.insiderBuying * 100).toFixed(0)}%)${
        fundamentalsDeteriorating ? " — compounded by fundamental deterioration" : ""
      }`,
      severity: (latest.insiderBuying <= 0.05 || fundamentalsDeteriorating) ? "high" : "medium",
      factorName: "Insider Selling",
      currentValue: latest.insiderBuying,
      historicalAvg: null,
    });
  }

  const today = new Date().toISOString().split("T")[0];

  await db.delete(driftSignalsTable).where(
    and(eq(driftSignalsTable.ticker, ticker), eq(driftSignalsTable.date, today))
  );

  for (const signal of signals) {
    await db.insert(driftSignalsTable).values({
      ticker,
      date: today,
      ...signal,
    });
  }

  return signals;
}

export async function detectOpportunities(ticker: string) {
  const currentScores = await db.select().from(scoresTable)
    .where(eq(scoresTable.ticker, ticker))
    .orderBy(desc(scoresTable.date))
    .limit(2);

  if (!currentScores.length) return [];

  const latest = currentScores[0];
  const previous = currentScores.length > 1 ? currentScores[1] : null;
  const today = new Date().toISOString().split("T")[0];
  const alerts: Array<{
    alertType: string;
    engineType: string;
    score: number | null;
    description: string;
  }> = [];

  const thresholds = [
    { engine: "fortress", score: latest.fortressScore, prevScore: previous?.fortressScore, threshold: 0.7, label: "long-term compounder" },
    { engine: "rocket", score: latest.rocketScore, prevScore: previous?.rocketScore, threshold: 0.65, label: "high-growth innovator" },
    { engine: "wave", score: latest.waveScore, prevScore: previous?.waveScore, threshold: 0.6, label: "momentum opportunity" },
  ];

  for (const { engine, score, prevScore, threshold, label } of thresholds) {
    if (score == null || score <= threshold) continue;

    const isNewCross = prevScore == null || prevScore <= threshold;
    const alertType = isNewCross ? "new_threshold_cross" : "threshold_crossed";
    const prefix = isNewCross ? "NEW: " : "";

    alerts.push({
      alertType,
      engineType: engine,
      score,
      description: `${prefix}${engine.charAt(0).toUpperCase() + engine.slice(1)} score ${score.toFixed(2)} — ${label} detected`,
    });
  }

  await db.delete(opportunityAlertsTable).where(
    and(eq(opportunityAlertsTable.ticker, ticker), eq(opportunityAlertsTable.date, today))
  );

  for (const alert of alerts) {
    await db.insert(opportunityAlertsTable).values({
      ticker,
      date: today,
      ...alert,
    });
  }

  return alerts;
}

/**
 * detectRisks — aggregates all active drift/risk signals for a ticker and
 * writes a single risk_alert row when a company exhibits multiple concurrent
 * deterioration signals (≥ 2 total signals, or ≥ 1 high-severity signal).
 *
 * Risk level:
 *  - "critical": ≥ 2 high-severity signals (e.g. Altman Z + ROIC collapse)
 *  - "elevated": ≥ 2 signals of any severity
 */
export async function detectRisks(ticker: string) {
  const today = new Date().toISOString().split("T")[0];

  const todaySignals = await db.select().from(driftSignalsTable)
    .where(and(eq(driftSignalsTable.ticker, ticker), eq(driftSignalsTable.date, today)));

  const totalCount = todaySignals.length;
  const highCount = todaySignals.filter(s => s.severity === "high").length;

  // Delete existing risk_alert for today (so we re-evaluate on each pipeline run)
  await db.delete(riskAlertsTable).where(
    and(eq(riskAlertsTable.ticker, ticker), eq(riskAlertsTable.date, today))
  );

  if (totalCount < 2 && highCount < 1) return null;

  const riskLevel = highCount >= 2 ? "critical" : "elevated";
  const signalDescriptions = todaySignals.map(s => `[${s.severity.toUpperCase()}] ${s.factorName ?? s.signalType}: ${s.description}`);

  const description = riskLevel === "critical"
    ? `${ticker} has ${highCount} critical risk signals — immediate review warranted`
    : `${ticker} has ${totalCount} concurrent risk signals — elevated monitoring required`;

  const alert = {
    ticker,
    date: today,
    riskLevel,
    activeSignalCount: totalCount,
    highSeverityCount: highCount,
    description,
    signalSummary: JSON.stringify(signalDescriptions),
  };

  await db.insert(riskAlertsTable).values(alert);
  return alert;
}
