# Workspace

## Overview

Investment Operating System (MIOS) — a hedge-fund-grade stock research + AI options income platform. pnpm workspace monorepo using TypeScript.

### New Platform Features (AI Options Engine + Pre-Market Intelligence)
- **Options Income Engine**: Regime-aware wheel candidate screener (Fortress>0.55, IV percentile, earnings clearance), strike/expiry selection, Claude AI rationale
- **IBKR Live Trading**: OAuth 2.0 PKCE flow, review-and-confirm order placement, position monitoring
- **Pre-Market Intelligence**: 14 macro instruments (BTC, Gold, VIX, DXY, etc.) via Yahoo Finance, news scan, Claude-generated briefing, 05:00 UTC email delivery Mon–Fri
- **Per-User Risk Profiles**: profit target %, stop loss multiplier, delta preference, DTE range, max positions, margin cap, monthly income target
- **Frontend Pages**: Options Signals, Positions Monitor, Income Tracker, Pre-Market Intelligence, IBKR Settings
- **Dashboard Widget**: Today's Intelligence banner linking to pre-market page

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
- **AI**: Claude claude-sonnet-4-6 via Replit AI Integrations (Anthropic) for narrative generation; memos also via Anthropic

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

### Universe (~320 Tickers, Curated Compounders)
- US large-cap (NASDAQ/NYSE): AAPL, MSFT, NVDA, GOOGL/GOOG + 40 others
- US large-cap compounders: HON, ETN, ITW, ROK, AME, ANET, ADI, ADP, NKE, CMG, MCD, ABT, LIN, SHW, ECL, etc.
- US mid-cap growth: cybersecurity (CRWD, PANW, ZS), cloud/SaaS (SNOW, DDOG, NET, NOW, HUBS), fintech (NU, MELI), AI/semis (ARM, ASML, PLTR, TSM), biotech (LLY, ISRG, VRTX, REGN)
- US mid-cap (NTNX, BRZE, DOCS, WING, CAVA, DUOL, RDDT, etc.)
- US small-cap quality (ALRM, FIVE, OLLI, SWAV, LMND, etc.)
- UK LSE quality compounders: RELX.L, LSEG.L, DPLM.L, HLMA.L, RMV.L, AUTO.L, EXPN.L, BA.L, RR.L + originals
- European ADRs: SAP, RACE, LVMUY, HESAY, LRLCY
- India NSE: 10 large-cap + 8 mid-cap growth (TITAN, DIVISLAB, PIDILITIND, etc.)
- marketCap stored in **billions** in factor_snapshots (e.g. 283.7 = $283.7B)
- **Source column**: `seed` (curated compounders) vs `user_added` (user custom entries)
- **Quick-add**: `POST /api/universe/quick-add` validates any ticker via Yahoo Finance, auto-fills metadata

### Weekly Pipeline Scheduler
- **CACHE_TTL_MS**: 7 days — data only re-fetched once per week
- **Cron**: `node-cron` runs pipeline every Sunday at 2 AM UTC
- **Startup check**: On server restart, checks `last_auto_run` in DB settings table; if >7 days, auto-triggers
- **Settings table**: `settings` table in DB (key/value) persists `last_auto_run` timestamp
- **Pipeline status**: Exposes `nextScheduledRun` and `lastAutoRun` in `/api/pipeline/status`
- **UI**: PipelineTimestampBar shows "Auto-run: Sun 22 Mar, 02:00 UTC"
- **Manual runs**: Still work — mid-week manual runs only rescore (fast, no API calls) since data is fresh

### 6-Layer Investment Intelligence Framework
Each company is scored across 6 layers (0–100 scale):
1. **Quality** (L1): Business fundamentals — profitability, capital efficiency, financial strength
2. **Opportunity** (L2): Stock-level value — valuation, entry timing, sentiment
3. **Expectation** (L3): Growth trajectory — revenue/EPS acceleration, margin trends
4. **Mispricing** (L4): Market pricing gap — intrinsic value vs market price
5. **Fragility** (L5): Risk assessment — volatility, debt, concentration risk
6. **Portfolio Net Score** (L6): Final blended score across all layers

Position bands (plain English):
- CORE HOLDING (≥75, 6–10%), STRONG POSITION (≥60, 3–5%), STARTER (≥45, 1–2%), SPECULATIVE (≥30, 0.5–1%), DO NOT BUY (<30)

### CompanyDrawer (4 tabs)
- **Intelligence** (default): 6-layer panel with collapsible sections, bar charts, narratives, position bands
- **Charts**: Price vs strategy scores, valuation bands
- **Signals**: Drift signals and risk alerts
- **Chain**: Value chain analysis

### Portfolio Builder (`GET /api/portfolio/builder`)
Constructs an optimal N-stock portfolio from the universe:
- Parameters: `strategy` (fortress/rocket/wave), `size`, `weightMethod` (equal/score/risk/power), `sectorCap`, `country`, `marketCap`
- Iterative sector-cap fill prevents over-concentration
- Returns weighted holdings, per-engine scores, 6-layer intelligence scores, portfolio-level aggregate scores
- **Manual weight control**: Editable weight inputs per holding, lock/unlock individual weights, redistribute unlocked weights
- **Add Stock**: Search panel to manually add stocks from the universe with full score data
- **Portfolio Intelligence summary**: Weighted-average 6-layer scores across all holdings
- **Search API**: `GET /api/portfolio/builder/search?q=TERM` returns matching companies with scores
- Frontend page: `/portfolio/builder` — control panel + strategy scores + intelligence summary + interactive table

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
