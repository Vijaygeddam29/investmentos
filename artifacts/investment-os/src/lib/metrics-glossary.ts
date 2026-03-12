export interface MetricInfo {
  label: string;
  explanation: string;
  good: string;
  category?: string;
}

export const METRICS_GLOSSARY: Record<string, MetricInfo> = {

  // ── Profitability ────────────────────────────────────────────────────────
  grossMargin: {
    label: "Gross Margin",
    explanation: "Percentage of revenue left after paying the direct cost of producing goods or services. Shows how efficiently the core business converts sales into profit before overhead.",
    good: "Higher is better. Software/platform: > 60%. Retail/manufacturing: > 30%.",
    category: "Profitability",
  },
  operatingMargin: {
    label: "Operating Margin",
    explanation: "Profit percentage after all operating costs (COGS + salaries + R&D + SG&A). Reflects real business efficiency, excluding taxes and financing effects.",
    good: "Higher is better. Excellent: > 20%. Solid: > 10%. Weak: < 5%.",
    category: "Profitability",
  },
  netMargin: {
    label: "Net Margin",
    explanation: "Bottom-line profit as a % of revenue after all costs including interest, taxes, and one-off items. The ultimate measure of how much shareholders keep from each dollar of sales.",
    good: "Higher is better. Strong: > 15%. Solid: > 8%. Thin: < 3%.",
    category: "Profitability",
  },
  ebitMargin: {
    label: "EBIT Margin",
    explanation: "Earnings Before Interest & Taxes as a % of revenue. Shows operating profitability independent of how the company is financed (debt vs equity).",
    good: "Higher is better. Useful for comparing companies with different capital structures.",
    category: "Profitability",
  },
  ebitdaMargin: {
    label: "EBITDA Margin",
    explanation: "Operating profit before depreciation and amortization, as a % of revenue. Often used as a proxy for cash flow generation capacity.",
    good: "Higher is better. Strong: > 25%. Useful benchmark for capital-intensive industries.",
    category: "Profitability",
  },
  fcfMargin: {
    label: "FCF Margin",
    explanation: "Free Cash Flow as a % of revenue — how much of each dollar in sales actually turns into real cash after running the business and investing in growth.",
    good: "Higher is better. Best-in-class: > 20%. Strong: > 10%. Weak: < 5%.",
    category: "Profitability",
  },
  roic: {
    label: "Return on Invested Capital (ROIC)",
    explanation: "How much profit the company generates for every dollar of capital invested (equity + debt). One of the most powerful indicators of business quality and competitive moat.",
    good: "Higher is better. Excellent: > 15%. Above cost of capital (> 8%). Below 5% is concerning.",
    category: "Profitability",
  },
  roic5yrAvg: {
    label: "ROIC 5-Year Average",
    explanation: "Average ROIC over 5 years. Sustained high ROIC is the hallmark of a durable moat — single years can be distorted by accounting events.",
    good: "Higher is better. Consistent > 12% over 5 years suggests a strong competitive advantage.",
    category: "Profitability",
  },
  roicStability: {
    label: "ROIC Stability",
    explanation: "How consistent ROIC has been over time (0 = volatile, 1 = rock-solid). Low volatility means the business model is predictable and its moat is durable.",
    good: "Higher is better. > 0.7 indicates reliable, consistent returns.",
    category: "Profitability",
  },
  roe: {
    label: "Return on Equity (ROE)",
    explanation: "Net profit as a percentage of shareholder equity. Shows how efficiently management generates returns for equity investors. Watch for high debt inflating this number.",
    good: "Higher is better. Excellent: > 20%. Good: > 12%. Check alongside debt levels.",
    category: "Profitability",
  },
  roa: {
    label: "Return on Assets (ROA)",
    explanation: "Net profit relative to total assets. Shows how efficiently the company uses everything it owns to generate profit — less susceptible to leverage distortion than ROE.",
    good: "Higher is better. Strong: > 10%. Good: > 5%. Capital-heavy industries typically < 5%.",
    category: "Profitability",
  },
  grossMarginTrend: {
    label: "Gross Margin Trend",
    explanation: "Year-over-year change in gross margin. Rising gross margins suggest improving pricing power or scale benefits; falling margins can signal competition or cost pressure.",
    good: "Positive or stable is better. Consistent improvement signals pricing power.",
    category: "Profitability",
  },
  operatingMarginTrend: {
    label: "Operating Margin Trend",
    explanation: "Year-over-year change in operating margin. Expanding margins as revenue grows indicates operational leverage — growth becoming more profitable over time.",
    good: "Positive trend is better. Margin expansion as revenue grows is a quality sign.",
    category: "Profitability",
  },
  incrementalMargin: {
    label: "Incremental Margin",
    explanation: "How much of each additional dollar of revenue flows through to operating profit. High incremental margins mean the next dollar of growth is very profitable (low variable costs).",
    good: "Higher is better. > 40% is excellent. Shows leverage in the business model.",
    category: "Profitability",
  },
  employeeProductivity: {
    label: "Employee Productivity",
    explanation: "Annual revenue per full-time employee. High productivity can indicate automation, pricing power, or efficient operations vs. competitors.",
    good: "Higher is better. Software companies often exceed $500K/employee. Benchmark within sector.",
    category: "Profitability",
  },

  // ── Growth ────────────────────────────────────────────────────────────────
  revenueGrowth1y: {
    label: "Revenue Growth (1Y)",
    explanation: "Year-over-year revenue growth rate. Shows how fast the company is expanding its top line. Sustained growth in revenue is the foundation of long-term wealth creation.",
    good: "Higher is better in growth context. Excellent: > 20%. Solid: > 10%. Declining: < 0% is a red flag.",
    category: "Growth",
  },
  revenueGrowth3y: {
    label: "Revenue Growth (3Y CAGR)",
    explanation: "Compound annual revenue growth over 3 years. Smooths out one-off events and gives a more reliable picture of the company's growth trajectory.",
    good: "Higher is better. > 15% CAGR is strong. Consistency matters as much as the number.",
    category: "Growth",
  },
  revenueGrowth5y: {
    label: "Revenue Growth (5Y CAGR)",
    explanation: "Compound annual revenue growth over 5 years. Shows whether growth is structural or a short-term burst. Long-run consistency is a sign of durable competitive position.",
    good: "Higher is better. > 10% over 5 years is impressive. > 20% is exceptional.",
    category: "Growth",
  },
  epsGrowth1y: {
    label: "EPS Growth (1Y)",
    explanation: "Year-over-year growth in Earnings Per Share. Revenue growth that converts to earnings growth shows the business model has leverage — not just growing for growth's sake.",
    good: "Higher is better. Growing EPS faster than revenue indicates improving margins and scale.",
    category: "Growth",
  },
  epsGrowth3y: {
    label: "EPS Growth (3Y CAGR)",
    explanation: "3-year compound annual EPS growth. Persistent EPS growth is what ultimately drives stock prices over the long run.",
    good: "Higher is better. > 15% CAGR over 3 years is a strong quality signal.",
    category: "Growth",
  },
  epsGrowth5y: {
    label: "EPS Growth (5Y CAGR)",
    explanation: "5-year compound annual EPS growth. The most reliable signal of durable business quality — very few companies can sustain this for 5+ years.",
    good: "Higher is better. > 12% for 5 years is exceptional and rare.",
    category: "Growth",
  },
  fcfGrowth: {
    label: "FCF Growth",
    explanation: "Growth in Free Cash Flow over time. Since FCF is harder to manipulate than earnings, growing FCF is the gold standard of real business expansion.",
    good: "Higher is better. FCF growing faster than revenue signals improving cash conversion.",
    category: "Growth",
  },
  operatingIncomeGrowth: {
    label: "Operating Income Growth",
    explanation: "Year-over-year growth in operating profit. Growing operating income faster than revenue confirms margin expansion and operational leverage.",
    good: "Higher is better. Growing faster than revenue means profitability is improving.",
    category: "Growth",
  },

  // ── Capital Efficiency ───────────────────────────────────────────────────
  assetTurnover: {
    label: "Asset Turnover",
    explanation: "Revenue generated per dollar of total assets. Shows how efficiently management deploys the company's asset base to generate sales.",
    good: "Higher is better. Asset-light businesses (software, finance) can be > 0.5x. Retailers often > 2x.",
    category: "Capital Efficiency",
  },
  inventoryTurnover: {
    label: "Inventory Turnover",
    explanation: "How many times the company sells and replaces its inventory in a year. High turnover means products sell quickly and capital isn't trapped in slow-moving stock.",
    good: "Higher is generally better. Varies widely by industry. Declining trend is a warning sign.",
    category: "Capital Efficiency",
  },
  workingCapitalEfficiency: {
    label: "Working Capital Efficiency",
    explanation: "Revenue relative to working capital (current assets minus current liabilities). High efficiency means the business generates lots of revenue with minimal capital tied up in operations.",
    good: "Higher is better. Negative working capital (like Amazon) can be exceptional — customers pay before costs.",
    category: "Capital Efficiency",
  },
  capexToRevenue: {
    label: "CapEx to Revenue",
    explanation: "Capital expenditures as a percentage of revenue. Low CapEx relative to revenue indicates an asset-light model where earnings flow more freely to shareholders.",
    good: "Lower is better for asset-light models. < 5% is excellent. > 15% may indicate capital-intensity.",
    category: "Capital Efficiency",
  },
  operatingLeverage: {
    label: "Operating Leverage",
    explanation: "How much faster operating profit grows than revenue. High operating leverage means fixed costs are spread over more sales — each incremental dollar becomes very profitable.",
    good: "Higher is better. > 1 means margins are expanding. The best compounders have high and consistent operating leverage.",
    category: "Capital Efficiency",
  },
  reinvestmentRate: {
    label: "Reinvestment Rate",
    explanation: "The fraction of earnings retained for reinvestment (1 minus dividend payout ratio). High reinvestment in high-ROIC businesses creates the most value over time.",
    good: "Depends on ROIC. High reinvestment is excellent when ROIC > 15%. Moderate when ROIC is average.",
    category: "Capital Efficiency",
  },
  dividendGrowth: {
    label: "Dividend Growth",
    explanation: "Year-over-year growth in the dividend per share. Consistently growing dividends signal management confidence in sustained earnings and strong cash generation.",
    good: "Positive and consistent is better. 'Dividend Aristocrats' grow dividends every year for 25+ years.",
    category: "Capital Efficiency",
  },
  shareholderYield: {
    label: "Shareholder Yield",
    explanation: "Total cash returned to shareholders as a % of market cap, combining dividend yield plus buyback yield. More complete than dividends alone.",
    good: "Higher is better (within reason). > 5% combined yield is attractive. Prioritise quality of returns over quantity.",
    category: "Capital Efficiency",
  },
  capitalAllocationDiscipline: {
    label: "Capital Allocation Discipline",
    explanation: "Composite score rating how wisely management deploys capital — weighing ROIC vs cost of capital, buyback quality, dividend sustainability, and SBC dilution.",
    good: "Higher is better (0–1 scale). > 0.7 means management consistently creates value from every dollar deployed.",
    category: "Capital Efficiency",
  },

  // ── Financial Strength ────────────────────────────────────────────────────
  debtToEquity: {
    label: "Debt to Equity",
    explanation: "Total debt divided by shareholder equity. Shows how leveraged the balance sheet is. High leverage amplifies both gains and losses and increases bankruptcy risk.",
    good: "Lower is safer. < 0.5 is conservative. > 2 requires very stable cash flows to be acceptable.",
    category: "Financial Strength",
  },
  netDebtEbitda: {
    label: "Net Debt / EBITDA",
    explanation: "Net debt (total debt minus cash) divided by EBITDA. Shows how many years of operating profit it would take to pay off debt. A standard leverage measure for lenders and analysts.",
    good: "Lower is safer. < 1x is conservative. 1–2x is manageable. > 4x is high-risk territory.",
    category: "Financial Strength",
  },
  interestCoverage: {
    label: "Interest Coverage",
    explanation: "EBIT divided by interest expense. Shows how comfortably the company can pay interest on its debt from operating profits. Low coverage is a distress signal.",
    good: "Higher is safer. > 5x is comfortable. < 2x is a warning. < 1x means the company can't cover interest from operations.",
    category: "Financial Strength",
  },
  currentRatio: {
    label: "Current Ratio",
    explanation: "Current assets divided by current liabilities. Measures short-term liquidity — whether the company can pay bills due within 12 months without raising external funds.",
    good: "Around 1.5–2.5 is healthy. < 1 may indicate liquidity stress. Very high (> 4) may suggest idle capital.",
    category: "Financial Strength",
  },
  quickRatio: {
    label: "Quick Ratio",
    explanation: "Like the current ratio but excludes inventory (harder to sell quickly). A stricter liquidity test — can the company pay short-term obligations from liquid assets alone?",
    good: "> 1 is healthy (liquid assets exceed short-term liabilities). < 0.7 warrants attention.",
    category: "Financial Strength",
  },
  cashToDebt: {
    label: "Cash to Debt",
    explanation: "Cash and equivalents divided by total debt. Shows the company's ability to immediately pay down debt. Companies with cash > debt have a 'fortress' balance sheet.",
    good: "Higher is stronger. > 1 means cash exceeds all debt — an extremely strong position.",
    category: "Financial Strength",
  },
  altmanZScore: {
    label: "Altman Z-Score",
    explanation: "A composite financial distress model using 5 accounting ratios. Originally designed to predict corporate bankruptcy within 2 years. Widely used as a credit health indicator.",
    good: "> 2.99 = safe zone. 1.81–2.99 = grey zone. < 1.81 = distress zone (higher bankruptcy risk).",
    category: "Financial Strength",
  },
  liquidityRatio: {
    label: "Liquidity Ratio",
    explanation: "Broader measure of liquidity combining multiple dimensions of a company's ability to meet short-term obligations without disrupting operations.",
    good: "Higher is safer. A score above 1 indicates adequate short-term liquidity.",
    category: "Financial Strength",
  },
  workingCapitalDrift: {
    label: "Working Capital Drift",
    explanation: "Change in working capital relative to revenue. Rising working capital relative to sales may indicate the company is having to deploy more capital just to sustain the same level of business.",
    good: "Near zero or negative is better. Negative drift (working capital shrinking) can signal improving cash efficiency.",
    category: "Financial Strength",
  },

  // ── Cash Flow Quality ────────────────────────────────────────────────────
  freeCashFlow: {
    label: "Free Cash Flow",
    explanation: "Operating cash flow minus capital expenditures — the real money left over that can be used for dividends, buybacks, debt repayment, or acquisitions. Harder to manipulate than earnings.",
    good: "Higher and growing is better. Consistent positive FCF is a hallmark of quality businesses.",
    category: "Cash Flow Quality",
  },
  fcfYield: {
    label: "FCF Yield",
    explanation: "Free cash flow divided by market capitalisation. Shows what percentage return you'd get just from the cash the business generates — the most direct measure of value.",
    good: "Higher is better. > 5% is attractive. < 2% may indicate the stock is expensive relative to cash generation.",
    category: "Cash Flow Quality",
  },
  fcfToNetIncome: {
    label: "FCF to Net Income",
    explanation: "Ratio of free cash flow to reported earnings. When this is close to 1 (or above), earnings are backed by real cash. A big gap suggests aggressive accounting or high non-cash charges.",
    good: "Close to or above 1.0 is healthiest. Consistent > 0.8 shows high earnings quality.",
    category: "Cash Flow Quality",
  },
  accrualRatio: {
    label: "Accrual Ratio",
    explanation: "Measures the gap between accounting earnings and cash flow. High accruals mean profits are coming from accounting estimates rather than actual cash — a red flag for earnings quality.",
    good: "Lower is better (closer to zero). Negative accruals mean cash exceeds earnings — a quality signal.",
    category: "Cash Flow Quality",
  },
  operatingCfToRevenue: {
    label: "Operating CF to Revenue",
    explanation: "Operating cash flow as a percentage of revenue. Higher than net margin suggests strong cash conversion; lower may indicate working capital problems or aggressive revenue recognition.",
    good: "Higher is better. Consistently above net margin is a positive earnings quality signal.",
    category: "Cash Flow Quality",
  },
  cashFlowVolatility: {
    label: "Cash Flow Volatility",
    explanation: "Coefficient of variation in operating cash flow over time. Low volatility means the business generates predictable cash flows — valuable for planning and investor confidence.",
    good: "Lower is better. < 0.2 is very stable. > 0.5 indicates lumpy, hard-to-predict cash flows.",
    category: "Cash Flow Quality",
  },
  fcfStability: {
    label: "FCF Stability",
    explanation: "How consistently the company generates free cash flow over multiple periods (0 = erratic, 1 = perfectly stable). Stable FCF makes future dividend and buyback capacity predictable.",
    good: "Higher is better. > 0.7 means you can count on this business generating cash reliably.",
    category: "Cash Flow Quality",
  },
  stockBasedCompPct: {
    label: "Stock-Based Comp %",
    explanation: "Stock-based compensation as a percentage of revenue. SBC dilutes shareholders and is often excluded from 'adjusted' earnings. High SBC can mask the true cost of running the business.",
    good: "Lower is better. < 3% is acceptable. > 10% of revenue is a significant shareholder dilution concern.",
    category: "Cash Flow Quality",
  },
  deferredRevenueGrowth: {
    label: "Deferred Revenue Growth",
    explanation: "Growth in deferred revenue (money received but not yet recognised as income). Rising deferred revenue means customers are paying upfront — a strong indicator of future revenue certainty.",
    good: "Positive growth is a bullish signal — it means the company has cash from future obligations already in hand.",
    category: "Cash Flow Quality",
  },
  receivablesGrowthVsRevenue: {
    label: "Receivables Growth vs Revenue",
    explanation: "Whether accounts receivable is growing faster than revenue. If receivables outpace sales, it may mean the company is struggling to collect — or booking revenue it hasn't been paid for yet.",
    good: "Near zero or negative is better. Significantly positive may be an earnings quality red flag.",
    category: "Cash Flow Quality",
  },
  inventoryGrowthVsRevenue: {
    label: "Inventory Growth vs Revenue",
    explanation: "Whether inventory is growing faster than revenue. Rising inventory relative to sales may indicate slowing demand, obsolescence risk, or operational inefficiency.",
    good: "Near zero or negative is better. Consistent positive may signal demand problems ahead.",
    category: "Cash Flow Quality",
  },
  taxEfficiency: {
    label: "Tax Efficiency",
    explanation: "How effectively the company manages its tax rate relative to statutory rates. Lower effective tax rates (within legal bounds) mean more profit reaches shareholders.",
    good: "Lower effective tax rate is better, provided it is sustainable and not a one-off benefit.",
    category: "Cash Flow Quality",
  },

  // ── Innovation & Founder Signals ─────────────────────────────────────────
  rdExpense: {
    label: "R&D Expense",
    explanation: "Absolute spending on research and development. Shows the company's investment in innovation and future products. Context matters — R&D is an investment, not just a cost.",
    good: "Depends on industry. Biotech/tech can justify high R&D. Compare against peers and productivity.",
    category: "Innovation",
  },
  rdToRevenue: {
    label: "R&D to Revenue",
    explanation: "Research & Development spending as a percentage of revenue. Indicates how much the company invests in innovation relative to its size.",
    good: "Depends on industry. High-innovation sectors: 10–20%+ is common. Low R&D in tech may indicate lack of reinvestment.",
    category: "Innovation",
  },
  rdProductivity: {
    label: "R&D Productivity",
    explanation: "How much revenue growth is generated per dollar of R&D spending. A high ratio suggests the company is getting good returns on its innovation investment.",
    good: "Higher is better. Measures the return on the innovation dollar — crucial for pharma and tech investors.",
    category: "Innovation",
  },
  insiderOwnership: {
    label: "Insider Ownership",
    explanation: "Percentage of the company owned by insiders (founders, executives, directors). High insider ownership aligns management incentives with shareholders — 'skin in the game'.",
    good: "10–40% is generally the sweet spot. Very low (< 2%) suggests low alignment. Very high (> 60%) may reduce float and governance.",
    category: "Innovation",
  },
  institutionalOwnership: {
    label: "Institutional Ownership",
    explanation: "Percentage of shares held by large institutions (pension funds, mutual funds, hedge funds). High institutional ownership signals professional validation but can also mean crowded trades.",
    good: "50–80% is typical for large caps. Very low may mean undiscovered or avoided. Very high leaves few buyers remaining.",
    category: "Innovation",
  },
  insiderBuying: {
    label: "Insider Buying",
    explanation: "Net shares purchased by company insiders (executives, directors) in recent months. Insider buying is a strong signal — insiders only buy when they believe the stock is undervalued.",
    good: "Positive (net buying) is a bullish signal. Multiple insiders buying simultaneously is even more meaningful.",
    category: "Innovation",
  },

  // ── Momentum ─────────────────────────────────────────────────────────────
  ret1m: {
    label: "1-Month Return",
    explanation: "Total price return over the past 1 month. Short-term momentum signal. Very positive or negative 1-month moves can indicate news events or sentiment shifts.",
    good: "Context-dependent. Strong positive 1M in a healthy trend is bullish. Look alongside longer-term returns.",
    category: "Momentum",
  },
  ret3m: {
    label: "3-Month Return",
    explanation: "Total price return over the past 3 months. Medium-term momentum. Academic research shows 3–12 month momentum is statistically significant in predicting near-term returns.",
    good: "Positive is generally bullish for momentum-based strategies. Top quintile performers tend to continue.",
    category: "Momentum",
  },
  ret6m: {
    label: "6-Month Return",
    explanation: "Total price return over the past 6 months. One of the most-studied momentum signals in factor investing. Strong 6-month momentum statistically predicts continued outperformance.",
    good: "Top-quartile 6-month returners within a universe tend to outperform over the next 3–6 months.",
    category: "Momentum",
  },
  ret1y: {
    label: "1-Year Return",
    explanation: "Total price return over the past 12 months. The 12-month lookback (excluding the most recent month) is the classic 'momentum factor' in academic finance.",
    good: "Strong 1-year returns relative to peers is a positive momentum signal for quantitative strategies.",
    category: "Momentum",
  },
  rsi14: {
    label: "RSI (14-Day)",
    explanation: "Relative Strength Index — oscillates 0–100 and measures the speed of recent price moves. Classically used to identify overbought (> 70) and oversold (< 30) conditions.",
    good: "30–70 is neutral. < 30 may indicate oversold (potential entry). > 70 may indicate overbought (caution). Best used with trend context.",
    category: "Momentum",
  },
  ma10: {
    label: "10-Day Moving Average",
    explanation: "Average closing price over the past 10 trading days. Very short-term trend indicator — less useful for longer-horizon investors but helpful for identifying short-term momentum direction.",
    good: "Price above MA10 = short-term uptrend. Below = short-term downtrend.",
    category: "Momentum",
  },
  ma20: {
    label: "20-Day Moving Average",
    explanation: "Average closing price over the past 20 trading days (~1 month). Used to define short-term trends and potential support/resistance zones.",
    good: "Price above MA20 = bullish short-term trend. Crossing above after period below = potential breakout.",
    category: "Momentum",
  },
  ma50: {
    label: "50-Day Moving Average",
    explanation: "Average closing price over the past 50 trading days. The most-watched medium-term trend indicator. Widely cited by traders as a key support or resistance level.",
    good: "Price above MA50 = medium-term uptrend. 'Golden cross' (MA50 rising above MA200) is a classic bullish signal.",
    category: "Momentum",
  },
  ma200: {
    label: "200-Day Moving Average",
    explanation: "Average closing price over the past 200 trading days (~1 year). The primary long-term trend indicator. Institutional investors watch this closely for buy/sell decisions.",
    good: "Price above MA200 = long-term uptrend. Many institutions only buy stocks trading above their MA200.",
    category: "Momentum",
  },
  pctFrom52wHigh: {
    label: "% From 52-Week High",
    explanation: "How far the current price is below the 52-week high. Deep discounts from 52-week highs can indicate either genuine value opportunities or fundamental deterioration.",
    good: "Near 0% (close to highs) indicates strong momentum. Far below (-30%+) may be value or trouble — investigate further.",
    category: "Momentum",
  },
  rangePosition: {
    label: "52-Week Range Position",
    explanation: "Where the current price sits within the 52-week high/low range (0 = at the low, 1 = at the high). Shows momentum and sentiment relative to recent price history.",
    good: "Higher (closer to 1) signals positive price momentum. Lower (closer to 0) may signal weakness or undervaluation.",
    category: "Momentum",
  },
  currentPrice: {
    label: "Current Price",
    explanation: "The most recent traded price of the stock. All valuation multiples and yield calculations use this price as the denominator.",
    good: "N/A on its own — always interpret in context of valuation multiples and intrinsic value estimates.",
    category: "Momentum",
  },
  high52w: {
    label: "52-Week High",
    explanation: "The highest closing price over the past 52 weeks. A reference point for momentum and sentiment — stocks trading near their 52-week high typically have strong momentum.",
    good: "Price near 52-week high = positive momentum. Context: is it at highs on earnings growth, or just multiple expansion?",
    category: "Momentum",
  },
  low52w: {
    label: "52-Week Low",
    explanation: "The lowest closing price over the past 52 weeks. A stock trading near its 52-week low may be in distress, or may represent a contrarian value opportunity.",
    good: "Price far above 52-week low = better momentum. Near the low warrants investigation of why.",
    category: "Momentum",
  },
  volumeTrend: {
    label: "Volume Trend",
    explanation: "Trend in trading volume relative to its recent average. Rising price on rising volume is a stronger signal than price moves on light volume.",
    good: "Volume expanding with price moves confirms the trend. Falling volume during a rally can signal waning conviction.",
    category: "Momentum",
  },

  // ── Valuation ─────────────────────────────────────────────────────────────
  peRatio: {
    label: "Price / Earnings (P/E)",
    explanation: "Stock price divided by earnings per share. The most widely used valuation metric. Shows how much the market pays for each dollar of current profit.",
    good: "Lower is cheaper, but quality commands a premium. < 15x is value territory. > 40x implies high growth expectations. Compare within sector.",
    category: "Valuation",
  },
  forwardPe: {
    label: "Forward P/E",
    explanation: "Price divided by next 12 months' expected earnings. Forward P/E is more relevant than trailing P/E for growing companies since it reflects where earnings are headed.",
    good: "Lower is cheaper. < 15x is attractive. Compare against the company's own historical forward P/E and peers.",
    category: "Valuation",
  },
  pegRatio: {
    label: "PEG Ratio",
    explanation: "P/E divided by earnings growth rate. Adjusts for growth — a company with a P/E of 30 growing at 30% may be cheaper than one with a P/E of 15 growing at 5%.",
    good: "< 1 is considered undervalued for the growth rate. 1–2 is fair value. > 2 may be expensive for the growth on offer.",
    category: "Valuation",
  },
  evToEbitda: {
    label: "EV / EBITDA",
    explanation: "Enterprise Value divided by EBITDA. Capital-structure-neutral valuation — useful for comparing companies with very different debt levels. Often used in M&A analysis.",
    good: "Lower is cheaper. < 10x is attractive in most sectors. > 20x is expensive outside high-growth technology.",
    category: "Valuation",
  },
  evToSales: {
    label: "EV / Sales",
    explanation: "Enterprise Value divided by annual revenue. Useful for valuing pre-profit companies or comparing across different margin profiles.",
    good: "Lower is cheaper. < 2x is very cheap. > 10x implies strong growth expectations and requires verification.",
    category: "Valuation",
  },
  priceToFcf: {
    label: "Price / FCF",
    explanation: "Market cap divided by free cash flow. The cash-flow-based alternative to P/E — arguably more reliable since FCF is harder to manipulate than earnings.",
    good: "Lower is cheaper. < 15x is attractive. The inverse (FCF yield) is directly comparable to a bond yield.",
    category: "Valuation",
  },
  priceToBook: {
    label: "Price / Book",
    explanation: "Market cap divided by net assets (assets minus liabilities). Shows how much premium the market places on the business above its accounting value.",
    good: "< 1 may indicate undervaluation or declining business. 1–3 is moderate. Very high P/B (>10) reflects intangible value (brands, software).",
    category: "Valuation",
  },
  fcfYield_val: {
    label: "FCF Yield",
    explanation: "Free cash flow divided by market cap. Directly comparable to a bond yield — represents the annual cash return you implicitly earn at the current price.",
    good: "> 5% is attractive. < 2% may be expensive relative to bonds. Best for stable cash-generative businesses.",
    category: "Valuation",
  },
  dividendYield: {
    label: "Dividend Yield",
    explanation: "Annual dividend per share divided by stock price. Shows the income return from owning the stock. High yield can mean generosity or distress — check payout sustainability.",
    good: "2–5% is typically healthy for dividend payers. > 7% may indicate the market doubts dividend sustainability.",
    category: "Valuation",
  },
  payoutRatio: {
    label: "Payout Ratio",
    explanation: "Dividend paid as a percentage of net earnings. High payout ratio can be unsustainable; low payout leaves room for dividend growth or reinvestment.",
    good: "40–60% is typically sustainable. > 85% leaves little room for error. < 30% suggests potential for dividend growth.",
    category: "Valuation",
  },
  ruleOf40: {
    label: "Rule of 40",
    explanation: "Revenue growth rate % + profit margin %. A popular benchmark for SaaS and high-growth companies — the best balance between growth and profitability.",
    good: "> 40 is the target. > 60 is exceptional. Used primarily for subscription/SaaS businesses, less meaningful for mature industries.",
    category: "Valuation",
  },
  revenueMultipleVsGrowth: {
    label: "Revenue Multiple vs Growth",
    explanation: "Price-to-Sales ratio divided by revenue growth rate — similar to PEG but using revenue. Adjusts the valuation multiple for the underlying growth that justifies it.",
    good: "Lower is more attractive. < 0.5 suggests you are not overpaying for growth. > 2 may signal expensive growth.",
    category: "Valuation",
  },
  marginOfSafety: {
    label: "Margin of Safety",
    explanation: "Estimated discount between intrinsic value (from FCF yield proxy) and required return. A positive margin means you're buying at a discount to fair value — Ben Graham's core concept.",
    good: "Positive is good. > 20% provides comfortable protection against errors in estimates. Negative means potentially overvalued.",
    category: "Valuation",
  },
  dcfDiscount: {
    label: "DCF Discount",
    explanation: "The gap between the FCF yield and the assumed cost of capital (10%). Positive means the stock's cash yield exceeds the hurdle rate — implying value.",
    good: "Positive is attractive. > 0 means you are buying cash flow at a discount to the cost of capital.",
    category: "Valuation",
  },
  intrinsicValueGap: {
    label: "Intrinsic Value Gap",
    explanation: "Estimated difference between calculated intrinsic value and current market price (as % of market price). Positive = stock appears undervalued; negative = appears overvalued.",
    good: "Positive and large is better. > 20% discount to intrinsic value offers a margin of safety.",
    category: "Valuation",
  },
  analystUpside: {
    label: "Analyst Upside",
    explanation: "Percentage difference between the consensus analyst 12-month price target and the current price. Positive means analysts collectively see upside.",
    good: "Positive is better. > 15% upside with broad analyst coverage is meaningful. One analyst doesn't move the needle.",
    category: "Valuation",
  },
  pePeerMedian: {
    label: "Peer Median P/E",
    explanation: "The median P/E ratio of the company's sector peers. Used to assess whether the company's own P/E is cheap or expensive relative to its direct competitors.",
    good: "A reference benchmark — compare the company's P/E to this to assess relative valuation.",
    category: "Valuation",
  },
  peVsPeerMedian: {
    label: "P/E vs Peer Median",
    explanation: "The company's P/E as a multiple of the peer-group median P/E. Below 1 means the company is cheaper than peers; above 1 means it trades at a premium.",
    good: "< 0.9 means trading at a discount to peers (potentially cheap). > 1.2 means a premium (requires justification via better quality).",
    category: "Valuation",
  },
  evEbitdaPeerMedian: {
    label: "Peer Median EV/EBITDA",
    explanation: "Median EV/EBITDA of sector peers. The benchmark for whether a company's enterprise value multiple is cheap or expensive relative to the competitive set.",
    good: "A reference benchmark — compare the company's EV/EBITDA to assess relative value.",
    category: "Valuation",
  },

  // ── Sentiment ─────────────────────────────────────────────────────────────
  earningsSurprises: {
    label: "Earnings Surprises",
    explanation: "Cumulative beat/miss pattern on consensus EPS estimates over recent quarters. Companies that consistently beat estimates tend to continue doing so (Earnings Torpedo effect).",
    good: "Positive (consistent beats) is bullish. Consistent misses are a major red flag and often precede guidance cuts.",
    category: "Sentiment",
  },
  daysOutstanding: {
    label: "Short Interest (Days to Cover)",
    explanation: "The number of days it would take short sellers to cover their positions at average daily volume. High days-to-cover means heavy short positioning that could fuel a short squeeze.",
    good: "< 3 days is normal. > 7 days indicates heavy short interest — either smart money sees problems, or a contrarian opportunity.",
    category: "Sentiment",
  },
};

export function getMetricInfo(key: string): MetricInfo | undefined {
  if (METRICS_GLOSSARY[key]) return METRICS_GLOSSARY[key];
  const lower = key.toLowerCase();
  return Object.entries(METRICS_GLOSSARY).find(
    ([k]) => k.toLowerCase() === lower
  )?.[1];
}
