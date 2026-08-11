<template>
  <div class="ride-screen">
    <div class="map-area">
      <RideMap
        ref="mapRef"
        :from-coords="mapFrom"
        :to-coords="mapTo"
        :route="mapRoute"
        :drivers="mapOnlineDrivers"
        :tracking-driver="trackingDriver"
        :driver-route="driverRoute"
        :fit-key="mapFitKey"
        :pick-mode="activeOwnedRide ? null : pickMode"
        :fit-drivers="!activeOwnedRide && !fromCoords && !toCoords"
        @pick="onMapPick"
      />
    </div>

    <BottomSheet :compact="!activeOwnedRide">
      <template v-if="activeOwnedRide">
        <TripStatusPanel
          :ride="activeOwnedRide"
          :live-eta="liveEta"
          :stale-warning="staleGpsWarning"
        >
          <v-btn
            v-if="canCancel(activeOwnedRide)"
            class="mt-3"
            color="error"
            variant="tonal"
            block
            @click="handleCancel(activeOwnedRide.id)"
          >
            Talebi İptal Et
          </v-btn>
          <v-btn
            v-if="isCompleted(activeOwnedRide)"
            class="mt-3"
            color="primary"
            variant="flat"
            block
            @click="startFresh"
          >
            Yeni Yolculuk
          </v-btn>
        </TripStatusPanel>
      </template>

      <template v-else>
        <div class="sheet-title mb-2">Nereye?</div>

        <v-alert
          v-if="driverStore.onlineDriversError"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          {{ driverStore.onlineDriversError }}
        </v-alert>

        <div
          v-else-if="!driverStore.onlineDriversLoading && passengerMapDrivers.length === 0"
          class="empty-drivers"
        >
          Şu anda çevrimiçi sürücü bulunmuyor.
        </div>

        <div
          class="location-row"
          :class="{ active: pickMode === 'from' }"
          @click="pickMode = 'from'"
        >
          <span class="dot from" />
          <v-autocomplete
            v-model="fromLocation"
            :items="fromItems"
            item-title="name"
            item-value="id"
            return-object
            no-filter
            label="Nereden"
            hide-details
            density="compact"
            variant="solo-filled"
            flat
            bg-color="transparent"
            :loading="fromSearchLoading"
            :menu-props="locationMenuProps"
            placeholder="Şehir, mekan veya adres"
            @update:search="onFromSearch"
            @update:model-value="onFromSelect"
            @click.stop
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :title="item.raw.name"
                :subtitle="locationSubtitle(item.raw)"
              />
            </template>
            <template #no-data>
              <v-list-item
                :title="fromSearchLoading ? 'Konum aranıyor...' : 'Sonuç bulunamadı'"
              />
            </template>
          </v-autocomplete>
        </div>

        <div
          class="location-row"
          :class="{ active: pickMode === 'to' }"
          @click="pickMode = 'to'"
        >
          <span class="dot to" />
          <v-autocomplete
            v-model="toLocation"
            :items="toItems"
            item-title="name"
            item-value="id"
            return-object
            no-filter
            label="Nereye"
            hide-details
            density="compact"
            variant="solo-filled"
            flat
            bg-color="transparent"
            :loading="toSearchLoading"
            :menu-props="locationMenuProps"
            placeholder="Şehir, mekan veya adres"
            @update:search="onToSearch"
            @update:model-value="onToSelect"
            @click.stop
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item
                v-bind="itemProps"
                :title="item.raw.name"
                :subtitle="locationSubtitle(item.raw)"
              />
            </template>
            <template #no-data>
              <v-list-item
                :title="toSearchLoading ? 'Konum aranıyor...' : 'Sonuç bulunamadı'"
              />
            </template>
          </v-autocomplete>
        </div>

        <div v-if="routeLoading" class="meta-pill loading-pill">
          <v-progress-circular
            indeterminate
            size="12"
            width="2"
            color="primary"
            class="mr-1"
          />
          Rota hesaplanıyor...
        </div>

        <template v-else-if="routeMeta">
          <div class="meta-pill">
            ~{{ routeMeta.distanceKm }} km
            <span v-if="routeMeta.durationMin"> · ~{{ routeMeta.durationMin }} dk</span>
          </div>
          <div v-if="routeMeta.isFallback" class="meta-pill fallback-pill">
            Yaklaşık rota gösteriliyor
          </div>
        </template>

        <FareEstimateCard :fare="farePreview" />

        <div v-if="nearestPreview" class="nearest-pill">
          En yakın: <strong>{{ nearestPreview.name }}</strong>
          · ⭐ {{ nearestPreview.rating }}
          · ~{{ nearestPreview.etaMin }} dk
        </div>

        <v-expand-transition>
          <div v-if="showDetails" class="details mt-2">
            <v-text-field
              v-model="passengerName"
              label="Yolcu Adı"
              density="compact"
              hide-details="auto"
              class="mb-2"
            />
            <v-text-field
              v-model="phone"
              label="Telefon"
              density="compact"
              hide-details="auto"
            />
          </div>
        </v-expand-transition>

        <button class="linkish" type="button" @click="showDetails = !showDetails">
          {{ showDetails ? 'Detayı gizle' : 'Ad / telefon' }}
        </button>

        <v-btn
          color="primary"
          size="large"
          block
          class="mt-2 request-btn"
          :loading="submitting || routeLoading"
          :disabled="!canRequest"
          @click="submitRide"
        >
          Yolculuk İste
        </v-btn>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      </template>
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import BottomSheet from '@/components/BottomSheet.vue'
import FareEstimateCard from '@/components/FareEstimateCard.vue'
import RideMap from '@/components/RideMap.vue'
import TripStatusPanel from '@/components/TripStatusPanel.vue'
import { RIDE_STATUS, TRIP_PHASE } from '@/data/mockData'
import {
  DRIVER_LOCATION_STALE_MS,
  qualifiesForPassengerMap,
  useDriverStore,
} from '@/stores/driverStore'
import { useRideStore } from '@/stores/rideStore'
import { calculateFare } from '@/utils/fare'
import {
  filterLocalLocations,
  getLocalLocationItems,
  mergeLocationResults,
  searchLocations,
} from '@/utils/geocoding'
import {
  fetchLiveEtaRoute,
  shouldRefreshEtaRoute,
} from '@/utils/liveEta'
import { fetchDrivingRoute } from '@/utils/route'

const SEARCH_DEBOUNCE_MS = 400
const SEARCH_MIN_CHARS = 3

const rideStore = useRideStore()
const driverStore = useDriverStore()
const mapRef = ref(null)

/**
 * Passenger haritası TEK sürücü kaynağı: driverStore.onlineDrivers (RPC).
 * Aktif ride varken yalnız assigned driver takip edilir.
 */
const passengerMapDrivers = computed(() =>
  (driverStore.onlineDrivers || []).filter(qualifiesForPassengerMap),
)

const passengerName = ref('')
const phone = ref('')
const fromLocation = ref(null)
const toLocation = ref(null)
const fromCoords = ref(null)
const toCoords = ref(null)
const previewRoute = ref([])
const routeMeta = ref(null)
const pickMode = ref('from')
const showDetails = ref(false)
const submitting = ref(false)
const routeLoading = ref(false)
const errorMessage = ref('')
const driverRoute = ref([])
const liveEta = ref(null)
/** Stale prune sonrası son bilinen sürücü konumu */
const lastKnownTracking = ref(null)

const fromItems = ref(getLocalLocationItems())
const toItems = ref(getLocalLocationItems())
const fromSearchLoading = ref(false)
const toSearchLoading = ref(false)

const locationMenuProps = {
  maxHeight: 260,
  location: 'top',
  offset: 6,
}

let routeRequestToken = 0
let routeAbortController = null

let fromSearchToken = 0
let toSearchToken = 0
let fromSearchTimer = null
let toSearchTimer = null
let fromSearchAbort = null
let toSearchAbort = null
let lastFromQuery = ''
let lastToQuery = ''

let etaAbortController = null
let etaRequestToken = 0
let lastEtaAt = 0
let lastEtaFrom = null
let lastEtaPhaseKey = ''

const activeOwnedRide = computed(() => {
  const ride = rideStore.activeRide
  if (!ride) return null
  if (ride.passengerId !== rideStore.currentUser?.id) return null
  if (ride.status === RIDE_STATUS.CANCELLED) return null
  if (
    ride.tripPhase === TRIP_PHASE.COMPLETED ||
    ride.status === RIDE_STATUS.COMPLETED
  ) {
    return ride
  }
  return ride
})

const isTrackingActive = computed(() => {
  const ride = activeOwnedRide.value
  if (!ride || isCompleted(ride)) return false
  return Boolean(ride.driverId) && ride.status === RIDE_STATUS.ACCEPTED
})

const assignedOnlineDriver = computed(() => {
  const ride = activeOwnedRide.value
  if (!ride?.driverId) return null
  // Takip için freshness filtresi yok — stale UI ayrı
  return (
    (driverStore.onlineDrivers || []).find((d) => d.id === ride.driverId) ||
    null
  )
})

const trackingDriver = computed(() => {
  if (!isTrackingActive.value) return null
  const ride = activeOwnedRide.value
  const d = assignedOnlineDriver.value
  if (d && Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
    return {
      id: d.id,
      lat: d.lat,
      lng: d.lng,
      name: ride?.assignedDriver?.name || d.name || 'Sürücü',
    }
  }
  if (
    lastKnownTracking.value &&
    lastKnownTracking.value.id === ride?.driverId
  ) {
    return {
      ...lastKnownTracking.value,
      name:
        ride?.assignedDriver?.name ||
        lastKnownTracking.value.name ||
        'Sürücü',
    }
  }
  const ad = ride?.assignedDriver
  if (
    ad &&
    Number.isFinite(Number(ad.lat)) &&
    Number.isFinite(Number(ad.lng))
  ) {
    return {
      id: ad.id,
      lat: Number(ad.lat),
      lng: Number(ad.lng),
      name: ad.name || 'Sürücü',
    }
  }
  return null
})

const mapOnlineDrivers = computed(() => {
  // Aktif takip: diğer online sürücüleri gizle
  if (isTrackingActive.value) return []
  return passengerMapDrivers.value
})

const mapFitKey = computed(() => {
  const ride = activeOwnedRide.value
  if (!ride) return 'idle'
  return `${ride.id}:${ride.tripPhaseKey || ride.tripPhase || ride.status}`
})

const staleGpsWarning = computed(() => {
  if (!isTrackingActive.value) return ''
  const d = assignedOnlineDriver.value || lastKnownTracking.value
  if (!d?.lastLocationAt && !trackingDriver.value) {
    return 'Sürücü konumu geçici olarak güncellenemiyor.'
  }
  if (!d?.lastLocationAt) {
    return trackingDriver.value
      ? 'Sürücü konumu geçici olarak güncellenemiyor.'
      : 'Sürücü konumu geçici olarak güncellenemiyor.'
  }
  const age = Date.now() - new Date(d.lastLocationAt).getTime()
  if (!Number.isFinite(age) || age > DRIVER_LOCATION_STALE_MS) {
    return 'Sürücü konumu geçici olarak güncellenemiyor.'
  }
  return ''
})

const mapFrom = computed(
  () => activeOwnedRide.value?.fromCoords || fromCoords.value,
)
const mapTo = computed(
  () => activeOwnedRide.value?.toCoords || toCoords.value,
)
const mapRoute = computed(() => {
  // Canlı takip rotası ayrı (driverRoute); A/B rotasını karıştırma
  if (isTrackingActive.value && driverRoute.value.length > 1) return []
  if (isTrackingActive.value) {
    const phase = activeOwnedRide.value?.tripPhase
    if (
      phase === TRIP_PHASE.EN_ROUTE ||
      phase === TRIP_PHASE.ARRIVED ||
      phase === TRIP_PHASE.PASSENGER_ONBOARD ||
      phase === TRIP_PHASE.IN_PROGRESS
    ) {
      return []
    }
  }
  return activeOwnedRide.value?.route || previewRoute.value
})

const farePreview = computed(() => {
  if (routeLoading.value) return null
  if (!routeMeta.value?.distanceKm && routeMeta.value?.distanceKm !== 0) {
    return null
  }
  return calculateFare(routeMeta.value.distanceKm)
})

const nearestPreview = computed(() => {
  if (!fromCoords.value) return null
  return rideStore.findNearestDriver(fromCoords.value)
})

const canRequest = computed(
  () =>
    Boolean(fromCoords.value) &&
    Boolean(toCoords.value) &&
    Boolean(passengerName.value.trim()) &&
    isValidPhone(phone.value) &&
    !isSamePoint(fromCoords.value, toCoords.value) &&
    !routeLoading.value &&
    Boolean(routeMeta.value),
)

onMounted(async () => {
  passengerName.value = rideStore.currentUser?.name || ''
  phone.value = rideStore.currentUser?.phone || ''
  await Promise.all([
    rideStore.fetchMyRides(),
    driverStore.fetchOnlineDrivers(),
  ])
  driverStore.subscribeToDriverLocations()

  const ride = activeOwnedRide.value
  if (ride?.id) {
    rideStore.subscribeToRideUpdates(ride.id)
    await refreshLiveTracking({ force: true })
  }

  nextTick(() => mapRef.value?.invalidate?.())
})

onUnmounted(() => {
  clearTimeout(fromSearchTimer)
  clearTimeout(toSearchTimer)
  fromSearchAbort?.abort()
  toSearchAbort?.abort()
  routeAbortController?.abort()
  etaAbortController?.abort()
  void driverStore.unsubscribeDriverLocations()
  void rideStore.unsubscribeRideUpdates()
})

watch(activeOwnedRide, (ride, prev) => {
  if (!ride) {
    void rideStore.unsubscribeRideUpdates()
    clearLiveTracking()
    return
  }

  fromCoords.value = ride.fromCoords
  toCoords.value = ride.toCoords
  previewRoute.value = ride.route || []
  routeMeta.value = {
    distanceKm: ride.distanceKm,
    durationMin: ride.durationMin,
    isFallback: false,
  }
  routeLoading.value = false

  if (ride.id && ride.id !== prev?.id) {
    rideStore.subscribeToRideUpdates(ride.id)
  }

  if (
    ride.tripPhase !== prev?.tripPhase ||
    ride.status !== prev?.status ||
    ride.id !== prev?.id
  ) {
    void refreshLiveTracking({ force: true })
  }
})

watch(
  () => [
    assignedOnlineDriver.value?.lat,
    assignedOnlineDriver.value?.lng,
    assignedOnlineDriver.value?.lastLocationAt,
  ],
  () => {
    const d = assignedOnlineDriver.value
    if (d && Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
      lastKnownTracking.value = {
        id: d.id,
        lat: d.lat,
        lng: d.lng,
        name: d.name,
        lastLocationAt: d.lastLocationAt,
      }
    }
    if (!isTrackingActive.value) return
    void refreshLiveTracking({ force: false })
  },
)

function locationSubtitle(location) {
  if (!location) return undefined
  if (!location.displayName || location.displayName === location.name) {
    return undefined
  }
  return location.displayName
}

function isValidPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 7
}

function isSamePoint(a, b) {
  if (!a || !b) return false
  return (
    Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lng - b.lng) < 0.0001
  )
}

function canCancel(ride) {
  if (isCompleted(ride)) return false
  // Yolculuk başladıktan sonra iptal yok (onboard / in_progress)
  if (
    ride.tripPhase === TRIP_PHASE.PASSENGER_ONBOARD ||
    ride.tripPhase === TRIP_PHASE.IN_PROGRESS
  ) {
    return false
  }
  return (
    ride.tripPhase === TRIP_PHASE.ASSIGNING ||
    ride.tripPhase === TRIP_PHASE.EN_ROUTE ||
    ride.tripPhase === TRIP_PHASE.ARRIVED ||
    ride.status === RIDE_STATUS.PENDING ||
    ride.status === RIDE_STATUS.ACCEPTED
  )
}

function isCompleted(ride) {
  return (
    ride.tripPhase === TRIP_PHASE.COMPLETED ||
    ride.status === RIDE_STATUS.COMPLETED
  )
}

function clearLiveTracking() {
  etaAbortController?.abort()
  etaAbortController = null
  etaRequestToken += 1
  driverRoute.value = []
  liveEta.value = null
  lastKnownTracking.value = null
  lastEtaAt = 0
  lastEtaFrom = null
  lastEtaPhaseKey = ''
}

async function refreshLiveTracking({ force = false } = {}) {
  const ride = activeOwnedRide.value
  if (!ride || !isTrackingActive.value) {
    clearLiveTracking()
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

  const driver = trackingDriver.value
  if (!driver) {
    // Son bilinen rota kalabilir; ETA güncellenmez
    return
  }

  const from = { lat: driver.lat, lng: driver.lng }
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
    clearLiveTracking()
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
    if (token !== etaRequestToken) return
    if (!result) return

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

function ensureItemInList(itemsRef, location) {
  if (!location) return
  const exists = itemsRef.value.some((item) => item.id === location.id)
  if (!exists) {
    itemsRef.value = [location, ...itemsRef.value]
  }
}

function createMapLocation(lat, lng) {
  const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  return {
    id: `map-${lat.toFixed(5)},${lng.toFixed(5)}`,
    name: label,
    displayName: 'Haritadan seçildi',
    lat,
    lng,
    type: 'map',
  }
}

function cancelLocationSearch(side) {
  if (side === 'from') {
    clearTimeout(fromSearchTimer)
    fromSearchTimer = null
    fromSearchAbort?.abort()
    fromSearchAbort = null
    fromSearchToken += 1
    fromSearchLoading.value = false
  } else {
    clearTimeout(toSearchTimer)
    toSearchTimer = null
    toSearchAbort?.abort()
    toSearchAbort = null
    toSearchToken += 1
    toSearchLoading.value = false
  }
}

function onFromSearch(query) {
  scheduleLocationSearch('from', query)
}

function onToSearch(query) {
  scheduleLocationSearch('to', query)
}

function scheduleLocationSearch(side, rawQuery) {
  const query = String(rawQuery || '').trim()
  const itemsRef = side === 'from' ? fromItems : toItems
  const loadingRef = side === 'from' ? fromSearchLoading : toSearchLoading
  const previousQuery = side === 'from' ? lastFromQuery : lastToQuery

  // Seçim sonrası autocomplete bazen seçilen başlığı search olarak yollar
  const selected = side === 'from' ? fromLocation.value : toLocation.value
  if (selected && selected.name === query) {
    ensureItemInList(itemsRef, selected)
    return
  }

  itemsRef.value = filterLocalLocations(query)

  if (query.length < SEARCH_MIN_CHARS) {
    cancelLocationSearch(side)
    loadingRef.value = false
    if (side === 'from') lastFromQuery = query
    else lastToQuery = query
    return
  }

  // Aynı sorgu: mevcut debounce / sonuç korunur (timer silinmez)
  if (query === previousQuery) {
    return
  }

  if (side === 'from') {
    clearTimeout(fromSearchTimer)
    fromSearchTimer = null
    lastFromQuery = query
  } else {
    clearTimeout(toSearchTimer)
    toSearchTimer = null
    lastToQuery = query
  }

  const timer = setTimeout(() => {
    runRemoteLocationSearch(side, query)
  }, SEARCH_DEBOUNCE_MS)

  if (side === 'from') fromSearchTimer = timer
  else toSearchTimer = timer
}

async function runRemoteLocationSearch(side, query) {
  const itemsRef = side === 'from' ? fromItems : toItems
  const loadingRef = side === 'from' ? fromSearchLoading : toSearchLoading
  const localMatches = filterLocalLocations(query)

  const token =
    side === 'from' ? ++fromSearchToken : ++toSearchToken

  if (side === 'from') {
    fromSearchAbort?.abort()
    fromSearchAbort = new AbortController()
  } else {
    toSearchAbort?.abort()
    toSearchAbort = new AbortController()
  }

  const signal =
    side === 'from' ? fromSearchAbort.signal : toSearchAbort.signal

  loadingRef.value = true

  try {
    const remote = await searchLocations(query, signal)
    const currentToken = side === 'from' ? fromSearchToken : toSearchToken
    if (token !== currentToken) return

    itemsRef.value = mergeLocationResults(localMatches, remote)
  } catch (err) {
    if (err?.name === 'AbortError') return
    const currentToken = side === 'from' ? fromSearchToken : toSearchToken
    if (token !== currentToken) return
    itemsRef.value = localMatches
  } finally {
    const currentToken = side === 'from' ? fromSearchToken : toSearchToken
    if (token === currentToken) {
      loadingRef.value = false
    }
  }
}

function applyLocationSelection(side, location) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    if (side === 'from') {
      fromCoords.value = null
    } else {
      toCoords.value = null
    }
    return
  }

  const coords = { lat: location.lat, lng: location.lng }

  if (side === 'from') {
    fromCoords.value = coords
    ensureItemInList(fromItems, location)
    pickMode.value = toCoords.value ? null : 'to'
  } else {
    toCoords.value = coords
    ensureItemInList(toItems, location)
    pickMode.value = null
  }
}

async function onFromSelect(location) {
  applyLocationSelection('from', location)
  await refreshRoute()
}

async function onToSelect(location) {
  applyLocationSelection('to', location)
  await refreshRoute()
}

async function onMapPick({ mode, lat, lng }) {
  const location = createMapLocation(lat, lng)
  if (mode === 'from') {
    fromLocation.value = location
    applyLocationSelection('from', location)
  } else {
    toLocation.value = location
    applyLocationSelection('to', location)
  }
  await refreshRoute()
}

function resetRouteUi() {
  cancelLocationSearch('from')
  cancelLocationSearch('to')
  fromLocation.value = null
  toLocation.value = null
  fromCoords.value = null
  toCoords.value = null
  previewRoute.value = []
  routeMeta.value = null
  routeLoading.value = false
  errorMessage.value = ''
  pickMode.value = 'from'
  fromItems.value = getLocalLocationItems()
  toItems.value = getLocalLocationItems()
  lastFromQuery = ''
  lastToQuery = ''
  routeAbortController?.abort()
  routeAbortController = null
  routeRequestToken += 1
}

function startFresh() {
  rideStore.setActiveRide(null)
  clearLiveTracking()
  resetRouteUi()
}

async function refreshRoute() {
  if (!fromCoords.value || !toCoords.value) {
    previewRoute.value = []
    routeMeta.value = null
    routeLoading.value = false
    return
  }

  const token = ++routeRequestToken
  routeAbortController?.abort()
  routeAbortController = new AbortController()
  const { signal } = routeAbortController

  routeLoading.value = true
  errorMessage.value = ''

  try {
    const result = await fetchDrivingRoute(fromCoords.value, toCoords.value, {
      signal,
    })
    if (token !== routeRequestToken) return

    previewRoute.value = result.route
    routeMeta.value = {
      distanceKm: result.distanceKm,
      durationMin: result.durationMin,
      isFallback: Boolean(result.isFallback),
    }
  } catch (err) {
    if (err?.name === 'AbortError' || token !== routeRequestToken) return
    previewRoute.value = []
    routeMeta.value = null
    errorMessage.value = 'Rota hesaplanamadı.'
  } finally {
    if (token === routeRequestToken) {
      routeLoading.value = false
    }
  }
}

function validateRideInput() {
  if (!fromCoords.value) {
    return 'Başlangıç noktası gerekli.'
  }
  if (!toCoords.value) {
    return 'Varış noktası gerekli.'
  }
  if (isSamePoint(fromCoords.value, toCoords.value)) {
    return 'Başlangıç ve varış aynı olamaz.'
  }
  if (!passengerName.value.trim()) {
    showDetails.value = true
    return 'Yolcu adı gerekli.'
  }
  if (!isValidPhone(phone.value)) {
    showDetails.value = true
    return 'Geçerli bir telefon numarası girin.'
  }
  if (routeLoading.value) {
    return 'Rota hesaplanıyor, lütfen bekleyin.'
  }
  if (!routeMeta.value) {
    return 'Rota henüz hazır değil.'
  }
  return null
}

function locationLabel(location, fallback) {
  if (!location) return fallback
  return location.name || location.displayName || fallback
}

async function submitRide() {
  const validationError = validateRideInput()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    if (!previewRoute.value.length) await refreshRoute()
    if (routeLoading.value || !routeMeta.value) {
      errorMessage.value = 'Rota henüz hazır değil.'
      return
    }

    await rideStore.createRide({
      passengerName: passengerName.value,
      phone: phone.value,
      from: locationLabel(fromLocation.value, 'Başlangıç'),
      to: locationLabel(toLocation.value, 'Varış'),
      fromCoords: fromCoords.value,
      toCoords: toCoords.value,
      route: previewRoute.value,
      distanceKm: routeMeta.value?.distanceKm ?? null,
      durationMin: routeMeta.value?.durationMin ?? null,
    })

    pickMode.value = null
    const created = rideStore.activeRide
    if (created?.id) {
      rideStore.subscribeToRideUpdates(created.id)
    }
  } catch (err) {
    errorMessage.value = err.message || 'Talep oluşturulamadı.'
  } finally {
    submitting.value = false
  }
}

async function handleCancel(rideId) {
  try {
    await rideStore.cancelRide(rideId)
    resetRouteUi()
  } catch (err) {
    errorMessage.value = err.message || 'İptal başarısız.'
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

.sheet-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.02em;
}

.empty-drivers {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.85rem;
  font-weight: 600;
}

.location-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 8px;
  margin-bottom: 8px;
  border-radius: 14px;
  background: #f3f5f7;
  border: 2px solid transparent;
}

.location-row.active {
  border-color: #10b981;
  background: #ecfdf5;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.from {
  background: #0a1628;
}

.dot.to {
  background: #10b981;
}

.meta-pill,
.nearest-pill {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #065f46;
  font-size: 0.78rem;
  font-weight: 600;
}

.nearest-pill {
  background: #f0fdf4;
  color: #166534;
}

.loading-pill {
  background: #eef2f7;
  color: #475569;
}

.fallback-pill {
  background: #fff7ed;
  color: #9a3412;
}

.linkish {
  margin-top: 8px;
  border: 0;
  background: transparent;
  color: #5a6a72;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
}

.request-btn {
  border-radius: 14px !important;
  font-weight: 700 !important;
}

.error-text {
  color: #c62828;
  font-size: 0.85rem;
  margin: 8px 0 0;
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
