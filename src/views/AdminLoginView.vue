<template>
  <div class="auth-screen">
    <div class="auth-card">
      <div class="brand-chip">AdaGo Admin</div>
      <h1 class="title">Yönetici girişi</h1>
      <p class="subtitle">
        Supabase Auth hesabınla giriş yap. Admin yetkisi veritabanında
        <code>profiles.role = admin</code> olmalıdır.
      </p>

      <label class="field-label" for="admin-email">E-posta</label>
      <input
        id="admin-email"
        v-model="email"
        class="field-input"
        type="email"
        autocomplete="username"
        placeholder="admin@ornek.com"
        @keyup.enter="handleSubmit"
      />

      <label class="field-label" for="admin-password">Şifre</label>
      <input
        id="admin-password"
        v-model="password"
        class="field-input"
        type="password"
        autocomplete="current-password"
        placeholder="Şifren"
        @keyup.enter="handleSubmit"
      />

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <button
        type="button"
        class="primary-btn"
        :disabled="busy"
        @click="handleSubmit"
      >
        <span v-if="busy" class="spinner" aria-hidden="true" />
        {{ busy ? 'Giriş yapılıyor...' : 'Admin Girişi' }}
      </button>

      <button type="button" class="link-btn" @click="router.push('/login')">
        Yolcu / sürücü girişi
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const busy = ref(false)

async function handleSubmit() {
  if (busy.value) return

  errorMessage.value = ''
  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'E-posta ve şifre gerekli.'
    return
  }

  busy.value = true
  try {
    await authStore.signIn({
      email: email.value,
      password: password.value,
    })

    if (authStore.currentRole !== 'admin') {
      errorMessage.value =
        'Bu hesap admin değil. Admin yetkisi yalnızca veritabanında atanır.'
      await authStore.signOut()
      return
    }

    await router.replace('/admin')
  } catch (err) {
    errorMessage.value = err.message || 'Giriş başarısız.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.auth-screen {
  min-height: calc(100dvh - 56px);
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(16, 185, 129, 0.12), transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(10, 22, 40, 0.08), transparent 45%),
    #f3f5f6;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 28px 24px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(10, 22, 40, 0.08);
}

.brand-chip {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: #0a1628;
  color: #10b981;
  font-weight: 800;
  font-size: 0.78rem;
  letter-spacing: -0.02em;
  margin-bottom: 14px;
}

.title {
  margin: 0 0 8px;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0a1628;
}

.subtitle {
  margin: 0 0 20px;
  color: #5a6a72;
  font-size: 0.92rem;
  line-height: 1.45;
}

.subtitle code {
  font-size: 0.8rem;
  background: #f3f5f6;
  padding: 1px 6px;
  border-radius: 6px;
}

.field-label {
  display: block;
  margin: 0 0 6px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #0a1628;
}

.field-input {
  width: 100%;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 0.95rem;
  outline: none;
  background: #f9fafb;
}

.field-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.primary-btn {
  width: 100%;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border: 0;
  border-radius: 14px;
  background: #0a1628;
  color: #fff;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.link-btn {
  display: block;
  width: 100%;
  margin-top: 14px;
  border: 0;
  background: transparent;
  color: #5a6a72;
  font-weight: 600;
  font-size: 0.88rem;
  cursor: pointer;
}

.error-text {
  color: #c62828;
  font-size: 0.85rem;
  margin: 0 0 10px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
