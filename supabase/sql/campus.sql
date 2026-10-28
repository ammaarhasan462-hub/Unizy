-- Unizy campus features: uni email verification, module hubs, campus marketplace, focus rooms.
-- Applied as migration "campus_features". Everything is reached through security-definer RPCs;
-- tables have RLS on with no direct policies (except storage uploads for marketplace photos).

-- ---------------------------------------------------------------- verification
create table if not exists public.uni_verifications (
  user_id uuid primary key references auth.users on delete cascade,
  uni text not null,
  email text not null,
  verified_at timestamptz not null default now()
);
create unique index if not exists uni_verifications_email on public.uni_verifications (lower(email));
create table if not exists public.uni_verify_codes (
  user_id uuid primary key references auth.users on delete cascade,
  uni text not null,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  sends_day date not null default (now() at time zone 'Europe/London')::date,
  sends int not null default 1
);
alter table public.uni_verifications enable row level security;
alter table public.uni_verify_codes enable row level security;

create or replace function public._uni_email_ok(p_uni text, p_email text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_uni
    when 'ucl' then lower(p_email) ~ '@([a-z0-9-]+\.)*ucl\.ac\.uk$'
    when 'imperial' then lower(p_email) ~ '@([a-z0-9-]+\.)*(imperial|ic)\.ac\.uk$'
    when 'lse' then lower(p_email) ~ '@([a-z0-9-]+\.)*lse\.ac\.uk$'
    when 'oxford' then lower(p_email) ~ '@([a-z0-9-]+\.)*ox\.ac\.uk$'
    when 'cambridge' then lower(p_email) ~ '@([a-z0-9-]+\.)*cam\.ac\.uk$'
    when 'qmul' then lower(p_email) ~ '@([a-z0-9-]+\.)*qmul\.ac\.uk$'
    else false end
$$;
create or replace function public._uni_domain(p_uni text) returns text
language sql immutable set search_path = '' as $$
  select case p_uni when 'ucl' then 'ucl.ac.uk' when 'imperial' then 'imperial.ac.uk' when 'lse' then 'lse.ac.uk'
    when 'oxford' then 'ox.ac.uk' when 'cambridge' then 'cam.ac.uk' when 'qmul' then 'qmul.ac.uk' else 'ac.uk' end
$$;
create or replace function public._vuni(p uuid) returns text
language sql stable security definer set search_path = '' as $$
  select uni from public.uni_verifications where user_id = p
$$;
revoke all on function public._vuni(uuid) from public, anon, authenticated;

create or replace function public.verify_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); v public.uni_verifications; c public.uni_verify_codes;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into v from public.uni_verifications where user_id = me;
  select * into c from public.uni_verify_codes where user_id = me and expires_at > now();
  return jsonb_build_object('verified', v.user_id is not null, 'uni', v.uni, 'email', v.email,
    'pending', c.user_id is not null, 'pendingEmail', c.email, 'pendingUni', c.uni);
end $$;

-- ---------------------------------------------------------------- module hubs
create table if not exists public.hub_posts (
  id bigint generated always as identity primary key,
  uni text not null,
  module_key text not null,
  module_name text not null default '',
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('question', 'advice', 'notes', 'cards')),
  title text not null,
  body text not null default '',
  payload jsonb,
  reply_count int not null default 0,
  score int not null default 0,
  saves int not null default 0,
  status text not null default 'live' check (status in ('live', 'removed')),
  created_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);
create index if not exists hub_posts_mod on public.hub_posts (uni, module_key, last_activity desc);
create index if not exists hub_posts_user on public.hub_posts (user_id, created_at desc);
create table if not exists public.hub_replies (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.hub_posts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null,
  status text not null default 'live' check (status in ('live', 'removed')),
  created_at timestamptz not null default now()
);
create index if not exists hub_replies_post on public.hub_replies (post_id, id);
create table if not exists public.hub_votes (post_id bigint references public.hub_posts on delete cascade, user_id uuid references auth.users on delete cascade, primary key (post_id, user_id));
create table if not exists public.hub_saves (post_id bigint references public.hub_posts on delete cascade, user_id uuid references auth.users on delete cascade, primary key (post_id, user_id));
create table if not exists public.hub_members (
  uni text not null, module_key text not null, user_id uuid not null references auth.users on delete cascade,
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(),
  primary key (uni, module_key, user_id)
);
create table if not exists public.campus_reports (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('post', 'reply', 'listing', 'message')),
  target_id bigint not null,
  user_id uuid not null references auth.users on delete cascade,
  reason text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (kind, target_id, user_id)
);
alter table public.hub_posts enable row level security;
alter table public.hub_replies enable row level security;
alter table public.hub_votes enable row level security;
alter table public.hub_saves enable row level security;
alter table public.hub_members enable row level security;
alter table public.campus_reports enable row level security;

create or replace function public._who(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', coalesce(nullif(p2.display_name, ''), 'A student'), 'degree', p2.degree_name, 'year', p2.year)
  from (select 1) x left join public.profiles p2 on p2.user_id = p
$$;
revoke all on function public._who(uuid) from public, anon, authenticated;

create or replace function public.hub_state(p_module_key text, p_module_name text, p_sort text default 'active', p_kind text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80); out jsonb;
begin
  if me is null then raise exception 'not signed in'; end if;
  if k = '' then raise exception 'no module'; end if;
  vu := public._vuni(me);
  if vu is null then
    return jsonb_build_object('verified', false,
      'teaser', (select count(*) from public.hub_posts p join public.profiles pr on pr.user_id = me where p.uni = pr.uni and p.module_key = k and p.status = 'live'),
      'teaserMembers', (select count(*) from public.hub_members m join public.profiles pr on pr.user_id = me where m.uni = pr.uni and m.module_key = k));
  end if;
  insert into public.hub_members (uni, module_key, user_id) values (vu, k, me)
    on conflict (uni, module_key, user_id) do update set last_seen = now();
  select jsonb_build_object(
    'verified', true, 'uni', vu,
    'members', (select count(*) from public.hub_members m where m.uni = vu and m.module_key = k),
    'activeWeek', (select count(*) from public.hub_members m where m.uni = vu and m.module_key = k and m.last_seen > now() - interval '7 days'),
    'counts', jsonb_build_object(
      'all', (select count(*) from public.hub_posts p where p.uni = vu and p.module_key = k and p.status = 'live'),
      'question', (select count(*) from public.hub_posts p where p.uni = vu and p.module_key = k and p.status = 'live' and p.kind = 'question'),
      'advice', (select count(*) from public.hub_posts p where p.uni = vu and p.module_key = k and p.status = 'live' and p.kind = 'advice'),
      'notes', (select count(*) from public.hub_posts p where p.uni = vu and p.module_key = k and p.status = 'live' and p.kind = 'notes'),
      'cards', (select count(*) from public.hub_posts p where p.uni = vu and p.module_key = k and p.status = 'live' and p.kind = 'cards')),
    'posts', coalesce((select jsonb_agg(x order by rn) from (
      select row_number() over (order by case when p_sort = 'top' then p.score + p.saves else 0 end desc, case when p_sort = 'new' then p.created_at else p.last_activity end desc) rn,
        jsonb_build_object('id', p.id, 'kind', p.kind, 'title', p.title, 'body', p.body, 'payload', p.payload,
          'replies', p.reply_count, 'score', p.score, 'saves', p.saves, 'at', p.created_at, 'lastAt', p.last_activity,
          'mine', p.user_id = me, 'who', public._who(p.user_id),
          'voted', exists (select 1 from public.hub_votes v where v.post_id = p.id and v.user_id = me),
          'saved', exists (select 1 from public.hub_saves s where s.post_id = p.id and s.user_id = me)) x
      from public.hub_posts p
      where p.uni = vu and p.module_key = k and p.status = 'live' and (p_kind is null or p.kind = p_kind)
      order by case when p_sort = 'top' then p.score + p.saves else 0 end desc, case when p_sort = 'new' then p.created_at else p.last_activity end desc
      limit 60) s), '[]'::jsonb)
  ) into out;
  return out;
end $$;

create or replace function public.hub_post(p_module_key text, p_module_name text, p_kind text, p_title text, p_body text, p_payload jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
  t text := left(trim(coalesce(p_title, '')), 160); b text := trim(coalesce(p_body, '')); nid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then return jsonb_build_object('ok', false, 'message', 'Verify your uni email to post in module hubs.'); end if;
  if k = '' then return jsonb_build_object('ok', false, 'message', 'Pick a module first.'); end if;
  if p_kind not in ('question', 'advice', 'notes', 'cards') then return jsonb_build_object('ok', false, 'message', 'Choose what kind of post this is.'); end if;
  if char_length(t) < 3 then return jsonb_build_object('ok', false, 'message', 'Give your post a title.'); end if;
  if char_length(b) > 40000 then return jsonb_build_object('ok', false, 'message', 'That’s too long. Keep posts under 40,000 characters.'); end if;
  if p_kind in ('question', 'advice') and char_length(b) < 3 then return jsonb_build_object('ok', false, 'message', 'Write something in the post first.'); end if;
  if p_payload is not null and octet_length(p_payload::text) > 200000 then return jsonb_build_object('ok', false, 'message', 'That set is too big to share. Try fewer cards.'); end if;
  if p_kind = 'cards' and jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) < 1 then return jsonb_build_object('ok', false, 'message', 'Pick a set of cards to share.'); end if;
  if (select count(*) from public.hub_posts where user_id = me and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'message', 'You’ve posted a lot in the last hour. Try again a bit later.');
  end if;
  insert into public.hub_posts (uni, module_key, module_name, user_id, kind, title, body, payload)
    values (vu, k, left(coalesce(p_module_name, ''), 160), me, p_kind, t, b, p_payload) returning id into nid;
  insert into public.hub_members (uni, module_key, user_id) values (vu, k, me) on conflict do nothing;
  return jsonb_build_object('ok', true, 'id', nid);
end $$;

create or replace function public.hub_thread(p_post bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; p public.hub_posts;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  select * into p from public.hub_posts where id = p_post and status = 'live';
  if not found or vu is null or p.uni <> vu then return jsonb_build_object('ok', false, 'message', 'That post isn’t available.'); end if;
  return jsonb_build_object('ok', true, 'replies', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body, 'at', r.created_at, 'mine', r.user_id = me, 'op', r.user_id = p.user_id, 'who', public._who(r.user_id)) order by r.id)
    from public.hub_replies r where r.post_id = p_post and r.status = 'live'), '[]'::jsonb));
end $$;

create or replace function public.hub_reply(p_post bigint, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; p public.hub_posts; b text := trim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  select * into p from public.hub_posts where id = p_post and status = 'live';
  if not found or vu is null or p.uni <> vu then return jsonb_build_object('ok', false, 'message', 'That post isn’t available.'); end if;
  if char_length(b) < 1 then return jsonb_build_object('ok', false, 'message', 'Write a reply first.'); end if;
  if char_length(b) > 4000 then return jsonb_build_object('ok', false, 'message', 'Keep replies under 4,000 characters.'); end if;
  if (select count(*) from public.hub_replies where user_id = me and created_at > now() - interval '1 minute') >= 8 then
    return jsonb_build_object('ok', false, 'message', 'Slow down a little. Try again in a minute.');
  end if;
  insert into public.hub_replies (post_id, user_id, body) values (p_post, me, b);
  update public.hub_posts set reply_count = reply_count + 1, last_activity = now() where id = p_post;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.hub_toggle(p_post bigint, p_what text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; p public.hub_posts; was boolean;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  select * into p from public.hub_posts where id = p_post and status = 'live';
  if not found or vu is null or p.uni <> vu then return jsonb_build_object('ok', false, 'message', 'That post isn’t available.'); end if;
  if p_what = 'vote' then
    if p.user_id = me then return jsonb_build_object('ok', false, 'message', 'You can’t mark your own post as helpful.'); end if;
    delete from public.hub_votes where post_id = p_post and user_id = me returning true into was;
    if was then update public.hub_posts set score = greatest(0, score - 1) where id = p_post;
    else insert into public.hub_votes values (p_post, me); update public.hub_posts set score = score + 1 where id = p_post; end if;
  elsif p_what = 'save' then
    -- saving is one-way: once a copy is in your module it stays counted
    insert into public.hub_saves values (p_post, me) on conflict do nothing;
    if found then update public.hub_posts set saves = saves + 1 where id = p_post; end if;
    was := false;
  else raise exception 'bad toggle'; end if;
  return jsonb_build_object('ok', true, 'on', not coalesce(was, false));
end $$;

create or replace function public.hub_delete(p_kind text, p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_kind = 'post' then
    update public.hub_posts set status = 'removed' where id = p_id and user_id = me;
  elsif p_kind = 'reply' then
    update public.hub_replies set status = 'removed' where id = p_id and user_id = me returning post_id into pid;
    if pid is not null then update public.hub_posts set reply_count = greatest(0, reply_count - 1) where id = pid; end if;
  end if;
  return jsonb_build_object('ok', found, 'message', case when found then 'Removed.' else 'You can only remove your own posts.' end);
end $$;

-- ---------------------------------------------------------------- marketplace
create table if not exists public.market_listings (
  id bigint generated always as identity primary key,
  uni text not null,
  user_id uuid not null references auth.users on delete cascade,
  category text not null check (category in ('textbooks', 'kit', 'materials', 'housing', 'other')),
  title text not null,
  description text not null default '',
  price_pence int not null check (price_pence between 0 and 1000000),
  price_unit text not null default 'total' check (price_unit in ('total', 'week', 'month')),
  condition text,
  module_code text,
  location text,
  photos text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'reserved', 'sold', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_listings_uni on public.market_listings (uni, status, created_at desc);
create table if not exists public.market_threads (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.market_listings on delete cascade,
  buyer_id uuid not null references auth.users on delete cascade,
  seller_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  buyer_read bigint not null default 0,
  seller_read bigint not null default 0,
  unique (listing_id, buyer_id)
);
create table if not exists public.market_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.market_threads on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists market_messages_thread on public.market_messages (thread_id, id);
alter table public.market_listings enable row level security;
alter table public.market_threads enable row level security;
alter table public.market_messages enable row level security;

create or replace function public._listing_json(l public.market_listings, me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'category', l.category, 'title', l.title, 'description', l.description,
    'price', l.price_pence, 'unit', l.price_unit, 'condition', l.condition, 'module', l.module_code, 'location', l.location,
    'photos', to_jsonb(l.photos), 'status', l.status, 'at', l.created_at, 'mine', l.user_id = me, 'who', public._who(l.user_id),
    'threads', case when l.user_id = me then (select count(*) from public.market_threads t where t.listing_id = l.id) else null end,
    'myThread', (select t.id from public.market_threads t where t.listing_id = l.id and t.buyer_id = me))
$$;
revoke all on function public._listing_json(public.market_listings, uuid) from public, anon, authenticated;

create or replace function public.market_list(p_cat text default null, p_q text default null, p_mine boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then
    return jsonb_build_object('verified', false,
      'teaser', (select count(*) from public.market_listings l join public.profiles pr on pr.user_id = me where l.uni = pr.uni and l.status = 'active'));
  end if;
  return jsonb_build_object('verified', true, 'uni', vu,
    'active', (select count(*) from public.market_listings where uni = vu and status = 'active'),
    'unread', (select count(*) from public.market_threads t join public.market_messages m on m.thread_id = t.id
               where me in (t.buyer_id, t.seller_id) and m.user_id <> me and m.id > case when t.buyer_id = me then t.buyer_read else t.seller_read end),
    'listings', coalesce((select jsonb_agg(s.j order by s.rn) from (
      select public._listing_json(l, me) j, row_number() over (order by (l.status = 'active') desc, l.created_at desc) rn
      from public.market_listings l
      where l.uni = vu and l.status <> 'removed'
        and (case when p_mine then l.user_id = me else l.status in ('active', 'reserved') end)
        and (p_cat is null or l.category = p_cat)
        and (q is null or l.title ilike '%' || q || '%' or l.description ilike '%' || q || '%' or coalesce(l.module_code, '') ilike '%' || q || '%')
      order by (l.status = 'active') desc, l.created_at desc limit 80) s), '[]'::jsonb));
end $$;

create or replace function public.market_save(p_id bigint, p_category text, p_title text, p_description text, p_price_pence int, p_unit text,
  p_condition text, p_module text, p_location text, p_photos text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; t text := left(trim(coalesce(p_title, '')), 120); nid bigint; ph text[];
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null then return jsonb_build_object('ok', false, 'message', 'Verify your uni email to sell on the marketplace.'); end if;
  if p_category not in ('textbooks', 'kit', 'materials', 'housing', 'other') then return jsonb_build_object('ok', false, 'message', 'Choose a category.'); end if;
  if char_length(t) < 3 then return jsonb_build_object('ok', false, 'message', 'Give your listing a title.'); end if;
  if p_price_pence is null or p_price_pence < 0 or p_price_pence > 1000000 then return jsonb_build_object('ok', false, 'message', 'Enter a price between £0 and £10,000.'); end if;
  if char_length(coalesce(p_description, '')) > 3000 then return jsonb_build_object('ok', false, 'message', 'Keep the description under 3,000 characters.'); end if;
  -- photos must be files this user uploaded to the marketplace bucket
  select coalesce(array_agg(x), '{}') into ph from (select x from unnest(coalesce(p_photos, '{}')) x where x like me::text || '/%' and x !~ '\.\.' limit 4) s;
  if p_id is null then
    if (select count(*) from public.market_listings where user_id = me and created_at > now() - interval '1 day') >= 10 then
      return jsonb_build_object('ok', false, 'message', 'You can post up to 10 listings a day.');
    end if;
    insert into public.market_listings (uni, user_id, category, title, description, price_pence, price_unit, condition, module_code, location, photos)
    values (vu, me, p_category, t, left(trim(coalesce(p_description, '')), 3000), p_price_pence,
      case when p_category = 'housing' and p_unit in ('week', 'month') then p_unit else 'total' end,
      left(nullif(trim(coalesce(p_condition, '')), ''), 40), left(nullif(upper(trim(coalesce(p_module, ''))), ''), 40),
      left(nullif(trim(coalesce(p_location, '')), ''), 80), ph)
    returning id into nid;
    return jsonb_build_object('ok', true, 'id', nid, 'message', 'Listed. Coursemates at ' || public._uni_name(vu) || ' can see it now.');
  end if;
  update public.market_listings set category = p_category, title = t, description = left(trim(coalesce(p_description, '')), 3000),
    price_pence = p_price_pence, price_unit = case when p_category = 'housing' and p_unit in ('week', 'month') then p_unit else 'total' end,
    condition = left(nullif(trim(coalesce(p_condition, '')), ''), 40), module_code = left(nullif(upper(trim(coalesce(p_module, ''))), ''), 40),
    location = left(nullif(trim(coalesce(p_location, '')), ''), 80), photos = ph, updated_at = now()
  where id = p_id and user_id = me and status <> 'removed';
  if not found then return jsonb_build_object('ok', false, 'message', 'You can only edit your own listings.'); end if;
  return jsonb_build_object('ok', true, 'id', p_id, 'message', 'Listing updated.');
end $$;

create or replace function public.market_set_status(p_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_status not in ('active', 'reserved', 'sold', 'removed') then raise exception 'bad status'; end if;
  update public.market_listings set status = p_status, updated_at = now() where id = p_id and user_id = me and status <> 'removed';
  if not found then return jsonb_build_object('ok', false, 'message', 'You can only change your own listings.'); end if;
  return jsonb_build_object('ok', true, 'message', case p_status when 'sold' then 'Marked as sold.' when 'reserved' then 'Marked as reserved.' when 'removed' then 'Listing removed.' else 'Listing is live again.' end);
end $$;

create or replace function public.market_contact(p_listing bigint, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; l public.market_listings; tid bigint; b text := trim(coalesce(p_body, '')); mid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  select * into l from public.market_listings where id = p_listing;
  if vu is null or not found or l.uni <> vu or l.status not in ('active', 'reserved') then return jsonb_build_object('ok', false, 'message', 'That listing isn’t available any more.'); end if;
  if l.user_id = me then return jsonb_build_object('ok', false, 'message', 'That’s your own listing.'); end if;
  if char_length(b) < 1 or char_length(b) > 2000 then return jsonb_build_object('ok', false, 'message', 'Write a message (up to 2,000 characters).'); end if;
  if (select count(*) from public.market_threads where buyer_id = me and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('ok', false, 'message', 'You’ve contacted a lot of sellers today. Try again tomorrow.');
  end if;
  insert into public.market_threads (listing_id, buyer_id, seller_id) values (p_listing, me, l.user_id)
    on conflict (listing_id, buyer_id) do update set last_at = now() returning id into tid;
  insert into public.market_messages (thread_id, user_id, body) values (tid, me, b) returning id into mid;
  update public.market_threads set last_at = now(), buyer_read = mid where id = tid;
  return jsonb_build_object('ok', true, 'thread', tid);
end $$;

create or replace function public.market_send(p_thread bigint, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); t public.market_threads; b text := trim(coalesce(p_body, '')); mid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into t from public.market_threads where id = p_thread and me in (buyer_id, seller_id);
  if not found then return jsonb_build_object('ok', false, 'message', 'That conversation isn’t available.'); end if;
  if char_length(b) < 1 or char_length(b) > 2000 then return jsonb_build_object('ok', false, 'message', 'Write a message (up to 2,000 characters).'); end if;
  if (select count(*) from public.market_messages where user_id = me and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'message', 'Slow down a little. Try again in a minute.');
  end if;
  insert into public.market_messages (thread_id, user_id, body) values (p_thread, me, b) returning id into mid;
  update public.market_threads set last_at = now(),
    buyer_read = case when buyer_id = me then mid else buyer_read end,
    seller_read = case when seller_id = me then mid else seller_read end where id = p_thread;
  return jsonb_build_object('ok', true, 'id', mid);
end $$;

create or replace function public.market_inbox() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  return coalesce((select jsonb_agg(x order by (x ->> 'lastAt') desc) from (
    select jsonb_build_object('id', t.id, 'listing', l.id, 'title', l.title, 'price', l.price_pence, 'unit', l.price_unit, 'status', l.status,
      'photo', l.photos[1], 'selling', t.seller_id = me, 'other', public._who(case when t.seller_id = me then t.buyer_id else t.seller_id end),
      'lastAt', t.last_at,
      'last', (select left(m.body, 140) from public.market_messages m where m.thread_id = t.id order by m.id desc limit 1),
      'unread', (select count(*) from public.market_messages m where m.thread_id = t.id and m.user_id <> me and m.id > case when t.buyer_id = me then t.buyer_read else t.seller_read end)) x
    from public.market_threads t join public.market_listings l on l.id = t.listing_id
    where me in (t.buyer_id, t.seller_id)) s), '[]'::jsonb);
end $$;

create or replace function public.market_messages_for(p_thread bigint, p_after bigint default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); t public.market_threads; lastid bigint;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into t from public.market_threads where id = p_thread and me in (buyer_id, seller_id);
  if not found then return jsonb_build_object('ok', false); end if;
  select max(id) into lastid from public.market_messages where thread_id = p_thread;
  if lastid is not null then
    update public.market_threads set buyer_read = case when buyer_id = me then lastid else buyer_read end,
      seller_read = case when seller_id = me then lastid else seller_read end where id = p_thread;
  end if;
  return jsonb_build_object('ok', true, 'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'at', m.created_at, 'mine', m.user_id = me) order by m.id)
    from public.market_messages m where m.thread_id = p_thread and m.id > coalesce(p_after, 0)), '[]'::jsonb));
end $$;

-- marketplace photos: public bucket, students upload only into their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market', 'market', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "market upload own" on storage.objects;
create policy "market upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'market' and (storage.foldername(name))[1] = (select auth.uid())::text and public._vuni((select auth.uid())) is not null);
drop policy if exists "market delete own" on storage.objects;
create policy "market delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'market' and (storage.foldername(name))[1] = (select auth.uid())::text);
grant execute on function public._vuni(uuid) to authenticated;

-- ---------------------------------------------------------------- focus rooms
alter table public.profiles add column if not exists focus_public boolean not null default true;
create table if not exists public.focus_presence (
  user_id uuid primary key references auth.users on delete cascade,
  uni text not null,
  module_key text not null,
  module_name text not null default '',
  phase text not null default 'focus' check (phase in ('focus', 'break')),
  ends_at timestamptz,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists focus_presence_room on public.focus_presence (uni, module_key, last_seen);
create table if not exists public.focus_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  uni text,
  module_key text not null,
  module_name text not null default '',
  minutes int not null check (minutes between 1 and 240),
  ended_at timestamptz not null default now()
);
create index if not exists focus_sessions_user on public.focus_sessions (user_id, ended_at desc);
create index if not exists focus_sessions_mod on public.focus_sessions (uni, module_key, ended_at desc);
alter table public.focus_presence enable row level security;
alter table public.focus_sessions enable row level security;

create or replace function public.focus_ping(p_module_key text, p_module_name text, p_phase text, p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  if vu is null or k = '' then return jsonb_build_object('ok', false); end if;
  insert into public.focus_presence as fp (user_id, uni, module_key, module_name, phase, ends_at)
  values (me, vu, k, left(coalesce(p_module_name, ''), 160), case when p_phase = 'break' then 'break' else 'focus' end, least(p_ends_at, now() + interval '4 hours'))
  on conflict (user_id) do update set uni = excluded.uni, module_name = excluded.module_name, phase = excluded.phase, ends_at = excluded.ends_at, last_seen = now(),
    started_at = case when fp.module_key <> excluded.module_key then now() else fp.started_at end,
    module_key = excluded.module_key;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.focus_leave() returns void
language sql security definer set search_path = '' as $$
  delete from public.focus_presence where user_id = auth.uid()
$$;

create or replace function public.focus_log(p_module_key text, p_module_name text, p_minutes int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); k text := left(trim(coalesce(p_module_key, '')), 80); today int;
begin
  if me is null then raise exception 'not signed in'; end if;
  if k = '' or p_minutes is null or p_minutes < 1 or p_minutes > 240 then return jsonb_build_object('ok', false, 'message', 'Nothing to log.'); end if;
  -- a session can't overlap the previous one: no more minutes than have passed since the last log
  if exists (select 1 from public.focus_sessions where user_id = me and ended_at > now() - make_interval(mins => greatest(1, p_minutes - 1))) then
    return jsonb_build_object('ok', false, 'message', 'That overlaps a session you already logged.');
  end if;
  select coalesce(sum(minutes), 0) into today from public.focus_sessions where user_id = me and ended_at > now() - interval '24 hours';
  if today + p_minutes > 960 then return jsonb_build_object('ok', false, 'message', 'That’s more than 16 hours in a day, so it wasn’t logged.'); end if;
  insert into public.focus_sessions (user_id, uni, module_key, module_name, minutes) values (me, public._vuni(me), k, left(coalesce(p_module_name, ''), 160), p_minutes);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.focus_state(p_module_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); vu text; k text := left(trim(coalesce(p_module_key, '')), 80);
  wk timestamptz := date_trunc('week', now() at time zone 'Europe/London') at time zone 'Europe/London';
begin
  if me is null then raise exception 'not signed in'; end if;
  vu := public._vuni(me);
  delete from public.focus_presence where last_seen < now() - interval '10 minutes';
  return jsonb_build_object(
    'verified', vu is not null, 'uni', vu,
    'public', coalesce((select focus_public from public.profiles where user_id = me), true),
    'myWeek', coalesce((select jsonb_agg(jsonb_build_object('module', module_name, 'key', module_key, 'minutes', m) order by m desc) from (
        select module_key, max(module_name) module_name, sum(minutes) m from public.focus_sessions where user_id = me and ended_at >= wk group by module_key) s), '[]'::jsonb),
    'myDays', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'minutes', m) order by d) from (
        select (ended_at at time zone 'Europe/London')::date d, sum(minutes) m from public.focus_sessions where user_id = me and ended_at >= now() - interval '28 days' group by 1) s), '[]'::jsonb),
    'room', case when vu is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.display_name, ''), 'A student'), 'me', f.user_id = me, 'phase', f.phase, 'endsAt', f.ends_at, 'since', f.started_at) order by f.started_at)
        from public.focus_presence f left join public.profiles p on p.user_id = f.user_id
        where f.uni = vu and f.module_key = k and f.last_seen > now() - interval '90 seconds'), '[]'::jsonb) end,
    'uniNow', case when vu is null then 0 else (select count(*) from public.focus_presence f where f.uni = vu and f.last_seen > now() - interval '90 seconds' and f.phase = 'focus') end,
    'board', case when vu is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.display_name, ''), 'A student'), 'me', s.user_id = me, 'minutes', s.m) order by s.m desc) from (
        select user_id, sum(minutes) m from public.focus_sessions where uni = vu and module_key = k and ended_at >= wk group by user_id order by m desc limit 10) s
        join public.profiles p on p.user_id = s.user_id where p.focus_public or s.user_id = me), '[]'::jsonb) end,
    'moduleWeek', case when vu is null then 0 else (select coalesce(sum(minutes), 0) from public.focus_sessions where uni = vu and module_key = k and ended_at >= wk) end
  );
end $$;

create or replace function public.focus_set_public(p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.profiles set focus_public = coalesce(p_on, true) where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- reports
create or replace function public.campus_report(p_kind text, p_id bigint, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_kind not in ('post', 'reply', 'listing', 'message') then raise exception 'bad kind'; end if;
  insert into public.campus_reports (kind, target_id, user_id, reason) values (p_kind, p_id, me, left(coalesce(p_reason, ''), 500))
    on conflict (kind, target_id, user_id) do nothing;
  -- three independent reports hide a post or listing until it's reviewed
  if (select count(*) from public.campus_reports where kind = p_kind and target_id = p_id and status = 'open') >= 3 then
    if p_kind = 'post' then update public.hub_posts set status = 'removed' where id = p_id;
    elsif p_kind = 'reply' then update public.hub_replies set status = 'removed' where id = p_id;
    elsif p_kind = 'listing' then update public.market_listings set status = 'removed' where id = p_id; end if;
  end if;
  return jsonb_build_object('ok', true, 'message', 'Thanks. We’ll review it.');
end $$;

-- only signed-in students call these
do $$ declare f text; begin
  foreach f in array array['verify_status()', 'hub_state(text,text,text,text)', 'hub_post(text,text,text,text,text,jsonb)', 'hub_thread(bigint)', 'hub_reply(bigint,text)',
    'hub_toggle(bigint,text)', 'hub_delete(text,bigint)', 'market_list(text,text,boolean)', 'market_save(bigint,text,text,text,integer,text,text,text,text,text[])',
    'market_set_status(bigint,text)', 'market_contact(bigint,text)', 'market_send(bigint,text)', 'market_inbox()', 'market_messages_for(bigint,bigint)',
    'focus_ping(text,text,text,timestamptz)', 'focus_leave()', 'focus_log(text,text,integer)', 'focus_state(text)', 'focus_set_public(boolean)', 'campus_report(text,bigint,text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
