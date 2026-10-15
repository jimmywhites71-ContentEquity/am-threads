# AM Intelligence (repository: am-threads)

A structured record of what asset managers publish — asset class, sub-asset class, theme, format,
length, readability, structure and visual treatment — for reports, white-space analysis, data
extracts and a browsing feed. Built on the AlphaThreads engine, as a separate product: its own
repository, Supabase project, Vercel project, domain, keys and bot identity (the firewall).

Plan and decisions: the project docs `am-intelligence-attention-signal-and-first-build.md` and
`am-intelligence-theme-taxonomy-v1.md`.

## How it works

| Step | Route | What it does |
|---|---|---|
| Discover | `POST /api/discover?days=14` | Lists each source's pages from its sitemap (following sitemap indexes) and queues new addresses in `editions`. `?dry=1` reports without storing — use it to check a new source. |
| Read and measure | `POST /api/process?limit=40` | Reads queued pages (HTML or PDF), separates body from disclaimers, measures readability, structure and visuals, and files each under one piece shared by all its regional editions. |
| Summarise and tag | `POST /api/classify?limit=60` | Haiku summary, then Sonnet tags against `lib/taxonomy.ts`. Re-tags anything not on the current taxonomy version. `?dry=1&limit=30` returns tags without storing, for the hand-check. |
| Status | `GET /api/status` | Markdown health report, posted to the "Pipeline status" issue. |
| Screenshots | `npm run capture` (GitHub Actions) | Above-the-fold and full-page screenshots into the private `captures` bucket. |

All routes need `Authorization: Bearer $PIPELINE_API_KEY`. GitHub Actions runs the daily pipeline
(`.github/workflows/pipeline.yml`) and screenshots (`capture.yml`); `checks.yml` runs the tests.

## Key files

- `lib/taxonomy.ts` — asset classes, sub-asset classes and the 12 parent / 69 child themes, with definitions and overlap rules. Version `1.0.1`. AlphaThreads must tag against the same version.
- `lib/sources.ts` — the 11 managers, their sources, and address rules for region and channel.
- `lib/collect.ts` — discovery. `lib/extract.ts` + `lib/readability.ts` — reading and measuring.
- `lib/dedupe.ts` — one piece across editions. `lib/classifier.ts` — summaries and tags.
- Copied from AlphaThreads: `lib/sitemap.ts`, `lib/images.ts`, `lib/paywall.ts`, `lib/substack.ts`, `lib/transcripts.ts` (bot identity changed to `AMIntelligenceBot`).

## Setting up

1. Create a new Supabase project. Run `supabase/schema.sql`. Create a private storage bucket `captures`.
2. Create a Vercel project from this repository with the variables in `.env.example` (new keys, not AlphaThreads').
3. In GitHub: secrets `PIPELINE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; variables `SITE_URL` and `BOT_CONTACT_URL`.
4. Run "Daily pipeline" by hand with `days` = 30 to check the sources, then 365 for the backfill.

## Not built yet

Podcast, video and webinar sources; the model's read of screenshots for chart types; reaction
speed; the Independent Conversation Index import; the browsing feed and reports (Phases 4–6).
