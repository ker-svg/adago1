<template>
  <div class="auth-screen">
    <div class="auth-card">
      <div class="brand-chip">AdaGo</div>
      <h1 class="title">Giriş yap</h1>
      <p class="subtitle">Hesabınla yolculuğa devam et.</p>

      <label class="field-label" for="login-email">E-posta</label>
      <input
        id="login-email"
        v-model="email"
        class="field-input"
        type="email"
        autocomplete="email"
        placeholder="ornek@mail.com"
        @keyup.enter="handleSubmit"
      />

      <label class="field-label" for="login-password">Şifre</label>
      <input
        id="login-password"
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
        {{ busy ? 'Giriş yapılıyor...' : 'Giriş Yap' }}
      </button>

      <button type="button" class="link-btn" @click="router.push('/register')">
        Hesabın yok mu? Kayıt ol
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const route = useRoute()
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

    if (!authStore.currentRole) {
      errorMessage.value =
        'Giriş oldu ama profil/rol bulunamadı. Supabase profiles tablosunu kontrol et.'
      return
    }

    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : authStore.panelPathForRole()

    await router.replace(redirect)
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
  padding: 20px;
  background: linear-gradient(180deg, #eef3f5, #f8fafb);
}

.auth-card {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 24px;
  padding: 28px 22px 22px;
  box-shadow: 0 16px 40px rgba(10, 22, 40, 0.08);
}

.brand-chip {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: #d1fae5;
  color: #065f46;
  font-weight: 800;
  font-size: 0.8rem;
  margin-bottom: 14px;
}

.title {
  margin: 0 0 6px;
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0a1628;
}

.subtitle {
  margin: 0 0 20px;
  color: #64748b;
  font-size: 0.95rem;
}

.field-label {
  display: block;
  margin: 0 0 6px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #334155;
}

.field-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 14px;
  padding: 14px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
  color: #0a1628;
  font: inherit;
  font-size: 0.95rem;
  outline: none;
}

.field-input:focus {
  border-color: #10b981;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.primary-btn {
  width: 100%;
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  border: 0;
  border-radius: 14px;
  background: #0a1628;
  color: #fff;
  font: inherit;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.primary-btn:hover:not(:disabled) {
  background: #134e4a;
}

.link-btn {
  width: 100%;
  margin-top: 12px;
  border: 0;
  background: transparent;
  color: #0a1628;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  padding: 10px;
}

.error-text {
  margin: 0 0 10px;
  color: #c62828;
  font-size: 0.85rem;
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
