import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const priceHistoryTable = pgTable("price_history", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),
  open: real("open"),
  high: real("high"),
  low: real("low"),
  close: real("close"),
  volume: real("volume"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PriceHistory = typeof priceHistoryTable.$inferSelect;
