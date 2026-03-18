import type { Request, Response, NextFunction } from "express";

interface EndpointStat {
  hits: number;
  errors: number;
  totalMs: number;
}

const stats: Record<string, EndpointStat> = {};
let totalRequests = 0;
let totalErrors = 0;
const recentResponseTimes: number[] = [];
const startedAt = new Date().toISOString();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const t0 = Date.now();
  totalRequests++;

  const key = `${req.method} ${req.route?.path ?? req.path}`;

  res.on("finish", () => {
    const ms = Date.now() - t0;
    recentResponseTimes.push(ms);
    if (recentResponseTimes.length > 200) recentResponseTimes.shift();

    if (!stats[key]) stats[key] = { hits: 0, errors: 0, totalMs: 0 };
    stats[key].hits++;
    stats[key].totalMs += ms;

    if (res.statusCode >= 500) {
      totalErrors++;
      stats[key].errors++;
    }
  });

  next();
}

export function getApiMetrics() {
  const avgResponseMs = recentResponseTimes.length
    ? Math.round(recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length)
    : 0;

  const topEndpoints = Object.entries(stats)
    .map(([endpoint, s]) => ({
      endpoint,
      hits: s.hits,
      errors: s.errors,
      avgMs: s.hits ? Math.round(s.totalMs / s.hits) : 0,
      errorRate: s.hits ? +(s.errors / s.hits * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 15);

  return {
    totalRequests,
    totalErrors,
    errorRate: totalRequests ? +(totalErrors / totalRequests * 100).toFixed(1) : 0,
    avgResponseMs,
    uptimeSince: startedAt,
    topEndpoints,
  };
}
