
alter table public.chat_messages add column if not exists payload jsonb;
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check check (kind = any (array['user','ai','system','share']));

create table if not exists public.share_marks (
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.share_marks enable row level security;
comment on table public.share_marks is 'Per-person progress on things shared in group chats (quiz scores, seminar-prep ticks, saved card sets). Read and written only through security-definer RPCs that check group membership.';

create or replace function public.post_share(p_group uuid, p_type text, p_title text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); t text := trim(coalesce(p_title, '')); mid bigint; summary text; n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not _is_member(p_group, me) then return jsonb_build_object('ok', false, 'message', 'You’re not in that group any more.'); end if;
  if p_type not in ('cards', 'quiz', 'prep', 'note') then return jsonb_build_object('ok', false, 'message', 'That can’t be shared.'); end if;
  if char_length(t) < 1 or char_length(t) > 140 then return jsonb_build_object('ok', false, 'message', 'Give it a title under 140 characters.'); end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or char_length(p_payload::text) > 40000 then return jsonb_build_object('ok', false, 'message', 'That’s too big to share in one go.'); end if;
  if (select count(*) from chat_messages where user_id = me and kind in ('user', 'share') and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'Slow down a little. Try again in a minute.');
  end if;
  n := coalesce(jsonb_array_length(case jsonb_typeof(p_payload->'items') when 'array' then p_payload->'items' else '[]'::jsonb end), 0);
  summary := case p_type
    when 'cards' then 'Shared a flashcard set: ' || t || ' (' || n || ' cards)'
    when 'quiz' then 'Started a group quiz: ' || t || ' (' || n || ' questions)'
    when 'prep' then 'Shared seminar prep: ' || t || ' (' || n || ' points)'
    else 'Shared a copy of a note: ' || t end;
  insert into chat_messages (group_id, user_id, kind, body, payload) values (p_group, me, 'share', left(summary, 2000), jsonb_build_object('type', p_type, 'title', t) || p_payload) returning id into mid;
  update chat_groups set last_message_at = now() where id = p_group;
  update group_members set last_read_id = mid where group_id = p_group and user_id = me;
  return jsonb_build_object('ok', true, 'id', mid);
end $$;

create or replace function public.mark_share(p_message bigint, p_data jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); g uuid; k text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select group_id, kind into g, k from chat_messages where id = p_message;
  if g is null or k <> 'share' or not _is_member(g, me) then return jsonb_build_object('ok', false, 'message', 'That isn’t available any more.'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or char_length(p_data::text) > 2000 then return jsonb_build_object('ok', false, 'message', 'Couldn’t save that.'); end if;
  insert into share_marks (message_id, user_id, data, updated_at) values (p_message, me, p_data, now())
    on conflict (message_id, user_id) do update set data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_share(p_message bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from chat_messages where id = p_message and user_id = me and kind = 'share';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0, 'message', case when n > 0 then 'Removed from the group.' else 'You can only remove things you shared.' end);
end $$;

create or replace function public.get_messages(p_group uuid, p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); out jsonb; top bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not _is_member(p_group, me) then return jsonb_build_object('ok', false, 'gone', true); end if;
  select coalesce(jsonb_agg(x order by (x->>'id')::bigint), '[]'::jsonb), max((x->>'id')::bigint) into out, top from (
    select jsonb_build_object('id', cm.id, 'kind', cm.kind, 'body', cm.body, 'at', cm.created_at, 'replyTo', cm.reply_to,
      'mine', cm.user_id = me and cm.kind in ('user', 'share'), 'uid', cm.user_id,
      'who', case when cm.kind = 'ai' then cm.ai_name when cm.user_id = me then 'You' else _name(cm.user_id) end,
      'payload', case when cm.kind = 'share' then cm.payload end,
      'marks', case when cm.kind = 'share' then (select coalesce(jsonb_agg(jsonb_build_object('me', sm.user_id = me, 'name', case when sm.user_id = me then 'You' else _name(sm.user_id) end, 'data', sm.data) order by sm.updated_at), '[]'::jsonb) from share_marks sm where sm.message_id = cm.id) end) as x
    from chat_messages cm where cm.group_id = p_group and cm.id > coalesce(p_after, 0)
    order by cm.id desc limit 150) s;
  if top is not null then update group_members set last_read_id = greatest(last_read_id, top) where group_id = p_group and user_id = me; end if;
  return jsonb_build_object('ok', true, 'messages', out);
end $$;

-- marks change after a message is first loaded, so let clients re-read marks for shares they can see
create or replace function public.share_marks_for(p_group uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); out jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not _is_member(p_group, me) then return '{}'::jsonb; end if;
  select coalesce(jsonb_object_agg(cm.id::text, (select coalesce(jsonb_agg(jsonb_build_object('me', sm.user_id = me, 'name', case when sm.user_id = me then 'You' else _name(sm.user_id) end, 'data', sm.data) order by sm.updated_at), '[]'::jsonb) from share_marks sm where sm.message_id = cm.id)), '{}'::jsonb)
    into out from chat_messages cm where cm.group_id = p_group and cm.kind = 'share' and cm.created_at > now() - interval '60 days';
  return out;
end $$;

revoke all on function public.post_share(uuid, text, text, jsonb) from public, anon;
revoke all on function public.mark_share(bigint, jsonb) from public, anon;
revoke all on function public.delete_share(bigint) from public, anon;
revoke all on function public.share_marks_for(uuid) from public, anon;
grant execute on function public.post_share(uuid, text, text, jsonb) to authenticated;
grant execute on function public.mark_share(bigint, jsonb) to authenticated;
grant execute on function public.delete_share(bigint) to authenticated;
grant execute on function public.share_marks_for(uuid) to authenticated;
