<template>
  <div class="onboard-page">
    <div class="onboard-card">
      <p class="brand">AdaGo</p>
      <h1>Sürücü kaydı</h1>
      <p class="lead">Araç bilgilerini gir; sonra çevrimiçi olup konum paylaşabilirsin.</p>

      <form class="form" @submit.prevent="submit">
        <label class="field">
          <span>Araç tipi *</span>
          <select v-model="form.vehicleType" required>
            <option disabled value="">Seç</option>
            <option v-for="t in VEHICLE_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>

        <label class="field">
          <span>Plaka *</span>
          <input v-model.trim="form.plate" type="text" placeholder="ABC 123" required />
        </label>

        <label class="field">
          <span>Marka</span>
          <input v-model.trim="form.brand" type="text" placeholder="Toyota" />
        </label>

        <label class="field">
          <span>Model</span>
          <input v-model.trim="form.model" type="text" placeholder="Corolla" />
        </label>

        <label class="field">
          <span>Renk</span>
          <input v-model.trim="form.color" type="text" placeholder="Beyaz" />
        </label>

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

        <button class="btn-primary" type="submit" :disabled="driverStore.saving">
          {{ driverStore.saving ? 'Kaydediliyor…' : 'Kaydet ve devam et' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useDriverStore, VEHICLE_TYPES } from '@/stores/driverStore'

const router = useRouter()
const authStore = useAuthStore()
const driverStore = useDriverStore()
const errorMessage = ref('')

const form = reactive({
  vehicleType: '',
  plate: '',
  brand: '',
  model: '',
  color: '',
})

onMounted(async () => {
  if (authStore.currentRole !== 'driver') {
    router.replace(authStore.panelPathForRole())
    return
  }
  await driverStore.ensureLoaded()
  if (!driverStore.needsOnboarding) {
    router.replace('/driver')
  }
})

async function submit() {
  errorMessage.value = ''
  try {
    await driverStore.completeOnboarding({ ...form })
    await router.replace('/driver')
  } catch (err) {
    errorMessage.value = err?.message || 'Kayıt tamamlanamadı.'
  }
}
</script>

<style scoped>
.onboard-page {
  min-height: calc(100dvh - 56px);
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16, 185, 129, 0.18), transparent),
    linear-gradient(165deg, #0a1628 0%, #12263f 55%, #0d1f33 100%);
}

.onboard-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 24px;
  padding: 28px 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
}

.brand {
  margin: 0 0 8px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #10b981;
  font-size: 1.15rem;
}

h1 {
  margin: 0;
  font-size: 1.55rem;
  color: #0a1628;
  letter-spacing: -0.02em;
}

.lead {
  margin: 8px 0 20px;
  color: #6b7280;
  font-size: 0.92rem;
  line-height: 1.45;
}

.form {
  display: grid;
  gap: 12px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-size: 0.8rem;
  font-weight: 600;
  color: #374151;
}

.field input,
.field select {
  width: 100%;
  border: 1.5px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 14px;
  font: inherit;
  color: #111827;
  background: #f9fafb;
  outline: none;
}

.field input:focus,
.field select:focus {
  border-color: #10b981;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.error {
  margin: 0;
  color: #b91c1c;
  font-size: 0.88rem;
  background: #fef2f2;
  border-radius: 10px;
  padding: 10px 12px;
}

.btn-primary {
  margin-top: 4px;
  border: 0;
  border-radius: 12px;
  padding: 13px 16px;
  font: inherit;
  font-weight: 700;
  color: #fff;
  background: #10b981;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.65;
  cursor: wait;
}
</style>
