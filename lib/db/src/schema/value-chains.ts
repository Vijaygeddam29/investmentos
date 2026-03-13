import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const companyValueChainsTable = pgTable("company_value_chains", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  supplyChain: text("supply_chain").notNull(),
  customerStickiness: text("customer_stickiness").notNull(),
  keyPeople: text("key_people").notNull(),
  competitiveMoat: text("competitive_moat").notNull(),
  growthCatalysts: text("growth_catalysts").notNull(),
  riskNarratives: text("risk_narratives").notNull(),
  oneLiner: text("one_liner").notNull(),
});

export type CompanyValueChain = typeof companyValueChainsTable.$inferSelect;
