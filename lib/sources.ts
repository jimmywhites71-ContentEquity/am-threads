// The manager universe: each tracked house, where its content is listed, and how an address tells
// us which regional edition and client channel it belongs to.
//
// Houses come from the roster (lib/roster.ts: the top 100 of the TAI / P&I 500, mapped to the houses
// that publish). Wave 1 is collected from the start; wave 2 once wave 1 is stable (?wave=2).
//
// Most houses start with a 'robots' source: the site's robots.txt names its sitemaps, and pages are
// kept if their address looks like insight content (INSIGHT_PATH, or the house's own pattern). This
// avoids guessing each sitemap's address. `verified` records whether a source has been seen working;
// the dry run of /api/discover checks them all, and the weekly check-in fixes the rest.

import { ROSTER } from './roster'

export type ContentType = 'article' | 'podcast' | 'video'

/** Fields read by the copied AlphaThreads reader (lib/sitemap.ts) and by lib/collect.ts */
export interface Source {
  id: string
  name: string
  provider: string
  category: string
  feed_url: string
  content_type: ContentType
  active?: boolean
  /** 'robots': feed_url is the site's home; its robots.txt (or /sitemap.xml) gives the sitemaps */
  kind?: 'rss' | 'sitemap' | 'listing' | 'page' | 'robots'
  /** Only pages whose address matches this pattern ({yyyy} = this year or last) */
  pageInclude?: string
  /** Leave out pages whose address matches this pattern */
  pageExclude?: string
  titleExclude?: string
  keywords?: string[]
  maxPerDay?: number
  lookbackDays?: number
  editions?: { match: string; every: 'quarter' | 'month'; title?: string }[]
  /**
   * The site refuses automated readers, so only headlines are collected, from a news index
   * (Google News, searched by site). feed_url may contain {days}. Pieces are stored as headlines
   * and tagged from their titles; they get no form or readability measures.
   */
  headlineOnly?: boolean
  /** The site's sitemap dates are stale or wrong: treat every entry as undated */
  ignoreLastmod?: boolean
}

export type Channel = 'institutional' | 'wholesale' | 'retail' | 'all'
export interface EditionRule { match: string; region: string; channel: Channel }

export interface ManagerSource extends Source {
  manager: string
  /** Date seen working, 'alphathreads' (works there), or false (not yet checked) */
  verified: string | 'alphathreads' | false
}

export interface Manager {
  id: string
  name: string
  parent_group: string
  home: string
  wave: 1 | 2
  /** Address rules for region and channel; first match wins, then the generic rules below */
  editions: EditionRule[]
}

// Addresses that usually hold insight content, across houses
export const INSIGHT_PATH = '/(insights?|perspectives?|research|thinking|ideas|viewpoints?|market-?(insights?|commentary|outlook|views?|updates?)|commentary|outlooks?|articles?|blogs?|podcasts?|webinars?|videos?|news-and-insights|knowledge|publications?|investment-(insights|ideas|outlook|strategy)|our-thinking|thought-leadership|white-?papers?|strategy)/'
// Pages that are never content: fund and product pages, legal, people, careers, search
const NOT_CONTENT = '/(funds?|products?|fund-centre|fund-center|prices?|literature|documents?|legal|privacy|cookies?|terms|careers?|jobs|people|our-people|team|contact|about-us|login|search|tags?|authors?|events?/?$|press-releases?)(/|$)|\\.(jpg|png|zip)$'

type HouseSpec = [id: string, name: string, home: string, pageInclude?: string]

// Houses beyond the first eleven, by wave. Name, home site, and the house's own insight pattern
// where its addresses are known to differ from INSIGHT_PATH.
const HOUSES: HouseSpec[] = [
  ['blackrock', 'BlackRock', 'https://www.blackrock.com', '/(insights|blackrock-investment-institute)/'],
  ['fidelity-us', 'Fidelity Investments', 'https://institutional.fidelity.com'],
  ['gsam', 'Goldman Sachs Asset Management', 'https://am.gs.com', '/insights/'],
  ['capital-group', 'Capital Group', 'https://www.capitalgroup.com', '/insights/'],
  ['ubs-am', 'UBS Asset Management', 'https://www.ubs.com', '/assetmanagement/insights/'],
  ['bny', 'BNY Investments', 'https://www.bny.com', '/investments/[^?#]*insights/'],
  ['insight', 'Insight Investment', 'https://www.insightinvestment.com'],
  ['newton', 'Newton Investment Management', 'https://www.newtonim.com'],
  ['lgam', 'L&G Asset Management', 'https://am.landg.com'],
  ['invesco', 'Invesco', 'https://www.invesco.com'],
  ['franklin', 'Franklin Templeton', 'https://www.franklintempleton.com'],
  ['pgim', 'PGIM', 'https://www.pgim.com'],
  ['troweprice', 'T. Rowe Price', 'https://www.troweprice.com'],
  ['bnppam', 'BNP Paribas Asset Management', 'https://www.bnpparibas-am.com'],
  ['ntam', 'Northern Trust Asset Management', 'https://www.northerntrust.com', '/asset-management/[^?#]*(insights|commentary|research)/'],
  ['msim', 'Morgan Stanley Investment Management', 'https://www.morganstanley.com', '/im/[^?#]*(insights|articles)/'],
  ['natixis', 'Natixis Investment Managers', 'https://www.im.natixis.com'],
  ['loomis', 'Loomis Sayles', 'https://www.loomissayles.com'],
  ['nuveen', 'Nuveen', 'https://www.nuveen.com'],
  ['hsbc-am', 'HSBC Asset Management', 'https://www.assetmanagement.hsbc.com'],
  ['mfs', 'MFS Investment Management', 'https://www.mfs.com'],
  ['columbia-threadneedle', 'Columbia Threadneedle Investments', 'https://www.columbiathreadneedle.com'],
  ['dws', 'DWS', 'https://www.dws.com'],
  ['manulife-im', 'Manulife Investment Management', 'https://www.manulifeim.com'],
  ['aegon-am', 'Aegon Asset Management', 'https://www.aegonam.com'],
  ['brookfield', 'Brookfield Asset Management', 'https://www.brookfield.com'],
  ['schwab', 'Charles Schwab', 'https://www.schwab.com', '/learn/story/'],
  ['rbc-gam', 'RBC Global Asset Management', 'https://www.rbcgam.com'],
  ['federated-hermes', 'Federated Hermes', 'https://www.federatedhermes.com'],
  ['nyli', 'New York Life Investments', 'https://www.newyorklifeinvestments.com'],
  ['alliancebernstein', 'AllianceBernstein', 'https://www.alliancebernstein.com'],
  ['principal-am', 'Principal Asset Management', 'https://www.principalam.com'],
  ['dimensional', 'Dimensional Fund Advisors', 'https://www.dimensional.com'],
  ['metlife-im', 'MetLife Investment Management', 'https://investments.metlife.com'],
  ['macquarie-am', 'Macquarie Asset Management', 'https://www.macquarie.com', '/assets-management/[^?#]*insights/'],
  ['generali-investments', 'Generali Investments', 'https://www.generali-investments.com'],
  ['kkr', 'KKR', 'https://www.kkr.com', '/insights/'],
  ['barings', 'Barings', 'https://www.barings.com'],
  ['allspring', 'Allspring Global Investments', 'https://www.allspringglobal.com'],
  ['aberdeen', 'aberdeen', 'https://www.aberdeeninvestments.com'],
  ['voya-im', 'Voya Investment Management', 'https://individuals.voya.com', '/(insights|voya-investment-management)/'],
  ['neuberger', 'Neuberger Berman', 'https://www.nb.com'],
  ['nordea-am', 'Nordea Asset Management', 'https://www.nordeaassetmanagement.com'],
  ['ares', 'Ares Management', 'https://www.aresmgmt.com'],
  ['mercer', 'Mercer', 'https://www.mercer.com', '/insights/investments/'],
  ['dodge-cox', 'Dodge & Cox', 'https://www.dodgeandcox.com'],
  ['sei', 'SEI', 'https://www.seic.com'],
  ['janus-henderson', 'Janus Henderson Investors', 'https://www.janushenderson.com'],
  ['russell', 'Russell Investments', 'https://russellinvestments.com'],
  ['baillie-gifford', 'Baillie Gifford', 'https://www.bailliegifford.com'],
  ['aviva-investors', 'Aviva Investors', 'https://www.avivainvestors.com'],
  ['pictet-am', 'Pictet Asset Management', 'https://am.pictet'],
  // Added to wave 1 by James (15 Oct)
  ['mandg', 'M&G Investments', 'https://www.mandg.com', '/(investments/[^?#]*(insights|thinking|perspectives)|insights)/'],
  ['blackstone', 'Blackstone', 'https://www.blackstone.com', '/insights/'],
  ['apollo', 'Apollo', 'https://www.apollo.com', '/insights-news/(insights|pymts)/'],
  ['lazard', 'Lazard Asset Management', 'https://www.lazardassetmanagement.com'],
  ['robeco', 'Robeco', 'https://www.robeco.com'],
  ['rlam', 'Royal London Asset Management', 'https://www.rlam.com'],
  ['man-group', 'Man Group', 'https://www.man.com', '/(insights|maninstitute)/'],
  ['ninety-one', 'Ninety One', 'https://ninetyone.com'],
  // Added to wave 1 by James (17 Oct)
  ['gemcorp', 'Gemcorp Capital', 'https://www.gemcorpcapital.com', '/insight/[^?#]+'],
  ['nedgroup', 'Nedgroup Investments', 'https://www.nedgroupinvestments.com'],
  // Wave 2
  ['mackenzie', 'Mackenzie Investments', 'https://www.mackenzieinvestments.com'],
  ['amova', 'Amova Asset Management (formerly Nikko AM)', 'https://www.nikkoam.com'],
  ['first-sentier', 'First Sentier Investors', 'https://www.firstsentierinvestors.com'],
  ['nomura-am', 'Nomura Asset Management', 'https://www.nomura-asset.com'],
  ['am-one', 'Asset Management One', 'https://www.am-one.co.jp'],
  ['union-investment', 'Union Investment', 'https://institutional.union-investment.de'],
  ['eurizon', 'Eurizon', 'https://www.eurizoncapital.com'],
  ['us-bank', 'U.S. Bank Asset Management', 'https://www.usbank.com', '/investing/financial-perspectives/'],
  ['meag', 'MEAG', 'https://www.meag.com'],
  ['td-am', 'TD Asset Management', 'https://www.td.com', '/ca/en/asset-management/[^?#]*insights/'],
  ['swiss-life-am', 'Swiss Life Asset Managers', 'https://www.swisslife-am.com'],
  ['eastspring', 'Eastspring Investments', 'https://www.eastspring.com'],
  ['samsung-am', 'Samsung Asset Management', 'https://www.samsungfund.com'],
  ['1832-am', '1832 Asset Management', 'https://www.dynamic.ca'],
  ['swisscanto', 'Swisscanto', 'https://www.swisscanto.com'],
  ['bmo-gam', 'BMO Global Asset Management', 'https://www.bmogam.com'],
]

// Address rules worked out for the first eleven houses (14 Oct)
const EDITION_RULES: Record<string, EditionRule[]> = {
  jpmam: [
    { match: '/us/en/asset-management/institutional/', region: 'US', channel: 'institutional' },
    { match: '/us/en/asset-management/adv/', region: 'US', channel: 'wholesale' },
    { match: '/gb/en/asset-management/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/gb/en/asset-management/adv/', region: 'UK', channel: 'wholesale' },
    { match: '/gb/en/asset-management/liq/', region: 'UK', channel: 'institutional' },
  ],
  amundi: [{ match: 'research-center\\.amundi\\.com', region: 'Global', channel: 'all' }],
  schroders: [
    { match: '/en-gb/uk/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/en-gb/uk/intermediary/', region: 'UK', channel: 'wholesale' },
    { match: '/en-gb/uk/individual/', region: 'UK', channel: 'retail' },
  ],
  'fidelity-intl': [
    { match: 'professionals\\.fidelity\\.co\\.uk', region: 'UK', channel: 'wholesale' },
    { match: 'fidelityinstitutional\\.com', region: 'Global', channel: 'institutional' },
  ],
  vanguard: [
    { match: 'advisors\\.vanguard\\.com', region: 'US', channel: 'wholesale' },
    { match: 'institutional\\.vanguard\\.com', region: 'US', channel: 'institutional' },
    { match: 'vanguard\\.co\\.uk', region: 'UK', channel: 'all' },
    { match: 'corporate\\.vanguard\\.com', region: 'Global', channel: 'all' },
  ],
  'fidelity-us': [{ match: 'institutional\\.fidelity\\.com', region: 'US', channel: 'institutional' }],
}

// Generic rules: locale and audience segments that most houses put in their addresses
const REGION_SEGMENTS: [RegExp, string][] = [
  [/\/(en[-_]gb|gb|uk)(\/|[-_])/i, 'UK'], [/\/(en[-_]us|us)(\/|[-_])/i, 'US'], [/\/(en[-_]ca|fr[-_]ca|ca)\//i, 'Canada'],
  [/\/(de[-_]de|de|de[-_]at|at)\//i, 'Germany & Austria'], [/\/(fr[-_]fr|fr)\//i, 'France'], [/\/(it[-_]it|it)\//i, 'Italy'],
  [/\/(es[-_]es|es)\//i, 'Spain'], [/\/(nl[-_]nl|nl)\//i, 'Netherlands'], [/\/(ch|de[-_]ch|fr[-_]ch|en[-_]ch)\//i, 'Switzerland'],
  [/\/(en[-_]?(sg|hk|au|jp)|sg|hk|au|jp|zh[-_]hk|ja[-_]jp)\//i, 'APAC'], [/\/(en[-_]int|int|global|en[-_]gl)\//i, 'Global'],
]
const CHANNEL_SEGMENTS: [RegExp, Channel][] = [
  [/\/(institutional|institutions|inst|liq|consultants?|insurance|pensions?)\//i, 'institutional'],
  [/\/(intermediary|intermediaries|financial-intermediar(y|ies)|adv|advisers?|advisors?|financial-professionals?|professionals?|wholesale|professional-investors?|wealth-managers?)\//i, 'wholesale'],
  [/\/(individual|individuals|retail|private-investors?|personal|investors?\/individual)\//i, 'retail'],
]

const rosterRow = (id: string) => ROSTER.find(r => r.houses.includes(id) && r.status !== 'merged')

export const MANAGERS: Manager[] = (() => {
  const first: [string, string, string][] = [
    ['jpmam', 'J.P. Morgan Asset Management', 'https://am.jpmorgan.com'],
    ['amundi', 'Amundi', 'https://research-center.amundi.com'],
    ['schroders', 'Schroders', 'https://www.schroders.com'],
    ['fidelity-intl', 'Fidelity International', 'https://professionals.fidelity.co.uk'],
    ['vanguard', 'Vanguard', 'https://corporate.vanguard.com'],
    ['pimco', 'PIMCO', 'https://www.pimco.com'],
    ['wellington', 'Wellington Management', 'https://www.wellington.com'],
    ['ssga', 'State Street Global Advisors', 'https://www.ssga.com'],
    ['aqr', 'AQR', 'https://www.aqr.com'],
    ['bridgewater', 'Bridgewater Associates', 'https://www.bridgewater.com'],
    ['allianzgi', 'Allianz Global Investors', 'https://www.allianzgi.com'],
  ]
  const all = [...first.map(([id, name, home]) => ({ id, name, home })), ...HOUSES.map(([id, name, home]) => ({ id, name, home }))]
  return all.map(h => {
    const row = rosterRow(h.id)
    return {
      ...h,
      parent_group: row?.group || h.name,
      wave: (row?.status === 'wave 2' ? 2 : 1) as 1 | 2,
      editions: EDITION_RULES[h.id] || [],
    }
  })
})()

export const MANAGER_BY_ID = new Map(MANAGERS.map(m => [m.id, m]))

const S = (manager: string, s: Omit<ManagerSource, 'manager' | 'provider' | 'category'>): ManagerSource => ({
  manager, provider: MANAGER_BY_ID.get(manager)!.name, category: 'Asset manager', ...s,
})

// Hand-set sources for the first eleven houses (three of them work on AlphaThreads)
const FIRST_SOURCES: ManagerSource[] = [
  S('jpmam', { id: 'jpmam-us-adv', name: 'Insights (US advisers)', feed_url: 'https://am.jpmorgan.com/us/en/asset-management/adv/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/adv/insights/[^?#]+', pageExclude: NOT_CONTENT, verified: 'alphathreads' }),
  S('jpmam', { id: 'jpmam-gb-liq', name: 'Insights (UK institutional)', feed_url: 'https://am.jpmorgan.com/gb/en/asset-management/liq/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/liq/insights/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
  S('amundi', { id: 'amundi-research', name: 'Research Center', feed_url: 'https://research-center.amundi.com', content_type: 'article', kind: 'robots', pageInclude: '/(article|insights?)/[^?#]+', verified: false }),
  S('schroders', { id: 'schroders-uk-inst', name: 'Insights (UK institutional)', feed_url: 'https://www.schroders.com/en-gb/uk/institutional/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/en-gb/uk/institutional/insights/[^/]+/?$', verified: 'alphathreads' }),
  S('fidelity-intl', { id: 'fidelity-uk-pro', name: 'Insights (UK professional)', feed_url: 'https://professionals.fidelity.co.uk/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/(perspectives|articles|insights)/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
  S('vanguard', { id: 'vanguard-corporate', name: 'Insights', feed_url: 'https://corporate.vanguard.com', content_type: 'article', kind: 'robots', pageInclude: '/(articles|insights|research)/[^?#]+', verified: false }),
  S('pimco', { id: 'pimco-us', name: 'Insights', feed_url: 'https://www.pimco.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/(us|gb)/en/insights/[^?#]+', verified: 'alphathreads' }),
  S('wellington', { id: 'wellington-us-inst', name: 'Insights', feed_url: 'https://www.wellington.com', content_type: 'article', kind: 'robots', pageInclude: '/en-(us|gb)/[^?#]*insights/[^?#]+', ignoreLastmod: true, verified: false }),
  S('ssga', { id: 'ssga-us-inst', name: 'Insights', feed_url: 'https://www.ssga.com', content_type: 'article', kind: 'robots', pageInclude: '/(us|uk|ie|int)/en[^/]*/[^?#]*insights/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
  S('aqr', { id: 'aqr-insights', name: 'Research & Perspectives', feed_url: 'https://www.aqr.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/Insights/(Research|Perspectives)/[^?#]+', verified: false }),
  S('bridgewater', { id: 'bridgewater-research', name: 'Research & Insights', feed_url: 'https://www.bridgewater.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/research-and-insights/[^?#]+', verified: false }),
  S('allianzgi', { id: 'allianzgi-uk', name: 'Insights (UK)', feed_url: 'https://www.allianzgi.com/en-gb/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/en(-gb)?/[^?#]*insights/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
]

// House-specific settings found by the source check (17 Oct 2026)
const OVERRIDES: Record<string, Partial<ManagerSource>> = {
  russell: { pageInclude: '/(blog|insights|perspectives)/[^?#]+', ignoreLastmod: true },
  newton: { ignoreLastmod: true },
  mercer: { ignoreLastmod: true },
  // Fixes from the 23 Oct review
  bnppam: { pageInclude: '/(insights|forward-thinking|portfolio-perspectives|front-of-mind|viewpoints?)/[^?#]+' },
  allspring: { pageInclude: '/insights/[^?#]+', ignoreLastmod: true },
  // robots.txt names rbcgam.com/sitemap.xml, which is a 404; the www address works
  'rbc-gam': { kind: 'sitemap', feed_url: 'https://www.rbcgam.com/sitemap.xml', pageInclude: '/en/ca/[^?#]*(insights|article)[^?#]*/[^?#]+' },
  'macquarie-am': { pageInclude: '/(insights|perspectives)/[^?#]+' },
  // Pictet's English articles sit in its UK sitemap among 89 others: read that one directly
  'pictet-am': { kind: 'sitemap', feed_url: 'https://am.pictet.com/content/am-pictet.sitemap.uk-en-sites-sitemap.xml', pageInclude: '/uk/en/(investment-views|investment-research|mega|insights|perspectives)/[^?#]+' },
  // No sitemap with articles: read their insight listing pages instead
  lgam: { kind: 'listing', feed_url: 'https://am.landg.com/en-uk/institutional/insights/', pageInclude: '/insights/[^?#]+/[^?#]+' },
  'hsbc-am': { kind: 'listing', feed_url: 'https://www.assetmanagement.hsbc.co.uk/en/institutional-investor/news-and-insights', pageInclude: '/news-and-insights/[^?#]+' },
  schwab: { kind: 'listing', feed_url: 'https://www.schwab.com/learn', pageInclude: '/learn/story/[^?#]+' },
  'metlife-im': { kind: 'listing', feed_url: 'https://investments.metlife.com/insights/', pageInclude: '/insights/[^?#]+' },
  robeco: { kind: 'listing', feed_url: 'https://www.robeco.com/en-int/insights', pageInclude: '/insights/[^?#]+' },
}

// Sites that refuse automated readers (403 or 429 to every request, 17 Oct 2026): their own site
// source is switched off and headlines come from Google News instead. Sites that only timed out
// keep their site source too, in case it was a slow day.
// msim and nuveen: their own sites time out or carry no sitemap, so they rely on headlines (23 Oct)
const REFUSING = new Set(['msim', 'nuveen', 'nedgroup', 'aegon-am', 'fidelity-intl', 'manulife-im', 'neuberger', 'aviva-investors', 'blackstone', 'ninety-one', 'rlam'])
const HEADLINE_SITES: [manager: string, site: string][] = [
  ['nedgroup', 'nedgroupinvestments.com'],
  ['aegon-am', 'aegonam.com'],  // insights load by JavaScript, so headlines only
  ['lgam', 'am.landg.com'],     // the listing page shows only the latest ten; headlines fill the gaps
  ['fidelity-intl', 'fidelityinternational.com'],
  ['ntam', 'northerntrust.com'],
  ['schwab', 'schwab.com/learn/story'],  // its listing page shows no links to our reader
  ['msim', 'morganstanley.com/im'],
  ['nuveen', 'nuveen.com'],
  ['manulife-im', 'manulifeim.com'],
  ['alliancebernstein', 'alliancebernstein.com'],
  ['neuberger', 'nb.com'],
  ['aviva-investors', 'avivainvestors.com'],
  ['blackstone', 'blackstone.com/insights'],
  ['ninety-one', 'ninetyone.com'],
  ['rlam', 'rlam.com'],
]
const newsFeed = (site: string) => `https://news.google.com/rss/search?q=site:${encodeURIComponent(site)}+when:{days}d&hl=en-GB&gl=GB&ceid=GB:en`

export const SOURCES: ManagerSource[] = [
  ...FIRST_SOURCES,
  ...HOUSES.map(([id, , home, include]) => S(id, {
    id: `${id}-site`, name: 'Insights (site)', feed_url: home, content_type: 'article', kind: 'robots',
    pageInclude: include || INSIGHT_PATH, pageExclude: NOT_CONTENT, verified: false,
    ...(OVERRIDES[id] || {}),
  })),
  // Nedgroup's own site refuses our reader; its podcast feed carries its insight series
  S('nedgroup', { id: 'nedgroup-podcast', name: 'Insights podcast', feed_url: 'https://rss.iono.fm/rss/chan/8736', content_type: 'podcast', kind: 'rss', verified: false }),
  ...HEADLINE_SITES.map(([id, site]) => S(id, {
    id: `${id}-news`, name: 'Headlines (news index)', feed_url: newsFeed(site), content_type: 'article', kind: 'rss',
    headlineOnly: true, verified: false,
  })),
]

for (const s of SOURCES) if (REFUSING.has(s.manager) && s.id.endsWith('-site')) s.active = false

export const sourcesForWave = (wave: 1 | 2 | 'all') =>
  SOURCES.filter(s => s.active !== false && (wave === 'all' || MANAGER_BY_ID.get(s.manager)!.wave === wave))
export const ACTIVE_SOURCES = sourcesForWave(1)

/** Region and channel of one edition: the house's own rules, then the generic address segments */
export function editionOf(managerId: string, url: string): { region: string; channel: Channel } {
  for (const r of MANAGER_BY_ID.get(managerId)?.editions || []) {
    if (new RegExp(r.match, 'i').test(url)) return { region: r.region, channel: r.channel }
  }
  let path = url
  try { const u = new URL(url); path = `${u.pathname}/` } catch {}
  const region = REGION_SEGMENTS.find(([re]) => re.test(path))?.[1] || 'Global'
  const channel = CHANNEL_SEGMENTS.find(([re]) => re.test(path))?.[1] || 'all'
  return { region, channel }
}
