/**
 * IBKR Web API — OAuth + Account Routes
 *
 * OAuth flow:
 *   GET /api/ibkr/connect    → redirects user to IBKR OAuth authorize page
 *   GET /api/ibkr/callback   → receives auth code, exchanges for tokens, stores
 *   GET /api/ibkr/status     → returns connection status + account summary
 *   DELETE /api/ibkr/disconnect → revokes connection
 *
 * IBKR Developer Portal: https://www.interactivebrokers.com/en/trading/ib-api.php
 * Register your app to get IBKR_CLIENT_ID + IBKR_CLIENT_SECRET
 * Set IBKR_REDIRECT_URI to: https://invest.marketlifes.co.uk/api/ibkr/callback
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ibkrConnectionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthPayload } from "../middleware/auth";

const router: IRouter = Router();

const IBKR_BASE_URL  = "https://api.ibkr.com/v1/api";
const CLIENT_ID      = () => process.env.IBKR_CLIENT_ID ?? "";
const CLIENT_SECRET  = () => process.env.IBKR_CLIENT_SECRET ?? "";
const REDIRECT_URI   = () => process.env.IBKR_REDIRECT_URI ?? "https://invest.marketlifes.co.uk/api/ibkr/callback";
const FRONTEND_URL   = () => process.env.FRONTEND_URL ?? "https://invest.marketlifes.co.uk";

// ─── Helper: IBKR API call with stored token ──────────────────────────────────

export async function ibkrApiCall(
  userId: number,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: object,
): Promise<any> {
  const conn = await db
    .select()
    .from(ibkrConnectionsTable)
    .where(eq(ibkrConnectionsTable.userId, userId))
    .limit(1);

  if (!conn.length || !conn[0].accessToken) {
    throw new Error("No IBKR connection found for user");
  }

  const { accessToken } = conn[0];

  const res = await fetch(`${IBKR_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`IBKR API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── Helper: Refresh token ────────────────────────────────────────────────────

async function refreshIbkrToken(userId: number): Promise<boolean> {
  const conn = await db
    .select()
    .from(ibkrConnectionsTable)
    .where(eq(ibkrConnectionsTable.userId, userId))
    .limit(1);

  if (!conn.length || !conn[0].refreshToken) return false;

  try {
    const res = await fetch(`${IBKR_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: conn[0].refreshToken,
        client_id:     CLIENT_ID(),
        client_secret: CLIENT_SECRET(),
      }).toString(),
    });

    if (!res.ok) return false;

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);

    await db.update(ibkrConnectionsTable)
      .set({
        accessToken:    data.access_token,
        refreshToken:   data.refresh_token ?? conn[0].refreshToken,
        tokenExpiresAt: expiresAt,
        lastSyncAt:     new Date(),
      })
      .where(eq(ibkrConnectionsTable.userId, userId));

    return true;
  } catch {
    return false;
  }
}

// ─── GET /api/ibkr/connect ────────────────────────────────────────────────────

router.get("/ibkr/connect", requireAuth, (req, res) => {
  const clientId = CLIENT_ID();
  if (!clientId) {
    res.status(503).json({
      error: "IBKR integration not configured. Please set IBKR_CLIENT_ID and IBKR_CLIENT_SECRET.",
      setupRequired: true,
    });
    return;
  }

  const user = (req as any).user as AuthPayload;
  const state = Buffer.from(JSON.stringify({ userId: user.userId, ts: Date.now() })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI(),
    scope:         "trading",
    state,
  });

  const authUrl = `${IBKR_BASE_URL}/oauth/authorize?${params.toString()}`;
  res.json({ authUrl });
});

// ─── GET /api/ibkr/callback ───────────────────────────────────────────────────

router.get("/ibkr/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(`${FRONTEND_URL()}/settings?ibkr=error&reason=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.redirect(`${FRONTEND_URL()}/settings?ibkr=error&reason=missing_params`);
    return;
  }

  let userId: number;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userId = decoded.userId;
    if (!userId) throw new Error("No userId in state");
  } catch {
    res.redirect(`${FRONTEND_URL()}/settings?ibkr=error&reason=invalid_state`);
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(`${IBKR_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  REDIRECT_URI(),
        client_id:     CLIENT_ID(),
        client_secret: CLIENT_SECRET(),
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[IBKR] Token exchange failed:", errText);
      res.redirect(`${FRONTEND_URL()}/settings?ibkr=error&reason=token_exchange_failed`);
      return;
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

    // Store connection
    await db
      .insert(ibkrConnectionsTable)
      .values({
        userId,
        accessToken:    tokens.access_token,
        refreshToken:   tokens.refresh_token ?? null,
        tokenExpiresAt: expiresAt,
        connectedAt:    new Date(),
        lastSyncAt:     new Date(),
      })
      .onConflictDoUpdate({
        target: ibkrConnectionsTable.userId,
        set: {
          accessToken:    tokens.access_token,
          refreshToken:   tokens.refresh_token ?? null,
          tokenExpiresAt: expiresAt,
          lastSyncAt:     new Date(),
        },
      });

    // Try to fetch account summary
    try {
      const accounts = await ibkrApiCall(userId, "/iserver/accounts");
      const accountId = accounts?.accounts?.[0] ?? null;

      if (accountId) {
        const summary = await ibkrApiCall(userId, `/portfolio/${accountId}/summary`);
        const nlv   = summary?.netliquidation?.amount ?? null;
        const bp    = summary?.buyingpower?.amount ?? null;
        const curr  = summary?.netliquidation?.currency ?? "USD";

        await db.update(ibkrConnectionsTable)
          .set({ accountId, netLiquidation: nlv, buyingPower: bp, accountCurrency: curr })
          .where(eq(ibkrConnectionsTable.userId, userId));
      }
    } catch {
      // Non-fatal — account sync can fail on first connect
    }

    res.redirect(`${FRONTEND_URL()}/settings?ibkr=connected`);
  } catch (err) {
    console.error("[IBKR] Callback error:", err);
    res.redirect(`${FRONTEND_URL()}/settings?ibkr=error&reason=server_error`);
  }
});

// ─── GET /api/ibkr/status ─────────────────────────────────────────────────────

router.get("/ibkr/status", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;

  try {
    const conn = await db
      .select()
      .from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    if (!conn.length) {
      res.json({ connected: false });
      return;
    }

    const c = conn[0];
    const isExpired = c.tokenExpiresAt ? c.tokenExpiresAt < new Date() : false;

    // Try to refresh if expired
    if (isExpired && c.refreshToken) {
      await refreshIbkrToken(user.userId);
    }

    // Sync account balance
    try {
      if (c.accountId) {
        const summary = await ibkrApiCall(user.userId, `/portfolio/${c.accountId}/summary`);
        const nlv  = summary?.netliquidation?.amount ?? c.netLiquidation;
        const bp   = summary?.buyingpower?.amount ?? c.buyingPower;
        await db.update(ibkrConnectionsTable)
          .set({ netLiquidation: nlv, buyingPower: bp, lastSyncAt: new Date() })
          .where(eq(ibkrConnectionsTable.userId, user.userId));
        c.netLiquidation = nlv;
        c.buyingPower = bp;
      }
    } catch {
      // Non-fatal
    }

    res.json({
      connected:      true,
      accountId:      c.accountId,
      currency:       c.accountCurrency,
      netLiquidation: c.netLiquidation,
      buyingPower:    c.buyingPower,
      connectedAt:    c.connectedAt,
      lastSyncAt:     c.lastSyncAt,
    });
  } catch (err) {
    console.error("[IBKR] Status error:", err);
    res.status(500).json({ error: "Failed to fetch IBKR status" });
  }
});

// ─── DELETE /api/ibkr/disconnect ─────────────────────────────────────────────

router.delete("/ibkr/disconnect", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;

  try {
    await db.delete(ibkrConnectionsTable).where(eq(ibkrConnectionsTable.userId, user.userId));
    res.json({ success: true });
  } catch (err) {
    console.error("[IBKR] Disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect IBKR account" });
  }
});

// ─── GET /api/ibkr/positions ──────────────────────────────────────────────────

router.get("/ibkr/positions", requireAuth, async (req, res) => {
  const user = (req as any).user as AuthPayload;

  try {
    const conn = await db
      .select({ accountId: ibkrConnectionsTable.accountId })
      .from(ibkrConnectionsTable)
      .where(eq(ibkrConnectionsTable.userId, user.userId))
      .limit(1);

    if (!conn.length || !conn[0].accountId) {
      res.json({ positions: [], connected: false });
      return;
    }

    const positions = await ibkrApiCall(user.userId, `/portfolio/${conn[0].accountId}/positions/0`);
    res.json({ positions: positions ?? [], connected: true });
  } catch (err) {
    console.error("[IBKR] Positions error:", err);
    res.status(500).json({ error: "Failed to fetch positions from IBKR" });
  }
});

export default router;
