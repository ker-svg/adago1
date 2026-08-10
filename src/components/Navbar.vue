<template>
  <header v-if="!hideNavbar" class="app-topbar" :class="{ floating: isMapPage }">
    <router-link to="/" class="brand">
      <span class="brand-mark" aria-hidden="true" />
      AdaGo
    </router-link>

    <div class="topbar-actions">
      <v-chip
        v-if="authStore.currentRole"
        size="small"
        class="role-chip"
        :color="isMapPage ? undefined : 'white'"
        :variant="isMapPage ? 'tonal' : 'outlined'"
      >
        {{ roleLabel }}
      </v-chip>

      <button
        v-if="authStore.isAuthenticated"
        class="ghost-btn"
        type="button"
        @click="goProfile"
      >
        Profil
      </button>

      <button
        v-if="authStore.isAuthenticated"
        class="ghost-btn"
        type="button"
        @click="handleLogout"
      >
        Çıkış
      </button>

      <button
        v-else-if="route.name !== 'login' && route.name !== 'register'"
        class="ghost-btn"
        type="button"
        @click="router.push('/login')"
      >
        Giriş
      </button>

      <button
        v-if="route.name !== 'home' && !isMapPage"
        class="ghost-btn"
        type="button"
        aria-label="Ana sayfa"
        @click="router.push('/')"
      >
        <v-icon icon="mdi-home" size="20" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const hideNavbar = computed(() => Boolean(route.meta.hideNavbar))
const isMapPage = computed(() => Boolean(route.meta.mapPage))

const roleLabel = computed(() => {
  if (authStore.currentRole === 'passenger') return 'Yolcu'
  if (authStore.currentRole === 'driver') return 'Sürücü'
  return ''
})

function goProfile() {
  router.push({ path: '/profile' })
}

async function handleLogout() {
  try {
    await authStore.signOut()
  } finally {
    router.push('/login')
  }
}
</script>

<style scoped>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 56px;
  padding: 10px 16px;
  background: #0a1628;
  color: #fff;
}

.app-topbar.floating {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  min-height: 48px;
  padding: 8px 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.94);
  color: #0a1628;
  box-shadow: 0 10px 32px rgba(10, 22, 40, 0.14);
  backdrop-filter: blur(12px);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  letter-spacing: -0.04em;
  text-decoration: none;
  color: inherit;
  font-size: 1.15rem;
}

.brand-mark {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ghost-btn {
  border: 0;
  background: transparent;
  color: inherit;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 10px;
}

.role-chip {
  font-weight: 600;
}
</style>
