/**
 * OTP Service
 * In development: stores the OTP and returns the code directly (no delivery).
 * In production: delivers via Email (Resend) or WhatsApp (Twilio).
 */

import { db } from "@workspace/db";
import { otpCodesTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";

const OTP_TTL_MINUTES = 10;
const APP_NAME        = "Investment OS";
const IS_DEV          = process.env.NODE_ENV !== "production";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function storeOtp(contact: string, contactType: "email" | "whatsapp", code: string) {
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await db.insert(otpCodesTable).values({ contact, contactType, code, expiresAt, used: false });
  return expiresAt;
}

/**
 * Send OTP to an email address.
 * Returns the generated code (always in dev mode; never in production).
 */
export async function sendEmailOtp(email: string): Promise<string | null> {
  const code = generateCode();
  await storeOtp(email, "email", code);

  if (IS_DEV) {
    console.log(`[Auth][DEV] Email OTP for ${email}: ${code}`);
    return code;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured. Please add it in Secrets.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? `${APP_NAME} <noreply@resend.dev>`,
      to: [email],
      subject: `Your ${APP_NAME} login code: ${code}`,
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:40px auto;background:#0f1117;color:#fff;border-radius:12px;padding:32px;border:1px solid #222">
          <h2 style="color:#6366f1;margin-top:0">${APP_NAME}</h2>
          <p style="color:#aaa;margin-bottom:24px">Your one-time verification code:</p>
          <div style="font-size:42px;font-weight:bold;letter-spacing:12px;text-align:center;padding:20px;background:#1a1d2e;border-radius:8px;color:#fff;margin:0 auto">
            ${code}
          </div>
          <p style="color:#666;font-size:13px;margin-top:24px">
            Valid for ${OTP_TTL_MINUTES} minutes. Never share this code.
          </p>
        </div>`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Email send failed: ${err}`);
  }

  return null;
}

/**
 * Send OTP to a WhatsApp number.
 * Returns the generated code (always in dev mode; never in production).
 */
export async function sendWhatsAppOtp(phone: string): Promise<string | null> {
  const normalised = normalisePhone(phone);
  const code       = generateCode();
  await storeOtp(normalised, "whatsapp", code);

  if (IS_DEV) {
    console.log(`[Auth][DEV] WhatsApp OTP for ${normalised}: ${code}`);
    return code;
  }

  const { getTwilioClient, getTwilioFromNumber } = await import("./twilio-client");
  const client    = await getTwilioClient();
  const fromPhone = await getTwilioFromNumber();

  if (!fromPhone) throw new Error("Twilio phone number not configured in the connector.");

  await client.messages.create({
    from: `whatsapp:${fromPhone}`,
    to:   `whatsapp:${normalised}`,
    body: `Your ${APP_NAME} login code is: *${code}*\n\nValid for ${OTP_TTL_MINUTES} minutes. Do not share it.`,
  });

  return null;
}

export async function verifyOtp(
  contact: string,
  code: string,
  type: "email" | "whatsapp"
): Promise<boolean> {
  const normalised = type === "whatsapp" ? normalisePhone(contact) : contact.toLowerCase().trim();
  const now        = new Date();

  const rows = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.contact, normalised),
        eq(otpCodesTable.contactType, type),
        eq(otpCodesTable.code, code),
        eq(otpCodesTable.used, false),
        gt(otpCodesTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!rows.length) return false;

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, rows[0].id));

  return true;
}

function normalisePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}
