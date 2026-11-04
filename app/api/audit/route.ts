import { NextRequest, NextResponse } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { MANAGERS, MANAGER_BY_ID, SOURCES } from '@/lib/sources'

export const maxDuration = 120

// Source audit, first step (4 Nov): for each house, what we hold — how many pieces, how recent,
// which editions (regions), the newest pieces with their dates and addresses, and how many have no
// date. ?managers=7im,alliancebernstein (default: all wave-1 houses) &n=8 newest pieces each.
export async function GET(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const q = req.nextUrl.searchParams
  const n = Math.min(Number(q.get('n') || 8), 30)
  const ids = (q.get('managers') || '').split(',').map(s => s.trim()).filter(Boolean)
  const houses = ids.length ? ids.map(id => MANAGER_BY_ID.get(id)).filter(Boolean) as typeof MANAGERS : MANAGERS.filter(m => m.wave === 1)
  const sb = db()
  const now = Date.now()
  const lines: string[] = [`# Source audit (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, '']
  const summary: string[] = ['| House | Pieces | Last 30 days | Undated | Newest dated | Editions | Sources |', '|---|---|---|---|---|---|---|']
  const detail: string[] = []
  for (const m of houses) {
    const { data: rows } = await sb.from('pieces').select('title, url, published_at, status, format, regions, word_count').eq('manager_id', m.id).limit(5000)
    const all = rows || []
    const dated = all.filter(r => r.published_at).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
    const recent = dated.filter(r => now - Date.parse(r.published_at!) < 30 * 864e5).length
    const regions = new Map<string, number>()
    for (const r of all) for (const g of (r.regions || [])) regions.set(g, (regions.get(g) || 0) + 1)
    const srcs = SOURCES.filter(s => s.manager === m.id && s.active !== false).map(s => s.id.replace(`${m.id}-`, '')).join(', ')
    summary.push(`| ${m.name} | ${all.length} | ${recent} | ${all.length - dated.length} | ${dated[0]?.published_at?.slice(0, 10) || '–'} | ${Array.from(regions.entries()).sort((a, b) => b[1] - a[1]).map(([g, c]) => `${g} ${c}`).join(', ') || '–'} | ${srcs} |`)
    detail.push(`### ${m.name}`, '', ...dated.slice(0, n).map(r => `- ${r.published_at?.slice(0, 10)} · ${r.status} · ${r.format || ''} · ${r.word_count ?? '?'} words · [${String(r.title || '(no title)').slice(0, 90)}](${r.url})`))
    // What happened to the addresses we found: read, skipped as too old, failed, waiting
    const { data: eds } = await sb.from('editions').select('url, status, error, lastmod').eq('manager_id', m.id).limit(20000)
    const byStatus = new Map<string, number>()
    for (const e of eds || []) byStatus.set(e.status, (byStatus.get(e.status) || 0) + 1)
    detail.push(`- Addresses found: ${(eds || []).length} (${Array.from(byStatus.entries()).map(([k, v]) => `${k} ${v}`).join(', ')})`)
    const probe = q.get('probe')
    if (probe) for (const e of (eds || []).filter(e => e.url.includes(probe)).slice(0, 10)) detail.push(`- probe: ${e.status} · ${e.error || ''} · ${e.url}`)
    const undated = all.filter(r => !r.published_at).slice(0, 3)
    if (undated.length) detail.push(...undated.map(r => `- undated · ${r.status} · [${String(r.title || '(no title)').slice(0, 90)}](${r.url})`))
    detail.push('')
  }
  return new NextResponse([...lines, ...summary, '', ...detail].join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
