import { Resend } from "resend";

const NOTIFY_EMAIL = "vijay@marketlifes.com";
const FALLBACK_FROM = "Investment OS <noreply@marketlifes.co.uk>";

async function getResendClient(): Promise<{ client: Resend; from: string }> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (hostname && xReplitToken) {
    try {
      const res = await fetch(
        `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
        {
          headers: {
            Accept: "application/json",
            "X-Replit-Token": xReplitToken,
          },
        },
      );
      const data = await res.json();
      const settings = data.items?.[0]?.settings;
      if (settings?.api_key) {
        const fromEmail = settings.from_email
          ? `Investment OS <${settings.from_email}>`
          : FALLBACK_FROM;
        return { client: new Resend(settings.api_key), from: fromEmail };
      }
    } catch (err) {
      console.warn("[Mailer] Connector fetch failed, falling back to env key:", err);
    }
  }

  const envKey = process.env["RESEND_API_KEY"];
  if (!envKey) throw new Error("No Resend API key available");
  return { client: new Resend(envKey), from: FALLBACK_FROM };
}

function badge(score: number): string {
  if (score >= 0.75) return `<span style="background:#16a34a;color:#fff;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700">CORE</span>`;
  if (score >= 0.6)  return `<span style="background:#2563eb;color:#fff;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700">STRONG</span>`;
  if (score >= 0.45) return `<span style="background:#7c3aed;color:#fff;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700">STARTER</span>`;
  return `<span style="background:#6b7280;color:#fff;padding:2px 7px;border-radius:4px;font-size:11px">WATCH</span>`;
}

function scoreBar(score: number, color: string): string {
  const pct = Math.round(score * 100);
  return `<div style="display:flex;align-items:center;gap:8px">
    <div style="flex:1;background:#1f2937;border-radius:3px;height:6px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
    </div>
    <span style="font-family:monospace;font-size:12px;color:#e5e7eb;min-width:32px">${pct}</span>
  </div>`;
}

interface TopStock {
  ticker: string;
  company?: string;
  fortressScore?: number | null;
  rocketScore?: number | null;
  waveScore?: number | null;
}

interface PipelineReportData {
  processed: number;
  failed: number;
  updated: number;
  fmpCount: number;
  yahooCount: number;
  nextRunDate: string;
  topFortress: TopStock[];
  topRocket: TopStock[];
  newOpportunities: { ticker: string; alertType: string; score: number }[];
  highRisk: { ticker: string; signalType: string; severity: string; description: string }[];
}

export async function sendPipelineReport(data: PipelineReportData): Promise<void> {
  const { client, from } = await getResendClient();

  const fortressRows = data.topFortress.map(s =>
    `<tr>
      <td style="padding:8px 12px;font-weight:600;color:#f1f5f9">${s.ticker}</td>
      <td style="padding:8px 12px;color:#94a3b8;font-size:13px">${s.company ?? ""}</td>
      <td style="padding:8px 12px">${badge(s.fortressScore ?? 0)}</td>
      <td style="padding:8px 12px;width:140px">${scoreBar(s.fortressScore ?? 0, "#16a34a")}</td>
    </tr>`
  ).join("");

  const rocketRows = data.topRocket.map(s =>
    `<tr>
      <td style="padding:8px 12px;font-weight:600;color:#f1f5f9">${s.ticker}</td>
      <td style="padding:8px 12px;color:#94a3b8;font-size:13px">${s.company ?? ""}</td>
      <td style="padding:8px 12px">${badge(s.rocketScore ?? 0)}</td>
      <td style="padding:8px 12px;width:140px">${scoreBar(s.rocketScore ?? 0, "#6366f1")}</td>
    </tr>`
  ).join("");

  const oppRows = data.newOpportunities.length
    ? data.newOpportunities.map(o =>
        `<tr>
          <td style="padding:6px 12px;font-weight:600;color:#f1f5f9">${o.ticker}</td>
          <td style="padding:6px 12px;color:#86efac;font-size:13px">${o.alertType}</td>
          <td style="padding:6px 12px;font-family:monospace;color:#fbbf24">${Math.round(o.score * 100)}</td>
        </tr>`
      ).join("")
    : `<tr><td colspan="3" style="padding:8px 12px;color:#6b7280;font-style:italic">No new opportunities this week</td></tr>`;

  const riskRows = data.highRisk.length
    ? data.highRisk.map(r =>
        `<tr>
          <td style="padding:6px 12px;font-weight:600;color:#f1f5f9">${r.ticker}</td>
          <td style="padding:6px 12px;color:#fca5a5;font-size:13px">${r.signalType}</td>
          <td style="padding:6px 12px;color:#94a3b8;font-size:12px">${r.description}</td>
        </tr>`
      ).join("")
    : `<tr><td colspan="3" style="padding:8px 12px;color:#6b7280;font-style:italic">No high-risk signals this week</td></tr>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px">

    <div style="margin-bottom:32px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-bottom:8px">Investment OS · Weekly Report</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#f8fafc">Pipeline Complete</h1>
      <p style="margin:8px 0 0;color:#64748b;font-size:14px">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
      ${[
        { label: "Processed", value: data.processed, color: "#6366f1" },
        { label: "Updated", value: data.updated, color: "#16a34a" },
        { label: "Failed", value: data.failed, color: data.failed > 0 ? "#ef4444" : "#374151" },
        { label: "FMP / YF", value: `${data.fmpCount} / ${data.yahooCount}`, color: "#0ea5e9" },
      ].map(m => `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${m.label}</div>
          <div style="font-size:22px;font-weight:700;color:${m.color}">${m.value}</div>
        </div>`).join("")}
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;margin-bottom:20px;overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid #334155">
        <span style="font-size:13px;font-weight:600;color:#f1f5f9">Top Fortress Compounders</span>
        <span style="font-size:11px;color:#475569;margin-left:8px">Long-term quality</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${fortressRows || `<tr><td style="padding:12px;color:#6b7280;font-style:italic">No scores available</td></tr>`}
      </table>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;margin-bottom:20px;overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid #334155">
        <span style="font-size:13px;font-weight:600;color:#f1f5f9">Top Rocket Stocks</span>
        <span style="font-size:11px;color:#475569;margin-left:8px">High-growth innovators</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${rocketRows || `<tr><td style="padding:12px;color:#6b7280;font-style:italic">No scores available</td></tr>`}
      </table>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;margin-bottom:20px;overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid #334155">
        <span style="font-size:13px;font-weight:600;color:#86efac">New Opportunities</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${oppRows}
      </table>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;margin-bottom:28px;overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid #334155">
        <span style="font-size:13px;font-weight:600;color:#fca5a5">Risk Signals</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${riskRows}
      </table>
    </div>

    <div style="background:#0ea5e920;border:1px solid #0ea5e940;border-radius:8px;padding:14px 16px;font-size:13px;color:#7dd3fc">
      Next auto-run: <strong style="color:#bae6fd">${data.nextRunDate}</strong> · Every Sunday at 02:00 UTC
    </div>

    <div style="margin-top:24px;font-size:11px;color:#374151;text-align:center">
      Investment OS · Automated weekly report · <a href="#" style="color:#475569">Manage preferences</a>
    </div>
  </div>
</body>
</html>`;

  await client.emails.send({
    from,
    to: [NOTIFY_EMAIL],
    subject: `📊 Weekly Pipeline Report — ${data.processed} stocks, ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    html,
  });

  console.log(`[Mailer] Pipeline report sent to ${NOTIFY_EMAIL}`);
}

export async function sendSignalAlert(alerts: {
  ticker: string;
  type: "opportunity" | "risk";
  title: string;
  detail: string;
  score?: number;
}[]): Promise<void> {
  if (alerts.length === 0) return;
  const { client, from } = await getResendClient();

  const rows = alerts.map(a => {
    const color = a.type === "opportunity" ? "#16a34a" : "#ef4444";
    const label = a.type === "opportunity" ? "OPPORTUNITY" : "RISK";
    return `<tr>
      <td style="padding:10px 14px;font-weight:600;color:#f1f5f9;white-space:nowrap">${a.ticker}</td>
      <td style="padding:10px 14px">
        <span style="background:${color}30;color:${color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${label}</span>
      </td>
      <td style="padding:10px 14px;font-size:13px;color:#94a3b8">${a.title}</td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b">${a.detail}</td>
      ${a.score != null ? `<td style="padding:10px 14px;font-family:monospace;color:#fbbf24;font-weight:700">${Math.round(a.score * 100)}</td>` : "<td></td>"}
    </tr>`;
  }).join("");

  const opps = alerts.filter(a => a.type === "opportunity").length;
  const risks = alerts.filter(a => a.type === "risk").length;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px">
    <div style="margin-bottom:24px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-bottom:8px">Investment OS · Signal Alert</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#f8fafc">${alerts.length} New Signal${alerts.length > 1 ? "s" : ""}</h1>
      <p style="margin:6px 0 0;color:#64748b;font-size:13px">${opps} opportunit${opps !== 1 ? "ies" : "y"} · ${risks} risk${risks !== 1 ? "s" : ""} · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
    </div>
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f172a">
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#475569;font-weight:600;text-transform:uppercase">Ticker</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#475569;font-weight:600;text-transform:uppercase">Type</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#475569;font-weight:600;text-transform:uppercase">Signal</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#475569;font-weight:600;text-transform:uppercase">Detail</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;color:#475569;font-weight:600;text-transform:uppercase">Score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:24px;font-size:11px;color:#374151;text-align:center">
      Investment OS · Real-time signal alerts
    </div>
  </div>
</body>
</html>`;

  await client.emails.send({
    from,
    to: [NOTIFY_EMAIL],
    subject: `🔔 ${opps > 0 ? `${opps} New Opportunit${opps > 1 ? "ies" : "y"}` : ""}${opps > 0 && risks > 0 ? " + " : ""}${risks > 0 ? `${risks} Risk Signal${risks > 1 ? "s" : ""}` : ""} — Investment OS`,
    html,
  });

  console.log(`[Mailer] Signal alert (${opps} opps, ${risks} risks) sent to ${NOTIFY_EMAIL}`);
}

// ─── Pre-Market Briefing Email ─────────────────────────────────────────────────

export interface PremarketBriefingEmailData {
  date: string;
  macroMood: string;
  riskLevel: string;
  sectorAlerts: Array<{ sector: string; direction: string; reason: string }>;
  companyAlerts: Array<{ ticker: string; name: string; headline: string; impact: string }>;
  optionsImplications: string;
  watchList: Array<{ item: string; reason: string }>;
  positionSizeMultiplier: number;
}

const riskColors: Record<string, string> = {
  low:      "#16a34a",
  moderate: "#2563eb",
  elevated: "#d97706",
  high:     "#dc2626",
};

export async function sendPremarketBriefingEmail(data: PremarketBriefingEmailData): Promise<void> {
  const { client, from } = await getResendClient();

  const riskColor = riskColors[data.riskLevel] ?? "#64748b";
  const dateStr = new Date(data.date).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const sectorRows = data.sectorAlerts.map((s) => {
    const dirColor = s.direction === "positive" ? "#16a34a" : s.direction === "negative" ? "#dc2626" : "#64748b";
    const arrow = s.direction === "positive" ? "↑" : s.direction === "negative" ? "↓" : "→";
    return `<tr>
      <td style="padding:8px 14px;color:#e2e8f0;font-size:13px">${s.sector}</td>
      <td style="padding:8px 14px;color:${dirColor};font-size:13px;font-weight:600">${arrow} ${s.direction.toUpperCase()}</td>
      <td style="padding:8px 14px;color:#94a3b8;font-size:12px">${s.reason}</td>
    </tr>`;
  }).join("");

  const watchItems = data.watchList.map((w) =>
    `<li style="margin-bottom:6px;color:#e2e8f0;font-size:13px"><strong>${w.item}</strong>: <span style="color:#94a3b8">${w.reason}</span></li>`
  ).join("");

  const sizeWarning = data.positionSizeMultiplier < 0.9
    ? `<div style="background:#7c3aed20;border:1px solid #7c3aed;border-radius:6px;padding:12px 16px;margin-top:16px">
        <strong style="color:#c4b5fd">⚠️ Position Sizing Alert:</strong>
        <span style="color:#ddd6fe;margin-left:8px">Reduce position sizes to ${Math.round(data.positionSizeMultiplier * 100)}% of normal today.</span>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px">
    <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:12px;padding:24px;margin-bottom:20px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin-bottom:8px">Investment OS · Pre-Market Intelligence</div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc">${dateStr}</h1>
      <div style="margin-top:10px;display:inline-block;background:${riskColor};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase">
        Risk: ${data.riskLevel}
      </div>
    </div>

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;margin-bottom:16px">
      <div style="font-size:11px;text-transform:uppercase;color:#475569;margin-bottom:8px">Macro Mood</div>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6">${data.macroMood}</p>
      ${sizeWarning}
    </div>

    ${data.sectorAlerts.length > 0 ? `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <div style="padding:14px 16px;background:#0f172a;font-size:11px;text-transform:uppercase;color:#475569">Sector Alerts</div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${sectorRows}</tbody>
      </table>
    </div>` : ""}

    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;margin-bottom:16px">
      <div style="font-size:11px;text-transform:uppercase;color:#475569;margin-bottom:10px">Options Strategy Today</div>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6">${data.optionsImplications}</p>
    </div>

    ${data.watchList.length > 0 ? `
    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;margin-bottom:16px">
      <div style="font-size:11px;text-transform:uppercase;color:#475569;margin-bottom:10px">Watch List Today</div>
      <ul style="margin:0;padding-left:20px">${watchItems}</ul>
    </div>` : ""}

    <div style="text-align:center;margin-top:24px">
      <a href="https://invest.marketlifes.co.uk/options/signals" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Signals Dashboard</a>
    </div>
    <div style="margin-top:24px;font-size:11px;color:#374151;text-align:center">Investment OS · Pre-Market Intelligence · ${dateStr}</div>
  </div>
</body>
</html>`;

  await client.emails.send({
    from,
    to: [NOTIFY_EMAIL],
    subject: `🌅 Pre-Market Briefing — ${data.riskLevel.toUpperCase()} risk · ${dateStr}`,
    html,
  });

  console.log(`[Mailer] Pre-market briefing sent for ${data.date}`);
}
