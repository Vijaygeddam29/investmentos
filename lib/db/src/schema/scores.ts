import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const scoresTable = pgTable("scores", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),

  fortressScore: real("fortress_score"),
  rocketScore: real("rocket_score"),
  waveScore: real("wave_score"),

  profitabilityScore: real("profitability_score"),
  growthScore: real("growth_score"),
  capitalEfficiencyScore: real("capital_efficiency_score"),
  financialStrengthScore: real("financial_strength_score"),
  cashFlowQualityScore: real("cash_flow_quality_score"),
  innovationScore: real("innovation_score"),
  momentumScore: real("momentum_score"),
  valuationScore: real("valuation_score"),
  sentimentScore: real("sentiment_score"),

  // Entry Timing Score (Gap 15): valuation + momentum + earnings revision signal
  entryTimingScore: real("entry_timing_score"),

  // Compounder Score: 0–100 derived metric identifying compounding business characteristics
  compounderScore: real("compounder_score"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Score = typeof scoresTable.$inferSelect;
