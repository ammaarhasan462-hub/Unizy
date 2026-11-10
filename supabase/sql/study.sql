-- Study area (Nov 2026): Module Map topics, tiered practice questions, red/amber/green ratings,
-- quick-recall results, flashcards made from lost marks, exam dates, and the background question writer.

-- ---------- topics for each module (written by the marker function, read by everyone) ----------
create table if not exists module_topics (
  code text not null references ucl_modules(code) on delete cascade,
  position int not null,
  title text not null,
  summary text,
  created_at timestamptz not null default now(),
  primary key (code, position)
);
alter table module_topics enable row level security;
drop policy if exists "topics public read" on module_topics;
create policy "topics public read" on module_topics for select using (true);

-- ---------- tiered questions ----------
-- tier: foundation (quick recall, self-checked, has "answer"), exam (exam-style, marked), first (First-class stretch, marked)
-- topic_pos: which module_topics row it belongs to; steps: worked solution for quantitative questions, revealed one step at a time
alter table module_questions add column if not exists tier text;
alter table module_questions add column if not exists topic_pos int;
alter table module_questions add column if not exists answer text;
alter table module_questions add column if not exists steps jsonb;
alter table module_questions drop constraint if exists module_questions_kind_check;
alter table module_questions add constraint module_questions_kind_check check (kind in ('essay', 'problem', 'short', 'recall'));
alter table module_questions drop constraint if exists module_questions_tier_check;
alter table module_questions add constraint module_questions_tier_check check (tier is null or tier in ('foundation', 'exam', 'first'));
create index if not exists module_questions_code_topic on module_questions (code, topic_pos);

-- ---------- marked answers know their topic, tier and the attempt they rewrite ----------
alter table mark_attempts add column if not exists topic_pos int;
alter table mark_attempts add column if not exists tier text;
alter table mark_attempts add column if not exists prev_id uuid references mark_attempts(id) on delete set null;

-- ---------- exam date per module (for countdowns) ----------
alter table my_modules add column if not exists exam_date date;
drop policy if exists "own modules update" on my_modules;
create policy "own modules update" on my_modules for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- red / amber / green self-rating per topic ----------
create table if not exists topic_ratings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null references ucl_modules(code) on delete cascade,
  topic_pos int not null,
  rating text not null check (rating in ('r', 'a', 'g')),
  updated_at timestamptz not null default now(),
  primary key (user_id, code, topic_pos)
);
alter table topic_ratings enable row level security;
drop policy if exists "own ratings" on topic_ratings;
create policy "own ratings" on topic_ratings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- quick-recall (Foundation) results: got it / not yet ----------
create table if not exists recall_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null references ucl_modules(code) on delete cascade,
  topic_pos int,
  question_id uuid references module_questions(id) on delete cascade,
  got boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists recall_log_user_code on recall_log (user_id, code);
alter table recall_log enable row level security;
drop policy if exists "own recall read" on recall_log;
drop policy if exists "own recall add" on recall_log;
drop policy if exists "own recall delete" on recall_log;
create policy "own recall read" on recall_log for select using (auth.uid() = user_id);
create policy "own recall add" on recall_log for insert with check (auth.uid() = user_id);
create policy "own recall delete" on recall_log for delete using (auth.uid() = user_id);

-- ---------- flashcards: made from lost marks (marker) and missed recall questions (browser) ----------
create table if not exists review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null references ucl_modules(code) on delete cascade,
  topic_pos int,
  front text not null check (length(front) between 3 and 600),
  back text not null check (length(back) between 1 and 1200),
  attempt_id uuid references mark_attempts(id) on delete set null,
  due date not null default current_date,
  interval_days int not null default 0,
  ease real not null default 2.5,
  reps int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, code, front)
);
create index if not exists review_cards_due on review_cards (user_id, due);
alter table review_cards enable row level security;
drop policy if exists "own cards" on review_cards;
create policy "own cards" on review_cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- question writing jobs (one per module; also a lock so two students don't trigger it twice) ----------
create table if not exists question_jobs (
  code text primary key references ucl_modules(code) on delete cascade,
  priority int not null default 0,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  source text not null default 'open' check (source in ('open', 'batch')),
  requested_by uuid references auth.users(id) on delete set null,
  tries int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
alter table question_jobs enable row level security; -- no policies: service role only

-- spend on the background batch, kept apart from ai_spend so it never uses up students' daily budget
create table if not exists ai_batch_spend (
  day date primary key,
  usd numeric not null default 0
);
alter table ai_batch_spend enable row level security;
create or replace function ai_add_batch_spend(p_usd numeric) returns void language sql security definer set search_path = public as $$
  insert into ai_batch_spend (day, usd) values ((now() at time zone 'Europe/London')::date, p_usd)
  on conflict (day) do update set usd = ai_batch_spend.usd + excluded.usd;
$$;
revoke all on function ai_add_batch_spend(numeric) from public, anon, authenticated;

-- claim a module for writing; returns true if this caller should write it now
create or replace function claim_question_job(p_code text, p_source text, p_user uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into question_jobs (code, status, source, requested_by, tries, started_at)
  values (p_code, 'running', p_source, p_user, 1, now())
  on conflict (code) do update set status = 'running', source = excluded.source, requested_by = coalesce(excluded.requested_by, question_jobs.requested_by),
    tries = question_jobs.tries + 1, started_at = now(), error = null
  where question_jobs.status in ('queued', 'failed') or (question_jobs.status = 'running' and question_jobs.started_at < now() - interval '4 minutes')
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function claim_question_job(text, text, uuid) from public, anon, authenticated;
