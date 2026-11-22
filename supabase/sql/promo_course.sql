-- Society codes carry the university, course and suggested modules they are for (applied 22 Nov 2026 as
-- migration promo_codes_course_modules). check_code and redeem_code now also return uni_name, course and
-- modules [{code, title, full, questions}], which the homepage code box and the dashboard welcome card show.
alter table public.promo_codes add column if not exists uni_name text, add column if not exists course text, add column if not exists modules text[];
update public.promo_codes set uni_name = 'Imperial College London', course = 'Electrical and Electronic Engineering',
  modules = array['ELEC40002','ELEC40003','ELEC40004','ELEC40006','ELEC40009','ELEC40013','ELEC40014'] where code = 'EESOC';
-- (uni_name/course for the other society codes were set from their labels in the same migration)
create or replace function public.code_modules(p_mods text[]) returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', m.code, 'title', m.title,
    'full', exists (select 1 from module_packs p where p.code = m.code and p.status = 'done'),
    'questions', (select count(*) from module_questions q where q.code = m.code)) order by array_position(p_mods, m.code)), '[]'::jsonb)
  from ucl_modules m where m.code = any(coalesce(p_mods, '{}'));
$$;
revoke all on function public.code_modules(text[]) from public, anon, authenticated;
-- check_code / redeem_code: see the live definitions (they append uni_name, course, until_text and modules to the reply).
