# AdaGo Admin Kurulumu (Aşama 3)

Admin yetkisi **Supabase Auth + `profiles.role = 'admin'` + RLS** ile verilir.
Frontend’de hardcoded şifre / localStorage boolean kullanılmaz.
Normal kayıt ekranından admin seçilemez (yalnızca `passenger` | `driver`).

## Önkoşul

1. `001_profiles.sql`
2. `002_drivers_vehicles.sql`
3. `002_5_live_drivers.sql`
4. `003_rides_admin_commission.sql`

sırasıyla Supabase Dashboard → **SQL Editor** → Run.

## Admin hesabı oluşturma

### Yöntem A — Dashboard

1. Supabase → **Authentication** → **Users** → **Add user**
2. Email + şifre gir (gerçek bir Auth kullanıcısı oluşur).
3. Kullanıcının UUID’sini kopyala.
4. SQL Editor’da çalıştır:

```sql
update public.profiles
set role = 'admin', updated_at = now()
where id = '<USER_UUID>';
```

`handle_new_user` trigger profil satırını oluşturur. Satır yoksa:

```sql
insert into public.profiles (id, full_name, phone, role)
values ('<USER_UUID>', 'AdaGo Admin', null, 'admin')
on conflict (id) do update
set role = 'admin', updated_at = now();
```

### Yöntem B — Önce passenger kaydı, sonra yükseltme

1. Uygulamadan normal kayıt (`passenger` veya `driver`).
2. Yukarıdaki `update ... role = 'admin'` SQL’ini çalıştır.

## Giriş

- Uygulama: `/admin/login`
- Normal `/login` ile de admin giriş yapabilir; rol `admin` ise `/admin` paneline yönlenir.
- `passenger` / `driver` hesapları `/admin` rotasına giremez (route guard + `is_admin()` RLS).

## Güvenlik notları

- Admin rolünü yalnızca SQL / service_role ile ver.
- `anon` key ile `profiles.role` admin’e yükseltilemez (RLS update own; role’ü admin yapan ayrı policy yok).
- Komisyon (`complete_ride` RPC) istemci tarafından serbest yazılamaz.
