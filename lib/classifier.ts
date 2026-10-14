// Classification of manager pieces against the fixed vocabularies in lib/taxonomy.ts.
//
// Two model steps, as on AlphaThreads:
//   1. Haiku writes a short summary of each piece from its body text (cheap, one piece at a time).
//   2. Sonnet tags many pieces at once from headline, summary and opening text, against written
//      definitions: asset class and sub-asset class, topic themes (one primary, up to two secondary),
//      region and vehicle facets, content purpose, and the substance fields.
// Every result carries TAXONOMY_VERSION. Labels outside the lists are dropped, never guessed.

import Anthropic from '@anthropic-ai/sdk'
import {
  ASSET_CLASSES, ASSET_CLASS_NAMES, CONTENT_PURPOSES, OVERLAP_RULES, REGION_FACETS, SUB_ASSET_KEYS,
  TAXONOMY_VERSION, THEME_PARENTS, TOPIC_THEMES, VEHICLE_FACETS, pick, type ContentPurpose,
} from './taxonomy'

function client() {
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim()
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}) })
}
const textOf = (m: any) => ((m?.content || []) as any[]).filter(b => b?.type === 'text').map(b => b.text).join('')

// ── 1. Summary ───────────────────────────────────────────────────────────

export async function summarise(p: { title: string; text: string; manager: string }): Promise<{ summary: string; error?: string }> {
  if (p.text.trim().length < 300) return { summary: '' }
  const prompt = `Summarise this piece published by ${p.manager}, an asset manager, for a reader who tracks what asset managers publish.

Title: ${p.title}
Text: ${p.text.slice(0, 6000)}

Write 2-3 sentences: what the piece argues or reports, and any explicit view or call it makes. Attribute the view to ${p.manager}. Plain, precise British English; no filler; no investment advice of your own. Reply with the summary only.`
  try {
    const m = await client().messages.create({ model: process.env.SUMMARY_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] }, { timeout: 60_000, maxRetries: 1 })
    return { summary: textOf(m).trim() }
  } catch (err: any) {
    return { summary: '', error: `${err?.status || ''} ${String(err?.message || err).slice(0, 120)}`.trim() }
  }
}

// ── 2. Tags ──────────────────────────────────────────────────────────────

export interface Tags {
  asset_classes: string[]
  sub_asset_classes: string[]
  primary_theme: string | null
  secondary_themes: string[]
  regions: string[]
  vehicles: string[]
  content_purpose: ContentPurpose | null
  explicit_call: boolean
  call_text: string | null
  theme_candidate: string | null
  taxonomy_version: string
}

export interface TagInput { id: string; manager: string; title: string; summary: string; opening: string; format: string }

function guide(): string {
  const ac = ASSET_CLASSES.map(a => `- ${a.name}: ${a.definition}\n${a.subs.map(s => `    · ${a.name} › ${s.name}: ${s.definition}`).join('\n')}`).join('\n')
  const th = THEME_PARENTS.map(p => `${p.name}${p.kind === 'facet' ? ' (FACET)' : ''}${p.note ? ` — ${p.note}` : ''}\n${p.children.map(c => `    · ${c.name}: ${c.definition}${c.boundary ? ` Boundary: ${c.boundary}` : ''}`).join('\n')}`).join('\n')
  return `ASSET CLASSES AND SUB-ASSET CLASSES
Tag an asset class only when the piece is substantially about investing in it (prices, returns, valuations, yields, spreads, flows, risks, allocation). A passing mention gets nothing. 0-2 asset classes; for each, 0-2 sub-asset classes written exactly as "Asset class › Sub-class". A house outlook or allocation view covering several asset classes is Multi-Asset › Outlooks & house views or Strategic & tactical allocation.
${ac}

THEMES (version ${TAXONOMY_VERSION})
Topic themes: one primary and up to two secondary, only where the piece is substantially about them; none is allowed. Facets (Regions & Markets, Vehicles & Products) are separate lists: up to three each, every one that substantially applies.
${th}

OVERLAP RULES
${OVERLAP_RULES.map(r => `- ${r}`).join('\n')}

CONTENT PURPOSE (exactly one): house view (the firm's own forward view or positioning) · market commentary (reaction to recent events or data) · education (explains a concept) · product (about the firm's own fund, ETF or service) · thought leadership (longer-term argument or research).

EXPLICIT CALL: true only if the piece states a directional view an investor could act on (overweight/underweight, prefer X over Y, a forecast level or direction). Give it in under 15 words of your own in call_text.

THEME CANDIDATE: if the piece is substantially about something no theme covers, name it in 2-4 words; otherwise null.`
}

async function tagBatch(c: Anthropic, model: string, batch: TagInput[]): Promise<Map<string, Tags>> {
  const lines = batch.map((p, i) => `${i + 1}. [${p.manager}, ${p.format}] ${p.title}\n   Summary: ${p.summary.replace(/\s+/g, ' ').slice(0, 700) || '(none)'}\n   Opening: ${p.opening.replace(/\s+/g, ' ').slice(0, 500)}`).join('\n')
  const prompt = `You classify content published by asset managers for a competitive-intelligence dataset. Be strict: tag what each piece is substantially about, not what it mentions.

${guide()}

Pieces:
${lines}

Reply with one line of JSON per piece, in order, nothing else:
{"n":1,"asset_classes":[],"sub_asset_classes":[],"primary_theme":null,"secondary_themes":[],"regions":[],"vehicles":[],"content_purpose":"market commentary","explicit_call":false,"call_text":null,"theme_candidate":null}`
  const direct = /sonnet-5-5/.test(model) ? { thinking: { type: 'between_tools' } } : {}
  const m = await c.messages.create({ model, max_tokens: 6000, ...direct, messages: [{ role: 'user', content: prompt }] } as any, { timeout: 180_000, maxRetries: 1 })
  const out = new Map<string, Tags>()
  for (const line of textOf(m).split('\n')) {
    const j = /\{.*\}/.exec(line)
    if (!j) continue
    try {
      const row = JSON.parse(j[0])
      const p = batch[Number(row.n) - 1]
      if (!p) continue
      out.set(p.id, normaliseTags(row))
    } catch {}
  }
  return out
}

/** Keep only labels from the fixed lists, with the limits the rules set */
export function normaliseTags(row: any): Tags {
  const asset_classes = pick(ASSET_CLASS_NAMES, row.asset_classes, 2)
  // A sub-class only counts under an asset class that was tagged
  const sub_asset_classes = pick(SUB_ASSET_KEYS, row.sub_asset_classes, 4).filter(k => asset_classes.includes(k.split(' › ')[0]))
  let [primary_theme] = pick(TOPIC_THEMES, [row.primary_theme], 1)
  let secondary_themes = pick(TOPIC_THEMES, row.secondary_themes, 3).filter(t => t !== primary_theme)
  // Quality is an equity theme only (taxonomy 1.0.1)
  const equity = asset_classes.includes('Equities')
  if (!equity) {
    if (primary_theme === 'Quality') primary_theme = secondary_themes.find(t => t !== 'Quality') as any
    secondary_themes = secondary_themes.filter(t => t !== 'Quality')
  }
  secondary_themes = secondary_themes.filter(t => t !== primary_theme).slice(0, 2)
  const [purpose] = pick(CONTENT_PURPOSES, [row.content_purpose], 1)
  const explicit_call = row.explicit_call === true
  return {
    asset_classes, sub_asset_classes,
    primary_theme: primary_theme || null, secondary_themes,
    regions: pick(REGION_FACETS, row.regions, 3),
    vehicles: pick(VEHICLE_FACETS, row.vehicles, 3),
    content_purpose: purpose || null,
    explicit_call,
    call_text: explicit_call && row.call_text ? String(row.call_text).slice(0, 140) : null,
    theme_candidate: row.theme_candidate ? String(row.theme_candidate).slice(0, 60) : null,
    taxonomy_version: TAXONOMY_VERSION,
  }
}

export async function tagPieces(pieces: TagInput[], opts: { batch?: number; parallel?: number; deadline?: number } = {}): Promise<{ tags: Map<string, Tags>; errors: string[] }> {
  const c = client()
  const model = process.env.TAGGER_MODEL || 'claude-sonnet-5-5'
  const size = opts.batch || 15
  const batches: TagInput[][] = []
  for (let i = 0; i < pieces.length; i += size) batches.push(pieces.slice(i, i + size))
  const tags = new Map<string, Tags>()
  const errors: string[] = []
  await Promise.all(Array.from({ length: Math.min(opts.parallel || 3, batches.length) }, async () => {
    for (let b = batches.shift(); b; b = batches.shift()) {
      if (opts.deadline && Date.now() > opts.deadline) break
      try { for (const [k, v] of await tagBatch(c, model, b)) tags.set(k, v) }
      catch (err: any) { errors.push(`${err?.status || ''} ${String(err?.message || err).slice(0, 120)}`.trim()) }
    }
  }))
  return { tags, errors }
}
