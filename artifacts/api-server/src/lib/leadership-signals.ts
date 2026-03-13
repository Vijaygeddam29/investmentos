/**
 * Leadership Quality & Conviction — Static Lookup
 *
 * Provides structural leadership signals for the 48-ticker universe.
 * These are curated facts that don't change frequently.
 * Updated manually when leadership changes occur.
 *
 * founderLed    : CEO is the original company founder
 * dualClass     : Company has dual-class share structure giving founders/insiders super-voting rights
 * ceoTenureYears: Approximate years the current CEO has been in the role
 * visionRating  : Curated qualitative assessment of CEO vision & execution track record
 */

export type VisionRating = "HIGH" | "MEDIUM" | "LOW";

export interface LeadershipSignal {
  founderLed: boolean;
  dualClass: boolean;
  ceoTenureYears: number;
  visionRating: VisionRating;
}

export const LEADERSHIP_SIGNALS: Record<string, LeadershipSignal> = {
  AAPL:  { founderLed: false, dualClass: false, ceoTenureYears: 14, visionRating: "HIGH" },
  MSFT:  { founderLed: false, dualClass: false, ceoTenureYears: 11, visionRating: "HIGH" },
  GOOGL: { founderLed: false, dualClass: true,  ceoTenureYears: 10, visionRating: "MEDIUM" },
  META:  { founderLed: true,  dualClass: true,  ceoTenureYears: 20, visionRating: "HIGH" },
  NVDA:  { founderLed: true,  dualClass: false, ceoTenureYears: 31, visionRating: "HIGH" },
  TSLA:  { founderLed: true,  dualClass: false, ceoTenureYears: 16, visionRating: "HIGH" },
  AMZN:  { founderLed: false, dualClass: false, ceoTenureYears: 3,  visionRating: "HIGH" },
  MA:    { founderLed: false, dualClass: false, ceoTenureYears: 4,  visionRating: "MEDIUM" },
  V:     { founderLed: false, dualClass: false, ceoTenureYears: 2,  visionRating: "MEDIUM" },
  ADBE:  { founderLed: false, dualClass: false, ceoTenureYears: 17, visionRating: "HIGH" },
  CRM:   { founderLed: true,  dualClass: false, ceoTenureYears: 25, visionRating: "HIGH" },
  NOW:   { founderLed: false, dualClass: false, ceoTenureYears: 6,  visionRating: "MEDIUM" },
  SNOW:  { founderLed: false, dualClass: false, ceoTenureYears: 1,  visionRating: "MEDIUM" },
  DDOG:  { founderLed: true,  dualClass: true,  ceoTenureYears: 16, visionRating: "HIGH" },
  CRWD:  { founderLed: true,  dualClass: false, ceoTenureYears: 14, visionRating: "HIGH" },
  PANW:  { founderLed: false, dualClass: false, ceoTenureYears: 9,  visionRating: "HIGH" },
  PLTR:  { founderLed: true,  dualClass: true,  ceoTenureYears: 20, visionRating: "HIGH" },
  NET:   { founderLed: true,  dualClass: true,  ceoTenureYears: 15, visionRating: "HIGH" },
  ZS:    { founderLed: true,  dualClass: false, ceoTenureYears: 13, visionRating: "HIGH" },
  LLY:   { founderLed: false, dualClass: false, ceoTenureYears: 8,  visionRating: "HIGH" },
  ISRG:  { founderLed: false, dualClass: false, ceoTenureYears: 14, visionRating: "HIGH" },
  MRK:   { founderLed: false, dualClass: false, ceoTenureYears: 3,  visionRating: "MEDIUM" },
  ABBV:  { founderLed: false, dualClass: false, ceoTenureYears: 12, visionRating: "MEDIUM" },
  AMGN:  { founderLed: false, dualClass: false, ceoTenureYears: 12, visionRating: "MEDIUM" },
  JPM:   { founderLed: false, dualClass: false, ceoTenureYears: 18, visionRating: "HIGH" },
  WMT:   { founderLed: false, dualClass: false, ceoTenureYears: 11, visionRating: "MEDIUM" },
  QCOM:  { founderLed: false, dualClass: false, ceoTenureYears: 3,  visionRating: "MEDIUM" },
  AVGO:  { founderLed: false, dualClass: false, ceoTenureYears: 17, visionRating: "MEDIUM" },
  INTC:  { founderLed: false, dualClass: false, ceoTenureYears: 4,  visionRating: "MEDIUM" },
  AMD:   { founderLed: false, dualClass: false, ceoTenureYears: 10, visionRating: "HIGH" },
  SPGI:  { founderLed: false, dualClass: false, ceoTenureYears: 9,  visionRating: "MEDIUM" },
  SQ:    { founderLed: true,  dualClass: true,  ceoTenureYears: 14, visionRating: "HIGH" },
  MELI:  { founderLed: true,  dualClass: true,  ceoTenureYears: 25, visionRating: "HIGH" },
  NU:    { founderLed: true,  dualClass: true,  ceoTenureYears: 9,  visionRating: "HIGH" },
  ASML:  { founderLed: false, dualClass: false, ceoTenureYears: 1,  visionRating: "MEDIUM" },
  TSM:   { founderLed: false, dualClass: false, ceoTenureYears: 7,  visionRating: "HIGH" },
  ARM:   { founderLed: false, dualClass: false, ceoTenureYears: 2,  visionRating: "MEDIUM" },
  SAP:   { founderLed: false, dualClass: false, ceoTenureYears: 5,  visionRating: "MEDIUM" },
  RACE:  { founderLed: false, dualClass: false, ceoTenureYears: 3,  visionRating: "MEDIUM" },
  LVMUY: { founderLed: true,  dualClass: true,  ceoTenureYears: 35, visionRating: "HIGH" },
  RELX:  { founderLed: false, dualClass: false, ceoTenureYears: 12, visionRating: "MEDIUM" },
  PEP:   { founderLed: false, dualClass: false, ceoTenureYears: 6,  visionRating: "MEDIUM" },
  KO:    { founderLed: false, dualClass: false, ceoTenureYears: 7,  visionRating: "MEDIUM" },
  JNJ:   { founderLed: false, dualClass: false, ceoTenureYears: 2,  visionRating: "MEDIUM" },
  HUBS:  { founderLed: false, dualClass: false, ceoTenureYears: 3,  visionRating: "MEDIUM" },
  CRSP:  { founderLed: false, dualClass: false, ceoTenureYears: 6,  visionRating: "MEDIUM" },
  VRTX:  { founderLed: false, dualClass: false, ceoTenureYears: 4,  visionRating: "HIGH" },
  REGN:  { founderLed: true,  dualClass: true,  ceoTenureYears: 35, visionRating: "HIGH" },
};

/**
 * Compute a 0–1 leadership conviction score from static + dynamic signals.
 *
 * Components:
 *   founderSignal  (25%) : 1.0=founder+dualClass | 0.75=founderOnly | 0.40=dualClassOnly | 0.20=neither
 *   tenureScore    (15%) : normalize(years, 0, 15) — long tenure = deep institutional knowledge
 *   visionScore    (15%) : HIGH=1.0 | MEDIUM=0.6 | LOW=0.3
 *   ownershipScore (20%) : normalize(insiderOwnership, 0, 0.20)
 *   buyingScore    (15%) : normalize(insiderBuying, 0, 1)
 *   trendScore     (10%) : rising insider ownership trend
 */
export function computeLeadershipSignalScore(
  ticker: string,
  insiderOwnership: number | null,
  insiderBuying: number | null,
  ownershipTrend: number,
): number {
  const sig = LEADERSHIP_SIGNALS[ticker] ?? { founderLed: false, dualClass: false, ceoTenureYears: 3, visionRating: "MEDIUM" as VisionRating };

  const founderSignal =
    sig.founderLed && sig.dualClass ? 1.00 :
    sig.founderLed                  ? 0.75 :
    sig.dualClass                   ? 0.40 : 0.20;

  const tenureScore = Math.min(1, sig.ceoTenureYears / 15);

  const visionScore =
    sig.visionRating === "HIGH"   ? 1.0 :
    sig.visionRating === "MEDIUM" ? 0.6 : 0.3;

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const normalize = (v: number | null, low: number, high: number) =>
    v == null ? 0.5 : clamp((v - low) / (high - low || 1));

  const ownershipScore = normalize(insiderOwnership, 0, 0.20);
  const buyingScore    = normalize(insiderBuying, 0, 1);
  const trendScore     = clamp(ownershipTrend);

  return clamp(
    0.25 * founderSignal  +
    0.15 * tenureScore    +
    0.15 * visionScore    +
    0.20 * ownershipScore +
    0.15 * buyingScore    +
    0.10 * trendScore
  );
}
