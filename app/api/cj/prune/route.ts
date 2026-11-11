import { NextRequest, NextResponse } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { makePairs } from '@/lib/cj'

export const maxDuration = 60

// Removes pieces from a judging set before anyone has judged it (duplicates, wrong language, pages
// with no real title, outlooks the kind filter missed), renumbers the rest and makes new pairs.
// ?set=<id>&drop=7,10,31 (positions as listed by the export). Refused once the set has judgements.
export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const q = req.nextUrl.searchParams
  const setId = q.get('set') || ''
  const drop = new Set((q.get('drop') || '').split(',').map(Number).filter(n => Number.isInteger(n)))
  const sb = db()
  const { count } = await sb.from('cj_judgements').select('id', { count: 'exact', head: true }).eq('set_id', setId)
  if (count) return NextResponse.json({ error: `set has ${count} judgements; make a new set instead` }, { status: 409 })
  const { data: set } = await sb.from('cj_sets').select('params').eq('id', setId).maybeSingle()
  if (!set) return NextResponse.json({ error: 'no set' }, { status: 404 })
  const { data: items } = await sb.from('cj_items').select('*').eq('set_id', setId).order('n')
  let keep = (items || []).filter(i => !drop.has(i.n))
  if (keep.length % 2) keep = keep.slice(0, -1)
  await sb.from('cj_items').delete().eq('set_id', setId)
  const renumbered = keep.map((i, k) => ({ ...i, n: k }))
  const { error } = await sb.from('cj_items').insert(renumbered)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rounds = Number((set.params as any)?.rounds || 8)
  const pairs = makePairs(renumbered.length, rounds, Date.now() % 100000, renumbered.map(i => i.word_count || 0))
  await sb.from('cj_sets').update({ params: { ...(set.params as object), pairs, dropped: Array.from(drop) } }).eq('id', setId)
  return NextResponse.json({ set: setId, items: renumbered.length, pairs: pairs.length, dropped: Array.from(drop) })
}
