/**
 * Auth routes
 *  POST /api/auth/request-otp  — send OTP to email or WhatsApp
 *  POST /api/auth/verify-otp   — verify code, return JWT
 *  GET  /api/auth/me           — return current user (requires JWT)
 *  POST /api/auth/logout       — client-side only (stateless JWT), returns 200
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendEmailOtp, sendWhatsAppOtp, verifyOtp } from "../lib/otp-service";
import { signToken, requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function normaliseContact(contact: string, type: "email" | "whatsapp"): string {
  if (type === "email") return contact.toLowerCase().trim();
  const digits = contact.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function upsertUser(contact: string, type: "email" | "whatsapp") {
  const where = type === "email"
    ? eq(usersTable.email, contact)
    : eq(usersTable.phone, contact);

  const existing = await db.select().from(usersTable).where(where).limit(1);
  if (existing.length) return existing[0];

  const values = type === "email"
    ? { email: contact, verified: false }
    : { phone: contact, verified: false };

  const [user] = await db.insert(usersTable).values(values).returning();
  return user;
}

router.post("/auth/request-otp", async (req, res) => {
  try {
    const { contact, type } = req.body as { contact: string; type: "email" | "whatsapp" };

    if (!contact || !type) {
      res.status(400).json({ error: "contact and type are required" });
      return;
    }
    if (type !== "email" && type !== "whatsapp") {
      res.status(400).json({ error: "type must be 'email' or 'whatsapp'" });
      return;
    }

    const normalised = normaliseContact(contact, type);

    if (type === "email") {
      await sendEmailOtp(normalised);
    } else {
      await sendWhatsAppOtp(normalised);
    }

    res.json({ ok: true, message: `OTP sent to ${type === "email" ? normalised : contact}` });
  } catch (err: any) {
    console.error("[Auth] request-otp error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  try {
    const { contact, type, code } = req.body as {
      contact: string;
      type: "email" | "whatsapp";
      code: string;
    };

    if (!contact || !type || !code) {
      res.status(400).json({ error: "contact, type, and code are required" });
      return;
    }

    const normalised = normaliseContact(contact, type);
    const valid = await verifyOtp(normalised, code.trim(), type);

    if (!valid) {
      res.status(401).json({ error: "Invalid or expired code. Please request a new one." });
      return;
    }

    const user = await upsertUser(normalised, type);

    await db
      .update(usersTable)
      .set({ verified: true, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const token = signToken({
      userId: user.id,
      contact: normalised,
      contactType: type,
    });

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        name: user.name,
        verified: true,
      },
    });
  } catch (err: any) {
    console.error("[Auth] verify-otp error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const payload = (req as any).user;
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { id, email, phone, name, verified, createdAt } = user[0];
    res.json({ user: { id, email, phone, name, verified, createdAt } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

export default router;
