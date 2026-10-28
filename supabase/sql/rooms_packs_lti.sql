-- Unizy: study rooms (co-edited notes, pooled card vault, reading split, live quizzes), cohort benchmarks,
-- lecture packs (searchable slide content), reading-list cache and LTI 1.3 launches.
-- Everything is reached through security-definer RPCs or the service role; tables have RLS on and no direct policies.

create extension if not exists vector with schema extensions;

-- ================================================================ study rooms
create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  uni text not null,
  module_key text not null,
  module_name text not null default '',
  name text not null,
  code text not null unique,
  open boolean not null default false,
  created_by uuid not null references auth.users on delete cascade,
  rev bigint not null default 1,
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);
create index if not exists study_rooms_mod on public.study_rooms (uni, module_key, last_activity desc);
create table if not exists public.room_members (
  room_id uuid not null references public.study_rooms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists room_members_user on public.room_members (user_id);
create table if not exists public.room_blocks (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.study_rooms on delete cascade,
  pos double precision not null,
  kind text not null default 'p' check (kind in ('h', 'p')),
  body text not null default '',
  version int not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  lock_by uuid,
  lock_until timestamptz,
  deleted boolean not null default false
);
create index if not exists room_blocks_room on public.room_blocks (room_id, pos);
create table if not exists public.room_cards (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.study_rooms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  f text not null,
  b text not null,
  topic text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists room_cards_room on public.room_cards (room_id, id);
create table if not exists public.room_readings (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.study_rooms on delete cascade,
  title text not null,
  detail text not null default '',
  week text not null default '',
  assigned_to uuid,
  done boolean not null default false,
  summary text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists room_readings_room on public.room_readings (room_id, id);
create table if not exists public.quiz_sessions (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.study_rooms on delete cascade,
  host uuid not null,
  title text not null default 'Group quiz',
  questions jsonb not null,
  seconds int not null default 30 check (seconds between 10 and 120),
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'done')),
  idx int not null default 0,
  q_started_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists quiz_sessions_room on public.quiz_sessions (room_id, id desc);
create table if not exists public.quiz_answers (
  session_id bigint not null references public.quiz_sessions on delete cascade,
  user_id uuid not null,
  idx int not null,
  choice int not null,
  correct boolean not null,
  ms int not null,
  points int not null default 0,
  primary key (session_id, user_id, idx)
);
create table if not exists public.module_scores (
  id bigint generated always as identity primary key,
  uni text not null,
  module_key text not null,
  user_id uuid not null references auth.users on delete cascade,
  pct int not null check (pct between 0 and 100),
  n int not null default 1,
  source text not null default 'test' check (source in ('test', 'quiz')),
  created_at timestamptz not null default now()
);
create index if not exists module_scores_mod on public.module_scores (uni, module_key, created_at desc);
alter table public.study_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_blocks enable row level security;
alter table public.room_cards enable row level security;
alter table public.room_readings enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.module_scores enable row level security;

create or replace function public._room_member(p_room uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = p_user)
$$;
create or replace function public._room_bump(p_room uuid) returns void
language sql security definer set search_path = '' as $$
  update public.study_rooms set rev = rev + 1, last_activity = now() where id = p_room
$$;
create or replace function public._room_code() returns text
language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from public.study_rooms where code = c);
  end loop;
  return c;
end $$;

create or replace function public.room_list(p_module_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then return jsonb_build_object('verified', false); end if;
  return jsonb_build_object('verified', true, 'uni', vu,
    'mine', coalesce((select jsonb_agg(x order by (x ->> 'here')::boolean desc, x ->> 'lastAt' desc) from (
      select jsonb_build_object('id', r.id, 'name', r.name, 'code', r.code, 'open', r.open, 'module', r.module_name, 'here', r.module_key = k,
        'owner', m.role = 'owner', 'lastAt', r.last_activity,
        'members', (select count(*) from public.room_members x where x.room_id = r.id),
        'online', (select count(*) from public.room_members x where x.room_id = r.id and x.last_seen > now() - interval '60 seconds'),
        'live', exists (select 1 from public.quiz_sessions q where q.room_id = r.id and q.state <> 'done')) x
      from public.room_members m join public.study_rooms r on r.id = m.room_id where m.user_id = me) s), '[]'::jsonb),
    'open', coalesce((select jsonb_agg(x order by x ->> 'lastAt' desc) from (
      select jsonb_build_object('id', r.id, 'name', r.name, 'module', r.module_name, 'lastAt', r.last_activity,
        'members', (select count(*) from public.room_members x where x.room_id = r.id),
        'online', (select count(*) from public.room_members x where x.room_id = r.id and x.last_seen > now() - interval '60 seconds')) x
      from public.study_rooms r
      where r.uni = vu and r.module_key = k and r.open and not public._room_member(r.id, me)
      order by r.last_activity desc limit 20) s), '[]'::jsonb));
end $$;

create or replace function public.room_create(p_module_key text, p_module_name text, p_name text, p_open boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80); n text := left(trim(coalesce(p_name, '')), 60); rid uuid; c text;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then return jsonb_build_object('ok', false, 'message', 'Verify your uni email to make a study room.'); end if;
  if k = '' then return jsonb_build_object('ok', false, 'message', 'Pick a module first.'); end if;
  if char_length(n) < 3 then return jsonb_build_object('ok', false, 'message', 'Give the room a name, e.g. “Seminar group 4”.'); end if;
  if (select count(*) from public.study_rooms where created_by = me and created_at > now() - interval '1 day') >= 8 then
    return jsonb_build_object('ok', false, 'message', 'You’ve made a lot of rooms today. Try again tomorrow.');
  end if;
  c := public._room_code();
  insert into public.study_rooms (uni, module_key, module_name, name, code, open, created_by)
    values (vu, k, left(coalesce(p_module_name, ''), 160), n, c, coalesce(p_open, false), me) returning id into rid;
  insert into public.room_members (room_id, user_id, role) values (rid, me, 'owner');
  insert into public.room_blocks (room_id, pos, kind, body, updated_by) values
    (rid, 1, 'h', 'Shared notes', me),
    (rid, 2, 'p', 'Add the seminar questions here, then split them up: each person takes a section and writes it up.', me);
  return jsonb_build_object('ok', true, 'id', rid, 'code', c);
end $$;

create or replace function public.room_join(p_code text, p_room uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; r public.study_rooms;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then return jsonb_build_object('ok', false, 'message', 'Verify your uni email to join study rooms.'); end if;
  if p_room is not null then select * into r from public.study_rooms where id = p_room and open;
  else select * into r from public.study_rooms where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); end if;
  if not found then return jsonb_build_object('ok', false, 'message', 'No room with that code. Check it and try again.'); end if;
  if r.uni <> vu then return jsonb_build_object('ok', false, 'message', 'That room is for students at another university.'); end if;
  if public._room_member(r.id, me) then return jsonb_build_object('ok', true, 'id', r.id); end if;
  if (select count(*) from public.room_members where room_id = r.id) >= 30 then return jsonb_build_object('ok', false, 'message', 'That room is full (30 people).'); end if;
  insert into public.room_members (room_id, user_id) values (r.id, me);
  perform public._room_bump(r.id);
  return jsonb_build_object('ok', true, 'id', r.id);
end $$;

create or replace function public.room_leave(p_room uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); was text; nxt uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  delete from public.room_members where room_id = p_room and user_id = me returning role into was;
  if was is null then return jsonb_build_object('ok', false, 'message', 'You’re not in that room.'); end if;
  if not exists (select 1 from public.room_members where room_id = p_room) then
    delete from public.study_rooms where id = p_room;
  elsif was = 'owner' then
    select user_id into nxt from public.room_members where room_id = p_room order by joined_at limit 1;
    update public.room_members set role = 'owner' where room_id = p_room and user_id = nxt;
    perform public._room_bump(p_room);
  else
    perform public._room_bump(p_room);
  end if;
  return jsonb_build_object('ok', true, 'message', 'You left the room.');
end $$;

create or replace function public.room_settings(p_room uuid, p_name text, p_open boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n text := left(trim(coalesce(p_name, '')), 60);
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = me and role = 'owner') then
    return jsonb_build_object('ok', false, 'message', 'Only the room’s owner can change that.');
  end if;
  update public.study_rooms set name = case when char_length(n) >= 3 then n else name end, open = coalesce(p_open, open) where id = p_room;
  perform public._room_bump(p_room);
  return jsonb_build_object('ok', true, 'message', 'Saved.');
end $$;

-- quiz summary for one room (used by room_state)
create or replace function public._quiz_view(p_room uuid, me uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q public.quiz_sessions; total int; qq jsonb; showAns boolean;
begin
  select * into q from public.quiz_sessions where room_id = p_room and (state <> 'done' or ended_at > now() - interval '15 minutes') order by id desc limit 1;
  if not found then return null; end if;
  total := jsonb_array_length(q.questions);
  showAns := q.state in ('reveal', 'done');
  qq := case when q.state in ('question', 'reveal') then q.questions -> q.idx else null end;
  return jsonb_build_object('id', q.id, 'title', q.title, 'state', q.state, 'idx', q.idx, 'total', total, 'seconds', q.seconds,
    'startedAt', q.q_started_at, 'isHost', q.host = me, 'host', public._who(q.host) ->> 'name',
    'question', case when qq is null then null else jsonb_build_object('q', qq ->> 'q', 'options', qq -> 'options',
       'answer', case when showAns then qq -> 'answer' else null end, 'why', case when showAns then qq ->> 'why' else null end) end,
    'myChoice', (select choice from public.quiz_answers a where a.session_id = q.id and a.user_id = me and a.idx = q.idx),
    'answered', (select count(*) from public.quiz_answers a where a.session_id = q.id and a.idx = q.idx),
    'counts', case when showAns and qq is not null then (select coalesce(jsonb_object_agg(choice, c), '{}'::jsonb) from (select choice, count(*) c from public.quiz_answers a where a.session_id = q.id and a.idx = q.idx group by choice) z) else null end,
    'board', coalesce((select jsonb_agg(jsonb_build_object('name', public._who(s.user_id) ->> 'name', 'me', s.user_id = me, 'points', s.p, 'correct', s.c) order by s.p desc) from (
       select user_id, sum(points) p, count(*) filter (where correct) c from public.quiz_answers a
       where a.session_id = q.id and (a.idx < q.idx or q.state in ('reveal', 'done')) group by user_id order by p desc limit 12) s), '[]'::jsonb));
end $$;

create or replace function public.room_state(p_room uuid, p_rev bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.study_rooms; base jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into r from public.study_rooms where id = p_room;
  if not found or not public._room_member(p_room, me) then return jsonb_build_object('gone', true); end if;
  update public.room_members set last_seen = now() where room_id = p_room and user_id = me;
  base := jsonb_build_object('rev', r.rev, 'now', now(),
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', public._who(m.user_id) ->> 'name', 'me', m.user_id = me, 'owner', m.role = 'owner',
        'online', m.last_seen > now() - interval '60 seconds') order by (m.last_seen > now() - interval '60 seconds') desc, m.joined_at)
      from public.room_members m where m.room_id = p_room), '[]'::jsonb),
    'quiz', public._quiz_view(p_room, me));
  if p_rev is not null and p_rev = r.rev then return base || jsonb_build_object('same', true); end if;
  return base || jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'name', r.name, 'code', r.code, 'open', r.open, 'module', r.module_name, 'moduleKey', r.module_key,
      'owner', exists (select 1 from public.room_members where room_id = p_room and user_id = me and role = 'owner')),
    'blocks', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'body', b.body, 'version', b.version,
        'lockMine', b.lock_by = me and b.lock_until > now(),
        'lockedBy', case when b.lock_by is not null and b.lock_by <> me and b.lock_until > now() then public._who(b.lock_by) ->> 'name' else null end,
        'by', case when b.updated_by is null then null when b.updated_by = me then 'You' else public._who(b.updated_by) ->> 'name' end, 'at', b.updated_at) order by b.pos)
      from public.room_blocks b where b.room_id = p_room and not b.deleted), '[]'::jsonb),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'f', c.f, 'b', c.b, 'topic', c.topic, 'mine', c.user_id = me,
        'who', case when c.user_id = me then 'You' else public._who(c.user_id) ->> 'name' end) order by c.id)
      from (select * from public.room_cards where room_id = p_room order by id limit 2000) c), '[]'::jsonb),
    'readings', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'detail', x.detail, 'week', x.week, 'done', x.done, 'summary', x.summary,
        'who', case when x.assigned_to is null then null when x.assigned_to = me then 'You' else public._who(x.assigned_to) ->> 'name' end,
        'mineAssigned', x.assigned_to = me, 'canRemove', x.created_by = me) order by x.id)
      from public.room_readings x where x.room_id = p_room), '[]'::jsonb));
end $$;

-- ---- co-edited notes (one person edits a section at a time; everyone sees changes live)
create or replace function public.room_block_add(p_room uuid, p_after bigint, p_kind text, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); a double precision; b double precision; nid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public._room_member(p_room, me) then return jsonb_build_object('ok', false, 'message', 'You’re not in that room.'); end if;
  if (select count(*) from public.room_blocks where room_id = p_room and not deleted) >= 400 then return jsonb_build_object('ok', false, 'message', 'These notes are full. Start a new room for the next topic.'); end if;
  if p_after is null then
    select coalesce(max(pos), 0) + 1 into a from public.room_blocks where room_id = p_room; b := null;
  else
    select pos into a from public.room_blocks where id = p_after and room_id = p_room;
    select min(pos) into b from public.room_blocks where room_id = p_room and pos > a;
    a := case when b is null then a + 1 else (a + b) / 2 end;
  end if;
  insert into public.room_blocks (room_id, pos, kind, body, updated_by, lock_by, lock_until)
    values (p_room, a, case when p_kind = 'h' then 'h' else 'p' end, left(coalesce(p_body, ''), 8000), me, me, now() + interval '45 seconds') returning id into nid;
  perform public._room_bump(p_room);
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

create or replace function public.room_block_lock(p_block bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.room_blocks;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into b from public.room_blocks where id = p_block and not deleted;
  if not found or not public._room_member(b.room_id, me) then return jsonb_build_object('ok', false, 'message', 'That section has gone.'); end if;
  if b.lock_by is not null and b.lock_by <> me and b.lock_until > now() then
    return jsonb_build_object('ok', false, 'message', (public._who(b.lock_by) ->> 'name') || ' is editing that section right now.');
  end if;
  update public.room_blocks set lock_by = me, lock_until = now() + interval '45 seconds' where id = p_block;
  perform public._room_bump(b.room_id);
  return jsonb_build_object('ok', true, 'body', b.body, 'version', b.version, 'kind', b.kind);
end $$;

create or replace function public.room_block_save(p_block bigint, p_body text, p_kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.room_blocks; v int;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into b from public.room_blocks where id = p_block and not deleted;
  if not found or not public._room_member(b.room_id, me) then return jsonb_build_object('ok', false, 'message', 'That section has gone.'); end if;
  if b.lock_by is not null and b.lock_by <> me and b.lock_until > now() then
    return jsonb_build_object('ok', false, 'message', (public._who(b.lock_by) ->> 'name') || ' took over this section. Your last change wasn’t saved.');
  end if;
  update public.room_blocks set body = left(coalesce(p_body, ''), 8000), kind = case when p_kind = 'h' then 'h' when p_kind = 'p' then 'p' else kind end,
    version = version + 1, updated_by = me, updated_at = now(), lock_by = me, lock_until = now() + interval '45 seconds'
    where id = p_block returning version into v;
  perform public._room_bump(b.room_id);
  return jsonb_build_object('ok', true, 'version', v);
end $$;

create or replace function public.room_block_unlock(p_block bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  update public.room_blocks set lock_by = null, lock_until = null where id = p_block and lock_by = me returning room_id into rid;
  if rid is not null then perform public._room_bump(rid); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.room_block_remove(p_block bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); b public.room_blocks;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into b from public.room_blocks where id = p_block and not deleted;
  if not found or not public._room_member(b.room_id, me) then return jsonb_build_object('ok', false, 'message', 'That section has gone.'); end if;
  if b.lock_by is not null and b.lock_by <> me and b.lock_until > now() then
    return jsonb_build_object('ok', false, 'message', (public._who(b.lock_by) ->> 'name') || ' is editing that section.');
  end if;
  update public.room_blocks set deleted = true, lock_by = null, updated_by = me, updated_at = now() where id = p_block;
  perform public._room_bump(b.room_id);
  return jsonb_build_object('ok', true);
end $$;

-- ---- pooled flashcard vault
create or replace function public.room_cards_add(p_room uuid, p_cards jsonb, p_topic text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public._room_member(p_room, me) then return jsonb_build_object('ok', false, 'message', 'You’re not in that room.'); end if;
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) < 1 then return jsonb_build_object('ok', false, 'message', 'Pick some cards to add.'); end if;
  if (select count(*) from public.room_cards where room_id = p_room) + least(jsonb_array_length(p_cards), 80) > 2000 then
    return jsonb_build_object('ok', false, 'message', 'The vault is full (2,000 cards).');
  end if;
  insert into public.room_cards (room_id, user_id, f, b, topic)
    select p_room, me, left(c ->> 'f', 400), left(c ->> 'b', 1200), left(coalesce(p_topic, ''), 80)
    from (select value c from jsonb_array_elements(p_cards) limit 80) s
    where coalesce(c ->> 'f', '') <> '' and coalesce(c ->> 'b', '') <> '';
  get diagnostics n = row_count;
  perform public._room_bump(p_room);
  return jsonb_build_object('ok', true, 'n', n);
end $$;

create or replace function public.room_card_remove(p_card bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c public.room_cards;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into c from public.room_cards where id = p_card;
  if not found then return jsonb_build_object('ok', true); end if;
  if c.user_id <> me and not exists (select 1 from public.room_members where room_id = c.room_id and user_id = me and role = 'owner') then
    return jsonb_build_object('ok', false, 'message', 'You can only remove cards you added.');
  end if;
  delete from public.room_cards where id = p_card;
  perform public._room_bump(c.room_id);
  return jsonb_build_object('ok', true);
end $$;

-- ---- seminar reading split
create or replace function public.room_readings_add(p_room uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public._room_member(p_room, me) then return jsonb_build_object('ok', false, 'message', 'You’re not in that room.'); end if;
  if (select count(*) from public.room_readings where room_id = p_room) >= 300 then return jsonb_build_object('ok', false, 'message', 'That’s a lot of readings. Remove some finished ones first.'); end if;
  insert into public.room_readings (room_id, title, detail, week, created_by)
    select p_room, left(i ->> 'title', 300), left(coalesce(i ->> 'detail', ''), 400), left(coalesce(i ->> 'week', ''), 80), me
    from (select value i from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) limit 60) s
    where coalesce(trim(i ->> 'title'), '') <> '';
  get diagnostics n = row_count;
  perform public._room_bump(p_room);
  return jsonb_build_object('ok', true, 'n', n);
end $$;

create or replace function public.room_reading_update(p_id bigint, p_action text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); x public.room_readings;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into x from public.room_readings where id = p_id;
  if not found or not public._room_member(x.room_id, me) then return jsonb_build_object('ok', false, 'message', 'That reading has gone.'); end if;
  if p_action = 'claim' then
    update public.room_readings set assigned_to = case when assigned_to = me then null else me end where id = p_id;
  elsif p_action = 'done' then
    update public.room_readings set done = not done where id = p_id;
  elsif p_action = 'summary' then
    update public.room_readings set summary = left(coalesce(p_text, ''), 4000), assigned_to = coalesce(assigned_to, me) where id = p_id;
  elsif p_action = 'remove' then
    if x.created_by <> me and not exists (select 1 from public.room_members where room_id = x.room_id and user_id = me and role = 'owner') then
      return jsonb_build_object('ok', false, 'message', 'Only the person who added it can remove it.');
    end if;
    delete from public.room_readings where id = p_id;
  else raise exception 'bad action'; end if;
  perform public._room_bump(x.room_id);
  return jsonb_build_object('ok', true);
end $$;

-- ---- live multiplayer quizzes
create or replace function public._quiz_finish(p_session bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare q public.quiz_sessions; r public.study_rooms; total int;
begin
  select * into q from public.quiz_sessions where id = p_session;
  if q.state = 'done' then return; end if;
  update public.quiz_sessions set state = 'done', ended_at = now() where id = p_session;
  select * into r from public.study_rooms where id = q.room_id;
  total := jsonb_array_length(q.questions);
  insert into public.module_scores (uni, module_key, user_id, pct, n, source)
    select r.uni, r.module_key, a.user_id, round(100.0 * count(*) filter (where a.correct) / total)::int, total, 'quiz'
    from public.quiz_answers a where a.session_id = p_session group by a.user_id having count(*) >= greatest(1, total / 2);
end $$;

create or replace function public.quiz_start(p_room uuid, p_title text, p_questions jsonb, p_seconds int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); qs jsonb; sid bigint; old bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public._room_member(p_room, me) then return jsonb_build_object('ok', false, 'message', 'You’re not in that room.'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('q', left(x ->> 'q', 800), 'options', (select jsonb_agg(left(o, 300)) from jsonb_array_elements_text(x -> 'options') o),
      'answer', (x ->> 'answer')::int, 'why', left(coalesce(x ->> 'why', ''), 800))), '[]'::jsonb) into qs
  from (select value x from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) limit 20) s
  where jsonb_typeof(x -> 'options') = 'array' and jsonb_array_length(x -> 'options') between 2 and 6
    and (x ->> 'answer') ~ '^\d+$' and (x ->> 'answer')::int < jsonb_array_length(x -> 'options') and coalesce(x ->> 'q', '') <> '';
  if jsonb_array_length(qs) < 2 then return jsonb_build_object('ok', false, 'message', 'A quiz needs at least 2 multiple-choice questions.'); end if;
  for old in select id from public.quiz_sessions where room_id = p_room and state <> 'done' loop perform public._quiz_finish(old); end loop;
  insert into public.quiz_sessions (room_id, host, title, questions, seconds)
    values (p_room, me, left(coalesce(nullif(trim(p_title), ''), 'Group quiz'), 120), qs, greatest(10, least(120, coalesce(p_seconds, 30)))) returning id into sid;
  perform public._room_bump(p_room);
  return jsonb_build_object('ok', true, 'id', sid);
end $$;

create or replace function public.quiz_advance(p_session bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); q public.quiz_sessions; total int;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into q from public.quiz_sessions where id = p_session;
  if not found or q.host <> me then return jsonb_build_object('ok', false, 'message', 'Only the person running the quiz can move it on.'); end if;
  total := jsonb_array_length(q.questions);
  if q.state = 'lobby' then update public.quiz_sessions set state = 'question', idx = 0, q_started_at = now() where id = p_session;
  elsif q.state = 'question' then update public.quiz_sessions set state = 'reveal' where id = p_session;
  elsif q.state = 'reveal' and q.idx + 1 < total then update public.quiz_sessions set state = 'question', idx = idx + 1, q_started_at = now() where id = p_session;
  elsif q.state = 'reveal' then perform public._quiz_finish(p_session);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.quiz_end(p_session bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); q public.quiz_sessions;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into q from public.quiz_sessions where id = p_session;
  if not found or (q.host <> me and not exists (select 1 from public.room_members where room_id = q.room_id and user_id = me and role = 'owner')) then
    return jsonb_build_object('ok', false, 'message', 'Only the person running the quiz can end it.');
  end if;
  perform public._quiz_finish(p_session);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.quiz_answer(p_session bigint, p_idx int, p_choice int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); q public.quiz_sessions; ms int; ok boolean; pts int;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into q from public.quiz_sessions where id = p_session;
  if not found or not public._room_member(q.room_id, me) then return jsonb_build_object('ok', false, 'message', 'That quiz has ended.'); end if;
  if q.state <> 'question' or q.idx <> p_idx then return jsonb_build_object('ok', false, 'message', 'Too late for that question.'); end if;
  ms := greatest(0, (extract(epoch from (now() - q.q_started_at)) * 1000)::int);
  if ms > q.seconds * 1000 + 1500 then return jsonb_build_object('ok', false, 'message', 'Time’s up for that question.'); end if;
  ok := p_choice = ((q.questions -> p_idx) ->> 'answer')::int;
  pts := case when ok then 500 + greatest(0, round(500 * (1 - ms::numeric / (q.seconds * 1000))))::int else 0 end;
  insert into public.quiz_answers (session_id, user_id, idx, choice, correct, ms, points) values (p_session, me, p_idx, p_choice, ok, ms, pts)
    on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ---- cohort benchmark (anonymous: only counts and percentiles are ever shown)
create or replace function public.bench_submit(p_module_key text, p_pct int, p_n int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null or k = '' or p_pct is null or p_pct < 0 or p_pct > 100 or coalesce(p_n, 0) < 3 then return jsonb_build_object('ok', false); end if;
  if (select count(*) from public.module_scores where user_id = me and created_at > now() - interval '1 day') >= 40 then return jsonb_build_object('ok', false); end if;
  insert into public.module_scores (uni, module_key, user_id, pct, n, source) values (vu, k, me, p_pct, least(p_n, 100), 'test');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.bench_get(p_module_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
  mine numeric; n int; below int; ties int; avgall numeric; buckets jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then return jsonb_build_object('verified', false); end if;
  -- each student's average over their last 10 scores in the last 60 days
  with s as (
    select user_id, avg(pct) a from (
      select user_id, pct, row_number() over (partition by user_id order by created_at desc) rn
      from public.module_scores where uni = vu and module_key = k and created_at > now() - interval '60 days') x
    where rn <= 10 group by user_id)
  select count(*), avg(a), max(a) filter (where user_id = me) into n, avgall, mine from s;
  if mine is not null then
    with s as (
      select user_id, avg(pct) a from (
        select user_id, pct, row_number() over (partition by user_id order by created_at desc) rn
        from public.module_scores where uni = vu and module_key = k and created_at > now() - interval '60 days') x
      where rn <= 10 group by user_id)
    select count(*) filter (where a < mine), count(*) filter (where a = mine) - 1 into below, ties from s;
  end if;
  with s as (
    select user_id, avg(pct) a from (
      select user_id, pct, row_number() over (partition by user_id order by created_at desc) rn
      from public.module_scores where uni = vu and module_key = k and created_at > now() - interval '60 days') x
    where rn <= 10 group by user_id)
  select coalesce(jsonb_agg(c order by b), '[]'::jsonb) into buckets from (
    select g b, (select count(*) from s where least(9, floor(a / 10)::int) = g) c from generate_series(0, 9) g) z;
  return jsonb_build_object('verified', true, 'uni', vu, 'students', n, 'enough', n >= 5,
    'mine', round(mine), 'myTests', (select count(*) from public.module_scores where uni = vu and module_key = k and user_id = me and created_at > now() - interval '60 days'),
    'percentile', case when n >= 5 and mine is not null then round(100.0 * (below + ties / 2.0) / (n - 1)) else null end,
    'average', case when n >= 5 then round(avgall) else null end,
    'buckets', case when n >= 5 then buckets else null end);
end $$;

-- ================================================================ lecture packs (searchable slide content)
create table if not exists public.lecture_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  module_key text not null,
  module_name text not null default '',
  title text not null,
  source text not null default '',
  pages int not null default 0,
  topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lecture_packs_user on public.lecture_packs (user_id, module_key, created_at desc);
create table if not exists public.lecture_chunks (
  id bigint generated always as identity primary key,
  pack_id uuid not null references public.lecture_packs on delete cascade,
  user_id uuid not null,
  module_key text not null,
  page int not null default 0,
  text text not null,
  embedding extensions.vector(384) not null
);
create index if not exists lecture_chunks_user on public.lecture_chunks (user_id, module_key);
alter table public.lecture_packs enable row level security;
alter table public.lecture_chunks enable row level security;

create or replace function public.match_lecture_chunks(p_user uuid, p_module_key text, p_embedding extensions.vector(384), p_k int)
returns table (pack_id uuid, title text, page int, text text, similarity double precision)
language sql stable security definer set search_path = '' as $$
  select c.pack_id, p.title, c.page, c.text, 1 - (c.embedding operator(extensions.<=>) p_embedding) as similarity
  from public.lecture_chunks c join public.lecture_packs p on p.id = c.pack_id
  where c.user_id = p_user and c.module_key = p_module_key
  order by c.embedding operator(extensions.<=>) p_embedding
  limit greatest(1, least(coalesce(p_k, 6), 12))
$$;

create or replace function public.lecture_pack_list(p_module_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'source', p.source, 'pages', p.pages, 'topics', p.topics, 'at', p.created_at,
    'chunks', (select count(*) from public.lecture_chunks c where c.pack_id = p.id)) order by p.created_at desc), '[]'::jsonb)
  from public.lecture_packs p where p.user_id = auth.uid() and p.module_key = left(trim(coalesce(p_module_key, '')), 80)
$$;

create or replace function public.lecture_pack_delete(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.lecture_packs where id = p_id and user_id = auth.uid();
  return jsonb_build_object('ok', found);
end $$;

-- ================================================================ reading lists (cached copies of public university reading lists)
create table if not exists public.reading_lists (
  tenant text not null,
  module_code text not null,
  fetched_at timestamptz not null default now(),
  data jsonb not null,
  primary key (tenant, module_code)
);
alter table public.reading_lists enable row level security;

-- ================================================================ LTI 1.3 (launch Unizy from Moodle, Canvas or Blackboard)
create table if not exists public.lti_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  uni text not null,
  issuer text not null,
  client_id text not null,
  auth_endpoint text not null,
  jwks_url text not null,
  token_endpoint text not null default '',
  deployment_ids text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (issuer, client_id)
);
create table if not exists public.lti_states (
  state text primary key,
  nonce text not null,
  platform_id uuid not null references public.lti_platforms on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.lti_launches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  platform_id uuid references public.lti_platforms on delete set null,
  uni text not null,
  context_id text,
  context_label text,
  context_title text,
  roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
alter table public.lti_platforms enable row level security;
alter table public.lti_states enable row level security;
alter table public.lti_launches enable row level security;

create or replace function public._is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comp_access c join auth.users u on lower(u.email) = lower(c.email) where u.id = auth.uid() and c.is_admin)
$$;

-- the app picks up the course a student just launched from (within an hour), once
create or replace function public.lti_pending() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); l public.lti_launches;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into l from public.lti_launches where user_id = me and consumed_at is null and created_at > now() - interval '1 hour' order by created_at desc limit 1;
  if not found then return null; end if;
  update public.lti_launches set consumed_at = now() where user_id = me and consumed_at is null;
  return jsonb_build_object('uni', l.uni, 'label', l.context_label, 'title', l.context_title, 'roles', to_jsonb(l.roles));
end $$;

-- register a university's Moodle / Canvas / Blackboard (Unizy admins only)
create or replace function public.lti_add_platform(p_name text, p_uni text, p_issuer text, p_client_id text, p_auth_endpoint text, p_jwks_url text, p_token_endpoint text, p_deployment_ids text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  if not public._is_admin() then raise exception 'admins only'; end if;
  if p_uni not in ('ucl', 'imperial', 'lse', 'oxford', 'cambridge', 'qmul') then raise exception 'unknown university'; end if;
  if p_auth_endpoint !~ '^https://' or p_jwks_url !~ '^https://' then raise exception 'endpoints must be https'; end if;
  insert into public.lti_platforms (name, uni, issuer, client_id, auth_endpoint, jwks_url, token_endpoint, deployment_ids)
    values (p_name, p_uni, trim(p_issuer), trim(p_client_id), trim(p_auth_endpoint), trim(p_jwks_url), coalesce(trim(p_token_endpoint), ''), coalesce(p_deployment_ids, '{}'))
    on conflict (issuer, client_id) do update set name = excluded.name, uni = excluded.uni, auth_endpoint = excluded.auth_endpoint,
      jwks_url = excluded.jwks_url, token_endpoint = excluded.token_endpoint, deployment_ids = excluded.deployment_ids, active = true
    returning id into pid;
  return jsonb_build_object('ok', true, 'id', pid);
end $$;

create or replace function public.lti_platforms_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public._is_admin() then coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'uni', uni, 'issuer', issuer, 'clientId', client_id,
    'deployments', to_jsonb(deployment_ids), 'active', active, 'launches', (select count(*) from public.lti_launches l where l.platform_id = p.id)) order by created_at)
    from public.lti_platforms p), '[]'::jsonb) else null end
$$;

-- ================================================================ permissions
do $$ declare f text; begin
  foreach f in array array['room_list(text)', 'room_create(text,text,text,boolean)', 'room_join(text,uuid)', 'room_leave(uuid)', 'room_settings(uuid,text,boolean)',
    'room_state(uuid,bigint)', 'room_block_add(uuid,bigint,text,text)', 'room_block_lock(bigint)', 'room_block_save(bigint,text,text)', 'room_block_unlock(bigint)',
    'room_block_remove(bigint)', 'room_cards_add(uuid,jsonb,text)', 'room_card_remove(bigint)', 'room_readings_add(uuid,jsonb)', 'room_reading_update(bigint,text,text)',
    'quiz_start(uuid,text,jsonb,integer)', 'quiz_advance(bigint)', 'quiz_end(bigint)', 'quiz_answer(bigint,integer,integer)', 'bench_submit(text,integer,integer)',
    'bench_get(text)', 'lecture_pack_list(text)', 'lecture_pack_delete(uuid)', 'lti_pending()', 'lti_add_platform(text,text,text,text,text,text,text,text[])', 'lti_platforms_list()'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['_room_member(uuid,uuid)', '_room_bump(uuid)', '_room_code()', '_quiz_view(uuid,uuid)', '_quiz_finish(bigint)', '_is_admin()',
    'match_lecture_chunks(uuid,text,extensions.vector,integer)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  execute 'grant execute on function public.match_lecture_chunks(uuid,text,extensions.vector,integer) to service_role';
end $$;

-- Unizy's own LTI signing key (created by the lti function on first use). Service role only.
create table if not exists public.lti_keys (
  id int primary key check (id = 1),
  kid text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.lti_keys enable row level security;
revoke all on public.lti_keys from public, anon, authenticated;
