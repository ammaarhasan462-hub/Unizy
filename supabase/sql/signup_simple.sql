-- Simpler sign-up (Nov 2026): track_event also accepts the events the site already sends but the database dropped
-- (signup_verified, dash_setup_done, dash_course_changed, guest_mark_claimed and the guest-marking events from
-- deep_packs_guest_mark.sql, which was never applied to this function), plus the new one-tap sign-in, setup and
-- homepage free-try events. Same checks as before; only the list of names grows.
create or replace function public.track_event(p_event text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare ua text; hdr json;
begin
  if p_event is null or p_event !~ '^[a-z0-9_]{2,40}$' then return; end if;
  if p_event not in ('home_view', 'nav_how', 'nav_signup', 'cta_explore_hero', 'cta_how_hero', 'cta_explore_final', 'cta_signup_final', 'cta_explore_demo', 'cta_signup_demo',
                     'demo_notes', 'demo_quiz', 'demo_quiz_done', 'demo_complete', 'signup_view', 'signup_submit', 'login_view', 'app_view', 'setup_done',
                     'try_sample', 'try_start', 'try_done', 'try_fail', 'try_flip', 'try_quiz', 'try_save', 'try_keep', 'try_module', 'try_module_open', 'try_import',
                     'guest_mark_open', 'guest_mark_submit', 'guest_mark_done', 'guest_mark_fail', 'guest_mark_used', 'guest_mark_signup', 'pack_open', 'try_page',
                     -- sent by the site but dropped until now
                     'signup_verified', 'dash_setup_done', 'dash_course_changed', 'guest_mark_claimed',
                     -- simpler sign-up
                     'cta_try_hero', 'guest_save_email', 'signup_oauth_google', 'signup_oauth_azure', 'login_oauth_google', 'login_oauth_azure',
                     'oauth_done', 'oauth_fail', 'setup_uni_guess', 'setup_skip')
     and p_event !~ '^(src|join)_(tiktok|instagram|snapchat|whatsapp|google|bing|youtube|linkedin|reddit|x|facebook|poster|friend|society|email|other|site)$' then return; end if;
  begin hdr := current_setting('request.headers', true)::json; exception when others then hdr := null; end;
  ua := coalesce(hdr ->> 'user-agent', '');
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|curl|wget|python|httpclient|http-client|axios|node-fetch|go-http|java/|okhttp|facebookexternalhit|embedly|monitor|uptime|scan)' then return; end if;
  if auth.uid() is not null and exists (select 1 from analytics_excluded where user_id = auth.uid()) then return; end if;
  insert into site_events (day, event, n) values ((now() at time zone 'Europe/London')::date, p_event, 1)
    on conflict (day, event) do update set n = least(site_events.n + 1, 1000000);
end $$;
