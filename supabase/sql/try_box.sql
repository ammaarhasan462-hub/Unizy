-- Home page "try it" box and traffic sources (applied as migration home_try_box_and_sources, Nov 2026).
-- try_runs: per-network daily counts for the signed-out try box (net = daily-salted hash, no IPs). Only the try-cards edge function uses it.
create table if not exists public.try_runs (day date not null, net text not null, n integer not null default 0, primary key (day, net));
alter table public.try_runs enable row level security;

create or replace function public.try_take(p_net text, p_per_net integer default 3, p_daily integer default 300)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s public.ai_settings; v_day date := (now() at time zone 'Europe/London')::date; spent numeric; total int; used int;
begin
  select * into s from public.ai_settings where id;
  select coalesce(usd, 0) into spent from public.ai_spend where day = v_day;
  if coalesce(spent, 0) >= s.daily_budget_gbp * s.usd_per_gbp then return jsonb_build_object('ok', false, 'reason', 'budget'); end if;
  select coalesce(sum(n), 0) into total from public.try_runs where day = v_day;
  if total >= p_daily then return jsonb_build_object('ok', false, 'reason', 'global'); end if;
  insert into public.try_runs (day, net, n) values (v_day, p_net, 0) on conflict (day, net) do nothing;
  update public.try_runs set n = n + 1 where day = v_day and net = p_net and n + 1 <= p_per_net returning n into used;
  if used is null then return jsonb_build_object('ok', false, 'reason', 'net'); end if;
  delete from public.try_runs where day < v_day - 2;
  return jsonb_build_object('ok', true, 'left', p_per_net - used);
end $$;

create or replace function public.try_refund(p_net text)
returns void language sql security definer set search_path to '' as $$
  update public.try_runs set n = greatest(n - 1, 0) where day = (now() at time zone 'Europe/London')::date and net = p_net;
$$;
revoke all on function public.try_take(text, integer, integer) from public, anon, authenticated;
revoke all on function public.try_refund(text) from public, anon, authenticated;

-- track_event now also accepts try_* events and src_<source> / join_<source> (see funnel.sql for the rest of the function).
