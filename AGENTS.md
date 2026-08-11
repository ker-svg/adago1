# AGENTS.md

## Proje Adı

**AdaGo** — KKTC için web tabanlı paylaşımlı ulaşım (ride-hailing) sistemi

Eski ad: RideShare KKTC

## Proje Amacı

Bu proje, Kuzey Kıbrıs Türk Cumhuriyeti'nde (KKTC) yaşanan ulaşım problemlerine çözüm sunmak amacıyla geliştirilen web tabanlı bir paylaşımlı ulaşım sistemi prototipidir.

Sistem; yolcuların harita üzerinden yolculuk talebi oluşturmasını, yakındaki sürücülerin görüntülenmesini, rota/ücret tahminini ve sürücülerin talepleri kabul etmesini sağlar.

Bu proje 2025–2026 Yazılım Mühendisliği Bitirme Projesi kapsamında geliştirilmektedir.

---

## Teknoloji Yığını

### Frontend

* Vue 3 (Composition API, `<script setup>`)
* Vuetify
* Vue Router
* Pinia
* Leaflet (harita)
* OSRM (rota çizimi)
* Nominatim / OpenStreetMap (gerçek mekan ve adres araması)

### Platform (Ana)

* **Supabase Auth** — kimlik doğrulama
* **Supabase PostgreSQL** — veritabanı (`profiles`, `drivers`, `vehicles`, `rides`)
* **Supabase Realtime** — online sürücü konumları (Aşama 2.5); ride Realtime Aşama 4
* **PostGIS** — gelecek aşamada yakındaki online sürücüler

### Opsiyonel Backend (yalnızca gerekirse)

* Node.js
* Express.js

Firebase kullanılmaz.

---

## Mevcut Sürüm Kuralları (V2 — Aşama 3)

Bu aşamada:

* Supabase Auth + `profiles` gerçek kullanıcı kaynağıdır (`passenger` | `driver` | `admin`).
* `drivers` + `vehicles` + onboarding + online/offline + gerçek cihaz GPS vardır.
* Yolcu haritasında **gerçek online sürücüler** gösterilir (`get_online_drivers_for_map` + Realtime).
* Yolculuklar Supabase `rides` tablosunda; lifecycle RPC: `create_ride` / `accept_ride` / `start_ride` / `complete_ride` / `cancel_ride`.
* Tamamlanan yolculukta DB içinde **%5 AdaGo komisyonu** hesaplanır (`complete_ride`).
* Admin paneli: `/admin` + `/admin/login` (Auth + `profiles.role=admin` + RLS; hardcoded şifre yok).
* `initialNearbyDrivers` yalnızca Home/Driver demo için kalabilir; PassengerView mock kullanmaz.
* PostGIS / ride Realtime henüz yoktur.
* Leaflet, OSRM, Nominatim ve ücret sistemi korunur.

---

## Supabase Migration Sırası

**Kural:** Bir aşama tamamlanıp test edilmeden sonraki aşamaya geçilmez. Bir görevde yalnızca açıkça istenen aşama uygulanır.

### Aşama 1 (tamamlandı)

Supabase bağlantısı + Auth + `profiles` + session + role tabanlı route guard

SQL: `supabase/migrations/001_profiles.sql`

### Aşama 2 (tamamlandı)

`drivers` + `vehicles` + online/offline + gerçek cihaz GPS konumu + sürücü onboarding

SQL: `supabase/migrations/002_drivers_vehicles.sql`

### Aşama 2.5 (tamamlandı)

Yolcu haritasında gerçek online sürücüler + `drivers` Realtime + stale GPS (90 sn)

SQL: `supabase/migrations/002_5_live_drivers.sql`

### Aşama 3 (şimdi)

`rides` + admin RBAC + %5 komisyon + admin paneli

SQL: `supabase/migrations/003_rides_admin_commission.sql`

RLS sıkılaştırma (doğrudan client UPDATE/INSERT kapalı; lifecycle yalnız RPC):

SQL: `supabase/migrations/003_1_rides_rls_hardening.sql`

Yolculuk geçmişi (passenger/driver/admin; kaynak `rides`):

SQL: `supabase/migrations/003_2_ride_history.sql`

Admin kurulum: `supabase/ADMIN_SETUP.md`

### Aşama 4 (henüz değil)

Supabase Realtime ile yolcu/sürücü ride senkronizasyonu (geniş)

### Aşama 5 (henüz değil)

PostGIS ile yakındaki online sürücülerin bulunması

---

## Marka / Tasarım

* Marka adı: **AdaGo**
* Renkler: lacivert (`#0A1628`) + mint yeşil (`#10B981`)
* Font: Plus Jakarta Sans
* Mobil öncelikli, bottom-sheet arayüz
* Harita ekranın büyük kısmını kaplar

---

## Kullanıcı Rolleri

### Yolcu

* Haritadan / listeden / aramayla nereden–nereye seçebilir
* Yolculuk talebi oluşturabilir (Supabase `create_ride`)
* Tahmini ücret ve en yakın sürücüyü görebilir
* Yolculuk durumunu takip edebilir
* Talebi iptal edebilir
* Profilini görüntüleyebilir

### Sürücü

* İlk girişte araç onboarding (`/driver-onboarding`)
* Çevrimiçi / çevrimdışı durumunu yönetebilir (Supabase `drivers.is_online`)
* Online iken gerçek cihaz GPS konumunu paylaşır (`last_lat` / `last_lng`)
* Aktif talepleri görüntüleyebilir / filtreleyebilir / arayabilir
* Haritada rota ve yakındaki sürücüleri görebilir
* Talebi kabul edebilir / yolculuğu başlatabilir / tamamlayabilir
* Profilini ve araç bilgilerini görüntüleyebilir

### Admin

* Gerçek Supabase Auth kullanıcısı; `profiles.role = 'admin'` (manuel SQL)
* Normal Register’dan admin seçilemez
* Dashboard: kullanıcı / sürücü / ride / komisyon istatistikleri
* Yalnızca gerçek `profiles` / `drivers` / `rides` verisi

Kayıt sırasında rol seçilir (`passenger` | `driver`) ve `profiles.role` alanında saklanır.

---

## Yolculuk Durumları

Talep durumu (`RIDE_STATUS` / DB):

* Bekliyor (`pending`)
* Kabul Edildi (`accepted`)
* Tamamlandı (`completed`) — %5 komisyon kesinleşir
* İptal Edildi (`cancelled`) — komisyon yok

Yolcu yolculuk fazı (`TRIP_PHASE`):

* Sürücü atanıyor (`assigning`)
* Sürücü yolda (`en_route`)
* Yolculuk başladı (`in_progress`)
* Yolculuk tamamlandı (`completed`)

Manuel sürücü akışı: Kabul Et → Yolculuğu Başlat → Tamamla

Komisyon: `gross_fare * 0.05` → `commission_amount`; `driver_net_amount = gross_fare - commission_amount` (DB `complete_ride` RPC).

---

## Ekranlar

* `/` — Ana sayfa (canlı harita + AdaGo tanıtım)
* `/login` — Giriş (Supabase Auth)
* `/register` — Kayıt (ad, telefon, e-posta, şifre, rol: passenger|driver)
* `/admin/login` — Admin girişi
* `/admin` — Admin paneli (yalnız `admin`)
* `/role` — Hesap rolü özeti / panele yönlendirme
* `/passenger` — Yolcu harita paneli (yalnız `passenger`)
* `/passenger/history` — Yolcu yolculuk geçmişi
* `/driver` — Sürücü harita paneli (yalnız `driver`)
* `/driver/history` — Sürücü yolculuk geçmişi
* `/driver-onboarding` — Sürücü araç kaydı (yalnız `driver`, araç yoksa zorunlu)
* `/profile` — Profil (login gerekli)

---

## Ana Özellikler

1. Leaflet harita (KKTC sınırına kilitli)
2. A/B marker + OSRM rota çizimi
3. Nominatim ile gerçek konum/mekan arama
4. Yakındaki sürücüler (Aşama 2.5: gerçek online + GPS; Home/demo mock kalabilir)
5. En yakın sürücü + ETA (haversine, gerçek onlineDrivers)
6. Tahmini ücret (açılış + km ücreti)
7. Modern bottom sheet
8. Supabase Auth + profil
9. Sürücü onboarding + `drivers` / `vehicles` + online/offline + GPS (throttle’lı)
10. Passenger Realtime: `drivers` postgres_changes
11. Supabase `rides` + lifecycle RPC + %5 komisyon
12. Admin paneli (RBAC + RLS + finans özeti)
13. Yolculuk geçmişi (passenger/driver + admin kullanıcı/sürücü geçmişi)

---

## Kodlama Kuralları

* Vue 3 Composition API + `script setup`
* Component bazlı mimari
* Mevcut store yapısı korunmalı (`authStore` + `rideStore` + `driverStore` + `adminStore` + `historyStore`)
* Yeni özellikler mümkün olduğunca ayrı component olarak eklenmeli
* Responsive tasarım korunmalı
* Dosya isimleri anlamlı olmalı

---

## Klasör Yapısı

```text
src/
  views/
    HomeView.vue
    LoginView.vue
    RegisterView.vue
    AdminLoginView.vue
    AdminView.vue
    HistoryView.vue
    RoleSelectView.vue
    PassengerView.vue
    DriverView.vue
    DriverOnboardingView.vue
    ProfileView.vue
  components/
    Navbar.vue
    RideMap.vue
    BottomSheet.vue
    FareEstimateCard.vue
    TripStatusPanel.vue
    RideCard.vue
    DashboardStats.vue
    RecentRides.vue
  router/
    index.js
  stores/
    authStore.js
    rideStore.js
    driverStore.js
    adminStore.js
    historyStore.js
  lib/
    supabase.js
  data/
    mockData.js
  utils/
    route.js
    fare.js
    geocoding.js
  plugins/
    vuetify.js
  assets/
supabase/
  ADMIN_SETUP.md
  migrations/
    001_profiles.sql
    002_drivers_vehicles.sql
    002_5_live_drivers.sql
    003_rides_admin_commission.sql
    003_1_rides_rls_hardening.sql
    003_2_ride_history.sql
```

---

## Çalıştırma

```bash
npm install
npm run dev
```

→ http://localhost:5173/

Gerekli env (`.env`, commit edilmez):

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Secret / `service_role` key frontend’e konulmaz.

---

## Milestone Senaryosu (Aşama 3)

1. `003_rides_admin_commission.sql` + admin hesabı (`ADMIN_SETUP.md`).
2. Yolcu ride oluşturur → DB `pending`.
3. Sürücü kabul / başlat / tamamla → komisyon DB’de %5.
4. Admin `/admin` → gerçek kullanıcılar, sürücüler, komisyonlar.
5. Passenger haritası yalnızca gerçek online GPS sürücüleri gösterir.

---

## Gelecek Sürümler

* Aşama 4–5: yukarıdaki migration sırası (onaysız uygulanmaz)
* Değerlendirme sistemi, yolculuk geçmişi UI iyileştirmeleri (sonraki işler)

---

## Agent Çalışma Kuralları

- Kod yazmadan önce ilgili mevcut dosyaları incele.
- Mevcut çalışan özellikleri bozma.
- Gereksiz component veya dosya oluşturma.
- Aynı işlev mevcutsa yeniden implement etme.
- Mevcut Pinia store yapısını koru.
- UI değişikliklerinde mevcut AdaGo tasarım sistemine uy.
- Responsive tasarımı bozma.
- Her yeni özellik için loading, empty ve error durumlarını değerlendir.
- Hardcoded verileri component içine yazma; mockData, store veya Supabase kullan.
- Business logic'i mümkün olduğunca componentlerden ayır.
- İstenmeyen aşamayı uygulamadan ekleme; Aşama 4–5 (geniş Realtime / PostGIS) için ayrı onay bekle.
- Yeni dependency eklemeden önce mevcut dependency'leri kontrol et.
- Değişiklik yaptıktan sonra npm run build çalıştır.
- Build hatası varsa çözmeden görevi tamamlanmış kabul etme.
- Büyük değişikliklerden önce mevcut mimariyi özetle.
- Kullanılmayan import, component ve kod bırakma.
- Firebase ekleme.
- Admin için frontend hardcoded şifre yazma.
