import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey !== 'placeholder-key',
)

if (!isSupabaseConfigured) {
  console.warn(
    '[AdaGo] Supabase .env eksik. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY gerekli.',
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export function mapAuthError(err) {
  const msg = String(err?.message || err || '')
  const lower = msg.toLowerCase()

  if (!isSupabaseConfigured) {
    return 'Supabase ayarları eksik. .env dosyasını kontrol et.'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('fetch failed') ||
    lower.includes('network request failed')
  ) {
    return 'Supabase sunucusuna ulaşılamadı. İnternet / proje URL / anon key kontrol et. Dev sunucuyu yeniden başlat.'
  }
  if (lower.includes('invalid login credentials')) {
    return 'E-posta veya şifre hatalı.'
  }
  if (lower.includes('email not confirmed')) {
    return 'E-posta henüz onaylanmamış. Supabase Auth > Providers > Email içinde Confirm email kapatılabilir.'
  }
  if (lower.includes('user already registered')) {
    return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.'
  }
  return msg || 'Supabase işlemi başarısız.'
}
