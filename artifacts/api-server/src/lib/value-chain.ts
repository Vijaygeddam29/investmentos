import { db } from "@workspace/db";
import { companyValueChainsTable, companiesTable, scoresTable, financialMetricsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

export async function generateValueChain(ticker: string) {
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.ticker, ticker)).limit(1);
  const [scores] = await db.select().from(scoresTable).where(eq(scoresTable.ticker, ticker)).orderBy(desc(scoresTable.date)).limit(1);
  const [metrics] = await db.select().from(financialMetricsTable).where(eq(financialMetricsTable.ticker, ticker)).orderBy(desc(financialMetricsTable.date)).limit(1);

  const name = company?.name || ticker;
  const sector = company?.sector || "Unknown";
  const industry = company?.industry || "Unknown";

  const prompt = `You are a senior equity analyst writing a structured Value Chain Intelligence brief for an institutional investor.

Company: ${name} (${ticker})
Sector: ${sector} | Industry: ${industry}

Key financials available:
- Revenue: ${metrics?.revenue ? "$" + (metrics.revenue / 1e9).toFixed(2) + "B" : "N/A"}
- Gross Margin: ${metrics?.grossMargin ? (metrics.grossMargin * 100).toFixed(1) + "%" : "N/A"}
- ROIC: ${metrics?.roic ? (metrics.roic * 100).toFixed(1) + "%" : "N/A"}
- Revenue Growth YoY: ${metrics?.revenueGrowth1y ? (metrics.revenueGrowth1y * 100).toFixed(1) + "%" : "N/A"}
- R&D / Revenue: ${metrics?.rdToRevenue ? (metrics.rdToRevenue * 100).toFixed(1) + "%" : "N/A"}
- Fortress Score: ${scores?.fortressScore?.toFixed(2) || "N/A"}
- Rocket Score: ${scores?.rocketScore?.toFixed(2) || "N/A"}

Write a Value Chain Intelligence brief with exactly these 7 sections. Each section must be a dense, specific paragraph — no generic fluff. Use industry-specific terminology. Reference real business dynamics, named suppliers, customers, or competitors where you have knowledge.

Return your response as valid JSON with these exact keys:
{
  "oneLiner": "One punchy sentence capturing the company's essential investment thesis (max 25 words)",
  "supplyChain": "2-3 sentences on input dependencies, key suppliers, geographic concentration, single points of failure, and inventory dynamics",
  "customerStickiness": "2-3 sentences on customer retention mechanics, switching costs, net revenue retention if SaaS, contract structures, churn dynamics",
  "keyPeople": "2-3 sentences on founder/CEO background, key executives, succession risk, insider ownership, and management track record",
  "competitiveMoat": "2-3 sentences on the durable competitive advantage — network effects, IP, scale, switching costs, brand, or regulatory moat",
  "growthCatalysts": "2-3 sentences on the 2-3 biggest growth levers over the next 3-5 years with specific addressable market context",
  "riskNarratives": "2-3 sentences on the 2-3 most credible bear-case risks — technological disruption, margin compression, regulatory, or competitive threats"
}

Be specific. Avoid vague phrases like "strong management team" or "growing market". Name things.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]);

    await db.delete(companyValueChainsTable).where(eq(companyValueChainsTable.ticker, ticker));
    await db.insert(companyValueChainsTable).values({
      ticker,
      supplyChain: parsed.supplyChain || "",
      customerStickiness: parsed.customerStickiness || "",
      keyPeople: parsed.keyPeople || "",
      competitiveMoat: parsed.competitiveMoat || "",
      growthCatalysts: parsed.growthCatalysts || "",
      riskNarratives: parsed.riskNarratives || "",
      oneLiner: parsed.oneLiner || "",
    });

    return parsed;
  } catch (err) {
    const fallback = buildFallback(name, ticker, sector, metrics, scores);
    await db.delete(companyValueChainsTable).where(eq(companyValueChainsTable.ticker, ticker));
    await db.insert(companyValueChainsTable).values({ ticker, ...fallback });
    return fallback;
  }
}

function buildFallback(name: string, ticker: string, sector: string, metrics: any, scores: any) {
  const roic = metrics?.roic ? (metrics.roic * 100).toFixed(1) + "%" : "N/A";
  const gm = metrics?.grossMargin ? (metrics.grossMargin * 100).toFixed(1) + "%" : "N/A";
  const rev = metrics?.revenue ? "$" + (metrics.revenue / 1e9).toFixed(2) + "B" : "N/A";
  const growth = metrics?.revenueGrowth1y ? (metrics.revenueGrowth1y * 100).toFixed(1) + "%" : "N/A";

  return {
    oneLiner: `${name} is a ${sector} company generating ${rev} in revenue with ${roic} ROIC.`,
    supplyChain: `${name} operates in the ${sector} sector. Supply chain dependencies and concentration risks require further company-specific research. Revenue of ${rev} with gross margin of ${gm} reflects current input cost dynamics.`,
    customerStickiness: `Customer retention mechanics for ${name} reflect typical ${sector} dynamics. Switching costs and contractual structures have not been fully modelled from available data. Further primary research into NRR or churn metrics is recommended.`,
    keyPeople: `Management details for ${name} require review of recent proxy filings and earnings calls. ROIC of ${roic} provides a proxy for capital allocation quality under current leadership.`,
    competitiveMoat: `${name}'s competitive positioning in the ${sector} sector is partially captured in its Fortress Score of ${scores?.fortressScore?.toFixed(2) || "N/A"}. Gross margin of ${gm} reflects pricing power relative to peers.`,
    growthCatalysts: `Revenue growth of ${growth} YoY is the primary near-term indicator. Rocket Score of ${scores?.rocketScore?.toFixed(2) || "N/A"} captures growth momentum. Sector tailwinds in ${sector} represent a medium-term opportunity.`,
    riskNarratives: `Key risks include sector cyclicality, potential margin compression, and execution risk on growth initiatives. The current financial profile (ROIC ${roic}, Gross Margin ${gm}) provides a baseline for stress-testing bear-case scenarios.`,
  };
}
