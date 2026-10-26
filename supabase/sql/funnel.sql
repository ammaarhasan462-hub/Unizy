-- Visitor-to-active-user funnel. Anonymous visits are stored only as daily totals per event (no cookies, no IDs).
create table if not exists public.site_events (
  day date not null default ((now() at time zone 'Europe/London')::date),
  event text not null,
  n integer not null default 0,
  primary key (day, event)
);
alter table public.site_events enable row level security;
comment on table public.site_events is 'Anonymous daily totals of site events (page views, demo steps, button clicks). No identifiers. Written only by track_event().';

create table if not exists public.user_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.user_activity enable row level security;
comment on table public.user_activity is 'Days on which a signed-in user opened the app. Used to measure whether new users come back. Deleted with the account.';

create table if not exists public.analytics_excluded (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  note text
);
alter table public.analytics_excluded enable row level security;
comment on table public.analytics_excluded is 'Accounts left out of usage figures (the owner and test accounts). is_admin can read the funnel report.';

insert into public.analytics_excluded (user_id, is_admin, note)
  select id, true, 'owner' from auth.users where lower(email) = 'ammaarhasan462@gmail.com'
  on conflict (user_id) do update set is_admin = true;

create or replace function public.track_event(p_event text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare ua text; hdr json;
begin
  if p_event is null or p_event !~ '^[a-z0-9_]{2,40}$' then return; end if;
  if p_event not in ('home_view', 'nav_how', 'nav_signup', 'cta_explore_hero', 'cta_how_hero', 'cta_explore_final', 'cta_signup_final', 'cta_explore_demo', 'cta_signup_demo',
                     'demo_notes', 'demo_quiz', 'demo_quiz_done', 'demo_complete', 'signup_view', 'signup_submit', 'login_view', 'app_view', 'setup_done') then return; end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ua := coalesce(hdr ->> 'user-agent', '');
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|httpclient|http-client|axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|embedly|monitor|uptime|scan)' then return; end if;
  if auth.uid() is not null and exists (select 1 from analytics_excluded where user_id = auth.uid()) then return; end if;
  insert into site_events (day, event, n) values ((now() at time zone 'Europe/London')::date, p_event, 1)
    on conflict (day, event) do update set n = least(site_events.n + 1, 1000000);
end $$;

create or replace function public.touch_activity()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('ok', false); end if;
  insert into user_activity (user_id, day) values (me, (now() at time zone 'Europe/London')::date) on conflict do nothing;
  return jsonb_build_object('ok', true, 'excluded', exists (select 1 from analytics_excluded where user_id = me));
end $$;

create or replace function public.funnel_report(p_days integer default 28)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); since date; ev jsonb; daily jsonb; acc jsonb; cohorts jsonb;
begin
  if me is null or not exists (select 1 from analytics_excluded where user_id = me and is_admin) then
    return jsonb_build_object('ok', false, 'message', 'Not available.');
  end if;
  since := (now() at time zone 'Europe/London')::date - greatest(1, least(coalesce(p_days, 28), 365)) + 1;
  select coalesce(jsonb_object_agg(event, total), '{}'::jsonb) into ev from (select event, sum(n) as total from site_events where day >= since group by event) e;
  select coalesce(jsonb_agg(jsonb_build_object('day', day, 'views', views, 'demo', demo, 'signupView', sv, 'submits', sub) order by day), '[]'::jsonb) into daily from (
    select day, sum(n) filter (where event = 'home_view') as views, sum(n) filter (where event = 'demo_notes') as demo,
           sum(n) filter (where event = 'signup_view') as sv, sum(n) filter (where event = 'signup_submit') as sub
    from site_events where day >= since group by day) d;
  with u as (
    select au.id, au.created_at, au.email_confirmed_at,
      (select value from user_store us where us.user_id = au.id and us.key = 'unizy:start') as st,
      exists (select 1 from user_store us where us.user_id = au.id and us.key = 'unizy:setup') as has_setup,
      exists (select 1 from ai_usage a where a.user_id = au.id) as used_ai
    from auth.users au
    where au.created_at >= since and not exists (select 1 from analytics_excluded x where x.user_id = au.id)
  ), f as (
    select u.*,
      (coalesce((st->>'cards')::int, 0) >= 10 or coalesce((st->>'test')::int, 0) > 0 or coalesce((st->>'ask')::int, 0) > 0 or (st ? 'plan') or (st ? 'lecture') or used_ai) as first_result,
      exists (select 1 from user_activity ua where ua.user_id = u.id and ua.day > (u.created_at at time zone 'Europe/London')::date and ua.day <= (u.created_at at time zone 'Europe/London')::date + 7) as returned,
      (u.created_at <= now() - interval '7 days') as week_over
    from u
  )
  select jsonb_build_object(
      'signups', count(*), 'confirmed', count(*) filter (where email_confirmed_at is not null), 'setup', count(*) filter (where has_setup),
      'firstResult', count(*) filter (where first_result), 'returned', count(*) filter (where returned and week_over), 'returnEligible', count(*) filter (where week_over)),
    coalesce((select jsonb_agg(c order by c->>'week') from (
      select jsonb_build_object('week', to_char(date_trunc('week', created_at at time zone 'Europe/London'), 'YYYY-MM-DD'), 'signups', count(*),
        'firstResult', count(*) filter (where first_result), 'returned', count(*) filter (where returned and week_over), 'eligible', count(*) filter (where week_over)) as c
      from f group by date_trunc('week', created_at at time zone 'Europe/London')) cc), '[]'::jsonb)
    into acc, cohorts from f;
  return jsonb_build_object('ok', true, 'since', since, 'events', ev, 'daily', daily, 'accounts', acc, 'cohorts', cohorts,
    'activeThisWeek', (select count(distinct ua.user_id) from user_activity ua where ua.day > (now() at time zone 'Europe/London')::date - 7 and not exists (select 1 from analytics_excluded x where x.user_id = ua.user_id)));
end $$;

revoke all on function public.track_event(text) from public;
revoke all on function public.touch_activity() from public, anon;
revoke all on function public.funnel_report(integer) from public, anon;
grant execute on function public.track_event(text) to anon, authenticated;
grant execute on function public.touch_activity() to authenticated;
grant execute on function public.funnel_report(integer) to authenticated;
