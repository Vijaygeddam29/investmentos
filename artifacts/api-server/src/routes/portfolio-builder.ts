import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  factorSnapshotsTable,
  priceHistoryTable,
  companiesTable,
  financialMetricsTable,
} from "@workspace/db/schema";
import { eq, desc, inArray, gte, and, isNotNull, ilike, or, sql } from "drizzle-orm";
import { detectMarketRegime, computeCompositeScore } from "../lib/market-regime";

const router: IRouter = Router();

type Strategy     = "fortress" | "rocket" | "wave";
type WeightMethod = "equal" | "score" | "risk" | "power";
type MarketCapTier = "all" | "large" | "mid" | "small";

const MARKET_CAP_RANGES: Record<MarketCapTier, [number, number]> = {
  all:   [0.5,    Infinity],
  large: [10,     Infinity],
  mid:   [2,      10],
  small: [0.5,    2],
};

const COUNTRY_ABBREVIATION_MAP: Record<string, string> = {
  US: "United States", UK: "United Kingdom", IL: "Israel",
};

function normalizeCountry(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  return COUNTRY_ABBREVIATION_MAP[raw] ?? raw;
}

function slugToCountryName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const INNOVATION_TIER: Record<string, string> = {
  NVDA: "AI Infrastructure",
  MSFT: "AI Infrastructure",
  PLTR: "AI Infrastructure",
  AMD:  "AI Infrastructure",
  AVGO: "AI Infrastructure",
  GOOGL:"AI Infrastructure",
  META: "AI Infrastructure",
  AMZN: "AI Infrastructure",
  LLY:  "GLP-1 / Biotech",
  NVO:  "GLP-1 / Biotech",
  ISRG: "GLP-1 / Biotech",
  NET:  "Next-Gen Platform",
  CRM:  "Next-Gen Platform",
  DDOG: "Next-Gen Platform",
  SNOW: "Next-Gen Platform",
  CRWD: "Next-Gen Platform",
  PANW: "Next-Gen Platform",
  NOW:  "Next-Gen Platform",
  SHOP: "Next-Gen Platform",
  TSLA: "Clean Energy / EV",
};

const INNOVATION_PREMIUM = 1.15;
const POWER_ALPHA = 1.8;
const VALUATION_PENALTY = 0.7;
const PE_THRESHOLD_MULT = 1.5;

function getScoreField(strategy: Strategy) {
  if (strategy === "fortress") return factorSnapshotsTable.fortressScore;
  if (strategy === "rocket")   return factorSnapshotsTable.rocketScore;
  return factorSnapshotsTable.waveScore;
}

function clamp(n: number, min = 0.1, max = 0.5) {
  return Math.min(max, Math.max(min, n));
}

async function batchVolatility(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 95);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      ticker: priceHistoryTable.ticker,
      date:   priceHistoryTable.date,
      close:  priceHistoryTable.close,
    })
    .from(priceHistoryTable)
    .where(
      and(
        inArray(priceHistoryTable.ticker, tickers),
        gte(priceHistoryTable.date, cutoffStr)
      )
    )
    .orderBy(priceHistoryTable.ticker, priceHistoryTable.date);

  const grouped: Record<string, number[]> = {};
  for (const r of rows) {
    if (!grouped[r.ticker]) grouped[r.ticker] = [];
    if (r.close != null) grouped[r.ticker].push(r.close);
  }

  const result: Record<string, number> = {};
  for (const ticker of tickers) {
    const prices = grouped[ticker] ?? [];
    if (prices.length < 5) { result[ticker] = 0.25; continue; }
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean     = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    result[ticker] = Math.sqrt(variance * 252);
  }
  return result;
}

function computeSectorPercentile(
  score: number,
  sector: string,
  sectorScores: Record<string, number[]>
): number {
  const peers = sectorScores[sector];
  if (!peers || peers.length <= 1) return 0.5;
  const sorted = [...peers].sort((a, b) => a - b);
  let rank = 0;
  for (const s of sorted) {
    if (s < score) rank++;
    else break;
  }
  return Math.max(0.01, Math.min(1, rank / (sorted.length - 1)));
}

async function fetchSectorPeMedians(tickers: string[], companyMap: Record<string, { sector?: string | null }>): Promise<Record<string, number>> {
  if (!tickers.length) return {};

  const [latestMetric] = await db
    .select({ date: financialMetricsTable.date })
    .from(financialMetricsTable)
    .orderBy(desc(financialMetricsTable.date))
    .limit(1);

  if (!latestMetric) return {};

  const metricsRows = await db
    .select({
      ticker: financialMetricsTable.ticker,
      peRatio: financialMetricsTable.peRatio,
    })
    .from(financialMetricsTable)
    .where(
      and(
        inArray(financialMetricsTable.ticker, tickers),
        eq(financialMetricsTable.date, latestMetric.date)
      )
    );

  const sectorPEs: Record<string, number[]> = {};
  const tickerPE: Record<string, number> = {};

  for (const r of metricsRows) {
    if (r.peRatio == null || r.peRatio <= 0 || r.peRatio > 2000) continue;
    tickerPE[r.ticker] = r.peRatio;
    const sector = companyMap[r.ticker]?.sector ?? "Unknown";
    if (!sectorPEs[sector]) sectorPEs[sector] = [];
    sectorPEs[sector].push(r.peRatio);
  }

  const medians: Record<string, number> = {};
  for (const [sector, pes] of Object.entries(sectorPEs)) {
    const sorted = [...pes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medians[sector] = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  return Object.fromEntries(
    Object.entries(tickerPE).map(([ticker, pe]) => {
      const sector = companyMap[ticker]?.sector ?? "Unknown";
      const median = medians[sector];
      return [ticker, median ? pe / median : 1.0];
    })
  );
}

router.get("/portfolio/builder", async (req, res) => {
  try {
    const strategy    = (req.query.strategy    as Strategy)      ?? "rocket";
    const size        = Math.min(30, Math.max(5, parseInt(req.query.size as string) || 10));
    const weightMethod = (req.query.weightMethod as WeightMethod) ?? "score";
    const sectorCap   = Math.min(5,  Math.max(1, parseInt(req.query.sectorCap  as string) || 2));
    const countryKey  = (req.query.country     as string)        ?? "all";
    const mktCapKey   = (req.query.marketCap   as MarketCapTier) ?? "all";

    const [mktMin, mktMax] = MARKET_CAP_RANGES[mktCapKey] ?? MARKET_CAP_RANGES.all;
    const countryFilter    = countryKey === "all" ? null : slugToCountryName(countryKey);

    const [latestRow] = await db
      .select({ date: factorSnapshotsTable.date })
      .from(factorSnapshotsTable)
      .orderBy(desc(factorSnapshotsTable.date))
      .limit(1);

    if (!latestRow) {
      res.json({ holdings: [], portfolioScore: null, snapshotDate: null, universeSize: 0 });
      return;
    }

    const snapshotDate = latestRow.date;

    const scoreField = getScoreField(strategy);
    const snapshots  = await db
      .select()
      .from(factorSnapshotsTable)
      .where(
        and(
          eq(factorSnapshotsTable.date, snapshotDate),
          isNotNull(scoreField)
        )
      )
      .orderBy(desc(scoreField));

    const tickers  = snapshots.map((s) => s.ticker);
    const companies = tickers.length
      ? await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.ticker, tickers))
      : [];

    const companyMap: Record<string, typeof companies[0]> = {};
    for (const c of companies) companyMap[c.ticker] = c;

    const filtered = snapshots.filter((s) => {
      const co = companyMap[s.ticker];
      const coCountry = normalizeCountry(co?.country);
      if (countryFilter && coCountry !== countryFilter) return false;
      if (s.marketCap == null) return mktCapKey === "all";
      if (s.marketCap < mktMin) return false;
      if (mktMax !== Infinity && s.marketCap > mktMax) return false;
      return true;
    });

    const isPowerLaw = weightMethod === "power";

    let regime = await detectMarketRegime();
    const regimeWeights = regime.weights;

    let sortedForSelection = filtered;
    if (isPowerLaw) {
      sortedForSelection = [...filtered].sort((a, b) => {
        const compA = computeCompositeScore(
          a.fortressScore ?? 0, a.rocketScore ?? 0, a.waveScore ?? 0, regimeWeights
        );
        const compB = computeCompositeScore(
          b.fortressScore ?? 0, b.rocketScore ?? 0, b.waveScore ?? 0, regimeWeights
        );
        if (Math.abs(compB - compA) > 0.001) return compB - compA;
        const getS = (s: typeof a) =>
          strategy === "fortress" ? (s.fortressScore ?? 0) :
          strategy === "rocket"  ? (s.rocketScore ?? 0) :
                                    (s.waveScore ?? 0);
        return getS(b) - getS(a);
      });
    }

    const sectorCount: Record<string, number> = {};
    const selected: typeof filtered = [];

    for (const s of sortedForSelection) {
      if (selected.length >= size) break;
      const sector = companyMap[s.ticker]?.sector ?? "Unknown";
      const count  = sectorCount[sector] ?? 0;
      if (count >= sectorCap) continue;
      selected.push(s);
      sectorCount[sector] = count + 1;
    }

    if (!selected.length) {
      res.json({ holdings: [], portfolioScore: null, snapshotDate, universeSize: filtered.length });
      return;
    }

    let vols: Record<string, number> = {};
    if (weightMethod === "risk") {
      vols = await batchVolatility(selected.map((s) => s.ticker));
    }

    const sectorScores: Record<string, number[]> = {};
    if (isPowerLaw) {
      for (const s of filtered) {
        const sector = companyMap[s.ticker]?.sector ?? "Unknown";
        const composite = computeCompositeScore(
          s.fortressScore ?? 0, s.rocketScore ?? 0, s.waveScore ?? 0, regimeWeights
        );
        if (!sectorScores[sector]) sectorScores[sector] = [];
        sectorScores[sector].push(composite);
      }
    }

    let peRatios: Record<string, number> = {};
    if (isPowerLaw) {
      peRatios = await fetchSectorPeMedians(
        tickers,
        companyMap as Record<string, { sector?: string | null }>
      );
    }

    const getScore = (s: typeof selected[0]) => {
      if (strategy === "fortress") return s.fortressScore ?? 0;
      if (strategy === "rocket")   return s.rocketScore   ?? 0;
      return s.waveScore ?? 0;
    };

    const rawWeights = selected.map((s) => {
      const score = getScore(s);
      if (weightMethod === "equal") return 1;
      if (weightMethod === "score") return score;
      if (weightMethod === "power") {
        const sector = companyMap[s.ticker]?.sector ?? "Unknown";
        const composite = computeCompositeScore(
          s.fortressScore ?? 0, s.rocketScore ?? 0, s.waveScore ?? 0, regimeWeights
        );
        const percentile = computeSectorPercentile(composite, sector, sectorScores);
        let w = Math.pow(Math.max(percentile, 0.01), POWER_ALPHA);

        const peVsMedian = peRatios[s.ticker];
        if (peVsMedian != null && peVsMedian > PE_THRESHOLD_MULT) {
          w *= VALUATION_PENALTY;
        }

        if (INNOVATION_TIER[s.ticker]) {
          w *= INNOVATION_PREMIUM;
        }

        return w;
      }
      const vol = clamp(vols[s.ticker] ?? 0.25);
      return score / vol;
    });

    const totalRaw = rawWeights.reduce((a, b) => a + b, 0) || 1;
    const weights  = rawWeights.map((w) => w / totalRaw);

    const wFortress = selected.reduce((s, h, i) => s + (h.fortressScore ?? 0) * weights[i], 0);
    const wRocket   = selected.reduce((s, h, i) => s + (h.rocketScore   ?? 0) * weights[i], 0);
    const wWave     = selected.reduce((s, h, i) => s + (h.waveScore     ?? 0) * weights[i], 0);

    const holdings = selected.map((s, i) => {
      const co = companyMap[s.ticker];
      const compositeScore = computeCompositeScore(
        s.fortressScore ?? 0, s.rocketScore ?? 0, s.waveScore ?? 0, regimeWeights
      );
      const sector = co?.sector ?? "Unknown";

      const peVsMedian = peRatios[s.ticker];
      const highValuation = isPowerLaw && peVsMedian != null && peVsMedian > PE_THRESHOLD_MULT;
      const innovationTier = INNOVATION_TIER[s.ticker] ?? null;

      let rationale = "";
      if (isPowerLaw) {
        const percentile = computeSectorPercentile(compositeScore, sector, sectorScores);
        const pctRank = Math.round(percentile * 100);
        const parts: string[] = [];
        parts.push(`P${pctRank} composite in ${sector}`);
        if (innovationTier) parts.push(`Innovation Tier: ${innovationTier}`);
        if (highValuation) parts.push("⚠ High valuation haircut");
        rationale = parts.join("; ");
      }

      const pns = (s as any).portfolioNetScore as number | null ?? null;
      const positionBand = pns != null
        ? pns >= 0.75 ? { band: "core",      label: "Core",      minPct: 6,   maxPct: 10  }
        : pns >= 0.60 ? { band: "standard",  label: "Standard",  minPct: 3,   maxPct: 5   }
        : pns >= 0.45 ? { band: "starter",   label: "Starter",   minPct: 1,   maxPct: 2.5 }
        : pns >= 0.30 ? { band: "tactical",  label: "Tactical",  minPct: 0.5, maxPct: 1   }
        :               { band: "watchlist", label: "Watchlist", minPct: 0,   maxPct: 0   }
        : null;

      return {
        rank:                  i + 1,
        ticker:                s.ticker,
        name:                  co?.name    ?? s.ticker,
        sector,
        country:               normalizeCountry(co?.country),
        weight:                weights[i],
        compositeScore,
        fortressScore:         s.fortressScore  ?? null,
        rocketScore:           s.rocketScore    ?? null,
        waveScore:             s.waveScore      ?? null,
        entryScore:            s.entryScore     ?? null,
        marketCap:             s.marketCap      ?? null,
        volatility:            weightMethod === "risk" ? (vols[s.ticker] ?? null) : null,
        highValuation,
        innovationTier,
        rationale,
        portfolioNetScore:     pns,
        expectationScore:      (s as any).expectationScore     ?? null,
        mispricingScore:       (s as any).mispricingScore      ?? null,
        fragilityScore:        (s as any).fragilityScore       ?? null,
        companyQualityScore:   (s as any).companyQualityScore  ?? null,
        stockOpportunityScore: (s as any).stockOpportunityScore ?? null,
        positionBand,
      };
    });

    res.json({
      holdings,
      portfolioScore: {
        fortress: Math.round(wFortress * 100),
        rocket:   Math.round(wRocket   * 100),
        wave:     Math.round(wWave     * 100),
      },
      snapshotDate,
      universeSize: filtered.length,
      regime: { name: regime.regime, confidence: regime.confidence },
      params: { strategy, size, weightMethod, sectorCap, country: countryKey, marketCap: mktCapKey },
    });
  } catch (err) {
    console.error("[PortfolioBuilder] Error", err);
    res.status(500).json({ error: "Failed to build portfolio" });
  }
});

router.get("/portfolio/builder/countries", async (_req, res) => {
  try {
    const rows = await db
      .select({ country: companiesTable.country })
      .from(companiesTable);

    const countMap: Record<string, number> = {};
    for (const r of rows) {
      const c = normalizeCountry(r.country);
      if (!c || c === "Unknown") continue;
      countMap[c] = (countMap[c] ?? 0) + 1;
    }

    const countries = Object.entries(countMap)
      .map(([name, count]) => ({
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    res.json({ countries });
  } catch (err) {
    console.error("[PortfolioBuilder] countries error", err);
    res.status(500).json({ error: "Failed to fetch countries" });
  }
});

router.get("/portfolio/builder/search", async (req, res) => {
  try {
    const q = ((req.query.q as string) ?? "").trim();
    if (!q || q.length < 1) {
      res.json({ results: [] });
      return;
    }

    const pattern = `%${q}%`;
    const matches = await db
      .select()
      .from(companiesTable)
      .where(
        or(
          ilike(companiesTable.ticker, pattern),
          ilike(companiesTable.name, pattern)
        )
      )
      .limit(20);

    if (!matches.length) {
      res.json({ results: [] });
      return;
    }

    const matchTickers = matches.map((c) => c.ticker);

    const [latestRow] = await db
      .select({ date: factorSnapshotsTable.date })
      .from(factorSnapshotsTable)
      .orderBy(desc(factorSnapshotsTable.date))
      .limit(1);

    let snapMap: Record<string, any> = {};
    if (latestRow) {
      const snaps = await db
        .select()
        .from(factorSnapshotsTable)
        .where(
          and(
            eq(factorSnapshotsTable.date, latestRow.date),
            inArray(factorSnapshotsTable.ticker, matchTickers)
          )
        );
      for (const s of snaps) snapMap[s.ticker] = s;
    }

    const results = matches.map((c) => {
      const s = snapMap[c.ticker];
      return {
        ticker: c.ticker,
        name: c.name ?? c.ticker,
        sector: c.sector ?? "Unknown",
        country: normalizeCountry(c.country),
        marketCap: s?.marketCap ?? null,
        fortressScore: s?.fortressScore ?? null,
        rocketScore: s?.rocketScore ?? null,
        waveScore: s?.waveScore ?? null,
        portfolioNetScore: (s as any)?.portfolioNetScore ?? null,
        companyQualityScore: (s as any)?.companyQualityScore ?? null,
        stockOpportunityScore: (s as any)?.stockOpportunityScore ?? null,
        expectationScore: (s as any)?.expectationScore ?? null,
        mispricingScore: (s as any)?.mispricingScore ?? null,
        fragilityScore: (s as any)?.fragilityScore ?? null,
      };
    });

    res.json({ results });
  } catch (err) {
    console.error("[PortfolioBuilder] search error", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
