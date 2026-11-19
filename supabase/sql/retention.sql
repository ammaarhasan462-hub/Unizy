-- Retention (Nov 2026): weekly revision plan (dashboard + Monday email), email preferences / unsubscribe,
-- and referrals (invite a coursemate: you both get 7 days of Pro). No AI calls anywhere here.

create extension if not exists pg_cron;

-- ---------- email preferences ----------
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly boolean not null default true,
  token uuid not null default gen_random_uuid() unique,
  last_weekly date,
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
drop policy if exists "own prefs read" on public.email_prefs;
create policy "own prefs read" on public.email_prefs for select using (auth.uid() = user_id);

create or replace function public.set_weekly_email(p_on boolean)
returns boolean language sql security definer set search_path to 'public' as $$
  insert into email_prefs (user_id, weekly, updated_at) values (auth.uid(), p_on, now())
  on conflict (user_id) do update set weekly = excluded.weekly, updated_at = now() returning weekly
$$;
revoke all on function public.set_weekly_email(boolean) from public, anon;
grant execute on function public.set_weekly_email(boolean) to authenticated;

create or replace function public.unsubscribe_weekly(p_token uuid)
returns boolean language sql security definer set search_path to 'public' as $$
  update email_prefs set weekly = false, updated_at = now() where token = p_token returning true
$$;
revoke all on function public.unsubscribe_weekly(uuid) from public;
grant execute on function public.unsubscribe_weekly(uuid) to anon, authenticated;

-- ---------- weekly revision plan ----------
-- For each of a student's modules that has topics (nearest exam first, then most recently practised, max 3):
-- the 2 weakest topics. Topic score: average predicted mark of their marked answers on it, else their own
-- rating (red 45, amber 58, green 72), else 50 (not started). Lowest first; ties go to the earlier topic.
create or replace function public.weekly_plan(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with mods as (
    select mm.code, mm.exam_date, coalesce(m.title, mm.code) title,
      (select max(created_at) from mark_attempts a where a.user_id = p_user and a.code = mm.code) last_at
    from my_modules mm left join ucl_modules m on m.code = mm.code
    where mm.user_id = p_user and exists (select 1 from module_topics t where t.code = mm.code)
  ), pick as (
    select * from mods order by (exam_date is null or exam_date < current_date), exam_date, last_at desc nulls last, code limit 3
  ), scored as (
    select p.code, t.position, t.title,
      coalesce(
        (select avg(((a.result->>'mark_low')::int + (a.result->>'mark_high')::int) / 2.0) from mark_attempts a
          where a.user_id = p_user and a.code = p.code and a.topic_pos = t.position and a.result ? 'mark_low'),
        (select case r.rating when 'red' then 45 when 'amber' then 58 when 'green' then 72 end from topic_ratings r
          where r.user_id = p_user and r.code = p.code and r.topic_pos = t.position),
        50) score,
      exists (select 1 from mark_attempts a where a.user_id = p_user and a.code = p.code and a.topic_pos = t.position) tried
    from pick p join module_topics t on t.code = p.code
  ), ranked as (
    select *, row_number() over (partition by code order by score, position) rn from scored
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'title', p.title, 'exam_date', p.exam_date,
      'days', case when p.exam_date >= current_date then p.exam_date - current_date end,
      'topics', (select jsonb_agg(jsonb_build_object('pos', r.position, 'title', r.title, 'score', round(r.score), 'tried', r.tried) order by r.rn)
                 from ranked r where r.code = p.code and r.rn <= 2))
    order by (p.exam_date is null or p.exam_date < current_date), p.exam_date, p.last_at desc nulls last, p.code), '[]'::jsonb)
  from pick p
$$;
revoke all on function public.weekly_plan(uuid) from public, anon, authenticated;

create or replace function public.my_weekly_plan()
returns jsonb language sql stable security definer set search_path to 'public' as $$ select public.weekly_plan(auth.uid()) $$;
revoke all on function public.my_weekly_plan() from public, anon;
grant execute on function public.my_weekly_plan() to authenticated;

-- Who gets this week's email (service role only, called by the weekly-email function).
create or replace function public.weekly_email_batch(p_limit int default 90)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare out jsonb := '[]'::jsonb; u record; wk date := date_trunc('week', (now() at time zone 'Europe/London'))::date;
begin
  insert into email_prefs (user_id) select id from auth.users on conflict (user_id) do nothing;
  for u in
    select au.id, au.email, coalesce(au.raw_user_meta_data->>'name', au.raw_user_meta_data->>'full_name', '') nm, ep.token
    from auth.users au join email_prefs ep on ep.user_id = au.id
    where ep.weekly and au.email is not null and au.email_confirmed_at is not null
      and (ep.last_weekly is null or ep.last_weekly < wk) and au.created_at < now() - interval '1 day'
    order by au.created_at limit greatest(1, least(p_limit, 300))
  loop
    out := out || jsonb_build_array(jsonb_build_object('id', u.id, 'email', u.email, 'name', split_part(trim(u.nm), ' ', 1), 'token', u.token,
      'plan', public.weekly_plan(u.id), 'status', public.plan_status(u.id)));
    update email_prefs set last_weekly = wk where user_id = u.id;
  end loop;
  return out;
end $$;
revoke all on function public.weekly_email_batch(int) from public, anon, authenticated;

-- ---------- referrals ----------
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  referee uuid primary key references auth.users(id) on delete cascade,
  referrer uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

create or replace function public.give_pro_days(p_user uuid, p_days int)
returns void language sql security definer set search_path to 'public' as $$
  insert into billing (user_id, pass_plan, pass_until, updated_at) values (p_user, 'exam', now() + make_interval(days => p_days), now())
  on conflict (user_id) do update set pass_plan = coalesce(billing.pass_plan, 'exam'),
    pass_until = greatest(coalesce(billing.pass_until, now()), now()) + make_interval(days => p_days), updated_at = now()
$$;
revoke all on function public.give_pro_days(uuid, int) from public, anon, authenticated;

create or replace function public.my_referral()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); c text; n int;
begin
  if uid is null then return null; end if;
  select code into c from referral_codes where user_id = uid;
  while c is null loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text || uid::text), 1, 7));
    begin insert into referral_codes (user_id, code) values (uid, c); exception when unique_violation then c := null; end;
  end loop;
  select count(*) into n from referrals where referrer = uid;
  return jsonb_build_object('code', c, 'invited', n, 'cap', 10);
end $$;
revoke all on function public.my_referral() from public, anon;
grant execute on function public.my_referral() to authenticated;

-- Called by the new student's dashboard: both get 7 days of Pro. New accounts only (14 days), not yourself,
-- once per student, and at most 10 rewarded invites per referrer.
create or replace function public.claim_referral(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); ref uuid; made timestamptz; n int;
begin
  if uid is null then return jsonb_build_object('ok', false); end if;
  select user_id into ref from referral_codes where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if ref is null or ref = uid then return jsonb_build_object('ok', false, 'message', 'That invite link isn’t valid.'); end if;
  if exists (select 1 from referrals where referee = uid) then return jsonb_build_object('ok', false, 'already', true); end if;
  select created_at into made from auth.users where id = uid;
  if made < now() - interval '14 days' then return jsonb_build_object('ok', false, 'message', 'Invite links are for new accounts.'); end if;
  select count(*) into n from referrals where referrer = ref;
  insert into referrals (referee, referrer) values (uid, ref);
  perform give_pro_days(uid, 7);
  if n < 10 then perform give_pro_days(ref, 7); end if;
  return jsonb_build_object('ok', true, 'message', 'Invite applied: you’ve got 7 days of Pro, and so has the friend who invited you.');
end $$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- new tracked events (Nov 2026)
create or replace function public.track_event(p_event text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare ua text; hdr json;
begin
  if p_event is null or p_event !~ '^[a-z0-9_]{2,40}$' then return; end if;
  if p_event not in ('home_view', 'nav_how', 'nav_signup', 'cta_explore_hero', 'cta_how_hero', 'cta_explore_final', 'cta_signup_final', 'cta_explore_demo', 'cta_signup_demo',
                     'demo_notes', 'demo_quiz', 'demo_quiz_done', 'demo_complete', 'signup_view', 'signup_submit', 'login_view', 'app_view', 'setup_done',
                     'try_sample', 'try_start', 'try_done', 'try_fail', 'try_flip', 'try_quiz', 'try_save', 'try_keep', 'try_module', 'try_module_open', 'try_import',
                     'guest_mark_open', 'guest_mark_submit', 'guest_mark_done', 'guest_mark_fail', 'guest_mark_used', 'guest_mark_signup', 'pack_open', 'try_page',
                     'signup_verified', 'dash_setup_done', 'dash_course_changed', 'guest_mark_claimed',
                     'cta_try_hero', 'guest_save_email', 'signup_oauth_google', 'signup_oauth_azure', 'login_oauth_google', 'login_oauth_azure',
                     'oauth_done', 'oauth_fail', 'setup_uni_guess', 'setup_skip',
                     'hero_sample', 'hero_type', 'hero_mark_submit', 'hero_mark_done', 'hero_mark_fail', 'hero_save', 'hero_find', 'hero_find_open',
                     'start_q_open', 'setup_first_q', 'start_sample_clear', 'start_sample_mark',
                     'promo_redeemed', 'share_grade', 'invite_copy', 'invite_share', 'invite_claimed', 'weekly_on', 'weekly_off', 'plan_open', 'email_open', 'guest_limit_seen', 'guest_limit_email', 'hero_limit_seen', 'hero_save_email', 'anchor_shared', 'a2hs_install', 'a2hs_dismiss', 'code_check', 'code_ok', 'code_apply', 'quiz_start', 'quiz_done', 'sba_answer', 'vsa_answer', 'instant_gen')
     and p_event !~ '^(src|join)_(tiktok|instagram|snapchat|whatsapp|google|bing|youtube|linkedin|reddit|x|facebook|poster|friend|society|email|other|site)$' then return; end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ua := coalesce(hdr ->> 'user-agent', '');
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|httpclient|http-client|axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|embedly|monitor|uptime|scan)' then return; end if;
  if auth.uid() is not null and exists (select 1 from analytics_excluded where user_id = auth.uid()) then return; end if;
  insert into site_events (day, event, n) values ((now() at time zone 'Europe/London')::date, p_event, 1)
    on conflict (day, event) do update set n = least(site_events.n + 1, 1000000);
end $function$;
