// Readability and accessibility measures, computed in code from a piece's body text (disclaimers
// removed first, see lib/extract.ts). Standard formulas, so figures can be checked by anyone.

/** Syllables in one English word, by the usual vowel-group heuristic (good to about ±1 per word) */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const groups = w.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 1)
}

export function sentencesOf(text: string): string[] {
  return text
    // Keep decimals, abbreviations and initials from ending a sentence
    .replace(/\b(e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|Prof|Inc|Ltd|Co|U\.S|U\.K|No|approx)\./gi, m => m.replace(/\./g, '·'))
    .replace(/(\d)\.(\d)/g, '$1·$2')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"‘'(])|\n{2,}/)
    .map(s => s.trim())
    .filter(s => /[A-Za-z]{2,}/.test(s))
}

export function wordsOf(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z'’-]*|\d[\d,.]*%?/g) || []
}

// Common irregular past participles, for spotting passive voice
const IRREGULAR = 'been|born|bought|brought|built|caught|chosen|done|drawn|driven|eaten|fallen|felt|found|forgotten|given|gone|grown|held|hidden|kept|known|laid|led|left|lent|lost|made|meant|met|paid|put|read|run|said|seen|sent|set|shown|shut|sold|spent|spoken|stolen|struck|taken|taught|told|thought|understood|won|written|cut|hit|hurt|let|quit|spread|bid'
const PASSIVE = new RegExp(`\\b(am|is|are|was|were|be|been|being|get|gets|got|gotten)\\s+(?:\\w+ly\\s+)?(?:\\w+ed|${IRREGULAR})\\b`, 'i')

// Abbreviations a professional reader knows without expansion; everything else should be spelled out once
const KNOWN_ACRONYMS = new Set(['US', 'UK', 'EU', 'UN', 'AI', 'CEO', 'CFO', 'CIO', 'GDP', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CNY', 'Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'FY', 'OK', 'TV', 'IT', 'NYSE', 'S&P', 'FTSE', 'MSCI', 'COVID', 'USA', 'IMF', 'OECD', 'NATO', 'ECB', 'BOE', 'BOJ'])

// A starter finance glossary. Jargon density = glossary hits per 100 words. Extend as reports show gaps.
const JARGON = [
  'alpha', 'beta', 'duration', 'convexity', 'carry', 'basis point', 'bps', 'spread', 'spreads', 'yield curve', 'steepening', 'flattening',
  'drawdown', 'sharpe', 'volatility', 'liquidity premium', 'risk premium', 'term premium', 'factor', 'momentum', 'mean reversion',
  'overweight', 'underweight', 'tactical', 'strategic asset allocation', 'tail risk', 'hedge', 'leverage', 'deleveraging', 'credit cycle',
  'high yield', 'investment grade', 'securitised', 'securitized', 'collateral', 'repo', 'quantitative easing', 'quantitative tightening',
  'disinflation', 'stagflation', 'reflation', 'breakeven', 'real yield', 'nominal', 'multiple expansion', 'earnings revisions', 'forward p/e',
  'cape', 'dispersion', 'correlation', 'idiosyncratic', 'systematic', 'tracking error', 'information ratio', 'active share', 'liability-driven',
  'ldi', 'glide path', 'decumulation', 'dry powder', 'vintage', 'dpi', 'tvpi', 'irr', 'nav', 'secondaries', 'continuation vehicle',
  'covenant', 'pik', 'senior secured', 'mezzanine', 'contango', 'backwardation', 'curve', 'bear steepener', 'bull flattener', 'risk-off', 'risk-on',
]
const JARGON_RE = new RegExp(`\\b(${JARGON.map(j => j.replace(/[/.]/g, '\\$&')).join('|')})\\b`, 'gi')

export interface Readability {
  word_count: number
  sentence_count: number
  reading_minutes: number
  flesch_reading_ease: number | null
  fk_grade: number | null
  avg_sentence_words: number | null
  long_word_share: number | null
  passive_share: number | null
  jargon_per_100: number | null
  unexplained_acronyms: string[]
  /** Figures (percentages, basis points, currency amounts) per 1,000 words: a "data-backed" signal */
  figures_per_1000: number | null
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp

export function readability(text: string): Readability {
  const words = wordsOf(text)
  const sentences = sentencesOf(text)
  const wc = words.length
  const sc = Math.max(1, sentences.length)
  const alpha = words.filter(w => /^[A-Za-z]/.test(w))
  const syl = alpha.reduce((n, w) => n + syllables(w), 0)
  const long = alpha.filter(w => syllables(w) >= 3).length

  const empty = wc < 50
  const wps = wc / sc
  const spw = alpha.length ? syl / alpha.length : 0

  // Acronyms: two or more capitals; explained if written out with the acronym in brackets, or the
  // acronym followed by an expansion in brackets, anywhere in the piece
  const acronyms = Array.from(new Set((text.match(/\b[A-Z][A-Z&]{1,6}s?\b/g) || []).map(a => a.replace(/s$/, ''))))
  const unexplained = acronyms.filter(a => !KNOWN_ACRONYMS.has(a)
    && !new RegExp(`\\(${a.replace(/&/g, '\\&')}s?\\)`).test(text)
    && !new RegExp(`\\b${a.replace(/&/g, '\\&')}s?\\b[^.()]{0,25}\\([a-z]`, 'i').test(text))

  const figures = (text.match(/[-+]?\d[\d,.]*\s?(%|per cent|percent|bps?|basis points|bn|billion|mn|million|trn|trillion|x\b)|[$£€¥]\s?\d[\d,.]*/gi) || []).length

  return {
    word_count: wc,
    sentence_count: sentences.length,
    reading_minutes: round(wc / 230, 1),
    flesch_reading_ease: empty ? null : round(206.835 - 1.015 * wps - 84.6 * spw),
    fk_grade: empty ? null : round(0.39 * wps + 11.8 * spw - 15.59),
    avg_sentence_words: empty ? null : round(wps),
    long_word_share: empty ? null : round(long / Math.max(1, alpha.length), 3),
    passive_share: empty ? null : round(sentences.filter(s => PASSIVE.test(s)).length / sc, 3),
    jargon_per_100: empty ? null : round(((text.match(JARGON_RE) || []).length / wc) * 100, 2),
    unexplained_acronyms: unexplained.slice(0, 30),
    figures_per_1000: empty ? null : round((figures / wc) * 1000, 1),
  }
}
