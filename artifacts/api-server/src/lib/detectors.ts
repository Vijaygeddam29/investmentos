import { db } from "@workspace/db";
import {
  financialMetricsTable,
  scoresTable,
  driftSignalsTable,
  opportunityAlertsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

function pctChange(current: number | null, historical: number | null): number | null {
  if (current == null || historical == null || historical === 0) return null;
  return (current - historical) / Math.abs(historical);
}

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
    "netDebtEbitda", "fcfYield", "revenueGrowth1y",
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

  const today = new Date().toISOString().split("T")[0];

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

  if (latest.receivablesGrowthVsRevenue != null && latest.receivablesGrowthVsRevenue > 0.1) {
    signals.push({
      signalType: "risk",
      description: "Receivables growing faster than revenue — possible channel stuffing",
      severity: "high",
      factorName: "Receivables vs Revenue",
      currentValue: latest.receivablesGrowthVsRevenue,
      historicalAvg: 0,
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

  await db.delete(driftSignalsTable).where(eq(driftSignalsTable.ticker, ticker));

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
  const scores = await db.select().from(scoresTable)
    .where(eq(scoresTable.ticker, ticker))
    .orderBy(desc(scoresTable.date))
    .limit(1);

  if (!scores.length) return [];

  const latest = scores[0];
  const today = new Date().toISOString().split("T")[0];
  const alerts: Array<{
    alertType: string;
    engineType: string;
    score: number | null;
    description: string;
  }> = [];

  if (latest.fortressScore != null && latest.fortressScore > 0.7) {
    alerts.push({
      alertType: "threshold_crossed",
      engineType: "fortress",
      score: latest.fortressScore,
      description: `Fortress score ${latest.fortressScore.toFixed(2)} — qualifies as long-term compounder`,
    });
  }

  if (latest.rocketScore != null && latest.rocketScore > 0.65) {
    alerts.push({
      alertType: "threshold_crossed",
      engineType: "rocket",
      score: latest.rocketScore,
      description: `Rocket score ${latest.rocketScore.toFixed(2)} — high-growth innovator detected`,
    });
  }

  if (latest.waveScore != null && latest.waveScore > 0.6) {
    alerts.push({
      alertType: "threshold_crossed",
      engineType: "wave",
      score: latest.waveScore,
      description: `Wave score ${latest.waveScore.toFixed(2)} — momentum trade opportunity`,
    });
  }

  await db.delete(opportunityAlertsTable).where(eq(opportunityAlertsTable.ticker, ticker));

  for (const alert of alerts) {
    await db.insert(opportunityAlertsTable).values({
      ticker,
      date: today,
      ...alert,
    });
  }

  return alerts;
}
