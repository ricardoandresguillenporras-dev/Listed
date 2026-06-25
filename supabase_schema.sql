-- ══════════════════════════════════════════════════════════════════════
-- SuperLista — Supabase schema
-- Run this once in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/tvfkmvattmlfruajwdibg/sql/new
-- ══════════════════════════════════════════════════════════════════════

-- Single table per data domain, keyed by device_id (no auth required for now)

-- 1. Lists (contains items as JSON array inside each list object)
create table if not exists sl_lists (
  device_id   text        not null,
  data        jsonb       not null default '[]',
  updated_at  timestamptz not null default now(),
  primary key (device_id)
);

-- 2. Profile (name + budget)
create table if not exists sl_profile (
  device_id   text        not null,
  data        jsonb       not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (device_id)
);

-- 3. Settings (currency, theme, quickAmts)
create table if not exists sl_settings (
  device_id   text        not null,
  data        jsonb       not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (device_id)
);

-- 4. History (purchase sessions array)
create table if not exists sl_history (
  device_id   text        not null,
  data        jsonb       not null default '[]',
  updated_at  timestamptz not null default now(),
  primary key (device_id)
);

-- Auto-update updated_at on every write
create or replace function sl_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger sl_lists_updated_at
  before update on sl_lists
  for each row execute function sl_set_updated_at();

create or replace trigger sl_profile_updated_at
  before update on sl_profile
  for each row execute function sl_set_updated_at();

create or replace trigger sl_settings_updated_at
  before update on sl_settings
  for each row execute function sl_set_updated_at();

create or replace trigger sl_history_updated_at
  before update on sl_history
  for each row execute function sl_set_updated_at();

-- ── Row-Level Security (RLS) ──────────────────────────────────────────
-- Each device can only read/write its own rows.
-- device_id is a client-generated UUID stored in localStorage.

alter table sl_lists    enable row level security;
alter table sl_profile  enable row level security;
alter table sl_settings enable row level security;
alter table sl_history  enable row level security;

-- Allow anon key full access scoped to their device_id
-- (device_id is passed as a request header: x-device-id)

create policy "device own lists" on sl_lists
  for all using (device_id = current_setting('request.headers', true)::json->>'x-device-id');

create policy "device own profile" on sl_profile
  for all using (device_id = current_setting('request.headers', true)::json->>'x-device-id');

create policy "device own settings" on sl_settings
  for all using (device_id = current_setting('request.headers', true)::json->>'x-device-id');

create policy "device own history" on sl_history
  for all using (device_id = current_setting('request.headers', true)::json->>'x-device-id');
