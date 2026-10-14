// Screenshots of each piece: above the fold (1440×900) and full page, saved to the private
// "captures" storage bucket. Runs in GitHub Actions (Vercel's plan cannot run a browser).
// Usage: npm run capture -- --limit 60
//
// Cookie and investor-type pop-ups are dismissed where a common button is found; if a page still
// cannot be captured, the error is recorded and the feed falls back to the page's lead image.

import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { UA } from '../lib/bot'

const limit = Number(process.argv[process.argv.indexOf('--limit') + 1] || 60)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const DISMISS = [
  'button:has-text("Accept all")', 'button:has-text("Accept All")', 'button:has-text("Accept cookies")', 'button:has-text("I accept")',
  'button:has-text("Allow all")', 'button:has-text("Agree")', '#onetrust-accept-btn-handler', 'button:has-text("Reject all")',
  'button:has-text("Close")', '[aria-label="Close"]',
]

async function dismiss(page: Page) {
  for (const sel of DISMISS) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 500 })) { await b.click({ timeout: 1500 }); await page.waitForTimeout(400) } } catch {}
  }
}

async function upload(path: string, png: Buffer) {
  const { error } = await sb.storage.from('captures').upload(path, png, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`upload: ${error.message}`)
}

async function main() {
  // Pieces read but not yet captured, newest first
  const { data: done } = await sb.from('captures').select('piece_id').eq('kind', 'above_fold').limit(100000)
  const have = new Set((done || []).map(d => d.piece_id))
  const { data: pieces, error } = await sb.from('pieces').select('id, url, manager_id').eq('status', 'read').order('published_at', { ascending: false }).limit(limit * 4)
  if (error) throw error
  const todo = (pieces || []).filter(p => !have.has(p.id) && !/\.pdf(\?|$)/i.test(p.url)).slice(0, limit)
  console.log(`Capturing ${todo.length} pieces`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  let ok = 0, failed = 0
  for (const p of todo) {
    const page = await ctx.newPage()
    try {
      await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2500)
      await dismiss(page)
      const fold = await page.screenshot({ type: 'png' })
      await upload(`${p.manager_id}/${p.id}/above_fold.png`, fold)
      await sb.from('captures').upsert({ piece_id: p.id, kind: 'above_fold', storage_path: `${p.manager_id}/${p.id}/above_fold.png`, width: 1440, height: 900, error: null }, { onConflict: 'piece_id,kind' })
      // Full page, capped so one very long page cannot fill the bucket
      const h = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 12000)
      const full = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1440, height: h }, fullPage: true })
      await upload(`${p.manager_id}/${p.id}/full_page.png`, full)
      await sb.from('captures').upsert({ piece_id: p.id, kind: 'full_page', storage_path: `${p.manager_id}/${p.id}/full_page.png`, width: 1440, height: h, error: null }, { onConflict: 'piece_id,kind' })
      ok++
    } catch (err: any) {
      failed++
      await sb.from('captures').upsert({ piece_id: p.id, kind: 'above_fold', storage_path: null, error: String(err?.message || err).slice(0, 200) }, { onConflict: 'piece_id,kind' })
    } finally { await page.close() }
  }
  await browser.close()
  await sb.from('runs').insert({ step: 'capture', finished_at: new Date().toISOString(), stats: { taken: todo.length, ok, failed } })
  console.log(`Done: ${ok} captured, ${failed} failed`)
}

main().catch(err => { console.error(err); process.exit(1) })
