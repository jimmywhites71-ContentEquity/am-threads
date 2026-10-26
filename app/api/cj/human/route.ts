import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { latestSetId } from '@/lib/cj-data'
import { judgeImagePath } from '@/lib/cj'

// The people's judgements, from the /judge page (behind the site password, see middleware.ts).
// GET ?set=&judge=Name → the next pair for this person: one with the fewest human judgements that
// they have not judged yet. POST { set, judge, pair, left_n, right_n, ideas_winner, writing_winner, presentation_winner?, seconds }.
export async function GET(req: NextRequest) {
  const sb = db()
  const q = req.nextUrl.searchParams
  const setId = q.get('set') || await latestSetId(sb)
  const judge = (q.get('judge') || '').trim().slice(0, 60)
  if (!setId) return NextResponse.json({ error: 'No judging set yet' }, { status: 404 })
  const { data: set } = await sb.from('cj_sets').select('id, name, theme, params').eq('id', setId).maybeSingle()
  if (!set) return NextResponse.json({ error: `No set ${setId}` }, { status: 404 })
  const pairs = ((set.params as any)?.pairs || []) as [number, number][]
  const { data: hs } = await sb.from('cj_judgements').select('pair, judge').eq('set_id', setId).eq('judge_kind', 'human').limit(10000)
  const count = new Map<number, number>(), mine = new Set<number>()
  for (const h of hs || []) { count.set(h.pair, (count.get(h.pair) || 0) + 1); if (h.judge.toLowerCase() === judge.toLowerCase()) mine.add(h.pair) }
  const open = pairs.map((_, k) => k).filter(k => !mine.has(k))
  if (!open.length) return NextResponse.json({ set: { id: set.id, name: set.name }, done: mine.size, total: pairs.length, pair: null })
  const least = Math.min(...open.map(k => count.get(k) || 0))
  const choices = open.filter(k => (count.get(k) || 0) === least)
  const k = choices[Math.floor(Math.random() * choices.length)]
  const [a, b] = Math.random() < 0.5 ? pairs[k] : [pairs[k][1], pairs[k][0]]
  const { data: items } = await sb.from('cj_items').select('n, piece_id, anon_title, anon_text, word_count').eq('set_id', setId).in('n', [a, b])
  const L = items?.find(i => i.n === a), R = items?.find(i => i.n === b)
  // Screenshots, through short-lived signed addresses (the bucket is private)
  const paths = [L, R].flatMap(x => x ? [judgeImagePath(x.piece_id, 'top'), judgeImagePath(x.piece_id, 'page')] : [])
  const { data: signed } = await sb.storage.from('captures').createSignedUrls(paths, 3600)
  const urlOf = (p: string) => signed?.find(x => x.path === p && !x.error)?.signedUrl || null
  const shots = (x: typeof L) => x ? { top: urlOf(judgeImagePath(x.piece_id, 'top')), page: urlOf(judgeImagePath(x.piece_id, 'page')) } : { top: null, page: null }
  return NextResponse.json({
    set: { id: set.id, name: set.name, theme: set.theme }, done: mine.size, total: pairs.length, teamTotal: hs?.length || 0,
    pair: { k, left: { n: a, title: L?.anon_title, text: L?.anon_text, words: L?.word_count, ...shots(L) }, right: { n: b, title: R?.anon_title, text: R?.anon_text, words: R?.word_count, ...shots(R) } },
  })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  const judge = String(b?.judge || '').trim().slice(0, 60)
  if (!b?.set || !judge || b.pair == null || ![b.left_n, b.right_n].includes(b.ideas_winner) || ![b.left_n, b.right_n].includes(b.writing_winner)) {
    return NextResponse.json({ error: 'Incomplete judgement' }, { status: 400 })
  }
  const sb = db()
  const { data: set } = await sb.from('cj_sets').select('params').eq('id', b.set).maybeSingle()
  const pair = ((set?.params as any)?.pairs || [])[b.pair] as [number, number] | undefined
  if (!pair || [...pair].sort().join() !== [b.left_n, b.right_n].sort().join()) {
    return NextResponse.json({ error: 'Unknown pair' }, { status: 400 })
  }
  const { error } = await sb.from('cj_judgements').insert({
    set_id: b.set, pair: b.pair, left_n: b.left_n, right_n: b.right_n, ideas_winner: b.ideas_winner, writing_winner: b.writing_winner,
    ...([b.left_n, b.right_n].includes(b.presentation_winner) ? { presentation_winner: b.presentation_winner } : {}),
    ideas_reason: b.ideas_reason ? String(b.ideas_reason).slice(0, 300) : null, writing_reason: b.writing_reason ? String(b.writing_reason).slice(0, 300) : null,
    judge_kind: 'human', judge, seconds: Number(b.seconds) || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
