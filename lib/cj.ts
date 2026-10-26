// Comparative judgement: the Ideas & voice measures (pilot, 26 Oct 2026).
//
// Following No More Marking's method (Daisy Christodoulou): judges never score a piece on its own.
// They see two pieces side by side and say which is better, on two questions:
//   ideas   – which offers the more original and valuable thinking
//   writing – which is better written
// A Bradley-Terry model turns many such choices into a scale: every piece gets a score (in logits)
// and a standard error. About 90% of judgements come from Claude and 10% from the Content Equity
// team, whose choices anchor and check the scale, so the AI systematises the team's editorial taste.
//
// Safeguards: house names are removed; every text is cut to the same length (so length cannot win);
// each pair is judged by the AI in both orders (so position cannot win); the results report how
// far scores track word count, and how often the AI agrees with the people.

import Anthropic from '@anthropic-ai/sdk'
import { MANAGERS, MANAGER_BY_ID } from './sources'
import { addUsage, type Usage } from './usage'

export type Question = 'ideas' | 'writing'
export const QUESTIONS: Record<Question, { label: string; ask: string }> = {
  ideas: {
    label: 'Ideas',
    ask: 'Which piece offers the more original and valuable thinking for a professional investor: an argument, insight or evidence they would not get from the other piece, or from the general run of asset-manager commentary on this subject?',
  },
  writing: {
    label: 'Writing',
    ask: 'Which piece is better written: clearer, more precise, more engaging and more distinctive in its voice?',
  },
}

export const CJ_MODELS: Record<string, string> = { sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' }
/** Spend on comparative judgement has its own monthly allowance, apart from tagging. Set CJ_BUDGET_USD in Vercel. */
export const cjBudget = () => Number(process.env.CJ_BUDGET_USD || 8)

// ── Preparing texts ──────────────────────────────────────────────────────

const SUFFIX = /\b(asset management|investment management|investment managers|global investors|global advisors|investors|investments|investment|capital management|management|advisors|advisers|partners|group|holdings|plc|ltd|limited|inc|llc|sa|ag|& co\.?|co\.?)\b/gi
const COMMON = new Set(['capital', 'global', 'royal', 'first', 'state', 'street', 'national', 'general', 'principal', 'legal', 'federated', 'northern', 'trust', 'insight', 'premier', 'baillie', 'american', 'new', 'york'])

/** Every way a house's own name might appear in its text: full names, the core name, its short form, its web address */
export function nameVariants(managerId: string): string[] {
  const m = MANAGER_BY_ID.get(managerId)
  if (!m) return []
  const out = new Set<string>()
  for (const full of [m.name, m.parent_group].filter(Boolean) as string[]) {
    const clean = full.replace(/\(.*?\)/g, '').trim()
    out.add(clean)
    const core = clean.replace(SUFFIX, '').replace(/\s+/g, ' ').trim()
    if (core.length >= 3 && !COMMON.has(core.toLowerCase())) out.add(core)
    // Initials of multi-word names (L&G, BNPP AM style forms are covered by the id below)
    for (const paren of /\((.*?)\)/.exec(full)?.slice(1) || []) out.add(paren.replace(/formerly\s+/i, '').trim())
  }
  try { const host = new URL(m.home).hostname.replace(/^www\./, ''); out.add(host); out.add(host.split('.')[0]) } catch {}
  if (m.id.length >= 3 && !/^\d/.test(m.id)) out.add(m.id.replace(/-/g, ' '))
  return Array.from(out).filter(v => v.length >= 3 && !COMMON.has(v.toLowerCase())).sort((a, b) => b.length - a.length)
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The text a judge sees: house names, web addresses and emails removed; cut to `words` words at a sentence end */
export function anonymise(managerId: string, text: string, words = 1200): string {
  let t = text.replace(/https?:\/\/\S+/g, '').replace(/\S+@\S+\.\S+/g, '')
  for (const v of nameVariants(managerId)) {
    t = t.replace(new RegExp(`(?<![\\w])${esc(v).replace(/\s+/g, '\\s+')}(?:'s|’s)?(?![\\w])`, 'gi'), '[the manager]')
  }
  t = t.replace(/(\[the manager\]\s*){2,}/g, '[the manager] ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const tokens = t.split(/(\s+)/)
  let count = 0, cut = tokens.length
  for (let i = 0; i < tokens.length; i++) if (/\S/.test(tokens[i]) && ++count >= words) { cut = i + 1; break }
  if (cut >= tokens.length) return t
  let out = tokens.slice(0, cut).join('')
  const end = Math.max(out.lastIndexOf('. '), out.lastIndexOf('.\n'))
  if (end > out.length * 0.8) out = out.slice(0, end + 1)
  return `${out}\n\n[…]`
}

// ── Pairs ────────────────────────────────────────────────────────────────

/** Each round pairs every piece once at random, never repeating a pair; `rounds` comparisons per piece */
export function makePairs(n: number, rounds: number, seed = 1): [number, number][] {
  let s = seed
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const seen = new Set<string>()
  const pairs: [number, number][] = []
  for (let r = 0; r < rounds; r++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const order = Array.from({ length: n }, (_, i) => i).sort(() => rand() - 0.5)
      const round: [number, number][] = []
      let ok = true
      for (let i = 0; i + 1 < order.length; i += 2) {
        const [a, b] = [Math.min(order[i], order[i + 1]), Math.max(order[i], order[i + 1])]
        if (seen.has(`${a}-${b}`)) { ok = false; break }
        round.push([a, b])
      }
      if (!ok && attempt < 49) continue
      for (const [a, b] of round) { seen.add(`${a}-${b}`); pairs.push([a, b]) }
      break
    }
  }
  return pairs
}

// ── The AI judge ─────────────────────────────────────────────────────────

const SYSTEM = `You are a senior editor at a content consultancy that advises asset managers on their published thinking. You compare two pieces of asset-manager content on the same subject and make two judgements, as an experienced editor would: quickly, holistically, and with taste.

1. IDEAS. ${QUESTIONS.ideas.ask}
2. WRITING. ${QUESTIONS.writing.ask}

Judge the pieces as they are shown. Both are cut to the same length, so neither length nor how much ground a piece covers is a reason to prefer it. House names are removed; do not guess them. Confident tone, jargon and numbers are not insight in themselves: prefer a specific, well-supported, distinctive argument over a broad survey of consensus views. Prefer plain, precise, vivid writing over corporate boilerplate. The two judgements are separate: a piece can win one and lose the other.

Reply with JSON only, nothing else:
{"ideas":"A" or "B","ideas_reason":"under 25 words","writing":"A" or "B","writing_reason":"under 25 words"}`

function client() {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}) })
}

export interface Verdict { ideas: 'A' | 'B'; writing: 'A' | 'B'; ideas_reason: string; writing_reason: string }

export async function judgePair(model: string, theme: string, a: { title: string; text: string }, b: { title: string; text: string }, usage: Usage): Promise<Verdict> {
  const user = `Subject: ${theme}\n\n=== PIECE A ===\nTitle: ${a.title}\n\n${a.text}\n\n=== PIECE B ===\nTitle: ${b.title}\n\n${b.text}`
  const direct = /sonnet-5-5/.test(model) ? { thinking: { type: 'between_tools' } } : {}
  const m: any = await client().messages.create({
    model, max_tokens: 400, ...direct,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  } as any, { timeout: 90_000, maxRetries: 2 })
  addUsage(usage, model, m)
  const text = ((m?.content || []) as any[]).filter(x => x?.type === 'text').map(x => x.text).join('')
  const j = /\{[\s\S]*\}/.exec(text)
  if (!j) throw new Error(`no verdict: ${text.slice(0, 80)}`)
  const v = JSON.parse(j[0])
  const side = (x: any) => (String(x).trim().toUpperCase().startsWith('B') ? 'B' : 'A') as 'A' | 'B'
  if (!v.ideas || !v.writing) throw new Error('incomplete verdict')
  return { ideas: side(v.ideas), writing: side(v.writing), ideas_reason: String(v.ideas_reason || '').slice(0, 300), writing_reason: String(v.writing_reason || '').slice(0, 300) }
}

// ── The scale ────────────────────────────────────────────────────────────

export interface Judgement { pair: number; left_n: number; right_n: number; ideas_winner: number | null; writing_winner: number | null; judge_kind: 'ai' | 'human'; judge: string; ideas_reason?: string | null; writing_reason?: string | null }
export interface Scale { theta: number[]; se: number[]; comparisons: number[]; wins: number[]; reliability: number | null }

/**
 * Bradley-Terry by Hunter's MM algorithm. Each piece also plays one virtual draw against an average
 * piece (a weak prior), so a piece that won or lost every comparison still gets a finite score.
 * Scores are in logits, centred on 0: a gap of 1 means the higher piece wins about 73% of the time.
 * Reliability is the scale separation reliability used in comparative judgement (like a test's alpha).
 */
export function fitScale(n: number, games: [winner: number, loser: number][]): Scale {
  const wins = new Array(n).fill(0), comparisons = new Array(n).fill(0)
  const pairCount = new Map<string, number>()
  for (const [w, l] of games) {
    wins[w]++; comparisons[w]++; comparisons[l]++
    const k = w < l ? `${w}-${l}` : `${l}-${w}`
    pairCount.set(k, (pairCount.get(k) || 0) + 1)
  }
  let p = new Array(n).fill(1)
  for (let it = 0; it < 500; it++) {
    const next = new Array(n)
    for (let i = 0; i < n; i++) {
      let denom = 2 / (p[i] + 1) // the virtual opponent (strength 1), one game, half a win
      pairCount.forEach((c, k) => {
        const [a, b] = k.split('-').map(Number)
        if (a === i) denom += c / (p[i] + p[b])
        else if (b === i) denom += c / (p[i] + p[a])
      })
      next[i] = (wins[i] + 0.5) / denom
    }
    const g = Math.exp(next.reduce((s, x) => s + Math.log(x), 0) / n)
    const diff = next.reduce((m, x, i) => Math.max(m, Math.abs(Math.log(x / g) - Math.log(p[i]))), 0)
    p = next.map(x => x / g)
    if (diff < 1e-7) break
  }
  const theta = p.map(x => Math.log(x))
  const info = new Array(n).fill(0)
  pairCount.forEach((c, k) => {
    const [a, b] = k.split('-').map(Number)
    const q = p[a] / (p[a] + p[b])
    info[a] += c * q * (1 - q); info[b] += c * q * (1 - q)
  })
  for (let i = 0; i < n; i++) { const q = p[i] / (p[i] + 1); info[i] += q * (1 - q) }
  const se = info.map(x => 1 / Math.sqrt(x))
  const mean = theta.reduce((s, x) => s + x, 0) / n
  const variance = theta.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1)
  const err = se.reduce((s, x) => s + x * x, 0) / n
  const reliability = variance > 0 ? Math.max(0, (variance - err) / variance) : null
  return { theta, se, comparisons, wins, reliability }
}

export function gamesOf(js: Judgement[], q: Question): [number, number][] {
  const out: [number, number][] = []
  for (const j of js) {
    const w = q === 'ideas' ? j.ideas_winner : j.writing_winner
    if (w == null) continue
    out.push([w, w === j.left_n ? j.right_n : j.left_n])
  }
  return out
}

/** Spearman rank correlation */
export function spearman(x: number[], y: number[]): number | null {
  const ok = x.map((v, i) => [v, y[i]]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b))
  if (ok.length < 4) return null
  const rank = (v: number[]) => { const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); s.forEach(([, i], k) => (r[i] = k)); return r }
  const rx = rank(ok.map(r => r[0])), ry = rank(ok.map(r => r[1]))
  const n = ok.length, mx = (n - 1) / 2
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - mx); dx += (rx[i] - mx) ** 2; dy += (ry[i] - mx) ** 2 }
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100
}

export interface Report {
  judges: Record<string, { kind: string; judgements: number }>
  scales: Record<string, Record<Question, Scale>>           // per judge group: 'sonnet', 'haiku', 'human', 'production'
  orderConsistency: Record<string, Record<Question, number | null>>   // AI: same winner when the pair is shown the other way round
  humanAgreement: Record<string, Record<Question, { n: number; agree: number | null }>>  // AI scale predicts the person's choice
  modelAgreement: Record<Question, number | null>         // Sonnet vs Haiku scale, rank correlation
  lengthCorrelation: Record<string, Record<Question, number | null>>  // score vs full word count
  ideasWritingCorrelation: Record<string, number | null>
}

/** Everything the results page shows, from the items and judgements of one set */
export function report(n: number, items: { n: number; word_count: number | null }[], js: Judgement[]): Report {
  const judges: Report['judges'] = {}
  for (const j of js) (judges[j.judge] ||= { kind: j.judge_kind, judgements: 0 }).judgements++
  const groupOf = (j: Judgement) => j.judge_kind === 'human' ? 'human' : Object.entries(CJ_MODELS).find(([, m]) => j.judge.startsWith(m))?.[0] || j.judge
  const groups: Record<string, Judgement[]> = {}
  for (const j of js) (groups[groupOf(j)] ||= []).push(j)
  // The production scale: Sonnet's judgements and the people's together (the 90/10 design)
  groups.production = [...(groups.sonnet || []), ...(groups.human || [])]
  const qs: Question[] = ['ideas', 'writing']
  const scales: Report['scales'] = {}
  for (const [g, list] of Object.entries(groups)) if (list.length) scales[g] = { ideas: fitScale(n, gamesOf(list, 'ideas')), writing: fitScale(n, gamesOf(list, 'writing')) }

  const orderConsistency: Report['orderConsistency'] = {}
  for (const g of ['sonnet', 'haiku']) {
    const list = groups[g] || []
    orderConsistency[g] = { ideas: null, writing: null }
    for (const q of qs) {
      const byPair = new Map<number, number[]>()
      for (const j of list) { const w = q === 'ideas' ? j.ideas_winner : j.writing_winner; if (w != null) byPair.set(j.pair, [...(byPair.get(j.pair) || []), w]) }
      const both = Array.from(byPair.values()).filter(v => v.length >= 2)
      orderConsistency[g][q] = both.length ? Math.round((both.filter(v => v[0] === v[1]).length / both.length) * 100) / 100 : null
    }
  }

  const humanAgreement: Report['humanAgreement'] = {}
  for (const g of ['sonnet', 'haiku']) {
    if (!scales[g]) continue
    humanAgreement[g] = { ideas: { n: 0, agree: null }, writing: { n: 0, agree: null } }
    for (const q of qs) {
      const th = scales[g][q].theta
      let n2 = 0, ok = 0
      for (const j of groups.human || []) {
        const w = q === 'ideas' ? j.ideas_winner : j.writing_winner
        if (w == null) continue
        const l = w === j.left_n ? j.right_n : j.left_n
        n2++; if (th[w] > th[l]) ok++
      }
      humanAgreement[g][q] = { n: n2, agree: n2 ? Math.round((ok / n2) * 100) / 100 : null }
    }
  }

  const modelAgreement: Report['modelAgreement'] = { ideas: null, writing: null }
  if (scales.sonnet && scales.haiku) for (const q of qs) modelAgreement[q] = spearman(scales.sonnet[q].theta, scales.haiku[q].theta)

  const wc = Array.from({ length: n }, (_, i) => items.find(x => x.n === i)?.word_count ?? NaN)
  const lengthCorrelation: Report['lengthCorrelation'] = {}
  const ideasWritingCorrelation: Report['ideasWritingCorrelation'] = {}
  for (const [g, s] of Object.entries(scales)) {
    lengthCorrelation[g] = { ideas: spearman(s.ideas.theta, wc), writing: spearman(s.writing.theta, wc) }
    ideasWritingCorrelation[g] = spearman(s.ideas.theta, s.writing.theta)
  }
  return { judges, scales, orderConsistency, humanAgreement, modelAgreement, lengthCorrelation, ideasWritingCorrelation }
}

export const managerName = (id: string) => MANAGER_BY_ID.get(id)?.name || id
export const ALL_MANAGERS = MANAGERS
