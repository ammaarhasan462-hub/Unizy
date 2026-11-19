-- Medicine and dentistry: exams there are single best answer (SBA) and very short answer (VSA) questions, not essays.
-- ucl_modules.exam_format = 'sba' switches a module to instant questions, marked in the browser with no wait:
--   kind 'vsa' (tier foundation): answer = the expected 1-5 word answer, accept = other accepted answers, explain
--   kind 'sba' (tier exam / first): question = stem + lead-in, options = 5 options, answer = correct letter A-E, explain
-- Applies to MBBS / BDS degree modules at every university (UCL Medical School, Imperial School of Medicine,
-- Queen Mary School of Medicine and Dentistry / Institute of Dentistry, King's GKT medicine and dentistry when listed).
alter table ucl_modules add column if not exists exam_format text;
alter table module_questions add column if not exists options jsonb;
alter table module_questions add column if not exists accept jsonb;
alter table module_questions add column if not exists explain text;
alter table module_questions drop constraint if exists module_questions_kind_check;
alter table module_questions add constraint module_questions_kind_check check (kind in ('essay', 'problem', 'short', 'recall', 'sba', 'vsa'));

update ucl_modules set exam_format = 'sba'
where (uni = 'ucl' and (department = 'UCL Medical School' or code ~ '^MBBS[0-9]'))
   or (uni = 'imperial' and (department = 'School of Medicine' or code ~ '^MEDI[0-9]'))
   or (uni = 'qmul' and department in ('School of Medicine and Dentistry', 'Institute of Dentistry'))
   or (uni = 'kcl' and (department ~* '(GKT|medical education|dentistry|dental)' or faculty ~* '(life sciences & medicine.*medical education|dentistry)'));

-- writing the instant questions for a module that already has a Module Map (one job per module)
create table if not exists instant_jobs (
  code text primary key,
  status text not null default 'running',
  tries int not null default 1,
  requested_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
alter table instant_jobs enable row level security; -- service role only

create or replace function claim_instant_job(p_code text, p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare r instant_jobs;
begin
  select * into r from instant_jobs where code = p_code for update;
  if not found then
    insert into instant_jobs (code, requested_by) values (p_code, p_user);
    return true;
  end if;
  if r.status = 'done' then return false; end if;
  if r.status = 'running' and r.started_at > now() - interval '4 minutes' then return false; end if;
  if r.status = 'failed' and r.tries >= 4 then return false; end if;
  update instant_jobs set status = 'running', tries = r.tries + 1, started_at = now(), finished_at = null, error = null, requested_by = p_user where code = p_code;
  return true;
end $$;
revoke all on function claim_instant_job(text, uuid) from public, anon, authenticated;

-- quiz events (mirrored in retention.sql)
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
