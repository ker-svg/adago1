-- AdaGo Aşama 3.1: rides RLS sıkılaştırma
-- Dosya: supabase/migrations/003_1_rides_rls_hardening.sql
-- Supabase Dashboard → SQL Editor → Run (003 sonrası)
-- 001 / 002 / 002_5 / 003 dosyalarını değiştirme.
--
-- Sorun:
--   rides_update_passenger_cancel / rides_update_driver_assigned
--   client .update() ile status, trip_phase, driver_id, komisyon alanlarını
--   serbestçe değiştirmeye izin veriyordu.
--
-- Çözüm:
--   Passenger/driver doğrudan UPDATE policy'leri kaldırılır.
--   Lifecycle yalnız SECURITY DEFINER RPC'ler üzerinden:
--     create_ride, accept_ride, start_ride, complete_ride, cancel_ride
--   SELECT policy'leri (passenger / driver / admin) korunur.
--   Komisyon hesabına (%5) dokunulmaz.

-- ---------------------------------------------------------------------------
-- Doğrudan client UPDATE yollarını kapat
-- ---------------------------------------------------------------------------
drop policy if exists "rides_update_passenger_cancel" on public.rides;
drop policy if exists "rides_update_driver_assigned" on public.rides;

-- create_ride SECURITY DEFINER olduğu için doğrudan INSERT de gerekli değil.
-- Client'ın sahte ride satırı eklemesini engelle.
drop policy if exists "rides_insert_passenger" on public.rides;

-- ---------------------------------------------------------------------------
-- SELECT politikaları (003'tekiyle aynı; idempotent yeniden oluştur)
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

-- Not:
-- authenticated rolünün rides üzerinde UPDATE/INSERT policy'si yok.
-- SECURITY DEFINER RPC'ler tablo sahibi olarak RLS'i bypass eder;
-- create/accept/start/complete/cancel çalışmaya devam eder.
-- Admin için de doğrudan UPDATE yok; finans yazımı yalnız complete_ride RPC.
