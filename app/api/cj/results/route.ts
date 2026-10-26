import { NextRequest, NextResponse } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { managerName } from '@/lib/cj'
import { latestSetId, loadSet } from '@/lib/cj-data'

export const maxDuration = 60

// Plain-text results of a set for the "Comparative judgement" issue: how reliable each scale is, how
// the judges agree, whether scores track length, and the top and bottom of the scale.
export async function GET(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const sb = db()
  const id = req.nextUrl.searchParams.get('set') || await latestSetId(sb)
  const data = id ? await loadSet(sb, id) : null
  if (!data) return new NextResponse('No set', { status: 404 })
  const { set, items, report: r } = data
  const f = (x: number | null | undefined, pct = false) => x == null ? 'n/a' : pct ? `${Math.round(x * 100)}%` : x.toFixed(2)
  const qs = r.questions
  const lines: string[] = []
  lines.push(`# Comparative judgement: ${set.name}`, '', `Set \`${set.id}\` · ${items.length} pieces from ${new Set(items.map((i: any) => i.piece?.manager_id)).size} houses · ${data.pairs.length} pairs · updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '')
  lines.push('## Judges', '', ...Object.entries(r.judges).map(([j, v]) => `- ${j} (${v.kind}): ${v.judgements} judgements`), '')
  lines.push('## How good the scales are', '', '| Judges | Question | Reliability | Same winner both orders | Rank correlation with length | Agrees with the people |', '|---|---|---|---|---|---|')
  for (const g of Object.keys(r.scales)) for (const q of qs) {
    const ha = r.humanAgreement[g]?.[q]
    lines.push(`| ${g} | ${q} | ${f(r.scales[g][q].reliability)} | ${f(r.orderConsistency[g]?.[q], true)} | ${f(r.lengthCorrelation[g]?.[q])} | ${ha?.n ? `${f(ha.agree, true)} of ${ha.n}` : '–'} |`)
  }
  lines.push('', `Sonnet vs Haiku rank correlation: ${qs.map(q => `${q} ${f(r.modelAgreement[q])}`).join(', ')}.`)
  lines.push(`Correlation between the questions: ${Object.entries(r.questionCorrelation).map(([g, v]) => `${g} (${Object.entries(v).map(([k, x]) => `${k} ${f(x)}`).join(', ')})`).join('; ')}.`, '')
  const main = r.scales.production ? 'production' : r.scales.sonnet ? 'sonnet' : Object.keys(r.scales)[0]
  if (main) for (const q of qs) {
    const s = r.scales[main][q]
    const order = items.map((_: any, i: number) => i).sort((a: number, b: number) => s.theta[b] - s.theta[a])
    const row = (i: number, k: number) => `| ${k + 1} | ${s.theta[i].toFixed(2)} ± ${s.se[i].toFixed(2)} | ${managerName(items[i].piece?.manager_id)} | [${(items[i].piece?.title || '').slice(0, 90)}](${items[i].piece?.url}) | ${items[i].word_count} |`
    lines.push(`## ${q[0].toUpperCase() + q.slice(1)}: top 10 and bottom 5 (${main} scale)`, '', '| Rank | Score | House | Piece | Words |', '|---|---|---|---|---|')
    order.slice(0, 10).forEach((i: number, k: number) => lines.push(row(i, k)))
    lines.push('| … | | | | |')
    order.slice(-5).forEach((i: number, k: number) => lines.push(row(i, order.length - 5 + k)))
    lines.push('')
  }
  return new NextResponse(lines.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
