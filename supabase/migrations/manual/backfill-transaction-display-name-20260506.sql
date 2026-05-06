BEGIN;

-- Preview rows that would be backfilled.
with debt_links as (
  select distinct on (dt.linked_transaction_id)
    dt.linked_transaction_id,
    d.name as debt_name
  from public.debt_transactions dt
  join public.debts d
    on d.id = dt.debt_id
  where dt.linked_transaction_id is not null
  order by dt.linked_transaction_id, dt.created_at desc, dt.id desc
),
candidates as (
  select
    t.id,
    t.display_name as current_display_name,
    t.category_key,
    t.category_label,
    t.category_type,
    case
      when nullif(btrim(to_jsonb(t)->>'name'), '') is not null
        then nullif(btrim(to_jsonb(t)->>'name'), '')
      when nullif(btrim(to_jsonb(t)->>'title'), '') is not null
        then nullif(btrim(to_jsonb(t)->>'title'), '')
      when t.category_type = 'goal' and nullif(btrim(t.category_label), '') is not null
        then nullif(btrim(t.category_label), '')
      when t.category_key = 'debt_opening_balance' and nullif(btrim(dl.debt_name), '') is not null
        then btrim(dl.debt_name) || ' balance'
      when t.category_key = 'debt_repayment' and nullif(btrim(dl.debt_name), '') is not null
        then btrim(dl.debt_name) || ' payment'
      when nullif(btrim(t.category_label), '') is not null
        then nullif(btrim(t.category_label), '')
      else null
    end as proposed_display_name,
    case
      when nullif(btrim(to_jsonb(t)->>'name'), '') is not null
        then 'legacy_name'
      when nullif(btrim(to_jsonb(t)->>'title'), '') is not null
        then 'legacy_title'
      when t.category_type = 'goal' and nullif(btrim(t.category_label), '') is not null
        then 'goal_category_label'
      when t.category_key = 'debt_opening_balance' and nullif(btrim(dl.debt_name), '') is not null
        then 'debt_balance_from_debt_name'
      when t.category_key = 'debt_repayment' and nullif(btrim(dl.debt_name), '') is not null
        then 'debt_payment_from_debt_name'
      when nullif(btrim(t.category_label), '') is not null
        then 'category_label_fallback'
      else 'unresolved'
    end as source_used
  from public.transactions t
  left join debt_links dl
    on dl.linked_transaction_id = t.id
  where t.display_name is null or btrim(t.display_name) = ''
)
select
  id,
  current_display_name,
  proposed_display_name,
  category_key,
  category_label,
  category_type,
  source_used
from candidates
order by source_used, id;

-- Summary counts by source.
with debt_links as (
  select distinct on (dt.linked_transaction_id)
    dt.linked_transaction_id,
    d.name as debt_name
  from public.debt_transactions dt
  join public.debts d
    on d.id = dt.debt_id
  where dt.linked_transaction_id is not null
  order by dt.linked_transaction_id, dt.created_at desc, dt.id desc
),
candidates as (
  select
    case
      when nullif(btrim(to_jsonb(t)->>'name'), '') is not null
        then 'legacy_name'
      when nullif(btrim(to_jsonb(t)->>'title'), '') is not null
        then 'legacy_title'
      when t.category_type = 'goal' and nullif(btrim(t.category_label), '') is not null
        then 'goal_category_label'
      when t.category_key = 'debt_opening_balance' and nullif(btrim(dl.debt_name), '') is not null
        then 'debt_balance_from_debt_name'
      when t.category_key = 'debt_repayment' and nullif(btrim(dl.debt_name), '') is not null
        then 'debt_payment_from_debt_name'
      when nullif(btrim(t.category_label), '') is not null
        then 'category_label_fallback'
      else 'unresolved'
    end as source_used
  from public.transactions t
  left join debt_links dl
    on dl.linked_transaction_id = t.id
  where t.display_name is null or btrim(t.display_name) = ''
)
select
  source_used,
  count(*) as row_count
from candidates
group by source_used
order by source_used;

-- Count rows that would still remain null after the proposed backfill.
with debt_links as (
  select distinct on (dt.linked_transaction_id)
    dt.linked_transaction_id,
    d.name as debt_name
  from public.debt_transactions dt
  join public.debts d
    on d.id = dt.debt_id
  where dt.linked_transaction_id is not null
  order by dt.linked_transaction_id, dt.created_at desc, dt.id desc
),
candidates as (
  select
    t.id,
    case
      when nullif(btrim(to_jsonb(t)->>'name'), '') is not null
        then nullif(btrim(to_jsonb(t)->>'name'), '')
      when nullif(btrim(to_jsonb(t)->>'title'), '') is not null
        then nullif(btrim(to_jsonb(t)->>'title'), '')
      when t.category_type = 'goal' and nullif(btrim(t.category_label), '') is not null
        then nullif(btrim(t.category_label), '')
      when t.category_key = 'debt_opening_balance' and nullif(btrim(dl.debt_name), '') is not null
        then btrim(dl.debt_name) || ' balance'
      when t.category_key = 'debt_repayment' and nullif(btrim(dl.debt_name), '') is not null
        then btrim(dl.debt_name) || ' payment'
      when nullif(btrim(t.category_label), '') is not null
        then nullif(btrim(t.category_label), '')
      else null
    end as proposed_display_name
  from public.transactions t
  left join debt_links dl
    on dl.linked_transaction_id = t.id
  where t.display_name is null or btrim(t.display_name) = ''
)
select
  count(*) as unresolved_row_count
from candidates
where proposed_display_name is null;

-- Backfill only rows that are currently null/blank and have a safe proposed value.
with debt_links as (
  select distinct on (dt.linked_transaction_id)
    dt.linked_transaction_id,
    d.name as debt_name
  from public.debt_transactions dt
  join public.debts d
    on d.id = dt.debt_id
  where dt.linked_transaction_id is not null
  order by dt.linked_transaction_id, dt.created_at desc, dt.id desc
),
candidates as (
  select
    t.id,
    case
      when nullif(btrim(to_jsonb(t)->>'name'), '') is not null
        then nullif(btrim(to_jsonb(t)->>'name'), '')
      when nullif(btrim(to_jsonb(t)->>'title'), '') is not null
        then nullif(btrim(to_jsonb(t)->>'title'), '')
      when t.category_type = 'goal' and nullif(btrim(t.category_label), '') is not null
        then nullif(btrim(t.category_label), '')
      when t.category_key = 'debt_opening_balance' and nullif(btrim(dl.debt_name), '') is not null
        then btrim(dl.debt_name) || ' balance'
      when t.category_key = 'debt_repayment' and nullif(btrim(dl.debt_name), '') is not null
        then btrim(dl.debt_name) || ' payment'
      when nullif(btrim(t.category_label), '') is not null
        then nullif(btrim(t.category_label), '')
      else null
    end as proposed_display_name
  from public.transactions t
  left join debt_links dl
    on dl.linked_transaction_id = t.id
  where t.display_name is null or btrim(t.display_name) = ''
)
update public.transactions t
set display_name = c.proposed_display_name
from candidates c
where t.id = c.id
  and c.proposed_display_name is not null;

COMMIT;
