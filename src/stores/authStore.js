import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isSupabaseConfigured, mapAuthError, supabase } from '@/lib/supabase'

function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone || '',
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const user = ref(null)
  const profile = ref(null)
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref('')

  const isAuthenticated = computed(() => Boolean(user.value || session.value?.user))
  const currentRole = computed(() => profile.value?.role || null)

  const currentUser = computed(() => {
    if (!profile.value) return null
    return {
      id: profile.value.id,
      name: profile.value.fullName,
      phone: profile.value.phone,
      role: profile.value.role,
    }
  })

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    profile.value = mapProfile(data)
    return profile.value
  }

  async function fetchProfileWithRetry(userId, attempts = 5) {
    let lastError = null
    for (let i = 0; i < attempts; i += 1) {
      try {
        const row = await fetchProfile(userId)
        if (row) return row
      } catch (err) {
        lastError = err
      }
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
    if (lastError) throw lastError
    return null
  }

  async function ensureProfileRecord({ userId, fullName, phone, role }) {
    const existing = await fetchProfileWithRetry(userId, 3)
    if (existing) return existing

    const payload = {
      id: userId,
      full_name: fullName || 'AdaGo Kullanıcı',
      phone: phone || null,
      role: ['passenger', 'driver'].includes(role) ? role : 'passenger',
    }

    const { error } = await supabase.from('profiles').upsert(payload, {
      onConflict: 'id',
    })
    if (error) throw error

    return fetchProfileWithRetry(userId, 3)
  }

  let authListenerBound = false

  async function initSession() {
    if (initialized.value) return

    loading.value = true
    errorMessage.value = ''
    try {
      if (!isSupabaseConfigured) {
        errorMessage.value = mapAuthError({ message: 'not configured' })
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error) throw error

      session.value = data.session
      user.value = data.session?.user || null

      if (user.value) {
        try {
          await fetchProfileWithRetry(user.value.id)
        } catch (err) {
          console.warn('[AdaGo] Profil yüklenemedi:', mapAuthError(err))
          profile.value = null
        }
      } else {
        profile.value = null
      }

      if (!authListenerBound) {
        authListenerBound = true
        supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          session.value = nextSession
          user.value = nextSession?.user || null
          if (nextSession?.user) {
            try {
              await fetchProfileWithRetry(nextSession.user.id)
            } catch (err) {
              console.warn('[AdaGo] Profil yüklenemedi:', mapAuthError(err))
              profile.value = null
            }
          } else {
            profile.value = null
            const { useDriverStore } = await import('@/stores/driverStore')
            useDriverStore().resetLocal()
            const { useRideStore } = await import('@/stores/rideStore')
            useRideStore().resetLocal()
          }
        })
      }
    } catch (err) {
      errorMessage.value = mapAuthError(err)
      session.value = null
      user.value = null
      profile.value = null
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function signUp({ email, password, fullName, phone, role }) {
    loading.value = true
    errorMessage.value = ''
    try {
      if (!isSupabaseConfigured) {
        throw new Error(mapAuthError({ message: 'not configured' }))
      }
      if (!['passenger', 'driver'].includes(role)) {
        throw new Error('Geçerli bir rol seçin.')
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone?.trim() || null,
            role,
          },
        },
      })

      if (error) throw error

      session.value = data.session
      user.value = data.user

      if (data.session?.user) {
        await ensureProfileRecord({
          userId: data.session.user.id,
          fullName: fullName.trim(),
          phone: phone?.trim() || null,
          role,
        })
      }

      return {
        needsEmailConfirmation: !data.session,
        user: data.user,
      }
    } catch (err) {
      errorMessage.value = mapAuthError(err)
      throw new Error(errorMessage.value)
    } finally {
      loading.value = false
    }
  }

  async function signIn({ email, password }) {
    loading.value = true
    errorMessage.value = ''
    try {
      if (!isSupabaseConfigured) {
        throw new Error(mapAuthError({ message: 'not configured' }))
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error

      session.value = data.session
      user.value = data.user
      if (data.user) {
        const meta = data.user.user_metadata || {}
        await ensureProfileRecord({
          userId: data.user.id,
          fullName: meta.full_name,
          phone: meta.phone,
          role: meta.role,
        })
      }
      return data
    } catch (err) {
      errorMessage.value = mapAuthError(err)
      throw new Error(errorMessage.value)
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    loading.value = true
    errorMessage.value = ''
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      session.value = null
      user.value = null
      profile.value = null
      const { useDriverStore } = await import('@/stores/driverStore')
      useDriverStore().resetLocal()
      const { useRideStore } = await import('@/stores/rideStore')
      useRideStore().resetLocal()
    } catch (err) {
      errorMessage.value = err.message || 'Çıkış başarısız.'
      throw err
    } finally {
      loading.value = false
    }
  }

  function panelPathForRole(role = currentRole.value) {
    if (role === 'admin') return '/admin'
    if (role === 'driver') return '/driver'
    if (role === 'passenger') return '/passenger'
    if (user.value) return '/role'
    return '/login'
  }

  return {
    session,
    user,
    profile,
    loading,
    initialized,
    errorMessage,
    isAuthenticated,
    currentRole,
    currentUser,
    initSession,
    fetchProfile,
    signUp,
    signIn,
    signOut,
    panelPathForRole,
  }
})
