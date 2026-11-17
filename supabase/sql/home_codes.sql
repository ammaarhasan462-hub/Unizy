-- Homepage code box (Nov 2026): visitors can enter a society code on the homepage before they have an account.
-- check_code only says whether a code is live and whose it is; the Pro itself is still given by redeem_code once
-- they're signed in (the dashboard applies the remembered code on load).
create or replace function public.check_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare c public.promo_codes; v text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if length(v) < 3 or length(v) > 20 then return jsonb_build_object('ok', false, 'message', 'That code isn’t valid. Check the spelling or ask your society for the right one.'); end if;
  select * into c from public.promo_codes where code = v;
  if not found or not c.active then return jsonb_build_object('ok', false, 'message', 'That code isn’t valid. Check the spelling or ask your society for the right one.'); end if;
  if c.pass_until <= now() then return jsonb_build_object('ok', false, 'message', 'That code has expired.'); end if;
  if c.uses >= c.max_uses then return jsonb_build_object('ok', false, 'message', 'This code has been used up. Ask your society if there’s a new one.'); end if;
  return jsonb_build_object('ok', true, 'code', v, 'label', c.label, 'until', c.pass_until,
    'until_text', to_char(c.pass_until at time zone 'Europe/London', 'FMDD FMMonth YYYY'));
end $$;
revoke all on function public.check_code(text) from public;
grant execute on function public.check_code(text) to anon, authenticated;

-- A separate code for each society contacted on 17 Nov 2026.
insert into public.promo_codes (code, label, pass_until) values
  ('UCLHIST', 'UCL History Society', '2027-01-31 23:59+00'), ('UCLSTATS', 'UCL Statistics Society', '2027-01-31 23:59+00'),
  ('UCLPSYCH', 'UCL Psychology Society', '2027-01-31 23:59+00'), ('ICBIOSOC', 'Imperial BioSoc', '2027-01-31 23:59+00'),
  ('LSEPHIL', 'LSESU Philosophy Society', '2027-01-31 23:59+00'), ('DOCSOC', 'Imperial DoCSoc', '2027-01-31 23:59+00'),
  ('QMMATHS', 'QMSU Maths Society', '2027-01-31 23:59+00')
on conflict (code) do nothing;
