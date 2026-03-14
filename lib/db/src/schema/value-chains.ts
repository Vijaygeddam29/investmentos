import { pgTable, serial, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const companyValueChainsTable = pgTable("company_value_chains", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  content: jsonb("content"),
}, (table) => [
  unique("company_value_chains_ticker_unique").on(table.ticker),
]);

export type CompanyValueChain = typeof companyValueChainsTable.$inferSelect;
