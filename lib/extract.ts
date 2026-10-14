// Reading one content page: identity (title, date, author, canonical address, lead image), the
// full body text with disclaimers separated out, and the structural and visual measures from the
// build plan (Part 3). Everything here is deterministic; the model is used later only for
// classification and the "substance" fields.

import { parse, type HTMLElement } from 'node-html-parser'
import { UA } from './bot'
import { cleanImageUrl } from './images'
import { readability, type Readability } from './readability'
import type { Format } from './taxonomy'

export interface Structure {
  headings: number
  bullets: number
  key_takeaways: boolean
  named_author: boolean
  call_to_action: boolean
  tables: number
}

export interface Visual {
  lead_image: boolean
  images: number
  charts: number
  images_per_1000_words: number | null
  chart_hosts: string[]
  interactive: boolean
  video_embed: boolean
  audio_embed: boolean
}

export interface Extracted {
  url: string
  canonical_url: string | null
  title: string
  description: string
  published_at: string | null
  authors: string[]
  image_url: string | null
  /** Body text without disclaimers: what readability is measured on */
  text: string
  disclaimer_text: string
  disclaimer_share: number
  pdf_links: string[]
  /** PDFs only */
  pages: number | null
  format: Format
  structure: Structure
  visual: Visual
  readability: Readability
  gated: boolean
}

// Containers that never hold the piece itself
const CHROME = 'script,style,noscript,template,nav,header,footer,aside,form,iframe[src*="googletagmanager"],[aria-hidden="true"],[role="navigation"],[role="banner"],[role="contentinfo"],[class*="cookie"],[id*="cookie"],[class*="consent"],[id*="consent"],[class*="onetrust"],[id*="onetrust"],[class*="newsletter"],[class*="related"],[class*="share"],[class*="breadcrumb"],[class*="social"]'
const DISCLAIMER_BOX = /(disclaimer|disclosure|important-?info|legal|risk-?warning|footnote|compliance)/i
const DISCLAIMER_HEADING = /^(important (information|disclosures?|notice)|disclaimers?|disclosures?|risk warnings?|important risk information|legal information|for professional (clients|investors) only)\b/i
const DISCLAIMER_TEXT = /^(past performance (is not|does not)|this (material|document|communication|information) (is|has been|should|does not)|the value of investments?( and the income)?( from them)? (may|can)|for (professional|institutional|qualified) (investors?|clients?) only|not for (retail|public) (distribution|use)|issued by\b|capital at risk|investing involves risk|all investments involve risk|opinions expressed|the views expressed|no part of this|copyright ©|© ?\d{4})/i
const TAKEAWAYS = /^(key (takeaways?|points?|insights?|highlights?|messages?|themes?)|in brief|at a glance|summary|executive summary|tl;?dr|our view in brief|what you need to know)\b/i
const CTA = /\b(subscribe|sign up|contact (us|your)|get in touch|speak to|talk to (us|your)|download (the|our|full)|register (now|here|for)|request (a|more)|book a)\b/i
const CHART_WORDS = /\b(chart|exhibit|figure|fig\.|graph|source:)\b/i
const CHART_HOSTS = /(datawrapper|flourish|highcharts|tableau|infogram|plotly|amcharts|chartblocks|everviz)/i
const VIDEO_HOSTS = /(youtube\.com|youtu\.be|vimeo\.com|brightcove|vidyard|wistia|jwplayer|kaltura|players\.brightcove)/i
const AUDIO_HOSTS = /(spotify\.com|podcasts\.apple|soundcloud|buzzsprout|libsyn|megaphone|omny|simplecast|captivate|anchor\.fm)/i
const GATE = /(professional investor|financial professional|confirm (that )?you are|select your (investor|role)|i am an? (institutional|professional|individual)|accept and continue)/i

function abs(href: string | undefined | null, base: string): string | null {
  if (!href) return null
  try { return new URL(href, base).toString() } catch { return null }
}

function metaContent(root: HTMLElement, names: string[]): string | null {
  for (const n of names) {
    const el = root.querySelector(`meta[property="${n}"]`) || root.querySelector(`meta[name="${n}"]`)
    const v = el?.getAttribute('content')?.trim()
    if (v) return v
  }
  return null
}

/** JSON-LD objects on the page (Article, NewsArticle, BlogPosting…), flattened */
function jsonLd(root: HTMLElement): any[] {
  const out: any[] = []
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const walk = (v: any) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { out.push(v); if (v['@graph']) walk(v['@graph']) } }
      walk(JSON.parse(s.textContent))
    } catch {}
  }
  return out
}

/** The element holding the piece: <article>, <main>, role=main, else the largest text block */
function mainOf(root: HTMLElement): HTMLElement {
  const candidates = [...root.querySelectorAll('article'), ...root.querySelectorAll('main'), ...root.querySelectorAll('[role="main"]')]
  const best = candidates.sort((a, b) => b.textContent.length - a.textContent.length)[0]
  return best || root.querySelector('body') || root
}

function blocksOf(el: HTMLElement): { text: string; disclaimerBox: boolean; heading: boolean }[] {
  const out: { text: string; disclaimerBox: boolean; heading: boolean }[] = []
  for (const b of el.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,dd,dt,pre')) {
    // Skip a block nested in another block we already take (li inside li, p inside blockquote)
    if (b.parentNode && (b.parentNode as HTMLElement).closest?.('p,li,blockquote,figcaption,td,dd,dt,pre')) continue
    const text = b.textContent.replace(/\s+/g, ' ').trim()
    if (!text) continue
    let box = false
    for (let p: HTMLElement | null = b; p && p !== el; p = p.parentNode as HTMLElement | null) {
      const cls = `${p.getAttribute?.('class') || ''} ${p.getAttribute?.('id') || ''}`
      if (DISCLAIMER_BOX.test(cls)) { box = true; break }
    }
    out.push({ text, disclaimerBox: box, heading: /^h[1-6]$/i.test(b.tagName) })
  }
  return out
}

/** Format from address, embeds and length; the model is asked only when this is unsure */
export function inferFormat(url: string, title: string, words: number, v: Pick<Visual, 'video_embed' | 'audio_embed'>, isPdf: boolean): Format {
  const u = url.toLowerCase(), t = title.toLowerCase()
  if (/\/podcasts?\//.test(u) || /\bpodcast\b|\bepisode\b/.test(t) || (v.audio_embed && words < 1200)) return 'podcast'
  if (/\/webinars?\/|\/events?\//.test(u) || /\bwebinar\b|\bwebcast\b/.test(t)) return 'webinar'
  if (/\/videos?\//.test(u) || (v.video_embed && words < 400)) return 'video'
  if (/outlook/.test(u) || /\boutlook\b|\bmid-year\b|\byear ahead\b/.test(t)) return 'outlook'
  if (/chart-of-the-|\/charts?\//.test(u) && words < 400) return 'chart'
  if (isPdf || /\/(research|whitepapers?|white-papers?|papers?)\//.test(u) || words >= 3000) return 'research paper'
  return 'article'
}

export function extractFromHtml(html: string, url: string): Extracted {
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true, noscript: true, pre: true } })
  const ld = jsonLd(root)
  const article = ld.find(o => /Article|BlogPosting|Report|ScholarlyArticle|WebPage/i.test(String(o['@type'])) && (o.headline || o.datePublished)) || {}

  const rawTitle = metaContent(root, ['og:title', 'twitter:title']) || article.headline || root.querySelector('h1')?.textContent || root.querySelector('title')?.textContent || ''
  const title = rawTitle.replace(/\s+/g, ' ').replace(/\s+[|–-]\s+[^|–-]{2,50}$/, '').trim()
  const description = metaContent(root, ['og:description', 'description', 'twitter:description']) || ''
  const canonical = abs(root.querySelector('link[rel="canonical"]')?.getAttribute('href'), url)

  const dateStr = article.datePublished || metaContent(root, ['article:published_time', 'date', 'dc.date', 'publish-date', 'publication_date'])
    || root.querySelector('time[datetime]')?.getAttribute('datetime')
  const d = dateStr ? new Date(dateStr) : null
  const published_at = d && !isNaN(d.getTime()) && d.getTime() <= Date.now() + 864e5 ? d.toISOString() : null

  const ldAuthors = ([] as any[]).concat(article.author || []).map(a => typeof a === 'string' ? a : a?.name).filter(Boolean)
  const metaAuthor = metaContent(root, ['author', 'article:author'])
  const authors = Array.from(new Set([...ldAuthors, ...(metaAuthor && !/^https?:/.test(metaAuthor) ? [metaAuthor] : [])].map(a => String(a).trim()).filter(a => a && a.length < 80)))

  const image_url = cleanImageUrl(abs(metaContent(root, ['og:image', 'twitter:image']), url))
  const gated = GATE.test(root.querySelector('body')?.textContent.slice(0, 4000) || '') && root.textContent.length < 20000

  // Work on the main container with page furniture removed
  const main = mainOf(root)
  for (const el of main.querySelectorAll(CHROME)) el.remove()

  // Split body from disclaimers: a disclaimer box, a disclaimer heading (and everything after it),
  // or a paragraph in standard disclaimer wording
  const blocks = blocksOf(main)
  let afterDisclaimerHeading = false
  const body: string[] = [], legal: string[] = []
  for (const b of blocks) {
    if (b.heading && DISCLAIMER_HEADING.test(b.text)) afterDisclaimerHeading = true
    const isLegal = afterDisclaimerHeading || b.disclaimerBox || DISCLAIMER_TEXT.test(b.text)
    ;(isLegal ? legal : body).push(b.text)
  }
  // Page text is sometimes not in block elements at all: fall back to the container's text
  let text = body.join('\n\n')
  if (text.length < 200 && main.textContent.trim().length > text.length * 2) text = main.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()
  const disclaimer_text = legal.join('\n\n')
  const disclaimer_share = Math.round((disclaimer_text.length / Math.max(1, disclaimer_text.length + text.length)) * 1000) / 1000

  const r = readability(text)

  // Structure
  const headings = main.querySelectorAll('h2,h3,h4').filter(h => !DISCLAIMER_HEADING.test(h.textContent.trim())).length
  const bullets = main.querySelectorAll('li').filter(li => !li.closest('nav') && li.textContent.trim().length > 15).length
  const key_takeaways = blocks.some(b => b.heading && TAKEAWAYS.test(b.text))
    || main.querySelectorAll('[class*="takeaway"],[class*="key-points"],[class*="keypoints"],[class*="summary"],[class*="highlights"]').length > 0
  const named_author = authors.length > 0 || main.querySelectorAll('[rel="author"],[class*="author"],[class*="byline"]').some(e => e.textContent.trim().length > 2)
  const call_to_action = main.querySelectorAll('a,button').some(a => CTA.test(a.textContent))
  const tables = main.querySelectorAll('table').length

  // Visuals
  const imgs = main.querySelectorAll('img').filter(img => {
    const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
    const w = Number(img.getAttribute('width') || 0)
    return src && !/(logo|icon|avatar|sprite|spacer|pixel|badge|\.svg$)/i.test(src) && !(w && w < 100)
  })
  const iframes = main.querySelectorAll('iframe').map(f => f.getAttribute('src') || f.getAttribute('data-src') || '')
  const chartHosts = Array.from(new Set(iframes.map(s => s.match(CHART_HOSTS)?.[1]?.toLowerCase()).filter(Boolean) as string[]))
  const chartImgs = imgs.filter(img => {
    const fig = img.closest('figure')
    const hint = `${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''} ${fig?.querySelector('figcaption')?.textContent || ''}`
    return CHART_WORDS.test(hint)
  }).length
  const inlineCharts = main.querySelectorAll('[class*="highcharts"],[class*="chart-container"],[data-chart],canvas').length
    + main.querySelectorAll('svg').filter(s => s.querySelectorAll('path,rect,line').length >= 12).length
  const charts = chartImgs + chartHosts.length + inlineCharts + tables
  const video_embed = iframes.some(s => VIDEO_HOSTS.test(s)) || main.querySelectorAll('video').length > 0
  const audio_embed = iframes.some(s => AUDIO_HOSTS.test(s)) || main.querySelectorAll('audio').length > 0

  const pdf_links = Array.from(new Set(main.querySelectorAll('a[href]').map(a => abs(a.getAttribute('href'), url)).filter((h): h is string => !!h && /\.pdf(\?|#|$)/i.test(h)))).slice(0, 10)

  const visual: Visual = {
    lead_image: !!image_url,
    images: imgs.length,
    charts,
    images_per_1000_words: r.word_count >= 50 ? Math.round((imgs.length / r.word_count) * 10000) / 10 : null,
    chart_hosts: chartHosts,
    interactive: chartHosts.length > 0 || inlineCharts > 0,
    video_embed,
    audio_embed,
  }

  return {
    url, canonical_url: canonical, title, description, published_at, authors, image_url,
    text, disclaimer_text, disclaimer_share, pdf_links, pages: null,
    format: inferFormat(url, title, r.word_count, visual, false),
    structure: { headings, bullets, key_takeaways, named_author, call_to_action, tables },
    visual, readability: r, gated,
  }
}

/** Text of a PDF (research papers, outlooks). Structure and visuals are not measured for PDFs yet. */
export async function extractPdf(bytes: Uint8Array, url: string, fallbackTitle = ''): Promise<Extracted> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(bytes)
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const full = String(text).replace(/[ \t]+/g, ' ').trim()
  const r = readability(full)
  const visual: Visual = { lead_image: false, images: 0, charts: 0, images_per_1000_words: null, chart_hosts: [], interactive: false, video_embed: false, audio_embed: false }
  return {
    url, canonical_url: null, title: fallbackTitle || url.split('/').pop() || url, description: '', published_at: null, authors: [], image_url: null,
    text: full, disclaimer_text: '', disclaimer_share: 0, pdf_links: [], pages: totalPages,
    format: inferFormat(url, fallbackTitle, r.word_count, visual, true),
    structure: { headings: 0, bullets: 0, key_takeaways: false, named_author: false, call_to_action: false, tables: 0 },
    visual, readability: r, gated: false,
  }
}

/** Fetch and read one page (or PDF). Null with a reason when it can't be read. */
export async function readPage(url: string, timeoutMs = 15000): Promise<{ page: Extracted | null; reason?: string; status?: number }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5' } })
    if (!res.ok) return { page: null, reason: `HTTP ${res.status}`, status: res.status }
    const type = res.headers.get('content-type') || ''
    if (/pdf/i.test(type) || /\.pdf(\?|$)/i.test(url)) return { page: await extractPdf(new Uint8Array(await res.arrayBuffer()), url) }
    const html = await res.text()
    return { page: extractFromHtml(html, res.url || url) }
  } catch (err: any) {
    return { page: null, reason: err?.name === 'AbortError' ? 'timed out' : String(err?.cause?.code || err?.message || err).slice(0, 120) }
  } finally { clearTimeout(t) }
}
