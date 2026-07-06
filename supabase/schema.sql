-- Magic: The Gathering lister — Supabase schema
--
-- Layout:
--   1. Custom types (enums)
--   2. Tables
--   3. Row-level security
--   4. Triggers
--   5. Storage
--   6. Upgrades (run-once migrations for existing databases)
--
-- Enum notes:
--   PostgreSQL requires CREATE TYPE before use; there is no CREATE TYPE IF NOT EXISTS.
--   We guard with pg_type + pg_namespace checks so this file is safe to re-run.
--   Enums fit small, stable, app-internal vocabularies. Add values via ALTER TYPE … ADD VALUE.
--   See https://www.postgresql.org/docs/current/sql-createtype.html

-- ─── Custom types ───────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'photo_capture_target'
  ) then
    create type public.photo_capture_target as enum (
      'upc',
      'label'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'text_case_format'
  ) then
    create type public.text_case_format as enum (
      'as_detected',
      'lowercase',
      'sentence',
      'title',
      'upper'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'pricing_mode'
  ) then
    create type public.pricing_mode as enum (
      'market',
      'percent_below',
      'manual'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'market_price_preference'
  ) then
    create type public.market_price_preference as enum (
      'ebay',
      'upc',
      'show_all'
    );
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'item_status'
  ) then
    create type public.item_status as enum (
      'idle',
      'searching',
      'found',
      'ambiguous',
      'not_found'
    );
  end if;
end $$;

comment on type public.photo_capture_target is
  'What to photograph during a photo scan. Null on user_settings means ask each time.';

comment on type public.text_case_format is
  'Capitalization style for listing title and description text.';

comment on type public.pricing_mode is
  'How listing price is derived from market data.';

comment on type public.market_price_preference is
  'Preferred source when resolving market price for new listings.';

comment on type public.item_status is
  'Product lookup lifecycle for a listing row.';

-- ─── Profiles ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'App profile mirrored from auth.users.';

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── User settings (one row per user) ───────────────────────────────────────

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  photo_capture_target public.photo_capture_target,
  title_case public.text_case_format,
  description_case public.text_case_format,
  pricing_mode public.pricing_mode,
  percent_below integer,
  market_price_preference public.market_price_preference,
  constraint user_settings_percent_below_range
    check (percent_below is null or percent_below between 1 and 99)
);

comment on table public.user_settings is
  'Per-user listing defaults. Null column = user has not set a preference; app supplies fallbacks.';

comment on column public.user_settings.photo_capture_target is
  'Default photo scan target. Null prompts the user each session.';

comment on column public.user_settings.title_case is
  'Default capitalization for listing titles on new uploads.';

comment on column public.user_settings.description_case is
  'Default capitalization for listing descriptions on new uploads.';

comment on column public.user_settings.pricing_mode is
  'Default pricing strategy for new listings.';

comment on column public.user_settings.percent_below is
  'Default discount percentage when pricing_mode is percent_below.';

comment on column public.user_settings.market_price_preference is
  'Default market price source for new listings.';

alter table public.user_settings enable row level security;

create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- ─── Listings ───────────────────────────────────────────────────────────────

create table if not exists public.listings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id text not null,
  query text not null,
  status text not null default 'idle',
  original_upc text,
  original_sku text,
  product jsonb,
  ambiguous_results jsonb,
  custom_title text,
  custom_description text,
  quantity integer not null default 1,
  condition text,
  pricing_mode text not null default 'market',
  percent_below integer not null default 10,
  manual_price numeric not null default 0,
  market_price_preference text,
  selected_market_price_source text,
  notes text not null default '',
  ebay_exported_at timestamptz,
  ebay_listing_status text,
  ebay_listing_url text,
  photo_url text,
  user_image_url text,
  preferred_image_source text,
  detected_product_type text,
  detected_card_count text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.listings is 'Draft and exported eBay listings per user.';

create index if not exists listings_user_id_created_at_idx
  on public.listings (user_id, created_at desc);

alter table public.listings enable row level security;

create policy "Users can view own listings"
  on public.listings for select
  using (auth.uid() = user_id);

create policy "Users can insert own listings"
  on public.listings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own listings"
  on public.listings for update
  using (auth.uid() = user_id);

create policy "Users can delete own listings"
  on public.listings for delete
  using (auth.uid() = user_id);

-- ─── Auto-create profile + settings on signup ───────────────────────────────

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

-- ─── Storage bucket for listing images ──────────────────────────────────────
-- Create the bucket in Dashboard → Storage → New bucket:
--   Name: listing-images
--   Public bucket: ON (required for eBay export URLs)
--
-- Then run the policies below:

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = true;

create policy "Authenticated users upload own listing images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users update own listing images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users delete own listing images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read listing images"
  on storage.objects for select
  to public
  using (bucket_id = 'listing-images');

-- ─── Upgrades for existing projects ─────────────────────────────────────────

alter table public.listings
  add column if not exists market_price_preference text,
  add column if not exists selected_market_price_source text,
  add column if not exists ebay_listing_url text;

-- Migrate user_settings from jsonb `settings` column to per-setting columns:

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'settings'
  ) then
    alter table public.user_settings
      add column if not exists default_photo_capture_target text,
      add column if not exists default_title_case text,
      add column if not exists default_description_case text,
      add column if not exists default_pricing_mode text,
      add column if not exists default_percent_below integer,
      add column if not exists default_market_price_preference text;

    update public.user_settings
    set
      default_photo_capture_target = case
        when coalesce((settings->'configuredDefaults'->>'photoCaptureTarget')::boolean, false)
          then nullif(settings->>'defaultPhotoCaptureTarget', '')
        else null
      end,
      default_title_case = case
        when coalesce((settings->'configuredDefaults'->>'titleCase')::boolean, false)
          then nullif(settings->>'defaultTitleCase', '')
        else null
      end,
      default_description_case = case
        when coalesce((settings->'configuredDefaults'->>'descriptionCase')::boolean, false)
          then nullif(settings->>'defaultDescriptionCase', '')
        else null
      end,
      default_pricing_mode = case
        when coalesce((settings->'configuredDefaults'->>'pricingMode')::boolean, false)
          then nullif(settings->>'defaultPricingMode', '')
        else null
      end,
      default_percent_below = case
        when coalesce((settings->'configuredDefaults'->>'percentBelow')::boolean, false)
          then (settings->>'defaultPercentBelow')::integer
        else null
      end,
      default_market_price_preference = case
        when coalesce((settings->'configuredDefaults'->>'marketPriceSource')::boolean, false)
          then nullif(settings->>'defaultMarketPricePreference', '')
        else null
      end
    where settings is not null and settings != '{}'::jsonb;

    alter table public.user_settings drop column settings;
  end if;
end $$;

-- Drop legacy configured_* flags and updated_at; null out unset values:

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'configured_title_case'
  ) then
    update public.user_settings
    set
      default_photo_capture_target = case
        when configured_photo_capture_target then default_photo_capture_target::text
        else null
      end,
      default_title_case = case when configured_title_case then default_title_case::text else null end,
      default_description_case = case
        when configured_description_case then default_description_case::text
        else null
      end,
      default_pricing_mode = case when configured_pricing_mode then default_pricing_mode::text else null end,
      default_percent_below = case when configured_percent_below then default_percent_below else null end,
      default_market_price_preference = case
        when configured_market_price_source then default_market_price_preference::text
        else null
      end;

    alter table public.user_settings
      drop column if exists configured_photo_capture_target,
      drop column if exists configured_title_case,
      drop column if exists configured_description_case,
      drop column if exists configured_pricing_mode,
      drop column if exists configured_percent_below,
      drop column if exists configured_market_price_source;
  end if;
end $$;

alter table public.user_settings
  drop column if exists updated_at;

-- Rename default_* columns from intermediate migrations:

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'default_photo_capture_target'
  ) then
    alter table public.user_settings rename column default_photo_capture_target to photo_capture_target;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'default_title_case'
  ) then
    alter table public.user_settings rename column default_title_case to title_case;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'default_description_case'
  ) then
    alter table public.user_settings rename column default_description_case to description_case;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'default_pricing_mode'
  ) then
    alter table public.user_settings rename column default_pricing_mode to pricing_mode;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'default_percent_below'
  ) then
    alter table public.user_settings rename column default_percent_below to percent_below;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'default_market_price_preference'
  ) then
    alter table public.user_settings rename column default_market_price_preference to market_price_preference;
  end if;
end $$;

-- Ensure nullable columns, enum types, and percent_below range check:

alter table public.user_settings
  alter column photo_capture_target drop default,
  alter column title_case drop default,
  alter column description_case drop default,
  alter column pricing_mode drop default,
  alter column percent_below drop default,
  alter column market_price_preference drop default;

alter table public.user_settings
  alter column photo_capture_target drop not null,
  alter column title_case drop not null,
  alter column description_case drop not null,
  alter column pricing_mode drop not null,
  alter column percent_below drop not null,
  alter column market_price_preference drop not null;

alter table public.user_settings
  alter column photo_capture_target type public.photo_capture_target
    using photo_capture_target::public.photo_capture_target,
  alter column title_case type public.text_case_format
    using title_case::public.text_case_format,
  alter column description_case type public.text_case_format
    using description_case::public.text_case_format,
  alter column pricing_mode type public.pricing_mode
    using pricing_mode::public.pricing_mode,
  alter column market_price_preference type public.market_price_preference
    using market_price_preference::public.market_price_preference;

alter table public.user_settings
  drop constraint if exists user_settings_percent_below_range;

alter table public.user_settings
  add constraint user_settings_percent_below_range
    check (percent_below is null or percent_below between 1 and 99);

-- Migrate listings.status from text to item_status enum:

alter table public.listings
  alter column status type public.item_status
    using status::public.item_status;
