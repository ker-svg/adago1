import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  RIDE_STATUS,
  TRIP_PHASE,
  initialNearbyDrivers,
  initialRides,
  mockDriver,
} from '@/data/mockData'
import { calculateFare, estimateEtaMinutes, haversineKm } from '@/utils/fare'
import { useAuthStore } from '@/stores/authStore'

const STORAGE_KEY = 'adago-state-v1'

/** Eski kayıtlardaki near-1 / Mehmet Demir kimliğini driver-1'e çevirir. */
function normalizePersistedState(parsed) {
  if (!parsed || !Array.isArray(parsed.rides)) return null

  if (Array.isArray(parsed.nearbyDrivers)) {
    parsed.nearbyDrivers = parsed.nearbyDrivers.map((driver) => {
      if (driver?.id === 'near-1' && driver?.name === 'Mehmet Demir') {
        return { ...driver, id: 'driver-1' }
      }
      return driver
    })
  }

  parsed.rides = parsed.rides.map((ride) => {
    let next = ride

    if (ride?.driverId === 'near-1' && ride?.driverName === 'Mehmet Demir') {
      next = { ...next, driverId: 'driver-1' }
    }

    if (
      ride?.assignedDriver?.id === 'near-1' &&
      ride?.assignedDriver?.name === 'Mehmet Demir'
    ) {
      next = {
        ...next,
        assignedDriver: { ...ride.assignedDriver, id: 'driver-1' },
      }
    }

    return next
  })

  return parsed
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const normalized = normalizePersistedState(parsed)
    if (normalized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return null
  }
}

function persistState(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}

const saved = loadPersistedState()
let driverSimTimer = null

export const useRideStore = defineStore('ride', () => {
  const authStore = useAuthStore()

  const rides = ref(saved?.rides?.length ? saved.rides : [...initialRides])
  const activeRideId = ref(saved?.activeRideId ?? null)
  const nearbyDrivers = ref(
    saved?.nearbyDrivers?.length
      ? saved.nearbyDrivers
      : initialNearbyDrivers.map((d) => ({ ...d })),
  )

  // Auth kaynağı — mock setRole yerine Supabase profili
  const currentRole = computed(() => authStore.currentRole)
  const currentUser = computed(() => authStore.currentUser)

  const pendingRides = computed(() =>
    rides.value.filter((ride) => ride.status === RIDE_STATUS.PENDING),
  )

  const acceptedRides = computed(() =>
    rides.value.filter((ride) => ride.status === RIDE_STATUS.ACCEPTED),
  )

  const completedRides = computed(() =>
    rides.value.filter((ride) => ride.status === RIDE_STATUS.COMPLETED),
  )

  const cancelledRides = computed(() =>
    rides.value.filter((ride) => ride.status === RIDE_STATUS.CANCELLED),
  )

  const passengerRides = computed(() => {
    if (!currentUser.value) return []
    return rides.value.filter(
      (ride) => ride.passengerId === currentUser.value.id,
    )
  })

  const activeRide = computed(
    () => rides.value.find((ride) => ride.id === activeRideId.value) || null,
  )

  const recentRides = computed(() =>
    [...rides.value]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5),
  )

  const stats = computed(() => ({
    total: rides.value.length,
    pending: pendingRides.value.length,
    accepted: acceptedRides.value.length,
    completed: completedRides.value.length,
    cancelled: cancelledRides.value.length,
  }))

  const passengerProfile = computed(() => {
    const user = currentUser.value
    const completed = rides.value.filter(
      (r) =>
        r.passengerId === user?.id && r.status === RIDE_STATUS.COMPLETED,
    ).length
    const total = rides.value.filter((r) => r.passengerId === user?.id).length
    return {
      name: user?.name || 'Yolcu',
      phone: user?.phone || '—',
      totalTrips: total,
      completedTrips: completed,
    }
  })

  const driverProfile = computed(() => {
    const user = currentUser.value
    const completedByMe = rides.value.filter(
      (r) =>
        (r.driverId === user?.id || r.driverName === user?.name) &&
        r.status === RIDE_STATUS.COMPLETED,
    ).length

    return {
      name: user?.name || 'Sürücü',
      vehicleType: user?.vehicleType || '—',
      rating: user?.rating || 5.0,
      completedTrips: completedByMe,
    }
  })

  function saveToStorage() {
    persistState({
      rides: rides.value,
      activeRideId: activeRideId.value,
      nearbyDrivers: nearbyDrivers.value,
    })
  }

  watch([rides, activeRideId, nearbyDrivers], saveToStorage, { deep: true })

  function setRole() {
    // Aşama 1: rol kayıt sırasında belirlenir; mock setRole kullanılmaz.
    console.warn('[AdaGo] setRole kaldırıldı. Rol auth profilinden gelir.')
  }

  function clearRole() {
    // Oturum temizliği authStore.signOut ile yapılır.
  }

  function startDriverSimulation() {
    if (driverSimTimer) return
    driverSimTimer = setInterval(() => {
      nearbyDrivers.value = nearbyDrivers.value.map((driver) => ({
        ...driver,
        lat: driver.lat + (Math.random() - 0.5) * 0.0035,
        lng: driver.lng + (Math.random() - 0.5) * 0.0035,
      }))
    }, 2200)
  }

  function stopDriverSimulation() {
    if (driverSimTimer) {
      clearInterval(driverSimTimer)
      driverSimTimer = null
    }
  }

  function findNearestDriver(coords) {
    if (!coords || !nearbyDrivers.value.length) return null

    let best = null
    let bestDistance = Infinity

    for (const driver of nearbyDrivers.value) {
      const distance = haversineKm(coords, {
        lat: driver.lat,
        lng: driver.lng,
      })
      if (distance < bestDistance) {
        bestDistance = distance
        best = driver
      }
    }

    if (!best) return null

    return {
      id: best.id,
      name: best.name,
      rating: best.rating,
      vehicleType: best.vehicleType,
      lat: best.lat,
      lng: best.lng,
      distanceKm: bestDistance,
      etaMin: estimateEtaMinutes(bestDistance),
    }
  }

  function createRide({
    passengerName,
    phone,
    from,
    to,
    fromCoords,
    toCoords,
    route = [],
    distanceKm = null,
    durationMin = null,
  }) {
    if (!currentUser.value || currentRole.value !== 'passenger') {
      throw new Error('Yolculuk talebi yalnızca yolcu tarafından oluşturulabilir.')
    }

    const fare = calculateFare(distanceKm)
    const nearest = findNearestDriver(fromCoords)

    const ride = {
      id: `ride-${Date.now()}`,
      passengerId: currentUser.value.id,
      passengerName: passengerName.trim(),
      phone: phone.trim(),
      from: from.trim(),
      to: to.trim(),
      fromCoords: fromCoords ? { ...fromCoords } : null,
      toCoords: toCoords ? { ...toCoords } : null,
      route: route || [],
      distanceKm,
      durationMin,
      estimatedFare: fare.amount,
      fareBreakdown: fare,
      assignedDriver: nearest,
      driverId: nearest?.id || null,
      driverName: nearest?.name || null,
      status: RIDE_STATUS.PENDING,
      tripPhase: TRIP_PHASE.ASSIGNING,
      createdAt: new Date().toISOString(),
    }

    rides.value = [ride, ...rides.value]
    activeRideId.value = ride.id
    return ride
  }

  function setActiveRide(rideId) {
    activeRideId.value = rideId
  }

  function acceptRide(rideId) {
    const ride = rides.value.find((item) => item.id === rideId)
    if (!ride || ride.status !== RIDE_STATUS.PENDING) return null

    ride.status = RIDE_STATUS.ACCEPTED
    ride.driverId = currentUser.value?.id ?? mockDriver.id
    ride.driverName = currentUser.value?.name ?? mockDriver.name
    ride.acceptedAt = new Date().toISOString()
    ride.tripPhase = TRIP_PHASE.EN_ROUTE
    ride.assignedDriver = {
      id: ride.driverId,
      name: ride.driverName,
      rating: currentUser.value?.rating || mockDriver.rating,
      vehicleType: currentUser.value?.vehicleType || mockDriver.vehicleType,
      etaMin: ride.assignedDriver?.etaMin || 5,
    }
    activeRideId.value = ride.id

    return ride
  }

  function startRide(rideId) {
    const ride = rides.value.find((item) => item.id === rideId)
    if (!ride) return null
    if (ride.status !== RIDE_STATUS.ACCEPTED) return null
    if (ride.tripPhase !== TRIP_PHASE.EN_ROUTE) return null

    ride.tripPhase = TRIP_PHASE.IN_PROGRESS
    return ride
  }

  function completeRide(rideId) {
    const ride = rides.value.find((item) => item.id === rideId)
    if (!ride) return null
    if (ride.status === RIDE_STATUS.COMPLETED) return ride
    if (ride.tripPhase !== TRIP_PHASE.IN_PROGRESS) return null

    ride.status = RIDE_STATUS.COMPLETED
    ride.tripPhase = TRIP_PHASE.COMPLETED
    ride.completedAt = new Date().toISOString()

    return ride
  }

  function cancelRide(rideId) {
    const ride = rides.value.find((item) => item.id === rideId)
    if (!ride) return null
    if (
      ride.status !== RIDE_STATUS.PENDING &&
      ride.status !== RIDE_STATUS.ACCEPTED &&
      ride.tripPhase !== TRIP_PHASE.ASSIGNING &&
      ride.tripPhase !== TRIP_PHASE.EN_ROUTE &&
      ride.tripPhase !== TRIP_PHASE.IN_PROGRESS
    ) {
      return null
    }

    if (ride.tripPhase === TRIP_PHASE.COMPLETED) return null

    ride.status = RIDE_STATUS.CANCELLED
    ride.tripPhase = null
    ride.cancelledAt = new Date().toISOString()
    if (activeRideId.value === rideId) activeRideId.value = null

    return ride
  }

  function filterRides({ status = 'all', query = '' } = {}) {
    const q = query.trim().toLocaleLowerCase('tr-TR')

    return rides.value.filter((ride) => {
      const statusMatch = status === 'all' || ride.status === status
      if (!statusMatch) return false
      if (!q) return true

      return (
        ride.passengerName?.toLocaleLowerCase('tr-TR').includes(q) ||
        ride.from?.toLocaleLowerCase('tr-TR').includes(q) ||
        ride.to?.toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }

  return {
    rides,
    currentRole,
    currentUser,
    activeRideId,
    activeRide,
    nearbyDrivers,
    pendingRides,
    acceptedRides,
    completedRides,
    cancelledRides,
    passengerRides,
    recentRides,
    stats,
    passengerProfile,
    driverProfile,
    setRole,
    clearRole,
    startDriverSimulation,
    stopDriverSimulation,
    findNearestDriver,
    createRide,
    setActiveRide,
    acceptRide,
    startRide,
    completeRide,
    cancelRide,
    filterRides,
  }
})
