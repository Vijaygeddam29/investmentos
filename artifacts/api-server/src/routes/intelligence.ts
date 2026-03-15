/**
 * Intelligence routes
 *
 * GET /api/intelligence/:ticker
 *   Full factor data for IntelligenceDrawer (scores + raw metrics)
 *
 * GET /api/intelligence/:ticker/narrative
 *   AI-generated decision narrative (cached in ai_verdicts, generated via Claude)
 *   ?refresh=true  bypasses cache and regenerates
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiVerdictsTable } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router: IRouter = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function asNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function asStr(v: unknown): string | undefined {
  return v != null ? String(v) : undefined;
}

/** Determine position band label from 0–1 net score */
function bandLabel(netScore: number | null): string {
  if (netScore == null) return "Watchlist";
  const n = Math.round(netScore * 100);
  if (n >= 75) return "Core (6–10%)";
  if (n >= 60) return "Standard (3–5%)";
  if (n >= 45) return "Starter (1–2.5%)";
  if (n >= 30) return "Tactical (0.5–1%)";
  return "Watchlist — monitor only";
}

const KEY_FIELDS = [
  "roic", "gross_margin", "operating_margin", "fcf_margin",
  "revenue_growth_3y", "eps_growth_3y", "net_debt_ebitda",
  "interest_coverage", "forward_pe", "ev_to_ebitda",
  "fcf_yield", "earnings_surprises", "accrual_ratio",
  "fcf_to_net_income", "institutional_ownership", "rd_to_revenue",
  "capital_allocation_discipline", "altman_z_score",
] as const;

type KeyField = typeof KEY_FIELDS[number];

interface MetricsSubset extends Record<KeyField, number | undefined> {
  rsi?: number;
  ret3m?: number;
  margin_of_safety?: number;
}

interface ConfidenceResult {
  available: number;
  total: number;
  confidence: "High" | "Medium" | "Low";
  fraction: number;
  confidenceLabel: "High" | "Medium" | "Low";
}

function calcConfidence(metrics: MetricsSubset): ConfidenceResult {
  const available = KEY_FIELDS.filter(k => metrics[k] != null).length;
  const fraction = available / KEY_FIELDS.length;
  const confidence: "High" | "Medium" | "Low" =
    fraction >= 0.7 ? "High" : fraction >= 0.4 ? "Medium" : "Low";
  return { available, total: KEY_FIELDS.length, confidence, confidenceLabel: confidence, fraction };
}

// ─── Required narrative keys for validation ────────────────────────────────────

const REQUIRED_NARRATIVE_KEYS = [
  "thesis_type", "verdict", "core_tension", "one_line_verdict",
  "what_is_true", "what_is_priced_in", "why_could_work", "why_may_not_work",
  "buy_trigger", "upgrade_trigger", "trim_trigger", "exit_trigger",
  "positioning_logic",
] as const;

type NarrativeKey = typeof REQUIRED_NARRATIVE_KEYS[number];

interface NarrativeShape extends Record<NarrativeKey, string> {
  _factorsAvailable?: number;
  _factorsTotal?: number;
  _confidenceLabel?: string;
}

function isValidNarrative(obj: unknown): obj is NarrativeShape {
  if (typeof obj !== "object" || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return REQUIRED_NARRATIVE_KEYS.every(
    k => typeof record[k] === "string" && (record[k] as string).length > 0
  );
}

// ─── Claude prompt ─────────────────────────────────────────────────────────────

const NARRATIVE_SYSTEM = `You are a senior portfolio manager at a long/short equity hedge fund generating structured investment decision narratives.

You receive quantitative Intelligence scores (0–100) and raw financial data for a company. Your job is to synthesise these into a clear, actionable investment narrative that a PM can use immediately.

The scoring model formula:
  Net Score = (2×Quality + 1×Opportunity + 2×Mispricing − 1×Expectation − 1×Fragility + 200) ÷ 700 × 100

Score components:
- Company Quality (×2 weight): ROIC, margins, growth, balance sheet, capital allocation
- Stock Opportunity (×1 weight): Valuation vs history/peers, FCF yield, revisions, entry timing
- Mispricing (×2 weight): Evidence market is systematically wrong — temporary issues, margin normalisation, optionality
- Expectation (×1 penalty): How much success is already priced in — premium multiples, crowding, recent price run
- Fragility (×1 penalty): Thesis fragility — leverage, margin volatility, regulatory, concentration

Position bands:
- CORE ≥75: 6–10% position — highest conviction
- STANDARD ≥60: 3–5% position — strong conviction
- STARTER ≥45: 1–2.5% position — building
- TACTICAL ≥30: 0.5–1% position — speculative/watchlist
- WATCHLIST <30: No position — monitor only

Output ONLY valid JSON — no preamble, no markdown, no explanation. Just raw JSON.
Be specific, use the actual numbers provided, avoid generic statements.
Write like a senior analyst presenting to a portfolio manager who has 30 seconds to make a decision.
Do NOT include disclaimers or hedge language about "past performance."`;

function buildNarrativePrompt(data: {
  ticker: string;
  name?: string;
  sector?: string;
  country?: string;
  marketCap?: number;
  Q?: number;
  O?: number;
  M?: number;
  E?: number;
  F?: number;
  N?: number;
  band: string;
  metrics: MetricsSubset;
}): string {
  const m = data.metrics;
  const pct = (v: number | undefined) => v != null ? `${(v * 100).toFixed(1)}%` : "N/A";
  const x   = (v: number | undefined) => v != null ? `${Number(v).toFixed(1)}×` : "N/A";
  const n   = (v: number | undefined) => v != null ? Number(v).toFixed(1) : "N/A";

  return `Company: ${data.ticker} (${data.name ?? "Unknown"})
Sector: ${data.sector ?? "Unknown"} | Country: ${data.country ?? "Unknown"}
Market Cap: ${data.marketCap != null ? `$${data.marketCap.toFixed(1)}B` : "N/A"}

INTELLIGENCE SCORES (0–100):
  Quality Score:     ${data.Q ?? "N/A"}/100  (double-weighted — business foundation)
  Opportunity Score: ${data.O ?? "N/A"}/100  (single-weighted — stock setup)
  Mispricing Score:  ${data.M ?? "N/A"}/100  (double-weighted — market edge)
  Expectation Score: ${data.E ?? "N/A"}/100  (penalised — priced-in optimism)
  Fragility Score:   ${data.F ?? "N/A"}/100  (penalised — thesis risk)
  NET Score:         ${data.N ?? "N/A"}/100  → Position Band: ${data.band}

KEY RAW METRICS:
  ROIC:                    ${pct(m.roic)}
  Gross Margin:            ${pct(m.gross_margin)}
  Operating Margin:        ${pct(m.operating_margin)}
  FCF Margin:              ${pct(m.fcf_margin)}
  Revenue Growth (3Y):     ${pct(m.revenue_growth_3y)} per year
  EPS Growth (3Y):         ${pct(m.eps_growth_3y)} per year
  Forward PE:              ${x(m.forward_pe)}
  EV/EBITDA:               ${x(m.ev_to_ebitda)}
  FCF Yield:               ${pct(m.fcf_yield)}
  Net Debt/EBITDA:         ${x(m.net_debt_ebitda)}
  Interest Coverage:       ${x(m.interest_coverage)}
  Altman Z-Score:          ${n(m.altman_z_score)}
  RSI:                     ${n(m.rsi)}
  3-Month Return:          ${pct(m.ret3m)}
  Margin of Safety:        ${pct(m.margin_of_safety)}
  Accrual Ratio:           ${n(m.accrual_ratio)}
  FCF / Net Income:        ${x(m.fcf_to_net_income)}
  Institutional Ownership: ${pct(m.institutional_ownership)}
  R&D / Revenue:           ${pct(m.rd_to_revenue)}
  Capital Alloc Score:     ${n(m.capital_allocation_discipline)}
  Earnings Surprises (avg):${pct(m.earnings_surprises)}

Produce EXACTLY this JSON structure (no other text):
{
  "thesis_type": "CHOOSE ONE: Compounder | Quality at Reasonable Price | Turnaround | Expectation Reset | Mispriced Optionality | Cyclical Recovery | Tactical Rebound | Overhyped Quality | Value Trap Risk",
  "verdict": "CHOOSE ONE: Build | Add | Starter | Hold | Watch | Trim | Avoid",
  "core_tension": "ONE sentence — compress the entire case into its fundamental tension",
  "one_line_verdict": "ONE sentence using: '{ticker} is a {verdict} position because {business quality}, while {stock setup} and the main risk is {fragility}'",
  "what_is_true": "2–3 sentences on business reality. What the company actually IS. Reference specific metrics.",
  "what_is_priced_in": "2–3 sentences on market expectation. What valuation and consensus currently assume. Be specific.",
  "why_could_work": "2–3 sentences on the upside/re-rating path. What must happen for the stock to work from here.",
  "why_may_not_work": "2–3 sentences on the downside scenario. Why it disappoints or drifts sideways.",
  "buy_trigger": "ONE sentence: specific price level, data point, or event that would make this more compelling",
  "upgrade_trigger": "ONE sentence: what would upgrade the verdict to the next higher conviction level",
  "trim_trigger": "ONE sentence: what would cause trimming the position",
  "exit_trigger": "ONE sentence: what would cause full exit regardless of price",
  "positioning_logic": "2–3 sentences explaining WHY this specific position band — reference quality/opportunity tradeoff and what is confirmed vs unconfirmed in the thesis"
}`;
}

// ─── GET /api/intelligence/:ticker ────────────────────────────────────────────

router.get("/intelligence/:ticker", async (req, res) => {
  const { ticker } = req.params;

  try {
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

    const metricsRows = await db.execute(sql`
      SELECT
        roic, roic_5yr_avg, roic_stability,
        roe, roa,
        gross_margin, gross_margin_trend,
        operating_margin, operating_margin_trend,
        net_margin, ebit_margin, ebitda_margin, fcf_margin,
        incremental_margin,
        free_cash_flow, fcf_yield, fcf_stability, fcf_to_net_income,
        operating_cf_to_revenue, accrual_ratio, cash_flow_volatility,
        stock_based_comp_pct, capital_allocation_discipline,
        debt_to_equity, net_debt_ebitda, interest_coverage,
        current_ratio, quick_ratio, cash_to_debt, altman_z_score,
        revenue_growth_1y, revenue_growth_3y, revenue_growth_5y,
        eps_growth_1y, eps_growth_3y, eps_growth_5y,
        fcf_growth, operating_income_growth,
        asset_turnover, capex_to_revenue, reinvestment_rate,
        working_capital_efficiency, operating_leverage,
        pe_ratio, forward_pe, peg_ratio,
        ev_to_ebitda, ev_to_sales, price_to_fcf, price_to_book,
        rule_of_40, revenue_multiple_vs_growth,
        insider_ownership, institutional_ownership, insider_buying,
        earnings_surprises, dividend_yield, shareholder_yield, payout_ratio,
        days_sales_outstanding, receivables_growth_vs_revenue,
        inventory_growth_vs_revenue, deferred_revenue_growth,
        working_capital_drift, tax_efficiency,
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ─── GET /api/intelligence/:ticker/narrative ──────────────────────────────────

router.get("/intelligence/:ticker/narrative", async (req, res) => {
  const { ticker } = req.params;
  const refresh = req.query.refresh === "true";
  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Check cache (unless refresh requested)
    if (!refresh) {
      const cached = await db
        .select()
        .from(aiVerdictsTable)
        .where(eq(aiVerdictsTable.ticker, ticker))
        .orderBy(desc(aiVerdictsTable.createdAt))
        .limit(1);

      if (cached.length > 0 && cached[0].narrativeJson) {
        const row = cached[0];
        const narrativeParsed = JSON.parse(row.narrativeJson!) as NarrativeShape;

        // Prefer embedded confidence (new format); fall back to derivation from stored fraction (legacy)
        const storedFraction   = row.dataConfidence ?? 0;
        const factorsTotal     = narrativeParsed._factorsTotal ?? KEY_FIELDS.length;
        const factorsAvailable = narrativeParsed._factorsAvailable ?? Math.round(storedFraction * factorsTotal);
        const confidenceLabel  = (narrativeParsed._confidenceLabel as ConfidenceResult["confidenceLabel"] | undefined) ??
          (storedFraction >= 0.7 ? "High" : storedFraction >= 0.4 ? "Medium" : "Low") as ConfidenceResult["confidenceLabel"];

        return res.json({
          ticker,
          cached: true,
          generatedAt: row.createdAt,
          dataConfidence: storedFraction,
          factorsAvailable,
          factorsTotal,
          confidenceLabel,
          narrative: narrativeParsed,
        });
      }
    }

    // 2. Fetch intelligence data
    const snapshotRows = await db.execute(sql`
      SELECT
        fs.company_quality_score, fs.stock_opportunity_score,
        fs.expectation_score, fs.mispricing_score, fs.fragility_score,
        fs.portfolio_net_score, fs.rsi, fs.ret3m, fs.margin_of_safety,
        c.name, c.sector, c.country,
        COALESCE(fs.market_cap, c.market_cap) AS market_cap
      FROM factor_snapshots fs
      LEFT JOIN companies c ON fs.ticker = c.ticker
      WHERE fs.ticker = ${ticker}
      ORDER BY fs.created_at DESC
      LIMIT 1
    `);

    if (!snapshotRows.rows.length) {
      return res.status(404).json({ error: `No Intelligence data found for ${ticker}` });
    }

    const snapRow = snapshotRows.rows[0];

    const metricsRows = await db.execute(sql`
      SELECT
        roic, gross_margin, operating_margin, fcf_margin, fcf_yield, fcf_to_net_income, accrual_ratio,
        revenue_growth_3y, eps_growth_3y, pe_ratio, forward_pe, ev_to_ebitda,
        net_debt_ebitda, interest_coverage, altman_z_score,
        institutional_ownership, rd_to_revenue, capital_allocation_discipline,
        earnings_surprises
      FROM financial_metrics
      WHERE ticker = ${ticker}
      ORDER BY date DESC
      LIMIT 1
    `);
    const metricsRow = metricsRows.rows[0];

    // 3. Build typed metrics subset
    const metrics: MetricsSubset = {
      roic:                        asNum(metricsRow?.roic),
      gross_margin:                asNum(metricsRow?.gross_margin),
      operating_margin:            asNum(metricsRow?.operating_margin),
      fcf_margin:                  asNum(metricsRow?.fcf_margin),
      revenue_growth_3y:           asNum(metricsRow?.revenue_growth_3y),
      eps_growth_3y:               asNum(metricsRow?.eps_growth_3y),
      net_debt_ebitda:             asNum(metricsRow?.net_debt_ebitda),
      interest_coverage:           asNum(metricsRow?.interest_coverage),
      forward_pe:                  asNum(metricsRow?.forward_pe),
      ev_to_ebitda:                asNum(metricsRow?.ev_to_ebitda),
      fcf_yield:                   asNum(metricsRow?.fcf_yield),
      earnings_surprises:          asNum(metricsRow?.earnings_surprises),
      accrual_ratio:               asNum(metricsRow?.accrual_ratio),
      fcf_to_net_income:           asNum(metricsRow?.fcf_to_net_income),
      institutional_ownership:     asNum(metricsRow?.institutional_ownership),
      rd_to_revenue:               asNum(metricsRow?.rd_to_revenue),
      capital_allocation_discipline: asNum(metricsRow?.capital_allocation_discipline),
      altman_z_score:              asNum(metricsRow?.altman_z_score),
      rsi:                         asNum(snapRow.rsi),
      ret3m:                       asNum(snapRow.ret3m),
      margin_of_safety:            asNum(snapRow.margin_of_safety),
    };

    // 4. Calculate data confidence
    const conf = calcConfidence(metrics);

    // 5. Build scores (stored as 0–1 fractions, convert to 0–100)
    const Q = asNum(snapRow.company_quality_score)   != null ? Math.round(asNum(snapRow.company_quality_score)!   * 100) : undefined;
    const O = asNum(snapRow.stock_opportunity_score) != null ? Math.round(asNum(snapRow.stock_opportunity_score)! * 100) : undefined;
    const M = asNum(snapRow.mispricing_score)        != null ? Math.round(asNum(snapRow.mispricing_score)!        * 100) : undefined;
    const E = asNum(snapRow.expectation_score)       != null ? Math.round(asNum(snapRow.expectation_score)!       * 100) : undefined;
    const F = asNum(snapRow.fragility_score)         != null ? Math.round(asNum(snapRow.fragility_score)!         * 100) : undefined;
    const N = asNum(snapRow.portfolio_net_score)     != null ? Math.round(asNum(snapRow.portfolio_net_score)!     * 100) : undefined;

    // 6. Call Claude
    const prompt = buildNarrativePrompt({
      ticker,
      name:      asStr(snapRow.name),
      sector:    asStr(snapRow.sector),
      country:   asStr(snapRow.country),
      marketCap: asNum(snapRow.market_cap),
      Q, O, M, E, F, N,
      band: bandLabel(asNum(snapRow.portfolio_net_score) ?? null),
      metrics,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: NARRATIVE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: "Claude returned non-JSON response. Please try again." });
    }

    if (!isValidNarrative(parsed)) {
      return res.status(502).json({
        error: "Claude response was missing required narrative fields. Please try again.",
      });
    }

    // Embed confidence metadata inside the stored JSON so cache hits can return them
    const narrativeToStore: NarrativeShape = {
      ...parsed,
      _factorsAvailable: conf.available,
      _factorsTotal: conf.total,
      _confidenceLabel: conf.confidenceLabel,
    };

    const verdictWord  = parsed.verdict;
    const thesisType   = parsed.thesis_type;
    const oneLine      = parsed.one_line_verdict;

    // 7. Upsert into ai_verdicts
    const existingRows = await db
      .select()
      .from(aiVerdictsTable)
      .where(eq(aiVerdictsTable.ticker, ticker))
      .orderBy(desc(aiVerdictsTable.createdAt))
      .limit(1);

    if (existingRows.length > 0 && refresh) {
      await db.execute(sql`
        UPDATE ai_verdicts
        SET narrative_json = ${JSON.stringify(narrativeToStore)},
            data_confidence = ${conf.fraction},
            verdict = ${verdictWord},
            classification = ${thesisType},
            memo = ${oneLine},
            date = ${today}
        WHERE id = ${existingRows[0].id}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO ai_verdicts (ticker, date, verdict, classification, memo, narrative_json, data_confidence)
        VALUES (${ticker}, ${today}, ${verdictWord}, ${thesisType}, ${oneLine}, ${JSON.stringify(narrativeToStore)}, ${conf.fraction})
      `);
    }

    res.json({
      ticker,
      cached: false,
      generatedAt: new Date().toISOString(),
      dataConfidence: conf.fraction,
      factorsAvailable: conf.available,
      factorsTotal: conf.total,
      confidenceLabel: conf.confidenceLabel,
      narrative: parsed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Narrative generation error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
