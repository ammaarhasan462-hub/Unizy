-- The marker (Nov 2026): UCL module catalogue, marking rubrics, practice questions, model answers and marked attempts.
-- Applied to the live project via SQL; kept here as the record of the schema.
-- ucl_modules is filled from UCL's public catalogue search feed with pg_net:
--   select net.http_get('https://cms-feed.ucl.ac.uk/s/search.json?collection=drupal-module-catalogue&num_ranks=1000&daat=10000&query=!showall&start_rank=' || s) from generate_series(1, 7001, 1000) s;
-- then parsed from net._http_response (see the insert in the Nov 2026 session).
create extension if not exists pg_net;

create table if not exists public.ucl_modules (
  code text primary key, title text not null, level int, credits numeric, faculty text, department text, term text,
  summary text, url text, details text, details_at timestamptz, updated_at timestamptz default now()
);
alter table public.ucl_modules enable row level security;
create policy "ucl_modules public read" on public.ucl_modules for select using (true);

create table if not exists public.marking_rubrics (
  key text primary key, department text, title text not null, body text not null, source_url text, source_note text, updated_at timestamptz default now()
);
alter table public.marking_rubrics enable row level security;
create policy "rubrics public read" on public.marking_rubrics for select using (true);

create table if not exists public.module_questions (
  id uuid primary key default gen_random_uuid(), code text not null references public.ucl_modules(code) on delete cascade,
  topic text, kind text not null default 'essay' check (kind in ('essay','problem','short')), question text not null, guide jsonb,
  position int default 0, created_at timestamptz default now()
);
alter table public.module_questions enable row level security;
create policy "questions public read" on public.module_questions for select using (true);

create table if not exists public.model_answers (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references public.module_questions(id) on delete cascade,
  author_name text not null, author_mark int, author_role text, answer text not null, notes jsonb, checked_by text,
  published boolean not null default false, created_at timestamptz default now()
);
alter table public.model_answers enable row level security;
create policy "model answers public read" on public.model_answers for select using (published);

create table if not exists public.mark_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  code text not null, question_id uuid references public.module_questions(id) on delete set null, question text not null,
  answer text not null, minutes int, result jsonb, real_mark int, created_at timestamptz default now()
);
alter table public.mark_attempts enable row level security;
create policy "own attempts read" on public.mark_attempts for select using (auth.uid() = user_id);
create policy "own attempts delete" on public.mark_attempts for delete using (auth.uid() = user_id);
create policy "own attempts real mark" on public.mark_attempts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke update on public.mark_attempts from authenticated, anon;
grant update (real_mark) on public.mark_attempts to authenticated;
