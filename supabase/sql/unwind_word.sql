-- Unwind v2: each right answer reveals a letter of the day's hidden word (6-10 letters); then guess the word.
-- Points = right answers + 5 for solving the word. Ranked by points, then thinking time.

alter table public.unwind_scores add column if not exists rights int;
alter table public.unwind_scores add column if not exists qn int;
alter table public.unwind_scores add column if not exists solved boolean not null default false;
update public.unwind_scores set rights = score, qn = 10 where rights is null;
alter table public.unwind_scores drop constraint if exists unwind_scores_score_check;
alter table public.unwind_scores add constraint unwind_scores_score_check check (score between 0 and 20);

-- the old 4-argument unwind_submit stays until every open page has the new version
create or replace function public.unwind_submit(p_rights int, p_qn int, p_solved boolean, p_ms int, p_uni text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := unwind_today(); nm text; inserted int; pts int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_qn < 6 or p_qn > 10 or p_rights < 0 or p_rights > p_qn or p_ms < 5000 or p_ms > 86400000 then raise exception 'invalid score'; end if;
  pts := p_rights + case when p_solved then 5 else 0 end;
  nm := nullif(btrim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] ._''-]', '', 'g')), '');
  nm := left(coalesce(nm, nullif(btrim((select display_name from profiles where user_id = uid)), ''), 'A student'), 24);
  insert into unwind_scores (user_id, day, score, ms, uni, shown_name, rights, qn, solved)
  values (uid, d, pts, p_ms, left(p_uni, 20), nm, p_rights, p_qn, coalesce(p_solved, false))
  on conflict (user_id, day) do nothing;
  get diagnostics inserted = row_count;
  return json_build_object('counted', inserted > 0, 'me', unwind_me());
end $$;

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
    'signed_in', true, 'played', t.user_id is not null, 'score', t.score, 'ms', t.ms, 'rights', t.rights, 'qn', t.qn, 'solved', t.solved, 'streak', s,
    'best', (select max(score) from unwind_scores where user_id = uid),
    'games', (select count(*) from unwind_scores where user_id = uid),
    'words', (select count(*) from unwind_scores where user_id = uid and solved),
    'name', coalesce((select shown_name from unwind_scores where user_id = uid order by day desc limit 1), nullif(btrim((select display_name from profiles where user_id = uid)), ''))
  );
end $$;

create or replace function public.unwind_board(p_scope text default 'today', p_uni text default null)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := unwind_today(); wk date := d - ((extract(isodow from d)::int) - 1); res json;
begin
  with base as (
    select user_id, max(latest_name) as shown_name, max(uni) as uni,
           sum(score) as score, sum(ms) as ms, count(*) as days, min(created_at) as first_at,
           sum(coalesce(rights, 0)) as rights, sum(coalesce(qn, 10)) as qn, sum(case when solved then 1 else 0 end) as words
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
    'rows', coalesce((select json_agg(json_build_object('rank', rk, 'name', shown_name, 'uni', uni, 'score', score, 'ms', ms, 'days', days, 'rights', rights, 'qn', qn, 'words', words, 'me', user_id = uid) order by rk) from (select * from ranked order by rk limit 25) t), '[]'::json),
    'mine', (select json_build_object('rank', rk, 'score', score, 'ms', ms) from ranked where user_id = uid)
  ) into res;
  return res;
end $$;

revoke execute on function public.unwind_me(), public.unwind_submit(int, int, boolean, int, text, text), public.unwind_board(text, text) from public, anon;
grant execute on function public.unwind_me(), public.unwind_submit(int, int, boolean, int, text, text), public.unwind_board(text, text) to authenticated;
