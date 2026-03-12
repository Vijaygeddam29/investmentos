import { pgTable, serial, text, real, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfolioHoldingsTable = pgTable("portfolio_holdings", {
  id:            serial("id").primaryKey(),
  ticker:        text("ticker").notNull(),
  shares:        real("shares").notNull(),
  purchasePrice: real("purchase_price").notNull(),
  purchaseDate:  date("purchase_date"),
  currency:      text("currency").default("USD").notNull(),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldingsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldingsTable.$inferSelect;
