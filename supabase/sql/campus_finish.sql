-- Run once in Supabase → SQL Editor to finish the campus features (the rest of campus.sql is already applied).
-- These statements needed a confirmation step that couldn't be approved from the chat.


create or replace function public.hub_toggle(p_post bigint, p_what text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; p public.hub_posts; was boolean;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  select * into p from public.hub_posts where id = p_post and status = 'live';
  if not found or vu is null or p.uni <> vu then return jsonb_build_object('ok', false, 'message', 'That post isn’t available.'); end if;
  if p_what = 'vote' then
    if p.user_id = me then return jsonb_build_object('ok', false, 'message', 'You can’t mark your own post as helpful.'); end if;
    delete from public.hub_votes where post_id = p_post and user_id = me returning true into was;
    if was then update public.hub_posts set score = greatest(0, score - 1) where id = p_post;
    else insert into public.hub_votes values (p_post, me); update public.hub_posts set score = score + 1 where id = p_post; end if;
  elsif p_what = 'save' then
    -- saving is one-way: once a copy is in your module it stays counted
    insert into public.hub_saves values (p_post, me) on conflict do nothing;
    if found then update public.hub_posts set saves = saves + 1 where id = p_post; end if;
    was := false;
  else raise exception 'bad toggle'; end if;
  return jsonb_build_object('ok', true, 'on', not coalesce(was, false));
end $$;


create or replace function public.hub_delete(p_kind text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_kind = 'post' then
    update public.hub_posts set status = 'removed' where id = p_id and user_id = me;
  elsif p_kind = 'reply' then
    update public.hub_replies set status = 'removed' where id = p_id and user_id = me returning post_id into pid;
    if pid is not null then update public.hub_posts set reply_count = greatest(0, reply_count - 1) where id = pid; end if;
  end if;
  return jsonb_build_object('ok', found, 'message', case when found then 'Removed.' else 'You can only remove your own posts.' end);
end $$;


create or replace function public.focus_leave() returns void
language sql security definer set search_path = '' as $$
  delete from public.focus_presence where user_id = auth.uid()
$$;


create or replace function public.focus_state(p_module_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
  wk timestamptz := date_trunc('week', now() at time zone 'Europe/London') at time zone 'Europe/London';
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  delete from public.focus_presence where last_seen < now() - interval '10 minutes';
  return jsonb_build_object(
    'verified', vu is not null, 'uni', vu,
    'public', coalesce((select focus_public from public.profiles where user_id = me), true),
    'myWeek', coalesce((select jsonb_agg(jsonb_build_object('module', module_name, 'key', module_key, 'minutes', m) order by m desc) from (
        select module_key, max(module_name) module_name, sum(minutes) m from public.focus_sessions where user_id = me and ended_at >= wk group by module_key) s), '[]'::jsonb),
    'myDays', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'minutes', m) order by d) from (
        select (ended_at at time zone 'Europe/London')::date d, sum(minutes) m from public.focus_sessions where user_id = me and ended_at >= now() - interval '28 days' group by 1) s), '[]'::jsonb),
    'room', case when vu is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.display_name, ''), 'A student'), 'me', f.user_id = me, 'phase', f.phase, 'endsAt', f.ends_at, 'since', f.started_at) order by f.started_at)
        from public.focus_presence f left join public.profiles p on p.user_id = f.user_id
        where f.uni = vu and f.module_key = k and f.last_seen > now() - interval '90 seconds'), '[]'::jsonb) end,
    'uniNow', case when vu is null then 0 else (select count(*) from public.focus_presence f where f.uni = vu and f.last_seen > now() - interval '90 seconds' and f.phase = 'focus') end,
    'board', case when vu is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.display_name, ''), 'A student'), 'me', s.user_id = me, 'minutes', s.m) order by s.m desc) from (
        select user_id, sum(minutes) m from public.focus_sessions where uni = vu and module_key = k and ended_at >= wk group by user_id order by m desc limit 10) s
        join public.profiles p on p.user_id = s.user_id where p.focus_public or s.user_id = me), '[]'::jsonb) end,
    'moduleWeek', case when vu is null then 0 else (select coalesce(sum(minutes), 0) from public.focus_sessions where uni = vu and module_key = k and ended_at >= wk) end
  );
end $$;


drop policy if exists "market upload own" on storage.objects;
create policy "market upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'market' and (storage.foldername(name))[1] = (select auth.uid())::text and public._vuni((select auth.uid())) is not null);
drop policy if exists "market delete own" on storage.objects;
create policy "market delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'market' and (storage.foldername(name))[1] = (select auth.uid())::text);


revoke all on function public._vuni(uuid) from public, anon;
grant execute on function public._vuni(uuid) to authenticated;
revoke all on function public._who(uuid) from public, anon, authenticated;
revoke all on function public._listing_json(public.market_listings, uuid) from public, anon, authenticated;


-- only signed-in students call these
do $$ declare f text; begin
  foreach f in array array['verify_status()', 'hub_state(text,text,text,text)', 'hub_post(text,text,text,text,text,jsonb)', 'hub_thread(bigint)', 'hub_reply(bigint,text)',
    'hub_toggle(bigint,text)', 'hub_delete(text,bigint)', 'market_list(text,text,boolean)', 'market_save(bigint,text,text,text,integer,text,text,text,text,text[])',
    'market_set_status(bigint,text)', 'market_contact(bigint,text)', 'market_send(bigint,text)', 'market_inbox()', 'market_messages_for(bigint,bigint)',
    'focus_ping(text,text,text,timestamptz)', 'focus_leave()', 'focus_log(text,text,integer)', 'focus_state(text)', 'focus_set_public(boolean)', 'campus_report(text,bigint,text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
