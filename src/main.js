import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { useAuthStore } from '@/stores/authStore'

import './assets/main.css'

/** Eski LocalStorage nearbyDrivers — Passenger haritasına sızmasın */
try {
  const key = 'adago-state-v1'
  const raw = localStorage.getItem(key)
  if (raw) {
    const parsed = JSON.parse(raw)
    if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'nearbyDrivers')) {
      delete parsed.nearbyDrivers
      localStorage.setItem(key, JSON.stringify(parsed))
    }
  }
} catch {
  // ignore
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(vuetify)

// UI'yi Supabase yanıtına kilitleme — bağlantı yavaş/kopuk olsa da ekran açılsın
app.mount('#app')

const authStore = useAuthStore(pinia)
authStore.initSession().catch((err) => {
  console.warn('[AdaGo] Oturum başlatılamadı:', err?.message || err)
})
