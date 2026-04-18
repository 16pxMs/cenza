-- Debt system snapshot from live Supabase schema.
-- This migration captures only debt-related objects and fixes the
-- authenticated add_my_debt_transaction wrapper to use auth.uid().

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  normalized_name text not null,
  direction text not null check (direction = any (array['owed_by_me'::text, 'owed_to_me'::text])),
  currency text not null,
  current_balance numeric not null default 0 check (current_balance >= 0::numeric),
  status text not null default 'active'::text check (status = any (array['active'::text, 'cleared'::text, 'cancelled'::text])),
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.debt_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  debt_id uuid not null references public.debts(id),
  entry_type text not null check (
    entry_type = any (
      array[
        'principal_increase'::text,
        'payment_in'::text,
        'payment_out'::text,
        'adjustment_increase'::text,
        'adjustment_decrease'::text
      ]
    )
  ),
  amount numeric not null check (amount > 0::numeric),
  currency text not null,
  transaction_date date not null,
  note text,
  linked_transaction_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists debts_user_id_idx
  on public.debts (user_id);

create unique index if not exists debts_user_active_name_idx
  on public.debts (user_id, normalized_name)
  where status = 'active'::text;

create index if not exists debt_transactions_user_id_idx
  on public.debt_transactions (user_id);

create index if not exists debt_transactions_debt_id_idx
  on public.debt_transactions (debt_id);

create index if not exists debt_transactions_linked_transaction_id_idx
  on public.debt_transactions (linked_transaction_id);

create or replace function public.recompute_debt_snapshot(p_debt_id uuid)
returns table(debt_id uuid, current_balance numeric, status text)
language plpgsql
as $function$
declare
  v_balance numeric(14,2);
  v_status text;
begin
  if not exists (
    select 1
    from debts d
    where d.id = p_debt_id
  ) then
    raise exception 'Debt % does not exist', p_debt_id;
  end if;

  select coalesce(sum(
    case
      when dt.entry_type in ('principal_increase', 'adjustment_increase') then dt.amount
      when dt.entry_type in ('payment_in', 'payment_out', 'adjustment_decrease') then -dt.amount
      else 0
    end
  ), 0)
  into v_balance
  from debt_transactions dt
  where dt.debt_id = p_debt_id;

  if v_balance < 0 then
    raise exception 'Debt % would have negative balance (%)', p_debt_id, v_balance;
  end if;

  v_status := case
    when v_balance = 0 then 'cleared'
    else 'active'
  end;

  update debts d
  set
    current_balance = v_balance,
    status = case
      when d.status = 'cancelled' then d.status
      else v_status
    end
  where d.id = p_debt_id;

  return query
  select d.id, d.current_balance, d.status
  from debts d
  where d.id = p_debt_id;
end;
$function$;

create or replace function public.trigger_recompute_debt_snapshot()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' then
    perform recompute_debt_snapshot(old.debt_id);
    return old;
  else
    perform recompute_debt_snapshot(new.debt_id);
    return new;
  end if;
end;
$function$;

create or replace function public.add_debt_transaction(
  p_user_id uuid,
  p_debt_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_currency text,
  p_transaction_date date,
  p_note text default null::text,
  p_linked_transaction_id uuid default null::uuid
)
returns debt_transactions
language plpgsql
as $function$
declare
  v_tx debt_transactions;
begin
  if p_entry_type not in (
    'principal_increase',
    'payment_in',
    'payment_out',
    'adjustment_increase',
    'adjustment_decrease'
  ) then
    raise exception 'Invalid debt entry type: %', p_entry_type;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Debt transaction amount must be greater than 0';
  end if;

  if p_transaction_date is null then
    raise exception 'Transaction date is required';
  end if;

  insert into debt_transactions (
    user_id,
    debt_id,
    entry_type,
    amount,
    currency,
    transaction_date,
    note,
    linked_transaction_id
  )
  values (
    p_user_id,
    p_debt_id,
    p_entry_type,
    p_amount,
    upper(trim(p_currency)),
    p_transaction_date,
    p_note,
    p_linked_transaction_id
  )
  returning *
  into v_tx;

  return v_tx;
end;
$function$;

create or replace function public.delete_debt_transaction(p_transaction_id uuid, p_user_id uuid)
returns void
language plpgsql
as $function$
begin
  delete from debt_transactions
  where id = p_transaction_id
    and user_id = p_user_id;

  if not found then
    raise exception 'Debt transaction not found or not owned by user';
  end if;
end;
$function$;

create or replace function public.create_debt(
  p_user_id uuid,
  p_name text,
  p_direction text,
  p_currency text,
  p_note text default null::text
)
returns debts
language plpgsql
as $function$
declare
  v_debt debts;
  v_normalized_name text;
begin
  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Debt name is required';
  end if;

  if p_direction not in ('owed_by_me', 'owed_to_me') then
    raise exception 'Invalid debt direction: %', p_direction;
  end if;

  if trim(coalesce(p_currency, '')) = '' then
    raise exception 'Currency is required';
  end if;

  v_normalized_name := regexp_replace(lower(trim(p_name)), '\s+', ' ', 'g');

  insert into debts (
    user_id,
    name,
    normalized_name,
    direction,
    currency,
    note
  )
  values (
    p_user_id,
    trim(p_name),
    v_normalized_name,
    p_direction,
    upper(trim(p_currency)),
    p_note
  )
  returning *
  into v_debt;

  return v_debt;
end;
$function$;

create or replace function public.create_my_debt(
  p_name text,
  p_direction text,
  p_currency text,
  p_note text default null::text
)
returns debts
language plpgsql
as $function$
declare
  v_debt debts;
  v_user_id uuid := auth.uid();
  v_normalized_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Debt name is required';
  end if;

  if p_direction not in ('owed_by_me', 'owed_to_me') then
    raise exception 'Invalid debt direction: %', p_direction;
  end if;

  if trim(coalesce(p_currency, '')) = '' then
    raise exception 'Currency is required';
  end if;

  v_normalized_name := regexp_replace(lower(trim(p_name)), '\s+', ' ', 'g');

  insert into debts (
    user_id,
    name,
    normalized_name,
    direction,
    currency,
    note
  )
  values (
    v_user_id,
    trim(p_name),
    v_normalized_name,
    p_direction,
    upper(trim(p_currency)),
    p_note
  )
  returning *
  into v_debt;

  return v_debt;
end;
$function$;

create or replace function public.get_my_debt(p_debt_id uuid)
returns setof debts
language sql
as $function$
  select *
  from debts
  where id = p_debt_id
  and user_id = auth.uid();
$function$;

create or replace function public.get_my_debt(p_user_id uuid, p_debt_id uuid)
returns setof debts
language sql
as $function$
  select *
  from debts
  where id = p_debt_id
    and user_id = p_user_id;
$function$;

create or replace function public.get_my_debt_transactions(p_debt_id uuid)
returns setof debt_transactions
language sql
as $function$
  select *
  from debt_transactions
  where debt_id = p_debt_id
  and user_id = auth.uid()
  order by transaction_date desc, created_at desc;
$function$;

create or replace function public.get_my_debt_transactions(p_user_id uuid, p_debt_id uuid)
returns setof debt_transactions
language sql
as $function$
  select *
  from debt_transactions
  where debt_id = p_debt_id
    and user_id = p_user_id
  order by transaction_date desc, created_at desc;
$function$;

create or replace function public.delete_my_debt_transaction(p_transaction_id uuid)
returns void
language plpgsql
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from debt_transactions
  where id = p_transaction_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Debt transaction not found or not owned by current user';
  end if;
end;
$function$;

create or replace function public.update_debt_transaction(
  p_transaction_id uuid,
  p_user_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_transaction_date date,
  p_note text default null::text
)
returns debt_transactions
language plpgsql
as $function$
declare
  v_tx debt_transactions;
begin
  if p_entry_type not in (
    'principal_increase',
    'payment_in',
    'payment_out',
    'adjustment_increase',
    'adjustment_decrease'
  ) then
    raise exception 'Invalid debt entry type: %', p_entry_type;
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Debt transaction amount must be greater than 0';
  end if;

  if p_transaction_date is null then
    raise exception 'Transaction date is required';
  end if;

  update debt_transactions
  set
    entry_type = p_entry_type,
    amount = p_amount,
    transaction_date = p_transaction_date,
    note = p_note
  where id = p_transaction_id
    and user_id = p_user_id
  returning *
  into v_tx;

  if v_tx.id is null then
    raise exception 'Debt transaction not found or not owned by user';
  end if;

  return v_tx;
end;
$function$;

create or replace function public.validate_debt_transaction_currency()
returns trigger
language plpgsql
as $function$
declare
  v_debt_currency text;
begin
  select d.currency
  into v_debt_currency
  from debts d
  where d.id = new.debt_id;

  if v_debt_currency is null then
    raise exception 'Debt % does not exist', new.debt_id;
  end if;

  if new.currency <> v_debt_currency then
    raise exception 'Debt transaction currency % does not match debt currency %',
      new.currency, v_debt_currency;
  end if;

  return new;
end;
$function$;

create or replace function public.prevent_debt_transaction_debt_change()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'UPDATE' and old.debt_id <> new.debt_id then
    raise exception 'Changing debt_id on an existing debt transaction is not allowed';
  end if;

  return new;
end;
$function$;

create or replace function public.add_my_debt_transaction(
  p_debt_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_currency text,
  p_transaction_date date,
  p_note text default null::text,
  p_linked_transaction_id uuid default null::uuid
)
returns debt_transactions
language plpgsql
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from debts d
    where d.id = p_debt_id
      and d.user_id = v_user_id
  ) then
    raise exception 'Debt not found or not owned by current user';
  end if;

  return public.add_debt_transaction(
    v_user_id,
    p_debt_id,
    p_entry_type,
    p_amount,
    p_currency,
    p_transaction_date,
    p_note,
    p_linked_transaction_id
  );
end;
$function$;

drop trigger if exists trg_debts_set_updated_at on public.debts;
create trigger trg_debts_set_updated_at
before update on public.debts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_debt_transactions_set_updated_at on public.debt_transactions;
create trigger trg_debt_transactions_set_updated_at
before update on public.debt_transactions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_prevent_debt_transaction_debt_change on public.debt_transactions;
create trigger trg_prevent_debt_transaction_debt_change
before update on public.debt_transactions
for each row
execute function public.prevent_debt_transaction_debt_change();

drop trigger if exists trg_recompute_debt_snapshot on public.debt_transactions;
create trigger trg_recompute_debt_snapshot
after insert or delete or update on public.debt_transactions
for each row
execute function public.trigger_recompute_debt_snapshot();

drop trigger if exists trg_validate_debt_transaction_currency on public.debt_transactions;
create trigger trg_validate_debt_transaction_currency
before insert or update on public.debt_transactions
for each row
execute function public.validate_debt_transaction_currency();
