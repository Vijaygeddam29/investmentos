# Workspace

## Overview

Investment Operating System (Investment OS) — a hedge-fund-grade stock research platform. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + React Query
- **Data source**: Financial Modeling Prep (FMP) API (`/stable/` endpoints)
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini for memos)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/           # Express API server (backend)
│   │   └── src/
│   │       ├── routes/       # API route handlers
│   │       │   ├── pipeline.ts   # POST /api/pipeline/run, GET /api/pipeline/status
│   │       │   ├── companies.ts  # CRUD + detail + metrics + verdict
│   │       │   ├── scores.ts     # GET /api/scores (with engine/minScore filter)
│   │       │   ├── signals.ts    # drift-signals, opportunity-alerts, risk-alerts
│   │       │   └── universe.ts   # Universe manager CRUD
│   │       └── lib/          # Business logic
│   │           ├── fmp-harvester.ts     # FMP API data ingestion
│   │           ├── scoring-engines.ts   # 120-factor scoring (8 families)
│   │           ├── detectors.ts         # Drift/Opportunity detection
│   │           ├── ai-memo.ts           # AI research memo generator
│   │           └── pipeline.ts          # Pipeline orchestrator
│   └── investment-os/        # React Vite frontend
│       └── src/
│           ├── pages/        # Dashboard, Signals, Universe
│           ├── components/   # Layout, company table, drawers
│           └── hooks/        # Pipeline manager hook
├── lib/
│   ├── api-spec/             # OpenAPI spec + Orval codegen config
│   ├── api-client-react/     # Generated React Query hooks
│   ├── api-zod/              # Generated Zod schemas
│   └── db/                   # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── companies.ts
│           ├── financial-metrics.ts
│           ├── price-history.ts
│           ├── scores.ts
│           ├── ai-verdicts.ts
│           └── signals.ts    # drift_signals + opportunity_alerts tables
├── scripts/
├── pnpm-workspace.yaml
└── package.json
```

## Key Features

### Three Strategy Engines
- **Fortress** (long-term compounders): Profitability 30%, Capital Efficiency 20%, Cash Flow 20%, Strength 20%, Valuation 10%
- **Rocket** (high-growth innovators): Growth 30%, Innovation 30%, Efficiency 15%, Momentum 15%, Strength 10%
- **Wave** (momentum/tactical): Momentum 40%, Valuation 30%, Growth 20%, Innovation 10%

### 120-Factor Scoring (8 Families, 15 factors each)
1. Profitability (ROIC, margins, ROE, ROA)
2. Growth (revenue, EPS, FCF growth rates)
3. Capital Efficiency (asset turnover, ROIC, reinvestment)
4. Financial Strength (D/E, interest coverage, liquidity)
5. Cash Flow Quality (FCF/NI, operating CF, conversion)
6. Innovation (R&D intensity, insider ownership)
7. Momentum (RSI, moving averages, volume trends)
8. Valuation (P/E, EV/EBITDA, FCF yield, PEG)

### Universe (175 Tickers)
- US large-cap (NASDAQ/NYSE): AAPL, MSFT, NVDA, GOOGL/GOOG + 40 others
- US mid-cap growth: cybersecurity (CRWD, PANW, ZS), cloud/SaaS (SNOW, DDOG, NET, NOW, HUBS), fintech (SQ, NU, MELI), AI/semis (ARM, ASML, PLTR, TSM), biotech (LLY, ISRG, VRTX, REGN)
- UK LSE quality compounders: RELX.L, LSEG.L, DPLM.L, HLMA.L, RMV.L, AUTO.L, EXPN.L, BA.L, RR.L + originals
- European ADRs: SAP, RACE, LVMUY, HESAY, LRLCY
- India NSE: 10 large-cap + 8 mid-cap growth (TITAN, DIVISLAB, PIDILITIND, etc.)
- marketCap stored in **billions** in factor_snapshots (e.g. 283.7 = $283.7B)

### Portfolio Builder (`GET /api/portfolio/builder`)
Constructs an optimal N-stock portfolio from the universe:
- Parameters: `strategy` (fortress/rocket/wave), `size`, `weightMethod` (equal/score/risk), `sectorCap`, `country`, `marketCap`
- Iterative sector-cap fill prevents over-concentration
- Returns weighted holdings, per-engine scores, portfolio-level aggregate scores, universe metadata
- Frontend page: `/portfolio/builder` — control panel + score summary cards + ranked results table

### Signal Detection
- **Drift Signals**: Detects ROIC deterioration, margin compression, debt increases, FCF decline
- **Opportunity Alerts**: Flags when companies cross engine thresholds (Fortress >0.7, Rocket >0.65, Wave >0.6)
- **Risk Alerts**: High-severity drift signals

### AI Research Memos
- Uses OpenAI (gpt-5-mini) via Replit AI Integrations
- Falls back to rule-based memos when AI unavailable
- Generates verdict (BUY/HOLD/SELL) and classification

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection (auto-provisioned by Replit)
- `FMP_API_KEY`: Financial Modeling Prep API key
- `AI_INTEGRATIONS_OPENAI_API_KEY`: OpenAI API key (Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: OpenAI base URL (Replit AI Integrations)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files; bundling via esbuild/tsx/vite

## Root Scripts

- `pnpm run build` — typecheck + recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Data Flow

1. User adds tickers to Universe
2. Pipeline runs: FMP harvester → DB storage → 120-factor scoring → drift detection → opportunity alerts → AI memos
3. Dashboard displays scores across Fortress/Rocket/Wave engines
4. Signal pages show drift, opportunities, and risk alerts

## FMP API

Uses the new `/stable/` API endpoints (v3 is deprecated):
- `https://financialmodelingprep.com/stable/profile?symbol=X`
- `https://financialmodelingprep.com/stable/key-metrics?symbol=X&period=annual`
- `https://financialmodelingprep.com/stable/ratios?symbol=X&period=annual`
- `https://financialmodelingprep.com/stable/income-statement?symbol=X&period=annual`
- `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=X&period=annual`
- `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=X&period=annual`
- `https://financialmodelingprep.com/stable/financial-growth?symbol=X&period=annual`
- `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=X`

Production migrations are handled by Replit when publishing. In development, use `pnpm --filter @workspace/db run push`.
