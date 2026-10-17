// First browsing view (interim): the latest pieces with filters. The designed feed, manager
// profiles, compare and white-space views come in Phase 5.

import { db } from '@/lib/db'
import { MANAGERS, MANAGER_BY_ID } from '@/lib/sources'
import { ASSET_CLASS_NAMES, FORMATS, THEME_PARENTS } from '@/lib/taxonomy'

export const dynamic = 'force-dynamic'

type Search = { manager?: string; asset?: string; theme?: string; format?: string; q?: string; page?: string }
const PER_PAGE = 60

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'undated'
}
function ease(score: number | null) {
  if (score == null) return null
  const label = score >= 60 ? 'plain' : score >= 40 ? 'fairly hard' : score >= 25 ? 'hard' : 'very hard'
  return `${Math.round(score)} · ${label}`
}

export default async function Feed({ searchParams }: { searchParams: Search }) {
  const sb = db()
  const page = Math.max(1, Number(searchParams.page || 1))
  let q = sb.from('pieces')
    .select('id, manager_id, title, url, published_at, summary, format, word_count, reading_minutes, flesch_reading_ease, image_url, asset_classes, sub_asset_classes, primary_theme, secondary_themes, subject_regions, status, visual, disclaimer_share', { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)
  if (searchParams.manager) q = q.eq('manager_id', searchParams.manager)
  if (searchParams.asset) q = q.contains('asset_classes', [searchParams.asset])
  if (searchParams.theme) q = q.or(`primary_theme.eq.${searchParams.theme},secondary_themes.cs.{"${searchParams.theme}"},subject_regions.cs.{"${searchParams.theme}"}`)
  if (searchParams.format) q = q.eq('format', searchParams.format)
  if (searchParams.q) q = q.ilike('title', `%${searchParams.q.replace(/[%_,()]/g, ' ')}%`)
  const { data: pieces, count, error } = await q

  const [{ count: total }, { count: tagged }, { count: queued }] = await Promise.all([
    sb.from('pieces').select('id', { count: 'exact', head: true }),
    sb.from('pieces').select('id', { count: 'exact', head: true }).not('taxonomy_version', 'is', null),
    sb.from('editions').select('url', { count: 'exact', head: true }).eq('status', 'new'),
  ])

  const link = (patch: Partial<Search>) => {
    const p = new URLSearchParams(Object.entries({ ...searchParams, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][])
    return `/feed${p.toString() ? `?${p}` : ''}`
  }
  const pages = Math.ceil((count || 0) / PER_PAGE)

  return (
    <div className="wrap">
      <style>{CSS}</style>
      <header>
        <h1>AM Intelligence</h1>
        <p className="stats">{total ?? 0} pieces · {tagged ?? 0} tagged · {queued ?? 0} waiting to be read</p>
      </header>

      <form className="filters" action="/feed">
        <input name="q" placeholder="Search titles" defaultValue={searchParams.q || ''} />
        <select name="manager" defaultValue={searchParams.manager || ''}>
          <option value="">All managers</option>
          {[...MANAGERS].sort((a, b) => a.name.localeCompare(b.name)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select name="asset" defaultValue={searchParams.asset || ''}>
          <option value="">All asset classes</option>
          {ASSET_CLASS_NAMES.map(a => <option key={a}>{a}</option>)}
        </select>
        <select name="theme" defaultValue={searchParams.theme || ''}>
          <option value="">All themes</option>
          {THEME_PARENTS.map(p => <optgroup key={p.name} label={p.name}>{p.children.map(c => <option key={c.name}>{c.name}</option>)}</optgroup>)}
        </select>
        <select name="format" defaultValue={searchParams.format || ''}>
          <option value="">All formats</option>
          {FORMATS.map(f => <option key={f}>{f}</option>)}
        </select>
        <button type="submit">Filter</button>
        <a className="clear" href="/feed">Clear</a>
      </form>

      {error && <p className="empty">Could not read the database: {error.message}</p>}
      {!error && !pieces?.length && <p className="empty">Nothing here yet. Pieces appear as the pipeline reads them.</p>}

      <p className="count">{count ?? 0} matching</p>
      <ul className="grid">
        {(pieces || []).map(p => {
          const tags = [...(p.asset_classes || []), p.primary_theme, ...(p.secondary_themes || []), ...(p.subject_regions || [])].filter(Boolean) as string[]
          const v = (p.visual || {}) as { charts?: number; images?: number }
          return (
            <li key={p.id} className="card">
              {p.image_url ? <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className="noimg">{MANAGER_BY_ID.get(p.manager_id)?.name}</div>}
              <div className="body">
                <div className="meta">
                  <a href={link({ manager: p.manager_id })}>{MANAGER_BY_ID.get(p.manager_id)?.name || p.manager_id}</a>
                  <span>{fmtDate(p.published_at)}</span>
                </div>
                <h2><a href={p.url} target="_blank" rel="noreferrer">{p.title || p.url}</a></h2>
                {p.summary && <p className="summary">{p.summary}</p>}
                <div className="badges">
                  {p.status === 'gated' ? <span className="badge muted">headline only</span> : <>
                    {p.format && <span className="badge">{p.format}</span>}
                    {p.reading_minutes != null && <span className="badge">{p.reading_minutes} min</span>}
                    {ease(p.flesch_reading_ease) && <span className="badge" title="Flesch reading ease (higher is plainer)">{ease(p.flesch_reading_ease)}</span>}
                    {v.charts ? <span className="badge">{v.charts} charts</span> : null}
                    {p.disclaimer_share ? <span className="badge" title="Share of the page that is disclaimer">{Math.round(p.disclaimer_share * 100)}% legal</span> : null}
                  </>}
                </div>
                {tags.length > 0 && <div className="tags">{tags.map(t => <a key={t} href={link({ theme: ASSET_CLASS_NAMES.includes(t) ? undefined : t, asset: ASSET_CLASS_NAMES.includes(t) ? t : searchParams.asset })}>{t}</a>)}</div>}
              </div>
            </li>
          )
        })}
      </ul>
      {pages > 1 && <nav className="pager">
        {page > 1 && <a href={`${link({})}${link({}).includes('?') ? '&' : '?'}page=${page - 1}`}>← Newer</a>}
        <span>Page {page} of {pages}</span>
        {page < pages && <a href={`${link({})}${link({}).includes('?') ? '&' : '?'}page=${page + 1}`}>Older →</a>}
      </nav>}
    </div>
  )
}

const CSS = `
:root { --bg:#f6f5f1; --card:#fff; --ink:#1b1d21; --muted:#6b6f76; --line:#e3e1db; --accent:#1f4e79; --chip:#eef2f6; }
@media (prefers-color-scheme: dark) { :root { --bg:#141518; --card:#1c1e22; --ink:#ececec; --muted:#9a9ea6; --line:#2c2f35; --accent:#8db8e6; --chip:#252a31; } }
body { background: var(--bg) !important; color: var(--ink) !important; }
.wrap { max-width: 1240px; margin: 0 auto; padding: 24px 16px 64px; }
header { display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; }
h1 { font-size: 22px; margin: 0; letter-spacing: -0.01em; }
.stats, .count { color: var(--muted); font-size: 13px; margin: 4px 0; }
.filters { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 8px; }
.filters input, .filters select, .filters button { font: inherit; font-size:14px; padding:7px 10px; border:1px solid var(--line); border-radius:6px; background: var(--card); color: var(--ink); }
.filters input { flex: 1 1 200px; }
.filters button { background: var(--accent); color: #fff; border-color: var(--accent); cursor:pointer; }
.clear { align-self:center; font-size:13px; color: var(--muted); }
.grid { list-style:none; padding:0; margin:0; display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px; }
.card { background: var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; }
.card img, .noimg { width:100%; aspect-ratio: 16/9; object-fit: cover; display:block; background: var(--chip); }
.noimg { display:flex; align-items:center; justify-content:center; color: var(--muted); font-size: 13px; padding: 8px; text-align:center; }
.body { padding: 12px 14px 14px; display:flex; flex-direction:column; gap:8px; }
.meta { display:flex; justify-content:space-between; gap:8px; font-size:12px; color: var(--muted); }
.meta a { color: var(--accent); text-decoration:none; font-weight:600; }
h2 { font-size:15px; line-height:1.35; margin:0; }
h2 a { color: var(--ink); text-decoration:none; }
h2 a:hover { text-decoration: underline; }
.summary { font-size:13px; line-height:1.45; color: var(--ink); opacity: .85; margin:0; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient: vertical; overflow:hidden; }
.badges, .tags { display:flex; flex-wrap:wrap; gap:6px; }
.badge { font-size:11px; padding:2px 7px; border-radius:999px; border:1px solid var(--line); color: var(--muted); }
.badge.muted { font-style: italic; }
.tags a { font-size:11px; padding:2px 7px; border-radius:4px; background: var(--chip); color: var(--ink); text-decoration:none; }
.empty { padding: 32px 0; color: var(--muted); }
.pager { display:flex; justify-content:center; gap:16px; margin-top:24px; font-size:14px; }
.pager a { color: var(--accent); }
`
