// What the API costs this product, and the limits that keep it in check.
//
// Prices are list prices per million tokens (USD), from https://platform.claude.com/docs/en/about-claude/pricing
// (checked 17 Oct 2026). Thinking tokens are billed as output. Update here if prices change.

export const PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.10, output: 0.50 },   // prompts up to 100k tokens (ours are far smaller)
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export const SUMMARY_MODEL = () => process.env.SUMMARY_MODEL || 'claude-haiku-5-5'
export const TAGGER_MODEL = () => process.env.TAGGER_MODEL || 'claude-sonnet-5-5'

/** Pieces summarised and tagged per UTC day; the rest wait for the next day. Set MAX_PIECES_PER_DAY in Vercel. */
export const dailyCap = () => Number(process.env.MAX_PIECES_PER_DAY || 300)
/** Spending stops for the month once this is reached (USD, list prices). Set MONTHLY_BUDGET_USD in Vercel. */
export const monthlyBudget = () => Number(process.env.MONTHLY_BUDGET_USD || 40)

export interface Usage { [model: string]: { input: number; output: number; calls: number } }

export function addUsage(u: Usage, model: string, m: any) {
  const key = Object.keys(PRICES).find(p => model.startsWith(p)) || model
  const row = (u[key] ||= { input: 0, output: 0, calls: 0 })
  row.input += Number(m?.usage?.input_tokens || 0) + Number(m?.usage?.cache_read_input_tokens || 0) + Number(m?.usage?.cache_creation_input_tokens || 0)
  row.output += Number(m?.usage?.output_tokens || 0)
  row.calls++
}

export function costOf(u: Usage): number {
  let usd = 0
  for (const [model, r] of Object.entries(u)) {
    const p = PRICES[model]
    if (p) usd += (r.input * p.input + r.output * p.output) / 1e6
  }
  return Math.round(usd * 10000) / 10000
}
