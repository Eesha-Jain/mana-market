-- MTG Lister — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- ─── Profiles ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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
  photo_url text,
  user_image_url text,
  preferred_image_source text,
  detected_product_type text,
  detected_card_count text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

  insert into public.user_settings (user_id, settings)
  values (new.id, '{}'::jsonb)
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
-- Run if you already created listings before market price preference was added:

alter table public.listings
  add column if not exists market_price_preference text,
  add column if not exists selected_market_price_source text;
