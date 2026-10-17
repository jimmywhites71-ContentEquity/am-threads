import { NextRequest } from 'next/server'
import { db, unauthorised } from '@/lib/db'
import { MANAGERS, SOURCES } from '@/lib/sources'
import { TAXONOMY_VERSION } from '@/lib/taxonomy'
import { spendSoFar } from '@/lib/spend'
import { SUMMARY_MODEL, TAGGER_MODEL, dailyCap, monthlyBudget } from '@/lib/usage'

export const maxDuration = 60

// A plain-text health report, posted to the "Pipeline status" issue by GitHub Actions and read by
// the weekly check-in: source health, the reading queue, tagging coverage, and pieces per manager.
export async function GET(req: NextRequest) {
  const denied = unauthorised(req); if (denied) return denied
  const sb = db()
  const count = async (table: string, f: (q: any) => any = q => q) => (await f(sb.from(table).select('*', { count: 'exact', head: true }))).count ?? 0

  const { data: sources } = await sb.from('sources').select('id, verified, last_run_at, last_found, last_error')
  const byId = new Map((sources || []).map(s => [s.id, s]))

  const [total, tagged, gated, thin, newQ, failed, skipped] = await Promise.all([
    count('pieces'),
    count('pieces', q => q.eq('taxonomy_version', TAXONOMY_VERSION)),
    count('pieces', q => q.eq('status', 'gated')),
    count('pieces', q => q.eq('status', 'thin')),
    count('editions', q => q.eq('status', 'new')),
    count('editions', q => q.eq('status', 'failed')),
    count('editions', q => q.eq('status', 'skipped')),
  ])
  const perManager = await Promise.all(MANAGERS.map(async m => ({ m, n: await count('pieces', q => q.eq('manager_id', m.id)), week: await count('pieces', q => q.eq('manager_id', m.id).gte('published_at', new Date(Date.now() - 7 * 864e5).toISOString())) })))
  const [withAsset, withTheme, withCall] = await Promise.all([
    count('pieces', q => q.eq('taxonomy_version', TAXONOMY_VERSION).neq('asset_classes', '{}')),
    count('pieces', q => q.eq('taxonomy_version', TAXONOMY_VERSION).not('primary_theme', 'is', null)),
    count('pieces', q => q.eq('taxonomy_version', TAXONOMY_VERSION).eq('explicit_call', true)),
  ])
  const { data: candidates } = await sb.from('theme_candidates').select('*').limit(10)
  const spend = await spendSoFar(sb)
  const pct = (a: number, b: number) => b ? `${Math.round((a / b) * 100)}%` : 'n/a'

  const lines = [
    `# AM Intelligence status (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
    '',
    `Pieces stored: ${total} (gated ${gated}, thin ${thin}). Reading queue: ${newQ} waiting, ${failed} failed, ${skipped} skipped as too old.`,
    `Tagged to taxonomy ${TAXONOMY_VERSION}: ${tagged} (${pct(tagged, total)}). Of those: with an asset class ${pct(withAsset, tagged)}, with a primary theme ${pct(withTheme, tagged)}, making an explicit call ${pct(withCall, tagged)}.`,
    '',
    '## Costs (Anthropic API, list prices)',
    `- Today (UTC): $${spend.dayUsd.toFixed(2)}; ${spend.taggedToday} of ${dailyCap()} pieces allowed today.`,
    `- This month: $${spend.monthUsd.toFixed(2)} of a $${monthlyBudget()} budget${spend.monthUsd >= monthlyBudget() ? ' — BUDGET REACHED, tagging paused until next month' : ''}.`,
    `- Models: summaries ${SUMMARY_MODEL()}, tagging ${TAGGER_MODEL()}. Limits are set in Vercel (MAX_PIECES_PER_DAY, MONTHLY_BUDGET_USD).`,
    '',
    '## Pieces by manager (all / last 7 days)',
    ...perManager.map(({ m, n, week }) => `- ${m.name}: ${n} / ${week}`),
    '',
    '## Sources',
    ...SOURCES.map(s => {
      const r = byId.get(s.id)
      const state = r?.last_error ? `FAILING: ${r.last_error}` : r?.last_run_at ? `found ${r.last_found ?? 0} on last run` : 'not run yet'
      return `- ${s.id} (${r?.verified || (s.verified ? s.verified : 'unverified')}): ${state}`
    }),
    '',
    '## Theme candidates proposed by the tagger',
    ...((candidates || []).length ? (candidates || []).map((c: any) => `- ${c.candidate}: ${c.pieces}`) : ['- none yet']),
  ]
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
