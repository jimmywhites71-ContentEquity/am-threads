// Sources without an RSS feed. Two ways of finding their recent pages:
//   'sitemap' – the site's XML sitemap (page address + last-modified date)
//   'listing' – an ordinary web page that links to the latest articles
// Either way, each new page is then read for its own title, description,
// date and text.

import type { Source } from './sources'
import { cleanImageUrl } from './images'

import { UA } from './bot'

export interface ScrapedItem {
  title: string
  url: string
  published_at: string
  content: string
  image_url: string | null
  content_type: 'article' | 'podcast' | 'video'
}

async function fetchText(url: string, timeoutMs: number, maxChars: number, why?: { reason?: string }): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' } })
    if (!res.ok) { clearTimeout(t); if (why) why.reason = `HTTP ${res.status}`; return null }
    const reader = res.body?.getReader()
    if (!reader) { clearTimeout(t); return (await res.text()).slice(0, maxChars) }
    const dec = new TextDecoder()
    let out = ''
    while (out.length < maxChars) {
      const { done, value } = await reader.read()
      if (done) break
      out += dec.decode(value, { stream: true })
    }
    reader.cancel().catch(() => {})
    clearTimeout(t)
    return out
  } catch (err: any) {
    if (why) why.reason = err?.name === 'AbortError' ? 'timed out' : String(err?.cause?.code || err?.message || err).slice(0, 80)
    return null
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/gi, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

export interface SitemapEntry { loc: string; lastmod: Date | null; title?: string; /** Set for recurring pages: the real address to read, and the edition's name */ readFrom?: string; edition?: string; editionTitle?: string }

/** <url> entries from a sitemap, including Google News sitemaps (publication date and title) */
export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = []
  for (const block of xml.match(/<url\b[\s\S]*?<\/url>/gi) || []) {
    const loc = block.match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1]
    if (!loc) continue
    const when =
      block.match(/<news:publication_date>\s*([^<\s]+)/i)?.[1] ||
      block.match(/<lastmod>\s*([^<\s]+)/i)?.[1]
    const d = when ? new Date(when) : null
    const title = block.match(/<news:title>([\s\S]*?)<\/news:title>/i)?.[1]
    out.push({
      loc: decodeEntities(loc),
      lastmod: d && !isNaN(d.getTime()) ? d : null,
      ...(title ? { title: decodeEntities(title).trim() } : {}),
    })
  }
  return out
}

/** Links on a listing page, as absolute addresses, in page order, without repeats */
export function parseListingLinks(html: string, pageUrl: string): string[] {
  const seen = new Set<string>()
  // Some sites load their list as JSON: every address or path in it is a candidate
  if (/^\s*[{[]/.test(html)) {
    try {
      const walk = (v: unknown) => {
        if (typeof v === 'string') {
          if (/^(https?:\/\/|\/)[^\s"<>]+$/.test(v)) { try { const u = new URL(v, pageUrl); u.hash = ''; seen.add(u.toString()) } catch {} }
        } else if (Array.isArray(v)) v.forEach(walk)
        else if (v && typeof v === 'object') Object.values(v as object).forEach(walk)
      }
      walk(JSON.parse(html))
      return Array.from(seen)
    } catch {}
  }
  for (const m of html.matchAll(/<a\b[^>]*?href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(decodeEntities(m[1]), pageUrl)
      if (!/^https?:$/.test(u.protocol)) continue
      u.hash = ''
      seen.add(u.toString())
    } catch {}
  }
  return Array.from(seen)
}

function meta(html: string, prop: string): string | null {
  const v =
    html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]
  return v ? decodeEntities(v).trim() : null
}

function textOf(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim()
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH_RE = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'

/** A date written out in the text, e.g. "Sep 24, 2026", "17 Sept 2026", "September 17, 2026" */
export function dateInText(text: string): Date | null {
  const us = text.match(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b`, 'i'))
  const uk = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?,?\\s+(20\\d\\d)\\b`, 'i'))
  // Whichever appears first in the text
  const pick = us && uk ? ((us.index ?? 0) <= (uk.index ?? 0) ? 'us' : 'uk') : us ? 'us' : uk ? 'uk' : null
  if (!pick) return null
  const [mon, day, year] = pick === 'us' ? [us![1], us![2], us![3]] : [uk![2], uk![1], uk![3]]
  const m = MONTHS.indexOf(mon.slice(0, 3).toLowerCase())
  const d = new Date(Date.UTC(Number(year), m, Number(day), 12))
  return m >= 0 && !isNaN(d.getTime()) ? d : null
}

/** A date in the address itself, e.g. /2026/09/17/ */
function dateInUrl(url: string): Date | null {
  const m = url.match(/\/(20\d\d)\/(\d{2})\/(\d{2})(?:\/|$)/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
  return isNaN(d.getTime()) ? null : d
}

/** Title, description, date, text and image from an article page */
export function parseArticlePage(html: string, pageUrl: string, fallbackDate: Date) {
  const rawTitle = meta(html, 'og:title') || decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim()
  // Drop a trailing " | Site name"
  const title = rawTitle.replace(/\s+\|\s+[^|]{2,40}$/, '').trim()

  const description = meta(html, 'og:description') || meta(html, 'description') || ''

  const main = html.match(/<(main|article)\b[\s\S]*?<\/\1>/i)?.[0] || html.match(/<body\b[\s\S]*<\/body>/i)?.[0] || ''
  const body = textOf(main)
  const content = `${description} ${body}`.trim().slice(0, 2000)

  // Publish date, most reliable first: structured data, the address, a date
  // written near the top of the page, then whatever the caller knows
  const dateStr =
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    meta(html, 'article:published_time') ||
    meta(html, 'date') ||
    html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1]
  const structured = dateStr ? new Date(dateStr) : null
  const now = new Date()
  const ok = (d: Date | null) => !!d && !isNaN(d.getTime()) && d <= new Date(now.getTime() + 864e5)
  const published =
    (ok(structured) && structured) ||
    dateInUrl(pageUrl) ||
    ([dateInText(body.slice(0, 4000))].find(ok) as Date | undefined) ||
    fallbackDate

  let image: string | null = null
  const og = meta(html, 'og:image') || meta(html, 'twitter:image')
  if (og) { try { image = cleanImageUrl(new URL(og, pageUrl).toString()) } catch {} }

  return { title, content, published_at: published.toISOString(), image_url: image }
}

/** Read one article page: title, date, opening text and image. Null if it can't be read. */
export async function readArticle(url: string): Promise<ScrapedItem | null> {
  const html = await fetchText(url, 10000, 600_000)
  if (!html) return null
  const page = parseArticlePage(html, url, new Date())
  return page?.title ? { ...page, url, content_type: 'article' } : null
}

function pattern(source: Source, field: 'pageInclude' | 'titleExclude'): RegExp | null {
  const raw = source[field]
  if (!raw) return null
  // {yyyy} means "this year or last year" (for sites with the year in the address)
  const year = new Date().getUTCFullYear()
  return new RegExp(raw.replace('{yyyy}', `(${year}|${year - 1})`), 'i')
}

/**
 * Some pages keep one address and are replaced on a schedule (a quarterly chart
 * book, say). Each edition is stored as its own story: the address gets an
 * edition tag after "#" so it is unique, and the title gets the edition's name.
 */
export function editionFor(source: Source, loc: string, date: Date): { tag: string; label: string; title?: string } | null {
  const rule = source.editions?.find(r => new RegExp(r.match, 'i').test(loc))
  if (!rule) return null
  const y = date.getUTCFullYear(), m = date.getUTCMonth()
  if (rule.every === 'quarter') { const q = Math.floor(m / 3) + 1; return { tag: `${y}-Q${q}`, label: `Q${q} ${y}`, title: rule.title } }
  const month = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  return { tag: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${month} ${y}`, title: rule.title }
}

/** Recent pages from a sitemap- or listing-based source, newest first */
export async function fetchPageSource(source: Source, cutoff: Date, knownUrls?: Set<string>): Promise<ScrapedItem[]> {
  // A 'page' source is one page that is replaced on a schedule, so there is no index to read
  const why: { reason?: string } = {}
  const index = source.kind === 'page' ? '' : await fetchText(source.feed_url, 15000, 12_000_000, why)
  if (source.kind !== 'page' && !index) throw new Error(`index not readable (${why.reason || 'empty'})`)
  const raw = index || ''

  const include = pattern(source, 'pageInclude')
  const titleExclude = pattern(source, 'titleExclude')
  const now = new Date()

  // Candidate pages: address, plus whatever the index already tells us
  let candidates: SitemapEntry[]
  if (source.kind === 'page') {
    candidates = [{ loc: source.feed_url, lastmod: null }]
  } else if (source.kind === 'listing') {
    candidates = parseListingLinks(raw, source.feed_url)
      .filter(u => !include || include.test(u))
      .map(loc => ({ loc, lastmod: null }))
  } else {
    candidates = parseSitemap(raw)
      // Recurring pages are always considered: their edition, not their date, decides whether they are new
      .filter(e => (!include || include.test(e.loc)) && ((e.lastmod && e.lastmod >= cutoff) || !!editionFor(source, e.loc, now)))
      .sort((a, b) => (b.lastmod?.getTime() || 0) - (a.lastmod?.getTime() || 0))
  }
  candidates = candidates
    .map(e => {
      // The edition is the current period; it is stored once, the first time it is seen
      const ed = editionFor(source, e.loc, now)
      if (!ed) return e
      const changedThisPeriod = !!e.lastmod && editionFor(source, e.loc, e.lastmod)?.tag === ed.tag
      return { ...e, readFrom: e.loc, loc: `${e.loc}#${ed.tag}`, edition: ed.label, editionTitle: ed.title, lastmod: changedThisPeriod ? e.lastmod : now }
    })
    .filter(e => !(e.title && titleExclude?.test(e.title)))
    // Pages already stored don't need reading again
    .filter(e => !knownUrls?.has(e.loc))
    .slice(0, source.lookbackDays ? 40 : 20)

  const pages = await Promise.all(candidates.map(async e => {
    const html = await fetchText(e.readFrom || e.loc, 8000, 600_000)
    // For a single-page source, an unreadable page is a failure worth reporting
    if (!html && source.kind === 'page') throw new Error(`Could not read ${e.readFrom || e.loc}`)
    // Listing pages carry no date, so a page first seen today counts as today's
    const page = html
      ? parseArticlePage(html, e.loc, e.lastmod || now)
      : e.title && e.lastmod ? { title: e.title, content: '', published_at: e.lastmod.toISOString(), image_url: null } : null
    if (!page) return null
    let title = page.title || e.title || ''
    if (!title || titleExclude?.test(title)) return null
    if (e.edition) {
      // A recurring page: dated from when it changed this period, or when first seen
      title = `${e.editionTitle || title}: ${e.edition}`
      page.published_at = (e.lastmod || now).toISOString()
    }
    // A page edited this week but first published long ago isn't news
    else if (new Date(page.published_at) < cutoff) return null
    if (source.keywords?.length) {
      const haystack = `${title} ${page.content}`.toLowerCase()
      if (!source.keywords.some(k => haystack.includes(k))) return null
    }
    const content_type: ScrapedItem['content_type'] =
      /\/podcasts?\//i.test(e.loc) ? 'podcast' : /\/videos?\//i.test(e.loc) ? 'video' : 'article'
    return { ...page, title, url: e.loc, content_type }
  }))

  const perDay: Record<string, number> = {}
  return (pages.filter(Boolean) as ScrapedItem[])
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .filter(p => {
      if (!source.maxPerDay) return true
      const day = p.published_at.slice(0, 10)
      perDay[day] = (perDay[day] || 0) + 1
      return perDay[day] <= source.maxPerDay
    })
}
