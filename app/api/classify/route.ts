import { NextRequest, NextResponse } from 'next/server'
import { summarise, tagPieces } from '@/lib/classifier'
import { db, logRun, unauthorised } from '@/lib/db'
import { MANAGER_BY_ID } from '@/lib/sources'
import { TAXONOMY_VERSION } from '@/lib/taxonomy'

export const maxDuration = 300

// Step 3 of 3. Summarises pieces that have none, then tags every piece not yet tagged against the
// current taxonomy version (so a new version re-tags history simply by running this again).
// ?limit=60 per call; ?dry=1&limit=30 tags a sample and returns the tags without storing them,
// for the hand-check before trusting the numbers.

export async function POST(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const started = Date.now()
  const deadline = started + 230_000
  const q = req.nextUrl.searchParams
  const limit = Math.min(Number(q.get('limit') || 60), 200)
  const dry = q.get('dry') === '1'
  const sb = db()

  const { data: rows, error } = await sb.from('pieces')
    .select('id, manager_id, title, summary, format, taxonomy_version, piece_text(text)')
    .in('status', ['read', 'thin'])
    .or(`taxonomy_version.is.null,taxonomy_version.neq.${TAXONOMY_VERSION}`)
    .order('published_at', { ascending: false, nullsFirst: false }).limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pieces = (rows || []).map((r: any) => ({ ...r, text: (Array.isArray(r.piece_text) ? r.piece_text[0]?.text : r.piece_text?.text) || '' }))
  const stats = { taken: pieces.length, summarised: 0, tagged: 0, errors: [] as string[] }

  // Summaries, a few at a time
  const need = pieces.filter(p => !p.summary && p.text.length >= 300)
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let p = need.shift(); p; p = need.shift()) {
      if (Date.now() > deadline - 90_000) break
      const r = await summarise({ title: p.title || '', text: p.text, manager: MANAGER_BY_ID.get(p.manager_id)?.name || p.manager_id })
      if (r.error) stats.errors.push(r.error)
      if (r.summary) { p.summary = r.summary; stats.summarised++; if (!dry) await sb.from('pieces').update({ summary: r.summary }).eq('id', p.id) }
    }
  }))

  const { tags, errors } = await tagPieces(pieces.map(p => ({
    id: p.id, manager: MANAGER_BY_ID.get(p.manager_id)?.name || p.manager_id, title: p.title || '', summary: p.summary || '',
    opening: p.text.slice(0, 800), format: p.format || 'article',
  })), { deadline })
  stats.errors.push(...errors)

  if (dry) {
    const sample = pieces.map(p => ({ title: p.title, manager: p.manager_id, summary: p.summary, tags: tags.get(p.id) || null }))
    return NextResponse.json({ ...stats, tagged: tags.size, sample })
  }

  for (const [id, t] of tags) {
    const { error: upErr } = await sb.from('pieces').update({
      asset_classes: t.asset_classes, sub_asset_classes: t.sub_asset_classes, primary_theme: t.primary_theme,
      secondary_themes: t.secondary_themes, subject_regions: t.regions, vehicles: t.vehicles,
      content_purpose: t.content_purpose, explicit_call: t.explicit_call, call_text: t.call_text,
      theme_candidate: t.theme_candidate, taxonomy_version: t.taxonomy_version, tagged_at: new Date().toISOString(),
    }).eq('id', id)
    if (!upErr) stats.tagged++
  }

  const { count } = await sb.from('pieces').select('id', { count: 'exact', head: true }).in('status', ['read', 'thin'])
    .or(`taxonomy_version.is.null,taxonomy_version.neq.${TAXONOMY_VERSION}`)
  const out = { ...stats, errors: stats.errors.slice(0, 10), remaining: count ?? null, seconds: Math.round((Date.now() - started) / 1000) }
  await logRun('classify', started, out)
  return NextResponse.json(out)
}
