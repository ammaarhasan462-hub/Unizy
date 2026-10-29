-- Unizy Play: "Unwind", the daily general-knowledge quiz. Ten questions, same for everyone each day (UK date).
-- One counted run per student per day. Ranked by right answers, then total time. Rows only reachable via the functions.

create table if not exists public.unwind_scores (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  score      int  not null check (score between 0 and 10),
  ms         int  not null check (ms between 0 and 86400000),
  uni        text,
  shown_name text,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists unwind_scores_day on public.unwind_scores (day, score desc, ms asc);
alter table public.unwind_scores enable row level security;

create or replace function public.unwind_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/London')::date $$;

create or replace function public.unwind_me() returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := unwind_today(); s int := 0; cur date; r record; t record;
begin
  if uid is null then return json_build_object('signed_in', false); end if;
  select * into t from unwind_scores where user_id = uid and day = d;
  cur := case when t.user_id is not null then d else d - 1 end;
  for r in select day from unwind_scores where user_id = uid and day <= cur order by day desc loop
    exit when r.day <> cur;
    s := s + 1; cur := cur - 1;
  end loop;
  return json_build_object(
    'signed_in', true, 'played', t.user_id is not null, 'score', t.score, 'ms', t.ms, 'streak', s,
    'best', (select max(score) from unwind_scores where user_id = uid),
    'games', (select count(*) from unwind_scores where user_id = uid),
    'perfect', (select count(*) from unwind_scores where user_id = uid and score = 10),
    'name', coalesce((select shown_name from unwind_scores where user_id = uid order by day desc limit 1), nullif(btrim((select display_name from profiles where user_id = uid)), ''))
  );
end $$;

create or replace function public.unwind_submit(p_score int, p_ms int, p_uni text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := unwind_today(); nm text; inserted int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  -- ten questions; nobody reads and answers ten in under 8 seconds
  if p_score < 0 or p_score > 10 or p_ms < 8000 or p_ms > 86400000 then raise exception 'invalid score'; end if;
  nm := nullif(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ._''-]', '', 'g')), '');
  nm := left(coalesce(nm, nullif(btrim((select display_name from profiles where user_id = uid)), ''), 'A student'), 24);
  insert into unwind_scores (user_id, day, score, ms, uni, shown_name)
  values (uid, d, p_score, p_ms, left(p_uni, 20), nm)
  on conflict (user_id, day) do nothing;
  get diagnostics inserted = row_count;
  return json_build_object('counted', inserted > 0, 'me', unwind_me());
end $$;

create or replace function public.unwind_rename(p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  nm := left(nullif(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ._''-]', '', 'g')), ''), 24);
  if nm is null then raise exception 'empty name'; end if;
  update unwind_scores set shown_name = nm where user_id = uid and day >= unwind_today() - 7;
  return json_build_object('name', nm);
end $$;

-- 'today' (everyone), 'uni' (today, one uni) or 'week' (Monday to today: total right answers, then total time)
create or replace function public.unwind_board(p_scope text default 'today', p_uni text default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := unwind_today(); wk date := d - ((extract(isodow from d)::int) - 1); res json;
begin
  with base as (
    select user_id, max(latest_name) as shown_name, max(uni) as uni,
           sum(score) as score, sum(ms) as ms, count(*) as days, min(created_at) as first_at
    from (
      select s.*, last_value(s.shown_name) over (partition by s.user_id order by s.day rows between unbounded preceding and unbounded following) as latest_name
      from unwind_scores s
      where (p_scope = 'week' and s.day between wk and d) or (p_scope <> 'week' and s.day = d)
    ) x
    where (p_scope <> 'uni' or x.uni = p_uni)
    group by user_id
  ), ranked as (
    select *, rank() over (order by score desc, ms asc, first_at asc) as rk from base
  )
  select json_build_object(
    'scope', p_scope, 'day', d, 'players', (select count(*) from ranked),
    'rows', coalesce((select json_agg(json_build_object('rank', rk, 'name', shown_name, 'uni', uni, 'score', score, 'ms', ms, 'days', days, 'me', user_id = uid) order by rk) from (select * from ranked order by rk limit 25) t), '[]'::json),
    'mine', (select json_build_object('rank', rk, 'score', score, 'ms', ms) from ranked where user_id = uid)
  ) into res;
  return res;
end $$;

revoke all on public.unwind_scores from anon, authenticated;
revoke execute on function public.unwind_me(), public.unwind_submit(int, int, text, text), public.unwind_rename(text), public.unwind_board(text, text) from public, anon;
grant execute on function public.unwind_me(), public.unwind_submit(int, int, text, text), public.unwind_rename(text), public.unwind_board(text, text) to authenticated;
grant execute on function public.unwind_today() to authenticated, anon;
