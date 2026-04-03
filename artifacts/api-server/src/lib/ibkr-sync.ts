/**
 * IBKR Position Sync
 *
 * Reconciles open options trades in our DB with the live positions
 * in the user's IBKR account. Runs:
 *   1. Automatically each morning at market open (Mon–Fri 08:00 UTC)
 *   2. On-demand via POST /api/options/positions/sync
 *
 * Logic:
 *   - Fetch all options positions from IBKR
 *   - Compare against open trades in our DB for that user
 *   - DB trade open, not in IBKR  → auto-close (expired/closed externally)
 *   - IBKR position, not in our DB → add as "manually placed" trade
 *   - Both match                   → update P&L if price data available
 */

import { db } from "@workspace/db";
import { optionsTradesTable, ibkrConnectionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { ibkrApiCall } from "../routes/ibkr";

export interface SyncResult {
  userId: number;
  autoClosed: number;          // Trades we closed because they disappeared from IBKR
  added: number;               // IBKR positions we added to our records
  matched: number;             // Positions already in sync
  errors: string[];
}

// Match an IBKR position to one of our DB trades
// IBKR stores options as: ticker, expiry (YYYYMMDD), strike, right (C/P)
function matchPosition(ibkrPos: IbkrPosition, dbTrade: DbTrade): boolean {
  const ibkrTicker = ibkrPos.ticker?.toUpperCase().trim();
  const dbTicker   = dbTrade.ticker?.toUpperCase().trim();
  if (ibkrTicker !== dbTicker) return false;

  const ibkrRight = ibkrPos.right?.toUpperCase().startsWith("C") ? "CALL" : "PUT";
  if (ibkrRight !== dbTrade.right?.toUpperCase()) return false;

  const dbStrike = Number(dbTrade.strike);
  const ibkrStrike = Number(ibkrPos.strike);
  if (Math.abs(dbStrike - ibkrStrike) > 0.5) return false; // 50c tolerance

  // Compare expiry
  const ibkrExpiry = parseIbkrExpiry(ibkrPos.expiry ?? "");
  if (ibkrExpiry && dbTrade.expiry) {
    if (ibkrExpiry !== dbTrade.expiry) return false;
  }

  return true;
}

function parseIbkrExpiry(raw: string): string | null {
  // IBKR formats: "20260516" or "2026-05-16" or "26MAY16" etc.
  if (!raw) return null;
  // Numeric: YYYYMMDD
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

interface IbkrPosition {
  ticker?: string;
  contractDesc?: string;
  right?: string;
  strike?: number;
  expiry?: string;
  position?: number;
  size?: number;
  mktValue?: number;
  marketValue?: number;
  avgCost?: number;
  unrealizedPnl?: number;
  assetClass?: string;
  secType?: string;
}

interface DbTrade {
  id: number;
  ticker: string;
  right: string;
  strike: number;
  expiry: string;
  premiumCollected: number | null;
  status: string;
  monthlyBucket?: string | null;
}

export async function syncIbkrPositions(userId: number): Promise<SyncResult> {
  const result: SyncResult = { userId, autoClosed: 0, added: 0, matched: 0, errors: [] };

  try {
    // 1. Get IBKR connection
    const conn = await db.select().from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, userId))
      .limit(1);

    if (!conn.length || !conn[0].accessToken || !conn[0].accountId) {
      result.errors.push("No IBKR connection found");
      return result;
    }

    const accountId = conn[0].accountId;

    // 2. Fetch positions from IBKR
    let ibkrPositions: IbkrPosition[] = [];
    try {
      const raw = await ibkrApiCall(userId, `/iserver/portfolio/${accountId}/positions/0`, "GET");
      // Filter to options only
      ibkrPositions = (raw ?? []).filter((p: IbkrPosition) =>
        p.assetClass === "OPT" || p.secType === "OPT"
      );
    } catch (err) {
      result.errors.push(`IBKR positions fetch failed: ${(err as Error).message}`);
      return result;
    }

    // 3. Get our open trades for this user
    const dbTrades = await db.select().from(optionsTradesTable)
      .where(and(
        eq(optionsTradesTable.userId, userId),
        eq(optionsTradesTable.status, "open"),
      )) as DbTrade[];

    // 4. Reconcile
    const matchedDbIds = new Set<number>();
    const matchedIbkrIndices = new Set<number>();

    for (const [di, dbTrade] of dbTrades.entries()) {
      for (const [ii, ibkrPos] of ibkrPositions.entries()) {
        if (matchedIbkrIndices.has(ii)) continue;
        if (matchPosition(ibkrPos, dbTrade)) {
          // Found a match — update P&L if available
          matchedDbIds.add(dbTrade.id);
          matchedIbkrIndices.add(ii);
          result.matched++;

          // Update unrealised P&L if IBKR gives us current market value
          const currentValue = ibkrPos.mktValue ?? ibkrPos.marketValue;
          if (currentValue != null && dbTrade.premiumCollected != null) {
            // For short options: current value is what it would cost to buy back
            // Unrealised P&L = premium collected - current buyback cost
            const unrealisedPnl = dbTrade.premiumCollected + currentValue; // mktValue is negative for short
            await db.update(optionsTradesTable)
              .set({ notes: `IBKR sync ${new Date().toISOString().slice(0,10)}: current value ${currentValue?.toFixed(2)}` })
              .where(eq(optionsTradesTable.id, dbTrade.id))
              .catch(() => {}); // non-fatal
          }
          break;
        }
      }
    }

    // 5. DB trades with no IBKR match → closed externally
    for (const dbTrade of dbTrades) {
      if (!matchedDbIds.has(dbTrade.id)) {
        // Check expiry — if already past, it's expired; if not, it was closed early
        const expiryDate = new Date(dbTrade.expiry);
        const isExpired = expiryDate < new Date();
        const newStatus = isExpired ? "expired" : "closed";
        const pnl = isExpired ? (dbTrade.premiumCollected ?? 0) : null; // expired = full premium kept

        await db.update(optionsTradesTable)
          .set({
            status:      newStatus,
            closedAt:    new Date(),
            realisedPnl: pnl,
            notes:       `Auto-closed by IBKR sync (${new Date().toISOString().slice(0, 10)}): position no longer in IBKR account`,
          })
          .where(eq(optionsTradesTable.id, dbTrade.id))
          .catch((err) => result.errors.push(`Close trade ${dbTrade.id}: ${err.message}`));

        result.autoClosed++;
      }
    }

    // 6. IBKR positions with no DB match → manually placed, add to our records
    for (const [ii, ibkrPos] of ibkrPositions.entries()) {
      if (matchedIbkrIndices.has(ii)) continue;

      const ticker = ibkrPos.ticker ?? ibkrPos.contractDesc ?? "";
      if (!ticker) continue;

      const expiry = parseIbkrExpiry(ibkrPos.expiry ?? "");
      if (!expiry) continue;

      const right = (ibkrPos.right ?? "P").toUpperCase().startsWith("C") ? "CALL" : "PUT";
      const today = new Date();
      const monthlyBucket = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

      // Estimate premium from avg cost (for short positions, avg cost is credit received)
      const estimatedPremium = ibkrPos.avgCost != null
        ? Math.abs(ibkrPos.avgCost) * Math.abs(ibkrPos.position ?? ibkrPos.size ?? 1) * 100
        : null;

      await db.insert(optionsTradesTable)
        .values({
          userId,
          ticker,
          right,
          strike:           ibkrPos.strike ?? 0,
          expiry,
          quantity:         Math.abs(ibkrPos.position ?? ibkrPos.size ?? 1),
          premiumCollected: estimatedPremium,
          openedAt:         new Date(),
          status:           "open",
          monthlyBucket,
          ibkrOrderId:      null,
          notes:            "Added by IBKR sync — manually placed trade",
        })
        .catch((err) => result.errors.push(`Add manual trade ${ticker}: ${err.message}`));

      result.added++;
    }

    console.log(
      `[IbkrSync] User ${userId}: matched=${result.matched} auto-closed=${result.autoClosed} added=${result.added}${result.errors.length ? ` errors=${result.errors.length}` : ""}`
    );
    return result;

  } catch (err) {
    result.errors.push((err as Error).message);
    console.error("[IbkrSync] Unexpected error:", err);
    return result;
  }
}

// Sync all users who have an active IBKR connection
export async function syncAllUsers(): Promise<void> {
  try {
    const connections = await db.select({ userId: ibkrConnectionsTable.userId })
      .from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.status, "connected"));

    console.log(`[IbkrSync] Syncing ${connections.length} connected accounts...`);

    for (const { userId } of connections) {
      await syncIbkrPositions(userId).catch((err) =>
        console.error(`[IbkrSync] Failed for user ${userId}:`, err)
      );
    }
  } catch (err) {
    console.error("[IbkrSync] syncAllUsers failed:", err);
  }
}
