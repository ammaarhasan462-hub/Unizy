-- King's College London ('kcl'): allowed on profiles and the study profile, and named by the university helpers.
alter table public.profiles drop constraint if exists profiles_uni_check;
alter table public.profiles add constraint profiles_uni_check check (uni = any (array['ucl', 'imperial', 'lse', 'oxford', 'cambridge', 'qmul', 'kcl']));
alter table public.study_profile drop constraint if exists study_profile_uni_check;
alter table public.study_profile add constraint study_profile_uni_check check (uni = any (array['ucl', 'imperial', 'qmul', 'lse', 'kcl']));

create or replace function public._uni_domain(p_uni text) returns text language sql immutable set search_path to '' as $function$
  select case p_uni when 'ucl' then 'ucl.ac.uk' when 'imperial' then 'imperial.ac.uk' when 'lse' then 'lse.ac.uk'
    when 'oxford' then 'ox.ac.uk' when 'cambridge' then 'cam.ac.uk' when 'qmul' then 'qmul.ac.uk' when 'kcl' then 'kcl.ac.uk' else 'ac.uk' end
$function$;

create or replace function public._uni_email_ok(p_uni text, p_email text) returns boolean language sql immutable set search_path to '' as $function$
  select case p_uni
    when 'ucl' then lower(p_email) ~ '@([a-z0-9-]+\.)*ucl\.ac\.uk$'
    when 'imperial' then lower(p_email) ~ '@([a-z0-9-]+\.)*(imperial|ic)\.ac\.uk$'
    when 'lse' then lower(p_email) ~ '@([a-z0-9-]+\.)*lse\.ac\.uk$'
    when 'oxford' then lower(p_email) ~ '@([a-z0-9-]+\.)*ox\.ac\.uk$'
    when 'cambridge' then lower(p_email) ~ '@([a-z0-9-]+\.)*cam\.ac\.uk$'
    when 'qmul' then lower(p_email) ~ '@([a-z0-9-]+\.)*qmul\.ac\.uk$'
    when 'kcl' then lower(p_email) ~ '@([a-z0-9-]+\.)*kcl\.ac\.uk$'
    else false end
$function$;

create or replace function public._uni_name(p_uni text) returns text language sql immutable as $function$
  select case p_uni when 'ucl' then 'UCL' when 'imperial' then 'Imperial' when 'lse' then 'LSE' when 'oxford' then 'Oxford' when 'cambridge' then 'Cambridge' when 'qmul' then 'Queen Mary' when 'kcl' then 'King''s' else 'your university' end
$function$;

create or replace function public._uni_prefix(p_uni text) returns text language sql immutable as $function$
  select case p_uni when 'ucl' then 'UCL' when 'imperial' then 'IMP' when 'lse' then 'LSE' when 'oxford' then 'OXF' when 'cambridge' then 'CAM' when 'qmul' then 'QMU' when 'kcl' then 'KCL' else 'UNI' end
$function$;

-- the university lists inside social_state, lti_add_platform and public_reviews gain King's
do $$
declare f text; d text;
begin
  foreach f in array array['social_state', 'lti_add_platform', 'public_reviews'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f;
    if d is null then continue; end if;
    d := replace(d, '''cambridge'',''qmul'')', '''cambridge'',''qmul'',''kcl'')');
    d := replace(d, '''cambridge'', ''qmul'')', '''cambridge'', ''qmul'', ''kcl'')');
    d := replace(d, 'when ''qmul'' then ''Queen Mary'' end', 'when ''qmul'' then ''Queen Mary'' when ''kcl'' then ''King''''s'' end');
    execute d;
  end loop;
end $$;
