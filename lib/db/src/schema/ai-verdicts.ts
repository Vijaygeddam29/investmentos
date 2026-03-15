import { pgTable, serial, text, timestamp, real } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const aiVerdictsTable = pgTable("ai_verdicts", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),
  verdict: text("verdict").notNull(),
  classification: text("classification"),
  memo: text("memo").notNull(),
  narrativeJson: text("narrative_json"),
  dataConfidence: real("data_confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AiVerdict = typeof aiVerdictsTable.$inferSelect;
