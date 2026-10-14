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

/** Pages from one source published (or changed) since `since`, newest first */
export async function discover(source: ManagerSource, since: Date, opts: { maxChildSitemaps?: number } = {}): Promise<Discovered[]> {
  const include = regex(source.pageInclude)
  const exclude = regex(source.pageExclude)
  const keep = (url: string) => (!include || include.test(url)) && !(exclude && exclude.test(url))
  const base = { source_id: source.id, manager: source.manager }

  if (source.kind === 'rss' || !source.kind) {
    const feed = await new Parser().parseString(await getText(source.feed_url))
    return feed.items
      .filter(it => it.link && keep(it.link))
      .map(it => ({ ...base, url: it.link!, title: it.title, lastmod: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : null) }))
      .filter(d => !d.lastmod || new Date(d.lastmod) >= since)
  }

  if (source.kind === 'listing') {
    const html = await getText(source.feed_url)
    return parseListingLinks(html, source.feed_url).filter(keep).map(url => ({ ...base, url, lastmod: null }))
  }

  if (source.kind === 'page') return [{ ...base, url: source.feed_url, lastmod: null }]

  // Sitemap, or sitemap index
  const top = await getText(source.feed_url)
  const children = parseSitemapIndex(top)
  const xmls: string[] = []
  if (children.length) {
    // Children changed since the cutoff (or undated), most recent first. Children whose own address
    // shows they are for another kind of page (products, people) are skipped when a pattern says so.
    const wanted = children
      .filter(c => !c.lastmod || c.lastmod >= since)
      .filter(c => !(exclude && exclude.test(c.loc)))
      .sort((a, b) => (b.lastmod?.getTime() || 0) - (a.lastmod?.getTime() || 0))
      .slice(0, opts.maxChildSitemaps || 25)
    for (const c of wanted) {
      try { xmls.push(await getText(c.loc)) } catch { /* one bad child should not lose the rest */ }
    }
  } else xmls.push(top)

  const seen = new Set<string>()
  const out: Discovered[] = []
  for (const xml of xmls) {
    for (const e of parseSitemap(xml)) {
      if (seen.has(e.loc) || !keep(e.loc)) continue
      // An undated entry is kept: the page's own date decides later whether it is in the window
      if (e.lastmod && e.lastmod < since) continue
      seen.add(e.loc)
      out.push({ ...base, url: e.loc, lastmod: e.lastmod?.toISOString() || null, ...(e.title ? { title: e.title } : {}) })
    }
  }
  return out.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''))
}
