-- ─────────────────────────────────────────────────────────────────────────────
-- Add added_at to goal_targets
--
-- Tracks when a goal was (re)activated. Used to filter out transactions
-- from a previous instance of the same goal (e.g. deleted and re-added
-- in the same month). Without this, old contributions bleed into a fresh start.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.goal_targets
  add column added_at timestamptz not null default now();

-- Backfill: use created_at as the initial added_at for all existing rows
update public.goal_targets set added_at = created_at;
