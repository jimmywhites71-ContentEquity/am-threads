-- Comparative judgement (26 Oct 2026). Paste into Supabase → SQL Editor → Run. Safe to run twice.
create table if not exists public.cj_sets (
  id text primary key,                 -- e.g. cj-2026-10-ai
  name text not null,
  theme text,
  params jsonb not null default '{}',  -- selection rules, text length, pairs [[i, j], ...]
  created_at timestamptz default now()
);
create table if not exists public.cj_items (
  set_id text not null references public.cj_sets(id) on delete cascade,
  n integer not null,                  -- position in the set (pairs refer to it)
  piece_id uuid not null references public.pieces(id) on delete cascade,
  anon_title text,
  anon_text text not null,             -- house names removed, cut to the set's length
  word_count integer,                  -- the full piece's length, for the length check
  primary key (set_id, n)
);
create table if not exists public.cj_judgements (
  id uuid primary key default gen_random_uuid(),
  set_id text not null references public.cj_sets(id) on delete cascade,
  pair integer not null,               -- index into the set's pairs
  left_n integer not null,             -- shown first / on the left
  right_n integer not null,
  ideas_winner integer,                -- n of the piece judged better on ideas
  writing_winner integer,              -- n of the piece judged better written
  ideas_reason text,
  writing_reason text,
  judge_kind text not null check (judge_kind in ('ai', 'human')),
  judge text not null,                 -- model name, or the person's name
  seconds numeric,
  created_at timestamptz default now()
);
create index if not exists cj_judgements_set_idx on public.cj_judgements(set_id, judge);
alter table public.cj_sets enable row level security;
alter table public.cj_items enable row level security;
alter table public.cj_judgements enable row level security;
