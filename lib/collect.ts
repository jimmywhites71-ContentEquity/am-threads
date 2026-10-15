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
/** Sitemap addresses for a site: from robots.txt, else the two usual places */
export async function sitemapsOf(home: string): Promise<string[]> {
  const origin = new URL(home).origin
  try {
    const robots = await getText(`${origin}/robots.txt`, 10000, 200_000)
    const named = Array.from(robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map(m => m[1].trim())
    if (named.length) return Array.from(new Set(named))
  } catch {}
  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    try { const xml = await getText(origin + path, 10000, 200_000); if (/<(urlset|sitemapindex)\b/i.test(xml)) return [origin + path] } catch {}
  }
  return []
}

/**
 * Read sitemaps, following sitemap indexes two levels down. Child sitemaps changed before `since`
 * are skipped, as are children whose own address marks them as products, funds or people.
 */
async function readSitemapTree(roots: string[], since: Date, exclude: RegExp | null, maxChildren: number): Promise<string[]> {
  const out: string[] = []
  let budget = maxChildren
  const visit = async (url: string, depth: number) => {
    if (budget-- <= 0) return
    let xml: string
    try { xml = await getText(url) } catch { return }
    const kids = parseSitemapIndex(xml)
    if (!kids.length) { out.push(xml); return }
    if (depth >= 2) return
    const wanted = kids
      .filter(c => !c.lastmod || c.lastmod >= since)
      .filter(c => !(exclude && exclude.test(c.loc)) && !/(product|fund|people|author|tag|image|video-sitemap|careers?)/i.test(c.loc.split('/').pop() || ''))
      .sort((a, b) => (b.lastmod?.getTime() || 0) - (a.lastmod?.getTime() || 0))
    for (const c of wanted) { if (budget <= 0) break; await visit(c.loc, depth + 1) }
  }
  for (const r of roots) await visit(r, 0)
  return out
}

export async function discover(source: ManagerSource, since: Date, opts: { maxChildSitemaps?: number; maxPages?: number } = {}): Promise<Discovered[]> {
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

  // Sitemaps: named by the source, or found through the site's robots.txt
  const roots = source.kind === 'robots' ? await sitemapsOf(source.feed_url) : [source.feed_url]
  if (!roots.length) throw new Error('no sitemap found (robots.txt names none; /sitemap.xml and /sitemap_index.xml missing)')
  const xmls = await readSitemapTree(roots, since, exclude, opts.maxChildSitemaps || 40)
  if (!xmls.length) throw new Error(`sitemap not readable (${roots[0]})`)

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
  // A whole-site sitemap can list thousands of undated pages; keep the dated, newest first, then a
  // bounded number of undated ones (their own dates are checked when read)
  out.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''))
  return out.slice(0, opts.maxPages || 3000)
}
