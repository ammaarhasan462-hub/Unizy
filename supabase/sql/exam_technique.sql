-- Exam technique (27 Nov 2026): command words, next-band paragraphs, the student's own slides, real past papers,
-- timing feedback. Also fixes the event whitelist, which was silently dropping the app's own marking events.

-- 1. Events. track_event only counted a fixed list, so mark_submit, mark_done, rewrite_start, exam_open, the tour
--    steps and every prefixed event (itab_, tierf_, rag_, …) were thrown away. Fixed names plus prefixed families.
create or replace function public.track_event(p_event text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
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
                     'hero_subject', 'hero_med_open', 'hero_sample_mark', 'hero_sample_clear',
                     'start_q_open', 'setup_first_q', 'start_sample_clear', 'start_sample_mark',
                     'promo_redeemed', 'share_grade', 'invite_copy', 'invite_share', 'invite_claimed', 'weekly_on', 'weekly_off', 'plan_open', 'email_open', 'guest_limit_seen', 'guest_limit_email', 'hero_limit_seen', 'hero_save_email', 'anchor_shared', 'a2hs_install', 'a2hs_dismiss', 'code_check', 'code_ok', 'code_apply', 'quiz_start', 'quiz_done', 'sba_answer', 'vsa_answer', 'instant_gen',
                     -- the app's own marking funnel (sent by mark.js, never counted before)
                     'mark_submit', 'mark_submit_att', 'mark_rewrite', 'mark_done', 'mark_fail', 'mark_short', 'mark_realmark', 'rewrite_start',
                     'exam_open', 'exam_start', 'exam_date', 'map_start', 'map_ready', 'topic_open', 'step_reveal', 'deck_review',
                     'palette_open', 'palette_go', 'tutor_ask', 'tour_open', 'tour_done', 'tour_replay', 'parse_start', 'parse_done', 'parse_cards',
                     'dash_change_course', 'code_welcome', 'code_welcome_add', 'code_welcome_start', 'intro_view', 'intro_replay', 'lite_auto', 'lite_on', 'lite_off',
                     -- exam technique (this file)
                     'drill_open', 'drill_submit', 'drill_done', 'slides_add', 'slides_done', 'slides_fail', 'slides_delete', 'slides_questions',
                     'paper_open', 'paper_link', 'paper_own', 'paper_saved', 'myq_open', 'timer_start')
     and p_event !~ '^(src|join)_(tiktok|instagram|snapchat|whatsapp|google|bing|youtube|linkedin|reddit|x|facebook|poster|friend|society|email|other|site)$'
     and p_event !~ '^(itab|tierf|wmode|rag|ragf|fmt|card|fc_learn|tour_step|tour_skip|lp_feature|lp_uni|play_switch|intro|intro_pick)_[a-z0-9_]{1,24}$'
     and p_event !~ '^lp_(view|final_signup|hero_drag|hero_spin|hero_try|nav_signup|price_free|price_pro)$' then return; end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ua := coalesce(hdr ->> 'user-agent', '');
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|httpclient|http-client|axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|embedly|monitor|uptime|scan)' then return; end if;
  if auth.uid() is not null and exists (select 1 from analytics_excluded where user_id = auth.uid()) then return; end if;
  insert into site_events (day, event, n) values ((now() at time zone 'Europe/London')::date, p_event, 1)
    on conflict (day, event) do update set n = least(site_events.n + 1, 1000000);
end $function$;

-- 2. Real past papers: links to official, publicly available past-paper pages (we link, we don't copy papers).
--    code = one module; code null + department = a department's archive; both null = a university-wide archive.
create table if not exists public.past_paper_links (
  id bigint generated always as identity primary key,
  uni text not null,
  code text,
  department text,
  title text not null,
  url text not null,
  years text,
  access text not null default 'public' check (access in ('public', 'login')),
  note text,
  checked_at date not null default current_date,
  unique (uni, code, url)
);
create index if not exists past_paper_links_code on public.past_paper_links (code);
create index if not exists past_paper_links_dept on public.past_paper_links (uni, department);
alter table public.past_paper_links enable row level security;
drop policy if exists "past papers read" on public.past_paper_links;
create policy "past papers read" on public.past_paper_links for select using (true);

-- links for a module: its own papers first, then its department's archive, then the university's
create or replace function public.paper_links_for(p_code text)
 returns table (title text, url text, years text, access text, note text, scope text)
 language sql stable security definer set search_path to ''
as $function$
  with m as (select code, uni, department from public.ucl_modules where code = upper(p_code))
  select l.title, l.url, l.years, l.access, l.note,
         case when l.code is not null then 'module' when l.department is not null then 'department' else 'university' end
  from public.past_paper_links l, m
  where l.uni = coalesce(m.uni, 'ucl')
    and (l.code = m.code or (l.code is null and (l.department is null or l.department = m.department)))
  order by (l.code is null), (l.department is null), l.access, l.title
  limit 12
$function$;
grant execute on function public.paper_links_for(text) to anon, authenticated;

-- 3. The student's own questions for a module: real past-paper questions they pasted in, and questions written from
--    their own lecture slides. Private to the student.
create table if not exists public.my_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  question text not null check (length(question) between 10 and 6000),
  source text not null default 'paper' check (source in ('paper', 'slides', 'own')),
  label text,
  marks int,
  created_at timestamptz not null default now()
);
create index if not exists my_questions_user_code on public.my_questions (user_id, code, created_at desc);
alter table public.my_questions enable row level security;
drop policy if exists "own questions" on public.my_questions;
create policy "own questions" on public.my_questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- marked answers remember whether the question was a real past-paper question
alter table public.mark_attempts add column if not exists paper boolean not null default false;

-- 4. The student's own slides (lecture_packs / lecture_chunks, written by the lecture-pack function). Students can
--    see and delete their own uploads; chunks are deleted with their pack.
drop policy if exists "own lecture packs read" on public.lecture_packs;
create policy "own lecture packs read" on public.lecture_packs for select using (auth.uid() = user_id);
drop policy if exists "own lecture packs delete" on public.lecture_packs;
create policy "own lecture packs delete" on public.lecture_packs for delete using (auth.uid() = user_id);
