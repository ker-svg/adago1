-- AdaGo Aşama 4: canlı yolculuk takibi (Realtime + arrived / passenger_onboard)
-- Dosya: supabase/migrations/004_realtime_trip_tracking.sql
-- Supabase Dashboard → SQL Editor → Run (003_2 sonrası)
-- Önceki migration dosyalarını değiştirme.
-- PostGIS / ödeme ekleme.

-- ---------------------------------------------------------------------------
-- trip_phase: arrived + passenger_onboard
-- ---------------------------------------------------------------------------
alter table public.rides drop constraint if exists rides_trip_phase_check;

alter table public.rides
  add constraint rides_trip_phase_check
  check (
    trip_phase is null
    or trip_phase in (
      'assigning',
      'en_route',
      'arrived',
      'passenger_onboard',
      'in_progress',
      'completed'
    )
  );

-- ---------------------------------------------------------------------------
-- mark_driver_arrived: en_route → arrived
-- ---------------------------------------------------------------------------
create or replace function public.mark_driver_arrived(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if not public.is_authenticated_driver() then
    raise exception 'Yalnızca sürücü bu işlemi yapabilir';
  end if;

  update public.rides
  set trip_phase = 'arrived'
  where id = p_ride_id
    and driver_id = auth.uid()
    and status = 'accepted'
    and trip_phase = 'en_route'
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Yolcuya varış kaydedilemedi (durum uygun değil)';
  end if;

  return v_ride;
end;
$$;

revoke all on function public.mark_driver_arrived(uuid) from public;
revoke all on function public.mark_driver_arrived(uuid) from anon;
grant execute on function public.mark_driver_arrived(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_passenger_onboard: arrived → passenger_onboard → in_progress
-- (Realtime iki UPDATE alır; UI "Yolcu alındı" sonra "Yolculuk devam ediyor")
-- ---------------------------------------------------------------------------
create or replace function public.mark_passenger_onboard(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
begin
  if not public.is_authenticated_driver() then
    raise exception 'Yalnızca sürücü bu işlemi yapabilir';
  end if;

  update public.rides
  set trip_phase = 'passenger_onboard'
  where id = p_ride_id
    and driver_id = auth.uid()
    and status = 'accepted'
    and trip_phase = 'arrived'
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Yolcu alındı kaydı yapılamadı (durum uygun değil)';
  end if;

  update public.rides
  set
    trip_phase = 'in_progress',
    started_at = now()
  where id = p_ride_id
    and driver_id = auth.uid()
    and status = 'accepted'
    and trip_phase = 'passenger_onboard'
  returning * into v_ride;

  if v_ride.id is null then
    raise exception 'Yolculuk başlatılamadı';
  end if;

  return v_ride;
end;
$$;

revoke all on function public.mark_passenger_onboard(uuid) from public;
revoke all on function public.mark_passenger_onboard(uuid) from anon;
grant execute on function public.mark_passenger_onboard(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_ride: in_progress (ve edge: passenger_onboard) kabul et
-- ---------------------------------------------------------------------------
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
    and trip_phase in ('in_progress', 'passenger_onboard')
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

-- ---------------------------------------------------------------------------
-- cancel: yolculuk başladıktan sonra iptal yok
-- ---------------------------------------------------------------------------
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

  if v_existing.trip_phase in ('passenger_onboard', 'in_progress', 'completed') then
    raise exception 'Yolculuk başladıktan sonra iptal edilemez';
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
-- get_ride_tracking: ride + sürücü adı (passenger/driver kendi ride'ı)
-- ---------------------------------------------------------------------------
create or replace function public.get_ride_tracking(p_ride_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ride public.rides;
  v_driver_name text;
  v_driver_rating numeric;
  v_vehicle_type text;
  v_driver_lat double precision;
  v_driver_lng double precision;
  v_driver_loc_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;

  select * into v_ride
  from public.rides r
  where r.id = p_ride_id;

  if v_ride.id is null then
    raise exception 'Yolculuk bulunamadı';
  end if;

  if not (
    v_ride.passenger_id = auth.uid()
    or v_ride.driver_id = auth.uid()
    or (public.is_authenticated_driver() and v_ride.status = 'pending')
    or public.is_admin()
  ) then
    raise exception 'Bu yolculuğu görme yetkiniz yok';
  end if;

  if v_ride.driver_id is not null then
    select p.full_name into v_driver_name
    from public.profiles p
    where p.id = v_ride.driver_id;

    select
      d.rating,
      d.last_lat,
      d.last_lng,
      d.last_location_at
    into
      v_driver_rating,
      v_driver_lat,
      v_driver_lng,
      v_driver_loc_at
    from public.drivers d
    where d.id = v_ride.driver_id;

    select v.vehicle_type into v_vehicle_type
    from public.vehicles v
    where v.driver_id = v_ride.driver_id
      and v.is_active = true
    order by v.created_at desc
    limit 1;
  end if;

  return json_build_object(
    'id', v_ride.id,
    'passenger_id', v_ride.passenger_id,
    'driver_id', v_ride.driver_id,
    'passenger_name', v_ride.passenger_name,
    'passenger_phone', v_ride.passenger_phone,
    'driver_name', v_driver_name,
    'driver_rating', v_driver_rating,
    'driver_vehicle_type', v_vehicle_type,
    'driver_lat', v_driver_lat,
    'driver_lng', v_driver_lng,
    'driver_last_location_at', v_driver_loc_at,
    'from_label', v_ride.from_label,
    'to_label', v_ride.to_label,
    'from_lat', v_ride.from_lat,
    'from_lng', v_ride.from_lng,
    'to_lat', v_ride.to_lat,
    'to_lng', v_ride.to_lng,
    'route', v_ride.route,
    'distance_km', v_ride.distance_km,
    'duration_min', v_ride.duration_min,
    'estimated_fare', v_ride.estimated_fare,
    'status', v_ride.status,
    'trip_phase', v_ride.trip_phase,
    'gross_fare', v_ride.gross_fare,
    'commission_rate', v_ride.commission_rate,
    'commission_amount', v_ride.commission_amount,
    'driver_net_amount', v_ride.driver_net_amount,
    'commission_status', v_ride.commission_status,
    'created_at', v_ride.created_at,
    'accepted_at', v_ride.accepted_at,
    'started_at', v_ride.started_at,
    'completed_at', v_ride.completed_at,
    'cancelled_at', v_ride.cancelled_at
  );
end;
$$;

revoke all on function public.get_ride_tracking(uuid) from public;
revoke all on function public.get_ride_tracking(uuid) from anon;
grant execute on function public.get_ride_tracking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- rides → supabase_realtime (idempotent)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rides'
  ) then
    alter publication supabase_realtime add table public.rides;
  end if;
end $$;
