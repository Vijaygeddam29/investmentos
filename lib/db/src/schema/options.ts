import {
  pgTable, serial, integer, text, real, boolean, timestamp, jsonb, uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { companiesTable } from "./companies";

export const ibkrConnectionsTable = pgTable("ibkr_connections", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => usersTable.id),
  accountId:       text("account_id"),
  accessToken:     text("access_token"),
  refreshToken:    text("refresh_token"),
  tokenExpiresAt:  timestamp("token_expires_at"),
  accountCurrency: text("account_currency").default("USD"),
  netLiquidation:  real("net_liquidation"),
  buyingPower:     real("buying_power"),
  connectedAt:     timestamp("connected_at").defaultNow().notNull(),
  lastSyncAt:      timestamp("last_sync_at"),
});
export type IbkrConnection = typeof ibkrConnectionsTable.$inferSelect;

export const userRiskProfilesTable = pgTable("user_risk_profiles", {
  id:                    serial("id").primaryKey(),
  userId:                integer("user_id").notNull().references(() => usersTable.id).unique(),
  profitTargetPct:       real("profit_target_pct").default(50).notNull(),
  maxLossMultiple:       real("max_loss_multiple").default(2).notNull(),
  maxLossAmount:         real("max_loss_amount"),
  deltaPreference:       text("delta_preference").default("moderate").notNull(),
  dteMin:                integer("dte_min").default(21).notNull(),
  dteMax:                integer("dte_max").default(35).notNull(),
  maxPositions:          integer("max_positions").default(5).notNull(),
  maxCapitalPerTradePct: real("max_capital_per_trade_pct").default(10).notNull(),
  marginCapPct:          real("margin_cap_pct").default(25).notNull(),
  accountSizeUsd:        real("account_size_usd"),
  ivPercentileMin:       real("iv_percentile_min").default(30).notNull(),
  monthlyIncomeTarget:   real("monthly_income_target"),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
});
export type UserRiskProfile = typeof userRiskProfilesTable.$inferSelect;

export const optionsIvHistoryTable = pgTable("options_iv_history", {
  id:              serial("id").primaryKey(),
  ticker:          text("ticker").notNull().references(() => companiesTable.ticker),
  timestamp:       timestamp("timestamp").defaultNow().notNull(),
  iv:              real("iv"),
  ivPercentile30d: real("iv_percentile_30d"),
  ivPercentile90d: real("iv_percentile_90d"),
  iv52wHigh:       real("iv_52w_high"),
  iv52wLow:        real("iv_52w_low"),
  ivRank:          real("iv_rank"),
  openInterest:    real("open_interest"),
  bidAskSpread:    real("bid_ask_spread"),
  source:          text("source").default("yahoo").notNull(),
});
export type OptionsIvHistory = typeof optionsIvHistoryTable.$inferSelect;

export const optionsSignalsTable = pgTable("options_signals", {
  id:                serial("id").primaryKey(),
  ticker:            text("ticker").notNull().references(() => companiesTable.ticker),
  generatedAt:       timestamp("generated_at").defaultNow().notNull(),
  strategy:          text("strategy").notNull(),
  regime:            text("regime").notNull(),
  strike:            real("strike").notNull(),
  expiry:            text("expiry").notNull(),
  dte:               integer("dte").notNull(),
  premium:           real("premium").notNull(),
  premiumYieldPct:   real("premium_yield_pct").notNull(),
  probabilityProfit: real("probability_profit"),
  ivPercentile:      real("iv_percentile"),
  iv:                real("iv"),
  fortressScore:     real("fortress_score"),
  rocketScore:       real("rocket_score"),
  aiRationale:       text("ai_rationale"),
  macroContext:      text("macro_context"),
  status:            text("status").default("active").notNull(),
  dismissedAt:       timestamp("dismissed_at"),
});
export type OptionsSignal = typeof optionsSignalsTable.$inferSelect;

export const tradeReviewQueueTable = pgTable("trade_review_queue", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => usersTable.id),
  signalId:        integer("signal_id").references(() => optionsSignalsTable.id),
  ticker:          text("ticker").notNull(),
  strategy:        text("strategy").notNull(),
  strike:          real("strike").notNull(),
  expiry:          text("expiry").notNull(),
  dte:             integer("dte").notNull(),
  quantity:        integer("quantity").notNull().default(1),
  limitPrice:      real("limit_price").notNull(),
  estimatedPremium:real("estimated_premium").notNull(),
  collateralRequired: real("collateral_required"),
  maxRisk:         real("max_risk"),
  aiRationale:     text("ai_rationale"),
  riskChecksPassed: boolean("risk_checks_passed").default(true),
  riskCheckNotes:  text("risk_check_notes"),
  status:          text("status").default("pending").notNull(),
  reviewedAt:      timestamp("reviewed_at"),
  ibkrOrderId:     text("ibkr_order_id"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});
export type TradeReviewQueueItem = typeof tradeReviewQueueTable.$inferSelect;

export const optionsTradesTable = pgTable("options_trades", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull().references(() => usersTable.id),
  ticker:           text("ticker").notNull(),
  right:            text("right").notNull(),
  strike:           real("strike").notNull(),
  expiry:           text("expiry").notNull(),
  quantity:         integer("quantity").notNull().default(1),
  premiumCollected: real("premium_collected"),
  fillPrice:        real("fill_price"),
  openedAt:         timestamp("opened_at").defaultNow().notNull(),
  closedAt:         timestamp("closed_at"),
  closingPrice:     real("closing_price"),
  isAssigned:       boolean("is_assigned").default(false),
  isRolled:         boolean("is_rolled").default(false),
  rolledToId:       integer("rolled_to_id"),
  realisedPnl:      real("realised_pnl"),
  monthlyBucket:    text("monthly_bucket"),
  ibkrOrderId:      text("ibkr_order_id"),
  notes:            text("notes"),
  strategy:         text("strategy"),
  regime:           text("regime"),
  status:           text("status").default("open").notNull(),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});
export type OptionsTrade = typeof optionsTradesTable.$inferSelect;

// Daily mark-to-market P&L snapshots for open trades
export const optionsTradeSnapshotsTable = pgTable("options_trade_snapshots", {
  id:            serial("id").primaryKey(),
  tradeId:       integer("trade_id").notNull().references(() => optionsTradesTable.id),
  date:          text("date").notNull(),              // "YYYY-MM-DD"
  midPrice:      real("mid_price"),                   // current option mid (per share)
  markPnl:       real("mark_pnl"),                    // unrealised P&L (per contract)
  theoreticalPnl: real("theoretical_pnl"),             // based on theta decay model
  daysElapsed:   integer("days_elapsed"),
  dteRemaining:  integer("dte_remaining"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("options_trade_snapshots_trade_date_idx").on(table.tradeId, table.date),
]);
export type OptionsTradeSnapshot = typeof optionsTradeSnapshotsTable.$inferSelect;

// Aggregate signal quality stats per (ticker, strategy, regime)
export const signalQualityStatsTable = pgTable("signal_quality_stats", {
  id:             serial("id").primaryKey(),
  ticker:         text("ticker").notNull().references(() => companiesTable.ticker),
  strategy:       text("strategy").notNull(),
  regime:         text("regime").notNull(),
  totalTrades:    integer("total_trades").notNull().default(0),
  wins:           integer("wins").notNull().default(0),             // closed at profit
  losses:         integer("losses").notNull().default(0),           // closed at loss
  assignments:    integer("assignments").notNull().default(0),      // assigned/exercised
  avgProfitPct:   real("avg_profit_pct"),                          // avg % of premium kept
  avgDaysHeld:    real("avg_days_held"),
  winRate:        real("win_rate"),                                  // wins / (wins+losses)
  assignmentRate: real("assignment_rate"),                          // assignments / total
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});
export type SignalQualityStat = typeof signalQualityStatsTable.$inferSelect;
