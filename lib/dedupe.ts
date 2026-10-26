// One piece, many editions. Managers republish the same piece across regional and channel sites
// (JPMorgan's /us/…/adv/ and /gb/…/liq/, Schroders' UK institutional and intermediary). For share of
// voice it counts once; every edition is kept for region and channel analysis.
//
// The key is the manager plus the address's last meaningful part (the slug). Short or generic
// slugs ("outlook", "index") take the part before them too, so different pieces don't collide.

const GENERIC = /^(index|default|article|articles|insight|insights|overview|outlook|commentary|update|home|en|us|uk|gb)$/i

export function slugOf(url: string): string {
  let u: URL
  try { u = new URL(url) } catch { return url.toLowerCase() }
  // Some sites wrap the article's own address in a query (Nedgroup: render.html?path=/content/…/news/<slug>)
  const parts = (u.searchParams.get('path') || u.pathname).split('/').map(p => decodeURIComponent(p).toLowerCase().replace(/\.(html?|aspx|pdf)$/, '')).filter(Boolean)
  if (!parts.length) return u.hostname
  const last = parts[parts.length - 1]
  const prev = parts[parts.length - 2]
  return (last.length < 12 || GENERIC.test(last)) && prev ? `${prev}/${last}` : last
}

/** The key all editions of one piece share. A canonical address, when the page gives one, wins. */
export function pieceKey(manager: string, url: string, canonical?: string | null): string {
  return `${manager}:${slugOf(canonical || url)}`
}
