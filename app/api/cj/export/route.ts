import { NextRequest, NextResponse } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { managerName } from '@/lib/cj'
import { latestSetId } from '@/lib/cj-data'

export const maxDuration = 60

// Everything about one judging set, for analysis: its pieces (named, with format, purpose and length)
// and every judgement with its judge, order and reasons. ?set=<id>
export async function GET(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const sb = db()
  const id = req.nextUrl.searchParams.get('set') || await latestSetId(sb)
  const { data: set } = await sb.from('cj_sets').select('id, name, theme, params').eq('id', id!).maybeSingle()
  if (!set) return NextResponse.json({ error: 'no set' }, { status: 404 })
  const { data: items } = await sb.from('cj_items').select('n, piece_id, anon_title, word_count, pieces(manager_id, title, url, format, content_purpose, published_at, primary_theme, fk_grade)').eq('set_id', id!).order('n')
  const judgements: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('cj_judgements').select('pair, left_n, right_n, ideas_winner, writing_winner, presentation_winner, ideas_reason, writing_reason, presentation_reason, judge_kind, judge, seconds, created_at').eq('set_id', id!).range(from, from + 999)
    judgements.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return NextResponse.json({
    set: { id: set.id, name: set.name, theme: set.theme, pairs: (set.params as any)?.pairs },
    items: (items || []).map((i: any) => { const p = Array.isArray(i.pieces) ? i.pieces[0] : i.pieces; return { n: i.n, house: managerName(p?.manager_id), title: p?.title, url: p?.url, format: p?.format, purpose: p?.content_purpose, words: i.word_count, published: p?.published_at, reading_age: p?.fk_grade != null ? Math.round(p.fk_grade + 5) : null } }),
    judgements,
  })
}
