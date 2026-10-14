import { NextRequest, NextResponse } from 'next/server'
import { discover } from '@/lib/collect'
import { db, logRun, unauthorised } from '@/lib/db'
import { ACTIVE_SOURCES, MANAGERS, SOURCES, editionOf } from '@/lib/sources'

export const maxDuration = 300

// Step 1 of 3. Lists each source's pages since `days` ago and queues new addresses in `editions`.
// Nothing is read yet. ?days=365 for a backfill; ?source=<id> for one source; ?dry=1 reports what
// would be queued without storing anything (used to check unverified sources).
export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const started = Date.now()
  const q = req.nextUrl.searchParams
  const days = Math.min(Number(q.get('days') || 14), 730)
  const dry = q.get('dry') === '1'
  const only = q.get('source')
  const since = new Date(Date.now() - days * 864e5)
  const sb = db()

  if (!dry) {
    await sb.from('managers').upsert(MANAGERS.map(({ id, name, parent_group, home }) => ({ id, name, parent_group, home })), { onConflict: 'id' })
    await sb.from('sources').upsert(SOURCES.map(s => ({ id: s.id, manager_id: s.manager, name: s.name, feed_url: s.feed_url, kind: s.kind || 'rss', active: s.active !== false, verified: s.verified || null })), { onConflict: 'id' })
  }

  const report: Record<string, { found?: number; queued?: number; sample?: string[]; error?: string }> = {}
  await Promise.all(ACTIVE_SOURCES.filter(s => !only || s.id === only).map(async source => {
    try {
      const found = await discover(source, since)
      if (dry) { report[source.id] = { found: found.length, sample: found.slice(0, 5).map(f => f.url) }; return }
      let queued = 0
      for (let i = 0; i < found.length; i += 500) {
        const rows = found.slice(i, i + 500).map(f => ({ url: f.url, source_id: f.source_id, manager_id: f.manager, lastmod: f.lastmod, ...editionOf(f.manager, f.url) }))
        // Existing addresses are left as they are
        const { data, error } = await sb.from('editions').upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('url')
        if (error) throw new Error(error.message)
        queued += data?.length || 0
      }
      report[source.id] = { found: found.length, queued }
      await sb.from('sources').update({ last_run_at: new Date().toISOString(), last_found: found.length, last_error: null, ...(found.length ? { verified: new Date().toISOString().slice(0, 10) } : {}) }).eq('id', source.id)
    } catch (err: any) {
      const error = String(err?.message || err).slice(0, 200)
      report[source.id] = { error }
      if (!dry) await sb.from('sources').update({ last_run_at: new Date().toISOString(), last_error: error }).eq('id', source.id)
    }
  }))

  const stats = { days, dry, sources: report }
  if (!dry) await logRun('discover', started, stats)
  return NextResponse.json(stats)
}
