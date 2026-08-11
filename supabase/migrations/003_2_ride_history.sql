-- AdaGo Aşama 3.2: yolculuk geçmişi (rides kaynağı)
-- Dosya: supabase/migrations/003_2_ride_history.sql
-- Supabase Dashboard → SQL Editor → Run (003 + 003_1 sonrası)
-- 001 / 002 / 002_5 / 003 / 003_1 dosyalarını değiştirme.
-- Yeni history tablosu YOK — kaynak: public.rides (completed | cancelled).
-- Aşama 4 Realtime / PostGIS ekleme.

-- ---------------------------------------------------------------------------
-- get_my_ride_history — passenger veya driver kendi geçmişi
-- ---------------------------------------------------------------------------
create or replace function public.get_my_ride_history(p_status text default null)
returns table (
  id uuid,
  passenger_name text,
  driver_name text,
  from_label text,
  to_label text,
  status text,
  distance_km numeric,
  duration_min numeric,
  estimated_fare numeric,
  gross_fare numeric,
  commission_rate numeric,
  commission_amount numeric,
  driver_net_amount numeric,
  created_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  route jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null or v_role not in ('passenger', 'driver') then
    raise exception 'Yalnızca yolcu veya sürücü geçmiş görebilir';
  end if;

  return query
  select
    r.id,
    r.passenger_name,
    dp.full_name as driver_name,
    r.from_label,
    r.to_label,
    r.status,
    r.distance_km,
    r.duration_min,
    r.estimated_fare,
    r.gross_fare,
    r.commission_rate,
    r.commission_amount,
    r.driver_net_amount,
    r.created_at,
    r.completed_at,
    r.cancelled_at,
    r.accepted_at,
    r.started_at,
    r.route
  from public.rides r
  left join public.profiles dp on dp.id = r.driver_id
  where r.status in ('completed', 'cancelled')
    and (
      (v_role = 'passenger' and r.passenger_id = auth.uid())
      or (v_role = 'driver' and r.driver_id = auth.uid())
    )
    and (
      p_status is null
      or p_status = ''
      or p_status = 'all'
      or r.status = p_status
    )
  order by coalesce(r.completed_at, r.cancelled_at, r.created_at) desc;
end;
$$;

revoke all on function public.get_my_ride_history(text) from public;
revoke all on function public.get_my_ride_history(text) from anon;
grant execute on function public.get_my_ride_history(text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_my_ride_history_stats
-- ---------------------------------------------------------------------------
create or replace function public.get_my_ride_history_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Giriş gerekli';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null or v_role not in ('passenger', 'driver') then
    raise exception 'Yalnızca yolcu veya sürücü istatistik görebilir';
  end if;

  if v_role = 'passenger' then
    select json_build_object(
      'role', 'passenger',
      'total_rides', (
        select count(*)::int from public.rides r
        where r.passenger_id = auth.uid()
          and r.status in ('completed', 'cancelled')
      ),
      'completed_rides', (
        select count(*)::int from public.rides r
        where r.passenger_id = auth.uid() and r.status = 'completed'
      ),
      'cancelled_rides', (
        select count(*)::int from public.rides r
        where r.passenger_id = auth.uid() and r.status = 'cancelled'
      )
    ) into v_result;
  else
    select json_build_object(
      'role', 'driver',
      'completed_rides', (
        select count(*)::int from public.rides r
        where r.driver_id = auth.uid() and r.status = 'completed'
      ),
      'cancelled_rides', (
        select count(*)::int from public.rides r
        where r.driver_id = auth.uid() and r.status = 'cancelled'
      ),
      'total_gross', coalesce((
        select sum(r.gross_fare) from public.rides r
        where r.driver_id = auth.uid() and r.status = 'completed'
      ), 0),
      'total_commission', coalesce((
        select sum(r.commission_amount) from public.rides r
        where r.driver_id = auth.uid() and r.status = 'completed'
      ), 0),
      'total_net', coalesce((
        select sum(r.driver_net_amount) from public.rides r
        where r.driver_id = auth.uid() and r.status = 'completed'
      ), 0)
    ) into v_result;
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_my_ride_history_stats() from public;
revoke all on function public.get_my_ride_history_stats() from anon;
grant execute on function public.get_my_ride_history_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_user_ride_stats
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_user_ride_stats(target_user_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;
  if target_user_id is null then
    raise exception 'Kullanıcı gerekli';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = target_user_id;

  if v_profile.id is null then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if v_profile.role = 'admin' then
    return json_build_object(
      'user_id', v_profile.id,
      'full_name', v_profile.full_name,
      'role', v_profile.role,
      'total_rides', 0,
      'completed_rides', 0,
      'cancelled_rides', 0,
      'total_gross', 0,
      'total_commission', 0,
      'total_net', 0
    );
  end if;

  if v_profile.role = 'passenger' then
    select json_build_object(
      'user_id', v_profile.id,
      'full_name', v_profile.full_name,
      'role', v_profile.role,
      'total_rides', (
        select count(*)::int from public.rides r
        where r.passenger_id = target_user_id
          and r.status in ('completed', 'cancelled')
      ),
      'completed_rides', (
        select count(*)::int from public.rides r
        where r.passenger_id = target_user_id and r.status = 'completed'
      ),
      'cancelled_rides', (
        select count(*)::int from public.rides r
        where r.passenger_id = target_user_id and r.status = 'cancelled'
      ),
      'total_gross', 0,
      'total_commission', 0,
      'total_net', 0
    ) into v_result;
  else
    -- driver
    select json_build_object(
      'user_id', v_profile.id,
      'full_name', v_profile.full_name,
      'role', v_profile.role,
      'total_rides', (
        select count(*)::int from public.rides r
        where r.driver_id = target_user_id
          and r.status in ('completed', 'cancelled')
      ),
      'completed_rides', (
        select count(*)::int from public.rides r
        where r.driver_id = target_user_id and r.status = 'completed'
      ),
      'cancelled_rides', (
        select count(*)::int from public.rides r
        where r.driver_id = target_user_id and r.status = 'cancelled'
      ),
      'total_gross', coalesce((
        select sum(r.gross_fare) from public.rides r
        where r.driver_id = target_user_id and r.status = 'completed'
      ), 0),
      'total_commission', coalesce((
        select sum(r.commission_amount) from public.rides r
        where r.driver_id = target_user_id and r.status = 'completed'
      ), 0),
      'total_net', coalesce((
        select sum(r.driver_net_amount) from public.rides r
        where r.driver_id = target_user_id and r.status = 'completed'
      ), 0)
    ) into v_result;
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_admin_user_ride_stats(uuid) from public;
revoke all on function public.get_admin_user_ride_stats(uuid) from anon;
grant execute on function public.get_admin_user_ride_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_user_ride_history
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_user_ride_history(
  target_user_id uuid,
  p_status text default null
)
returns table (
  id uuid,
  passenger_name text,
  driver_name text,
  from_label text,
  to_label text,
  status text,
  distance_km numeric,
  duration_min numeric,
  estimated_fare numeric,
  gross_fare numeric,
  commission_rate numeric,
  commission_amount numeric,
  driver_net_amount numeric,
  created_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.is_admin() then
    raise exception 'Admin yetkisi gerekli';
  end if;
  if target_user_id is null then
    raise exception 'Kullanıcı gerekli';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = target_user_id;

  if v_role is null then
    raise exception 'Kullanıcı bulunamadı';
  end if;

  if v_role = 'admin' then
    return;
  end if;

  return query
  select
    r.id,
    r.passenger_name,
    dp.full_name as driver_name,
    r.from_label,
    r.to_label,
    r.status,
    r.distance_km,
    r.duration_min,
    r.estimated_fare,
    r.gross_fare,
    r.commission_rate,
    r.commission_amount,
    r.driver_net_amount,
    r.created_at,
    r.completed_at,
    r.cancelled_at,
    r.accepted_at,
    r.started_at
  from public.rides r
  left join public.profiles dp on dp.id = r.driver_id
  where r.status in ('completed', 'cancelled')
    and (
      (v_role = 'passenger' and r.passenger_id = target_user_id)
      or (v_role = 'driver' and r.driver_id = target_user_id)
    )
    and (
      p_status is null
      or p_status = ''
      or p_status = 'all'
      or r.status = p_status
    )
  order by coalesce(r.completed_at, r.cancelled_at, r.created_at) desc;
end;
$$;

revoke all on function public.get_admin_user_ride_history(uuid, text) from public;
revoke all on function public.get_admin_user_ride_history(uuid, text) from anon;
grant execute on function public.get_admin_user_ride_history(uuid, text) to authenticated;
