import { NextRequest, NextResponse } from 'next/server'
import { isRealHeadline } from '@/lib/collect'
import { db, unauthorised } from '@/lib/db'

export const maxDuration = 120

// Housekeeping after rule changes (17 Oct 2026): removes headline-only pieces that are not real
// pieces (people, legal pages), pieces read from error pages, and summaries written from pages too
// thin to summarise. ?dry=1 reports what it would do.
export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const sb = db()
  const { data: gated } = await sb.from('pieces').select('id, title').eq('status', 'gated').limit(5000)
  const junk = (gated || []).filter(p => !isRealHeadline(p.title || '')).map(p => p.id)
  const { data: errors } = await sb.from('pieces').select('id').or('url.ilike.%403-error%,url.ilike.%404-error%,title.ilike.%page not found%,title.ilike.%access denied%').limit(1000)
  const errorIds = (errors || []).map(p => p.id)
  const { data: thin } = await sb.from('pieces').select('id').lt('word_count', 150).not('summary', 'is', null).neq('summary', '').limit(5000)
  const thinIds = (thin || []).map(p => p.id)
  if (!dry) {
    const remove = Array.from(new Set([...junk, ...errorIds]))
    for (let i = 0; i < remove.length; i += 200) {
      await sb.from('editions').update({ piece_id: null, status: 'skipped', error: 'removed in cleanup' }).in('piece_id', remove.slice(i, i + 200))
      await sb.from('pieces').delete().in('id', remove.slice(i, i + 200))
    }
    for (let i = 0; i < thinIds.length; i += 200) await sb.from('pieces').update({ summary: '' }).in('id', thinIds.slice(i, i + 200))
  }
  return NextResponse.json({ dry, removed_headlines: junk.length, removed_error_pages: errorIds.length, summaries_cleared: thinIds.length, sample: (gated || []).filter(p => junk.includes(p.id)).slice(0, 15).map(p => p.title) })
}
