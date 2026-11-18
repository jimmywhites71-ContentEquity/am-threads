// Collects pieces from sites that refuse our plain reader but serve a normal browser (18 Nov:
// Blackstone and KKR, needed for the private credit work). Runs in GitHub Actions with Playwright.
// It respects each site's robots.txt for our bot, opens the insights listing pages, follows
// "load more" a few times, then reads each new article in the browser and stores it like the
// pipeline does; tagging then happens in the normal pipeline.
//
// Usage: npm run browser-collect -- --managers blackstone,kkr [--probe] [--max 120]
//   --probe lists what it would collect without storing anything.

import { chromium, type Page } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { UA } from '../lib/bot'
import { extractFromHtml } from '../lib/extract'
import { pieceRow } from '../lib/piece-row'
import { pieceKey } from '../lib/dedupe'

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const managers = (arg('--managers') || 'blackstone,kkr').split(',').map(s => s.trim())
const probe = process.argv.includes('--probe')
const maxPerHouse = Number(arg('--max') || 120)
const days = Number(arg('--days') || 365)
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://missing', process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing', { auth: { persistSession: false } })

interface Site { listings: string[]; include: RegExp; exclude?: RegExp; region?: string }
const SITES: Record<string, Site> = {
  blackstone: {
    listings: ['https://www.blackstone.com/insights/', 'https://www.blackstone.com/insights/?type=article', 'https://www.blackstone.com/news/'],
    include: /^https:\/\/www\.blackstone\.com\/insights\/article\/[^/?#]+\/?$/,
  },
  kkr: {
    listings: ['https://www.kkr.com/insights', 'https://www.kkr.com/insights/all-insights'],
    include: /^https:\/\/www\.kkr\.com\/insights\/(?!all-insights|private-credit$|topics?\/)[a-z0-9-]+\/?$/,
  },
}

const DISMISS = ['#onetrust-accept-btn-handler', 'button:has-text("Accept all")', 'button:has-text("Accept All")', 'button:has-text("I accept")', 'button:has-text("Agree")', 'button:has-text("Accept")', '[aria-label="Close"]']
async function dismiss(page: Page) {
  for (const sel of DISMISS) { try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 400 })) { await b.click({ timeout: 1500 }); await page.waitForTimeout(300) } } catch {} }
}

/** robots.txt rules for us: the group for our bot name if any, else the * group */
async function robotsAllows(page: Page, origin: string): Promise<(path: string) => boolean> {
  try {
    const res = await page.request.get(`${origin}/robots.txt`, { timeout: 15000 })
    if (!res.ok()) return () => true
    const lines = (await res.text()).split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
    const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
    let cur: (typeof groups)[number] | null = null
    for (const l of lines) {
      const [k, ...v] = l.split(':'); const key = k.trim().toLowerCase(); const val = v.join(':').trim()
      if (key === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur) } cur.agents.push(val.toLowerCase()) }
      else if (cur && (key === 'allow' || key === 'disallow') && val) cur.rules.push({ allow: key === 'allow', path: val })
    }
    const g = groups.find(x => x.agents.some(a => a.includes('amintelligencebot'))) || groups.find(x => x.agents.includes('*'))
    if (!g) return () => true
    return (path: string) => {
      let best: { allow: boolean; len: number } | null = null
      for (const r of g.rules) {
        const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
        if (re.test(path) && (!best || r.path.length > best.len)) best = { allow: r.allow, len: r.path.length }
      }
      return best ? best.allow : true
    }
  } catch { return () => true }
}

async function collectLinks(page: Page, site: Site): Promise<string[]> {
  const found = new Set<string>()
  for (const url of site.listings) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(3000); await dismiss(page)
      for (let k = 0; k < 8; k++) {
        const hrefs: string[] = await page.$$eval('a[href]', as => as.map(a => (a as HTMLAnchorElement).href))
        for (const h of hrefs) { const u = h.split('#')[0]; if (site.include.test(u) && !(site.exclude && site.exclude.test(u))) found.add(u.replace(/\/$/, '')) }
        // "Load more" / "Show more" buttons, else scroll
        const more = page.locator('button:has-text("Load more"), button:has-text("Load More"), button:has-text("Show more"), a:has-text("Load more"), a:has-text("Load More")').first()
        if (await more.isVisible({ timeout: 800 }).catch(() => false)) { await more.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(2500) }
        else { await page.mouse.wheel(0, 20000); await page.waitForTimeout(1500) }
      }
      console.log(`  listing ${url}: ${found.size} article links so far`)
    } catch (err: any) { console.log(`  listing ${url} failed: ${String(err?.message || err).slice(0, 120)}`) }
  }
  return Array.from(found)
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1366, height: 900 } })
  const oldest = Date.now() - days * 864e5
  for (const m of managers) {
    const site = SITES[m]
    if (!site) { console.log(`${m}: no browser recipe`); continue }
    console.log(`\n${m}`)
    const page = await ctx.newPage()
    const origin = new URL(site.listings[0]).origin
    const allowed = await robotsAllows(page, origin)
    const links = (await collectLinks(page, site)).filter(u => { const ok = allowed(new URL(u).pathname); if (!ok) console.log(`  robots.txt disallows ${u}`); return ok })
    console.log(`  ${links.length} article links allowed`)
    if (probe) { links.slice(0, 15).forEach(u => console.log(`   - ${u}`)); await page.close(); continue }

    const sourceId = `${m}-browser`
    await sb.from('sources').upsert({ id: sourceId, manager_id: m, name: 'Insights (read in a browser)', feed_url: site.listings[0], kind: 'browser', active: true }, { onConflict: 'id' })
    const { data: known } = await sb.from('editions').select('url').in('url', links)
    const seen = new Set((known || []).map(k => k.url))
    let stored = 0, old = 0, thin = 0, failed = 0
    for (const url of links.filter(u => !seen.has(u)).slice(0, maxPerHouse)) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(2500); await dismiss(page)
        const ex = extractFromHtml(await page.content(), url)
        if (ex.published_at && Date.parse(ex.published_at) < oldest) {
          old++
          await sb.from('editions').upsert({ url, source_id: sourceId, manager_id: m, region: site.region || 'Global', status: 'skipped', error: `published ${ex.published_at.slice(0, 10)}`, read_at: new Date().toISOString() }, { onConflict: 'url' })
          continue
        }
        const key = pieceKey(m, url, ex.canonical_url)
        const { data: existing } = await sb.from('pieces').select('id').eq('piece_key', key).maybeSingle()
        let id = existing?.id as string | undefined
        if (!id) {
          const { data: ins, error } = await sb.from('pieces').insert({ piece_key: key, ...pieceRow(m, ex), regions: [site.region || 'Global'], channels: [] }).select('id').single()
          if (error || !ins) throw new Error(error?.message || 'insert failed')
          id = ins.id
          await sb.from('piece_text').upsert({ piece_id: id, text: ex.text, disclaimer_text: ex.disclaimer_text, pdf_links: ex.pdf_links })
          stored++; if (ex.readability.word_count < 150) thin++
        }
        await sb.from('editions').upsert({ url, source_id: sourceId, manager_id: m, region: site.region || 'Global', piece_id: id, status: 'read', attempts: 1, read_at: new Date().toISOString() }, { onConflict: 'url' })
        await page.waitForTimeout(1200)   // gentle: one page at a time with a pause
      } catch (err: any) { failed++; if (failed <= 5) console.log(`  failed ${url}: ${String(err?.message || err).slice(0, 120)}`) }
    }
    console.log(`  stored ${stored} new pieces (${thin} thin), ${old} older than ${days} days, ${failed} failed`)
    await sb.from('sources').update({ last_run_at: new Date().toISOString(), last_found: links.length, last_error: null }).eq('id', sourceId)
    await page.close()
  }
  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
