// The manager universe: who is tracked, where their content is listed, and how an address tells
// us which regional edition and client channel it belongs to.
//
// First roster: the 11 multi-asset houses (build plan, Part 6). Every source collects the house's
// whole output; asset class is a tag on each piece, not a reason to leave anything out.
//
// `verified` records whether an index address has been seen to work. Unverified addresses are best
// first guesses taken from the houses' public sites; the probe (/api/probe) reports which work, and
// the weekly check-in fixes the rest. Those carried over from AlphaThreads are marked as such.

export type ContentType = 'article' | 'podcast' | 'video'

/** Fields read by the copied AlphaThreads sitemap/listing reader (lib/sitemap.ts) */
export interface Source {
  id: string
  name: string
  provider: string
  category: string
  feed_url: string
  content_type: ContentType
  active?: boolean
  kind?: 'rss' | 'sitemap' | 'listing' | 'page'
  /** Only pages whose address matches this pattern ({yyyy} = this year or last) */
  pageInclude?: string
  /** Leave out pages whose address matches this pattern (fund pages, legal pages, careers) */
  pageExclude?: string
  titleExclude?: string
  keywords?: string[]
  maxPerDay?: number
  lookbackDays?: number
  editions?: { match: string; every: 'quarter' | 'month'; title?: string }[]
}

export type Channel = 'institutional' | 'wholesale' | 'retail' | 'all'

/** An address pattern that sets the edition's region and channel */
export interface EditionRule { match: string; region: string; channel: Channel }

export interface ManagerSource extends Source {
  manager: string
  /** Seen working (date), carried over from AlphaThreads, or not yet checked */
  verified: string | 'alphathreads' | false
}

export interface Manager {
  id: string
  name: string
  parent_group: string
  home: string
  /** First match wins; unmatched addresses get region 'Global' and channel 'all' */
  editions: EditionRule[]
}

export const MANAGERS: Manager[] = [
  { id: 'jpmam', name: 'J.P. Morgan Asset Management', parent_group: 'JPMorgan Chase', home: 'https://am.jpmorgan.com', editions: [
    { match: '/us/en/asset-management/institutional/', region: 'US', channel: 'institutional' },
    { match: '/us/en/asset-management/adv/', region: 'US', channel: 'wholesale' },
    { match: '/gb/en/asset-management/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/gb/en/asset-management/adv/', region: 'UK', channel: 'wholesale' },
    { match: '/gb/en/asset-management/liq/', region: 'UK', channel: 'institutional' },
    { match: '/it/it/', region: 'Italy', channel: 'all' },
    { match: '/(hk|sg|au|jp)/', region: 'APAC', channel: 'all' },
    { match: '/(de|fr|es|nl|ch|lu)/', region: 'Europe', channel: 'all' },
  ] },
  { id: 'amundi', name: 'Amundi', parent_group: 'Crédit Agricole', home: 'https://research-center.amundi.com', editions: [
    { match: 'research-center\\.amundi\\.com', region: 'Global', channel: 'all' },
  ] },
  { id: 'schroders', name: 'Schroders', parent_group: 'Schroders', home: 'https://www.schroders.com', editions: [
    { match: '/en-gb/uk/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/en-gb/uk/intermediary/', region: 'UK', channel: 'wholesale' },
    { match: '/en-gb/uk/individual/', region: 'UK', channel: 'retail' },
    { match: '/en-us/', region: 'US', channel: 'all' },
    { match: '/it-it/', region: 'Italy', channel: 'all' },
    { match: '/en-(sg|hk|au)/|/zh-hk/', region: 'APAC', channel: 'all' },
  ] },
  { id: 'fidelity-intl', name: 'Fidelity International', parent_group: 'FIL', home: 'https://professionals.fidelity.co.uk', editions: [
    { match: 'professionals\\.fidelity\\.co\\.uk', region: 'UK', channel: 'wholesale' },
    { match: 'fidelityinstitutional\\.com', region: 'Global', channel: 'institutional' },
  ] },
  { id: 'vanguard', name: 'Vanguard', parent_group: 'Vanguard', home: 'https://corporate.vanguard.com', editions: [
    { match: 'advisors\\.vanguard\\.com', region: 'US', channel: 'wholesale' },
    { match: 'institutional\\.vanguard\\.com', region: 'US', channel: 'institutional' },
    { match: 'vanguard\\.co\\.uk', region: 'UK', channel: 'all' },
    { match: 'corporate\\.vanguard\\.com', region: 'Global', channel: 'all' },
  ] },
  { id: 'pimco', name: 'PIMCO', parent_group: 'Allianz', home: 'https://www.pimco.com', editions: [
    { match: '/us/en/', region: 'US', channel: 'all' },
    { match: '/gb/en/', region: 'UK', channel: 'all' },
    { match: '/it/it/', region: 'Italy', channel: 'all' },
    { match: '/(hk|sg|jp|au)/', region: 'APAC', channel: 'all' },
  ] },
  { id: 'wellington', name: 'Wellington Management', parent_group: 'Wellington', home: 'https://www.wellington.com', editions: [
    { match: '/en-us/institutional/', region: 'US', channel: 'institutional' },
    { match: '/en-us/intermediary/', region: 'US', channel: 'wholesale' },
    { match: '/en-gb/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/en-gb/', region: 'UK', channel: 'all' },
    { match: '/it-it/', region: 'Italy', channel: 'all' },
  ] },
  { id: 'ssga', name: 'State Street Global Advisors', parent_group: 'State Street', home: 'https://www.ssga.com', editions: [
    { match: '/us/en/institutional/', region: 'US', channel: 'institutional' },
    { match: '/us/en/intermediary/', region: 'US', channel: 'wholesale' },
    { match: '/uk/en_gb/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/uk/en_gb/intermediary/', region: 'UK', channel: 'wholesale' },
    { match: '/it/it/', region: 'Italy', channel: 'all' },
  ] },
  { id: 'aqr', name: 'AQR', parent_group: 'AQR', home: 'https://www.aqr.com', editions: [] },
  { id: 'bridgewater', name: 'Bridgewater Associates', parent_group: 'Bridgewater', home: 'https://www.bridgewater.com', editions: [] },
  { id: 'allianzgi', name: 'Allianz Global Investors', parent_group: 'Allianz', home: 'https://www.allianzgi.com', editions: [
    { match: '/en-gb/institutional/', region: 'UK', channel: 'institutional' },
    { match: '/en-gb/', region: 'UK', channel: 'all' },
    { match: '/it-it/', region: 'Italy', channel: 'all' },
    { match: '/en-(hk|sg)/|/zh-hk/', region: 'APAC', channel: 'all' },
  ] },
]

const S = (manager: string, s: Omit<ManagerSource, 'manager' | 'provider' | 'category'>): ManagerSource => ({
  manager, provider: MANAGERS.find(m => m.id === manager)!.name, category: 'Asset manager', ...s,
})

// Pages that are never content: fund and product pages, legal, people, careers, events listings
const NOT_CONTENT = '/(funds?|products?|legal|privacy|cookies?|careers?|people|contact|about-us|login|search|tags?|authors?)(/|$)'

export const SOURCES: ManagerSource[] = [
  S('jpmam', { id: 'jpmam-us-adv', name: 'Insights (US advisers)', feed_url: 'https://am.jpmorgan.com/us/en/asset-management/adv/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/adv/insights/[^?#]+', pageExclude: NOT_CONTENT, verified: 'alphathreads' }),
  S('jpmam', { id: 'jpmam-gb-liq', name: 'Insights (UK institutional)', feed_url: 'https://am.jpmorgan.com/gb/en/asset-management/liq/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/liq/insights/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
  S('amundi', { id: 'amundi-research', name: 'Research Center', feed_url: 'https://research-center.amundi.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/article/[^?#]+', verified: false }),
  S('schroders', { id: 'schroders-uk-inst', name: 'Insights (UK institutional)', feed_url: 'https://www.schroders.com/en-gb/uk/institutional/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/en-gb/uk/institutional/insights/[^/]+/?$', verified: 'alphathreads' }),
  S('fidelity-intl', { id: 'fidelity-uk-pro', name: 'Insights (UK professional)', feed_url: 'https://professionals.fidelity.co.uk/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/(perspectives|articles|insights)/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
  S('vanguard', { id: 'vanguard-corporate', name: 'Insights', feed_url: 'https://corporate.vanguard.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/content/corporatesite/us/en/corp/articles/[^?#]+', verified: false }),
  S('pimco', { id: 'pimco-us', name: 'Insights', feed_url: 'https://www.pimco.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/us/en/insights/[^/]+/?$', verified: 'alphathreads' }),
  S('wellington', { id: 'wellington-us-inst', name: 'Insights (US institutional)', feed_url: 'https://www.wellington.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/en-us/institutional/insights/[^?#]+', verified: false }),
  S('ssga', { id: 'ssga-us-inst', name: 'Insights (US institutional)', feed_url: 'https://www.ssga.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/us/en/institutional/insights/[^?#]+', verified: false }),
  S('aqr', { id: 'aqr-insights', name: 'Research & Perspectives', feed_url: 'https://www.aqr.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/Insights/(Research|Perspectives)/[^?#]+', verified: false }),
  S('bridgewater', { id: 'bridgewater-research', name: 'Research & Insights', feed_url: 'https://www.bridgewater.com/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/research-and-insights/[^?#]+', verified: false }),
  S('allianzgi', { id: 'allianzgi-uk', name: 'Insights (UK)', feed_url: 'https://www.allianzgi.com/en-gb/sitemap.xml', content_type: 'article', kind: 'sitemap', pageInclude: '/en-gb/[^?#]*insights/[^?#]+', pageExclude: NOT_CONTENT, verified: false }),
]

export const ACTIVE_SOURCES = SOURCES.filter(s => s.active !== false)
export const MANAGER_BY_ID = new Map(MANAGERS.map(m => [m.id, m]))

/** Region and channel of one edition, from its address */
export function editionOf(managerId: string, url: string): { region: string; channel: Channel } {
  for (const r of MANAGER_BY_ID.get(managerId)?.editions || []) {
    if (new RegExp(r.match, 'i').test(url)) return { region: r.region, channel: r.channel }
  }
  return { region: 'Global', channel: 'all' }
}
