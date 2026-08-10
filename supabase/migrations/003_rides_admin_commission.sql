-- AdaGo Aşama 3: rides + admin RBAC + %5 komisyon
-- Dosya: supabase/migrations/003_rides_admin_commission.sql
-- Supabase Dashboard → SQL Editor → Run
-- 001 / 002 / 002_5 dosyalarını değiştirme.
-- Aşama 4 Realtime rides / PostGIS ekleme.
--
-- Admin oluşturma: bkz. supabase/ADMIN_SETUP.md
-- 1) Auth'da kullanıcı oluştur (Dashboard veya signUp)
-- 2) profiles.role = 'admin' (aşağıdaki SQL ile)
--    update public.profiles set role = 'admin' where id = '<USER_UUID>';

-- ---------------------------------------------------------------------------
-- 1) profiles.role: admin ekle (001 check constraint ALTER)
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('passenger', 'driver', 'admin'));

-- Signup trigger: admin metadata ile atanamaz
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'passenger');
  if v_role not in ('passenger', 'driver') then
    v_role := 'passenger';
  end if;

  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'AdaGo Kullanıcı'),
    new.raw_user_meta_data->>'phone',
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Client üzerinden role escalation engeli (SQL Editor / service_role ile admin atanabilir)
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Rol client üzerinden değiştirilemez';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();


-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_authenticated_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'driver'
    )
    and exists (
      select 1
      from public.drivers d
      where d.id = auth.uid()
    );
$$;

revoke all on function public.is_authenticated_driver() from public;
revoke all on function public.is_authenticated_driver() from anon;
grant execute on function public.is_authenticated_driver() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) rides tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  passenger_name text not null,
  passenger_phone text,
  from_label text not null,
  to_label text not null,
  from_lat double precision,
  from_lng double precision,
  to_lat double precision,
  to_lng double precision,
  route jsonb not null default '[]'::jsonb,
  distance_km numeric(10,2),
  duration_min numeric(10,1),
  estimated_fare numeric(12,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  trip_phase text
    check (
      trip_phase is null
      or trip_phase in ('assigning', 'en_route', 'in_progress', 'completed')
    ),
  gross_fare numeric(12,2),
  commission_rate numeric(5,4) default 0.05,
  commission_amount numeric(12,2),
  driver_net_amount numeric(12,2),
  commission_status text
    check (
      commission_status is null
      or commission_status in ('pending', 'collected')
    ),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists rides_passenger_id_idx on public.rides(passenger_id);
create index if not exists rides_driver_id_idx on public.rides(driver_id);
create index if not exists rides_status_idx on public.rides(status);
create index if not exists rides_created_at_idx on public.rides(created_at desc);
create index if not exists rides_commission_status_idx on public.rides(commission_status);

alter table public.rides enable row level security;

-- ---------------------------------------------------------------------------
-- 4) Admin SELECT policies (mevcut own-policies OR ile birleşir)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "drivers_select_admin" on public.drivers;
create policy "drivers_select_admin"
  on public.drivers for select
  using (public.is_admin());

drop policy if exists "vehicles_select_admin" on public.vehicles;
create policy "vehicles_select_admin"
  on public.vehicles for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5) rides RLS
-- ---------------------------------------------------------------------------
drop policy if exists "rides_select_passenger_own" on public.rides;
create policy "rides_select_passenger_own"
  on public.rides for select
  using (auth.uid() = passenger_id);

drop policy if exists "rides_select_driver_pending_or_own" on public.rides;
create policy "rides_select_driver_pending_or_own"
  on public.rides for select
  using (
    public.is_authenticated_driver()
    and (
      status = 'pending'
      or driver_id = auth.uid()
    )
  );

drop policy if exists "rides_select_admin" on public.rides;
create policy "rides_select_admin"
  on public.rides for select
  using (public.is_admin());

-- Insert/update doğrudan client'tan kısıtlı; lifecycle RPC üzerinden
drop policy if exists "rides_insert_passenger" on public.rides;
create policy "rides_insert_passenger"
  on public.rides for insert
  with check (
    auth.uid() = passenger_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'passenger'
    )
  );

drop policy if exists "rides_update_passenger_cancel" on public.rides;
create policy "rides_update_passenger_cancel"
  on public.rides for update
  using (auth.uid() = passenger_id)
  with check (auth.uid() = passenger_id);

drop policy if exists "rides_update_driver_assigned" on public.rides;
create policy "rides_update_driver_assigned"
  on public.rides for update
  using (
    public.is_authenticated_driver()
    and (driver_id = auth.uid() or (status = 'pending' and driver_id is null))
  )
  with check (
    public.is_authenticated_driver()
    and (driver_id = auth.uid() or driver_id is null)
  );

-- ---------------------------------------------------------------------------
-- 6) Ride lifecycle RPCs
-- ---------------------------------------------------------------------------
create or replace function public.create_ride(
  p_passenger_name text,
  p_passenger_phone text,
  p_from_label text,
  p_to_label text,
  p_from_lat double precision,
  p_from_lng double precision,
  p_to_lat double precision,
  p_to_lng double precision,
  p_route jsonb,
  p_distance_km numeric,
  p_duration_min numeric,
  p_estimated_fare numeric
)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'passenger'
  ) then
    raise exception 'Yalnızca yolcu yolculuk oluşturabilir';
  end if;
  if coalesce(trim(p_passenger_name), '') = '' then
    raise exception 'Yolcu adı gerekli';
  end if;
  if coalesce(trim(p_from_label), '') = '' or coalesce(trim(p_to_label), '') = '' then
    raise exception 'Başlangıç ve varış gerekli';
  end if;
  if p_estimated_fare is null or p_estimated_fare < 0 then
    raise exception 'Geçersiz ücret';
  end if;

  insert into public.rides (
    passenger_id,
    passenger_name,
    passenger_phone,
    from_label,
    to_label,
    from_lat,
    from_lng,
    to_lat,
    to_lng,
    route,
    distance_km,
    duration_min,
    estimated_fare,
    status,
    trip_phase
  ) values (
    auth.uid(),
    trim(p_passenger_name),
    nullif(trim(coalesce(p_passenger_phone, '')), ''),
    trim(p_from_label),
    trim(p_to_label),
    p_from_lat,
    p_from_lng,
    p_to_lat,
    p_to_lng,
    coalesce(p_route, '[]'::jsonb),
    p_distance_km,
    p_duration_min,
    round(p_estimated_fare, 2),
    'pending',
    'assigning'
  )
  returning * into v_ride;

  return v_ride;
end;
$$;

revoke all on function public.create_ride(
  text, text, text, text,
  double precision, double precision, double precision, double precision,
  jsonb, numeric, numeric, numeric
) from public;
revoke all on function public.create_ride(
  text, text, text, text,
  double precision, double precision, double precision, double precision,
  jsonb, numeric, numeric, numeric
) from anon;
grant execute on function public.create_ride(
  text, text, text, text,
  double precision, double precision, double precision, double precision,
  jsonb, numeric, numeric, numeric
) to authenticated;

create or replace function public.accept_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if not public.is_authenticated_driver() then
    raise exception 'Yalnızca sürücü kabul edebilir';
  end if;

  update public.rides
  set
    driver_id = auth.uid(),
    status = 'accepted',
    trip_phase = 'en_route',
    accepted_at = now()
  where id = p_ride_id
    and status = 'pending'
    and driver_id is null
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Yolculuk kabul edilemedi (başka sürücü aldı veya durum uygun değil)';
  end if;

  return v_ride;
end;
$$;

revoke all on function public.accept_ride(uuid) from public;
revoke all on function public.accept_ride(uuid) from anon;
grant execute on function public.accept_ride(uuid) to authenticated;

create or replace function public.start_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if not public.is_authenticated_driver() then
    raise exception 'Yalnızca sürücü başlatabilir';
  end if;

  update public.rides
  set
    trip_phase = 'in_progress',
    started_at = now()
  where id = p_ride_id
    and driver_id = auth.uid()
    and status = 'accepted'
    and trip_phase = 'en_route'
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Yolculuk başlatılamadı';
  end if;

  return v_ride;
end;
$$;

revoke all on function public.start_ride(uuid) from public;
revoke all on function public.start_ride(uuid) from anon;
grant execute on function public.start_ride(uuid) to authenticated;

create or replace function public.complete_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_gross numeric(12,2);
  v_rate numeric(5,4) := 0.05;
  v_commission numeric(12,2);
  v_net numeric(12,2);
begin
  if not public.is_authenticated_driver() then
    raise exception 'Yalnızca sürücü tamamlayabilir';
  end if;

  select * into v_ride
  from public.rides
  where id = p_ride_id
    and driver_id = auth.uid()
    and status = 'accepted'
    and trip_phase = 'in_progress'
  for update;

  if v_ride.id is null then
    raise exception 'Yolculuk tamamlanamadı';
  end if;

  v_gross := round(coalesce(v_ride.estimated_fare, 0), 2);
  v_commission := round(v_gross * v_rate, 2);
  v_net := round(v_gross - v_commission, 2);

  update public.rides
  set
    status = 'completed',
    trip_phase = 'completed',
    completed_at = now(),
    gross_fare = v_gross,
    commission_rate = v_rate,
    commission_amount = v_commission,
    driver_net_amount = v_net,
    commission_status = 'pending'
  where id = p_ride_id
  returning * into v_ride;

  update public.drivers
  set
    completed_trips = completed_trips + 1,
    updated_at = now()
  where id = auth.uid();

  return v_ride;
end;
$$;

revoke all on function public.complete_ride(uuid) from public;
revoke all on function public.complete_ride(uuid) from anon;
grant execute on function public.complete_ride(uuid) to authenticated;

create or replace function public.cancel_ride(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_existing public.rides;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;

  select * into v_existing
  from public.rides
  where id = p_ride_id
  for update;

  if v_existing.id is null then
    raise exception 'Yolculuk bulunamadı';
  end if;

  if v_existing.status in ('completed', 'cancelled') then
    raise exception 'Bu yolculuk iptal edilemez';
  end if;

  if not (
    v_existing.passenger_id = auth.uid()
    or (v_existing.driver_id = auth.uid() and public.is_authenticated_driver())
  ) then
    raise exception 'İptal yetkisi yok';
  end if;

  update public.rides
  set
    status = 'cancelled',
    trip_phase = null,
    cancelled_at = now(),
    gross_fare = null,
    commission_amount = null,
    driver_net_amount = null,
    commission_status = null
  where id = p_ride_id
  returning * into v_ride;

  return v_ride;
end;
$$;

revoke all on function public.cancel_ride(uuid) from public;
revoke all on function public.cancel_ride(uuid) from anon;
grant execute on function public.cancel_ride(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;

  select json_build_object(
    'total_users', (select count(*)::int from public.profiles where role in ('passenger', 'driver', 'admin')),
    'total_passengers', (select count(*)::int from public.profiles where role = 'passenger'),
    'total_drivers', (select count(*)::int from public.profiles where role = 'driver'),
    'online_drivers', (select count(*)::int from public.drivers where is_online = true),
    'total_rides', (select count(*)::int from public.rides),
    'completed_rides', (select count(*)::int from public.rides where status = 'completed'),
    'cancelled_rides', (select count(*)::int from public.rides where status = 'cancelled'),
    'total_fare_amount', coalesce((
      select sum(gross_fare) from public.rides where status = 'completed'
    ), 0),
    'total_commission', coalesce((
      select sum(commission_amount) from public.rides where status = 'completed'
    ), 0),
    'total_driver_net', coalesce((
      select sum(driver_net_amount) from public.rides where status = 'completed'
    ), 0),
    'pending_commission', coalesce((
      select sum(commission_amount)
      from public.rides
      where status = 'completed' and commission_status = 'pending'
    ), 0),
    'collected_commission', coalesce((
      select sum(commission_amount)
      from public.rides
      where status = 'completed' and commission_status = 'collected'
    ), 0)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public;
revoke all on function public.get_admin_dashboard_stats() from anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

create or replace function public.get_admin_users()
returns table (
  id uuid,
  full_name text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;

  return query
  select p.id, p.full_name, p.role, p.created_at
  from public.profiles p
  order by p.created_at desc;
end;
$$;

revoke all on function public.get_admin_users() from public;
revoke all on function public.get_admin_users() from anon;
grant execute on function public.get_admin_users() to authenticated;

create or replace function public.get_admin_drivers()
returns table (
  id uuid,
  full_name text,
  is_online boolean,
  rating numeric,
  completed_trips integer,
  vehicle_type text,
  brand text,
  model text,
  plate text,
  last_location_at timestamptz,
  last_lat double precision,
  last_lng double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;

  return query
  select
    d.id,
    p.full_name,
    d.is_online,
    d.rating,
    d.completed_trips,
    v.vehicle_type,
    v.brand,
    v.model,
    v.plate,
    d.last_location_at,
    d.last_lat,
    d.last_lng
  from public.drivers d
  inner join public.profiles p on p.id = d.id and p.role = 'driver'
  left join lateral (
    select veh.vehicle_type, veh.brand, veh.model, veh.plate
    from public.vehicles veh
    where veh.driver_id = d.id and veh.is_active = true
    order by veh.created_at desc
    limit 1
  ) v on true
  order by p.full_name;
end;
$$;

revoke all on function public.get_admin_drivers() from public;
revoke all on function public.get_admin_drivers() from anon;
grant execute on function public.get_admin_drivers() to authenticated;

create or replace function public.get_admin_rides()
returns table (
  id uuid,
  passenger_name text,
  driver_name text,
  from_label text,
  to_label text,
  status text,
  trip_phase text,
  estimated_fare numeric,
  gross_fare numeric,
  commission_amount numeric,
  driver_net_amount numeric,
  commission_status text,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;

  return query
  select
    r.id,
    r.passenger_name,
    dp.full_name as driver_name,
    r.from_label,
    r.to_label,
    r.status,
    r.trip_phase,
    r.estimated_fare,
    r.gross_fare,
    r.commission_amount,
    r.driver_net_amount,
    r.commission_status,
    r.created_at,
    r.completed_at
  from public.rides r
  left join public.profiles dp on dp.id = r.driver_id
  order by r.created_at desc;
end;
$$;

revoke all on function public.get_admin_rides() from public;
revoke all on function public.get_admin_rides() from anon;
grant execute on function public.get_admin_rides() to authenticated;

create or replace function public.get_admin_commissions(p_status text default null)
returns table (
  id uuid,
  completed_at timestamptz,
  passenger_name text,
  driver_name text,
  from_label text,
  to_label text,
  gross_fare numeric,
  commission_rate numeric,
  commission_amount numeric,
  driver_net_amount numeric,
  commission_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;

  return query
  select
    r.id,
    r.completed_at,
    r.passenger_name,
    dp.full_name as driver_name,
    r.from_label,
    r.to_label,
    r.gross_fare,
    r.commission_rate,
    r.commission_amount,
    r.driver_net_amount,
    r.commission_status
  from public.rides r
  left join public.profiles dp on dp.id = r.driver_id
  where r.status = 'completed'
    and (
      p_status is null
      or p_status = ''
      or p_status = 'all'
      or r.commission_status = p_status
    )
  order by r.completed_at desc nulls last;
end;
$$;

revoke all on function public.get_admin_commissions(text) from public;
revoke all on function public.get_admin_commissions(text) from anon;
grant execute on function public.get_admin_commissions(text) to authenticated;

create or replace function public.get_admin_driver_financials()
returns table (
  driver_id uuid,
  driver_name text,
  completed_rides integer,
  total_gross numeric,
  total_commission numeric,
  total_net numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;

  return query
  select
    d.id as driver_id,
    p.full_name as driver_name,
    count(r.id)::int as completed_rides,
    coalesce(sum(r.gross_fare), 0) as total_gross,
    coalesce(sum(r.commission_amount), 0) as total_commission,
    coalesce(sum(r.driver_net_amount), 0) as total_net
  from public.drivers d
  inner join public.profiles p on p.id = d.id and p.role = 'driver'
  left join public.rides r
    on r.driver_id = d.id and r.status = 'completed'
  group by d.id, p.full_name
  order by total_commission desc, p.full_name;
end;
$$;

revoke all on function public.get_admin_driver_financials() from public;
revoke all on function public.get_admin_driver_financials() from anon;
grant execute on function public.get_admin_driver_financials() to authenticated;
