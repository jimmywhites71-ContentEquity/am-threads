// Comparative judgement: the Ideas & voice measures (pilot, 26 Oct 2026).
//
// Following No More Marking's method (Daisy Christodoulou): judges never score a piece on its own.
// They see two pieces side by side and say which is better, on three questions:
//   ideas        – which offers the more original and valuable thinking
//   writing      – which is better written
//   presentation – which is better presented on the page (from screenshots; v2, 26 Oct)
// A Bradley-Terry model turns many such choices into a scale: every piece gets a score (in logits)
// and a standard error. About 90% of judgements come from Claude and 10% from the Content Equity
// team, whose choices anchor and check the scale, so the AI systematises the team's editorial taste.
//
// Safeguards: house names are removed from the text, and site headers, logos and footers hidden in the
// screenshots; pieces are shown in full (up to the set's word limit, 4,000 from v2) and paired with
// pieces of similar length, so depth can win on its merits but a long paper does not simply beat a
// short note; each pair is judged by the AI in both orders (so position cannot win); the results
// report how far scores track word count, and how often the AI agrees with the people. James, 26 Oct:
// length is a quality factor (depth), so it is matched, not hidden; the team's choices decide how
// much length should count.

import Anthropic from '@anthropic-ai/sdk'
import { MANAGERS, MANAGER_BY_ID } from './sources'
import { addUsage, type Usage } from './usage'

export type Question = 'ideas' | 'writing' | 'presentation'
export const QUESTION_LIST: Question[] = ['ideas', 'writing', 'presentation']
export const QUESTIONS: Record<Question, { label: string; ask: string }> = {
  ideas: {
    label: 'Ideas',
    ask: 'Which piece offers the more original and valuable thinking for a professional investor: an argument, insight or evidence they would not get from the other piece, or from the general run of asset-manager commentary on this subject?',
  },
  writing: {
    label: 'Writing',
    ask: 'Which piece is better written: clearer, more precise, more engaging and more distinctive in its voice?',
  },
  presentation: {
    label: 'Presentation',
    ask: 'Which piece is better presented on the page: design, layout, charts and visuals that carry the argument, and how easy it is to read and navigate?',
  },
}
/** Where a piece's judging screenshots live in the private "captures" bucket (scripts/capture.ts --set) */
export const judgeImagePath = (pieceId: string, kind: 'top' | 'page') => `judge/${pieceId}/${kind}.jpg`

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

/**
 * Each round pairs every piece once, never repeating a pair; `rounds` comparisons per piece.
 * With `lengths`, a piece is paired with one of similar length (within `window` places in length
 * order, widening only when no partner is left), so like is compared with like.
 */
export function makePairs(n: number, rounds: number, seed = 1, lengths?: number[], window = 8): [number, number][] {
  if (lengths) return makeMatchedPairs(n, rounds, seed, lengths, window)
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

function makeMatchedPairs(n: number, rounds: number, seed: number, lengths: number[], window: number): [number, number][] {
  let s = seed
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const byLength = Array.from({ length: n }, (_, i) => i).sort((a, b) => lengths[a] - lengths[b])
  const rank = new Array(n); byLength.forEach((i, r) => (rank[i] = r))
  const seen = new Set<string>()
  const key = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`
  const pairs: [number, number][] = []
  for (let r = 0; r < rounds; r++) {
    const free = new Set(Array.from({ length: n }, (_, i) => i))
    const order = Array.from(free).sort(() => rand() - 0.5)
    for (const i of order) {
      if (!free.has(i)) continue
      free.delete(i)
      let partner: number | undefined
      for (let w = window; w <= n && partner === undefined; w *= 2) {
        const options = Array.from(free).filter(j => Math.abs(rank[j] - rank[i]) <= w && !seen.has(key(i, j)))
        if (options.length) partner = options[Math.floor(rand() * options.length)]
      }
      if (partner === undefined) continue
      free.delete(partner); seen.add(key(i, partner))
      pairs.push([Math.min(i, partner), Math.max(i, partner)])
    }
  }
  return pairs
}

// ── The AI judge ─────────────────────────────────────────────────────────

const SYSTEM = `You are a senior editor at a content consultancy that advises asset managers on their published thinking. You compare two pieces of asset-manager content on the same subject and make separate judgements, as an experienced editor would: quickly, holistically, and with taste.

1. IDEAS. ${QUESTIONS.ideas.ask}
2. WRITING. ${QUESTIONS.writing.ask}
3. PRESENTATION (only when screenshots of both pages are given). ${QUESTIONS.presentation.ask}

The pieces are shown in full and are of broadly similar length. Depth of analysis counts in their favour; length that only adds padding, repetition or a survey of other people's views does not. House names are removed from the text and site headers and logos are hidden in the screenshots; do not guess or use the house. Confident tone, jargon and numbers are not insight in themselves: prefer a specific, well-supported, distinctive argument over a broad survey of consensus views. Prefer plain, precise, vivid writing over corporate boilerplate. For presentation, judge the page as a reader meets it: the top of the page first, then the whole page; charts and visuals count when they carry the argument, not as decoration. The judgements are separate: a piece can win one and lose another.

Reply with JSON only, nothing else (leave out the presentation keys when there are no screenshots):
{"ideas":"A" or "B","ideas_reason":"under 25 words","writing":"A" or "B","writing_reason":"under 25 words","presentation":"A" or "B","presentation_reason":"under 25 words"}`

function client() {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}) })
}

export interface Verdict { ideas: 'A' | 'B'; writing: 'A' | 'B'; presentation: 'A' | 'B' | null; ideas_reason: string; writing_reason: string; presentation_reason: string | null }
/** A piece as the judge sees it: anonymised title and text, and (optionally) its two screenshots as base64 JPEGs */
export interface JudgeSide { title: string; text: string; top?: string | null; page?: string | null }

export async function judgePair(model: string, theme: string, a: JudgeSide, b: JudgeSide, usage: Usage): Promise<Verdict> {
  const withImages = !!(a.top && a.page && b.top && b.page)
  const img = (data: string) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })
  const content: any[] = [{ type: 'text', text: `Subject: ${theme}` }]
  if (withImages) {
    content.push({ type: 'text', text: 'PIECE A, the top of the page as published:' }, img(a.top!), { type: 'text', text: 'PIECE A, the whole page, reduced:' }, img(a.page!))
    content.push({ type: 'text', text: 'PIECE B, the top of the page as published:' }, img(b.top!), { type: 'text', text: 'PIECE B, the whole page, reduced:' }, img(b.page!))
  }
  content.push({ type: 'text', text: `=== PIECE A ===\nTitle: ${a.title}\n\n${a.text}\n\n=== PIECE B ===\nTitle: ${b.title}\n\n${b.text}${withImages ? '' : '\n\n(No screenshots: judge ideas and writing only.)'}` })
  const direct = /sonnet-5-5/.test(model) ? { thinking: { type: 'between_tools' } } : {}
  const m: any = await client().messages.create({
    model, max_tokens: 500, ...direct,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  } as any, { timeout: 120_000, maxRetries: 2 })
  addUsage(usage, model, m)
  const text = ((m?.content || []) as any[]).filter(x => x?.type === 'text').map(x => x.text).join('')
  const j = /\{[\s\S]*\}/.exec(text)
  if (!j) throw new Error(`no verdict: ${text.slice(0, 80)}`)
  const v = JSON.parse(j[0])
  const side = (x: any) => (String(x).trim().toUpperCase().startsWith('B') ? 'B' : 'A') as 'A' | 'B'
  if (!v.ideas || !v.writing) throw new Error('incomplete verdict')
  return {
    ideas: side(v.ideas), writing: side(v.writing), presentation: withImages && v.presentation ? side(v.presentation) : null,
    ideas_reason: String(v.ideas_reason || '').slice(0, 300), writing_reason: String(v.writing_reason || '').slice(0, 300),
    presentation_reason: withImages && v.presentation_reason ? String(v.presentation_reason).slice(0, 300) : null,
  }
}

// ── The scale ────────────────────────────────────────────────────────────

export interface Judgement { pair: number; left_n: number; right_n: number; ideas_winner: number | null; writing_winner: number | null; presentation_winner?: number | null; judge_kind: 'ai' | 'human'; judge: string; ideas_reason?: string | null; writing_reason?: string | null; presentation_reason?: string | null }
export const winnerOf = (j: Judgement, q: Question) => (q === 'ideas' ? j.ideas_winner : q === 'writing' ? j.writing_winner : j.presentation_winner) ?? null
export const reasonOf = (j: Judgement, q: Question) => (q === 'ideas' ? j.ideas_reason : q === 'writing' ? j.writing_reason : j.presentation_reason) ?? null
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
    const w = winnerOf(j, q)
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
  /** Rank correlation between the questions' scales, per judge group: 'ideas-writing', 'ideas-presentation', 'writing-presentation' */
  questionCorrelation: Record<string, Record<string, number | null>>
  /** Questions with any judgements in this set */
  questions: Question[]
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
  const qs: Question[] = QUESTION_LIST.filter(q => js.some(j => winnerOf(j, q) != null))
  if (!qs.length) qs.push('ideas', 'writing')
  const scales: Report['scales'] = {}
  for (const [g, list] of Object.entries(groups)) if (list.length) {
    scales[g] = {} as Record<Question, Scale>
    for (const q of qs) scales[g][q] = fitScale(n, gamesOf(list, q))
  }

  const orderConsistency: Report['orderConsistency'] = {}
  for (const g of ['sonnet', 'haiku']) {
    const list = groups[g] || []
    orderConsistency[g] = { ideas: null, writing: null, presentation: null }
    for (const q of qs) {
      const byPair = new Map<number, number[]>()
      for (const j of list) { const w = winnerOf(j, q); if (w != null) byPair.set(j.pair, [...(byPair.get(j.pair) || []), w]) }
      const both = Array.from(byPair.values()).filter(v => v.length >= 2)
      orderConsistency[g][q] = both.length ? Math.round((both.filter(v => v[0] === v[1]).length / both.length) * 100) / 100 : null
    }
  }

  const humanAgreement: Report['humanAgreement'] = {}
  for (const g of ['sonnet', 'haiku']) {
    if (!scales[g]) continue
    humanAgreement[g] = { ideas: { n: 0, agree: null }, writing: { n: 0, agree: null }, presentation: { n: 0, agree: null } }
    for (const q of qs) {
      const th = scales[g][q].theta
      let n2 = 0, ok = 0
      for (const j of groups.human || []) {
        const w = winnerOf(j, q)
        if (w == null) continue
        const l = w === j.left_n ? j.right_n : j.left_n
        n2++; if (th[w] > th[l]) ok++
      }
      humanAgreement[g][q] = { n: n2, agree: n2 ? Math.round((ok / n2) * 100) / 100 : null }
    }
  }

  const modelAgreement: Report['modelAgreement'] = { ideas: null, writing: null, presentation: null }
  if (scales.sonnet && scales.haiku) for (const q of qs) modelAgreement[q] = spearman(scales.sonnet[q].theta, scales.haiku[q].theta)

  const wc = Array.from({ length: n }, (_, i) => items.find(x => x.n === i)?.word_count ?? NaN)
  const lengthCorrelation: Report['lengthCorrelation'] = {}
  const ideasWritingCorrelation: Report['ideasWritingCorrelation'] = {}
  const questionCorrelation: Report['questionCorrelation'] = {}
  for (const [g, s] of Object.entries(scales)) {
    lengthCorrelation[g] = { ideas: null, writing: null, presentation: null }
    for (const q of qs) lengthCorrelation[g][q] = spearman(s[q].theta, wc)
    ideasWritingCorrelation[g] = spearman(s.ideas.theta, s.writing.theta)
    questionCorrelation[g] = {}
    for (let a = 0; a < qs.length; a++) for (let b = a + 1; b < qs.length; b++) questionCorrelation[g][`${qs[a]}-${qs[b]}`] = spearman(s[qs[a]].theta, s[qs[b]].theta)
  }
  return { judges, scales, orderConsistency, humanAgreement, modelAgreement, lengthCorrelation, ideasWritingCorrelation, questionCorrelation, questions: qs }
}

export const managerName = (id: string) => MANAGER_BY_ID.get(id)?.name || id
export const ALL_MANAGERS = MANAGERS
