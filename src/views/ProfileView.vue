<template>
  <div class="profile-page">
    <v-container class="py-6" style="max-width: 560px">
      <div class="profile-card">
        <div class="avatar">
          {{ initials }}
        </div>

        <h1 class="name">{{ displayName }}</h1>
        <p class="role">{{ roleText }}</p>

        <template v-if="isPassenger">
          <div class="info-row">
            <span>Telefon</span>
            <strong>{{ profile.phone }}</strong>
          </div>
          <div class="info-row">
            <span>Toplam yolculuk</span>
            <strong>{{ historyStats?.totalRides ?? profile.totalTrips }}</strong>
          </div>
          <div class="info-row">
            <span>Tamamlanan</span>
            <strong>{{ historyStats?.completedRides ?? profile.completedTrips }}</strong>
          </div>
          <div class="info-row">
            <span>İptal edilen</span>
            <strong>{{ historyStats?.cancelledRides ?? 0 }}</strong>
          </div>
        </template>

        <template v-else-if="isDriver">
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
            <strong>{{ historyStats?.completedRides ?? completedDisplay }}</strong>
          </div>
          <div class="info-row">
            <span>Toplam brüt</span>
            <strong>{{ formatMoney(historyStats?.totalGross) }}</strong>
          </div>
          <div class="info-row">
            <span>AdaGo komisyonu</span>
            <strong>{{ formatMoney(historyStats?.totalCommission) }}</strong>
          </div>
          <div class="info-row">
            <span>Toplam net kazanç</span>
            <strong>{{ formatMoney(historyStats?.totalNet) }}</strong>
          </div>
        </template>

        <v-btn
          class="mt-5"
          color="primary"
          variant="flat"
          block
          :to="historyPath"
        >
          Yolculuk Geçmişim
        </v-btn>

        <v-btn
          class="mt-3"
          color="primary"
          variant="tonal"
          block
          :to="mapPath"
        >
          Haritaya Dön
        </v-btn>
      </div>
    </v-container>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useDriverStore } from '@/stores/driverStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useRideStore } from '@/stores/rideStore'

const router = useRouter()
const authStore = useAuthStore()
const rideStore = useRideStore()
const driverStore = useDriverStore()
const historyStore = useHistoryStore()

const historyStats = ref(null)

const isPassenger = computed(() => authStore.currentRole === 'passenger')
const isDriver = computed(() => authStore.currentRole === 'driver')

const profile = computed(() =>
  isPassenger.value ? rideStore.passengerProfile : rideStore.driverProfile,
)

const displayName = computed(
  () => authStore.currentUser?.name || profile.value.name || 'Kullanıcı',
)

const roleText = computed(() => {
  if (isPassenger.value) return 'Yolcu profili'
  if (isDriver.value) return 'Sürücü profili'
  return 'Profil'
})

const historyPath = computed(() =>
  isDriver.value ? '/driver/history' : '/passenger/history',
)

const mapPath = computed(() => (isDriver.value ? '/driver' : '/passenger'))

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
  const parts = (displayName.value || 'U').split(' ')
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
})

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`
}

onMounted(async () => {
  if (authStore.currentRole === 'admin') {
    router.replace('/admin')
    return
  }
  if (!isPassenger.value && !isDriver.value) return

  try {
    historyStats.value = await historyStore.fetchMyStats()
  } catch {
    historyStats.value = null
  }

  if (isDriver.value) {
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
