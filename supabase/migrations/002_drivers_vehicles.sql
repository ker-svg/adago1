-- AdaGo Aşama 2: drivers + vehicles + RLS
-- Dosya: supabase/migrations/002_drivers_vehicles.sql
-- Supabase Dashboard → SQL Editor → Run
-- Aşama 3–5 migrationlarını burada çalıştırma.

create table if not exists public.drivers (
  id uuid primary key references public.profiles(id) on delete cascade,
  is_online boolean not null default false,
  rating numeric(2,1) not null default 5.0,
  completed_trips integer not null default 0,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_type text not null,
  brand text,
  model text,
  color text,
  plate text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vehicles_driver_id_idx on public.vehicles(driver_id);
create index if not exists drivers_is_online_idx on public.drivers(is_online);

alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;

-- DRIVERS policies
drop policy if exists "drivers_select_own" on public.drivers;
create policy "drivers_select_own"
  on public.drivers for select
  using (auth.uid() = id);

drop policy if exists "drivers_insert_own_driver_role" on public.drivers;
create policy "drivers_insert_own_driver_role"
  on public.drivers for insert
  with check (
    auth.uid() = id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
    )
  );

drop policy if exists "drivers_update_own" on public.drivers;
create policy "drivers_update_own"
  on public.drivers for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
    )
  );

-- VEHICLES policies
drop policy if exists "vehicles_select_own" on public.vehicles;
create policy "vehicles_select_own"
  on public.vehicles for select
  using (auth.uid() = driver_id);

drop policy if exists "vehicles_insert_own" on public.vehicles;
create policy "vehicles_insert_own"
  on public.vehicles for insert
  with check (
    auth.uid() = driver_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
    )
  );

drop policy if exists "vehicles_update_own" on public.vehicles;
create policy "vehicles_update_own"
  on public.vehicles for update
  using (auth.uid() = driver_id)
  with check (
    auth.uid() = driver_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
    )
  );

drop policy if exists "vehicles_delete_own" on public.vehicles;
create policy "vehicles_delete_own"
  on public.vehicles for delete
  using (auth.uid() = driver_id);
