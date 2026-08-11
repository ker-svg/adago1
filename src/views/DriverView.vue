<template>
  <div class="ride-screen">
    <div class="map-area">
      <RideMap
        ref="mapRef"
        :from-coords="selectedRide?.fromCoords || null"
        :to-coords="selectedRide?.toCoords || null"
        :route="mapRoute"
        :drivers="[]"
        :tracking-driver="selfTrackingDriver"
        :driver-route="driverRoute"
        :fit-key="mapFitKey"
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

      <div v-if="driverLiveEtaText" class="driver-eta">
        <div class="driver-eta-main">{{ driverLiveEtaText }}</div>
        <div v-if="liveEta?.distanceKm != null" class="driver-eta-sub">
          {{ liveEta.distanceKm }} km
          <span v-if="liveEta.arrivalClock"> · {{ liveEta.arrivalClock }}</span>
        </div>
      </div>

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
            <div v-if="ride.tripPhase" class="phase">{{ ride.tripPhase }}</div>
          </div>
          <v-chip size="x-small" :color="statusColor(ride.status)" variant="flat">
            {{ ride.status }}
          </v-chip>
        </div>

        <div class="ride-item-actions" @click.stop>
          <v-btn
            v-if="lifecycleAction(ride) === 'accept'"
            size="small"
            color="primary"
            variant="flat"
            :loading="rideStore.saving"
            @click="handleAccept(ride.id)"
          >
            Kabul Et
          </v-btn>
          <v-btn
            v-else-if="lifecycleAction(ride) === 'arrived'"
            size="small"
            color="warning"
            variant="flat"
            :loading="rideStore.saving"
            @click="handleArrived(ride.id)"
          >
            Yolcunun Yanına Geldim
          </v-btn>
          <v-btn
            v-else-if="lifecycleAction(ride) === 'onboard'"
            size="small"
            color="primary"
            variant="flat"
            :loading="rideStore.saving"
            @click="handleOnboard(ride.id)"
          >
            Yolcu Alındı
          </v-btn>
          <v-btn
            v-else-if="lifecycleAction(ride) === 'complete'"
            size="small"
            color="success"
            variant="flat"
            :loading="rideStore.saving"
            @click="handleComplete(ride.id)"
          >
            Yolculuğu Tamamla
          </v-btn>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import BottomSheet from '@/components/BottomSheet.vue'
import RideMap from '@/components/RideMap.vue'
import { RIDE_STATUS, TRIP_PHASE } from '@/data/mockData'
import { useDriverStore } from '@/stores/driverStore'
import { useRideStore } from '@/stores/rideStore'
import {
  fetchLiveEtaRoute,
  shouldRefreshEtaRoute,
} from '@/utils/liveEta'

const rideStore = useRideStore()
const driverStore = useDriverStore()
const mapRef = ref(null)
const statusFilter = ref(RIDE_STATUS.PENDING)
const searchQuery = ref('')
const selectedId = ref(null)
const infoMessage = ref('')
const presenceError = ref('')
const driverRoute = ref([])
const liveEta = ref(null)

let etaAbortController = null
let etaRequestToken = 0
let lastEtaAt = 0
let lastEtaFrom = null
let lastEtaPhaseKey = ''

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

const activeAssignedRide = computed(() => {
  const ride = selectedRide.value
  if (!ride) return null
  if (ride.status !== RIDE_STATUS.ACCEPTED) return null
  if (ride.driverId && ride.driverId !== rideStore.currentUser?.id) return null
  return ride
})

const selfTrackingDriver = computed(() => {
  const ride = activeAssignedRide.value
  if (!ride) return null
  const lat = driverStore.driver?.lastLat
  const lng = driverStore.driver?.lastLng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id: rideStore.currentUser?.id || 'self',
    lat,
    lng,
    name: 'Siz',
  }
})

const mapFitKey = computed(() => {
  const ride = selectedRide.value
  if (!ride) return 'driver-idle'
  return `${ride.id}:${ride.tripPhaseKey || ride.tripPhase || ride.status}`
})

const mapRoute = computed(() => {
  if (driverRoute.value.length > 1) return []
  const ride = selectedRide.value
  if (!ride) return []
  if (
    ride.tripPhase === TRIP_PHASE.EN_ROUTE ||
    ride.tripPhase === TRIP_PHASE.ARRIVED ||
    ride.tripPhase === TRIP_PHASE.PASSENGER_ONBOARD ||
    ride.tripPhase === TRIP_PHASE.IN_PROGRESS
  ) {
    return []
  }
  return ride.route || []
})

const driverLiveEtaText = computed(() => {
  const ride = activeAssignedRide.value
  if (!ride || !liveEta.value) return ''
  if (ride.tripPhase === TRIP_PHASE.ARRIVED) return 'Yolcu konumunda'
  if (liveEta.value.minutes == null) return ''
  if (liveEta.value.mode === 'pickup') {
    return `Yolcuya ${liveEta.value.minutes} dk`
  }
  return `Varışa ${liveEta.value.minutes} dk`
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

  // Marketplace + kendi ride'lar
  rideStore.subscribeToRideUpdates(null)

  const preferred =
    rideStore.rides.find(
      (r) =>
        r.status === RIDE_STATUS.ACCEPTED &&
        r.driverId === rideStore.currentUser?.id,
    ) || filteredRides.value[0]

  if (preferred) {
    selectedId.value = preferred.id
    rideStore.setActiveRide(preferred.id)
  }

  await refreshDriverEta({ force: true })
  nextTick(() => mapRef.value?.invalidate?.())
})

onUnmounted(() => {
  etaAbortController?.abort()
  driverStore.stopLocationWatch()
  void rideStore.unsubscribeRideUpdates()
})

watch(
  () => [
    selectedRide.value?.id,
    selectedRide.value?.tripPhase,
    driverStore.driver?.lastLat,
    driverStore.driver?.lastLng,
  ],
  () => {
    void refreshDriverEta({ force: false })
  },
)

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
  void refreshDriverEta({ force: true })
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

function lifecycleAction(ride) {
  if (!ride) return null
  // Her phase için tek buton — aynı anda iki lifecycle aksiyonu yok
  if (ride.status === RIDE_STATUS.PENDING) return 'accept'
  if (
    ride.status === RIDE_STATUS.ACCEPTED &&
    ride.tripPhase === TRIP_PHASE.EN_ROUTE
  ) {
    return 'arrived'
  }
  if (
    ride.status === RIDE_STATUS.ACCEPTED &&
    ride.tripPhase === TRIP_PHASE.ARRIVED
  ) {
    return 'onboard'
  }
  if (
    ride.status === RIDE_STATUS.ACCEPTED &&
    ride.tripPhase === TRIP_PHASE.IN_PROGRESS
  ) {
    return 'complete'
  }
  return null
}

function clearDriverEta() {
  etaAbortController?.abort()
  etaAbortController = null
  etaRequestToken += 1
  driverRoute.value = []
  liveEta.value = null
  lastEtaAt = 0
  lastEtaFrom = null
  lastEtaPhaseKey = ''
}

async function refreshDriverEta({ force = false } = {}) {
  const ride = activeAssignedRide.value
  if (!ride) {
    clearDriverEta()
    return
  }

  const phase = ride.tripPhase
  const phaseKey = ride.tripPhaseKey || phase

  if (phase === TRIP_PHASE.ARRIVED) {
    driverRoute.value = []
    liveEta.value = { mode: 'arrived', minutes: null, distanceKm: null, arrivalClock: null }
    lastEtaPhaseKey = phaseKey
    return
  }

  const lat = driverStore.driver?.lastLat
  const lng = driverStore.driver?.lastLng
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

  const from = { lat, lng }
  let to = null
  let mode = 'pickup'

  if (phase === TRIP_PHASE.EN_ROUTE) {
    to = ride.fromCoords
    mode = 'pickup'
  } else if (
    phase === TRIP_PHASE.PASSENGER_ONBOARD ||
    phase === TRIP_PHASE.IN_PROGRESS
  ) {
    to = ride.toCoords
    mode = 'destination'
  } else {
    clearDriverEta()
    return
  }

  if (!to) return

  if (phaseKey !== lastEtaPhaseKey) {
    force = true
    lastEtaPhaseKey = phaseKey
  }

  if (
    !shouldRefreshEtaRoute({
      lastAt: lastEtaAt,
      lastCoords: lastEtaFrom,
      nextCoords: from,
      force,
    })
  ) {
    return
  }

  const token = ++etaRequestToken
  etaAbortController?.abort()
  etaAbortController = new AbortController()

  try {
    const result = await fetchLiveEtaRoute(from, to, {
      signal: etaAbortController.signal,
    })
    if (token !== etaRequestToken || !result) return

    lastEtaAt = Date.now()
    lastEtaFrom = from
    driverRoute.value = result.route || []
    liveEta.value = {
      mode,
      minutes: result.durationMin,
      distanceKm: result.distanceKm,
      arrivalClock: result.arrivalClock,
    }
  } catch (err) {
    if (err?.name === 'AbortError' || token !== etaRequestToken) return
  }
}

async function handleAccept(rideId) {
  try {
    const ride = await rideStore.acceptRide(rideId)
    if (ride) {
      selectedId.value = ride.id
      statusFilter.value = RIDE_STATUS.ACCEPTED
      infoMessage.value = `${ride.passengerName} kabul edildi — yolcuya gidiyorsunuz`
      await refreshDriverEta({ force: true })
    }
  } catch (err) {
    presenceError.value = err?.message || 'Kabul başarısız.'
  }
}

async function handleArrived(rideId) {
  try {
    const ride = await rideStore.markDriverArrived(rideId)
    if (ride) {
      selectedId.value = ride.id
      infoMessage.value = 'Yolcunun yanına vardınız'
      await refreshDriverEta({ force: true })
    }
  } catch (err) {
    presenceError.value = err?.message || 'Varış kaydı başarısız.'
  }
}

async function handleOnboard(rideId) {
  try {
    infoMessage.value = 'Yolcu alındı'
    const ride = await rideStore.markPassengerOnboard(rideId)
    if (ride) {
      selectedId.value = ride.id
      // Kısa UI mesajı sonra in_progress
      setTimeout(() => {
        if (rideStore.rides.find((r) => r.id === rideId)?.tripPhase === TRIP_PHASE.IN_PROGRESS) {
          infoMessage.value = 'Yolculuk devam ediyor'
        }
      }, 900)
      await refreshDriverEta({ force: true })
    }
  } catch (err) {
    presenceError.value = err?.message || 'Yolcu alındı kaydı başarısız.'
  }
}

async function handleComplete(rideId) {
  try {
    const ride = await rideStore.completeRide(rideId)
    if (ride) {
      clearDriverEta()
      infoMessage.value = `${ride.passengerName} tamamlandı`
      statusFilter.value = RIDE_STATUS.COMPLETED
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

.driver-eta {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.driver-eta-main {
  font-weight: 800;
  color: #065f46;
  font-size: 1rem;
}

.driver-eta-sub {
  margin-top: 2px;
  font-size: 0.8rem;
  color: #047857;
  font-weight: 600;
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

.phase {
  font-size: 0.75rem;
  color: #0a1628;
  font-weight: 650;
  margin-top: 4px;
}

.ride-item-actions {
  display: flex;
  flex-wrap: wrap;
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
