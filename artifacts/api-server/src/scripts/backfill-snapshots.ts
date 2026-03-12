import { db } from "@workspace/db";
import { scoresTable, factorSnapshotsTable, financialMetricsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const scores = await db.select().from(scoresTable).orderBy(desc(scoresTable.date));
  const seen = new Set<string>();
  const latest = scores.filter(s => {
    if (seen.has(s.ticker)) return false;
    seen.add(s.ticker);
    return true;
  });
  console.log("Backfilling", latest.length, "tickers into factor_snapshots...");

  for (const s of latest) {
    const metrics = await db.select({ marginOfSafety: financialMetricsTable.marginOfSafety })
      .from(financialMetricsTable)
      .where(eq(financialMetricsTable.ticker, s.ticker))
      .orderBy(desc(financialMetricsTable.date))
      .limit(1);
    const m = metrics[0];

    const row = {
      ticker: s.ticker,
      date: s.date,
      fortressScore: s.fortressScore,
      rocketScore: s.rocketScore,
      waveScore: s.waveScore,
      entryScore: s.entryTimingScore,
      profitabilityScore: s.profitabilityScore,
      growthScore: s.growthScore,
      capitalEfficiencyScore: s.capitalEfficiencyScore,
      financialStrengthScore: s.financialStrengthScore,
      cashFlowQualityScore: s.cashFlowQualityScore,
      momentumScore: s.momentumScore,
      valuationScore: s.valuationScore,
      sentimentScore: s.sentimentScore,
      marginOfSafety: m?.marginOfSafety ?? null,
    };

    await db.insert(factorSnapshotsTable).values(row).onConflictDoNothing();
    console.log(`  ${s.ticker}  F:${s.fortressScore?.toFixed(2)} R:${s.rocketScore?.toFixed(2)} W:${s.waveScore?.toFixed(2)}`);
  }

  console.log("Backfill complete.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
