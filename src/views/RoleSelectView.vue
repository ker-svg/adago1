<template>
  <v-container class="py-8 role-page" style="max-width: 720px">
    <div class="text-center mb-8">
      <div class="brand-chip mx-auto mb-3">AdaGo</div>
      <h1 class="title mb-2">Hesabın hazır</h1>
      <p class="subtitle mb-0">
        Kayıtlı rolün:
        <strong>{{ roleLabel }}</strong>
      </p>
    </div>

    <v-btn
      color="primary"
      size="large"
      block
      class="mb-3"
      @click="goPanel"
    >
      {{ panelButtonLabel }}
    </v-btn>

    <v-btn variant="tonal" block color="primary" to="/profile">
      Profili Gör
    </v-btn>
  </v-container>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const router = useRouter()
const authStore = useAuthStore()

const roleLabel = computed(() =>
  authStore.currentRole === 'driver' ? 'Sürücü' : 'Yolcu',
)

const panelButtonLabel = computed(() =>
  authStore.currentRole === 'driver' ? 'Sürücü paneline git' : 'Yolcu paneline git',
)

function goPanel() {
  router.push(authStore.panelPathForRole())
}

onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.replace('/login')
  }
})
</script>

<style scoped>
.role-page {
  min-height: calc(100dvh - 56px);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  background: #d1fae5;
  color: #065f46;
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: -0.02em;
  width: fit-content;
}

.title {
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0a1628;
}

.subtitle {
  color: #64748b;
}
</style>
