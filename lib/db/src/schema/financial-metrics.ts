import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const financialMetricsTable = pgTable("financial_metrics", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull().references(() => companiesTable.ticker),
  date: text("date").notNull(),

  revenue: real("revenue"),
  grossMargin: real("gross_margin"),
  grossMarginTrend: real("gross_margin_trend"),
  operatingMargin: real("operating_margin"),
  operatingMarginTrend: real("operating_margin_trend"),
  netMargin: real("net_margin"),
  ebitMargin: real("ebit_margin"),
  ebitdaMargin: real("ebitda_margin"),
  fcfMargin: real("fcf_margin"),
  incrementalMargin: real("incremental_margin"),

  roic: real("roic"),
  roic5yrAvg: real("roic_5yr_avg"),
  roicStability: real("roic_stability"),
  roe: real("roe"),
  roa: real("roa"),

  freeCashFlow: real("free_cash_flow"),
  fcfYield: real("fcf_yield"),
  fcfStability: real("fcf_stability"),
  fcfToNetIncome: real("fcf_to_net_income"),
  operatingCfToRevenue: real("operating_cf_to_revenue"),
  accrualRatio: real("accrual_ratio"),
  cashConversionCycle: real("cash_conversion_cycle"),
  cashFlowVolatility: real("cash_flow_volatility"),
  stockBasedCompPct: real("stock_based_comp_pct"),
  capitalAllocationDiscipline: real("capital_allocation_discipline"),

  debtToEquity: real("debt_to_equity"),
  netDebtEbitda: real("net_debt_ebitda"),
  interestCoverage: real("interest_coverage"),
  currentRatio: real("current_ratio"),
  quickRatio: real("quick_ratio"),
  cashToDebt: real("cash_to_debt"),
  altmanZScore: real("altman_z_score"),
  liquidityRatio: real("liquidity_ratio"),

  revenueGrowth1y: real("revenue_growth_1y"),
  revenueGrowth3y: real("revenue_growth_3y"),
  revenueGrowth5y: real("revenue_growth_5y"),
  epsGrowth1y: real("eps_growth_1y"),
  epsGrowth3y: real("eps_growth_3y"),
  epsGrowth5y: real("eps_growth_5y"),
  fcfGrowth: real("fcf_growth"),
  operatingIncomeGrowth: real("operating_income_growth"),

  assetTurnover: real("asset_turnover"),
  inventoryTurnover: real("inventory_turnover"),
  workingCapitalEfficiency: real("working_capital_efficiency"),
  capexToRevenue: real("capex_to_revenue"),
  operatingLeverage: real("operating_leverage"),
  reinvestmentRate: real("reinvestment_rate"),
  employeeProductivity: real("employee_productivity"),

  rdExpense: real("rd_expense"),
  rdToRevenue: real("rd_to_revenue"),
  rdProductivity: real("rd_productivity"),

  insiderOwnership: real("insider_ownership"),
  institutionalOwnership: real("institutional_ownership"),
  insiderBuying: real("insider_buying"),

  daysOutstanding: real("days_sales_outstanding"),
  receivablesGrowthVsRevenue: real("receivables_growth_vs_revenue"),
  inventoryGrowthVsRevenue: real("inventory_growth_vs_revenue"),
  deferredRevenueGrowth: real("deferred_revenue_growth"),
  workingCapitalDrift: real("working_capital_drift"),
  taxEfficiency: real("tax_efficiency"),
  earningsSurprises: real("earnings_surprises"),
  analystUpside: real("analyst_upside"),

  dividendYield: real("dividend_yield"),
  dividendGrowth: real("dividend_growth"),
  shareholderYield: real("shareholder_yield"),
  payoutRatio: real("payout_ratio"),

  peRatio: real("pe_ratio"),
  forwardPe: real("forward_pe"),
  pegRatio: real("peg_ratio"),
  evToEbitda: real("ev_to_ebitda"),
  evToSales: real("ev_to_sales"),
  priceToFcf: real("price_to_fcf"),
  priceToBook: real("price_to_book"),
  ruleOf40: real("rule_of_40"),
  revenueMultipleVsGrowth: real("revenue_multiple_vs_growth"),
  intrinsicValueGap: real("intrinsic_value_gap"),
  marginOfSafety: real("margin_of_safety"),
  dcfDiscount: real("dcf_discount"),

  // Peer-relative valuation (Gap 2: peer benchmarks)
  pePeerMedian: real("pe_peer_median"),
  evEbitdaPeerMedian: real("ev_ebitda_peer_median"),
  peVsPeerMedian: real("pe_vs_peer_median"),   // company PE / peer median PE

  // Sentiment family inputs (Gap 3 in Wave engine)
  sentimentScore: real("sentiment_score"),

  currency: text("currency"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FinancialMetric = typeof financialMetricsTable.$inferSelect;
