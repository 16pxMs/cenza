alter table public.debts
  add column if not exists standard_due_date date;
