import { NextRequest, NextResponse } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { anonymise, makePairs } from '@/lib/cj'

export const maxDuration = 120

// Creates a comparative-judgement set: up to ?n=60 recent pieces on one theme (?theme=, several joined
// with |, or the theme with the most comparable pieces across houses), at most ?per_house=3 from any
// house, 700-6,000 words, shown in full up to ?words=4000 and anonymised, with ?rounds=8 comparisons
// per piece against pieces of similar length. Screenshots come from scripts/capture.ts --set <id>.
// ?dry=1 lists the candidate themes without creating anything.
export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const q = req.nextUrl.searchParams
  const n = Math.min(Number(q.get('n') || 60), 120)
  const days = Number(q.get('days') || 60)
  const perHouse = Number(q.get('per_house') || 3)
  const words = Number(q.get('words') || 4000)
  const rounds = Number(q.get('rounds') || 8)
  const sb = db()
  const since = new Date(Date.now() - days * 864e5).toISOString()

  const { data: rows, error } = await sb.from('pieces')
    .select('id, manager_id, title, url, primary_theme, content_purpose, word_count, published_at')
    .eq('status', 'read').in('format', ['article', 'outlook', 'research paper'])
    .gte('word_count', 700).lte('word_count', 6000).gte('published_at', since).not('primary_theme', 'is', null)
    .order('published_at', { ascending: false }).limit(20000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Leave out what is not a written argument or not current: podcast, video and webinar pages,
  // and titles naming an earlier year (an old review re-dated by its sitemap)
  const year = new Date().getUTCFullYear()
  // ?purposes=thought leadership,house view keeps only those content purposes (the tagger's field)
  const purposes = (q.get('purposes') || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  const usable = (rows || []).filter(r => (!purposes.length || purposes.includes(String(r.content_purpose || '').toLowerCase())) && !/podcast|webinar|video|episode/i.test(`${r.url} ${r.title}`)
    && !(`${r.title} ${r.url}`.match(/\b20\d\d\b/g) || []).some(y => Number(y) < year - 1))
  // Comparable pieces per theme, capped per house
  const byTheme = new Map<string, typeof rows>()
  for (const r of usable) byTheme.set(r.primary_theme!, [...(byTheme.get(r.primary_theme!) || []), r])
  const capped = (list: NonNullable<typeof rows>) => {
    const per = new Map<string, number>()
    return list.filter(r => { const k = (per.get(r.manager_id) || 0) + 1; per.set(r.manager_id, k); return k <= perHouse })
  }
  const candidates = Array.from(byTheme.entries()).map(([theme, list]) => {
    const c = capped(list!)
    return { theme, pieces: c.length, houses: new Set(c.map(r => r.manager_id)).size }
  }).sort((a, b) => b.pieces - a.pieces || b.houses - a.houses)
  if (q.get('dry') === '1') return NextResponse.json({ candidates: candidates.slice(0, 20) })

  const theme = q.get('theme') || candidates[0]?.theme
  const themes = (theme || '').split('|').map(t => t.trim()).filter(t => byTheme.has(t))
  if (!themes.length) return NextResponse.json({ error: `no pieces for theme ${theme}`, candidates: candidates.slice(0, 10) }, { status: 400 })
  if (themes.length > 1) byTheme.set(theme!, themes.flatMap(t => byTheme.get(t)!).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))))
  // Spread across houses: take each house's newest first, round-robin, so the set is not one house's month
  const pool = capped(byTheme.get(theme)!)
  const byHouse = new Map<string, typeof pool>()
  for (const r of pool) byHouse.set(r.manager_id, [...(byHouse.get(r.manager_id) || []), r])
  const chosen: typeof pool = []
  for (let k = 0; chosen.length < n && k < perHouse; k++) for (const list of byHouse.values()) if (list[k] && chosen.length < n) chosen.push(list[k])
  if (chosen.length % 2) chosen.pop()   // an even set pairs cleanly every round

  const { data: texts, error: tErr } = await sb.from('piece_text').select('piece_id, text').in('piece_id', chosen.map(c => c.id))
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  const textOf = new Map((texts || []).map(t => [t.piece_id, t.text as string]))
  const items = chosen.filter(c => (textOf.get(c.id) || '').length > 1500)
  if (items.length % 2) items.pop()

  const month = new Date().toISOString().slice(0, 7)
  const base = q.get('id') || `cj-${month}-${theme!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  // A second set on the same theme in the same month gets -v2, -v3…
  const { data: taken } = await sb.from('cj_sets').select('id').like('id', `${base}%`)
  const ids = new Set((taken || []).map(t => t.id))
  let id = base
  for (let k = 2; ids.has(id); k++) id = `${base}-v${k}`
  // Like with like: each piece is paired with pieces of similar length (James, 26 Oct)
  const pairs = makePairs(items.length, rounds, Date.now() % 100000, items.map(i => i.word_count || 0))
  const { error: sErr } = await sb.from('cj_sets').insert({
    id, name: `${theme}, ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} (pilot)`, theme,
    params: { days, per_house: perHouse, words, rounds, purposes, pairs, created_from: candidates.slice(0, 10) },
  })
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })
  const { error: iErr } = await sb.from('cj_items').insert(items.map((c, i) => ({
    set_id: id, n: i, piece_id: c.id, word_count: c.word_count,
    anon_title: anonymise(c.manager_id, c.title || '', 40).replace(/\n\n\[…\]$/, ''),
    anon_text: anonymise(c.manager_id, textOf.get(c.id)!, words),
  })))
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })
  return NextResponse.json({ id, theme, items: items.length, houses: new Set(items.map(i => i.manager_id)).size, pairs: pairs.length, candidates: candidates.slice(0, 8) })
}
