-- Track previously imported SMS lines so the exact same message cannot be
-- imported twice. Kept separate from transactions so other import sources can
-- reuse the same pattern later, and so content fingerprint checks in
-- saveParsedSmsExpenses can stay as a soft warning only.

create table if not exists public.sms_import_lines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_hash text not null,
  created_at  timestamptz not null default now(),
  constraint sms_import_lines_user_hash_unique unique (user_id, source_hash)
);

create index if not exists sms_import_lines_user_id_idx
  on public.sms_import_lines (user_id);

alter table public.sms_import_lines enable row level security;

drop policy if exists "Users can manage own sms import lines"
  on public.sms_import_lines;

create policy "Users can manage own sms import lines"
  on public.sms_import_lines
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
