import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readability, syllables } from '../lib/readability'
import { extractFromHtml, inferFormat } from '../lib/extract'
import { pieceKey, slugOf } from '../lib/dedupe'
import { parseSitemapIndex } from '../lib/collect'
import { MANAGERS, SOURCES, editionOf, sourcesForWave } from '../lib/sources'
import { ROSTER } from '../lib/roster'
import { normaliseTags } from '../lib/classifier'
import { ALL_THEMES, ASSET_CLASSES, REGION_FACETS, SUB_ASSET_KEYS, THEME_PARENTS, VEHICLE_FACETS } from '../lib/taxonomy'

test('taxonomy has the agreed shape', () => {
  assert.equal(THEME_PARENTS.length, 12)
  assert.equal(ALL_THEMES.length, new Set(ALL_THEMES).size, 'theme names are unique')
  assert.equal(ALL_THEMES.length, 69)
  assert.equal(REGION_FACETS.length, 12)
  assert.equal(VEHICLE_FACETS.length, 7)
  assert.equal(ASSET_CLASSES.length, 6)
  assert.equal(SUB_ASSET_KEYS.length, 38)
  for (const t of ['China', 'Emerging Markets', 'Value', 'Growth', 'Quality', 'Quant & Factors', 'ETFs', 'Thematic Funds', 'Water', 'Space', 'Cybersecurity', 'Latin America', 'Middle East', 'Korea & Taiwan']) assert.ok(ALL_THEMES.includes(t), t)
})

test('syllables and readability are in sensible ranges', () => {
  assert.equal(syllables('cat'), 1)
  assert.equal(syllables('inflation'), 3)
  const plain = 'The cat sat on the mat. It was a warm day. The sun was out. '.repeat(10)
  const hard = 'Notwithstanding considerable macroeconomic uncertainty, institutional allocators increasingly prioritise diversification across heterogeneous, idiosyncratic opportunities characterised by asymmetric convexity. '.repeat(6)
  const a = readability(plain), b = readability(hard)
  assert.ok(a.flesch_reading_ease! > 80, `plain ${a.flesch_reading_ease}`)
  assert.ok(b.flesch_reading_ease! < 20, `hard ${b.flesch_reading_ease}`)
  assert.ok(b.fk_grade! > a.fk_grade!)
})

test('passive voice, acronyms and figures are counted', () => {
  const text = 'Rates were cut by the Fed. We expect spreads to widen by 50bps. The CLO market (collateralised loan obligations) grew 12%. NFCI readings rose. ' + 'Investors bought bonds this week as yields rose. '.repeat(12)
  const r = readability(text)
  assert.ok(r.passive_share! > 0)
  assert.ok(r.unexplained_acronyms.includes('NFCI'))
  assert.ok(!r.unexplained_acronyms.includes('CLO'), 'explained in brackets')
  assert.ok(r.figures_per_1000! > 0)
})

const PAGE = `<!doctype html><html><head>
<title>Why we are overweight duration | Example AM</title>
<meta property="og:title" content="Why we are overweight duration | Example AM">
<meta property="og:image" content="https://example.com/img/lead.jpg">
<link rel="canonical" href="https://example.com/us/en/insights/why-we-are-overweight-duration/">
<script type="application/ld+json">{"@type":"Article","headline":"Why we are overweight duration","datePublished":"2026-10-08T09:00:00Z","author":{"@type":"Person","name":"Jane Smith"}}</script>
</head><body>
<header><nav><a href="/">Home</a></nav></header>
<div class="cookie-banner"><p>We use cookies to improve your experience on our site.</p></div>
<main><article>
<h1>Why we are overweight duration</h1>
<div class="key-takeaways"><h2>Key takeaways</h2><ul><li>Yields are at multidecade highs and offer value.</li><li>We prefer the five to ten year part of the curve.</li></ul></div>
<p>Treasury yields have risen 112 basis points since the end of 2025. We think the move has gone far enough, and we are adding duration in portfolios.</p>
<h2>What has changed</h2>
<p>Inflation has eased to 3.4% while growth is slowing. Our models suggest the term premium is now above its long-run average.</p>
<figure><img src="https://example.com/img/chart-yields.png" width="800" alt="Chart: 10-year yield"><figcaption>Exhibit 1: US 10-year yield. Source: Bloomberg.</figcaption></figure>
<iframe src="https://datawrapper.dwcdn.net/abc/1/"></iframe>
<p>We see the risk of further losses as limited relative to the income on offer.</p>
<p><a href="/contact">Contact us</a> to discuss positioning. <a href="/docs/full-paper.pdf">Download the full paper</a></p>
<h2>Important information</h2>
<p>Past performance is not a reliable indicator of future results. The value of investments and the income from them may go down as well as up.</p>
<p>This material is for professional investors only and is issued by Example AM.</p>
</article></main>
<footer><p>© 2026 Example AM</p></footer>
</body></html>`

test('a page is read into identity, body, disclaimers, structure and visuals', () => {
  const p = extractFromHtml(PAGE, 'https://example.com/gb/en/insights/why-we-are-overweight-duration/')
  assert.equal(p.title, 'Why we are overweight duration')
  assert.equal(p.published_at, '2026-10-08T09:00:00.000Z')
  assert.deepEqual(p.authors, ['Jane Smith'])
  assert.equal(p.canonical_url, 'https://example.com/us/en/insights/why-we-are-overweight-duration/')
  assert.ok(p.text.includes('112 basis points'))
  assert.ok(!p.text.includes('cookies'), 'cookie banner removed')
  assert.ok(!p.text.includes('Past performance'), 'disclaimer kept out of the body')
  assert.ok(p.disclaimer_text.includes('Past performance'))
  assert.ok(p.disclaimer_share > 0.1 && p.disclaimer_share < 0.6, String(p.disclaimer_share))
  assert.equal(p.structure.key_takeaways, true)
  assert.equal(p.structure.named_author, true)
  assert.equal(p.structure.call_to_action, true)
  assert.ok(p.structure.headings >= 2)
  assert.equal(p.visual.lead_image, true)
  assert.ok(p.visual.charts >= 2, `charts ${p.visual.charts}`)
  assert.deepEqual(p.visual.chart_hosts, ['datawrapper'])
  assert.equal(p.visual.interactive, true)
  assert.deepEqual(p.pdf_links, ['https://example.com/docs/full-paper.pdf'])
  assert.equal(p.format, 'article')
})

test('format is inferred from address, title and length', () => {
  const none = { video_embed: false, audio_embed: false }
  assert.equal(inferFormat('https://x.com/insights/podcasts/ep-12', 'Ep 12', 300, none, false), 'podcast')
  assert.equal(inferFormat('https://x.com/insights/2027-outlook', 'Investment Outlook 2027', 4000, none, false), 'outlook')
  assert.equal(inferFormat('https://x.com/insights/note', 'A note', 3500, none, false), 'research paper')
  assert.equal(inferFormat('https://x.com/insights/clip', 'Clip', 120, { video_embed: true, audio_embed: false }, false), 'video')
})

test('regional editions of one piece share a key', () => {
  const us = 'https://am.jpmorgan.com/us/en/asset-management/adv/insights/market-insights/when-will-higher-treasury-yields-pressure-equities/'
  const gb = 'https://am.jpmorgan.com/gb/en/asset-management/liq/insights/market-insights/when-will-higher-treasury-yields-pressure-equities/'
  assert.equal(pieceKey('jpmam', us), pieceKey('jpmam', gb))
  assert.notEqual(slugOf('https://x.com/insights/2026/outlook'), slugOf('https://x.com/insights/2027/outlook'))
})

test('region and channel come from the address', () => {
  assert.deepEqual(editionOf('jpmam', 'https://am.jpmorgan.com/gb/en/asset-management/liq/insights/x/'), { region: 'UK', channel: 'institutional' })
  assert.deepEqual(editionOf('jpmam', 'https://am.jpmorgan.com/us/en/asset-management/adv/insights/x/'), { region: 'US', channel: 'wholesale' })
  assert.deepEqual(editionOf('schroders', 'https://www.schroders.com/en-gb/uk/institutional/insights/x/'), { region: 'UK', channel: 'institutional' })
  assert.deepEqual(editionOf('aqr', 'https://www.aqr.com/Insights/Research/x'), { region: 'Global', channel: 'all' })
})

test('sitemap indexes are read', () => {
  const xml = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://x.com/a.xml</loc><lastmod>2026-10-01</lastmod></sitemap><sitemap><loc>https://x.com/b.xml</loc></sitemap></sitemapindex>`
  const kids = parseSitemapIndex(xml)
  assert.equal(kids.length, 2)
  assert.equal(kids[0].loc, 'https://x.com/a.xml')
  assert.equal(parseSitemapIndex('<urlset></urlset>').length, 0)
})

test('tags outside the lists are dropped, and Quality is equities only', () => {
  const credit = normaliseTags({
    asset_classes: ['Fixed Income & Credit', 'Bananas'], sub_asset_classes: ['Fixed Income & Credit › High yield', 'Equities › US'],
    primary_theme: 'Quality', secondary_themes: ['Credit Conditions & Defaults', 'Made Up'], regions: ['US', 'Atlantis'], vehicles: [],
    content_purpose: 'house view', explicit_call: true, call_text: 'Prefer high yield over IG',
  })
  assert.deepEqual(credit.asset_classes, ['Fixed Income & Credit'])
  assert.deepEqual(credit.sub_asset_classes, ['Fixed Income & Credit › High yield'])
  assert.equal(credit.primary_theme, 'Credit Conditions & Defaults')
  assert.deepEqual(credit.secondary_themes, [])
  assert.deepEqual(credit.regions, ['US'])
  assert.equal(credit.explicit_call, true)

  const eq = normaliseTags({ asset_classes: ['Equities'], primary_theme: 'Quality', secondary_themes: ['Value'] })
  assert.equal(eq.primary_theme, 'Quality')
  assert.deepEqual(eq.secondary_themes, ['Value'])
})

test('the roster covers ranks 1-100 and every tracked house exists', () => {
  const ranks = ROSTER.filter(r => r.rank !== null).map(r => r.rank)
  assert.deepEqual(ranks, Array.from({ length: 100 }, (_, i) => i + 1))
  const ids = new Set(MANAGERS.map(m => m.id))
  assert.equal(ids.size, MANAGERS.length, 'house ids unique')
  for (const r of ROSTER) for (const h of r.houses) assert.ok(ids.has(h), `${r.group} -> ${h}`)
  for (const m of MANAGERS) assert.ok(ROSTER.some(r => r.houses.includes(m.id)), `${m.id} is on the roster`)
  for (const m of MANAGERS) assert.ok(SOURCES.some(s => s.manager === m.id), `${m.id} has a source`)
  for (const r of ROSTER) if (r.status === 'excluded') assert.ok(r.note, `${r.group} exclusion has a reason`)
  assert.ok(sourcesForWave(1).length > 50)
  assert.ok(sourcesForWave(2).length >= 10)
})

test('generic address rules give region and channel', () => {
  assert.deepEqual(editionOf('invesco', 'https://www.invesco.com/uk/en/institutional/insights/x.html'), { region: 'UK', channel: 'institutional' })
  assert.deepEqual(editionOf('troweprice', 'https://www.troweprice.com/financial-intermediary/uk/en/insights/articles/x.html'), { region: 'UK', channel: 'wholesale' })
  assert.deepEqual(editionOf('franklin', 'https://www.franklintempleton.com/articles/2026/x'), { region: 'Global', channel: 'all' })
  assert.deepEqual(editionOf('nb', 'https://www.nb.com/en/us/insights/x'), { region: 'US', channel: 'all' })
})
