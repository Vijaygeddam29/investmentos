/**
 * Country-Aware Market Benchmarks
 *
 * Each market has structurally different valuation norms and growth expectations.
 * Scoring a 25× P/E against a US norm is fair; scoring it against a UK norm would
 * wrongly flag it as expensive. This module resolves the correct benchmark set
 * for each company before scoring runs.
 *
 * Called proactively by the pipeline — not on query.
 */

export interface CountryBenchmarks {
  /** Market group key */
  market: string;
  /** P/E ratio: [cheap, expensive] */
  peRange: [number, number];
  /** Forward P/E ratio: [cheap, expensive] */
  forwardPeRange: [number, number];
  /** EV/EBITDA: [cheap, expensive] */
  evEbitdaRange: [number, number];
  /** EV/Sales: [cheap, expensive] */
  evSalesRange: [number, number];
  /** FCF yield where the market considers the stock "cheap" */
  fcfYieldAttractive: number;
  /** Net Debt / EBITDA ceiling before leverage is considered dangerous */
  netDebtEbitdaCeiling: number;
  /** Revenue growth rate the market "expects" for typical stock (used in expectation scoring) */
  revenueGrowthExpected: number;
  /** Interest coverage floor below which investors get nervous */
  interestCoverageFloor: number;
  /** Analyst upside level the market treats as meaningful */
  analystUpsideThreshold: number;
}

const BENCHMARKS: Record<string, CountryBenchmarks> = {
  US: {
    market: "US",
    peRange: [15, 35],
    forwardPeRange: [14, 40],
    evEbitdaRange: [8, 30],
    evSalesRange: [1, 12],
    fcfYieldAttractive: 0.04,
    netDebtEbitdaCeiling: 3.0,
    revenueGrowthExpected: 0.12,
    interestCoverageFloor: 3,
    analystUpsideThreshold: 0.15,
  },
  UK: {
    market: "UK",
    peRange: [10, 22],
    forwardPeRange: [9, 22],
    evEbitdaRange: [6, 20],
    evSalesRange: [0.5, 8],
    fcfYieldAttractive: 0.05,
    netDebtEbitdaCeiling: 2.5,
    revenueGrowthExpected: 0.06,
    interestCoverageFloor: 3,
    analystUpsideThreshold: 0.12,
  },
  India: {
    market: "India",
    peRange: [18, 45],
    forwardPeRange: [18, 50],
    evEbitdaRange: [10, 40],
    evSalesRange: [1, 15],
    fcfYieldAttractive: 0.025,
    netDebtEbitdaCeiling: 3.5,
    revenueGrowthExpected: 0.18,
    interestCoverageFloor: 2.5,
    analystUpsideThreshold: 0.20,
  },
  Europe: {
    market: "Europe",
    peRange: [12, 25],
    forwardPeRange: [11, 24],
    evEbitdaRange: [7, 22],
    evSalesRange: [0.8, 10],
    fcfYieldAttractive: 0.045,
    netDebtEbitdaCeiling: 2.5,
    revenueGrowthExpected: 0.07,
    interestCoverageFloor: 3,
    analystUpsideThreshold: 0.13,
  },
  EM: {
    market: "EM",
    peRange: [12, 28],
    forwardPeRange: [10, 28],
    evEbitdaRange: [6, 22],
    evSalesRange: [0.5, 10],
    fcfYieldAttractive: 0.05,
    netDebtEbitdaCeiling: 4.0,
    revenueGrowthExpected: 0.15,
    interestCoverageFloor: 2.5,
    analystUpsideThreshold: 0.18,
  },
};

const DEFAULT_BENCHMARKS = BENCHMARKS.US;

// Country → market group mapping
const COUNTRY_TO_MARKET: Record<string, string> = {
  "United States": "US",
  "Canada": "US",       // similar norms to US
  "United Kingdom": "UK",
  "Ireland": "UK",      // LSE-adjacent norms
  "India": "India",
  "Germany": "Europe",
  "France": "Europe",
  "Netherlands": "Europe",
  "Switzerland": "Europe",
  "Italy": "Europe",
  "Spain": "Europe",
  "Denmark": "Europe",
  "Sweden": "Europe",
  "Norway": "Europe",
  "Finland": "Europe",
  "Belgium": "Europe",
  "Portugal": "Europe",
  "Austria": "Europe",
  "Luxembourg": "Europe",
  "Brazil": "EM",
  "China": "EM",
  "Taiwan": "EM",
  "South Korea": "EM",
  "Hong Kong": "EM",
  "Singapore": "EM",
  "Australia": "EM",
  "Japan": "EM",
  "Indonesia": "EM",
  "Mexico": "EM",
  "Uruguay": "EM",
  "Israel": "EM",
};

/**
 * Resolve the CountryBenchmarks for a given country name.
 * Falls back to US norms if the country is unknown.
 */
export function getCountryBenchmarks(country: string | null | undefined): CountryBenchmarks {
  if (!country) return DEFAULT_BENCHMARKS;
  const market = COUNTRY_TO_MARKET[country];
  return (market ? BENCHMARKS[market] : null) ?? DEFAULT_BENCHMARKS;
}

/**
 * Resolve the market group label for a country name.
 */
export function getMarketGroup(country: string | null | undefined): string {
  if (!country) return "US";
  return COUNTRY_TO_MARKET[country] ?? "US";
}

/**
 * Normalise inconsistent country names that appear in the DB
 * (Yahoo Finance and FMP use different spellings).
 */
export function normaliseCountryName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const MAP: Record<string, string> = {
    US: "United States",
    USA: "United States",
    "United States of America": "United States",
    UK: "United Kingdom",
    GB: "United Kingdom",
    "Great Britain": "United Kingdom",
    England: "United Kingdom",
    IL: "Israel",
    DE: "Germany",
    FR: "France",
    NL: "Netherlands",
    CH: "Switzerland",
    AU: "Australia",
    CA: "Canada",
    JP: "Japan",
    KR: "South Korea",
    CN: "China",
    HK: "Hong Kong",
    SG: "Singapore",
    TW: "Taiwan",
    BR: "Brazil",
    MX: "Mexico",
    IN: "India",
  };
  return MAP[raw] ?? raw;
}
