create table public.goal_milestones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.user_profiles on delete cascade not null,
  goal_id text not null,
  name text not null,
  amount numeric not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, goal_id, amount)
);

create index goal_milestones_user_goal_idx on public.goal_milestones (user_id, goal_id, sort_order, amount);

alter table public.goal_milestones enable row level security;
create policy "Users can manage own goal milestones" on public.goal_milestones
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_updated_at before update on public.goal_milestones
for each row execute function handle_updated_at();
