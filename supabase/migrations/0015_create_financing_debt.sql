create or replace function public.create_financing_debt(
  p_name text,
  p_total_cost numeric,
  p_upfront_paid numeric,
  p_currency text,
  p_target_date date,
  p_note text default null::text
)
returns public.debts
language plpgsql
as $function$
declare
  v_user_id uuid := auth.uid();
  v_debt public.debts;
  v_debt_id uuid;
  v_transaction_id uuid;
  v_normalized_name text;
  v_remaining numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'Debt name is required';
  end if;

  if trim(coalesce(p_currency, '')) = '' then
    raise exception 'Currency is required';
  end if;

  if p_total_cost is null or p_total_cost <= 0 then
    raise exception 'Total cost must be greater than 0';
  end if;

  if p_upfront_paid is null or p_upfront_paid < 0 then
    raise exception 'Upfront paid must be 0 or greater';
  end if;

  if p_upfront_paid >= p_total_cost then
    raise exception 'Upfront paid must be less than total cost';
  end if;

  v_remaining := p_total_cost - p_upfront_paid;
  v_normalized_name := regexp_replace(lower(trim(p_name)), '\s+', ' ', 'g');

  insert into public.debts (
    user_id,
    name,
    normalized_name,
    direction,
    currency,
    debt_kind,
    financing_total_cost,
    financing_target_date,
    note
  )
  values (
    v_user_id,
    trim(p_name),
    v_normalized_name,
    'owed_by_me',
    upper(trim(p_currency)),
    'financing',
    p_total_cost,
    p_target_date,
    p_note
  )
  returning id
  into v_debt_id;

  insert into public.debt_transactions (
    user_id,
    debt_id,
    entry_type,
    amount,
    currency,
    transaction_date,
    note
  )
  values (
    v_user_id,
    v_debt_id,
    'principal_increase',
    v_remaining,
    upper(trim(p_currency)),
    current_date,
    p_note
  )
  returning id
  into v_transaction_id;

  update public.debts
  set financing_principal_tx_id = v_transaction_id
  where id = v_debt_id;

  select *
  into v_debt
  from public.debts
  where id = v_debt_id;

  return v_debt;
end;
$function$;
