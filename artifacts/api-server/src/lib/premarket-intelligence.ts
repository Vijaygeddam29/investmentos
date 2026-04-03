/**
 * Pre-Market Intelligence Engine
 *
 * Fetches macro "canary" data + geopolitical/sector news every morning
 * and synthesises into an AI-generated daily briefing via Claude.
 *
 * Macro instruments tracked:
 *   BTC-USD, ETH-USD, GC=F (Gold), SI=F (Silver), CL=F (WTI Oil),
 *   BZ=F (Brent Oil), ^VIX, DX-Y.NYB (DXY Dollar), ^TNX (US10Y),
 *   ^N225 (Nikkei), ^HSI (Hang Seng), ^FTSE (FTSE 100), ^GDAXI (DAX)
 */

import YahooFinanceClass from "yahoo-finance2";
import { db } from "@workspace/db";
import {
  macroSnapshotsTable,
  newsItemsTable,
  premarketBriefingsTable,
  companiesTable,
} from "@workspace/db/schema";
import { eq, desc, gte, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const yf = new (YahooFinanceClass as any)({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

// ─── Macro Instruments ────────────────────────────────────────────────────────

const MACRO_INSTRUMENTS = [
  { symbol: "BTC-USD",   label: "Bitcoin",       emoji: "₿"  },
  { symbol: "ETH-USD",   label: "Ethereum",      emoji: "Ξ"  },
  { symbol: "GC=F",      label: "Gold",          emoji: "🥇" },
  { symbol: "SI=F",      label: "Silver",        emoji: "🥈" },
  { symbol: "CL=F",      label: "WTI Oil",       emoji: "🛢️" },
  { symbol: "BZ=F",      label: "Brent Oil",     emoji: "🛢️" },
  { symbol: "^VIX",      label: "VIX",           emoji: "📊" },
  { symbol: "DX-Y.NYB",  label: "DXY Dollar",    emoji: "💵" },
  { symbol: "^TNX",      label: "US 10Y Yield",  emoji: "📈" },
  { symbol: "^N225",     label: "Nikkei 225",    emoji: "🇯🇵" },
  { symbol: "^HSI",      label: "Hang Seng",     emoji: "🇭🇰" },
  { symbol: "^FTSE",     label: "FTSE 100",      emoji: "🇬🇧" },
  { symbol: "^GDAXI",    label: "DAX",           emoji: "🇩🇪" },
  { symbol: "^GSPC",     label: "S&P 500",       emoji: "🇺🇸" },
];

export interface MacroSnapshot {
  instrument: string;
  symbol: string;
  price: number | null;
  change24h: number | null;
  changePct24h: number | null;
}

export async function fetchMacroSnapshots(): Promise<MacroSnapshot[]> {
  const results: MacroSnapshot[] = [];

  await Promise.allSettled(
    MACRO_INSTRUMENTS.map(async ({ symbol, label }) => {
      try {
        const q = await yf.quote(symbol, {}, { validateResult: false });
        const price       = q?.regularMarketPrice ?? null;
        const change24h   = q?.regularMarketChange ?? null;
        const changePct   = q?.regularMarketChangePercent ?? null;

        const snap: MacroSnapshot = { instrument: label, symbol, price, change24h, changePct24h: changePct };
        results.push(snap);

        await db.insert(macroSnapshotsTable).values({
          instrument: label,
          symbol,
          price,
          change24h,
          changePct24h: changePct,
          snapshotAt: new Date(),
        }).catch(() => {});
      } catch {
        results.push({ instrument: label, symbol, price: null, change24h: null, changePct24h: null });
      }
    })
  );

  return results;
}

// ─── News Fetching via Yahoo Finance Search ────────────────────────────────────

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: Date | null;
  category: string;
  ticker: string | null;
  sector: string | null;
  relevanceScore: number;
}

async function fetchNewsForQuery(query: string, category: string, ticker?: string, sector?: string): Promise<NewsItem[]> {
  try {
    const results = await yf.search(query, { newsCount: 5, quotesCount: 0 }, { validateResult: false });
    const news = results?.news ?? [];

    return news.map((n: any) => ({
      title:          n.title ?? "",
      summary:        n.summary ?? n.title ?? "",
      source:         n.publisher ?? "Yahoo Finance",
      url:            n.link ?? "",
      publishedAt:    n.providerPublishTime ? new Date(n.providerPublishTime * 1000) : null,
      category,
      ticker:         ticker ?? null,
      sector:         sector ?? null,
      relevanceScore: 0.7,
    }));
  } catch {
    return [];
  }
}

export async function fetchAndStoreNews(): Promise<NewsItem[]> {
  const all: NewsItem[] = [];

  // Macro/geopolitical queries
  const macroQueries = [
    { q: "geopolitical risk global markets 2025", cat: "macro" },
    { q: "Federal Reserve interest rates inflation", cat: "macro" },
    { q: "US China trade war tariffs", cat: "macro" },
    { q: "OPEC oil production energy markets", cat: "sector" },
    { q: "semiconductor supply chain chip stocks", cat: "sector" },
    { q: "gold safe haven market outlook", cat: "macro" },
    { q: "bitcoin cryptocurrency market sentiment", cat: "macro" },
    { q: "earnings season stock market forecast", cat: "macro" },
    { q: "Middle East conflict oil risk", cat: "macro" },
    { q: "central bank ECB Bank of England rate", cat: "macro" },
  ];

  for (const { q, cat } of macroQueries) {
    const items = await fetchNewsForQuery(q, cat);
    all.push(...items);
    await new Promise((r) => setTimeout(r, 300));
  }

  // Sector-specific queries
  const sectorQueries = [
    { q: "technology AI stocks outlook", sector: "Technology" },
    { q: "financial banking stocks interest rates", sector: "Financials" },
    { q: "healthcare biotech stocks FDA", sector: "Healthcare" },
    { q: "energy oil gas stocks OPEC", sector: "Energy" },
    { q: "consumer retail spending outlook", sector: "Consumer" },
  ];

  for (const { q, sector } of sectorQueries) {
    const items = await fetchNewsForQuery(q, "sector", undefined, sector);
    all.push(...items);
    await new Promise((r) => setTimeout(r, 300));
  }

  // Get top MIOS companies by sector for company-specific news
  const topCompanies = await db
    .select({ ticker: companiesTable.ticker, name: companiesTable.name, sector: companiesTable.sector })
    .from(companiesTable)
    .limit(30);

  const companyBatch = topCompanies.slice(0, 15);
  for (const co of companyBatch) {
    const items = await fetchNewsForQuery(`${co.ticker} ${co.name} stock news`, "company", co.ticker, co.sector ?? undefined);
    all.push(...items);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Deduplicate by title
  const seen = new Set<string>();
  const unique = all.filter((n) => {
    const key = n.title.slice(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Store to DB
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const item of unique) {
    try {
      await db.insert(newsItemsTable).values({
        title:          item.title,
        summary:        item.summary,
        source:         item.source,
        url:            item.url,
        publishedAt:    item.publishedAt,
        category:       item.category,
        ticker:         item.ticker,
        sector:         item.sector,
        relevanceScore: item.relevanceScore,
        fetchedAt:      new Date(),
      });
    } catch {
      // ignore duplicates
    }
  }

  return unique;
}

// ─── AI Briefing Generator ────────────────────────────────────────────────────

export interface PremarketBriefing {
  date: string;
  macroMood: string;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  sectorAlerts: Array<{ sector: string; direction: string; reason: string }>;
  companyAlerts: Array<{ ticker: string; name: string; headline: string; impact: string }>;
  optionsImplications: string;
  watchList: Array<{ item: string; reason: string }>;
  positionSizeMultiplier: number;
}

function formatMacroSummary(snapshots: MacroSnapshot[]): string {
  return snapshots
    .filter((s) => s.price != null)
    .map((s) => {
      const pct = s.changePct24h != null ? `${s.changePct24h >= 0 ? "+" : ""}${s.changePct24h.toFixed(1)}%` : "N/A";
      return `${s.instrument}: ${s.price?.toFixed(2)} (${pct})`;
    })
    .join(" | ");
}

function formatNewsForPrompt(news: NewsItem[]): string {
  const top = news.slice(0, 25);
  return top.map((n) => `- [${n.category.toUpperCase()}] ${n.title}`).join("\n");
}

export async function generatePremarketBriefing(
  snapshots: MacroSnapshot[],
  news: NewsItem[],
): Promise<PremarketBriefing> {
  const today = new Date().toISOString().split("T")[0];
  const macroSummary = formatMacroSummary(snapshots);
  const newsSummary = formatNewsForPrompt(news);

  const vix = snapshots.find((s) => s.instrument === "VIX");
  const btc = snapshots.find((s) => s.instrument === "Bitcoin");
  const gold = snapshots.find((s) => s.instrument === "Gold");

  const prompt = `You are the head of market intelligence at a systematic options trading fund. Generate today's pre-market briefing for ${today}.

MACRO DATA (overnight/current):
${macroSummary}

TOP NEWS HEADLINES (last 24 hours):
${newsSummary}

Generate a JSON response with this exact structure (no markdown, pure JSON):
{
  "macroMood": "One sentence: overall risk sentiment (risk-on/risk-off/neutral) with the 2-3 most important data points",
  "riskLevel": "low|moderate|elevated|high",
  "sectorAlerts": [
    {"sector": "Technology", "direction": "positive|negative|neutral", "reason": "brief reason"}
  ],
  "companyAlerts": [
    {"ticker": "AAPL", "name": "Apple", "headline": "brief headline", "impact": "positive|negative|neutral"}
  ],
  "optionsImplications": "2-3 sentences on what this means for options premium selling strategy today. Include position sizing guidance.",
  "watchList": [
    {"item": "thing to watch", "reason": "why it matters today"}
  ],
  "positionSizeMultiplier": 1.0
}

Rules:
- riskLevel "high" or elevated → positionSizeMultiplier 0.5–0.7
- riskLevel "low" or "moderate" → positionSizeMultiplier 0.9–1.1
- sectorAlerts: 3-5 most relevant sectors only
- companyAlerts: only MAJOR moves or news (earnings surprises, M&A, regulatory) — max 5
- watchList: 3-5 most important things to monitor today
- Be specific and actionable, not vague`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (msg.content[0] as any).text?.trim() ?? "";

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      date: today,
      macroMood: parsed.macroMood ?? "Market data insufficient for full assessment.",
      riskLevel: parsed.riskLevel ?? "moderate",
      sectorAlerts: parsed.sectorAlerts ?? [],
      companyAlerts: parsed.companyAlerts ?? [],
      optionsImplications: parsed.optionsImplications ?? "Standard conditions apply. Follow normal position sizing.",
      watchList: parsed.watchList ?? [],
      positionSizeMultiplier: parsed.positionSizeMultiplier ?? 1.0,
    };
  } catch (err) {
    console.warn("[PremarketIntelligence] AI briefing failed:", (err as Error).message);

    // Fallback briefing from raw data
    const vixPct = vix?.changePct24h ?? 0;
    const btcPct = btc?.changePct24h ?? 0;
    const goldPct = gold?.changePct24h ?? 0;

    const riskLevel = vixPct > 5 || goldPct > 1.5 ? "elevated" : "moderate";
    return {
      date: today,
      macroMood: `VIX ${vix?.price?.toFixed(1) ?? "N/A"} (${vixPct >= 0 ? "+" : ""}${vixPct.toFixed(1)}%), BTC ${btcPct >= 0 ? "+" : ""}${btcPct.toFixed(1)}%, Gold ${goldPct >= 0 ? "+" : ""}${goldPct.toFixed(1)}%. Market mood: ${riskLevel}.`,
      riskLevel,
      sectorAlerts: [],
      companyAlerts: [],
      optionsImplications: riskLevel === "elevated"
        ? "Elevated volatility detected. Consider reducing position sizes by 30% today. Premiums are richer but risk is higher."
        : "Standard market conditions. Follow normal position sizing guidelines.",
      watchList: [],
      positionSizeMultiplier: riskLevel === "elevated" ? 0.7 : 1.0,
    };
  }
}

// ─── Store Briefing ───────────────────────────────────────────────────────────

export async function storeBriefing(briefing: PremarketBriefing): Promise<void> {
  await db
    .insert(premarketBriefingsTable)
    .values({
      date:                   briefing.date,
      macroMood:              briefing.macroMood,
      riskLevel:              briefing.riskLevel,
      sectorAlerts:           briefing.sectorAlerts,
      companyAlerts:          briefing.companyAlerts,
      optionsImplications:    briefing.optionsImplications,
      watchList:              briefing.watchList,
      positionSizeMultiplier: briefing.positionSizeMultiplier,
      generatedAt:            new Date(),
    })
    .onConflictDoUpdate({
      target: premarketBriefingsTable.date,
      set: {
        macroMood:              briefing.macroMood,
        riskLevel:              briefing.riskLevel,
        sectorAlerts:           briefing.sectorAlerts,
        companyAlerts:          briefing.companyAlerts,
        optionsImplications:    briefing.optionsImplications,
        watchList:              briefing.watchList,
        positionSizeMultiplier: briefing.positionSizeMultiplier,
        generatedAt:            new Date(),
      },
    });
}

export async function getTodaysBriefing(): Promise<PremarketBriefing | null> {
  const today = new Date().toISOString().split("T")[0];
  const rows = await db
    .select()
    .from(premarketBriefingsTable)
    .where(eq(premarketBriefingsTable.date, today))
    .limit(1);

  if (!rows.length) return null;
  const r = rows[0];
  return {
    date:                   r.date,
    macroMood:              r.macroMood ?? "",
    riskLevel:              (r.riskLevel as any) ?? "moderate",
    sectorAlerts:           (r.sectorAlerts as any) ?? [],
    companyAlerts:          (r.companyAlerts as any) ?? [],
    optionsImplications:    r.optionsImplications ?? "",
    watchList:              (r.watchList as any) ?? [],
    positionSizeMultiplier: r.positionSizeMultiplier ?? 1.0,
  };
}

// ─── Full Pipeline Run ─────────────────────────────────────────────────────────

export async function runPremarketPipeline(): Promise<PremarketBriefing> {
  console.log("[PremarketIntelligence] Starting pipeline...");

  const [snapshots, news] = await Promise.all([
    fetchMacroSnapshots(),
    fetchAndStoreNews(),
  ]);

  console.log(`[PremarketIntelligence] Fetched ${snapshots.length} macro snapshots, ${news.length} news items`);

  const briefing = await generatePremarketBriefing(snapshots, news);
  await storeBriefing(briefing);

  console.log("[PremarketIntelligence] Briefing stored. Risk level:", briefing.riskLevel);
  return briefing;
}
