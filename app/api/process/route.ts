import { NextRequest, NextResponse } from 'next/server'
import { db, logRun, unauthorised } from '@/lib/db'
import { pieceKey } from '@/lib/dedupe'
import { readPage } from '@/lib/extract'
import { pieceRow } from '@/lib/piece-row'
import { MANAGERS } from '@/lib/sources'

export const maxDuration = 300

// Step 2 of 3. Reads queued addresses, measures them and files each under its piece (one piece,
// many editions). Paged: ?limit=40 per call; GitHub Actions calls again while `remaining` > 0.
// A page whose own date is older than ?before_days (default 400) is skipped, so a backfill does
// not pull in a house's whole archive through re-dated sitemap entries.

const MAX_ATTEMPTS = 3
const PER_HOUSE = 8


export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const started = Date.now()
  const deadline = started + 240_000
  const q = req.nextUrl.searchParams
  const limit = Math.min(Number(q.get('limit') || 80), 300)
  const oldest = new Date(Date.now() - Number(q.get('before_days') || 400) * 864e5)
  const sb = db()

  // A few of the newest waiting addresses from EVERY house, so one house with thousands queued
  // cannot fill the batch (16 Nov: the single newest-3,000 query was capped at 1,000 rows by the
  // database and held only two or three houses, so a backfill read about 20 pages a call)
  const houses = MANAGERS.map(m => m.id)
  const perHouseRows: any[][] = []
  for (let k = 0; k < houses.length; k += 20) {
    const chunk = await Promise.all(houses.slice(k, k + 20).map(async id => (await sb.from('editions')
      .select('url, source_id, manager_id, region, channel, lastmod, attempts')
      .eq('manager_id', id).eq('status', 'new').lt('attempts', MAX_ATTEMPTS)
      .order('lastmod', { ascending: false, nullsFirst: false }).limit(PER_HOUSE)).data || []))
    perHouseRows.push(...chunk)
  }
  // Round-robin across houses up to the limit
  const queue: any[] = []
  for (let r = 0; r < PER_HOUSE && queue.length < limit; r++) for (const rows of perHouseRows) if (rows[r] && queue.length < limit) queue.push(rows[r])

  const stats = { taken: queue?.length || 0, pieces_new: 0, editions_added: 0, failed: 0, gated: 0, skipped_old: 0, errors: {} as Record<string, number> }
  const note = (k: string) => { stats.errors[k] = (stats.errors[k] || 0) + 1 }

  // A few at a time per manager, so no one site is hit hard
  const byManager = new Map<string, typeof queue>()
  for (const e of queue || []) byManager.set(e.manager_id, [...(byManager.get(e.manager_id) || []), e])

  await Promise.all(Array.from(byManager.values()).map(async list => {
    for (const e of list!) {
      if (Date.now() > deadline) break
      // Another edition of a piece already read (same house, same slug): record the edition's
      // region and channel without fetching the page again
      const known = await sb.from('pieces').select('id, regions, channels').eq('piece_key', pieceKey(e.manager_id, e.url)).maybeSingle()
      if (known.data) {
        const regions = Array.from(new Set([...(known.data.regions || []), e.region].filter(Boolean)))
        const channels = Array.from(new Set([...(known.data.channels || []), e.channel].filter(Boolean)))
        await sb.from('pieces').update({ regions, channels }).eq('id', known.data.id)
        await sb.from('editions').update({ piece_id: known.data.id, status: 'read', read_at: new Date().toISOString(), error: 'edition of a piece already read' }).eq('url', e.url)
        stats.editions_added++
        continue
      }
      const { page, reason, status } = await readPage(e.url)
      if (!page) {
        stats.failed++; note(reason || 'unreadable')
        await sb.from('editions').update({ attempts: e.attempts + 1, http_status: status || null, error: reason || null, status: e.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : 'new' }).eq('url', e.url)
        continue
      }
      const when = page.published_at || e.lastmod
      if (when && new Date(when) < oldest) {
        stats.skipped_old++
        await sb.from('editions').update({ status: 'skipped', read_at: new Date().toISOString(), error: `published ${String(when).slice(0, 10)}` }).eq('url', e.url)
        continue
      }
      if (!page.published_at && e.lastmod) page.published_at = e.lastmod

      const key = pieceKey(e.manager_id, page.url, page.canonical_url)
      const { data: existing } = await sb.from('pieces').select('id, regions, channels, word_count, published_at').eq('piece_key', key).maybeSingle()
      let pieceId = existing?.id as string | undefined
      if (!pieceId) {
        const { data: ins, error: insErr } = await sb.from('pieces').insert({ piece_key: key, ...pieceRow(e.manager_id, page), regions: [e.region].filter(Boolean), channels: [e.channel].filter(Boolean) }).select('id').single()
        if (insErr || !ins) { stats.failed++; note(`store: ${insErr?.message?.slice(0, 60)}`); continue }
        pieceId = ins.id
        stats.pieces_new++
        await sb.from('piece_text').upsert({ piece_id: pieceId, text: page.text, disclaimer_text: page.disclaimer_text, pdf_links: page.pdf_links })
      } else {
        // Another edition of a piece already stored: add its region and channel; keep the fuller
        // reading and the earliest date
        const regions = Array.from(new Set([...(existing!.regions || []), e.region].filter(Boolean)))
        const channels = Array.from(new Set([...(existing!.channels || []), e.channel].filter(Boolean)))
        const fuller = (page.readability.word_count || 0) > (existing!.word_count || 0) * 1.2
        const earliest = [existing!.published_at, page.published_at].filter(Boolean).sort()[0] || null
        await sb.from('pieces').update({ regions, channels, published_at: earliest, ...(fuller ? { ...pieceRow(e.manager_id, page), published_at: earliest } : {}) }).eq('id', pieceId)
        if (fuller) await sb.from('piece_text').upsert({ piece_id: pieceId, text: page.text, disclaimer_text: page.disclaimer_text, pdf_links: page.pdf_links })
        stats.editions_added++
      }
      if (page.gated) stats.gated++
      await sb.from('editions').update({ piece_id: pieceId, status: page.gated ? 'gated' : 'read', read_at: new Date().toISOString(), attempts: e.attempts + 1, error: null }).eq('url', e.url)
    }
  }))

  const { count } = await sb.from('editions').select('url', { count: 'exact', head: true }).eq('status', 'new').lt('attempts', MAX_ATTEMPTS)
  const out = { ...stats, remaining: count ?? null, seconds: Math.round((Date.now() - started) / 1000) }
  await logRun('process', started, out)
  return NextResponse.json(out)
}
