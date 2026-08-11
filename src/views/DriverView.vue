<template>
  <div class="ride-screen">
    <div class="map-area">
      <RideMap
        ref="mapRef"
        :from-coords="selectedRide?.fromCoords || null"
        :to-coords="selectedRide?.toCoords || null"
        :route="selectedRide?.route || []"
        :drivers="[]"
        :interactive="false"
      />
    </div>

    <BottomSheet>
      <div class="sheet-header">
        <div>
          <div class="sheet-title">Aktif talepler</div>
          <div class="subtle">
            {{ rideStore.stats.pending }} bekleyen talep
            <span v-if="driverStore.isOnline && driverStore.locationSharing">
              · konum paylaşılıyor
            </span>
          </div>
        </div>
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn v-bind="menuProps" icon="mdi-filter-variant" variant="text" size="small" />
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="option in filterOptions"
              :key="option.value"
              :title="`${option.label} (${option.count})`"
              @click="statusFilter = option.value"
            />
          </v-list>
        </v-menu>
      </div>

      <div class="presence-card">
        <div class="presence-left">
          <div class="presence-status" :class="{ online: driverStore.isOnline }">
            <span class="dot" />
            {{ driverStore.isOnline ? 'Çevrimiçi' : 'Çevrimdışı' }}
          </div>
          <div v-if="driverStore.isOnline && driverStore.locationSharing" class="presence-meta">
            Konum paylaşılıyor
          </div>
          <div v-if="lastLocationText" class="presence-meta">
            Son konum: {{ lastLocationText }}
          </div>
          <div
            v-if="driverStore.isOnline && !driverStore.locationSharing && driverStore.locationError"
            class="presence-warn"
          >
            Konum kullanılamıyor
          </div>
        </div>
        <v-switch
          :model-value="driverStore.isOnline"
          color="primary"
          hide-details
          density="compact"
          :loading="driverStore.saving"
          :disabled="driverStore.saving || driverStore.loading"
          @update:model-value="toggleOnline"
        />
      </div>

      <v-alert
        v-if="driverStore.locationError"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ driverStore.locationError }}
      </v-alert>

      <div
        v-if="driverStore.locationPermissionBlocked"
        class="gps-help"
      >
        <div class="gps-help-title">Konum erişimini açmak için</div>
        <ol>
          <li>Tarayıcıdaki kilit / site ayarlarına dokunun</li>
          <li>Konum → İzin Ver seçin</li>
          <li>Sayfayı yenileyin</li>
          <li>Tekrar Çevrimiçi olun</li>
        </ol>
      </div>

      <v-alert
        v-if="presenceError"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-3"
        closable
        @click:close="presenceError = ''"
      >
        {{ presenceError }}
      </v-alert>

      <v-text-field
        v-model="searchQuery"
        placeholder="Yolcu veya konum ara"
        prepend-inner-icon="mdi-magnify"
        hide-details
        density="compact"
        variant="solo-filled"
        flat
        class="mb-3"
        clearable
      />

      <v-alert
        v-if="infoMessage"
        type="success"
        variant="tonal"
        density="compact"
        class="mb-3"
        closable
        @click:close="infoMessage = ''"
      >
        {{ infoMessage }}
      </v-alert>

      <v-alert
        v-if="filteredRides.length === 0"
        type="info"
        variant="tonal"
        density="compact"
      >
        Uygun talep yok.
      </v-alert>

      <div
        v-for="ride in filteredRides"
        :key="ride.id"
        class="ride-item"
        :class="{ selected: selectedId === ride.id }"
        @click="selectRide(ride)"
      >
        <div class="ride-item-top">
          <div>
            <div class="name">{{ ride.passengerName }}</div>
            <div class="path">{{ ride.from }} → {{ ride.to }}</div>
            <div v-if="ride.estimatedFare" class="fare">~{{ ride.estimatedFare }} ₺</div>
          </div>
          <v-chip size="x-small" :color="statusColor(ride.status)" variant="flat">
            {{ ride.status }}
          </v-chip>
        </div>

        <div class="ride-item-actions" @click.stop>
          <v-btn
            v-if="ride.status === RIDE_STATUS.PENDING"
            size="small"
            color="primary"
            variant="flat"
            @click="handleAccept(ride.id)"
          >
            Kabul Et
          </v-btn>
          <v-btn
            v-if="canStart(ride)"
            size="small"
            color="primary"
            variant="flat"
            @click="handleStart(ride.id)"
          >
            Yolculuğu Başlat
          </v-btn>
          <v-btn
            v-if="canComplete(ride)"
            size="small"
            color="success"
            variant="flat"
            @click="handleComplete(ride.id)"
          >
            Tamamla
          </v-btn>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import BottomSheet from '@/components/BottomSheet.vue'
import RideMap from '@/components/RideMap.vue'
import { RIDE_STATUS, TRIP_PHASE } from '@/data/mockData'
import { useDriverStore } from '@/stores/driverStore'
import { useRideStore } from '@/stores/rideStore'

const rideStore = useRideStore()
const driverStore = useDriverStore()
const mapRef = ref(null)
const statusFilter = ref(RIDE_STATUS.PENDING)
const searchQuery = ref('')
const selectedId = ref(null)
const infoMessage = ref('')
const presenceError = ref('')

const lastLocationText = computed(() => driverStore.formatLastLocation())

const filterOptions = computed(() => [
  { value: 'all', label: 'Tümü', count: rideStore.stats.total },
  { value: RIDE_STATUS.PENDING, label: 'Bekleyen', count: rideStore.stats.pending },
  { value: RIDE_STATUS.ACCEPTED, label: 'Kabul', count: rideStore.stats.accepted },
  { value: RIDE_STATUS.COMPLETED, label: 'Tamamlanan', count: rideStore.stats.completed },
  { value: RIDE_STATUS.CANCELLED, label: 'İptal', count: rideStore.stats.cancelled },
])

const filteredRides = computed(() =>
  rideStore.filterRides({
    status: statusFilter.value,
    query: searchQuery.value,
  }),
)

const selectedRide = computed(() => {
  if (selectedId.value) {
    return rideStore.rides.find((r) => r.id === selectedId.value) || null
  }
  return filteredRides.value[0] || null
})

onMounted(async () => {
  try {
    await driverStore.ensureLoaded(true)
  } catch (err) {
    presenceError.value = err?.message || 'Sürücü profili yüklenemedi.'
  }
  try {
    await rideStore.fetchMyRides()
  } catch (err) {
    presenceError.value = err?.message || 'Talepler yüklenemedi.'
  }
  if (filteredRides.value[0]) {
    selectedId.value = filteredRides.value[0].id
  }
  nextTick(() => mapRef.value?.invalidate?.())
})

onUnmounted(() => {
  driverStore.stopLocationWatch()
})

async function toggleOnline(value) {
  presenceError.value = ''
  try {
    await driverStore.setOnline(Boolean(value))
  } catch (err) {
    presenceError.value = err?.message || 'Durum güncellenemedi.'
  }
}

function selectRide(ride) {
  selectedId.value = ride.id
  rideStore.setActiveRide(ride.id)
}

function statusColor(status) {
  switch (status) {
    case RIDE_STATUS.ACCEPTED:
      return 'info'
    case RIDE_STATUS.COMPLETED:
      return 'success'
    case RIDE_STATUS.CANCELLED:
      return 'error'
    default:
      return 'warning'
  }
}

function canStart(ride) {
  return (
    ride.status === RIDE_STATUS.ACCEPTED &&
    ride.tripPhase === TRIP_PHASE.EN_ROUTE
  )
}

function canComplete(ride) {
  return ride.tripPhase === TRIP_PHASE.IN_PROGRESS
}

async function handleAccept(rideId) {
  try {
    const ride = await rideStore.acceptRide(rideId)
    if (ride) {
      selectedId.value = ride.id
      infoMessage.value = `${ride.passengerName} kabul edildi`
    }
  } catch (err) {
    presenceError.value = err?.message || 'Kabul başarısız.'
  }
}

async function handleStart(rideId) {
  try {
    const ride = await rideStore.startRide(rideId)
    if (ride) {
      selectedId.value = ride.id
      infoMessage.value = `${ride.passengerName} yolculuğu başladı`
    }
  } catch (err) {
    presenceError.value = err?.message || 'Başlatma başarısız.'
  }
}

async function handleComplete(rideId) {
  try {
    const ride = await rideStore.completeRide(rideId)
    if (ride) {
      infoMessage.value = `${ride.passengerName} tamamlandı`
    }
  } catch (err) {
    presenceError.value = err?.message || 'Tamamlama başarısız.'
  }
}
</script>

<style scoped>
.ride-screen {
  position: relative;
  height: 100dvh;
  overflow: hidden;
  background: #0b1215;
}

.map-area {
  position: absolute;
  inset: 0 0 28% 0;
  min-height: 58%;
}

.sheet-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sheet-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #111827;
}

.subtle {
  color: #6b7280;
  font-size: 0.78rem;
}

.presence-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: 14px;
  border: 1px solid #e8ecef;
  background: #f8fafb;
}

.presence-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #6b7280;
  font-size: 0.95rem;
}

.presence-status.online {
  color: #059669;
}

.presence-status .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9ca3af;
}

.presence-status.online .dot {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
}

.presence-meta {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #6b7280;
}

.presence-warn {
  margin-top: 4px;
  font-size: 0.75rem;
  color: #b45309;
  font-weight: 600;
}

.gps-help {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 0.82rem;
  line-height: 1.45;
}

.gps-help-title {
  font-weight: 800;
  margin-bottom: 6px;
  color: #9a3412;
}

.gps-help ol {
  margin: 0;
  padding-left: 18px;
}

.gps-help li {
  margin-bottom: 2px;
}

.ride-item {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid #e8ecef;
  margin-bottom: 10px;
  background: #fafbfc;
  cursor: pointer;
}

.ride-item.selected {
  border-color: #10b981;
  background: #ecfdf5;
}

.ride-item-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.name {
  font-weight: 700;
  color: #111827;
}

.path {
  font-size: 0.85rem;
  color: #4b5563;
  margin-top: 2px;
}

.fare {
  font-size: 0.78rem;
  color: #059669;
  font-weight: 700;
  margin-top: 2px;
}

.ride-item-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

@media (min-width: 960px) {
  .ride-screen {
    display: grid;
    grid-template-columns: 1.55fr 400px;
  }

  .map-area {
    position: relative;
    inset: auto;
    min-height: 100dvh;
  }
}
</style>
