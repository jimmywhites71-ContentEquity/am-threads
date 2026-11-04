import { NextRequest, NextResponse } from 'next/server'
import { db, logRun, unauthorised } from '@/lib/db'
import { readPage } from '@/lib/extract'

export const maxDuration = 300

// Re-reads pieces that have no publication date, with the fuller date-finding of 4 Nov (structured
// data, meta tags, <time>, a date near the headline, a year and month in the address), and stores
// the date found. Undated pieces checked and still undated are marked in `redate_checked` so the
// next call moves on. ?limit=80 per call; ?manager=7im for one house.
export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const started = Date.now(), deadline = started + 230_000
  const q = req.nextUrl.searchParams
  const limit = Math.min(Number(q.get('limit') || 80), 200)
  const sb = db()
  let query = sb.from('pieces').select('id, url, manager_id, structure').is('published_at', null).in('status', ['read', 'thin'])
    .not('url', 'like', 'https://news.google.com%').order('first_seen_at', { ascending: true }).limit(2000)
  if (q.get('manager')) query = query.eq('manager_id', q.get('manager'))
  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Skip pieces already re-checked without finding a date (flag kept in the structure JSON)
  const todo = (rows || []).filter(r => !(r.structure as any)?.redate_checked)
  // A few per house at a time, spread across houses
  const per = new Map<string, number>()
  const batch = todo.filter(r => { const k = (per.get(r.manager_id) || 0) + 1; per.set(r.manager_id, k); return k <= 10 }).slice(0, limit)
  const stats = { taken: batch.length, dated: 0, still_undated: 0, failed: 0, by_house: {} as Record<string, { dated: number; undated: number }> }
  const queue = [...batch]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      if (Date.now() > deadline) break
      const h = (stats.by_house[r.manager_id] ||= { dated: 0, undated: 0 })
      try {
        const { page } = await readPage(r.url)
        if (page?.published_at) {
          await sb.from('pieces').update({ published_at: page.published_at }).eq('id', r.id)
          stats.dated++; h.dated++
        } else {
          await sb.from('pieces').update({ structure: { ...((r.structure as object) || {}), redate_checked: new Date().toISOString().slice(0, 10) } }).eq('id', r.id)
          stats.still_undated++; h.undated++
        }
      } catch { stats.failed++ }
    }
  }))
  const remaining = todo.length - stats.dated - stats.still_undated
  const out = { ...stats, remaining, seconds: Math.round((Date.now() - started) / 1000) }
  await logRun('redate', started, out)
  return NextResponse.json(out)
}
