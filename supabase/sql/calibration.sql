-- Calibration (Nov 2026): make the marker match how each university and department actually marks.
-- 1) marking_anchors: real answers with the mark they really got (from students who share a marked essay, with
--    consent, or added by the owner). Approved ones (active) are shown to the marker as calibration examples:
--    same module first, then same department, then same university. Students' submissions start inactive.
-- 2) calib_offset: once a department has 8+ "real mark" reports (mark_attempts.real_mark), the average gap between
--    the real mark and the predicted middle is applied to future predicted ranges (capped at ±6). No AI involved.

create table if not exists public.marking_anchors (
  id uuid primary key default gen_random_uuid(),
  uni text not null,
  department text,
  code text,
  level int,
  question text,
  answer text not null,
  mark int not null check (mark between 0 and 100),
  feedback text,               -- the examiner's own comments, if the student has them
  source text not null default 'student',
  submitted_by uuid references auth.users(id) on delete set null,
  consent boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.marking_anchors enable row level security;
drop policy if exists "own anchors read" on public.marking_anchors;
create policy "own anchors read" on public.marking_anchors for select using (auth.uid() = submitted_by);

-- students share a marked answer (goes in inactive, for review)
create or replace function public.share_marked_answer(p_code text, p_mark int, p_question text, p_answer text, p_feedback text, p_consent boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); m record; n int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'message', 'Sign in first.'); end if;
  if not coalesce(p_consent, false) then return jsonb_build_object('ok', false, 'message', 'Tick the box to say we can use it.'); end if;
  if p_mark is null or p_mark < 0 or p_mark > 100 then return jsonb_build_object('ok', false, 'message', 'Enter the mark you got, from 0 to 100.'); end if;
  if length(coalesce(p_answer, '')) < 300 then return jsonb_build_object('ok', false, 'message', 'Paste the whole answer (at least a few paragraphs).'); end if;
  select code, uni, department, level into m from ucl_modules where code = upper(trim(p_code));
  if m.code is null then return jsonb_build_object('ok', false, 'message', 'We don’t know that module code. Check it and try again.'); end if;
  select count(*) into n from marking_anchors where submitted_by = uid and created_at > now() - interval '1 day';
  if n >= 5 then return jsonb_build_object('ok', false, 'message', 'Thanks! That’s plenty for today.'); end if;
  insert into marking_anchors (uni, department, code, level, question, answer, mark, feedback, source, submitted_by, consent)
  values (m.uni, m.department, m.code, m.level, left(nullif(trim(p_question), ''), 2000), left(p_answer, 15000), p_mark,
          left(nullif(trim(p_feedback), ''), 4000), 'student', uid, true);
  return jsonb_build_object('ok', true, 'message', 'Thank you. We’ll check it and use it to make the marking for ' || m.code || ' more accurate.');
end $$;
revoke all on function public.share_marked_answer(text, int, text, text, text, boolean) from public, anon;
grant execute on function public.share_marked_answer(text, int, text, text, text, boolean) to authenticated;

-- the marker asks for up to 3 approved examples, nearest first, spread across marks
create or replace function public.anchors_for(p_uni text, p_department text, p_code text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with c as (
    select a.*, case when a.code = p_code then 0 when a.department is not distinct from p_department and p_department is not null then 1 else 2 end as near
    from marking_anchors a where a.active and a.uni = p_uni
      and (a.code = p_code or (p_department is not null and a.department = p_department) or a.department is null)
  ), pick as (
    -- one per class band, nearest first, so the marker sees the spread (e.g. a 2:2, a 2:1 and a First)
    select distinct on (case when mark >= 70 then 1 when mark >= 60 then 2 when mark >= 50 then 3 else 4 end) *
    from c order by case when mark >= 70 then 1 when mark >= 60 then 2 when mark >= 50 then 3 else 4 end, near, created_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'mark', mark, 'question', question, 'answer', left(answer, 1500), 'feedback', left(feedback, 400)) order by mark desc), '[]'::jsonb)
  from (select * from pick order by near, mark desc limit 3) x
$$;
revoke all on function public.anchors_for(text, text, text) from public, anon, authenticated;

-- average gap between real marks and our predictions, per university + department (8+ reports needed)
create or replace function public.calib_offset(p_uni text, p_department text)
returns int language sql stable security definer set search_path to 'public' as $$
  with d as (
    select a.real_mark - ((a.result->>'mark_low')::numeric + (a.result->>'mark_high')::numeric) / 2 as gap
    from mark_attempts a join ucl_modules m on m.code = a.code
    where a.real_mark between 0 and 100 and a.result ? 'mark_low' and a.result ? 'mark_high'
      and m.uni = p_uni and m.department is not distinct from p_department
  )
  select case when count(*) >= 8 and abs(avg(gap)) >= 2 then greatest(-6, least(6, round(avg(gap))))::int else 0 end from d
$$;
revoke all on function public.calib_offset(text, text) from public, anon, authenticated;
