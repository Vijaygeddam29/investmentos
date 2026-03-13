import { pgTable, serial, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const alertTypeEnum = pgEnum("alert_type", [
  "VERDICT_CHANGE",
  "SCORE_DROP",
  "SCORE_RISE",
  "COMPOUNDER_CHANGE",
]);

export const scoreAlertsTable = pgTable("score_alerts", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),
  alertType: alertTypeEnum("alert_type").notNull(),
  scoreFamily: text("score_family"),
  previousValue: real("previous_value"),
  currentValue: real("current_value"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScoreAlert = typeof scoreAlertsTable.$inferSelect;
