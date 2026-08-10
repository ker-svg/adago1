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
* LocalStorage (geçici ride kalıcılığı — Aşama 3’e kadar)

### Platform (Ana)

* **Supabase Auth** — kimlik doğrulama
* **Supabase PostgreSQL** — veritabanı
* **Supabase Realtime** — gelecek aşamalarda yolcu/sürücü senkronizasyonu
* **PostGIS** — gelecek aşamalarda yakındaki online sürücüler

### Opsiyonel Backend (yalnızca gerekirse)

* Node.js
* Express.js

Firebase kullanılmaz.

---

## Mevcut Sürüm Kuralları (V2 — Aşama 2.5)

Bu aşamada:

* Supabase Auth + `profiles` gerçek kullanıcı kaynağıdır.
* `drivers` + `vehicles` + onboarding + online/offline + gerçek GPS vardır.
* Yolcu haritasında **gerçek online sürücüler** gösterilir (`get_online_drivers_for_map` + Realtime).
* `mockPassenger` / `mockDriver` authentication kaynağı değildir.
* Yolculuklar hâlâ Pinia + LocalStorage (`adago-state-v1`) ile çalışır.
* `initialNearbyDrivers` demo/Home için kalabilir; PassengerView mock kullanmaz.
* PostGIS / `rides` tablosu henüz yoktur.
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

### Aşama 2.5 (şimdi)

Yolcu haritasında gerçek online sürücüler + `drivers` Realtime + stale GPS (90 sn)

SQL: `supabase/migrations/002_5_live_drivers.sql`

### Aşama 3 (henüz değil)

`rides` tablosu + mevcut LocalStorage ride sisteminin Supabase’e taşınması

### Aşama 4 (henüz değil)

Supabase Realtime ile yolcu/sürücü senkronizasyonu (geniş)

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
* Yolculuk talebi oluşturabilir
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

Kayıt sırasında rol seçilir (`passenger` | `driver`) ve `profiles.role` alanında saklanır.

---

## Yolculuk Durumları

Talep durumu (`RIDE_STATUS`):

* Bekliyor
* Kabul Edildi
* Tamamlandı
* İptal Edildi

Yolcu yolculuk fazı (`TRIP_PHASE`):

* Sürücü atanıyor
* Sürücü yolda
* Yolculuk başladı
* Yolculuk tamamlandı

Manuel sürücü akışı: Kabul Et → Yolculuğu Başlat → Tamamla

---

## Ekranlar

* `/` — Ana sayfa (canlı harita + AdaGo tanıtım)
* `/login` — Giriş (Supabase Auth)
* `/register` — Kayıt (ad, telefon, e-posta, şifre, rol)
* `/role` — Hesap rolü özeti / panele yönlendirme
* `/passenger` — Yolcu harita paneli (yalnız `passenger`)
* `/driver` — Sürücü harita paneli (yalnız `driver`)
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
11. LocalStorage ride kalıcılığı (Aşama 3’e kadar)

---

## Kodlama Kuralları

* Vue 3 Composition API + `script setup`
* Component bazlı mimari
* Mevcut store yapısı korunmalı (`authStore` + `rideStore` + `driverStore`)
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
  migrations/
    001_profiles.sql
    002_drivers_vehicles.sql
    002_5_live_drivers.sql
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

## Milestone Senaryosu (Aşama 2)

1. Sürücü hesabı ile giriş.
2. Araç yoksa onboarding: tip + plaka (zorunlu), marka/model/renk (opsiyonel).
3. Driver panelinde Çevrimiçi ol → konum izni → `last_lat` / `last_lng` yazılır.
4. Çevrimdışı → watcher durur, `is_online=false`.
5. Refresh sonrası online/araç durumu DB’den gelir.
6. Yolcu paneli mock sürücüler + LocalStorage ride ile çalışmaya devam eder.

---

## Gelecek Sürümler

* Aşama 3–5: yukarıdaki migration sırası (onaysız uygulanmaz)
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
- İstenmeyen aşamayı uygulamadan ekleme; Aşama 3–5 (rides-DB / geniş Realtime / PostGIS) için ayrı onay bekle.
- Yeni dependency eklemeden önce mevcut dependency'leri kontrol et.
- Değişiklik yaptıktan sonra npm run build çalıştır.
- Build hatası varsa çözmeden görevi tamamlanmış kabul etme.
- Büyük değişikliklerden önce mevcut mimariyi özetle.
- Kullanılmayan import, component ve kod bırakma.
- Firebase ekleme.
