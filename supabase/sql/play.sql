-- Unizy Play: the daily "Stack" game and its leaderboard.
-- One counted run per student per day (UK date). Rows are only reachable through the functions below.

create table if not exists public.play_scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  score      int  not null check (score between 0 and 200),
  correct    int  not null check (correct between 0 and 150),
  wrong      int  not null check (wrong between 0 and 150),
  uni        text,
  course     text,
  shown_name text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists play_scores_day_score on public.play_scores (day, score desc);
alter table public.play_scores enable row level security;

create or replace function public.play_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/London')::date $$;

-- the student's own record: played today?, today's score, streak, best
create or replace function public.play_me() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := play_today(); s int := 0; cur date; r record; today_row record;
begin
  if uid is null then return json_build_object('signed_in', false); end if;
  select * into today_row from play_scores where user_id = uid and day = d;
  -- streak: consecutive days ending today (or yesterday, if today isn't played yet)
  cur := case when today_row.user_id is not null then d else d - 1 end;
  for r in select day from play_scores where user_id = uid and day <= cur order by day desc loop
    exit when r.day <> cur;
    s := s + 1; cur := cur - 1;
  end loop;
  return json_build_object(
    'signed_in', true,
    'played', today_row.user_id is not null,
    'score', today_row.score,
    'streak', s,
    'best', (select max(score) from play_scores where user_id = uid),
    'games', (select count(*) from play_scores where user_id = uid),
    'name', coalesce((select shown_name from play_scores where user_id = uid order by day desc limit 1), nullif(btrim((select display_name from profiles where user_id = uid)), ''))
  );
end $$;

-- record today's counted run (the first one only)
create or replace function public.play_submit(p_score int, p_correct int, p_wrong int, p_uni text, p_course text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := play_today(); nm text; inserted int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_score < 0 or p_correct < 0 or p_wrong < 0 or p_correct > 150 or p_wrong > 150
     or p_score > p_correct + (p_correct / 3) then
    raise exception 'invalid score';
  end if;
  nm := nullif(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ._''-]', '', 'g')), '');
  nm := left(coalesce(nm, nullif(btrim((select display_name from profiles where user_id = uid)), ''), 'A student'), 24);
  insert into play_scores (user_id, day, score, correct, wrong, uni, course, shown_name)
  values (uid, d, p_score, p_correct, p_wrong, left(p_uni, 20), left(p_course, 80), nm)
  on conflict (user_id, day) do nothing;
  get diagnostics inserted = row_count;
  return json_build_object('counted', inserted > 0, 'me', play_me());
end $$;

-- change the name shown on the board (today's row and future runs)
create or replace function public.play_rename(p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  nm := left(nullif(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ._''-]', '', 'g')), ''), 24);
  if nm is null then raise exception 'empty name'; end if;
  update play_scores set shown_name = nm where user_id = uid and day >= play_today() - 7;
  return json_build_object('name', nm);
end $$;

-- leaderboards: 'today' (everyone), 'uni' (today, your uni) or 'week' (Monday to today, total of daily scores)
create or replace function public.play_board(p_scope text default 'today', p_uni text default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := play_today(); wk date := d - ((extract(isodow from d)::int) - 1); res json;
begin
  with base as (
    select user_id, max(latest_name) as shown_name, max(uni) as uni, max(course) as course,
           case when p_scope = 'week' then sum(score) else max(score) end as score,
           case when p_scope = 'week' then sum(correct) else max(correct) end as correct,
           case when p_scope = 'week' then sum(wrong) else max(wrong) end as wrong,
           count(*) as days, min(created_at) as first_at
    from (
      select s.*, last_value(s.shown_name) over (partition by s.user_id order by s.day rows between unbounded preceding and unbounded following) as latest_name
      from play_scores s
      where (p_scope = 'week' and s.day between wk and d) or (p_scope <> 'week' and s.day = d)
    ) x
    where (p_scope <> 'uni' or x.uni = p_uni)
    group by user_id
  ), ranked as (
    select *, rank() over (order by score desc, wrong asc, first_at asc) as rk from base
  )
  select json_build_object(
    'scope', p_scope, 'day', d, 'players', (select count(*) from ranked),
    'rows', coalesce((select json_agg(json_build_object('rank', rk, 'name', shown_name, 'uni', uni, 'course', course, 'score', score, 'correct', correct, 'days', days, 'me', user_id = uid) order by rk) from (select * from ranked order by rk limit 25) t), '[]'::json),
    'mine', (select json_build_object('rank', rk, 'score', score) from ranked where user_id = uid)
  ) into res;
  return res;
end $$;

revoke all on public.play_scores from anon, authenticated;
revoke execute on function public.play_me(), public.play_submit(int, int, int, text, text, text), public.play_rename(text), public.play_board(text, text) from public, anon;
grant execute on function public.play_me(), public.play_submit(int, int, int, text, text, text), public.play_rename(text), public.play_board(text, text) to authenticated;
grant execute on function public.play_today() to authenticated, anon;
