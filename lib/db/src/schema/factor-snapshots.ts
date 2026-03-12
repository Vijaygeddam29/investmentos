/**
 * Factor Warehouse — daily pre-computed snapshot per ticker.
 *
 * Heavy compute runs once per pipeline run. Dashboards and screeners read
 * from this table directly — no live factor computation at query time.
 *
 * Pattern used by Bridgewater, Two Sigma, Renaissance etc.:
 *   nightly pipeline → factor_snapshots → instant UI reads
 */
import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const factorSnapshotsTable = pgTable("factor_snapshots", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(), // YYYY-MM-DD snapshot date (upserted per-run)

  // ── Strategy engine scores ─────────────────────────────────────────────
  fortressScore: real("fortress_score"),
  rocketScore: real("rocket_score"),
  waveScore: real("wave_score"),
  entryScore: real("entry_score"),

  // ── Factor family scores ───────────────────────────────────────────────
  profitabilityScore: real("profitability_score"),
  growthScore: real("growth_score"),
  capitalEfficiencyScore: real("capital_efficiency_score"),
  financialStrengthScore: real("financial_strength_score"),
  cashFlowQualityScore: real("cash_flow_quality_score"),
  momentumScore: real("momentum_score"),
  valuationScore: real("valuation_score"),
  sentimentScore: real("sentiment_score"),

  // ── Key technical indicators (denormalized for fast screener queries) ──
  rsi: real("rsi"),
  macdHistogram: real("macd_histogram"),
  ret3m: real("ret3m"),
  marginOfSafety: real("margin_of_safety"),
  marketCap: real("market_cap"),

  // ── Score deltas vs previous snapshot (powers Top Movers) ─────────────
  fortressDelta: real("fortress_delta"),
  rocketDelta: real("rocket_delta"),
  waveDelta: real("wave_delta"),
  entryDelta: real("entry_delta"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FactorSnapshot = typeof factorSnapshotsTable.$inferSelect;
