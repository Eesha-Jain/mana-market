-- Mana Market — Supabase schema (fresh start)
--
-- Layout:
--   1. Custom types (enums)
--   2. Tables
--   3. Row-level security
--   4. Triggers
--   5. Storage

-- ─── Custom types ───────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'photo_capture_target'
  ) then
    create type public.photo_capture_target as enum ('upc', 'label');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'text_case_format'
  ) then
    create type public.text_case_format as enum (
      'as_detected', 'lowercase', 'sentence', 'title', 'upper'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pricing_mode'
  ) then
    create type public.pricing_mode as enum ('market', 'percent_below', 'manual');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'market_price_preference'
  ) then
    create type public.market_price_preference as enum ('amazon', 'upc', 'show_all');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'workflow_status'
  ) then
    create type public.workflow_status as enum (
      'draft', 'reviewed', 'ready', 'listed', 'sold'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'lookup_status'
  ) then
    create type public.lookup_status as enum (
      'idle', 'searching', 'found', 'ambiguous', 'not_found'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pricing_source'
  ) then
    create type public.pricing_source as enum (
      'amazon', 'upc', 'ebay', 'tcgplayer', 'manual'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'marketplace_platform'
  ) then
    create type public.marketplace_platform as enum ('ebay', 'tcgplayer', 'facebook');
  end if;
end $$;

-- Existing projects created before `reviewed` was added
alter type public.workflow_status add value if not exists 'reviewed';

-- ─── Profiles ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ─── User settings ──────────────────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  photo_capture_target public.photo_capture_target,
  title_case public.text_case_format,
  description_case public.text_case_format,
  pricing_mode public.pricing_mode,
  percent_below integer,
  market_price_preference public.market_price_preference,
  default_category text,
  constraint user_settings_percent_below_range
    check (percent_below is null or percent_below between 1 and 99)
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
  on public.user_settings for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings for update using (auth.uid() = user_id);

-- ─── Communal catalog (items) ───────────────────────────────────────────────

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  upc text unique,
  asin text,
  title text not null default '',
  description text not null default '',
  default_category text,
  catalog_snapshot jsonb not null default '{}'::jsonb,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_upc_idx on public.items (upc) where upc is not null;
create index if not exists items_asin_idx on public.items (asin) where asin is not null;

alter table public.items enable row level security;

drop policy if exists "Authenticated users can read catalog items" on public.items;
create policy "Authenticated users can read catalog items"
  on public.items for select to authenticated using (true);

drop policy if exists "Authenticated users can insert catalog items" on public.items;
create policy "Authenticated users can insert catalog items"
  on public.items for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update catalog items" on public.items;
create policy "Authenticated users can update catalog items"
  on public.items for update to authenticated using (true);

-- ─── User inventory (user_items) ────────────────────────────────────────────

create table if not exists public.user_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid references public.items (id) on delete set null,
  reference_id text not null,
  query text not null,
  custom_title text,
  custom_description text,
  quantity integer not null default 1,
  condition text,
  price numeric not null default 0,
  image_urls text[] not null default '{}',
  category text,
  workflow_status public.workflow_status not null default 'draft',
  lookup_status public.lookup_status not null default 'idle',
  pricing_mode public.pricing_mode not null default 'market',
  percent_below integer not null default 10,
  pricing_source public.pricing_source not null default 'amazon',
  selected_market_price_source text,
  marketplace_listings jsonb not null default '{}'::jsonb,
  target_platforms text[] not null default '{}',
  original_upc text,
  original_sku text,
  user_image_url text,
  photo_url text,
  preferred_image_source text,
  notes text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_items_user_workflow_idx
  on public.user_items (user_id, workflow_status, created_at desc);

create index if not exists user_items_item_id_idx
  on public.user_items (item_id) where item_id is not null;

alter table public.user_items enable row level security;

drop policy if exists "Users can view own user_items" on public.user_items;
create policy "Users can view own user_items"
  on public.user_items for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own user_items" on public.user_items;
create policy "Users can insert own user_items"
  on public.user_items for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own user_items" on public.user_items;
create policy "Users can update own user_items"
  on public.user_items for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own user_items" on public.user_items;
create policy "Users can delete own user_items"
  on public.user_items for delete using (auth.uid() = user_id);

-- ─── Marketplace OAuth connections ──────────────────────────────────────────

create table if not exists public.marketplace_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform public.marketplace_platform not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  account_label text,
  scopes text[] not null default '{}',
  is_healthy boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.marketplace_connections enable row level security;

-- Safe view without OAuth secrets (used by authenticated clients).
create or replace view public.marketplace_connections_public
with (security_invoker = true) as
  select
    id,
    user_id,
    platform,
    token_expires_at,
    account_label,
    scopes,
    is_healthy,
    metadata,
    connected_at,
    updated_at
  from public.marketplace_connections;

grant select on public.marketplace_connections_public to authenticated;

-- Token read/write is server-only (service role). Users may delete their own row.
drop policy if exists "Users can manage own marketplace connections" on public.marketplace_connections;
drop policy if exists "Users can delete own marketplace connections" on public.marketplace_connections;

create policy "Users can delete own marketplace connections"
  on public.marketplace_connections for delete
  using (auth.uid() = user_id);

-- ─── Signup trigger ─────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Storage ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users upload own listing images" on storage.objects;
create policy "Authenticated users upload own listing images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users update own listing images" on storage.objects;
create policy "Authenticated users update own listing images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users delete own listing images" on storage.objects;
create policy "Authenticated users delete own listing images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Public read listing images" on storage.objects;
create policy "Public read listing images"
  on storage.objects for select to public
  using (bucket_id = 'listing-images');

-- ─── Fresh start migration: drop legacy listings table ──────────────────────

drop table if exists public.listings cascade;

-- Extend user_settings for new columns on existing projects
alter table public.user_settings
  add column if not exists default_category text;

-- Multi-image selection on user inventory (ordered; first is cover)
alter table public.user_items
  add column if not exists image_urls text[] not null default '{}';

-- Backfill from legacy single-image column, then drop it
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_items'
      and column_name = 'image_url'
  ) then
    update public.user_items
    set image_urls = array[image_url]
    where image_url is not null
      and image_url <> ''
      and (image_urls is null or cardinality(image_urls) = 0);

    alter table public.user_items drop column image_url;
  end if;
end $$;

-- Migrate market_price_preference enum values if old ebay preference exists
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'market_price_preference' and e.enumlabel = 'ebay'
  ) then
    alter type public.market_price_preference rename value 'ebay' to 'amazon';
  end if;
exception when others then
  null;
end $$;
