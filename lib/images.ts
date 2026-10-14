import { UA } from './bot'
// Finding a preview image for each story: first from the feed itself,
// then (for new stories only) from the article page's social-sharing tags.

import { paywallInHtml } from './paywall'

type FeedItem = Record<string, any>

export function cleanImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const u = url.trim().replace(/&amp;/g, '&')
  if (!/^https?:\/\//i.test(u)) return null
  // Skip tracking pixels, icons and feed-burner badges
  if (/(feedburner|pixel|spacer|gravatar|emoji|\/icons?\/|touch-icon|favicon|\.ico(\?|$)|1x1|blank\.gif)/i.test(u)) return null
  return u.replace(/^http:\/\//i, 'https://')
}

function firstAttr(node: any, attr = 'url'): unknown {
  if (!node) return null
  const n = Array.isArray(node) ? node[0] : node
  return n?.$?.[attr] ?? n?.[attr] ?? (typeof n === 'string' ? n : null)
}

/** Image from the feed entry: enclosure, media tags, iTunes artwork, or the first <img> in the body */
export function imageFromFeedItem(item: FeedItem, feedImage?: string | null): string | null {
  const enc = item.enclosure
  if (enc?.url && (!enc.type || /^image\//i.test(enc.type))) {
    const u = cleanImageUrl(enc.url); if (u) return u
  }
  for (const key of ['media:content', 'media:thumbnail', 'media:group']) {
    const node = item[key]
    const direct = cleanImageUrl(firstAttr(node))
    if (direct && !/\.(mp3|m4a|mp4|mov)(\?|$)/i.test(direct)) return direct
    const nested = cleanImageUrl(firstAttr(node?.['media:content'] ?? node?.['media:thumbnail']))
    if (nested) return nested
  }
  const itunes = cleanImageUrl(firstAttr(item['itunes:image'], 'href') ?? item.itunes?.image)
  if (itunes) return itunes

  const html: string = item['content:encoded'] || item.content || item.summary || ''
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  const inBody = cleanImageUrl(m?.[1])
  if (inBody) return inBody

  // Podcasts and some newsletters only have show-level artwork
  return cleanImageUrl(feedImage)
}

/**
 * One read of the article page: its social-sharing image and whether it declares a paywall.
 * Short timeout; a page that can't be read just gives no image and no paywall signal.
 */
export async function pageSignals(url: string, opts: { checkPaywall?: boolean; timeoutMs?: number } = {}): Promise<{ image: string | null; paywalled: boolean }> {
  const none = { image: null, paywalled: false }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA },
    })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) { clearTimeout(t); return none }
    // The image is in the <head>. The paywall declaration can sit anywhere, so read further for that.
    const limit = opts.checkPaywall ? 400_000 : 150_000
    const reader = res.body?.getReader()
    let html = ''
    if (reader) {
      const dec = new TextDecoder()
      while (html.length < limit) {
        const { done, value } = await reader.read()
        if (done) break
        html += dec.decode(value, { stream: true })
        if (opts.checkPaywall ? paywallInHtml(html) : html.includes('</head>')) break
      }
      reader.cancel().catch(() => {})
    }
    clearTimeout(t)
    const meta = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1]
    const found = meta('og:image') || meta('og:image:url') || meta('twitter:image') || meta('twitter:image:src')
    let image: string | null = null
    try { image = found ? cleanImageUrl(new URL(found.replace(/&amp;/g, '&'), res.url || url).toString()) : null } catch {}
    return { image, paywalled: !!opts.checkPaywall && paywallInHtml(html) }
  } catch {
    return none
  }
}

/** og:image / twitter:image from the article page */
export async function imageFromPage(url: string, timeoutMs = 4000): Promise<string | null> {
  return (await pageSignals(url, { timeoutMs })).image
}
