-- ─────────────────────────────────────────────────────────────────────────────
-- Cenza — Initial Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── user_profiles ────────────────────────────────────────────────────────────
-- One row per user. Created on first sign-in, completed after onboarding.
create table public.user_profiles (
  id                uuid references auth.users on delete cascade primary key,
  name              text not null,
  currency          text not null default 'KES',
  month_start       text not null default 'first',   -- 'first' | 'custom'
  custom_day        integer,                          -- 1–28, only when month_start = 'custom'
  goals             text[] not null default '{}',     -- e.g. ['emergency', 'car', 'travel']
  onboarding_complete boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
create policy "Users can view own profile"   on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = id);

-- ─── income_entries ───────────────────────────────────────────────────────────
-- One row per user per month.
create table public.income_entries (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.user_profiles on delete cascade not null,
  month         text not null,        -- 'YYYY-MM', e.g. '2026-03'
  salary        numeric not null default 0,
  extra_income  jsonb not null default '[]', -- [{id, label, amount}]
  total         numeric generated always as (
                  salary + coalesce((
                    select sum((x->>'amount')::numeric)
                    from jsonb_array_elements(extra_income) x
                  ), 0)
                ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.income_entries enable row level security;
create policy "Users can manage own income" on public.income_entries
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── fixed_expenses ───────────────────────────────────────────────────────────
-- One row per category per user. Updated in place when edited.
create table public.fixed_expenses (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.user_profiles on delete cascade not null,
  key               text not null,         -- e.g. 'rent', 'electricity'
  amount            numeric not null,
  frequency         text not null,         -- 'monthly'|'quarterly'|'biannual'|'yearly'|'weekly'
  monthly_equivalent numeric not null,     -- normalised to per-month for calculations
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.fixed_expenses enable row level security;
create policy "Users can manage own fixed expenses" on public.fixed_expenses
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── spending_categories ──────────────────────────────────────────────────────
-- The user's selected variable spending categories and whether they know their spend.
create table public.spending_categories (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.user_profiles on delete cascade not null,
  key               text not null,         -- e.g. 'groceries', 'transport'
  known             boolean not null default false,
  estimated_amount  numeric,              -- null if known = false
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.spending_categories enable row level security;
create policy "Users can manage own spending categories" on public.spending_categories
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── subscriptions ────────────────────────────────────────────────────────────
create table public.subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.user_profiles on delete cascade not null,
  key         text not null,           -- e.g. 'streaming', 'fitness'
  label       text not null,           -- user-facing name
  status      text not null,           -- 'yes_known' | 'yes_unknown'
  amount      numeric,                 -- null if status = 'yes_unknown'
  needs_check boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.subscriptions enable row level security;
create policy "Users can manage own subscriptions" on public.subscriptions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── goal_targets ─────────────────────────────────────────────────────────────
create table public.goal_targets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.user_profiles on delete cascade not null,
  goal_id     text not null,     -- e.g. 'emergency', 'car', 'travel'
  amount      numeric,           -- null = skipped
  destination text,              -- only populated for travel goal
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, goal_id)
);

alter table public.goal_targets enable row level security;
create policy "Users can manage own goal targets" on public.goal_targets
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── transactions ─────────────────────────────────────────────────────────────
-- Every entry the user logs via the + button.
create table public.transactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.user_profiles on delete cascade not null,
  date            date not null,
  month           text not null,           -- 'YYYY-MM' — derived from date, stored for fast filtering
  category_type   text not null,           -- 'variable'|'fixed'|'subscription'|'goal'|'debt'|'other'
  category_key    text not null,           -- e.g. 'groceries', 'rent', 'emergency'
  category_label  text not null,
  amount          numeric not null,
  note            text,
  created_at      timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "Users can manage own transactions" on public.transactions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index for fast monthly queries
create index transactions_user_month on public.transactions (user_id, month);
create index transactions_user_category on public.transactions (user_id, category_type, category_key);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.user_profiles    for each row execute function handle_updated_at();
create trigger set_updated_at before update on public.income_entries   for each row execute function handle_updated_at();
create trigger set_updated_at before update on public.fixed_expenses   for each row execute function handle_updated_at();
create trigger set_updated_at before update on public.spending_categories for each row execute function handle_updated_at();
create trigger set_updated_at before update on public.subscriptions    for each row execute function handle_updated_at();
create trigger set_updated_at before update on public.goal_targets     for each row execute function handle_updated_at();
