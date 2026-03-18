import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const analyticsEvents = pgTable("analytics_events", {
  id:        serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId:    integer("user_id"),
  eventType: text("event_type").notNull(),
  page:      text("page").notNull(),
  referrer:  text("referrer"),
  durationMs: integer("duration_ms"),
  properties: text("properties"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
