import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  RIDE_STATUS,
  TRIP_PHASE,
  TRIP_PHASE_FROM_DB,
  initialNearbyDrivers,
} from '@/data/mockData'
import { calculateFare, estimateEtaMinutes, haversineKm } from '@/utils/fare'
import { mapAuthError, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  qualifiesForPassengerMap,
  useDriverStore,
} from '@/stores/driverStore'

const STATUS_FROM_DB = {
  pending: RIDE_STATUS.PENDING,
  accepted: RIDE_STATUS.ACCEPTED,
  completed: RIDE_STATUS.COMPLETED,
  cancelled: RIDE_STATUS.CANCELLED,
}

const RIDES_CHANNEL = 'adago-rides-tracking'

function numOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapRideRow(row) {
  if (!row) return null

  const fromCoords =
    row.from_lat != null && row.from_lng != null
      ? { lat: Number(row.from_lat), lng: Number(row.from_lng) }
      : null
  const toCoords =
    row.to_lat != null && row.to_lng != null
      ? { lat: Number(row.to_lat), lng: Number(row.to_lng) }
      : null

  let route = []
  if (Array.isArray(row.route)) {
    route = row.route
  } else if (typeof row.route === 'string') {
    try {
      route = JSON.parse(row.route)
    } catch {
      route = []
    }
  }

  const estimatedFare = numOrNull(row.estimated_fare)
  const grossFare = numOrNull(row.gross_fare)
  const commissionAmount = numOrNull(row.commission_amount)
  const driverNetAmount = numOrNull(row.driver_net_amount)
  const commissionRate = numOrNull(row.commission_rate)

  return {
    id: row.id,
    passengerId: row.passenger_id,
    passengerName: row.passenger_name,
    phone: row.passenger_phone || '',
    from: row.from_label,
    to: row.to_label,
    fromCoords,
    toCoords,
    route: Array.isArray(route) ? route : [],
    distanceKm: numOrNull(row.distance_km),
    durationMin: numOrNull(row.duration_min),
    estimatedFare,
    fareBreakdown: estimatedFare != null
      ? { amount: estimatedFare, currency: '₺', formatted: `${estimatedFare} ₺` }
      : null,
    assignedDriver: row.driver_id
      ? {
          id: row.driver_id,
          name: row.driver_name || 'Sürücü',
          rating: numOrNull(row.driver_rating) || 5,
          vehicleType: row.driver_vehicle_type || '—',
          etaMin: 5,
          lat: numOrNull(row.driver_lat),
          lng: numOrNull(row.driver_lng),
          lastLocationAt: row.driver_last_location_at || null,
        }
      : null,
    driverId: row.driver_id || null,
    driverName: row.driver_name || null,
    status: STATUS_FROM_DB[row.status] || row.status,
    tripPhase: row.trip_phase
      ? TRIP_PHASE_FROM_DB[row.trip_phase] || row.trip_phase
      : null,
    tripPhaseKey: row.trip_phase || null,
    grossFare,
    commissionRate,
    commissionAmount,
    driverNetAmount,
    commissionStatus: row.commission_status || null,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at || null,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    cancelledAt: row.cancelled_at || null,
  }
}

function upsertRideList(list, ride) {
  if (!ride) return list
  const idx = list.findIndex((item) => item.id === ride.id)
  if (idx >= 0) {
    const copy = list.slice()
    copy[idx] = ride
    return copy
  }
  return [ride, ...list]
}

let driverSimTimer = null
let ridesChannel = null
let subscribedRideId = null

export const useRideStore = defineStore('ride', () => {
  const authStore = useAuthStore()

  const rides = ref([])
  const activeRideId = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')

  // Yalnızca Home/Driver demo — passenger haritası ASLA bunu kullanmaz
  const nearbyDrivers = ref(initialNearbyDrivers.map((d) => ({ ...d })))

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

  function setRole() {
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

  /** Passenger nearest: yalnızca driverStore.onlineDrivers */
  function findNearestDriver(coords) {
    if (!coords) return null

    const driverStore = useDriverStore()
    const pool = (driverStore.onlineDrivers || []).filter(qualifiesForPassengerMap)
    if (!pool.length) return null

    let best = null
    let bestDistance = Infinity

    for (const driver of pool) {
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

  async function fetchMyRides() {
    loading.value = true
    errorMessage.value = ''
    try {
      if (!authStore.isAuthenticated) {
        rides.value = []
        activeRideId.value = null
        return []
      }

      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const mapped = (data || []).map(mapRideRow).filter(Boolean)
      rides.value = mapped

      const activeOwned = mapped.find(
        (r) =>
          r.status !== RIDE_STATUS.CANCELLED &&
          r.status !== RIDE_STATUS.COMPLETED &&
          (currentRole.value === 'passenger'
            ? r.passengerId === currentUser.value?.id
            : r.driverId === currentUser.value?.id ||
              r.status === RIDE_STATUS.PENDING),
      )
      if (activeOwned) {
        activeRideId.value = activeOwned.id
      } else if (
        activeRideId.value &&
        !mapped.some((r) => r.id === activeRideId.value)
      ) {
        activeRideId.value = null
      }

      return mapped
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Yolculuklar yüklenemedi.'
      rides.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  async function createRide({
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

    saving.value = true
    errorMessage.value = ''
    try {
      const { data, error } = await supabase.rpc('create_ride', {
        p_passenger_name: passengerName.trim(),
        p_passenger_phone: phone?.trim() || null,
        p_from_label: from.trim(),
        p_to_label: to.trim(),
        p_from_lat: fromCoords?.lat ?? null,
        p_from_lng: fromCoords?.lng ?? null,
        p_to_lat: toCoords?.lat ?? null,
        p_to_lng: toCoords?.lng ?? null,
        p_route: route || [],
        p_distance_km: distanceKm,
        p_duration_min: durationMin,
        p_estimated_fare: fare.amount,
      })
      if (error) throw error

      const ride = mapRideRow(data)
      if (nearest) {
        ride.assignedDriver = {
          id: nearest.id,
          name: nearest.name,
          rating: nearest.rating,
          vehicleType: nearest.vehicleType,
          etaMin: nearest.etaMin,
        }
      }

      rides.value = upsertRideList(rides.value, ride)
      activeRideId.value = ride.id
      return ride
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Talep oluşturulamadı.'
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  function setActiveRide(rideId) {
    activeRideId.value = rideId
  }

  async function acceptRide(rideId) {
    saving.value = true
    errorMessage.value = ''
    try {
      const { data, error } = await supabase.rpc('accept_ride', {
        p_ride_id: rideId,
      })
      if (error) throw error

      const ride = mapRideRow(data)
      if (currentUser.value) {
        ride.driverName = currentUser.value.name
        ride.assignedDriver = {
          id: currentUser.value.id,
          name: currentUser.value.name,
          rating: currentUser.value.rating || 5,
          vehicleType: currentUser.value.vehicleType || '—',
          etaMin: ride.assignedDriver?.etaMin || 5,
        }
      }
      rides.value = upsertRideList(rides.value, ride)
      activeRideId.value = ride.id
      return ride
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Kabul başarısız.'
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  async function startRide(rideId) {
    // Aşama 4: start_ride yerine mark_passenger_onboard kullanılır
    return markPassengerOnboard(rideId)
  }

  function assertAssignedDriver(rideId) {
    if (authStore.currentRole !== 'driver') {
      throw new Error('Yalnızca sürücü bu işlemi yapabilir')
    }
    const uid = authStore.user?.id || authStore.currentUser?.id
    if (!uid) throw new Error('Giriş gerekli')
    const ride = rides.value.find((r) => r.id === rideId)
    if (ride?.driverId && ride.driverId !== uid) {
      throw new Error('Bu yolculuk size atanmamış')
    }
  }

  async function markDriverArrived(rideId) {
    saving.value = true
    errorMessage.value = ''
    try {
      assertAssignedDriver(rideId)
      const { data, error } = await supabase.rpc('mark_driver_arrived', {
        p_ride_id: rideId,
      })
      if (error) throw error
      const ride = mapRideRow(data)
      rides.value = upsertRideList(rides.value, ride)
      return ride
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Varış kaydı başarısız.'
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  async function markPassengerOnboard(rideId) {
    saving.value = true
    errorMessage.value = ''
    try {
      assertAssignedDriver(rideId)
      const { data, error } = await supabase.rpc('mark_passenger_onboard', {
        p_ride_id: rideId,
      })
      if (error) throw error
      const ride = mapRideRow(data)
      rides.value = upsertRideList(rides.value, ride)
      return ride
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Yolcu alındı kaydı başarısız.'
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  async function fetchRideTracking(rideId) {
    if (!rideId) return null
    try {
      const { data, error } = await supabase.rpc('get_ride_tracking', {
        p_ride_id: rideId,
      })
      if (error) throw error
      const row = typeof data === 'string' ? JSON.parse(data) : data
      const ride = mapRideRow(row)
      if (ride) {
        rides.value = upsertRideList(rides.value, ride)
        if (
          ride.status !== RIDE_STATUS.COMPLETED &&
          ride.status !== RIDE_STATUS.CANCELLED
        ) {
          activeRideId.value = ride.id
        }
      }
      return ride
    } catch (err) {
      console.warn('[AdaGo] ride tracking fetch:', err?.message || err)
      return null
    }
  }

  function handleRideRealtime(payload) {
    const event = payload?.eventType || payload?.event
    if (event === 'DELETE') {
      const oldId = payload?.old?.id
      if (oldId) {
        rides.value = rides.value.filter((r) => r.id !== oldId)
        if (activeRideId.value === oldId) activeRideId.value = null
      }
      return
    }

    const row = payload?.new
    if (!row?.id) {
      void fetchMyRides()
      return
    }

    // İsim zenginleştirmesi için tracking RPC
    void fetchRideTracking(row.id)
  }

  function subscribeToRideUpdates(rideId = null) {
    if (ridesChannel && subscribedRideId === (rideId || '*')) {
      return ridesChannel
    }
    void unsubscribeRideUpdates()

    const filter = rideId ? `id=eq.${rideId}` : undefined
    subscribedRideId = rideId || '*'

    let channel = supabase.channel(
      rideId ? `${RIDES_CHANNEL}-${rideId}` : `${RIDES_CHANNEL}-all`,
    )

    const config = {
      event: '*',
      schema: 'public',
      table: 'rides',
    }
    if (filter) config.filter = filter

    channel = channel.on('postgres_changes', config, handleRideRealtime)
    ridesChannel = channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[AdaGo] rides Realtime bağlantısı koptu')
        if (rideId) void fetchRideTracking(rideId)
        else void fetchMyRides()
      }
    })
    return ridesChannel
  }

  async function unsubscribeRideUpdates() {
    if (!ridesChannel) {
      subscribedRideId = null
      return
    }
    const ch = ridesChannel
    ridesChannel = null
    subscribedRideId = null
    try {
      await supabase.removeChannel(ch)
    } catch {
      // ignore
    }
  }

  async function completeRide(rideId) {
    saving.value = true
    errorMessage.value = ''
    try {
      assertAssignedDriver(rideId)
      const { data, error } = await supabase.rpc('complete_ride', {
        p_ride_id: rideId,
      })
      if (error) throw error
      const ride = mapRideRow(data)
      rides.value = upsertRideList(rides.value, ride)
      return ride
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Tamamlama başarısız.'
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  async function cancelRide(rideId) {
    saving.value = true
    errorMessage.value = ''
    try {
      const { data, error } = await supabase.rpc('cancel_ride', {
        p_ride_id: rideId,
      })
      if (error) throw error
      const ride = mapRideRow(data)
      rides.value = upsertRideList(rides.value, ride)
      if (activeRideId.value === rideId) activeRideId.value = null
      return ride
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'İptal başarısız.'
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
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

  function resetLocal() {
    void unsubscribeRideUpdates()
    rides.value = []
    activeRideId.value = null
    errorMessage.value = ''
    loading.value = false
    saving.value = false
  }

  return {
    rides,
    currentRole,
    currentUser,
    activeRideId,
    activeRide,
    nearbyDrivers,
    loading,
    saving,
    errorMessage,
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
    fetchMyRides,
    fetchRideTracking,
    createRide,
    setActiveRide,
    acceptRide,
    startRide,
    markDriverArrived,
    markPassengerOnboard,
    completeRide,
    cancelRide,
    filterRides,
    subscribeToRideUpdates,
    unsubscribeRideUpdates,
    resetLocal,
  }
})
