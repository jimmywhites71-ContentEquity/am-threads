import type { Extracted } from './extract'

/** The measured fields of a piece, as stored in the pieces table */
export function pieceRow(manager_id: string, p: Extracted) {
  const r = p.readability
  return {
    manager_id, title: p.title || null, url: p.url, canonical_url: p.canonical_url, published_at: p.published_at,
    authors: p.authors, format: p.format, image_url: p.image_url,
    word_count: r.word_count, reading_minutes: r.reading_minutes, pages: p.pages,
    flesch_reading_ease: r.flesch_reading_ease, fk_grade: r.fk_grade, avg_sentence_words: r.avg_sentence_words,
    long_word_share: r.long_word_share, passive_share: r.passive_share, jargon_per_100: r.jargon_per_100,
    unexplained_acronyms: r.unexplained_acronyms, figures_per_1000: r.figures_per_1000,
    disclaimer_share: p.disclaimer_share, structure: p.structure, visual: p.visual,
    gated: p.gated, status: p.gated ? 'gated' : r.word_count < 150 ? 'thin' : 'read',
    updated_at: new Date().toISOString(),
  }
}
