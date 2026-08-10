<template>
  <div class="profile-page">
    <v-container class="py-6" style="max-width: 560px">
      <div class="profile-card">
        <div class="avatar">
          {{ initials }}
        </div>

        <h1 class="name">{{ profile.name }}</h1>
        <p class="role">{{ isPassenger ? 'Yolcu profili' : 'Sürücü profili' }}</p>

        <template v-if="isPassenger">
          <div class="info-row">
            <span>Telefon</span>
            <strong>{{ profile.phone }}</strong>
          </div>
          <div class="info-row">
            <span>Toplam yolculuk</span>
            <strong>{{ profile.totalTrips }}</strong>
          </div>
          <div class="info-row">
            <span>Tamamlanan</span>
            <strong>{{ profile.completedTrips }}</strong>
          </div>
        </template>

        <template v-else>
          <div class="info-row">
            <span>Araç</span>
            <strong>{{ vehicleDisplay }}</strong>
          </div>
          <div class="info-row">
            <span>Plaka</span>
            <strong>{{ plateDisplay }}</strong>
          </div>
          <div class="info-row">
            <span>Durum</span>
            <strong>{{ statusDisplay }}</strong>
          </div>
          <div class="info-row">
            <span>Puan</span>
            <strong>⭐ {{ ratingDisplay }}</strong>
          </div>
          <div class="info-row">
            <span>Tamamlanan yolculuk</span>
            <strong>{{ completedDisplay }}</strong>
          </div>
        </template>

        <v-btn
          class="mt-6"
          color="primary"
          variant="flat"
          block
          :to="isPassenger ? '/passenger' : '/driver'"
        >
          Haritaya Dön
        </v-btn>
      </div>
    </v-container>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useDriverStore } from '@/stores/driverStore'
import { useRideStore } from '@/stores/rideStore'

const authStore = useAuthStore()
const rideStore = useRideStore()
const driverStore = useDriverStore()

const isPassenger = computed(() => authStore.currentRole !== 'driver')

const profile = computed(() =>
  isPassenger.value ? rideStore.passengerProfile : rideStore.driverProfile,
)

const vehicleDisplay = computed(() => {
  if (driverStore.vehicleLabel && driverStore.vehicleLabel !== '—') {
    const type = driverStore.vehicle?.vehicleType
    if (type && !driverStore.vehicleLabel.includes(type)) {
      return `${driverStore.vehicleLabel} (${type})`
    }
    return driverStore.vehicleLabel
  }
  return profile.value.vehicleType || '—'
})

const plateDisplay = computed(() => driverStore.vehicle?.plate || '—')

const statusDisplay = computed(() =>
  driverStore.isOnline ? 'Çevrimiçi' : 'Çevrimdışı',
)

const ratingDisplay = computed(
  () => driverStore.driver?.rating ?? profile.value.rating ?? 5.0,
)

const completedDisplay = computed(
  () => driverStore.driver?.completedTrips ?? profile.value.completedTrips ?? 0,
)

const initials = computed(() => {
  const parts = (profile.value.name || 'U').split(' ')
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
})

onMounted(async () => {
  if (!isPassenger.value) {
    try {
      await driverStore.ensureLoaded()
    } catch {
      // Profil yine de temel bilgileri gösterir
    }
  }
})
</script>

<style scoped>
.profile-page {
  min-height: calc(100dvh - 56px);
  background: linear-gradient(180deg, #eef3f5, #f8fafb);
}

.profile-card {
  background: #fff;
  border-radius: 24px;
  padding: 28px 22px;
  box-shadow: 0 12px 36px rgba(15, 76, 92, 0.08);
  text-align: center;
}

.avatar {
  width: 72px;
  height: 72px;
  margin: 0 auto 14px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: #0a1628;
  color: #fff;
  font-weight: 800;
  font-size: 1.4rem;
}

.name {
  margin: 0;
  font-size: 1.4rem;
  color: #111827;
}

.role {
  margin: 4px 0 20px;
  color: #6b7280;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 4px;
  border-bottom: 1px solid #eef1f3;
  color: #6b7280;
}

.info-row strong {
  color: #111827;
}
</style>
