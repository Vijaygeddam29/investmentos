import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const otpCodesTable = pgTable("otp_codes", {
  id:          serial("id").primaryKey(),
  contact:     text("contact").notNull(),
  contactType: text("contact_type").notNull(),
  code:        text("code").notNull(),
  expiresAt:   timestamp("expires_at").notNull(),
  used:        boolean("used").default(false).notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type OtpCode = typeof otpCodesTable.$inferSelect;
