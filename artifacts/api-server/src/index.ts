import app from "./app";
import cron from "node-cron";
import { runPipeline, isPipelineRunning } from "./lib/pipeline";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

function getNextSundayAt2AM(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setUTCHours(2, 0, 0, 0);
  const daysUntilSunday = (7 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

async function scheduledPipelineRun() {
  if (isPipelineRunning()) {
    console.log("[Scheduler] Pipeline already running, skipping scheduled run");
    return;
  }
  console.log("[Scheduler] Weekly auto-run starting...");
  try {
    await setSetting("last_auto_run", new Date().toISOString());
    await runPipeline();
    console.log("[Scheduler] Weekly auto-run complete");
  } catch (err) {
    console.error("[Scheduler] Weekly auto-run failed:", err);
  }
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);

  cron.schedule("0 2 * * 0", () => {
    scheduledPipelineRun().catch(console.error);
  }, { timezone: "UTC" });
  console.log(`[Scheduler] Weekly pipeline cron registered — next run: ${getNextSundayAt2AM().toISOString()}`);

  setTimeout(async () => {
    try {
      const lastRun = await getSetting("last_auto_run");
      if (!lastRun) {
        console.log("[Scheduler] No previous auto-run recorded, skipping startup run");
        return;
      }
      const age = Date.now() - new Date(lastRun).getTime();
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (age > SEVEN_DAYS) {
        console.log("[Scheduler] Last auto-run was >7 days ago, triggering pipeline...");
        scheduledPipelineRun().catch(console.error);
      } else {
        console.log(`[Scheduler] Last auto-run was ${Math.round(age / 3600000)}h ago — next scheduled: ${getNextSundayAt2AM().toISOString()}`);
      }
    } catch (err) {
      console.error("[Scheduler] Failed to check last auto-run:", err);
    }
  }, 5000);
});
