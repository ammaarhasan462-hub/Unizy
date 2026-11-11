-- Deep module packs and "try one marked answer without signing up" (applied as migration deep_packs_guest_mark, Nov 2026).

-- module_packs: modules that have a full pack (more questions per topic, an example answer plan for every exam-style and
-- First-class question, all checked in a second pass). Public read so pages can show which modules are full packs.
create table if not exists public.module_packs (
  code text primary key references public.ucl_modules(code) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  questions integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
alter table public.module_packs enable row level security;
drop policy if exists "module_packs public read" on public.module_packs;
create policy "module_packs public read" on public.module_packs for select to anon, authenticated using (status = 'done');
comment on table public.module_packs is 'Modules with a full, checked pack of practice questions and example answer plans. Written only by the marker function (deepen action).';

-- guest_marks: per-network daily count of free marked answers for signed-out visitors (net = daily-salted hash, no IPs).
create table if not exists public.guest_marks (day date not null, net text not null, n integer not null default 0, primary key (day, net));
alter table public.guest_marks enable row level security;
comment on table public.guest_marks is 'Signed-out "try one marked answer" uses per network per day (daily-salted hash, not an IP). Only the marker function reads or writes it. Rows older than 2 days are deleted.';

create or replace function public.guest_mark_take(p_net text, p_per_net integer default 2, p_daily integer default 60)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s public.ai_settings; v_day date := (now() at time zone 'Europe/London')::date; spent numeric; total int; used int;
begin
  select * into s from public.ai_settings where id;
  select coalesce(usd, 0) into spent from public.ai_spend where day = v_day;
  if coalesce(spent, 0) >= s.daily_budget_gbp * s.usd_per_gbp then return jsonb_build_object('ok', false, 'reason', 'budget'); end if;
  select coalesce(sum(n), 0) into total from public.guest_marks where day = v_day;
  if total >= p_daily then return jsonb_build_object('ok', false, 'reason', 'global'); end if;
  insert into public.guest_marks (day, net, n) values (v_day, p_net, 0) on conflict (day, net) do nothing;
  update public.guest_marks set n = n + 1 where day = v_day and net = p_net and n + 1 <= p_per_net returning n into used;
  if used is null then return jsonb_build_object('ok', false, 'reason', 'net'); end if;
  delete from public.guest_marks where day < v_day - 2;
  return jsonb_build_object('ok', true, 'left', p_per_net - used);
end $$;
create or replace function public.guest_mark_refund(p_net text)
returns void language sql security definer set search_path to '' as $$
  update public.guest_marks set n = greatest(n - 1, 0) where day = (now() at time zone 'Europe/London')::date and net = p_net;
$$;
revoke all on function public.guest_mark_take(text, integer, integer) from public, anon, authenticated;
revoke all on function public.guest_mark_refund(text) from public, anon, authenticated;

-- track_event: also accept the guest-marking and full-pack events
create or replace function public.track_event(p_event text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare ua text; hdr json;
begin
  if p_event is null or p_event !~ '^[a-z0-9_]{2,40}$' then return; end if;
  if p_event not in ('home_view', 'nav_how', 'nav_signup', 'cta_explore_hero', 'cta_how_hero', 'cta_explore_final', 'cta_signup_final', 'cta_explore_demo', 'cta_signup_demo',
                     'demo_notes', 'demo_quiz', 'demo_quiz_done', 'demo_complete', 'signup_view', 'signup_submit', 'login_view', 'app_view', 'setup_done',
                     'try_sample', 'try_start', 'try_done', 'try_fail', 'try_flip', 'try_quiz', 'try_save', 'try_keep', 'try_module', 'try_module_open', 'try_import',
                     'guest_mark_open', 'guest_mark_submit', 'guest_mark_done', 'guest_mark_fail', 'guest_mark_used', 'guest_mark_signup', 'pack_open', 'try_page')
     and p_event !~ '^(src|join)_(tiktok|instagram|snapchat|whatsapp|google|bing|youtube|linkedin|reddit|x|facebook|poster|friend|society|email|other|site)$' then return; end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ua := coalesce(hdr ->> 'user-agent', '');
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|httpclient|http-client|axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|embedly|monitor|uptime|scan)' then return; end if;
  if auth.uid() is not null and exists (select 1 from analytics_excluded where user_id = auth.uid()) then return; end if;
  insert into site_events (day, event, n) values ((now() at time zone 'Europe/London')::date, p_event, 1)
    on conflict (day, event) do update set n = least(site_events.n + 1, 1000000);
end $$;

-- ops_keys: keys for owner-only batch jobs (e.g. the marker's deepen action). No policies: only the service role can read it.
create table if not exists public.ops_keys (name text primary key, key text not null, created_at timestamptz not null default now());
alter table public.ops_keys enable row level security;
comment on table public.ops_keys is 'Keys for owner-only batch jobs. Service role only (no RLS policies).';
