// The fixed vocabularies every piece is tagged against. Source of truth for the tagger, the
// database checks and the reports. Mirrors the project docs:
//   claude/am-intelligence-attention-signal-and-first-build.md (asset classes, sub-asset classes)
//   claude/am-intelligence-theme-taxonomy-v1.md (themes)
// Any change here is a new TAXONOMY_VERSION, and history is re-tagged so trends stay comparable.
// AlphaThreads must tag against the same version for the white-space comparison to be valid.

export const TAXONOMY_VERSION = '1.0.1'
// 1.0.0  14 Oct 2026  first list (12 parent themes, 67 child themes)
// 1.0.1  14 Oct 2026  Quality limited to equities (James): quality in credit is not this theme

// ── Asset classes and sub-asset classes ──────────────────────────────────

export interface SubAssetClass { name: string; definition: string }
export interface AssetClass { name: string; definition: string; subs: SubAssetClass[] }

export const ASSET_CLASSES: AssetClass[] = [
  {
    name: 'Equities',
    definition: 'Listed shares: stock markets and indices, sectors and styles, equity valuations, earnings as they bear on share prices, buybacks, IPOs, equity factors.',
    subs: [
      { name: 'US', definition: 'US-listed equities and US equity markets.' },
      { name: 'Europe', definition: 'Continental European and pan-European equities.' },
      { name: 'UK', definition: 'UK-listed equities.' },
      { name: 'Japan', definition: 'Japanese equities.' },
      { name: 'Emerging markets', definition: 'Emerging-market equities, including China, India and other EM countries.' },
      { name: 'Global', definition: 'Global or world equities treated as one market, or several regions compared.' },
      { name: 'Small & mid cap', definition: 'Small and mid-cap equities as a segment.' },
      { name: 'Style', definition: 'Growth, value, quality or income equity styles.' },
      { name: 'Sector & thematic', definition: 'A sector (technology, healthcare, energy, banks…) or a thematic equity opportunity.' },
    ],
  },
  {
    name: 'Fixed Income & Credit',
    definition: 'Government bonds and yields, rates and curves as markets, corporate bonds, spreads, high yield and investment grade, securitised debt, defaults and ratings of debt, green bonds. Private credit and direct lending are Private Markets.',
    subs: [
      { name: 'Government & rates', definition: 'Sovereign bonds, yields, curves, duration, rates markets.' },
      { name: 'Inflation-linked', definition: 'Inflation-linked bonds (TIPS, linkers) and breakevens.' },
      { name: 'Investment grade', definition: 'Investment-grade corporate credit.' },
      { name: 'High yield', definition: 'High-yield corporate bonds and leveraged loans.' },
      { name: 'EM debt', definition: 'Emerging-market sovereign and corporate debt, hard or local currency.' },
      { name: 'Securitised & ABS', definition: 'Mortgage-backed, asset-backed, CLOs and other securitised debt.' },
      { name: 'Municipal', definition: 'US municipal bonds.' },
      { name: 'Short duration & cash', definition: 'Money markets, cash, ultra-short and short-duration bonds.' },
    ],
  },
  {
    name: 'Private Markets',
    definition: 'Private equity, venture, private credit and direct lending, private infrastructure and real estate funds, secondaries, fund-raising and valuations of private funds, hedge funds and other alternative strategies.',
    subs: [
      { name: 'Private equity', definition: 'Buyouts and private equity funds.' },
      { name: 'Venture & growth', definition: 'Venture capital and growth equity.' },
      { name: 'Private credit', definition: 'Direct lending, private debt, asset-based finance.' },
      { name: 'Infrastructure', definition: 'Private infrastructure investment.' },
      { name: 'Real estate', definition: 'Private real estate equity and debt.' },
      { name: 'Secondaries', definition: 'Secondaries, continuation funds, GP-led deals.' },
    ],
  },
  {
    name: 'Real Assets',
    definition: 'Listed real estate and infrastructure, commodities as markets (energy, metals, agriculture prices and supply), gold, natural resources, timber and farmland.',
    subs: [
      { name: 'Listed real estate', definition: 'REITs and listed property.' },
      { name: 'Listed infrastructure', definition: 'Listed infrastructure and utilities as an asset class.' },
      { name: 'Commodities', definition: 'Energy, industrial metals and agricultural commodities as markets.' },
      { name: 'Gold & precious metals', definition: 'Gold, silver and other precious metals.' },
      { name: 'Natural resources', definition: 'Natural-resource equities, timber and farmland.' },
    ],
  },
  {
    name: 'Multi-Asset',
    definition: 'Allocation across asset classes: portfolio construction, diversification, balanced portfolios, house views and outlooks across assets, LDI, how pension funds and other owners set overall strategy, capital market assumptions.',
    subs: [
      { name: 'Strategic & tactical allocation', definition: 'Asset allocation views and positioning across asset classes.' },
      { name: 'Outlooks & house views', definition: 'Annual, quarterly or mid-year outlooks and house views covering several asset classes.' },
      { name: 'Income', definition: 'Multi-asset income strategies.' },
      { name: 'Retirement & target date', definition: 'Target-date, retirement and decumulation portfolios.' },
      { name: 'Pensions & LDI', definition: 'Liability-driven investment, pension scheme strategy and risk transfer.' },
      { name: 'Model portfolios', definition: 'Model portfolios and managed portfolio services.' },
      { name: 'Liquid alternatives', definition: 'Liquid alternatives, absolute return and diversifying strategies inside portfolios.' },
    ],
  },
  {
    name: 'Digital Assets',
    definition: 'Cryptocurrencies, stablecoins, tokenisation and blockchain-based finance as investments.',
    subs: [
      { name: 'Crypto assets', definition: 'Bitcoin, ether and other crypto assets as investments.' },
      { name: 'Tokenisation', definition: 'Tokenised funds, securities and real-world assets.' },
      { name: 'Stablecoins & payments', definition: 'Stablecoins and blockchain payment rails.' },
    ],
  },
]

export const ASSET_CLASS_NAMES = ASSET_CLASSES.map(a => a.name)
/** "Equities › US" style keys, unique across asset classes */
export const SUB_ASSET_KEYS = ASSET_CLASSES.flatMap(a => a.subs.map(s => `${a.name} › ${s.name}`))

// ── Themes ───────────────────────────────────────────────────────────────

export type ThemeKind = 'topic' | 'facet'
export interface Theme { name: string; definition: string; boundary?: string }
export interface ThemeParent { name: string; kind: ThemeKind; note?: string; children: Theme[] }

export const THEME_PARENTS: ThemeParent[] = [
  { name: 'Macro', kind: 'topic', children: [
    { name: 'Monetary Policy', definition: 'Central bank decisions, rate paths, balance sheets, forward guidance.', boundary: "The central bank's reaction; price dynamics go to Inflation." },
    { name: 'Inflation', definition: 'Price dynamics, expectations, wage-price effects, tariff and energy pass-through.' },
    { name: 'Growth & Business Cycle', definition: 'Activity, GDP, recession risk, leading indicators.' },
    { name: 'Labour Markets & Productivity', definition: "Employment, wages, productivity, including AI's effect on jobs." },
    { name: 'Fiscal Policy & Sovereign Debt', definition: 'Deficits, debt sustainability, government bond supply, sovereign spreads and ratings.' },
    { name: 'Trade & Tariffs', definition: 'Trade policy, tariffs, supply-chain reshoring and fragmentation.' },
    { name: 'Currencies & the Dollar', definition: "Exchange rates, the dollar's reserve role, currency hedging, capital flows." },
  ] },
  { name: 'Geopolitics & Politics', kind: 'topic', children: [
    { name: 'Geopolitics & Conflict', definition: 'Wars, sanctions, great-power rivalry.', boundary: 'The energy-supply effect also takes Energy Markets & Security.' },
    { name: 'Defence & Security', definition: 'Defence spending, defence industry and equities, security of supply chains.', boundary: 'Cyber threats as an investment theme go to Cybersecurity.' },
    { name: 'Elections & Political Risk', definition: 'Elections, populism, policy uncertainty, institutional risk.' },
  ] },
  { name: 'Regions & Markets', kind: 'facet', note: 'The subject of the piece, not the edition that published it (that is the region field). Use the most specific region that applies; a broad one only when the piece covers the group as a whole.', children: [
    { name: 'US', definition: 'The United States.' },
    { name: 'UK', definition: 'The United Kingdom.' },
    { name: 'Europe', definition: 'Continental Europe, the eurozone or the EU.' },
    { name: 'Japan', definition: 'Japan.' },
    { name: 'China', definition: 'Mainland China and Hong Kong.' },
    { name: 'India', definition: 'India.' },
    { name: 'Korea & Taiwan', definition: 'South Korea and Taiwan.' },
    { name: 'Asia ex-Japan', definition: 'Asia as a whole, or Asian markets outside the named countries.' },
    { name: 'Middle East', definition: 'Gulf states, Israel, Turkey and the wider region, including sovereign wealth and Gulf capital flows.' },
    { name: 'Latin America', definition: 'Brazil, Mexico, Chile, Colombia and the region as a whole.' },
    { name: 'Emerging Markets', definition: 'EM as a whole, or EM outside the named regions.' },
    { name: 'Frontier Markets', definition: 'Frontier markets.' },
  ] },
  { name: 'Markets & Valuation', kind: 'topic', children: [
    { name: 'Valuations & Market Concentration', definition: 'Whether markets are expensive, bubbles, index concentration, mega-cap dominance.' },
    { name: 'Earnings & Corporate Fundamentals', definition: 'Earnings, margins, revisions, balance sheets, buybacks and dividend policy.' },
    { name: 'Credit Conditions & Defaults', definition: 'Spreads, defaults, lending standards, the credit cycle, public or private.' },
    { name: 'Market Liquidity & Structure', definition: 'Market functioning, trading, repo and funding plumbing, settlement.' },
    { name: 'Volatility & Tail Risk', definition: 'Volatility regimes, drawdowns, hedging, tail protection.' },
  ] },
  { name: 'Investment Styles & Approaches', kind: 'topic', children: [
    { name: 'Value', definition: 'Value investing, value vs growth spreads, cheap segments.' },
    { name: 'Growth', definition: 'Growth investing, long-duration growth equities.' },
    { name: 'Quality', definition: 'The equity quality factor: profitability, earnings stability and balance-sheet strength of listed companies.', boundary: 'Equities only. Credit quality and ratings in bond pieces are not this theme; they go to Credit Conditions & Defaults.' },
    { name: 'Income & Dividends', definition: 'Yield-seeking strategies, dividend investing, income portfolios.' },
    { name: 'Small & Mid Caps', definition: 'Size, small and mid-cap opportunity.' },
    { name: 'Quant & Factors', definition: 'Factor premia, systematic and model-driven strategies, momentum, low volatility.' },
    { name: 'Active vs Passive', definition: "Active management's case, passive growth, active share, fee debates." },
    { name: 'Portfolio Construction & Diversification', definition: 'Allocation methods, stock-bond correlation, total portfolio approach, rebalancing.' },
    { name: 'Behavioural Finance', definition: 'Investor behaviour, biases, sentiment.' },
  ] },
  { name: 'AI & Technology', kind: 'topic', children: [
    { name: 'AI Adoption & Economics', definition: "How AI is used, its productivity and profit case, AI companies' economics." },
    { name: 'AI Build-out & Financing', definition: 'Data centres, chips, AI capex and power demand, how the build-out is financed.' },
    { name: 'Technology & Disruption', definition: 'Non-AI technology: the semiconductor cycle, digital platforms, disruption of incumbents.', boundary: 'Cybersecurity goes to its own theme.' },
    { name: 'Tokenisation & Digital Finance', definition: 'Tokenised funds and assets, stablecoins, digital money and market infrastructure, where discussed outside crypto investing itself.' },
  ] },
  { name: 'Sustainability', kind: 'topic', children: [
    { name: 'Sustainable Investing & ESG Integration', definition: 'ESG integration, sustainable funds and their performance, the general case for or against ESG.' },
    { name: 'Governance & Stewardship', definition: 'Engagement, voting, shareholder rights, board governance, investor coalitions.' },
    { name: 'Energy Transition', definition: 'Renewables, electrification, grids, storage, decarbonisation investment.' },
    { name: 'Climate Risk & Adaptation', definition: 'Physical and transition risk, adaptation, extreme weather, insurance.' },
    { name: 'Nature & Social', definition: 'Biodiversity, land use, water as an environmental risk, human rights, labour standards, inequality.', boundary: 'Water as an investment opportunity goes to Water.' },
    { name: 'Sustainability Regulation & Disclosure', definition: 'ESG and climate reporting rules (ISSB, CSRD, SFDR, SEC), labels, anti-ESG politics.' },
    { name: 'Green & Transition Finance', definition: 'Green and sustainability-linked bonds, transition finance, impact and blended finance.' },
  ] },
  { name: 'Energy & Commodities', kind: 'topic', children: [
    { name: 'Energy Markets & Security', definition: 'Oil, gas and power prices and supply, energy security, OPEC.' },
    { name: 'Commodities & Gold', definition: 'Metals, agriculture, gold as a reserve and hedge, commodity cycles.' },
  ] },
  { name: 'Thematic Investing', kind: 'topic', children: [
    { name: 'Healthcare Innovation', definition: 'Biotech, medical technology, obesity drugs, healthcare as a long-term theme.' },
    { name: 'Robotics & Automation', definition: 'Industrial automation and robotics (not AI models).' },
    { name: 'Cybersecurity', definition: 'Cyber threats and the companies and spending that address them, as an investment theme.' },
    { name: 'Water', definition: 'Water utilities, infrastructure, treatment and efficiency technology as an investment theme.' },
    { name: 'Space', definition: 'Satellites, launch, space infrastructure and the space economy.' },
    { name: 'Infrastructure & Public Investment', definition: 'Transport, utilities and public capex (non-AI).', boundary: 'Data centres go to AI Build-out & Financing; water infrastructure goes to Water.' },
    { name: 'Demographics & Longevity', definition: 'Ageing, population change, the longevity economy.' },
    { name: 'Reshoring & Industrial Policy', definition: 'Industrial policy, subsidies, near-shoring and the capex they drive.' },
  ] },
  { name: 'Vehicles & Products', kind: 'facet', children: [
    { name: 'ETFs', definition: 'ETF products, flows, launches, ETF market structure.' },
    { name: 'Active ETFs', definition: 'Active strategies in ETF wrappers.' },
    { name: 'Index & Passive', definition: 'Index funds and index construction.' },
    { name: 'Thematic Funds', definition: 'Thematic products as products: launches, flows, performance of thematic funds.' },
    { name: 'Model Portfolios', definition: 'Model portfolio services and managed solutions.' },
    { name: 'Semi-liquid & Evergreen Funds', definition: 'ELTIFs, LTAFs, interval and evergreen private-market funds.' },
    { name: 'Target-date & Retirement Products', definition: 'Target-date funds, retirement income products.' },
  ] },
  { name: 'Industry & Clients', kind: 'topic', children: [
    { name: 'Pensions & Retirement', definition: 'Pension policy and reform, DB and DC schemes, decumulation.' },
    { name: 'Wealth & Private Markets Access', definition: 'Private wealth, advisers, retail access to private markets.' },
    { name: 'Asset Management Industry', definition: 'Fees, consolidation, distribution, business models.' },
  ] },
  { name: 'Regulation & Stability', kind: 'topic', children: [
    { name: 'Financial Regulation', definition: 'Non-ESG rules for banks, funds, markets and crypto.' },
    { name: 'Financial Stability & Systemic Risk', definition: 'Bank and non-bank stress, contagion, leverage, hedge-fund and NBFI risk.' },
  ] },
]

export const OVERLAP_RULES = [
  'Monetary Policy vs Inflation: what the central bank will do vs why prices are moving; both if the piece does both.',
  'Energy Transition vs Energy Markets & Security: clean-energy build-out vs fossil energy prices and supply.',
  'AI Adoption vs AI Build-out: use and returns vs physical capacity and its funding.',
  'Sustainable Investing vs Governance vs Transition: the case for ESG in general; voting and engagement; decarbonisation investment.',
  'Sustainability Regulation vs Financial Regulation: ESG and climate rules vs all other rules.',
  'Thematic Investing vs Thematic Funds: a piece about the theme takes the Thematic Investing child; a piece about a product (launch, flows) takes Thematic Funds; often both.',
  'Water vs Nature & Social: investing in water solutions is Water; water scarcity as a risk is Nature & Social; both if both.',
  'Cybersecurity vs Defence & Security: cyber as a market and spending theme vs state security and defence budgets.',
  'Regions: the most specific region (Korea & Taiwan rather than Asia ex-Japan; Brazil is Latin America, not Emerging Markets) unless the piece covers the wider group.',
  'Styles vs sub-asset class: a value-equities piece takes Value as a theme and Equities › Style as sub-asset class, set independently.',
  'Quality is an equity theme only; never tag it on a credit or bond piece.',
]

export const TOPIC_THEMES = THEME_PARENTS.filter(p => p.kind === 'topic').flatMap(p => p.children.map(c => c.name))
export const REGION_FACETS = THEME_PARENTS.find(p => p.name === 'Regions & Markets')!.children.map(c => c.name)
export const VEHICLE_FACETS = THEME_PARENTS.find(p => p.name === 'Vehicles & Products')!.children.map(c => c.name)
export const ALL_THEMES = THEME_PARENTS.flatMap(p => p.children.map(c => c.name))
export const PARENT_OF: Record<string, string> = Object.fromEntries(THEME_PARENTS.flatMap(p => p.children.map(c => [c.name, p.name])))

// ── Other classification fields ──────────────────────────────────────────

export const CONTENT_PURPOSES = ['house view', 'market commentary', 'education', 'product', 'thought leadership'] as const
export type ContentPurpose = typeof CONTENT_PURPOSES[number]

export const FORMATS = ['article', 'research paper', 'outlook', 'podcast', 'video', 'webinar', 'chart', 'social'] as const
export type Format = typeof FORMATS[number]

/** Exact-name match, case-insensitive; anything else is dropped rather than guessed */
export function pick<T extends string>(allowed: readonly T[], values: unknown, max: number): T[] {
  const byLower = new Map(allowed.map(a => [a.toLowerCase(), a]))
  const out: T[] = []
  for (const v of Array.isArray(values) ? values : []) {
    const hit = byLower.get(String(v).trim().toLowerCase())
    if (hit && !out.includes(hit)) out.push(hit)
    if (out.length >= max) break
  }
  return out
}
