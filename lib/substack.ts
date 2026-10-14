import { UA } from './bot'
// Substack's RSS feed only carries the latest ~20 posts. For a longer back
// catalogue, the publication's archive listing goes back as far as needed.

import { cleanImageUrl } from './images'

export interface ArchivePost {
  title: string
  url: string
  published_at: string
  content: string
  image_url: string | null
  content_type: 'article' | 'podcast'
}

const PAGE = 25

export function isSubstackFeed(feedUrl: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.substack\.com\/feed\/?$/i.test(feedUrl)
}

export function parseArchivePage(json: unknown): ArchivePost[] {
  if (!Array.isArray(json)) return []
  const out: ArchivePost[] = []
  for (const p of json as any[]) {
    const url = p?.canonical_url
    const date = p?.post_date ? new Date(p.post_date) : null
    if (!p?.title || typeof url !== 'string' || !date || isNaN(date.getTime())) continue
    // Posts for paying subscribers can't be read by ours
    if (typeof p.audience === 'string' && p.audience !== 'everyone') continue
    out.push({
      title: String(p.title).trim(),
      url,
      published_at: date.toISOString(),
      content: [p.subtitle, p.description !== p.subtitle ? p.description : '', p.truncated_body_text]
        .filter(Boolean).join(' ').slice(0, 2000),
      image_url: cleanImageUrl(p.cover_image),
      content_type: p.type === 'podcast' ? 'podcast' : 'article',
    })
  }
  return out
}

/** Every post back to the cutoff date, newest first. Throws if the archive can't be read. */
export async function fetchSubstackArchive(feedUrl: string, cutoff: Date): Promise<ArchivePost[]> {
  const base = feedUrl.replace(/\/feed\/?$/, '')
  const all: ArchivePost[] = []
  for (let offset = 0; offset < PAGE * 12; offset += PAGE) {
    const res = await fetch(`${base}/api/v1/archive?sort=new&offset=${offset}&limit=${PAGE}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Substack archive ${res.status}`)
    const json = await res.json()
    const raw: any[] = Array.isArray(json) ? json : []
    all.push(...parseArchivePage(raw).filter(p => new Date(p.published_at) >= cutoff))
    // Judge "last page" on everything listed, including the subscriber-only posts that were left out
    if (raw.length < PAGE || raw.some(p => p?.post_date && new Date(p.post_date) < cutoff)) break
  }
  return all
}
