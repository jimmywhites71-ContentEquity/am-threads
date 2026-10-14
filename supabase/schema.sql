-- AM Intelligence database. A separate Supabase project from AlphaThreads (the firewall):
-- no shared tables, users or keys. Run in the Supabase SQL editor of the new project.
--
-- Shape (build plan, Part 1): one row per piece in `pieces`; every regional or channel copy of it
-- in `editions`; its full text in `piece_text` (internal only, never shown or sold); screenshots in
-- `captures`; independent-attention aggregates imported from AlphaThreads in `ici_weekly`.

create extension if not exists "pgcrypto";

create table if not exists public.managers (
  id text primary key,
  name text not null,
  parent_group text,
  home text,
  created_at timestamptz default now()
);

create table if not exists public.sources (
  id text primary key,
  manager_id text not null references public.managers(id),
  name text not null,
  feed_url text not null,
  kind text not null default 'sitemap',
  active boolean not null default true,
  verified text,                       -- date seen working, 'alphathreads', or null
  last_run_at timestamptz,
  last_found integer,                  -- pages discovered on the last run
  last_error text,
  created_at timestamptz default now()
);

create table if not exists public.pieces (
  id uuid primary key default gen_random_uuid(),
  piece_key text not null unique,      -- manager + slug, shared by every edition (lib/dedupe.ts)
  manager_id text not null references public.managers(id),

  -- Identity
  title text,
  url text not null,                   -- the first edition read
  canonical_url text,
  published_at timestamptz,
  authors text[] not null default '{}',
  regions text[] not null default '{}',    -- editions' regions (where it was published)
  channels text[] not null default '{}',

  -- Classification (lib/classifier.ts, versioned)
  summary text,
  asset_classes text[] not null default '{}',
  sub_asset_classes text[] not null default '{}',
  primary_theme text,
  secondary_themes text[] not null default '{}',
  subject_regions text[] not null default '{}',  -- Regions & Markets facet (what it is about)
  vehicles text[] not null default '{}',         -- Vehicles & Products facet
  content_purpose text,
  explicit_call boolean,
  call_text text,
  theme_candidate text,
  taxonomy_version text,
  tagged_at timestamptz,

  -- Form (lib/extract.ts, lib/readability.ts)
  format text,
  word_count integer,
  reading_minutes numeric,
  pages integer,
  duration_seconds integer,
  flesch_reading_ease numeric,
  fk_grade numeric,
  avg_sentence_words numeric,
  long_word_share numeric,
  passive_share numeric,
  jargon_per_100 numeric,
  unexplained_acronyms text[] not null default '{}',
  figures_per_1000 numeric,
  disclaimer_share numeric,
  structure jsonb,                     -- headings, bullets, key_takeaways, named_author, call_to_action, tables
  visual jsonb,                        -- lead_image, images, charts, images_per_1000_words, chart_hosts, interactive, video/audio
  image_url text,                      -- the page's own lead image address (linked, not re-hosted in products)

  -- State
  status text not null default 'read' check (status in ('read', 'gated', 'thin')),
  gated boolean not null default false,
  first_seen_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists pieces_manager_date_idx on public.pieces(manager_id, published_at desc);
create index if not exists pieces_date_idx on public.pieces(published_at desc);
create index if not exists pieces_asset_idx on public.pieces using gin(asset_classes);
create index if not exists pieces_sub_idx on public.pieces using gin(sub_asset_classes);
create index if not exists pieces_secondary_idx on public.pieces using gin(secondary_themes);
create index if not exists pieces_primary_idx on public.pieces(primary_theme);
create index if not exists pieces_version_idx on public.pieces(taxonomy_version);

-- Every address a piece appears at. A discovered address waits here (status 'new') until read.
create table if not exists public.editions (
  url text primary key,
  source_id text not null references public.sources(id),
  manager_id text not null references public.managers(id),
  piece_id uuid references public.pieces(id) on delete set null,
  region text,
  channel text,
  lastmod timestamptz,                 -- from the sitemap
  status text not null default 'new' check (status in ('new', 'read', 'failed', 'gated', 'skipped')),
  attempts integer not null default 0,
  http_status integer,
  error text,
  discovered_at timestamptz default now(),
  read_at timestamptz
);
create index if not exists editions_status_idx on public.editions(status, lastmod desc nulls last);
create index if not exists editions_piece_idx on public.editions(piece_id);

-- Full text, for analysis only. Never exposed through the app's public API or sold.
create table if not exists public.piece_text (
  piece_id uuid primary key references public.pieces(id) on delete cascade,
  text text,
  disclaimer_text text,
  pdf_links text[] not null default '{}',
  updated_at timestamptz default now()
);

-- Screenshots and saved lead images (storage bucket "captures"), taken by the GitHub Actions job
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces(id) on delete cascade,
  kind text not null check (kind in ('above_fold', 'full_page', 'lead_image')),
  storage_path text,
  width integer,
  height integer,
  error text,
  captured_at timestamptz default now(),
  unique (piece_id, kind)
);

-- Independent Conversation Index inputs: weekly counts exported by AlphaThreads (aggregates only,
-- its Asset Managers section excluded). Nothing flows the other way.
create table if not exists public.ici_weekly (
  week_start date not null,
  theme text not null,                 -- a theme name, or '' when the row is for a sub-asset class
  sub_asset_class text not null default '',
  publisher_type text not null,        -- independent, academic, central bank, consultant, specialist press
  stories integer not null,
  taxonomy_version text not null,
  imported_at timestamptz default now(),
  primary key (week_start, theme, sub_asset_class, publisher_type, taxonomy_version)
);

-- One line per pipeline run, for the status report and the weekly check-in
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  step text not null,                  -- discover, process, classify, capture
  started_at timestamptz default now(),
  finished_at timestamptz,
  stats jsonb
);

-- Theme candidates the tagger proposed, for the monthly taxonomy review
create or replace view public.theme_candidates as
  select lower(theme_candidate) as candidate, count(*) as pieces, max(published_at) as latest
  from public.pieces where theme_candidate is not null
  group by 1 order by 2 desc;

-- Row level security: everything is read and written by the server with the service key.
-- No anonymous access to anything; the app's pages read through server routes.
alter table public.managers enable row level security;
alter table public.sources enable row level security;
alter table public.pieces enable row level security;
alter table public.editions enable row level security;
alter table public.piece_text enable row level security;
alter table public.captures enable row level security;
alter table public.ici_weekly enable row level security;
alter table public.runs enable row level security;

-- Storage for screenshots: create a private bucket named "captures" in the Supabase dashboard.
