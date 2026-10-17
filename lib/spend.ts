import type { db } from './db'

/** This UTC day's and month's spend so far, from the runs table */
export async function spendSoFar(sb: ReturnType<typeof db>) {
  const now = new Date()
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data } = await sb.from('runs').select('started_at, stats').in('step', ['classify', 'compare']).gte('started_at', month).limit(10000)
  let monthUsd = 0, dayUsd = 0
  for (const r of data || []) {
    const c = Number((r.stats as any)?.cost_usd || 0)
    monthUsd += c
    if (r.started_at >= day) dayUsd += c
  }
  const { count: taggedToday } = await sb.from('pieces').select('id', { count: 'exact', head: true }).gte('tagged_at', day)
  return { dayUsd, monthUsd, taggedToday: taggedToday || 0 }
}
