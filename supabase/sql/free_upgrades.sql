-- Free upgrades (Nov 2026): society promo codes, a public accuracy figure from students' real marks,
-- and the published criteria behind each mark. None of these call the marker or use AI credit.

-- ---------- society / promo codes: free Pro (a pass) until a fixed date ----------
create table if not exists public.promo_codes (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  label text not null,                 -- e.g. 'UCL Law Society'
  pass_until timestamptz not null,     -- Pro lasts until this date
  max_uses int not null default 300,
  uses int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.promo_redemptions (
  code text not null references public.promo_codes(code),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
-- no policies: only the functions below (security definer) and the service role touch these tables

create or replace function public.redeem_code(p_code text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); c public.promo_codes; v text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if uid is null then return jsonb_build_object('ok', false, 'message', 'Sign in first, then enter your code.'); end if;
  select * into c from public.promo_codes where code = v;
  if not found or not c.active then return jsonb_build_object('ok', false, 'message', 'That code isn’t valid. Check the spelling or ask your society for the right one.'); end if;
  if c.pass_until <= now() then return jsonb_build_object('ok', false, 'message', 'That code has expired.'); end if;
  if exists (select 1 from public.promo_redemptions where code = v and user_id = uid) then
    return jsonb_build_object('ok', true, 'already', true, 'label', c.label, 'until', c.pass_until, 'message', 'You’ve already used this code: Pro is on until ' || to_char(c.pass_until at time zone 'Europe/London', 'FMDD FMMonth YYYY') || '.');
  end if;
  if c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'message', 'This code has been used up. Ask your society if there’s a new one.'); end if;
  insert into public.promo_redemptions (code, user_id) values (v, uid);
  update public.promo_codes set uses = uses + 1 where code = v;
  insert into public.billing (user_id, pass_plan, pass_until, updated_at) values (uid, 'exam', c.pass_until, now())
    on conflict (user_id) do update set pass_plan = case when coalesce(billing.pass_until, now()) >= excluded.pass_until then billing.pass_plan else 'exam' end,
      pass_until = greatest(coalesce(billing.pass_until, now()), excluded.pass_until), updated_at = now();
  return jsonb_build_object('ok', true, 'label', c.label, 'until', c.pass_until, 'message', 'Done: ' || c.label || ' Pro is on until ' || to_char(c.pass_until at time zone 'Europe/London', 'FMDD FMMonth YYYY') || '.');
end $$;
revoke all on function public.redeem_code(text) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;

-- ---------- accuracy: predicted range vs the real marks students report ----------
-- "close" = the real mark is inside the predicted range or within 5 marks of it.
create or replace function public.accuracy_stats()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with r as (
    select real_mark, (result->>'mark_low')::int lo, (result->>'mark_high')::int hi from mark_attempts
    where real_mark is not null and real_mark between 0 and 100 and result ? 'mark_low' and result ? 'mark_high'
  )
  select jsonb_build_object('n', count(*), 'close', count(*) filter (where real_mark between lo - 5 and hi + 5),
    'pct', case when count(*) = 0 then null else round(100.0 * count(*) filter (where real_mark between lo - 5 and hi + 5) / count(*)) end) from r
$$;
grant execute on function public.accuracy_stats() to anon, authenticated;

-- ---------- evidence: which published criteria a module is marked against ----------
create or replace function public.rubric_sources(p_uni text, p_department text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('title', title, 'url', source_url, 'dept', department is not null) order by (department is null)), '[]'::jsonb)
  from marking_rubrics where uni = coalesce(p_uni, 'ucl') and (department is null or department = p_department)
$$;
grant execute on function public.rubric_sources(text, text) to anon, authenticated;

-- ---------- codes for the societies Unizy has offered free Pro (Nov 2026) ----------
insert into public.promo_codes (code, label, pass_until) values
  ('UCLLAWSOC', 'UCL Law Society', '2027-01-31 23:59+00'), ('UCLEFS', 'UCL Economics & Finance Society', '2027-01-31 23:59+00'),
  ('QMLAWSOC', 'Queen Mary Law Society', '2027-01-31 23:59+00'), ('LSEECON', 'LSESU Economics Society', '2027-01-31 23:59+00'),
  ('ICMATHSOC', 'Imperial MathSoc', '2027-01-31 23:59+00'), ('QMECON', 'Queen Mary Economics Society', '2027-01-31 23:59+00'),
  ('UCLADM', 'UCL Maths Society (ADM)', '2027-01-31 23:59+00'), ('LSEPPE', 'LSE PPE Society', '2027-01-31 23:59+00'),
  ('LSEGOV', 'LSE Government Society', '2027-01-31 23:59+00'), ('QMPSYCH', 'QMUL Psychology Society', '2027-01-31 23:59+00'),
  ('UCLPHIL', 'UCL Philosophy Society', '2027-01-31 23:59+00'), ('ICCHEMSOC', 'Imperial ChemSoc', '2027-01-31 23:59+00'),
  ('ICMEDED', 'Imperial MedEd', '2027-01-31 23:59+00')
on conflict (code) do nothing;
