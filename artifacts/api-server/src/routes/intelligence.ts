/**
 * GET /api/intelligence/:ticker
 *
 * Returns the full Investment Intelligence detail for a single company:
 * - Latest factor snapshot (5-layer scores)
 * - Latest financial_metrics row (all raw input data)
 *
 * This powers the IntelligenceDrawer on the Signals page.
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/intelligence/:ticker", async (req, res) => {
  const { ticker } = req.params;

  try {
    // Fetch latest factor snapshot for this ticker
    const snapshotRows = await db.execute(sql`
      SELECT
        fs.ticker, fs.date, fs.fortress_score, fs.rocket_score, fs.wave_score,
        fs.entry_score, fs.profitability_score, fs.growth_score,
        fs.capital_efficiency_score, fs.financial_strength_score,
        fs.cash_flow_quality_score, fs.momentum_score, fs.valuation_score,
        fs.sentiment_score, fs.rsi, fs.macd_histogram, fs.ret3m,
        fs.margin_of_safety, fs.market_cap,
        fs.company_quality_score, fs.stock_opportunity_score,
        fs.expectation_score, fs.mispricing_score, fs.fragility_score,
        fs.portfolio_net_score,
        c.name, c.sector, c.industry, c.country, c.currency,
        COALESCE(fs.market_cap, c.market_cap) AS effective_market_cap
      FROM factor_snapshots fs
      LEFT JOIN companies c ON fs.ticker = c.ticker
      WHERE fs.ticker = ${ticker}
      ORDER BY fs.created_at DESC
      LIMIT 1
    `);

    // Fetch latest financial_metrics for this ticker
    const metricsRows = await db.execute(sql`
      SELECT
        -- Profitability
        roic, roic_5yr_avg, roic_stability,
        roe, roa,
        gross_margin, gross_margin_trend,
        operating_margin, operating_margin_trend,
        net_margin, ebit_margin, ebitda_margin, fcf_margin,
        incremental_margin,
        -- Cash flow quality
        free_cash_flow, fcf_yield, fcf_stability, fcf_to_net_income,
        operating_cf_to_revenue, accrual_ratio, cash_flow_volatility,
        stock_based_comp_pct, capital_allocation_discipline,
        -- Financial strength
        debt_to_equity, net_debt_ebitda, interest_coverage,
        current_ratio, quick_ratio, cash_to_debt, altman_z_score,
        -- Growth
        revenue_growth_1y, revenue_growth_3y, revenue_growth_5y,
        eps_growth_1y, eps_growth_3y, eps_growth_5y,
        fcf_growth, operating_income_growth,
        -- Capital efficiency
        asset_turnover, capex_to_revenue, reinvestment_rate,
        working_capital_efficiency, operating_leverage,
        -- Valuation
        pe_ratio, forward_pe, peg_ratio,
        ev_to_ebitda, ev_to_sales, price_to_fcf, price_to_book,
        rule_of_40, revenue_multiple_vs_growth,
        -- Governance / signals
        insider_ownership, institutional_ownership, insider_buying,
        earnings_surprises, dividend_yield, shareholder_yield, payout_ratio,
        -- Forensics / mispricing signals
        days_sales_outstanding, receivables_growth_vs_revenue,
        inventory_growth_vs_revenue, deferred_revenue_growth,
        working_capital_drift, tax_efficiency,
        -- Innovation
        rd_expense, rd_to_revenue, rd_productivity,
        employee_productivity
      FROM financial_metrics
      WHERE ticker = ${ticker}
      ORDER BY date DESC
      LIMIT 1
    `);

    if (!snapshotRows.rows.length) {
      return res.status(404).json({ error: `No Intelligence data found for ${ticker}` });
    }

    const snapshot = snapshotRows.rows[0];
    const metrics  = metricsRows.rows[0] ?? null;

    res.json({ ticker, snapshot, metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
