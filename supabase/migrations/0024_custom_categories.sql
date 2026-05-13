create extension if not exists "pgcrypto";

create table if not exists public.custom_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(id) on delete cascade,
  key         text not null,
  label       text not null,
  type        text not null check (type in ('everyday', 'fixed')),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint custom_categories_user_key_unique unique (user_id, key),
  constraint custom_categories_key_not_blank check (length(trim(key)) > 0),
  constraint custom_categories_label_not_blank check (length(trim(label)) > 0)
);

create unique index if not exists custom_categories_user_type_label_active_idx
  on public.custom_categories (user_id, type, lower(label))
  where archived_at is null;

create index if not exists custom_categories_user_active_idx
  on public.custom_categories (user_id, archived_at);

alter table public.custom_categories enable row level security;

drop policy if exists "Users can select own custom categories"
  on public.custom_categories;
drop policy if exists "Users can insert own custom categories"
  on public.custom_categories;
drop policy if exists "Users can update own custom categories"
  on public.custom_categories;

create policy "Users can select own custom categories"
  on public.custom_categories
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own custom categories"
  on public.custom_categories
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own custom categories"
  on public.custom_categories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at_custom_categories on public.custom_categories;
create trigger set_updated_at_custom_categories
before update on public.custom_categories
for each row execute function public.handle_updated_at();

alter table public.transactions
  add column if not exists custom_category_id uuid null
  references public.custom_categories(id) on delete set null;

create index if not exists transactions_user_custom_category_idx
  on public.transactions (user_id, custom_category_id)
  where custom_category_id is not null;

do $$
begin
  if to_regclass('public.item_dictionary') is not null then
    execute 'alter table public.item_dictionary
      add column if not exists custom_category_id uuid null
      references public.custom_categories(id) on delete set null';

    execute 'create index if not exists item_dictionary_user_custom_category_idx
      on public.item_dictionary (user_id, custom_category_id)
      where custom_category_id is not null';
  end if;
end $$;
