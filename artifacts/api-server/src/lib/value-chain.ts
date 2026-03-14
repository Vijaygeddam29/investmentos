import { db } from "@workspace/db";
import {
  companyValueChainsTable,
  companiesTable,
  scoresTable,
  financialMetricsTable,
  aiVerdictsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface ValueChainContent {
  oneLiner: string;
  upstreamInputs: string;
  peopleTalent: string;
  productionOperations: string;
  productsServices: string;
  customerDemand: string;
  demandSupplyChain: string;
  bottlenecksRisks: string;
}

const CACHE_DAYS = 7;

export async function getValueChain(ticker: string): Promise<{
  cached: boolean;
  generatedAt: Date | null;
  content: ValueChainContent | null;
  fresh: boolean;
}> {
  const [row] = await db
    .select()
    .from(companyValueChainsTable)
    .where(eq(companyValueChainsTable.ticker, ticker))
    .orderBy(desc(companyValueChainsTable.generatedAt))
    .limit(1);

  if (!row || !row.content) {
    return { cached: false, generatedAt: null, content: null, fresh: false };
  }

  const ageMs = Date.now() - new Date(row.generatedAt).getTime();
  const fresh = ageMs < CACHE_DAYS * 24 * 60 * 60 * 1000;

  return {
    cached: true,
    generatedAt: row.generatedAt,
    content: row.content as ValueChainContent,
    fresh,
  };
}

export async function generateValueChain(
  ticker: string,
  forceRegenerate = false
): Promise<{ cached: boolean; fresh: boolean; generatedAt: Date; content: ValueChainContent }> {
  const existing = await getValueChain(ticker);

  if (!forceRegenerate && existing.cached && existing.fresh) {
    return {
      cached: true,
      fresh: true,
      generatedAt: existing.generatedAt!,
      content: existing.content!,
    };
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.ticker, ticker))
    .limit(1);
  const [scores] = await db
    .select()
    .from(scoresTable)
    .where(eq(scoresTable.ticker, ticker))
    .orderBy(desc(scoresTable.date))
    .limit(1);
  const [metrics] = await db
    .select()
    .from(financialMetricsTable)
    .where(eq(financialMetricsTable.ticker, ticker))
    .orderBy(desc(financialMetricsTable.date))
    .limit(1);
  const [aiMemo] = await db
    .select()
    .from(aiVerdictsTable)
    .where(eq(aiVerdictsTable.ticker, ticker))
    .orderBy(desc(aiVerdictsTable.createdAt))
    .limit(1);

  const name = company?.name || ticker;
  const sector = company?.sector || "Unknown";
  const industry = company?.industry || "Unknown";
  const country = company?.country || "Unknown";

  const memoContext = aiMemo?.memo
    ? `\nAI Memo Summary (for context):\n${String(aiMemo.memo).slice(0, 800)}`
    : "";

  const prompt = `You are a senior equity analyst writing a structured Value Chain Intelligence brief for an institutional investor.

Company: ${name} (${ticker})
Sector: ${sector} | Industry: ${industry}
Country/Exchange: ${country}${memoContext}

Key financials:
- Revenue: ${metrics?.revenue ? "$" + (metrics.revenue / 1e9).toFixed(2) + "B" : "N/A"}
- Gross Margin: ${metrics?.grossMargin ? (metrics.grossMargin * 100).toFixed(1) + "%" : "N/A"}
- ROIC: ${metrics?.roic ? Math.min(metrics.roic * 100, 100).toFixed(1) + "%" : "N/A"}
- Revenue Growth YoY: ${metrics?.revenueGrowth1y ? (metrics.revenueGrowth1y * 100).toFixed(1) + "%" : "N/A"}
- R&D / Revenue: ${metrics?.rdToRevenue ? (metrics.rdToRevenue * 100).toFixed(1) + "%" : "N/A"}
- Fortress Score: ${scores?.fortressScore?.toFixed(2) || "N/A"}
- Rocket Score: ${scores?.rocketScore?.toFixed(2) || "N/A"}

Write a Value Chain Intelligence brief with exactly these 7 sections. Each section must be dense, specific, and jargon-precise — no generic fluff. Reference real business dynamics, named suppliers, customers, or competitors where you have knowledge. Reflect the company's country/market context where relevant.

Return valid JSON with exactly these keys:
{
  "oneLiner": "One punchy sentence capturing the company's essential investment thesis (max 25 words)",
  "upstreamInputs": "2-3 sentences on raw material / component dependencies, key named suppliers, geographic concentration, input-cost volatility, and inventory dynamics",
  "peopleTalent": "2-3 sentences on founder/CEO background, key executives, succession risk, insider ownership, talent moat (engineering depth, proprietary processes), and management track record vs capital allocation",
  "productionOperations": "2-3 sentences on manufacturing/delivery infrastructure, operational leverage, cost structure, capacity utilisation, and any operational differentiators (automation, proprietary tooling, margin structure)",
  "productsServices": "2-3 sentences on the core product/service portfolio, pricing power, mix shifts, product differentiation, and any platform or ecosystem dynamics that lock in economics",
  "customerDemand": "2-3 sentences on end-market demand drivers, customer concentration, contract structures, switching costs, net revenue retention (if SaaS), and secular vs cyclical demand characteristics",
  "demandSupplyChain": "2-3 sentences on how demand patterns shape supply chain decisions — demand variability, bullwhip effects, just-in-time vs buffer strategies, and how demand signals propagate upstream",
  "bottlenecksRisks": "2-3 sentences on the 2-3 most credible bear-case risks: single points of failure, regulatory threats, technological disruption, margin compression vectors, or competitive moat erosion"
}

Be specific. Name things. Avoid vague phrases like "strong management" or "growing market".`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed: ValueChainContent = JSON.parse(jsonMatch[0]);

    const now = new Date();
    await db
      .delete(companyValueChainsTable)
      .where(eq(companyValueChainsTable.ticker, ticker));
    await db.insert(companyValueChainsTable).values({
      ticker,
      generatedAt: now,
      content: parsed,
    });

    return { cached: false, fresh: true, generatedAt: now, content: parsed };
  } catch (err) {
    const fallback = buildFallback(name, sector, industry, metrics, scores);
    const now = new Date();
    await db
      .delete(companyValueChainsTable)
      .where(eq(companyValueChainsTable.ticker, ticker));
    await db.insert(companyValueChainsTable).values({
      ticker,
      generatedAt: now,
      content: fallback,
    });
    return { cached: false, fresh: true, generatedAt: now, content: fallback };
  }
}

function buildFallback(
  name: string,
  sector: string,
  industry: string,
  metrics: any,
  scores: any
): ValueChainContent {
  const roic = metrics?.roic
    ? Math.min(metrics.roic * 100, 100).toFixed(1) + "%"
    : "N/A";
  const gm = metrics?.grossMargin
    ? (metrics.grossMargin * 100).toFixed(1) + "%"
    : "N/A";
  const rev = metrics?.revenue
    ? "$" + (metrics.revenue / 1e9).toFixed(2) + "B"
    : "N/A";
  const growth = metrics?.revenueGrowth1y
    ? (metrics.revenueGrowth1y * 100).toFixed(1) + "%"
    : "N/A";
  const fortress = scores?.fortressScore?.toFixed(2) || "N/A";
  const rocket = scores?.rocketScore?.toFixed(2) || "N/A";

  return {
    oneLiner: `${name} is a ${sector} company generating ${rev} in annual revenue with ${roic} ROIC.`,
    upstreamInputs: `${name}'s upstream input dependencies in the ${sector} sector require further primary research. Gross margin of ${gm} provides a baseline for input-cost sensitivity. Geographic concentration of supply chains has not been fully modelled from available data.`,
    peopleTalent: `Management quality at ${name} is partially captured by ROIC of ${roic} as a proxy for capital allocation discipline. Succession risk and insider ownership require review of recent proxy filings and earnings calls.`,
    productionOperations: `${name}'s operational infrastructure in the ${sector} sector generates ${rev} in revenue. Gross margin of ${gm} reflects the current cost structure and pricing dynamics relative to peers.`,
    productsServices: `${name}'s product and service portfolio serves the ${industry} market. Revenue growth of ${growth} YoY reflects current demand for its offerings. Pricing power is partially captured by the gross margin profile of ${gm}.`,
    customerDemand: `End-market demand for ${name}'s offerings reflects ${sector} sector dynamics. Fortress Score of ${fortress} captures business durability metrics. Customer concentration and contract structures require further primary research.`,
    demandSupplyChain: `Demand variability in ${name}'s ${industry} business shapes upstream procurement and inventory strategies. Rocket Score of ${rocket} reflects growth momentum that may signal demand-driven supply chain expansion.`,
    bottlenecksRisks: `Key risks for ${name} include sector cyclicality, potential gross margin compression from ${gm} current levels, and execution risk on growth initiatives delivering ${growth} YoY revenue expansion. ROIC of ${roic} and Fortress Score of ${fortress} provide baseline stress-test anchors.`,
  };
}
