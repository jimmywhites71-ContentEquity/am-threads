-- Comparative judgement, second version (26 Oct 2026): a third question, presentation.
-- Paste into Supabase (am-threads project) → SQL Editor → Run. Safe to run twice.
alter table public.cj_judgements add column if not exists presentation_winner integer;
alter table public.cj_judgements add column if not exists presentation_reason text;
