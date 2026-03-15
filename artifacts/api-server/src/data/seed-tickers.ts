export interface SeedTicker {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  country: string;
  exchange: string;
  currency: string;
}

export const SEED_TICKERS: SeedTicker[] = [
  // ── US: NASDAQ — Large-Cap Quality ─────────────────────────────────────────
  { ticker: "AAPL",  name: "Apple Inc.",                           sector: "Technology",          industry: "Consumer Electronics",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MSFT",  name: "Microsoft Corporation",                sector: "Technology",          industry: "Software",                   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A",                sector: "Technology",          industry: "Internet Services",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "GOOG",  name: "Alphabet Inc. Class C",                sector: "Technology",          industry: "Internet Services",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AMZN",  name: "Amazon.com Inc.",                      sector: "Consumer Cyclical",   industry: "E-Commerce",                 country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "META",  name: "Meta Platforms Inc.",                  sector: "Technology",          industry: "Social Media",               country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NVDA",  name: "NVIDIA Corporation",                   sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TSLA",  name: "Tesla Inc.",                           sector: "Consumer Cyclical",   industry: "Electric Vehicles",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AVGO",  name: "Broadcom Inc.",                        sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "COST",  name: "Costco Wholesale Corporation",         sector: "Consumer Defensive",  industry: "Discount Stores",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NFLX",  name: "Netflix Inc.",                         sector: "Technology",          industry: "Streaming",                  country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ADBE",  name: "Adobe Inc.",                           sector: "Technology",          industry: "Software",                   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AMD",   name: "Advanced Micro Devices Inc.",          sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TXN",   name: "Texas Instruments Incorporated",       sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "QCOM",  name: "Qualcomm Incorporated",                sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PEP",   name: "PepsiCo Inc.",                         sector: "Consumer Defensive",  industry: "Beverages",                  country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "INTC",  name: "Intel Corporation",                    sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "CSCO",  name: "Cisco Systems Inc.",                   sector: "Technology",          industry: "Networking",                 country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AMGN",  name: "Amgen Inc.",                           sector: "Healthcare",          industry: "Biotechnology",              country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── US: NYSE — Large-Cap Quality ───────────────────────────────────────────
  { ticker: "BRK-B", name: "Berkshire Hathaway Inc.",              sector: "Financial Services",  industry: "Diversified Holdings",       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "JNJ",   name: "Johnson & Johnson",                    sector: "Healthcare",          industry: "Pharmaceuticals",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "JPM",   name: "JPMorgan Chase & Co.",                 sector: "Financial Services",  industry: "Banking",                    country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "V",     name: "Visa Inc.",                            sector: "Financial Services",  industry: "Payment Networks",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MA",    name: "Mastercard Incorporated",              sector: "Financial Services",  industry: "Payment Networks",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "UNH",   name: "UnitedHealth Group Inc.",              sector: "Healthcare",          industry: "Managed Care",               country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "HD",    name: "The Home Depot Inc.",                  sector: "Consumer Cyclical",   industry: "Home Improvement",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "WMT",   name: "Walmart Inc.",                         sector: "Consumer Defensive",  industry: "Discount Stores",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "PG",    name: "Procter & Gamble Co.",                 sector: "Consumer Defensive",  industry: "Household Products",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "KO",    name: "The Coca-Cola Company",                sector: "Consumer Defensive",  industry: "Beverages",                  country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ABBV",  name: "AbbVie Inc.",                          sector: "Healthcare",          industry: "Biopharmaceuticals",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MRK",   name: "Merck & Co. Inc.",                     sector: "Healthcare",          industry: "Pharmaceuticals",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CRM",   name: "Salesforce Inc.",                      sector: "Technology",          industry: "CRM Software",               country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ORCL",  name: "Oracle Corporation",                   sector: "Technology",          industry: "Enterprise Software",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "LLY",   name: "Eli Lilly and Company",                sector: "Healthcare",          industry: "Pharmaceuticals",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TMO",   name: "Thermo Fisher Scientific Inc.",        sector: "Healthcare",          industry: "Life Sciences Tools",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CAT",   name: "Caterpillar Inc.",                     sector: "Industrials",         industry: "Construction Machinery",     country: "US", exchange: "NYSE",   currency: "USD" },

  // ── US: Cybersecurity Compounders ─────────────────────────────────────────
  { ticker: "CRWD",  name: "CrowdStrike Holdings Inc.",            sector: "Technology",          industry: "Cybersecurity",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PANW",  name: "Palo Alto Networks Inc.",              sector: "Technology",          industry: "Cybersecurity",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ZS",    name: "Zscaler Inc.",                         sector: "Technology",          industry: "Cybersecurity",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "FTNT",  name: "Fortinet Inc.",                        sector: "Technology",          industry: "Cybersecurity",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "S",     name: "SentinelOne Inc.",                     sector: "Technology",          industry: "Cybersecurity",              country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CYBR",  name: "CyberArk Software Ltd.",               sector: "Technology",          industry: "Cybersecurity",              country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── US: Cloud / Data / SaaS ────────────────────────────────────────────────
  { ticker: "SNOW",  name: "Snowflake Inc.",                       sector: "Technology",          industry: "Cloud Data Platform",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "DDOG",  name: "Datadog Inc.",                         sector: "Technology",          industry: "Cloud Monitoring",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MDB",   name: "MongoDB Inc.",                         sector: "Technology",          industry: "Database Software",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NET",   name: "Cloudflare Inc.",                      sector: "Technology",          industry: "Cloud Security",             country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CFLT",  name: "Confluent Inc.",                       sector: "Technology",          industry: "Data Streaming",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ESTC",  name: "Elastic N.V.",                         sector: "Technology",          industry: "Search & Analytics",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "HUBS",  name: "HubSpot Inc.",                         sector: "Technology",          industry: "CRM Software",               country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TTD",   name: "The Trade Desk Inc.",                  sector: "Technology",          industry: "Ad Tech Platform",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "SHOP",  name: "Shopify Inc.",                         sector: "Consumer Cyclical",   industry: "E-Commerce Platform",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TWLO",  name: "Twilio Inc.",                          sector: "Technology",          industry: "Communications Platform",    country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ZI",    name: "ZoomInfo Technologies Inc.",           sector: "Technology",          industry: "Business Intelligence",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "BILL",  name: "BILL Holdings Inc.",                   sector: "Technology",          industry: "B2B Payments SaaS",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "WDAY",  name: "Workday Inc.",                         sector: "Technology",          industry: "HR & Finance Software",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NOW",   name: "ServiceNow Inc.",                      sector: "Technology",          industry: "Workflow Software",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "VEEV",  name: "Veeva Systems Inc.",                   sector: "Healthcare",          industry: "Life Sciences SaaS",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TEAM",  name: "Atlassian Corporation PLC",            sector: "Technology",          industry: "DevOps Platform",            country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── US: Data / Analytics Compounders ──────────────────────────────────────
  { ticker: "SPGI",  name: "S&P Global Inc.",                      sector: "Financial Services",  industry: "Financial Data & Analytics", country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MCO",   name: "Moody's Corporation",                  sector: "Financial Services",  industry: "Credit Ratings & Analytics", country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MSCI",  name: "MSCI Inc.",                            sector: "Financial Services",  industry: "Index & Analytics",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ICE",   name: "Intercontinental Exchange Inc.",       sector: "Financial Services",  industry: "Financial Exchanges",        country: "US", exchange: "NYSE",   currency: "USD" },

  // ── US: Fintech / Payments Growth ─────────────────────────────────────────
  { ticker: "SQ",    name: "Block Inc.",                           sector: "Technology",          industry: "Fintech Payments",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "NU",    name: "Nu Holdings Ltd.",                     sector: "Technology",          industry: "Digital Banking",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MELI",  name: "MercadoLibre Inc.",                    sector: "Consumer Cyclical",   industry: "Latin America E-Commerce",   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "SOFI",  name: "SoFi Technologies Inc.",               sector: "Technology",          industry: "Digital Banking Platform",   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AFRM",  name: "Affirm Holdings Inc.",                 sector: "Technology",          industry: "Buy Now Pay Later",          country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── US: Consumer Compounders ───────────────────────────────────────────────
  { ticker: "CELH",  name: "Celsius Holdings Inc.",                sector: "Consumer Defensive",  industry: "Energy Drinks",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "DKNG",  name: "DraftKings Inc.",                      sector: "Consumer Cyclical",   industry: "Online Sports Betting",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ABNB",  name: "Airbnb Inc.",                          sector: "Consumer Cyclical",   industry: "Home Sharing Platform",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "UBER",  name: "Uber Technologies Inc.",               sector: "Technology",          industry: "Ride-Hailing Platform",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "DASH",  name: "DoorDash Inc.",                        sector: "Consumer Cyclical",   industry: "Food Delivery",              country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "BROS",  name: "Dutch Bros Inc.",                      sector: "Consumer Cyclical",   industry: "Coffee Chains",              country: "US", exchange: "NYSE",   currency: "USD" },

  // ── US: Healthcare Compounders ─────────────────────────────────────────────
  { ticker: "ISRG",  name: "Intuitive Surgical Inc.",              sector: "Healthcare",          industry: "Surgical Robotics",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "DXCM",  name: "DexCom Inc.",                          sector: "Healthcare",          industry: "Glucose Monitoring",         country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "VRTX",  name: "Vertex Pharmaceuticals Inc.",          sector: "Healthcare",          industry: "Biotechnology",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "REGN",  name: "Regeneron Pharmaceuticals Inc.",       sector: "Healthcare",          industry: "Biotechnology",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MRNA",  name: "Moderna Inc.",                         sector: "Healthcare",          industry: "mRNA Vaccines",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PODD",  name: "Insulet Corporation",                  sector: "Healthcare",          industry: "Insulin Delivery",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ALGN",  name: "Align Technology Inc.",                sector: "Healthcare",          industry: "Dental Devices",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "BMRN",  name: "BioMarin Pharmaceutical Inc.",         sector: "Healthcare",          industry: "Rare Disease Biotech",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ALNY",  name: "Alnylam Pharmaceuticals Inc.",         sector: "Healthcare",          industry: "RNAi Therapeutics",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "IDXX",  name: "IDEXX Laboratories Inc.",              sector: "Healthcare",          industry: "Veterinary Diagnostics",     country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "EW",    name: "Edwards Lifesciences Corporation",     sector: "Healthcare",          industry: "Cardiac Devices",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "EXAS",  name: "Exact Sciences Corporation",           sector: "Healthcare",          industry: "Cancer Diagnostics",         country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ILMN",  name: "Illumina Inc.",                        sector: "Healthcare",          industry: "Genomics",                   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "CRSP",  name: "CRISPR Therapeutics AG",               sector: "Healthcare",          industry: "Gene Editing",               country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "RXRX",  name: "Recursion Pharmaceuticals Inc.",       sector: "Healthcare",          industry: "AI Drug Discovery",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "WST",   name: "West Pharmaceutical Services Inc.",    sector: "Healthcare",          industry: "Drug Delivery Systems",      country: "US", exchange: "NYSE",   currency: "USD" },

  // ── US: Semiconductor Ecosystem ───────────────────────────────────────────
  { ticker: "ARM",   name: "Arm Holdings PLC",                     sector: "Technology",          industry: "Semiconductor IP",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AMAT",  name: "Applied Materials Inc.",               sector: "Technology",          industry: "Semiconductor Equipment",    country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "LRCX",  name: "Lam Research Corporation",             sector: "Technology",          industry: "Semiconductor Equipment",    country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "KLAC",  name: "KLA Corporation",                      sector: "Technology",          industry: "Semiconductor Equipment",    country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "SNPS",  name: "Synopsys Inc.",                        sector: "Technology",          industry: "EDA Software",               country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "CDNS",  name: "Cadence Design Systems Inc.",          sector: "Technology",          industry: "EDA Software",               country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MRVL",  name: "Marvell Technology Inc.",              sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MPWR",  name: "Monolithic Power Systems Inc.",        sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ON",    name: "ON Semiconductor Corporation",         sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── US: AI / Data Platforms ────────────────────────────────────────────────
  { ticker: "PLTR",  name: "Palantir Technologies Inc.",           sector: "Technology",          industry: "AI Analytics Platform",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "SMCI",  name: "Super Micro Computer Inc.",            sector: "Technology",          industry: "AI Server Hardware",         country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "DELL",  name: "Dell Technologies Inc.",               sector: "Technology",          industry: "Computing Infrastructure",   country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "APP",   name: "AppLovin Corporation",                 sector: "Technology",          industry: "Mobile Ad Tech",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TSM",   name: "Taiwan Semiconductor Manufacturing",   sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NYSE",   currency: "USD" },

  // ── US: Quality Compounders (Anti-fragile) ────────────────────────────────
  { ticker: "FICO",  name: "Fair Isaac Corporation",               sector: "Technology",          industry: "Analytics & Scoring",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ROP",   name: "Roper Technologies Inc.",              sector: "Technology",          industry: "Diversified Software",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ODFL",  name: "Old Dominion Freight Line Inc.",       sector: "Industrials",         industry: "Freight & Logistics",        country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "POOL",  name: "Pool Corporation",                     sector: "Consumer Cyclical",   industry: "Pool Distribution",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "FAST",  name: "Fastenal Company",                     sector: "Industrials",         industry: "Industrial Distribution",    country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── US: Small-Cap Disruptors (existing) ───────────────────────────────────
  { ticker: "IOT",   name: "Samsara Inc.",                         sector: "Technology",          industry: "IoT & Fleet Management",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "GTLB",  name: "GitLab Inc.",                          sector: "Technology",          industry: "DevOps Platform",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MNDY",  name: "Monday.com Ltd.",                      sector: "Technology",          industry: "Work Management SaaS",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PATH",  name: "UiPath Inc.",                          sector: "Technology",          industry: "RPA & Automation",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "DOCN",  name: "DigitalOcean Holdings Inc.",           sector: "Technology",          industry: "Cloud Infrastructure",       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "WRBY",  name: "Warby Parker Inc.",                    sector: "Consumer Cyclical",   industry: "Eyewear",                    country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "SE",    name: "Sea Limited",                          sector: "Technology",          industry: "E-Commerce & Gaming",        country: "US", exchange: "NYSE",   currency: "USD" },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW — LARGE CAP COMPOUNDERS (graded: high ROIC, consistent growth)
  // Excluded: pure banks, insurers, utilities, commodities, slow-growth retail
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Industrial Compounders ─────────────────────────────────────────────────
  { ticker: "HON",   name: "Honeywell International Inc.",         sector: "Industrials",         industry: "Diversified Industrials",    country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ETN",   name: "Eaton Corporation plc",                sector: "Industrials",         industry: "Power Management",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ITW",   name: "Illinois Tool Works Inc.",             sector: "Industrials",         industry: "Diversified Industrials",    country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "EMR",   name: "Emerson Electric Co.",                 sector: "Industrials",         industry: "Industrial Automation",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "PH",    name: "Parker Hannifin Corporation",          sector: "Industrials",         industry: "Motion & Control",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ROK",   name: "Rockwell Automation Inc.",             sector: "Industrials",         industry: "Industrial Automation",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "AME",   name: "AMETEK Inc.",                          sector: "Industrials",         industry: "Electronic Instruments",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "IEX",   name: "IDEX Corporation",                     sector: "Industrials",         industry: "Fluid Handling",             country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TT",    name: "Trane Technologies plc",               sector: "Industrials",         industry: "HVAC Systems",               country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CARR",  name: "Carrier Global Corporation",           sector: "Industrials",         industry: "HVAC",                       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "OTIS",  name: "Otis Worldwide Corporation",           sector: "Industrials",         industry: "Elevators & Escalators",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "IR",    name: "Ingersoll Rand Inc.",                   sector: "Industrials",         industry: "Industrial Equipment",       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "XYL",   name: "Xylem Inc.",                           sector: "Industrials",         industry: "Water Technology",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CMI",   name: "Cummins Inc.",                         sector: "Industrials",         industry: "Engines & Power",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "GNRC",  name: "Generac Holdings Inc.",                sector: "Industrials",         industry: "Backup Power Systems",       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "HUBB",  name: "Hubbell Inc.",                         sector: "Industrials",         industry: "Electrical Products",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "GGG",   name: "Graco Inc.",                           sector: "Industrials",         industry: "Fluid Equipment",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "NDSN",  name: "Nordson Corporation",                  sector: "Industrials",         industry: "Precision Dispensing",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "FTV",   name: "Fortive Corporation",                  sector: "Technology",          industry: "Industrial Technology",      country: "US", exchange: "NYSE",   currency: "USD" },

  // ── Technology — Additional Compounders ───────────────────────────────────
  { ticker: "ANET",  name: "Arista Networks Inc.",                 sector: "Technology",          industry: "Networking Equipment",       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ADI",   name: "Analog Devices Inc.",                  sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MCHP",  name: "Microchip Technology Inc.",            sector: "Technology",          industry: "Semiconductors",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "APH",   name: "Amphenol Corporation",                 sector: "Technology",          industry: "Electronic Components",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TEL",   name: "TE Connectivity Ltd.",                 sector: "Technology",          industry: "Electronic Components",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "KEYS",  name: "Keysight Technologies Inc.",           sector: "Technology",          industry: "Test & Measurement",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ANSS",  name: "ANSYS Inc.",                           sector: "Technology",          industry: "Simulation Software",        country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MSI",   name: "Motorola Solutions Inc.",              sector: "Technology",          industry: "Mission-Critical Comms",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "IT",    name: "Gartner Inc.",                         sector: "Technology",          industry: "Research & Advisory",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CTSH",  name: "Cognizant Technology Solutions",       sector: "Technology",          industry: "IT Services",                country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "GLW",   name: "Corning Inc.",                         sector: "Technology",          industry: "Specialty Materials",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "CDW",   name: "CDW Corporation",                      sector: "Technology",          industry: "IT Solutions Distribution",  country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NTAP",  name: "NetApp Inc.",                          sector: "Technology",          industry: "Data Storage",               country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TRMB",  name: "Trimble Inc.",                         sector: "Technology",          industry: "Precision Technology",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ADP",   name: "Automatic Data Processing Inc.",       sector: "Technology",          industry: "Payroll & HR SaaS",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PAYX",  name: "Paychex Inc.",                         sector: "Technology",          industry: "Payroll Services",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PAYC",  name: "Paycom Software Inc.",                 sector: "Technology",          industry: "HR Software",                country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "FI",    name: "Fiserv Inc.",                          sector: "Technology",          industry: "Payments & Fintech",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "FIS",   name: "Fidelity National Information Svcs",  sector: "Technology",          industry: "Banking Technology",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "GPN",   name: "Global Payments Inc.",                 sector: "Technology",          industry: "Payment Processing",         country: "US", exchange: "NYSE",   currency: "USD" },

  // ── Consumer Compounders (Large Cap) ──────────────────────────────────────
  { ticker: "NKE",   name: "Nike Inc.",                            sector: "Consumer Cyclical",   industry: "Athletic Footwear",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "LULU",  name: "Lululemon Athletica Inc.",             sector: "Consumer Cyclical",   industry: "Athletic Apparel",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "CMG",   name: "Chipotle Mexican Grill Inc.",          sector: "Consumer Cyclical",   industry: "Fast Casual Restaurant",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "SBUX",  name: "Starbucks Corporation",                sector: "Consumer Cyclical",   industry: "Coffee Chains",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MCD",   name: "McDonald's Corporation",               sector: "Consumer Cyclical",   industry: "QSR Franchise",              country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "HLT",   name: "Hilton Worldwide Holdings Inc.",       sector: "Consumer Cyclical",   industry: "Hotels Asset-Light",         country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MAR",   name: "Marriott International Inc.",          sector: "Consumer Cyclical",   industry: "Hotels Asset-Light",         country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "BKNG",  name: "Booking Holdings Inc.",                sector: "Consumer Cyclical",   industry: "Online Travel",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "DECK",  name: "Deckers Outdoor Corporation",          sector: "Consumer Cyclical",   industry: "Footwear",                   country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ONON",  name: "On Holding AG",                        sector: "Consumer Cyclical",   industry: "Athletic Footwear",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "YUM",   name: "Yum! Brands Inc.",                     sector: "Consumer Cyclical",   industry: "QSR Franchise",              country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "DPZ",   name: "Domino's Pizza Inc.",                  sector: "Consumer Cyclical",   industry: "Pizza Delivery Franchise",   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ULTA",  name: "Ulta Beauty Inc.",                     sector: "Consumer Cyclical",   industry: "Beauty Retail",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TJX",   name: "TJX Companies Inc.",                   sector: "Consumer Cyclical",   industry: "Off-Price Retail",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "LOW",   name: "Lowe's Companies Inc.",                sector: "Consumer Cyclical",   industry: "Home Improvement",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MNST",  name: "Monster Beverage Corporation",         sector: "Consumer Defensive",  industry: "Energy Drinks",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "STZ",   name: "Constellation Brands Inc.",            sector: "Consumer Defensive",  industry: "Alcoholic Beverages",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "RL",    name: "Ralph Lauren Corporation",             sector: "Consumer Cyclical",   industry: "Luxury Apparel",             country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TPR",   name: "Tapestry Inc.",                        sector: "Consumer Cyclical",   industry: "Accessible Luxury",          country: "US", exchange: "NYSE",   currency: "USD" },

  // ── Healthcare Large-Cap Compounders ──────────────────────────────────────
  { ticker: "ABT",   name: "Abbott Laboratories",                  sector: "Healthcare",          industry: "Medical Devices",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "BSX",   name: "Boston Scientific Corporation",        sector: "Healthcare",          industry: "Medical Devices",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MDT",   name: "Medtronic plc",                        sector: "Healthcare",          industry: "Medical Devices",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "DHR",   name: "Danaher Corporation",                  sector: "Healthcare",          industry: "Life Sciences Tools",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "A",     name: "Agilent Technologies Inc.",            sector: "Healthcare",          industry: "Laboratory Instruments",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "IQV",   name: "IQVIA Holdings Inc.",                  sector: "Healthcare",          industry: "Clinical Research",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "HOLX",  name: "Hologic Inc.",                         sector: "Healthcare",          industry: "Women's Health",             country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "RMD",   name: "ResMed Inc.",                          sector: "Healthcare",          industry: "Respiratory Devices",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "STE",   name: "STERIS plc",                           sector: "Healthcare",          industry: "Sterilization Services",     country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MTD",   name: "Mettler-Toledo International Inc.",    sector: "Healthcare",          industry: "Precision Instruments",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TECH",  name: "Bio-Techne Corporation",               sector: "Healthcare",          industry: "Life Sciences Reagents",     country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "BRKR",  name: "Bruker Corporation",                   sector: "Healthcare",          industry: "Analytical Instruments",     country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── Specialty Materials Compounders ───────────────────────────────────────
  { ticker: "LIN",   name: "Linde plc",                            sector: "Basic Materials",     industry: "Industrial Gases",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "APD",   name: "Air Products and Chemicals Inc.",      sector: "Basic Materials",     industry: "Industrial Gases",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "SHW",   name: "Sherwin-Williams Company",             sector: "Basic Materials",     industry: "Paints & Coatings",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ECL",   name: "Ecolab Inc.",                          sector: "Basic Materials",     industry: "Water & Hygiene",            country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "PPG",   name: "PPG Industries Inc.",                  sector: "Basic Materials",     industry: "Paints & Coatings",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "RPM",   name: "RPM International Inc.",               sector: "Basic Materials",     industry: "Specialty Coatings",         country: "US", exchange: "NYSE",   currency: "USD" },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW — MID CAP COMPOUNDERS ($2B–$10B, high-growth quality)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Mid Cap: SaaS & Cloud ──────────────────────────────────────────────────
  { ticker: "NTNX",  name: "Nutanix Inc.",                         sector: "Technology",          industry: "Hyper-Converged Infrastructure", country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "BRZE",  name: "Braze Inc.",                           sector: "Technology",          industry: "Customer Engagement SaaS",   country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PCOR",  name: "Procore Technologies Inc.",            sector: "Technology",          industry: "Construction SaaS",          country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ASAN",  name: "Asana Inc.",                           sector: "Technology",          industry: "Work Management SaaS",       country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "FRSH",  name: "Freshworks Inc.",                      sector: "Technology",          industry: "SMB CRM Software",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NCNO",  name: "nCino Inc.",                           sector: "Technology",          industry: "Banking Cloud Software",     country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ALTR",  name: "Altair Engineering Inc.",              sector: "Technology",          industry: "Simulation Software",        country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "FROG",  name: "JFrog Ltd.",                           sector: "Technology",          industry: "DevOps Platform",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ACMR",  name: "ACM Research Inc.",                    sector: "Technology",          industry: "Semiconductor Equipment",    country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── Mid Cap: Digital Platforms ─────────────────────────────────────────────
  { ticker: "SEMR",  name: "SEMrush Holdings Inc.",                sector: "Technology",          industry: "SEO & Marketing Analytics",  country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "RDDT",  name: "Reddit Inc.",                          sector: "Technology",          industry: "Social Media Platform",      country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "DUOL",  name: "Duolingo Inc.",                        sector: "Technology",          industry: "EdTech Platform",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "GLBE",  name: "Global-E Online Ltd.",                 sector: "Technology",          industry: "Cross-Border E-Commerce",    country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── Mid Cap: Healthcare ────────────────────────────────────────────────────
  { ticker: "DOCS",  name: "Doximity Inc.",                        sector: "Healthcare",          industry: "Physician Digital Network",  country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "INSP",  name: "Inspire Medical Systems Inc.",         sector: "Healthcare",          industry: "Sleep Apnea Devices",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "IRTC",  name: "iRhythm Technologies Inc.",            sector: "Healthcare",          industry: "Cardiac Monitoring",         country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TMDX",  name: "TransMedics Group Inc.",               sector: "Healthcare",          industry: "Organ Transplant Tech",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "NARI",  name: "Inari Medical Inc.",                   sector: "Healthcare",          industry: "Vascular Devices",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "KRYS",  name: "Krystal Biotech Inc.",                 sector: "Healthcare",          industry: "Dermatology Biotech",        country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "SRPT",  name: "Sarepta Therapeutics Inc.",            sector: "Healthcare",          industry: "Rare Disease Biotech",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ACAD",  name: "ACADIA Pharmaceuticals Inc.",          sector: "Healthcare",          industry: "CNS Biotech",                country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "MEDP",  name: "Medpace Holdings Inc.",                sector: "Healthcare",          industry: "Clinical Research",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "HIMS",  name: "Hims & Hers Health Inc.",              sector: "Healthcare",          industry: "Telehealth Platform",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "TDOC",  name: "Teladoc Health Inc.",                  sector: "Healthcare",          industry: "Telehealth",                 country: "US", exchange: "NYSE",   currency: "USD" },

  // ── Mid Cap: Consumer Growth ───────────────────────────────────────────────
  { ticker: "WING",  name: "Wingstop Inc.",                        sector: "Consumer Cyclical",   industry: "QSR Franchise",              country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "CAVA",  name: "CAVA Group Inc.",                      sector: "Consumer Cyclical",   industry: "Mediterranean Restaurant",   country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "SFM",   name: "Sprouts Farmers Market Inc.",          sector: "Consumer Defensive",  industry: "Natural Grocery",            country: "US", exchange: "NASDAQ", currency: "USD" },

  // ── Mid Cap: Industrial Compounders ───────────────────────────────────────
  { ticker: "CSWI",  name: "CSW Industrials Inc.",                 sector: "Industrials",         industry: "Niche Industrials",          country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "POWL",  name: "Powell Industries Inc.",               sector: "Industrials",         industry: "Electrical Distribution",    country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "AVAV",  name: "AeroVironment Inc.",                   sector: "Industrials",         industry: "Unmanned Systems",           country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "HRI",   name: "Herc Holdings Inc.",                   sector: "Industrials",         industry: "Equipment Rental",           country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "AAON",  name: "AAON Inc.",                            sector: "Industrials",         industry: "HVAC Equipment",             country: "US", exchange: "NASDAQ", currency: "USD" },

  // ═══════════════════════════════════════════════════════════════════════════
  // NEW — SMALL CAP QUALITY (<$2B, high growth / defensible niches)
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: "ALRM",  name: "Alarm.com Holdings Inc.",              sector: "Technology",          industry: "Smart Home SaaS",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "TASK",  name: "TaskUs Inc.",                          sector: "Technology",          industry: "Digital Customer Experience", country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "OLLI",  name: "Ollie's Bargain Outlet Holdings",      sector: "Consumer Cyclical",   industry: "Discount Retail",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "FIVE",  name: "Five Below Inc.",                      sector: "Consumer Cyclical",   industry: "Discount Retail",            country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "SMPL",  name: "Simply Good Foods Company",            sector: "Consumer Defensive",  industry: "Nutrition & Wellness",       country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "ENFN",  name: "Enfusion Inc.",                        sector: "Technology",          industry: "Investment Management SaaS", country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "MMS",   name: "MAXIMUS Inc.",                         sector: "Industrials",         industry: "Government Services",        country: "US", exchange: "NYSE",   currency: "USD" },
  { ticker: "ACVA",  name: "ACV Auctions Inc.",                    sector: "Consumer Cyclical",   industry: "Auto Auction Platform",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "PAYO",  name: "Payoneer Global Inc.",                 sector: "Technology",          industry: "Cross-Border Payments",      country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "SWAV",  name: "ShockWave Medical Inc.",               sector: "Healthcare",          industry: "Cardiovascular Devices",     country: "US", exchange: "NASDAQ", currency: "USD" },
  { ticker: "LMND",  name: "Lemonade Inc.",                        sector: "Technology",          industry: "Insurtech Platform",         country: "US", exchange: "NYSE",   currency: "USD" },

  // ═══════════════════════════════════════════════════════════════════════════
  // NON-US: United Kingdom (unchanged)
  // ═══════════════════════════════════════════════════════════════════════════
  { ticker: "ULVR.L",  name: "Unilever PLC",                       sector: "Consumer Defensive",  industry: "Household Products",         country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "BP.L",    name: "BP PLC",                             sector: "Energy",              industry: "Oil & Gas",                  country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "AZN.L",   name: "AstraZeneca PLC",                    sector: "Healthcare",          industry: "Pharmaceuticals",            country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "SHEL.L",  name: "Shell PLC",                          sector: "Energy",              industry: "Oil & Gas",                  country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "HSBA.L",  name: "HSBC Holdings PLC",                  sector: "Financial Services",  industry: "Banking",                    country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "GSK.L",   name: "GSK PLC",                            sector: "Healthcare",          industry: "Pharmaceuticals",            country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "RIO.L",   name: "Rio Tinto PLC",                      sector: "Basic Materials",     industry: "Mining",                     country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "DGE.L",   name: "Diageo PLC",                         sector: "Consumer Defensive",  industry: "Beverages",                  country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "LLOY.L",  name: "Lloyds Banking Group PLC",           sector: "Financial Services",  industry: "Banking",                    country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "VOD.L",   name: "Vodafone Group PLC",                 sector: "Technology",          industry: "Telecommunications",         country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "RELX.L",  name: "RELX PLC",                           sector: "Technology",          industry: "Data & Analytics",           country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "LSEG.L",  name: "London Stock Exchange Group PLC",    sector: "Financial Services",  industry: "Financial Infrastructure",   country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "DPLM.L",  name: "Diploma PLC",                        sector: "Industrials",         industry: "Specialty Distribution",     country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "HLMA.L",  name: "Halma PLC",                          sector: "Technology",          industry: "Safety & Environmental",     country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "RMV.L",   name: "Rightmove PLC",                      sector: "Technology",          industry: "Real Estate Platform",       country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "AUTO.L",  name: "Auto Trader Group PLC",              sector: "Technology",          industry: "Automotive Platform",        country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "EXPN.L",  name: "Experian PLC",                       sector: "Technology",          industry: "Credit & Data Services",     country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "BA.L",    name: "BAE Systems PLC",                    sector: "Industrials",         industry: "Aerospace & Defence",        country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "RR.L",    name: "Rolls-Royce Holdings PLC",           sector: "Industrials",         industry: "Aerospace & Defence",        country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "MNDI.L",  name: "Mondi PLC",                          sector: "Basic Materials",     industry: "Packaging",                  country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "BDEV.L",  name: "Barratt Developments PLC",           sector: "Consumer Cyclical",   industry: "Homebuilding",               country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "IMI.L",   name: "IMI PLC",                            sector: "Industrials",         industry: "Engineering",                country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "SBRY.L",  name: "J Sainsbury PLC",                    sector: "Consumer Defensive",  industry: "Grocery Retail",             country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "TSCO.L",  name: "Tesco PLC",                          sector: "Consumer Defensive",  industry: "Grocery Retail",             country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "III.L",   name: "3i Group PLC",                       sector: "Financial Services",  industry: "Private Equity",             country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "FERG.L",  name: "Ferguson Enterprises Inc.",          sector: "Industrials",         industry: "Plumbing Distribution",      country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "IITU.L",  name: "iShares Core MSCI World ETF",        sector: "ETF",                 industry: "Global Equity ETF",          country: "UK", exchange: "LSE",    currency: "GBP" },
  { ticker: "IGUS.L",  name: "iShares Core MSCI USA ETF",          sector: "ETF",                 industry: "US Equity ETF",              country: "UK", exchange: "LSE",    currency: "GBP" },

  // ── Global: European ADRs & Listings ──────────────────────────────────────
  { ticker: "SAP",   name: "SAP SE",                               sector: "Technology",          industry: "Enterprise Software",        country: "Germany", exchange: "NYSE", currency: "USD" },
  { ticker: "RACE",  name: "Ferrari N.V.",                         sector: "Consumer Cyclical",   industry: "Luxury Automobiles",         country: "Italy",   exchange: "NYSE", currency: "USD" },
  { ticker: "LVMUY", name: "LVMH Moet Hennessy Louis Vuitton",     sector: "Consumer Cyclical",   industry: "Luxury Goods",               country: "France",  exchange: "OTC",  currency: "USD" },
  { ticker: "HESAY", name: "Hermes International SCA",             sector: "Consumer Cyclical",   industry: "Luxury Goods",               country: "France",  exchange: "OTC",  currency: "USD" },
  { ticker: "LRLCY", name: "L'Oreal S.A.",                         sector: "Consumer Defensive",  industry: "Personal Care",              country: "France",  exchange: "OTC",  currency: "USD" },
  { ticker: "ASML",  name: "ASML Holding N.V.",                    sector: "Technology",          industry: "Semiconductor Equipment",    country: "Netherlands", exchange: "NASDAQ", currency: "USD" },

  // ── Global: Asia-Pacific ───────────────────────────────────────────────────
  { ticker: "TSM",   name: "Taiwan Semiconductor Manufacturing",   sector: "Technology",          industry: "Semiconductors",             country: "Taiwan",  exchange: "NYSE",   currency: "USD" },
  { ticker: "BABA",  name: "Alibaba Group Holding Ltd.",           sector: "Consumer Cyclical",   industry: "E-Commerce",                 country: "China",   exchange: "NYSE",   currency: "USD" },
  { ticker: "TCEHY", name: "Tencent Holdings Ltd.",                sector: "Technology",          industry: "Internet & Gaming",          country: "China",   exchange: "OTC",    currency: "USD" },
  { ticker: "BIDU",  name: "Baidu Inc.",                           sector: "Technology",          industry: "Internet Services",          country: "China",   exchange: "NASDAQ", currency: "USD" },
  { ticker: "NVO",   name: "Novo Nordisk A/S",                     sector: "Healthcare",          industry: "Diabetes & Obesity",         country: "Denmark", exchange: "NYSE",   currency: "USD" },

  // ── India: NSE — Large-Cap ────────────────────────────────────────────────
  { ticker: "RELIANCE.NS",    name: "Reliance Industries Ltd",           sector: "Energy",              industry: "Oil & Gas Refining",         country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "TCS.NS",         name: "Tata Consultancy Services Ltd",     sector: "Technology",          industry: "IT Services",                country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "HDFCBANK.NS",    name: "HDFC Bank Ltd",                     sector: "Financial Services",  industry: "Banking",                    country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "INFY.NS",        name: "Infosys Ltd",                       sector: "Technology",          industry: "IT Services",                country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "HINDUNILVR.NS",  name: "Hindustan Unilever Ltd",            sector: "Consumer Defensive",  industry: "Household Products",         country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "BAJFINANCE.NS",  name: "Bajaj Finance Ltd",                 sector: "Financial Services",  industry: "Consumer Finance",           country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "ICICIBANK.NS",   name: "ICICI Bank Ltd",                    sector: "Financial Services",  industry: "Banking",                    country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "LT.NS",          name: "Larsen & Toubro Ltd",               sector: "Industrials",         industry: "Engineering & Construction", country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "WIPRO.NS",       name: "Wipro Ltd",                         sector: "Technology",          industry: "IT Services",                country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "ASIANPAINT.NS",  name: "Asian Paints Ltd",                  sector: "Basic Materials",     industry: "Specialty Chemicals",        country: "India", exchange: "NSE", currency: "INR" },

  // ── India: NSE — Mid-Cap Growth ───────────────────────────────────────────
  { ticker: "TITAN.NS",      name: "Titan Company Ltd",                  sector: "Consumer Cyclical",   industry: "Jewelry & Watches",          country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "PIDILITIND.NS", name: "Pidilite Industries Ltd",            sector: "Basic Materials",     industry: "Specialty Chemicals",        country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "TATACONSUM.NS", name: "Tata Consumer Products Ltd",         sector: "Consumer Defensive",  industry: "FMCG",                       country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "DIVISLAB.NS",   name: "Divi's Laboratories Ltd",            sector: "Healthcare",          industry: "Pharmaceuticals",            country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "MUTHOOTFIN.NS", name: "Muthoot Finance Ltd",                sector: "Financial Services",  industry: "Gold Financing",             country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "HAVELLS.NS",    name: "Havells India Ltd",                  sector: "Industrials",         industry: "Electrical Equipment",       country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "TATAELXSI.NS",  name: "Tata Elxsi Ltd",                     sector: "Technology",          industry: "Design & Technology",        country: "India", exchange: "NSE", currency: "INR" },
  { ticker: "COFORGE.NS",    name: "Coforge Ltd",                        sector: "Technology",          industry: "IT Services",                country: "India", exchange: "NSE", currency: "INR" },
];
