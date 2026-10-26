import { NextRequest, NextResponse } from 'next/server'
import { db, logRun, unauthorised } from '@/lib/db'
import { CJ_MODELS, cjBudget, judgeImagePath, judgePair } from '@/lib/cj'
import { costOf, type Usage } from '@/lib/usage'

export const maxDuration = 300

// The AI judge: ?set=<id>&model=sonnet|haiku. Judges every pair of the set in both orders (A/B swapped),
// with screenshots when the set has them, a few at a time until the time runs out; GitHub Actions calls again while `remaining` > 0.
// Stops before spending once this month's comparative-judgement spend reaches CJ_BUDGET_USD.
export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const started = Date.now(), deadline = started + 240_000
  const q = req.nextUrl.searchParams
  const setId = q.get('set') || ''
  const model = CJ_MODELS[q.get('model') || 'sonnet'] || CJ_MODELS.sonnet
  const sb = db()

  const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const { data: runs } = await sb.from('runs').select('stats').eq('step', 'cj').gte('started_at', month).limit(5000)
  const spent = (runs || []).reduce((s, r) => s + Number((r.stats as any)?.cost_usd || 0), 0)
  if (spent >= cjBudget()) return NextResponse.json({ judged: 0, remaining: 0, stopped: `comparative-judgement budget reached ($${spent.toFixed(2)} of $${cjBudget()})` })

  const { data: set } = await sb.from('cj_sets').select('id, theme, params').eq('id', setId).maybeSingle()
  if (!set) return NextResponse.json({ error: `no set ${setId}` }, { status: 404 })
  const pairs = ((set.params as any)?.pairs || []) as [number, number][]
  const { data: items } = await sb.from('cj_items').select('n, piece_id, anon_title, anon_text').eq('set_id', setId)
  const item = new Map((items || []).map(i => [i.n, i]))
  const { data: done } = await sb.from('cj_judgements').select('pair, left_n').eq('set_id', setId).eq('judge', model).limit(20000)
  const have = new Set((done || []).map(d => `${d.pair}:${d.left_n}`))
  // Every pair both ways round
  const todo: { pair: number; left: number; right: number }[] = []
  pairs.forEach(([a, b], k) => {
    if (!have.has(`${k}:${a}`)) todo.push({ pair: k, left: a, right: b })
    if (!have.has(`${k}:${b}`)) todo.push({ pair: k, left: b, right: a })
  })

  // Screenshots (top of page, whole page) as base64 JPEGs, fetched once per piece; missing ones mean
  // the pair is judged on ideas and writing only
  const images = new Map<number, Promise<{ top: string | null; page: string | null }>>()
  const b64 = async (path: string) => {
    const { data } = await sb.storage.from('captures').download(path)
    if (!data || data.size > 4_500_000) return null
    return Buffer.from(await data.arrayBuffer()).toString('base64')
  }
  const imagesOf = (n: number) => {
    if (!images.has(n)) { const pid = item.get(n)!.piece_id; images.set(n, Promise.all([b64(judgeImagePath(pid, 'top')), b64(judgeImagePath(pid, 'page'))]).then(([top, page]) => ({ top, page }))) }
    return images.get(n)!
  }

  const usage: Usage = {}
  const stats = { judged: 0, failed: 0, errors: [] as string[] }
  const queue = todo.slice(0, Number(q.get('limit') || 200))
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      if (Date.now() > deadline) break
      const L = item.get(t.left)!, R = item.get(t.right)!
      const t0 = Date.now()
      try {
        const [li, ri] = await Promise.all([imagesOf(t.left), imagesOf(t.right)])
        const v = await judgePair(model, set.theme || '', { title: L.anon_title || '', text: L.anon_text, ...li }, { title: R.anon_title || '', text: R.anon_text, ...ri }, usage)
        const { error } = await sb.from('cj_judgements').insert({
          set_id: setId, pair: t.pair, left_n: t.left, right_n: t.right,
          ideas_winner: v.ideas === 'A' ? t.left : t.right, writing_winner: v.writing === 'A' ? t.left : t.right,
          presentation_winner: v.presentation ? (v.presentation === 'A' ? t.left : t.right) : null,
          ideas_reason: v.ideas_reason, writing_reason: v.writing_reason, presentation_reason: v.presentation_reason,
          judge_kind: 'ai', judge: model, seconds: (Date.now() - t0) / 1000,
        })
        if (error) throw new Error(error.message)
        stats.judged++
      } catch (err: any) { stats.failed++; if (stats.errors.length < 5) stats.errors.push(String(err?.message || err).slice(0, 140)) }
    }
  }))
  const out = { set: setId, model, ...stats, remaining: Math.max(0, todo.length - stats.judged), seconds: Math.round((Date.now() - started) / 1000), usage, cost_usd: costOf(usage), month_cj_usd: Math.round((spent + costOf(usage)) * 100) / 100 }
  await logRun('cj', started, out)
  return NextResponse.json(out)
}
