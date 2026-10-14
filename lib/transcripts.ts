import { UA } from './bot'
// Podcast transcripts published by the show itself (the <podcast:transcript>
// tag in its feed). Shows without one are left alone.

export interface TranscriptRef { url: string; type: string }

// Plain text first, then subtitle formats (which need their timings removed)
const PREFERENCE = ['text/plain', 'text/vtt', 'application/srt', 'application/x-subrip', 'text/srt', 'text/html']

/** The best transcript on a feed item, if it has any */
export function pickTranscript(nodes: unknown): TranscriptRef | null {
  const list = Array.isArray(nodes) ? nodes : nodes ? [nodes] : []
  const refs: TranscriptRef[] = []
  for (const n of list as any[]) {
    const url = n?.$?.url ?? n?.url
    const type = String(n?.$?.type ?? n?.type ?? '').toLowerCase()
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) refs.push({ url: url.replace(/&amp;/g, '&'), type })
  }
  refs.sort((a, b) => rank(a.type) - rank(b.type))
  return refs[0] && rank(refs[0].type) < PREFERENCE.length ? refs[0] : null
}

function rank(type: string): number {
  const i = PREFERENCE.findIndex(p => type.startsWith(p))
  return i === -1 ? PREFERENCE.length : i
}

const TIMING = /^\s*\[?\(?(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?\)?\]?(\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?.*)?\s*/
const SPEAKER = /^(?:<v\s+([^>]+)>|([A-Z][\w.'’-]*(?:\s+[A-Z0-9][\w.'’-]*){0,3}):\s)/

/** Subtitle or text transcript -> readable paragraphs, one per speaker turn where speakers are marked */
export function cleanTranscript(raw: string, type = ''): string {
  let text = raw.replace(/\r/g, '')
  if (type.startsWith('text/html')) {
    text = text.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(p|div|br|li|h\d)>|<br\s*\/?>/gi, '\n')
  }

  const turns: string[] = []
  let current = ''
  let lastSpeaker = ''
  const flush = () => { if (current.trim()) turns.push(current.trim()); current = '' }

  for (let line of text.split('\n')) {
    line = line.trim()
    if (!line || /^WEBVTT/i.test(line) || /^NOTE\b/.test(line) || /^\d+$/.test(line)) continue
    line = line.replace(TIMING, '')
    if (!line) continue

    const m = line.match(SPEAKER)
    const speaker = (m?.[1] || m?.[2] || '').trim()
    line = line.replace(/<v\s+[^>]+>/g, '').replace(/<[^>]+>/g, '').trim()
    if (speaker && m?.[1]) line = `${speaker}: ${line}`   // WebVTT voice tag -> "Name: text"
    if (!line) continue

    if (speaker) {
      if (speaker !== lastSpeaker) { flush(); lastSpeaker = speaker }
      else line = line.replace(new RegExp(`^${speaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*`), '')
    }
    current += (current ? ' ' : '') + line
    // No speakers marked: break into paragraphs of a few sentences
    if (!lastSpeaker && current.length > 700 && /[.!?]["”']?$/.test(line)) flush()
  }
  flush()

  return turns.join('\n\n')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Download and tidy a transcript. Returns null if it can't be read or is too short to be real. */
export async function fetchTranscript(ref: TranscriptRef, timeoutMs = 15000): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(ref.url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA } })
    clearTimeout(t)
    if (!res.ok) return null
    const text = cleanTranscript((await res.text()).slice(0, 1_500_000), ref.type)
    return text.length > 500 ? text.slice(0, 400_000) : null
  } catch {
    return null
  }
}
