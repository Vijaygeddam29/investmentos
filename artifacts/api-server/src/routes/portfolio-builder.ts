import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  factorSnapshotsTable,
  priceHistoryTable,
  companiesTable,
} from "@workspace/db/schema";
import { eq, desc, inArray, gte, and, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

type Strategy     = "fortress" | "rocket" | "wave";
type WeightMethod = "equal" | "score" | "risk";
type Country      = "all" | "us" | "uk" | "india";
type MarketCapTier = "all" | "large" | "mid" | "small";

// marketCap in factor_snapshots is stored in billions (e.g. 283.7 = $283.7B)
const MARKET_CAP_RANGES: Record<MarketCapTier, [number, number]> = {
  all:   [0.5,    Infinity], // min $500M = 0.5B
  large: [10,     Infinity], // $10B+
  mid:   [2,      10],       // $2B – $10B
  small: [0.5,    2],        // $500M – $2B
};

const COUNTRY_MAP: Record<Country, string | null> = {
  all:   null,
  us:    "US",
  uk:    "UK",
  india: "India",
};

function getScoreField(strategy: Strategy) {
  if (strategy === "fortress") return factorSnapshotsTable.fortressScore;
  if (strategy === "rocket")   return factorSnapshotsTable.rocketScore;
  return factorSnapshotsTable.waveScore;
}

function clamp(n: number, min = 0.1, max = 0.5) {
  return Math.min(max, Math.max(min, n));
}

/** 90-day annualised volatility for a set of tickers, computed from a
 *  single batch price query. Returns a map ticker → vol (defaults to 0.25). */
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

// ─── GET /api/portfolio/builder ──────────────────────────────────────────────
router.get("/portfolio/builder", async (req, res) => {
  try {
    const strategy    = (req.query.strategy    as Strategy)      ?? "rocket";
    const size        = Math.min(30, Math.max(5, parseInt(req.query.size as string) || 10));
    const weightMethod = (req.query.weightMethod as WeightMethod) ?? "score";
    const sectorCap   = Math.min(5,  Math.max(1, parseInt(req.query.sectorCap  as string) || 2));
    const countryKey  = (req.query.country     as Country)       ?? "all";
    const mktCapKey   = (req.query.marketCap   as MarketCapTier) ?? "all";

    const [mktMin, mktMax] = MARKET_CAP_RANGES[mktCapKey] ?? MARKET_CAP_RANGES.all;
    const countryFilter    = COUNTRY_MAP[countryKey] ?? null;

    // ── 1. Find the latest snapshot date ──────────────────────────────────────
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

    // ── 2. Fetch all snapshots for that date ──────────────────────────────────
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

    // ── 3. Join company metadata ──────────────────────────────────────────────
    const tickers  = snapshots.map((s) => s.ticker);
    const companies = tickers.length
      ? await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.ticker, tickers))
      : [];

    const companyMap: Record<string, typeof companies[0]> = {};
    for (const c of companies) companyMap[c.ticker] = c;

    // ── 4. Filter by country and market-cap tier ──────────────────────────────
    const filtered = snapshots.filter((s) => {
      const co = companyMap[s.ticker];
      if (countryFilter && co?.country !== countryFilter) return false;
      // If mkt cap is null, only allow through when tier is "all"
      if (s.marketCap == null) return mktCapKey === "all";
      // mktMin/mktMax are in billions (same unit as DB)
      if (s.marketCap < mktMin) return false;
      if (mktMax !== Infinity && s.marketCap > mktMax) return false;
      return true;
    });

    // ── 5. Iterative sector-cap fill ─────────────────────────────────────────
    const sectorCount: Record<string, number> = {};
    const selected: typeof filtered = [];

    for (const s of filtered) {
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

    // ── 6. Compute weights ────────────────────────────────────────────────────
    let vols: Record<string, number> = {};
    if (weightMethod === "risk") {
      vols = await batchVolatility(selected.map((s) => s.ticker));
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
      const vol = clamp(vols[s.ticker] ?? 0.25);
      return score / vol;
    });

    const totalRaw = rawWeights.reduce((a, b) => a + b, 0) || 1;
    const weights  = rawWeights.map((w) => w / totalRaw);

    // ── 7. Compute portfolio-level aggregate scores (weighted average) ────────
    const wFortress = selected.reduce((s, h, i) => s + (h.fortressScore ?? 0) * weights[i], 0);
    const wRocket   = selected.reduce((s, h, i) => s + (h.rocketScore   ?? 0) * weights[i], 0);
    const wWave     = selected.reduce((s, h, i) => s + (h.waveScore     ?? 0) * weights[i], 0);

    // ── 8. Build response ─────────────────────────────────────────────────────
    const holdings = selected.map((s, i) => {
      const co = companyMap[s.ticker];
      const compositeScore =
        (s.fortressScore ?? 0) * 0.40 +
        (s.rocketScore   ?? 0) * 0.35 +
        (s.waveScore     ?? 0) * 0.25;

      return {
        rank:           i + 1,
        ticker:         s.ticker,
        name:           co?.name    ?? s.ticker,
        sector:         co?.sector  ?? "Unknown",
        country:        co?.country ?? "Unknown",
        weight:         weights[i],
        compositeScore,
        fortressScore:  s.fortressScore  ?? null,
        rocketScore:    s.rocketScore    ?? null,
        waveScore:      s.waveScore      ?? null,
        entryScore:     s.entryScore     ?? null,
        marketCap:      s.marketCap      ?? null,
        volatility:     weightMethod === "risk" ? (vols[s.ticker] ?? null) : null,
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
      params: { strategy, size, weightMethod, sectorCap, country: countryKey, marketCap: mktCapKey },
    });
  } catch (err) {
    console.error("[PortfolioBuilder] Error", err);
    res.status(500).json({ error: "Failed to build portfolio" });
  }
});

export default router;
