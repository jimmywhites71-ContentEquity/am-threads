import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/** Server-side client with the service key. Never sent to a browser. */
export function db(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

/** Pipeline routes are called by GitHub Actions with PIPELINE_API_KEY; anything else is refused */
export function unauthorised(req: NextRequest): NextResponse | null {
  const key = process.env.PIPELINE_API_KEY
  if (!key || req.headers.get('authorization') !== `Bearer ${key}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

export async function logRun(step: string, startedAt: number, stats: Record<string, unknown>) {
  try { await db().from('runs').insert({ step, started_at: new Date(startedAt).toISOString(), finished_at: new Date().toISOString(), stats }) } catch {}
}
