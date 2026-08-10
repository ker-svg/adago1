-- AdaGo Aşama 2.5: canlı online sürücüler (passenger haritası)
-- Dosya: supabase/migrations/002_5_live_drivers.sql
-- Supabase Dashboard → SQL Editor → Run
-- 001 / 002 dosyalarını değiştirme. Aşama 3 rides ekleme.
-- profiles / vehicles genel SELECT açılmaz (phone / plate / email yok).

-- ---------------------------------------------------------------------------
-- Helper: çağıran authenticated passenger mi?
-- SECURITY DEFINER → profiles RLS'ini bypass eder; yalnızca boolean döner.
-- ---------------------------------------------------------------------------
create or replace function public.is_authenticated_passenger()
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
        and p.role = 'passenger'
    );
$$;

revoke all on function public.is_authenticated_passenger() from public;
revoke all on function public.is_authenticated_passenger() from anon;
grant execute on function public.is_authenticated_passenger() to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: hedef satır passenger haritası / Realtime için uygun mu?
-- Kontrol: hedef role=driver + aktif vehicle
-- SECURITY DEFINER → profiles/vehicles RLS'ini bypass eder; boolean döner.
-- ---------------------------------------------------------------------------
create or replace function public.driver_visible_on_passenger_map(target_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_driver_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = target_driver_id
        and p.role = 'driver'
    )
    and exists (
      select 1
      from public.vehicles v
      where v.driver_id = target_driver_id
        and v.is_active = true
    );
$$;

revoke all on function public.driver_visible_on_passenger_map(uuid) from public;
revoke all on function public.driver_visible_on_passenger_map(uuid) from anon;
grant execute on function public.driver_visible_on_passenger_map(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: yalnızca role='passenger' authenticated kullanıcı
-- Dar alanlar: id, name, rating, vehicle_type, lat, lng, last_location_at
-- ---------------------------------------------------------------------------
create or replace function public.get_online_drivers_for_map()
returns table (
  id uuid,
  name text,
  rating numeric,
  vehicle_type text,
  lat double precision,
  lng double precision,
  last_location_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    p.full_name as name,
    d.rating,
    v.vehicle_type,
    d.last_lat as lat,
    d.last_lng as lng,
    d.last_location_at
  from public.drivers d
  inner join public.profiles p
    on p.id = d.id
  inner join lateral (
    select veh.vehicle_type
    from public.vehicles veh
    where veh.driver_id = d.id
      and veh.is_active = true
    order by veh.created_at desc
    limit 1
  ) v on true
  where public.is_authenticated_passenger()
    and d.is_online = true
    and d.last_lat is not null
    and d.last_lng is not null
    and d.last_location_at is not null
    and d.last_location_at > (now() - interval '90 seconds')
    and p.role = 'driver';
$$;

revoke all on function public.get_online_drivers_for_map() from public;
revoke all on function public.get_online_drivers_for_map() from anon;
grant execute on function public.get_online_drivers_for_map() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime SELECT policy (passenger)
-- profiles/vehicles EXISTS yerine SECURITY DEFINER helper kullanır.
-- Offline event: is_online=false ama last_location_at son 120 sn içindeyse
-- passenger UPDATE'i görebilir → marker kaldırılır.
-- drivers_select_own (002) korunur; policy'ler OR ile birleşir.
-- ---------------------------------------------------------------------------
drop policy if exists "drivers_select_map_authenticated" on public.drivers;
create policy "drivers_select_map_authenticated"
  on public.drivers for select
  using (
    public.is_authenticated_passenger()
    and public.driver_visible_on_passenger_map(id)
    and (
      is_online = true
      or (
        last_location_at is not null
        and last_location_at > (now() - interval '120 seconds')
      )
    )
  );

-- drivers tablosunu Realtime publication'a ekle (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'drivers'
  ) then
    alter publication supabase_realtime add table public.drivers;
  end if;
end $$;
