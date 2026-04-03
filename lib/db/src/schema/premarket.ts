import { pgTable, serial, text, real, timestamp, jsonb } from "drizzle-orm/pg-core";

export const macroSnapshotsTable = pgTable("macro_snapshots", {
  id:           serial("id").primaryKey(),
  instrument:   text("instrument").notNull(),
  symbol:       text("symbol").notNull(),
  price:        real("price"),
  change24h:    real("change_24h"),
  changePct24h: real("change_pct_24h"),
  snapshotAt:   timestamp("snapshot_at").defaultNow().notNull(),
});
export type MacroSnapshot = typeof macroSnapshotsTable.$inferSelect;

export const newsItemsTable = pgTable("news_items", {
  id:             serial("id").primaryKey(),
  title:          text("title").notNull(),
  summary:        text("summary"),
  source:         text("source"),
  url:            text("url"),
  publishedAt:    timestamp("published_at"),
  category:       text("category").notNull(),
  ticker:         text("ticker"),
  sector:         text("sector"),
  relevanceScore: real("relevance_score").default(0.5),
  fetchedAt:      timestamp("fetched_at").defaultNow().notNull(),
});
export type NewsItem = typeof newsItemsTable.$inferSelect;

export const premarketBriefingsTable = pgTable("premarket_briefings", {
  id:                 serial("id").primaryKey(),
  date:               text("date").notNull().unique(),
  macroMood:          text("macro_mood"),
  riskLevel:          text("risk_level").default("neutral"),
  sectorAlerts:       jsonb("sector_alerts"),
  companyAlerts:      jsonb("company_alerts"),
  optionsImplications: text("options_implications"),
  watchList:          jsonb("watch_list"),
  positionSizeMultiplier: real("position_size_multiplier").default(1.0),
  generatedAt:        timestamp("generated_at").defaultNow().notNull(),
  emailSentAt:        timestamp("email_sent_at"),
});
export type PremarketBriefing = typeof premarketBriefingsTable.$inferSelect;
