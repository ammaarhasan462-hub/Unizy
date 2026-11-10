-- Nov 2026: shorter, tighter free trial so students pay to keep using Unizy.
-- Trial: 3 days from sign-up, with 3 markings and 3 tutor questions a day (UK days).
-- After the trial (no Pro, no pass): no free marking or tutor; Pro unlocks them.
-- Change the numbers in ai_settings (trial_days, trial_daily_assess, trial_daily_actions); the messages students
-- see come from ai_take_plan's "message" field, so copy changes don't need the edge functions redeployed.

alter table public.ai_settings
  add column if not exists trial_daily_assess int not null default 3,
  add column if not exists trial_daily_actions int not null default 3;
alter table public.ai_usage
  add column if not exists assess int not null default 0,
  add column if not exists actions int not null default 0;

update public.ai_settings set trial_days = 3, trial_daily_assess = 3, trial_daily_actions = 3, free_weekly_assess = 0, free_weekly_actions = 0 where id;

create or replace function public.ai_take_plan(p_user uuid, p_units integer, p_kind text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s public.ai_settings; st jsonb; tier text; v_day date := (now() at time zone 'Europe/London')::date;
  v_week date := date_trunc('week', (now() at time zone 'Europe/London'))::date;
  v_global int; v_used int; cap int; w public.ai_weekly; u public.ai_usage; spent numeric; is_mark boolean := p_kind = 'assess';
  last_day boolean;
begin
  select * into s from public.ai_settings where id;
  st := public.plan_status(p_user); tier := st->>'tier';
  select coalesce(usd, 0) into spent from public.ai_spend where day = v_day;
  if coalesce(spent, 0) >= s.daily_budget_gbp * s.usd_per_gbp then return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'budget'); end if;
  select coalesce(sum(units), 0) into v_global from public.ai_usage where day = v_day;
  if v_global + p_units > s.global_daily_units then return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'global'); end if;
  insert into public.ai_usage (user_id, day, units) values (p_user, v_day, 0) on conflict (user_id, day) do nothing;

  if tier = 'pro' then
    cap := s.pro_daily_units;
    update public.ai_usage set units = units + p_units, assess = assess + is_mark::int, actions = actions + (not is_mark)::int
      where user_id = p_user and day = v_day and units + p_units <= cap returning units into v_used;
    if v_used is null then return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'daily'); end if;
    return jsonb_build_object('ok', true, 'tier', tier, 'left', cap - v_used, 'period', 'day');
  end if;

  if tier = 'trial' then
    last_day := ((st->>'until')::timestamptz at time zone 'Europe/London')::date <= v_day;
    update public.ai_usage set units = units + p_units, assess = assess + is_mark::int, actions = actions + (not is_mark)::int
      where user_id = p_user and day = v_day and units + p_units <= s.user_daily_units
        and case when is_mark then assess + 1 <= s.trial_daily_assess else actions + 1 <= s.trial_daily_actions end
      returning * into u;
    if u.user_id is null then
      select * into u from public.ai_usage where user_id = p_user and day = v_day;
      if is_mark and u.assess >= s.trial_daily_assess then
        return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'trial_assess', 'upgrade', true, 'message',
          'You’ve used today’s ' || s.trial_daily_assess || ' free markings. Go Pro to keep getting answers marked' ||
          case when last_day then '.' else ', or come back tomorrow while your free trial lasts.' end);
      elsif not is_mark and u.actions >= s.trial_daily_actions then
        return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'trial_actions', 'upgrade', true, 'message',
          'You’ve used today’s ' || s.trial_daily_actions || ' free tutor questions. Go Pro to keep asking' ||
          case when last_day then '.' else ', or come back tomorrow while your free trial lasts.' end);
      end if;
      return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'daily');
    end if;
    return jsonb_build_object('ok', true, 'tier', tier, 'period', 'day',
      'left', case when is_mark then s.trial_daily_assess - u.assess else s.trial_daily_actions - u.actions end);
  end if;

  -- free (trial over, no Pro): nothing free unless the weekly allowances are switched back on in ai_settings
  if (is_mark and s.free_weekly_assess <= 0) or (not is_mark and s.free_weekly_actions <= 0) then
    return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'trial_over', 'upgrade', true, 'message',
      'Your ' || s.trial_days || '-day free trial has ended. Go Pro to keep ' || case when is_mark then 'getting your answers marked.' else 'using the tutor.' end);
  end if;
  insert into public.ai_weekly (user_id, week) values (p_user, v_week) on conflict (user_id, week) do nothing;
  if is_mark then
    update public.ai_weekly set assess = assess + 1 where user_id = p_user and week = v_week and assess + 1 <= s.free_weekly_assess returning * into w;
    if w.user_id is null then return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'free_assess'); end if;
  else
    update public.ai_weekly set actions = actions + 1 where user_id = p_user and week = v_week and actions + 1 <= s.free_weekly_actions returning * into w;
    if w.user_id is null then return jsonb_build_object('ok', false, 'tier', tier, 'reason', 'free_weekly'); end if;
  end if;
  update public.ai_usage set units = units + p_units where user_id = p_user and day = v_day;
  return jsonb_build_object('ok', true, 'tier', tier, 'left', case when is_mark then s.free_weekly_assess - w.assess else s.free_weekly_actions - w.actions end, 'period', 'week');
end $function$;

create or replace function public.ai_refund_plan(p_user uuid, p_units integer, p_kind text, p_tier text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_week date := date_trunc('week', (now() at time zone 'Europe/London'))::date; is_mark boolean := p_kind = 'assess';
begin
  update public.ai_usage set units = greatest(0, units - p_units),
    assess = greatest(0, assess - is_mark::int), actions = greatest(0, actions - (not is_mark)::int)
    where user_id = p_user and day = (now() at time zone 'Europe/London')::date;
  if p_tier = 'free' then
    if is_mark then update public.ai_weekly set assess = greatest(0, assess - 1) where user_id = p_user and week = v_week;
    else update public.ai_weekly set actions = greatest(0, actions - 1) where user_id = p_user and week = v_week; end if;
  end if;
end $function$;

create or replace function public.my_plan()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); st jsonb; s public.ai_settings; w public.ai_weekly; u public.ai_usage;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into s from public.ai_settings where id;
  st := public.plan_status(me);
  if st->>'tier' = 'free' then
    select * into w from public.ai_weekly where user_id = me and week = date_trunc('week', (now() at time zone 'Europe/London'))::date;
    return st || jsonb_build_object('actionsLeft', greatest(0, s.free_weekly_actions - coalesce(w.actions, 0)), 'assessLeft', greatest(0, s.free_weekly_assess - coalesce(w.assess, 0)),
      'actionsPerWeek', s.free_weekly_actions, 'assessPerWeek', s.free_weekly_assess, 'trialOver', s.free_weekly_actions <= 0 and s.free_weekly_assess <= 0, 'trialDays', s.trial_days);
  end if;
  select * into u from public.ai_usage where user_id = me and day = (now() at time zone 'Europe/London')::date;
  if st->>'tier' = 'trial' then
    return st || jsonb_build_object('unitsLeft', s.user_daily_units - coalesce(u.units, 0),
      'assessLeft', greatest(0, s.trial_daily_assess - coalesce(u.assess, 0)), 'actionsLeft', greatest(0, s.trial_daily_actions - coalesce(u.actions, 0)),
      'assessPerDay', s.trial_daily_assess, 'actionsPerDay', s.trial_daily_actions, 'trialDays', s.trial_days);
  end if;
  return st || jsonb_build_object('unitsLeft', s.pro_daily_units - coalesce(u.units, 0));
end $function$;
