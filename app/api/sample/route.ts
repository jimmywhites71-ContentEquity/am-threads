import { NextRequest } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { MANAGER_BY_ID } from '@/lib/sources'

export const maxDuration = 60

// A spread of tagged pieces for the hand-check: at most a few per house, newest first, as Markdown.
// ?n=100 pieces; ?per=3 per house.
export async function GET(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const n = Math.min(Number(req.nextUrl.searchParams.get('n') || 100), 300)
  const per = Number(req.nextUrl.searchParams.get('per') || 3)
  const { data, error } = await db().from('pieces')
    .select('manager_id, title, url, published_at, status, format, summary, asset_classes, sub_asset_classes, primary_theme, secondary_themes, subject_regions, vehicles, content_purpose, explicit_call, call_text, theme_candidate, word_count, flesch_reading_ease, disclaimer_share')
    .not('taxonomy_version', 'is', null).order('published_at', { ascending: false, nullsFirst: false }).limit(2000)
  if (error) return new Response(error.message, { status: 500 })
  const count = new Map<string, number>()
  const picked = (data || []).filter(p => { const c = count.get(p.manager_id) || 0; if (c >= per) return false; count.set(p.manager_id, c + 1); return true }).slice(0, n)
  const md = picked.map((p, i) => [
    `### ${i + 1}. ${p.title} — ${MANAGER_BY_ID.get(p.manager_id)?.name || p.manager_id}`,
    `${p.url}  `,
    `${(p.published_at || '').slice(0, 10)} · ${p.status} · ${p.format || ''} · ${p.word_count ?? '–'} words · ease ${p.flesch_reading_ease ?? '–'} · legal ${p.disclaimer_share != null ? Math.round(p.disclaimer_share * 100) + '%' : '–'}  `,
    `Summary: ${p.summary || '(none)'}  `,
    `Asset: ${(p.asset_classes || []).join(', ') || '–'} | Sub: ${(p.sub_asset_classes || []).join(', ') || '–'}  `,
    `Theme: ${p.primary_theme || '–'}${p.secondary_themes?.length ? ' + ' + p.secondary_themes.join(', ') : ''} | Regions: ${(p.subject_regions || []).join(', ') || '–'} | Vehicles: ${(p.vehicles || []).join(', ') || '–'}  `,
    `Purpose: ${p.content_purpose || '–'} | Call: ${p.explicit_call ? p.call_text : 'no'}${p.theme_candidate ? ' | Candidate: ' + p.theme_candidate : ''}`,
  ].join('\n')).join('\n\n')
  return new Response(`# Tagging sample (${picked.length} pieces, up to ${per} per house)\n\n${md}`, { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
