import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const driftSignalsTable = pgTable("drift_signals", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),
  signalType: text("signal_type").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(),
  factorName: text("factor_name"),
  currentValue: real("current_value"),
  historicalAvg: real("historical_avg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DriftSignal = typeof driftSignalsTable.$inferSelect;

export const opportunityAlertsTable = pgTable("opportunity_alerts", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),
  alertType: text("alert_type").notNull(),
  engineType: text("engine_type").notNull(),
  score: real("score"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OpportunityAlert = typeof opportunityAlertsTable.$inferSelect;
