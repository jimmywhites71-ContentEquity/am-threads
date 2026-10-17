// Discovery: list the content pages each source has published, without reading them yet.
// Reading is a separate, paged step (lib/extract.ts via /api/process), so a backfill of thousands
// of pages never has to fit inside one 300-second run.
//
// Managers' sitemaps are often sitemap indexes (a list of further sitemaps), so those are followed,
// keeping only child sitemaps that could hold matching pages.

import Parser from 'rss-parser'
import { UA } from './bot'
import { parseListingLinks, parseSitemap } from './sitemap'
import type { ManagerSource } from './sources'
import { slugOf } from './dedupe'

export interface Discovered {
  source_id: string
  manager: string
  url: string
  /** From the index, when it gives one; the page's own date is read later */
  lastmod: string | null
  /** A title the index already gives (news sitemaps, feeds) */
  title?: string
}

async function getText(url: string, timeoutMs = 20000, maxChars = 15_000_000): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml;q=0.9,text/html;q=0.8,*/*;q=0.5' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    // Some sitemaps are gzipped files served as such; fetch only decompresses Content-Encoding
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const { gunzipSync } = await import('zlib')
      return gunzipSync(buf).toString('utf8').slice(0, maxChars)
    }
    return buf.toString('utf8').slice(0, maxChars)
  } catch (err: any) {
    throw new Error(err?.name === 'AbortError' ? 'timed out' : String(err?.message || err).slice(0, 120))
  } finally { clearTimeout(t) }
}

/** Child sitemap addresses in a sitemap index */
export function parseSitemapIndex(xml: string): { loc: string; lastmod: Date | null }[] {
  if (!/<sitemapindex\b/i.test(xml)) return []
  return (xml.match(/<sitemap\b[\s\S]*?<\/sitemap>/gi) || []).map(block => {
    const loc = block.match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1]?.replace(/&amp;/g, '&') || ''
    const when = block.match(/<lastmod>\s*([^<\s]+)/i)?.[1]
    const d = when ? new Date(when) : null
    return { loc, lastmod: d && !isNaN(d.getTime()) ? d : null }
  }).filter(e => e.loc)
}

function regex(raw: string | undefined): RegExp | null {
  if (!raw) return null
  const year = new Date().getUTCFullYear()
  return new RegExp(raw.replace('{yyyy}', `(${year}|${year - 1})`), 'i')
}

/** What discovery saw, for the source check: why a source found nothing is usually visible here */
export interface Diagnostics {
  roots: string[]
  /** How the sitemap addresses were found, or why they were not */
  robots?: string
  /** Sitemaps (or child sitemaps) that could not be read, with the reason */
  unreadable: string[]
  entries: number
  in_window: number
  undated: number
  /** In the date window but not matching the house's address pattern: shows what pattern to use */
  unmatched_sample: string[]
  /** Distinct pieces once regional and language editions are collapsed */
  unique_pieces?: number
}

// Language editions we leave out: the product reads English. A locale segment such as /de/, /fr-fr/,
// /it_it/ or /global/de/ marks a non-English page; en-xx (English for a market) is kept.
const NON_ENGLISH = /\/(de|fr|es|it|nl|ja|jp|zh|ko|pt|sv|da|fi|no|nb|pl|cs|hu|el|tr|ar|he)([-_][a-z]{2,4})?(\/|$)/i

/** An index or hub page rather than a piece: its last segment is a generic word with no slug */
const GENERIC_LAST = /^(insights?|thinking|research|articles?|perspectives?|collections?|[a-z]+-collections|publications?|podcasts?|videos?|webinars?|news|news-and-insights|commentary|outlooks?|index|overview|library|topics?|all|latest|blog|strategy|views?|ideas)$/i
export function isIndexPage(url: string): boolean {
  let last = ''
  try { last = new URL(url).pathname.split('/').filter(Boolean).pop() || '' } catch { return false }
  last = decodeURIComponent(last).replace(/\.(html?|aspx|php)$/i, '')
  if (!last) return true
  if (GENERIC_LAST.test(last)) return true
  // A real piece has a slug (words joined by hyphens or underscores) or a numeric id
  return !/[-_]/.test(last) && !/\d{4,}/.test(last)
}

/** Sitemap addresses for a site: from robots.txt, else the two usual places */
export async function sitemapsOf(home: string, diag?: Diagnostics): Promise<string[]> {
  const origin = new URL(home).origin
  try {
    const robots = await getText(`${origin}/robots.txt`, 10000, 200_000)
    const named = Array.from(robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map(m => { try { return new URL(m[1].trim(), origin).toString() } catch { return '' } }).filter(Boolean)
    if (named.length) { if (diag) diag.robots = `robots.txt names ${named.length}`; return Array.from(new Set(named)) }
    if (diag) diag.robots = 'robots.txt names no sitemap'
  } catch (err: any) {
    if (diag) diag.robots = `robots.txt not readable (${String(err?.message || err).slice(0, 60)})`
  }
  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    try {
      const xml = await getText(origin + path, 10000, 200_000)
      if (/<(urlset|sitemapindex)\b/i.test(xml)) return [origin + path]
      if (diag) diag.unreadable.push(`${path}: not a sitemap`)
    } catch (err: any) { if (diag) diag.unreadable.push(`${path}: ${String(err?.message || err).slice(0, 60)}`) }
  }
  return []
}

/**
 * Read sitemaps, following sitemap indexes two levels down. Child sitemaps changed before `since`
 * are skipped, as are children whose own address marks them as products, funds or people.
 */
async function readSitemapTree(roots: string[], since: Date | null, exclude: RegExp | null, maxChildren: number, diag?: Diagnostics): Promise<string[]> {
  const out: string[] = []
  let budget = maxChildren
  const visit = async (url: string, depth: number) => {
    if (budget-- <= 0) return
    let xml: string
    try { xml = await getText(url) } catch (err: any) { diag?.unreadable.push(`${url}: ${String(err?.message || err).slice(0, 60)}`); return }
    let kids = parseSitemapIndex(xml).map(k => { try { return { ...k, loc: new URL(k.loc, url).toString() } } catch { return null } }).filter(Boolean) as { loc: string; lastmod: Date | null }[]
    // Some sites list their sitemaps in an ordinary <urlset> rather than a sitemap index
    if (!kids.length && /<urlset\b/i.test(xml)) {
      const entries = parseSitemap(xml)
      if (entries.length && entries.every(e => /\.xml(\.gz)?(\?|$)/i.test(e.loc))) kids = entries.map(e => ({ loc: e.loc, lastmod: e.lastmod }))
    }
    // Some sitemap indexes list pages rather than sitemaps (Amundi): read them as pages
    if (kids.length && !kids.some(k => /\.xml(\.gz)?(\?|$)/i.test(k.loc))) {
      out.push('<urlset>' + kids.map(k => `<url><loc>${k.loc.replace(/&/g, '&amp;')}</loc>${k.lastmod ? `<lastmod>${k.lastmod.toISOString()}</lastmod>` : ''}</url>`).join('') + '</urlset>')
      return
    }
    if (!kids.length) {
      if (!/<urlset\b/i.test(xml)) { diag?.unreadable.push(`${url}: not a sitemap (${xml.slice(0, 40).replace(/\s+/g, ' ')})`); return }
      out.push(xml); return
    }
    if (depth >= 2) return
    const wanted = kids
      .filter(c => !since || !c.lastmod || c.lastmod >= since)
      .filter(c => !(exclude && exclude.test(c.loc)) && !/(product|fund|people|author|tag|image|video-sitemap|careers?)/i.test(c.loc.split('/').pop() || ''))
      .filter(c => { try { return !NON_ENGLISH.test(new URL(c.loc).pathname) } catch { return false } })
      .sort((a, b) => (b.lastmod?.getTime() || 0) - (a.lastmod?.getTime() || 0))
    for (const c of wanted) { if (budget <= 0) break; await visit(c.loc, depth + 1) }
  }
  for (const r of roots) await visit(r, 0)
  return out
}

/** Pages from one source published (or changed) since `since`, newest first */
export async function discover(source: ManagerSource, since: Date, opts: { maxChildSitemaps?: number; maxPages?: number; maxUndated?: number; diag?: Diagnostics } = {}): Promise<Discovered[]> {
  const include = regex(source.pageInclude)
  const exclude = regex(source.pageExclude)
  const keep = (url: string) => {
    if (include && !include.test(url)) return false
    if (exclude && exclude.test(url)) return false
    let path = url
    try { path = new URL(url).pathname } catch {}
    return !NON_ENGLISH.test(path) && !isIndexPage(url)
  }
  const base = { source_id: source.id, manager: source.manager }
  const diag = opts.diag

  if (source.kind === 'rss' || !source.kind) {
    const days = Math.max(1, Math.ceil((Date.now() - since.getTime()) / 864e5))
    const feed = await new Parser().parseString(await getText(source.feed_url.replace('{days}', String(days))))
    const items = feed.items
      .filter(it => it.link && (source.headlineOnly || keep(it.link)))
      .map(it => ({
        ...base, url: it.link!,
        // A news index adds " - Publisher" to every headline
        title: source.headlineOnly ? String(it.title || '').replace(/\s+[-–|]\s+[^-–|]{2,60}$/, '').trim() : it.title,
        lastmod: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : null),
      }))
      .filter(d => !d.lastmod || new Date(d.lastmod) >= since)
    if (diag) { diag.entries = feed.items.length; diag.in_window = items.length; diag.unique_pieces = new Set(items.map(i => (i.title || '').toLowerCase())).size }
    return items
  }

  if (source.kind === 'listing') {
    const html = await getText(source.feed_url)
    return parseListingLinks(html, source.feed_url).filter(keep).map(url => ({ ...base, url, lastmod: null }))
  }

  if (source.kind === 'page') return [{ ...base, url: source.feed_url, lastmod: null }]

  // Sitemaps: named by the source, or found through the site's robots.txt
  const roots = source.kind === 'robots' ? await sitemapsOf(source.feed_url, diag) : [source.feed_url]
  if (diag) diag.roots = roots
  if (!roots.length) throw new Error(`no sitemap found: ${diag?.robots || ''}; ${diag?.unreadable.join('; ') || ''}`.slice(0, 300))
  const xmls = await readSitemapTree(roots, source.ignoreLastmod ? null : since, exclude, opts.maxChildSitemaps || 40, diag)
  if (!xmls.length) throw new Error(`sitemap not readable: ${(diag?.unreadable || []).slice(0, 2).join('; ') || roots[0]}`.slice(0, 300))

  const seen = new Set<string>()
  const dated: Discovered[] = [], undated: Discovered[] = []
  for (const xml of xmls) {
    for (const e of parseSitemap(xml)) {
      // A sitemap that names a placeholder host ("http://default/article/…") means the house's own site
      try { const u = new URL(e.loc); if (!u.hostname.includes('.')) e.loc = new URL(u.pathname + u.search, new URL(source.feed_url).origin).toString() } catch {}
      if (source.ignoreLastmod) e.lastmod = null
      if (diag) diag.entries++
      if (e.lastmod && e.lastmod < since) continue
      if (diag) { diag.in_window++; if (!e.lastmod) diag.undated++ }
      if (seen.has(e.loc)) continue
      if (!keep(e.loc)) {
        if (diag && diag.unmatched_sample.length < 6 && !NON_ENGLISH.test(e.loc)) diag.unmatched_sample.push(e.loc)
        continue
      }
      seen.add(e.loc)
      const d = { ...base, url: e.loc, lastmod: e.lastmod?.toISOString() || null, ...(e.title ? { title: e.title } : {}) }
      ;(e.lastmod ? dated : undated).push(d)
    }
  }
  // Dated pages, newest first, then a bounded number of undated ones (their own dates are checked
  // when read, and the next run picks up more)
  dated.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''))
  const out = [...dated, ...undated.slice(0, opts.maxUndated ?? 300)].slice(0, opts.maxPages || 3000)
  if (diag) diag.unique_pieces = new Set(out.map(d => slugOf(d.url))).size
  return out
}
