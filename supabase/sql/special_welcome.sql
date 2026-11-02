-- Personal welcome screens: a private note shown to one account after it signs in.
-- Who gets one, and what it says, lives only in this table (filled in from the Supabase dashboard / SQL editor),
-- never in the public site code. The table is locked: only special_welcome() reads it, and only for the caller's own email.
create table if not exists public.special_welcomes (
  email        text primary key check (email = lower(email)),
  sender       text not null,
  compliments  text[] not null,
  messages     text[] not null,
  shown        int not null default 0,
  last_shown   timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.special_welcomes enable row level security;
revoke all on public.special_welcomes from public, anon, authenticated;

-- Returns the next compliment and message for the signed-in user (or null), and counts the visit,
-- so every sign-in shows a different pair.
create or replace function public.special_welcome()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  e text := lower(coalesce(auth.jwt() ->> 'email', ''));
  r public.special_welcomes;
begin
  if e = '' then return null; end if;
  update public.special_welcomes
     set shown = shown + 1, last_shown = now()
   where email = e
   returning * into r;
  if not found then return null; end if;
  return json_build_object(
    'compliment', r.compliments[1 + ((r.shown - 1) % array_length(r.compliments, 1))],
    'message',    r.messages[1 + ((r.shown - 1) % array_length(r.messages, 1))],
    'sender',     r.sender,
    'visit',      r.shown
  );
end;
$$;
revoke all on function public.special_welcome() from public, anon;
grant execute on function public.special_welcome() to authenticated;
