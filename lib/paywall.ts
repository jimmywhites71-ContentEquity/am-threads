// Spotting stories a reader can't open without paying, so they are never
// collected. Two signals are used:
//   1. Substack marks every post with its audience ("everyone" or "only_paid").
//   2. Many publishers declare a paywall in the page's structured data
//      (schema.org "isAccessibleForFree": false), which is how search engines
//      are told the same thing.
// Anything that can't be checked is kept: a missed paywall is better than
// dropping a free story.

import { UA } from './bot'

/**
 * True when a headline is written mostly in a non-Latin script (Chinese, Japanese,
 * Arabic, Cyrillic...). News indexes return a publisher's translated editions too.
 */
export function isForeignScript(title: string): boolean {
  const letters = title.match(/\p{L}/gu)?.length || 0
  const latin = title.match(/\p{Script=Latin}/gu)?.length || 0
  return letters > 0 && latin / letters < 0.7
}

/** True when the page's structured data says the article is not free to read */
export function paywallInHtml(html: string): boolean {
  return /["']isAccessibleForFree["']\s*:\s*["']?false\b/i.test(html)
}

/**
 * A news index also lists a site's index pages ("All Authors", "Agenda Contributors").
 * A real headline is in the publisher's own language and runs to at least four words.
 */
export function isRealHeadline(title: string): boolean {
  return !isForeignScript(title) && title.trim().split(/\s+/).length >= 4
}

/** Sections where paywalls turn up; institutions, podcasts and papers aren't checked */
const CHECKED_SECTIONS = new Set(['Sustainability & Climate', 'Independents', 'Loose Threads', 'Data Vis'])

export function shouldCheckPaywall(item: { category: string; content_type: string }): boolean {
  return item.content_type === 'article' && CHECKED_SECTIONS.has(item.category)
}

/** A feed served by Substack, on its own domain or a custom one */
export function isSubstack(feedUrl: string, generator?: string | null): boolean {
  return /substack/i.test(generator || '') || /^https:\/\/[a-z0-9-]+\.substack\.com\//i.test(feedUrl)
}

const postPath = (url: string) => { try { return new URL(url).pathname.replace(/\/+$/, '') } catch { return url } }

/** Audience of each recent post, keyed by its path ("/p/some-post") */
export function parseAudiences(json: unknown): Map<string, string> {
  const out = new Map<string, string>()
  if (!Array.isArray(json)) return out
  for (const p of json as any[]) {
    if (typeof p?.canonical_url === 'string' && typeof p?.audience === 'string') out.set(postPath(p.canonical_url), p.audience)
  }
  return out
}

/** Recent posts' audiences from a Substack publication. Empty if it can't be read. */
export async function substackAudiences(feedUrl: string, timeoutMs = 6000): Promise<Map<string, string>> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${new URL(feedUrl).origin}/api/v1/archive?sort=new&offset=0&limit=25`, {
      signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    clearTimeout(t)
    return res.ok ? parseAudiences(await res.json()) : new Map()
  } catch {
    return new Map()
  }
}

/** True only when Substack says this post is not open to everyone */
export function isPaidPost(audiences: Map<string, string>, url: string): boolean {
  const audience = audiences.get(postPath(url))
  return !!audience && audience !== 'everyone'
}
