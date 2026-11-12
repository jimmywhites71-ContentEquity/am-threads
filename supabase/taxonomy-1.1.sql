-- Taxonomy 1.1.0 (12 Nov 2026): kind of piece, shelf life, argument, series.
-- Paste into Supabase (am-threads project) → SQL Editor → Run. Safe to run twice.
alter table public.pieces add column if not exists kind text;
alter table public.pieces add column if not exists shelf_life smallint;
alter table public.pieces add column if not exists argument smallint;
alter table public.pieces add column if not exists series boolean;
