-- Per-university figures for the homepage tabs, and the course lists for the dashboard set-up (non-UCL universities;
-- UCL's full undergraduate list is site/data/courses-ucl.json, built by tools/build_ucl_courses.py).

CREATE OR REPLACE FUNCTION public.public_uni_stats()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_agg(x order by x.uni), '[]'::json) from (
    select m.uni,
      count(*)::int as modules,
      count(distinct m.department)::int as departments,
      (select count(*)::int from marking_rubrics r where r.uni = m.uni) as rubrics
    from ucl_modules m group by m.uni
  ) x;
$function$;
grant execute on function public.public_uni_stats() to anon, authenticated;

CREATE OR REPLACE FUNCTION public.uni_courses(p_uni text)
 RETURNS TABLE(prog text, name text, years integer, modules integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with p as (
    select unnest(programmes) as prog from ucl_modules where uni = p_uni and programmes is not null
  )
  select prog,
    trim(regexp_replace(regexp_replace(prog, '^(PROG[0-9]+|[A-Z][A-Z0-9]{3}) ', ''), '\s+', ' ', 'g')) as name,
    (case when prog ~* 'MBBS/BSc' then 6 when prog ~* 'MBBS.*(graduate|GEP)' then 4 when prog ~* 'MBBS' then 5 when prog ~* '\mBDS\M' then 5
          when prog ~* '\m(MEng|MSci|MPharm)\M' then 4 else 3 end
     + case when prog ~* '(year abroad|year in industry|placement year|research abroad|4 year|integrated year|\(paris\)| and chinese|language, culture)' and prog !~* '\m(MEng|MSci)\M' then 1 else 0 end
     + case when prog ~* '\m(MEng|MSci)\M' and prog ~* '(year in industry|year abroad)' and prog ~* 'and a year' then 1 else 0 end)::int as years,
    count(*)::int as modules
  from p
  where prog !~* '(exchange|erasmus|pre-masters|graduate diploma|fdcert|certhe|^ma in |^msc |i-explore|icbs joint|senior status)'
  group by prog
  having count(*) >= 3
  order by 2;
$function$;
grant execute on function public.uni_courses(text) to anon, authenticated;
