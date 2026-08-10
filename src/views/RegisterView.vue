<template>
  <div class="auth-screen">
    <div class="auth-card">
      <div class="brand-chip">AdaGo</div>
      <h1 class="title">Hesap oluştur</h1>
      <p class="subtitle">Kayıt olurken yolcu veya sürücü seç.</p>

      <label class="field-label" for="reg-name">Ad Soyad</label>
      <input
        id="reg-name"
        v-model="fullName"
        class="field-input"
        type="text"
        autocomplete="name"
        placeholder="Adın Soyadın"
      />

      <label class="field-label" for="reg-phone">Telefon</label>
      <input
        id="reg-phone"
        v-model="phone"
        class="field-input"
        type="tel"
        autocomplete="tel"
        placeholder="05xx xxx xx xx"
      />

      <label class="field-label" for="reg-email">E-posta</label>
      <input
        id="reg-email"
        v-model="email"
        class="field-input"
        type="email"
        autocomplete="email"
        placeholder="ornek@mail.com"
      />

      <label class="field-label" for="reg-password">Şifre</label>
      <input
        id="reg-password"
        v-model="password"
        class="field-input"
        type="password"
        autocomplete="new-password"
        placeholder="En az 6 karakter"
        @keyup.enter="handleSubmit"
      />

      <div class="role-pick">
        <button
          type="button"
          class="role-option"
          :class="{ active: role === 'passenger' }"
          @click="role = 'passenger'"
        >
          <strong>Yolcu</strong>
          <span>Yolculuk talep et</span>
        </button>
        <button
          type="button"
          class="role-option"
          :class="{ active: role === 'driver' }"
          @click="role = 'driver'"
        >
          <strong>Sürücü</strong>
          <span>Talepleri kabul et</span>
        </button>
      </div>

      <p v-if="infoMessage" class="info-text">{{ infoMessage }}</p>
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <button
        type="button"
        class="primary-btn"
        :disabled="busy"
        @click="handleSubmit"
      >
        <span v-if="busy" class="spinner" aria-hidden="true" />
        {{ busy ? 'Kayıt yapılıyor...' : 'Kayıt Ol' }}
      </button>

      <button type="button" class="link-btn" @click="router.push('/login')">
        Zaten hesabın var mı? Giriş yap
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

const fullName = ref('')
const phone = ref('')
const email = ref('')
const password = ref('')
const role = ref('passenger')
const errorMessage = ref('')
const infoMessage = ref('')
const busy = ref(false)

async function handleSubmit() {
  if (busy.value) return

  errorMessage.value = ''
  infoMessage.value = ''

  if (!fullName.value.trim()) {
    errorMessage.value = 'Ad soyad gerekli.'
    return
  }
  if (!email.value.trim()) {
    errorMessage.value = 'E-posta gerekli.'
    return
  }
  if (password.value.length < 6) {
    errorMessage.value = 'Şifre en az 6 karakter olmalı.'
    return
  }
  if (!['passenger', 'driver'].includes(role.value)) {
    errorMessage.value = 'Yolcu veya Sürücü seç.'
    return
  }

  busy.value = true
  try {
    const result = await authStore.signUp({
      email: email.value,
      password: password.value,
      fullName: fullName.value,
      phone: phone.value,
      role: role.value,
    })

    if (result.needsEmailConfirmation) {
      infoMessage.value =
        'Kayıt alındı. E-posta onayı açıksa onayla, yoksa giriş yap.'
      return
    }

    if (!authStore.currentRole) {
      errorMessage.value =
        'Kayıt oldu ama profil oluşmadı. profiles tablosunu kontrol et.'
      return
    }

    await router.replace(authStore.panelPathForRole(role.value))
  } catch (err) {
    errorMessage.value = err.message || 'Kayıt başarısız.'
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
  width: min(440px, 100%);
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

.role-pick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 4px 0 14px;
}

.role-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
  padding: 14px;
  border-radius: 16px;
  border: 2px solid #e2e8f0;
  background: #fff;
  cursor: pointer;
  color: #0a1628;
  font: inherit;
}

.role-option.active {
  border-color: #10b981;
  background: #ecfdf5;
}

.role-option strong {
  font-size: 0.95rem;
}

.role-option span {
  font-size: 0.78rem;
  color: #64748b;
}

.primary-btn {
  width: 100%;
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

.info-text {
  margin: 0 0 10px;
  color: #065f46;
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
