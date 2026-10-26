// Screenshots of each piece: above the fold (1440×900) and full page, saved to the private
// "captures" storage bucket. Runs in GitHub Actions (Vercel's plan cannot run a browser).
// Usage: npm run capture -- --limit 60
//
// Cookie and investor-type pop-ups are dismissed where a common button is found; if a page still
// cannot be captured, the error is recorded and the feed falls back to the page's lead image.

import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { UA } from '../lib/bot'
import { extractFromHtml } from '../lib/extract'
import { pieceRow } from '../lib/piece-row'
import { judgeImagePath } from '../lib/cj'

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const limit = Number(arg('--limit') || 60)
const judgeSet = arg('--set')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://missing', process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing', { auth: { persistSession: false } })

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

// For comparative judgement: the page as a reader meets it, with the house's identity hidden as far
// as a screenshot allows (site header, navigation, logos, footer, cookie banners), as JPEGs:
// top.jpg (1280×800, the first screen) and page.jpg (the whole page, at most 6,000 pixels tall).
const HIDE = `header, nav, footer, [role=banner], [role=navigation], [role=contentinfo], [class*="logo" i], [id*="logo" i],
  [class*="cookie" i], [id*="cookie" i], [id*="onetrust" i], [class*="consent" i] { visibility: hidden !important; }`

// A screenshot is kept only if the page is the article itself: not a block page, an investor-type or
// location gate, or an empty shell, and showing most of the piece's title words. Otherwise the piece
// is judged on ideas and writing only.
const BAD_PAGE = /403 ERROR|Access Denied|Request blocked|Forbidden|Just a moment|verify you are (a )?human|select (your )?(location|country|investor type|role)|investor type|are you an? (professional|financial|institutional)|please confirm (that )?you are|page not found/i
function looksLikeArticle(text: string, title: string): string | null {
  if (text.replace(/\s+/g, ' ').length < 400) return 'almost no text on the page'
  const head = text.slice(0, 3000)
  if (BAD_PAGE.test(head)) return `gate or block page: "${(BAD_PAGE.exec(head) || [''])[0]}"`
  const words = Array.from(new Set(title.toLowerCase().match(/[a-z]{4,}/g) || []))
  if (words.length >= 2) {
    const body = text.toLowerCase()
    const found = words.filter(w => body.includes(w)).length
    if (found / words.length < 0.6) return `title words not on the page (${found} of ${words.length})`
  }
  return null
}

async function captureSet(setId: string, ctx: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext']>>) {
  const { data: items, error } = await sb.from('cj_items').select('n, piece_id, pieces(url, title)').eq('set_id', setId).order('n')
  if (error) throw error
  const force = process.argv.includes('--force')
  const { data: have } = await sb.storage.from('captures').list('judge', { limit: 10000 })
  const done = new Set((have || []).map(f => f.name))
  let ok = 0, failed = 0, skipped = 0
  for (const it of items || []) {
    const pc = (Array.isArray((it as any).pieces) ? (it as any).pieces[0] : (it as any).pieces) || {}
    const url = pc.url as string, title = String(pc.title || '')
    if (!force && done.has(it.piece_id)) { skipped++; continue }
    const page = await ctx.newPage()
    try {
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2500)
      await dismiss(page)
      const problem = looksLikeArticle(await page.evaluate(() => document.body?.innerText || ''), title)
      if (problem) throw new Error(problem)
      // Investor-type, location and cookie pop-ups: the article is already in the page beneath them, so
      // hide any fixed layer that covers a quarter of the screen or more, and let the page scroll again
      const clearOverlays = () => page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
          const cs = getComputedStyle(el)
          if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
          const r = el.getBoundingClientRect()
          if (Math.min(r.width, vw) * Math.min(r.height, vh) > 0.25 * vw * vh) el.style.setProperty('display', 'none', 'important')
        }
        for (const el of [document.documentElement, document.body]) { el.style.setProperty('overflow', 'auto', 'important'); el.style.setProperty('filter', 'none', 'important') }
      })
      await clearOverlays()
      // The headline must be visible and on top: otherwise the page is still covered or is not the article
      const words = Array.from(new Set(title.toLowerCase().match(/[a-z]{4,}/g) || []))
      const headline = await page.evaluate((words: string[]) => {
        const heads = Array.from(document.querySelectorAll<HTMLElement>('h1, h2'))
        // The headline that matches the stored title, else the page's first visible main heading
        // (stored titles sometimes differ from the on-page headline)
        const h = heads.find(x => { const t = (x.innerText || '').toLowerCase(); return words.length && words.filter(w => t.includes(w)).length / words.length >= 0.6 })
          || heads.find(x => x.tagName === 'H1' && x.getBoundingClientRect().height > 0)
        if (!h) return 'no headline on the page'
        h.scrollIntoView({ block: 'center' })
        const r = h.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + Math.min(r.width, 40) / 2, r.top + r.height / 2)
        window.scrollTo(0, 0)
        return top && (h.contains(top) || top.contains(h)) ? null : 'headline covered by another layer'
      }, words)
      if (headline) throw new Error(headline)
      const style = await page.addStyleTag({ content: HIDE })
      await page.waitForTimeout(300)
      let top = await page.screenshot({ type: 'jpeg', quality: 72 })
      // Hiding the site's furniture can hide everything on some sites: then take it as it is
      if (top.length < 15000) { await style.evaluate((el: any) => el.remove()); await page.waitForTimeout(300); top = await page.screenshot({ type: 'jpeg', quality: 72 }) }
      if (top.length < 15000) throw new Error('blank page')
      const h = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 6000)
      await page.setViewportSize({ width: 1280, height: h })
      await page.waitForTimeout(500)
      const whole = await page.screenshot({ type: 'jpeg', quality: 60 })
      for (const [kind, img] of [['top', top], ['page', whole]] as const) {
        const { error: upErr } = await sb.storage.from('captures').upload(judgeImagePath(it.piece_id, kind), img, { contentType: 'image/jpeg', upsert: true })
        if (upErr) throw new Error(`upload: ${upErr.message}`)
      }
      ok++
    } catch (err: any) {
      failed++
      console.log(`No screenshot for ${url}: ${String(err?.message || err).slice(0, 160)}`)
      await sb.storage.from('captures').remove([judgeImagePath(it.piece_id, 'top'), judgeImagePath(it.piece_id, 'page')])
    } finally { await page.close() }
  }
  console.log(`Judging screenshots for ${setId}: ${ok} taken, ${skipped} already there, ${failed} without a usable screenshot`)
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('GitHub secrets NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed for screenshots')
  // The private "captures" bucket: created here if it does not exist yet
  const { error: getErr } = await sb.storage.getBucket('captures')
  if (getErr) {
    const { error: createErr } = await sb.storage.createBucket('captures', { public: false })
    if (createErr && !/already exists/i.test(createErr.message)) throw new Error(`Could not create the "captures" bucket: ${createErr.message}`)
    console.log('Created the private "captures" storage bucket')
  }
  // Pieces read but not yet captured, newest first
  const { data: done } = await sb.from('captures').select('piece_id').eq('kind', 'above_fold').limit(100000)
  const have = new Set((done || []).map(d => d.piece_id))
  const { data: pieces, error } = await sb.from('pieces').select('id, url, manager_id').eq('status', 'read').order('published_at', { ascending: false }).limit(limit * 4)
  if (error) throw error
  const todo = (pieces || []).filter(p => !have.has(p.id) && !/\.pdf(\?|$)/i.test(p.url)).slice(0, limit)
  console.log(`Capturing ${todo.length} pieces`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  if (judgeSet) { await captureSet(judgeSet, ctx); await browser.close(); return }
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
      // clip and fullPage cannot be combined: size the viewport to the page (capped), then take it
      await page.setViewportSize({ width: 1440, height: h })
      const full = await page.screenshot({ type: 'png' })
      await upload(`${p.manager_id}/${p.id}/full_page.png`, full)
      await sb.from('captures').upsert({ piece_id: p.id, kind: 'full_page', storage_path: `${p.manager_id}/${p.id}/full_page.png`, width: 1440, height: h, error: null }, { onConflict: 'piece_id,kind' })
      ok++
    } catch (err: any) {
      failed++
      if (failed <= 5) console.log(`Failed ${p.url}: ${String(err?.message || err).slice(0, 160)}`)
      await sb.from('captures').upsert({ piece_id: p.id, kind: 'above_fold', storage_path: null, error: String(err?.message || err).slice(0, 200) }, { onConflict: 'piece_id,kind' })
    } finally { await page.close() }
  }
  // Second pass: pages that build their text in the browser came back "thin" (under 150 words) to
  // the plain reader. Read them again once the browser has rendered them; if there is now real
  // text, store the new measures and clear the tags so the next pipeline run summarises and tags them.
  const thinLimit = Number(process.env.THIN_LIMIT || 40)
  const { data: thin } = await sb.from('pieces').select('id, url, manager_id').eq('status', 'thin').not('url', 'ilike', '%.pdf%').order('updated_at', { ascending: true }).limit(thinLimit)
  let rendered = 0, stillThin = 0
  for (const p of thin || []) {
    const page = await ctx.newPage()
    try {
      await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => page.waitForTimeout(3000))
      await dismiss(page)
      const extracted = extractFromHtml(await page.content(), p.url)
      if (extracted.readability.word_count >= 150 && !extracted.gated) {
        const row = pieceRow(p.manager_id, extracted)
        await sb.from('pieces').update({ ...row, url: p.url, summary: null, taxonomy_version: null }).eq('id', p.id)
        await sb.from('piece_text').upsert({ piece_id: p.id, text: extracted.text, disclaimer_text: extracted.disclaimer_text, pdf_links: extracted.pdf_links })
        rendered++
      } else {
        // Touch it so the next run tries other thin pages first
        await sb.from('pieces').update({ updated_at: new Date().toISOString() }).eq('id', p.id)
        stillThin++
      }
    } catch { stillThin++ } finally { await page.close() }
  }
  console.log(`Thin pages re-read in the browser: ${rendered} now readable, ${stillThin} still thin`)

  await browser.close()
  await sb.from('runs').insert({ step: 'capture', finished_at: new Date().toISOString(), stats: { taken: todo.length, ok, failed, rendered, stillThin } })
  console.log(`Done: ${ok} captured, ${failed} failed`)
}

main().catch(err => { console.error(err); process.exit(1) })
