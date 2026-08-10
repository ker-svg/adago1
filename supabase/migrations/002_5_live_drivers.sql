-- AdaGo Aşama 2.5: canlı online sürücüler (passenger haritası)
-- Dosya: supabase/migrations/002_5_live_drivers.sql
-- Supabase Dashboard → SQL Editor → Run
-- 001 / 002 dosyalarını değiştirme. Aşama 3 rides ekleme.

-- Harita için dar alanlı RPC (phone / plate / email yok)
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
  where auth.uid() is not null
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

-- Realtime + offline event: authenticated kullanıcılar harita için
-- aktif araçlı sürücü satırlarını (online veya son 120 sn) SELECT edebilir.
-- Uygulama ekranda yine is_online + 90 sn stale filtresi uygular.
-- Mevcut drivers_select_own policy'si korunur (OR ile birleşir).
drop policy if exists "drivers_select_map_authenticated" on public.drivers;
create policy "drivers_select_map_authenticated"
  on public.drivers for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = drivers.id
        and p.role = 'driver'
    )
    and exists (
      select 1
      from public.vehicles v
      where v.driver_id = drivers.id
        and v.is_active = true
    )
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
