alter table public.user_profiles
add column if not exists amount_format_preference text not null default 'smart';

alter table public.user_profiles
drop constraint if exists user_profiles_amount_format_preference_check;

alter table public.user_profiles
add constraint user_profiles_amount_format_preference_check
check (amount_format_preference in ('smart', 'full', 'short'));
