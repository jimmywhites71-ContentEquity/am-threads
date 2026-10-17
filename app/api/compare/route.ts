import { NextRequest } from 'next/server'
import { tagPieces, type Tags } from '@/lib/classifier'
import { db, logRun, unauthorised } from '@/lib/db'
import { MANAGER_BY_ID } from '@/lib/sources'
import { costOf, type Usage } from '@/lib/usage'

export const maxDuration = 300

// Side-by-side test of tagging set-ups on pieces already tagged (nothing is stored). For each set-up:
// agreement with the stored tags, and cost per piece. ?n=100. The stored tags came from Sonnet 5.5,
// so "Sonnet again" shows how consistent the baseline is with itself: Haiku should be judged
// against that, not against 100%.

const SETUPS: { name: string; model: string; batch?: number }[] = [
  { name: 'Sonnet 5.5 again (baseline consistency)', model: 'claude-sonnet-5-5' },
  { name: 'Haiku 5.5', model: 'claude-haiku-5-5', batch: 10 },
]

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a), B = new Set(b)
  if (!A.size && !B.size) return 1
  return Array.from(A).filter(x => B.has(x)).length / new Set([...a, ...b]).size
}
const same = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x))

export async function GET(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const started = Date.now()
  const n = Math.min(Number(req.nextUrl.searchParams.get('n') || 100), 150)
  const sb = db()
  const { data } = await sb.from('pieces')
    .select('id, manager_id, title, summary, format, asset_classes, sub_asset_classes, primary_theme, secondary_themes, subject_regions, explicit_call, piece_text(text)')
    .eq('status', 'read').not('taxonomy_version', 'is', null).order('published_at', { ascending: false }).limit(4000)
  const perHouse = new Map<string, number>()
  const pieces = (data || []).filter((p: any) => { const c = perHouse.get(p.manager_id) || 0; if (c >= 3) return false; perHouse.set(p.manager_id, c + 1); return true }).slice(0, n)
  const inputs = pieces.map((p: any) => ({
    id: p.id, manager: MANAGER_BY_ID.get(p.manager_id)?.name || p.manager_id, title: p.title || '', summary: p.summary || '',
    opening: ((Array.isArray(p.piece_text) ? p.piece_text[0]?.text : p.piece_text?.text) || '').slice(0, 800), format: p.format || 'article',
  }))

  const lines: string[] = [`# Tagging comparison (${pieces.length} pieces, up to 3 per house)`, '', 'Agreement with the stored tags (Sonnet 5.5). Cost at list prices, with the guide cached.', '',
    '| Set-up | Tagged | Asset classes same | Primary theme same | Theme overlap | Regions overlap | Call same | Cost per 1,000 pieces |', '|---|---|---|---|---|---|---|---|']
  const examples: string[] = []
  let totalCost = 0
  for (const s of SETUPS) {
    const usage: Usage = {}
    const { tags, errors } = await tagPieces(inputs, { model: s.model, usage, batch: s.batch, deadline: started + 270_000 })
    if (errors.length) lines.push(`|  ↳ errors | ${errors.slice(0, 2).join('; ').replace(/\|/g, '/')} | | | | | | |`)
    const cost = costOf(usage); totalCost += cost
    let ac = 0, pt = 0, th = 0, rg = 0, call = 0, k = 0
    for (const p of pieces as any[]) {
      const t: Tags | undefined = tags.get(p.id)
      if (!t) continue
      k++
      if (same(t.asset_classes, p.asset_classes || [])) ac++
      if ((t.primary_theme || null) === (p.primary_theme || null)) pt++
      th += jaccard([t.primary_theme, ...t.secondary_themes].filter(Boolean) as string[], [p.primary_theme, ...(p.secondary_themes || [])].filter(Boolean))
      rg += jaccard(t.regions, p.subject_regions || [])
      if (t.explicit_call === !!p.explicit_call) call++
      if (s.model.includes('haiku') && examples.length < 12 && (!same(t.asset_classes, p.asset_classes || []) || (t.primary_theme || null) !== (p.primary_theme || null))) {
        examples.push(`- **${p.title}** (${MANAGER_BY_ID.get(p.manager_id)?.name}): stored ${(p.asset_classes || []).join(', ') || '–'} / ${p.primary_theme || '–'} + ${(p.secondary_themes || []).join(', ') || '–'}; Haiku ${t.asset_classes.join(', ') || '–'} / ${t.primary_theme || '–'} + ${t.secondary_themes.join(', ') || '–'}`)
      }
    }
    const pc = (x: number) => k ? `${Math.round((x / k) * 100)}%` : '–'
    lines.push(`| ${s.name} | ${k} | ${pc(ac)} | ${pc(pt)} | ${pc(th)} | ${pc(rg)} | ${pc(call)} | $${k ? ((cost / k) * 1000).toFixed(2) : '–'} |`)
    const u = Object.values(usage)[0]
    if (u) lines.push(`|  ↳ tokens per piece | | input ${Math.round(u.input / Math.max(1, k))}, cache write ${Math.round(u.cache_write / Math.max(1, k))}, cache read ${Math.round(u.cache_read / Math.max(1, k))}, output ${Math.round(u.output / Math.max(1, k))} | | | | | |`)
  }
  lines.push('', '## Where Haiku differed (first 12)', '', ...(examples.length ? examples : ['- none']))
  await logRun('compare', started, { pieces: pieces.length, cost_usd: Math.round(totalCost * 10000) / 10000 })
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
