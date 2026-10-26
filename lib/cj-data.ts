import type { db } from './db'
import { report, type Judgement } from './cj'

/** One set with its pieces (named, for the results page), all judgements and the fitted report */
export async function loadSet(sb: ReturnType<typeof db>, id: string) {
  const { data: set } = await sb.from('cj_sets').select('id, name, theme, params, created_at').eq('id', id).maybeSingle()
  if (!set) return null
  const { data: items } = await sb.from('cj_items').select('n, piece_id, anon_title, word_count, pieces(manager_id, title, url, published_at, flesch_reading_ease)').eq('set_id', id).order('n')
  const js: Judgement[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('cj_judgements').select('pair, left_n, right_n, ideas_winner, writing_winner, judge_kind, judge, ideas_reason, writing_reason').eq('set_id', id).range(from, from + 999)
    js.push(...((data || []) as Judgement[]))
    if (!data || data.length < 1000) break
  }
  const list = (items || []).map((i: any) => ({ ...i, piece: Array.isArray(i.pieces) ? i.pieces[0] : i.pieces }))
  return { set, items: list, judgements: js, report: report(list.length, list, js), pairs: ((set.params as any)?.pairs || []) as [number, number][] }
}

export async function latestSetId(sb: ReturnType<typeof db>) {
  const { data } = await sb.from('cj_sets').select('id').order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.id as string | undefined
}
