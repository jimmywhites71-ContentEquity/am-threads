// Ideas & voice results: the scales built from the comparative judgements of one set.

import { db } from '@/lib/db'
import { managerName, type Question } from '@/lib/cj'
import { latestSetId, loadSet } from '@/lib/cj-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ideas & voice · AM Intelligence' }

const GROUPS: Record<string, string> = { production: 'Sonnet + team', sonnet: 'Sonnet', haiku: 'Haiku', human: 'Team only' }
const pct = (x: number | null | undefined) => x == null ? '–' : `${Math.round(x * 100)}%`
const two = (x: number | null | undefined) => x == null ? '–' : x.toFixed(2)

export default async function Results({ searchParams }: { searchParams: { set?: string; scale?: string; sort?: string } }) {
  const sb = db()
  const id = searchParams.set || await latestSetId(sb)
  const data = id ? await loadSet(sb, id) : null
  if (!data) return <div className="wrap"><style>{CSS}</style><h1>Ideas &amp; voice</h1><p>No judging set yet.</p></div>
  const { set, items, report: r, judgements } = data
  const groups = Object.keys(GROUPS).filter(g => r.scales[g])
  const scale = groups.includes(searchParams.scale || '') ? searchParams.scale! : groups[0]
  const sort: Question = searchParams.sort === 'writing' ? 'writing' : 'ideas'
  if (!scale) return <div className="wrap"><style>{CSS}</style><h1>{set.name}</h1><p>No judgements yet.</p></div>
  const S = r.scales[scale]
  const order = items.map((_: any, i: number) => i).sort((a: number, b: number) => S[sort].theta[b] - S[sort].theta[a])
  const human = judgements.filter(j => j.judge_kind === 'human')
  const ai = judgements.filter(j => j.judge_kind === 'ai')
  // One reason each piece won on, from the scale's judges
  const reasonFor = (n: number, q: Question) => {
    const js = judgements.filter(j => (q === 'ideas' ? j.ideas_winner : j.writing_winner) === n && (scale === 'human' ? j.judge_kind === 'human' : scale === 'haiku' ? /haiku/.test(j.judge) : scale === 'sonnet' ? /sonnet/.test(j.judge) : j.judge_kind === 'human' || /sonnet/.test(j.judge)))
    return (q === 'ideas' ? js.map(j => j.ideas_reason) : js.map(j => j.writing_reason)).filter(Boolean)[0] as string | undefined
  }
  const agree = r.humanAgreement.sonnet

  // Ideas (x) against writing (y): one dot per piece
  const W = 560, H = 360, P = 40
  const xs = S.ideas.theta, ys = S.writing.theta
  const [x0, x1] = [Math.min(...xs) - 0.3, Math.max(...xs) + 0.3], [y0, y1] = [Math.min(...ys) - 0.3, Math.max(...ys) + 0.3]
  const X = (v: number) => P + ((v - x0) / (x1 - x0)) * (W - P - 12), Y = (v: number) => H - P - ((v - y0) / (y1 - y0)) * (H - P - 12)
  const link = (patch: Record<string, string>) => `/judge/results?${new URLSearchParams({ set: set.id, scale, sort, ...patch })}`

  return (
    <div className="wrap"><style>{CSS}</style>
      <header>
        <h1>Ideas &amp; voice: {set.name}</h1>
        <p className="stats">{items.length} pieces from {new Set(items.map((i: any) => i.piece?.manager_id)).size} houses · {ai.length} AI judgements · {human.length} by the team ({ai.length + human.length ? pct(human.length / (ai.length + human.length)) : '–'}) · <a href={`/judge?set=${set.id}`}>judge pairs</a></p>
      </header>

      <section className="tiles">
        <Tile label="Reliability (ideas · writing)" value={`${two(S.ideas.reliability)} · ${two(S.writing.reliability)}`} note="0.7 or more is a dependable scale" />
        <Tile label="Sonnet agrees with the team" value={agree ? `${pct(agree.ideas.agree)} · ${pct(agree.writing.agree)}` : '–'} note={agree?.ideas.n ? `on ${agree.ideas.n} team judgements` : 'needs team judgements'} />
        <Tile label="Same winner both ways round" value={`${pct(r.orderConsistency.sonnet?.ideas)} · ${pct(r.orderConsistency.sonnet?.writing)}`} note="Sonnet; position should not matter" />
        <Tile label="Tracks length? (ideas · writing)" value={`${two(r.lengthCorrelation[scale]?.ideas)} · ${two(r.lengthCorrelation[scale]?.writing)}`} note="rank correlation with word count; near 0 is good" />
      </section>

      <nav className="tabs">
        Scale: {groups.map(g => <a key={g} className={g === scale ? 'on' : ''} href={link({ scale: g })}>{GROUPS[g]}</a>)}
        <span className="sep" />
        Rank by: {(['ideas', 'writing'] as Question[]).map(q => <a key={q} className={q === sort ? 'on' : ''} href={link({ sort: q })}>{q === 'ideas' ? 'Ideas' : 'Writing'}</a>)}
      </nav>

      <figure className="chart">
        <figcaption>Ideas against writing, one dot per piece ({GROUPS[scale]} scale, logits). Rank correlation {two(r.ideasWritingCorrelation[scale])}.</figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter of ideas score against writing score">
          <line x1={P} x2={W - 12} y1={Y(0)} y2={Y(0)} className="axis" /><line x1={X(0)} x2={X(0)} y1={12} y2={H - P} className="axis" />
          <text x={W - 12} y={H - 12} textAnchor="end" className="lab">more original ideas →</text>
          <text x={14} y={14} className="lab" transform={`rotate(90 14 14)`}>better writing →</text>
          {items.map((it: any, i: number) => (
            <g key={i} className="dot"><circle cx={X(xs[i])} cy={Y(ys[i])} r={10} className="hit" /><circle cx={X(xs[i])} cy={Y(ys[i])} r={4.5} />
              <title>{`${managerName(it.piece?.manager_id)}: ${it.piece?.title}\nIdeas ${xs[i].toFixed(2)} · Writing ${ys[i].toFixed(2)}`}</title></g>
          ))}
        </svg>
      </figure>

      <table>
        <thead><tr><th>#</th><th>Piece</th><th>Ideas</th><th>Writing</th><th>Words</th><th>Why it won (one judge's reason)</th></tr></thead>
        <tbody>
          {order.map((i: number, k: number) => {
            const it: any = items[i]
            return (
              <tr key={i}>
                <td>{k + 1}</td>
                <td><div className="house">{managerName(it.piece?.manager_id)}</div><a href={it.piece?.url} target="_blank" rel="noreferrer">{it.piece?.title}</a></td>
                <td className="num"><Bar v={S.ideas.theta[i]} se={S.ideas.se[i]} />{S.ideas.theta[i].toFixed(2)}</td>
                <td className="num"><Bar v={S.writing.theta[i]} se={S.writing.se[i]} />{S.writing.theta[i].toFixed(2)}</td>
                <td className="num">{it.word_count?.toLocaleString('en-GB')}</td>
                <td className="why">{reasonFor(i, sort) || '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="foot">Scores are Bradley-Terry estimates in logits, centred on 0: a piece 1 point higher wins about 73% of its comparisons. The bar shows the score with its 95% interval on a common −3 to +3 scale. House names were hidden from every judge.</p>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="tile"><div className="tl">{label}</div><div className="tv">{value}</div><div className="tn">{note}</div></div>
}
function Bar({ v, se }: { v: number; se: number }) {
  const x = (t: number) => Math.max(0, Math.min(100, ((t + 3) / 6) * 100))
  return <svg className="bar" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden><line x1={50} x2={50} y1={0} y2={10} className="mid" /><line x1={x(v - 1.96 * se)} x2={x(v + 1.96 * se)} y1={5} y2={5} className="ci" /><circle cx={x(v)} cy={5} r={2.6} /></svg>
}

const CSS = `
:root { --bg:#f6f5f1; --card:#fff; --ink:#1b1d21; --muted:#6b6f76; --line:#e3e1db; --accent:#1f4e79; --chip:#eef2f6; }
@media (prefers-color-scheme: dark) { :root { --bg:#141518; --card:#1c1e22; --ink:#ececec; --muted:#9a9ea6; --line:#2c2f35; --accent:#8db8e6; --chip:#252a31; } }
body { background: var(--bg) !important; color: var(--ink) !important; }
.wrap { max-width: 1240px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0; letter-spacing: -0.01em; }
.stats { color: var(--muted); font-size: 13px; margin: 6px 0 0; } .stats a, .tabs a, td a { color: var(--accent); }
.tiles { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0; }
.tile { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.tl { font-size: 12px; color: var(--muted); } .tv { font-size: 22px; font-weight: 600; margin: 4px 0; font-variant-numeric: tabular-nums; } .tn { font-size: 12px; color: var(--muted); }
.tabs { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; font-size: 13px; color: var(--muted); margin: 8px 0 14px; }
.tabs a { padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px; text-decoration: none; }
.tabs a.on { background: var(--ink); color: var(--bg); border-color: var(--ink); } .sep { width: 12px; }
.chart { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin: 0 0 18px; max-width: 620px; }
.chart figcaption { font-size: 12px; color: var(--muted); margin-bottom: 6px; } .chart svg { width: 100%; height: auto; }
.axis { stroke: var(--line); stroke-width: 1; } .lab { font-size: 11px; fill: var(--muted); }
.dot circle:not(.hit) { fill: var(--accent); stroke: var(--card); stroke-width: 2; } .dot .hit { fill: transparent; } .dot:hover circle:not(.hit) { fill: var(--ink); }
table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 12px; color: var(--muted); font-weight: 500; } .num { white-space: nowrap; font-variant-numeric: tabular-nums; }
.house { font-size: 11px; color: var(--muted); } td a { text-decoration: none; } td a:hover { text-decoration: underline; }
.why { color: var(--muted); max-width: 340px; }
.bar { width: 80px; height: 10px; vertical-align: middle; margin-right: 6px; } .bar .mid { stroke: var(--line); } .bar .ci { stroke: var(--muted); stroke-width: 1.5; } .bar circle { fill: var(--accent); }
.foot { font-size: 12px; color: var(--muted); margin-top: 12px; max-width: 760px; }
@media (max-width: 700px) { .why, th:nth-child(6) { display: none; } }
`
