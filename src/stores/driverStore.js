import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { MAP_BOUNDS } from '@/data/mockData'
import { mapAuthError, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export const VEHICLE_TYPES = ['Sedan', 'Hatchback', 'SUV', 'Minivan']

/** Son GPS bu süreden eskiyse haritada gösterme */
export const DRIVER_LOCATION_STALE_MS = 90_000

const LOCATION_THROTTLE_MS = 4000
const MIN_MOVE_DEG = 0.00008 // ~9m civarı; daha küçük hareketleri atla
const ONLINE_CHANNEL = 'adago-online-drivers'
const STALE_PRUNE_MS = 5_000
const ONLINE_REFRESH_MS = 20_000

/** Supabase auth kullanıcı id — mock `near-2` / `driver-1` gibi id'leri ele */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Sınır yakınındaki sürücüleri yanlışlıkla elemek için hafif genişletilmiş bounds */
const SOFT_BOUNDS = {
  south: MAP_BOUNDS[0][0] - 0.2,
  west: MAP_BOUNDS[0][1] - 0.2,
  north: MAP_BOUNDS[1][0] + 0.2,
  east: MAP_BOUNDS[1][1] + 0.2,
}

export function isSupabaseDriverId(id) {
  return typeof id === 'string' && UUID_RE.test(id)
}

function mapDriver(row) {
  if (!row) return null
  return {
    id: row.id,
    isOnline: Boolean(row.is_online),
    rating: Number(row.rating ?? 5),
    completedTrips: Number(row.completed_trips ?? 0),
    lastLat: row.last_lat == null ? null : Number(row.last_lat),
    lastLng: row.last_lng == null ? null : Number(row.last_lng),
    lastLocationAt: row.last_location_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapVehicle(row) {
  if (!row) return null
  return {
    id: row.id,
    driverId: row.driver_id,
    vehicleType: row.vehicle_type,
    brand: row.brand || '',
    model: row.model || '',
    color: row.color || '',
    plate: row.plate || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapOnlineDriverRow(row) {
  if (!row) return null
  const latRaw = row.lat ?? row.last_lat
  const lngRaw = row.lng ?? row.last_lng
  // Number(null) === 0 → sahte koordinat üretme
  if (latRaw == null || lngRaw == null) return null
  const lat = Number(latRaw)
  const lng = Number(lngRaw)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id: row.id,
    name: row.name || 'Sürücü',
    rating: Number(row.rating ?? 5),
    vehicleType: row.vehicle_type || row.vehicleType || '—',
    lat,
    lng,
    lastLocationAt: row.last_location_at || row.lastLocationAt || null,
  }
}

function isFreshLocation(lastLocationAt) {
  if (!lastLocationAt) return false
  const ts = new Date(lastLocationAt).getTime()
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts <= DRIVER_LOCATION_STALE_MS
}

function isValidMapCoords(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < SOFT_BOUNDS.south || lat > SOFT_BOUNDS.north) return false
  if (lng < SOFT_BOUNDS.west || lng > SOFT_BOUNDS.east) return false
  return true
}

/** Passenger haritası / nearest: yalnızca gerçek UUID + taze GPS */
export function qualifiesForPassengerMap(driver) {
  if (!driver || !isSupabaseDriverId(driver.id)) return false
  if (!isValidMapCoords(driver.lat, driver.lng)) return false
  if (!isFreshLocation(driver.lastLocationAt)) return false
  return true
}

export const useDriverStore = defineStore('driver', () => {
  const authStore = useAuthStore()

  const driver = ref(null)
  const vehicle = ref(null)
  const loading = ref(false)
  const saving = ref(false)
  const loaded = ref(false)
  const errorMessage = ref('')
  const locationError = ref('')
  const locationSharing = ref(false)

  const onlineDrivers = ref([])
  const onlineDriversLoading = ref(false)
  const onlineDriversError = ref('')

  let watchId = null
  let lastUploadAt = 0
  let lastUploadedCoords = null
  let onlineChannel = null
  let stalePruneTimer = null
  let onlineRefreshTimer = null

  const needsOnboarding = computed(() => {
    if (authStore.currentRole !== 'driver') return false
    if (!loaded.value) return false
    return !driver.value || !vehicle.value
  })

  const isOnline = computed(() => Boolean(driver.value?.isOnline))

  const vehicleLabel = computed(() => {
    if (!vehicle.value) return '—'
    const parts = [vehicle.value.brand, vehicle.value.model].filter(Boolean)
    if (parts.length) return parts.join(' ')
    return vehicle.value.vehicleType || '—'
  })

  async function ensureLoaded(force = false) {
    if (authStore.currentRole !== 'driver') {
      stopLocationWatch()
      driver.value = null
      vehicle.value = null
      loaded.value = false
      errorMessage.value = ''
      locationError.value = ''
      locationSharing.value = false
      return null
    }
    if (loaded.value && !force) return { driver: driver.value, vehicle: vehicle.value }
    return loadDriverData()
  }

  function resetLocal() {
    stopLocationWatch()
    unsubscribeDriverLocations()
    driver.value = null
    vehicle.value = null
    loaded.value = false
    errorMessage.value = ''
    locationError.value = ''
    locationSharing.value = false
    onlineDrivers.value = []
    onlineDriversError.value = ''
  }

  async function loadDriverData() {
    if (authStore.currentRole !== 'driver' || !authStore.user?.id) {
      stopLocationWatch()
      driver.value = null
      vehicle.value = null
      loaded.value = false
      return null
    }

    loading.value = true
    errorMessage.value = ''
    try {
      const userId = authStore.user.id

      const { data: driverRow, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (driverError) throw driverError

      driver.value = mapDriver(driverRow)

      let vehicleRow = null
      if (driverRow) {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .eq('driver_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        vehicleRow = data
      }

      vehicle.value = mapVehicle(vehicleRow)
      loaded.value = true

      if (driver.value?.isOnline) {
        startLocationWatch()
      } else {
        stopLocationWatch()
      }

      return { driver: driver.value, vehicle: vehicle.value }
    } catch (err) {
      errorMessage.value = mapAuthError(err)
      loaded.value = true
      throw new Error(errorMessage.value)
    } finally {
      loading.value = false
    }
  }

  async function completeOnboarding({
    vehicleType,
    brand = '',
    model = '',
    color = '',
    plate = '',
  }) {
    if (authStore.currentRole !== 'driver' || !authStore.user?.id) {
      throw new Error('Yalnızca sürücü hesapları araç kaydı yapabilir.')
    }

    const type = String(vehicleType || '').trim()
    const plateValue = String(plate || '').trim()
    if (!type) throw new Error('Araç tipi gerekli.')
    if (!plateValue) throw new Error('Plaka gerekli.')

    saving.value = true
    errorMessage.value = ''
    try {
      const userId = authStore.user.id

      const { data: driverRow, error: driverError } = await supabase
        .from('drivers')
        .upsert(
          {
            id: userId,
            is_online: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        .select('*')
        .single()
      if (driverError) throw driverError

      await supabase
        .from('vehicles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('driver_id', userId)
        .eq('is_active', true)

      const { data: vehicleRow, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          driver_id: userId,
          vehicle_type: type,
          brand: brand.trim() || null,
          model: model.trim() || null,
          color: color.trim() || null,
          plate: plateValue,
          is_active: true,
        })
        .select('*')
        .single()
      if (vehicleError) throw vehicleError

      driver.value = mapDriver(driverRow)
      vehicle.value = mapVehicle(vehicleRow)
      loaded.value = true
      return { driver: driver.value, vehicle: vehicle.value }
    } catch (err) {
      errorMessage.value = mapAuthError(err)
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  async function setOnline(nextOnline) {
    if (!driver.value?.id) {
      throw new Error('Önce sürücü onboarding tamamlanmalı.')
    }

    saving.value = true
    errorMessage.value = ''
    locationError.value = ''
    try {
      if (nextOnline) {
        if (!('geolocation' in navigator)) {
          throw new Error('Tarayıcın konum (GPS) desteklemiyor.')
        }
      }

      const { data, error } = await supabase
        .from('drivers')
        .update({
          is_online: Boolean(nextOnline),
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.value.id)
        .select('*')
        .single()
      if (error) throw error

      driver.value = mapDriver(data)

      if (nextOnline) {
        startLocationWatch()
      } else {
        stopLocationWatch()
      }

      return driver.value
    } catch (err) {
      errorMessage.value = mapAuthError(err)
      throw new Error(errorMessage.value)
    } finally {
      saving.value = false
    }
  }

  function startLocationWatch() {
    if (!('geolocation' in navigator)) {
      locationError.value = 'Tarayıcın konum (GPS) desteklemiyor.'
      locationSharing.value = false
      return
    }

    stopLocationWatch(false)
    locationError.value = ''
    locationSharing.value = true

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        locationSharing.value = true
        locationError.value = ''
        void maybeUploadLocation(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        locationSharing.value = false
        if (err?.code === 1) {
          locationError.value =
            'Konum izni reddedildi. Tarayıcı ayarlarından konum iznini aç.'
        } else if (err?.code === 2) {
          locationError.value = 'Konum alınamadı. GPS / ağ konumunu kontrol et.'
        } else if (err?.code === 3) {
          locationError.value = 'Konum zaman aşımına uğradı. Tekrar dene.'
        } else {
          locationError.value = 'Konum alınamadı.'
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      },
    )
  }

  function stopLocationWatch(updateFlag = true) {
    if (watchId != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId)
    }
    watchId = null
    if (updateFlag) locationSharing.value = false
  }

  async function maybeUploadLocation(lat, lng) {
    if (!driver.value?.id || !driver.value.isOnline) return

    const now = Date.now()
    if (now - lastUploadAt < LOCATION_THROTTLE_MS) return

    if (
      lastUploadedCoords &&
      Math.abs(lastUploadedCoords.lat - lat) < MIN_MOVE_DEG &&
      Math.abs(lastUploadedCoords.lng - lng) < MIN_MOVE_DEG
    ) {
      return
    }

    lastUploadAt = now
    lastUploadedCoords = { lat, lng }

    const { data, error } = await supabase
      .from('drivers')
      .update({
        last_lat: lat,
        last_lng: lng,
        last_location_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', driver.value.id)
      .select('*')
      .single()

    if (error) {
      locationError.value = mapAuthError(error)
      return
    }

    driver.value = mapDriver(data)
  }

  function formatLastLocation() {
    if (!driver.value?.lastLocationAt) return null
    try {
      return new Date(driver.value.lastLocationAt).toLocaleString('tr-TR')
    } catch {
      return driver.value.lastLocationAt
    }
  }

  function pruneStaleOnlineDrivers() {
    onlineDrivers.value = onlineDrivers.value.filter(qualifiesForPassengerMap)
  }

  function startStalePrune() {
    if (stalePruneTimer) return
    stalePruneTimer = setInterval(pruneStaleOnlineDrivers, STALE_PRUNE_MS)
  }

  function stopStalePrune() {
    if (stalePruneTimer) {
      clearInterval(stalePruneTimer)
      stalePruneTimer = null
    }
  }

  function startOnlineRefresh() {
    if (onlineRefreshTimer) return
    onlineRefreshTimer = setInterval(() => {
      void fetchOnlineDrivers({ quiet: true })
    }, ONLINE_REFRESH_MS)
  }

  function stopOnlineRefresh() {
    if (onlineRefreshTimer) {
      clearInterval(onlineRefreshTimer)
      onlineRefreshTimer = null
    }
  }

  /**
   * Passenger haritası TEK kaynağı.
   * Mock / nearbyDrivers / LocalStorage asla buraya yazılmaz.
   */
  async function fetchOnlineDrivers({ quiet = false } = {}) {
    if (!quiet) {
      onlineDriversLoading.value = true
      onlineDriversError.value = ''
    }
    try {
      if (!authStore.isAuthenticated) {
        onlineDrivers.value = []
        return []
      }

      const { data, error } = await supabase.rpc('get_online_drivers_for_map')
      if (error) throw error

      onlineDrivers.value = (data || [])
        .map(mapOnlineDriverRow)
        .filter(Boolean)
        .filter(qualifiesForPassengerMap)

      return onlineDrivers.value
    } catch (err) {
      if (!quiet) {
        onlineDriversError.value =
          mapAuthError(err) || 'Çevrimiçi sürücüler yüklenemedi.'
      }
      // Hata durumunda mock'a düşme — listeyi boşalt
      onlineDrivers.value = []
      return []
    } finally {
      if (!quiet) onlineDriversLoading.value = false
    }
  }

  function upsertOnlineDriverFromRealtime(row) {
    if (!row?.id || !isSupabaseDriverId(row.id)) return

    // Offline → marker hemen kalkar (Realtime)
    if (!row.is_online) {
      onlineDrivers.value = onlineDrivers.value.filter((d) => d.id !== row.id)
      return
    }

    const mapped = mapOnlineDriverRow({
      id: row.id,
      name: null,
      rating: row.rating,
      vehicle_type: null,
      lat: row.last_lat,
      lng: row.last_lng,
      last_location_at: row.last_location_at,
    })

    if (!mapped || !qualifiesForPassengerMap(mapped)) {
      onlineDrivers.value = onlineDrivers.value.filter((d) => d.id !== row.id)
      return
    }

    const idx = onlineDrivers.value.findIndex((d) => d.id === row.id)
    if (idx >= 0) {
      const prev = onlineDrivers.value[idx]
      const next = {
        ...prev,
        lat: mapped.lat,
        lng: mapped.lng,
        lastLocationAt: mapped.lastLocationAt,
        rating: Number.isFinite(mapped.rating) ? mapped.rating : prev.rating,
      }
      const copy = onlineDrivers.value.slice()
      copy[idx] = next
      onlineDrivers.value = copy
      return
    }

    // Yeni sürücü: role/vehicle doğrulaması için RPC (mock eklenmez)
    void fetchOnlineDrivers({ quiet: true })
  }

  function handleDriversRealtime(payload) {
    const event = payload?.eventType || payload?.event
    if (event === 'DELETE') {
      const oldId = payload?.old?.id
      if (oldId && isSupabaseDriverId(oldId)) {
        onlineDrivers.value = onlineDrivers.value.filter((d) => d.id !== oldId)
      }
      return
    }

    const row = payload?.new
    if (!row) {
      void fetchOnlineDrivers({ quiet: true })
      return
    }

    upsertOnlineDriverFromRealtime(row)
  }

  function subscribeToDriverLocations() {
    if (onlineChannel) return onlineChannel

    onlineChannel = supabase
      .channel(ONLINE_CHANNEL)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers' },
        handleDriversRealtime,
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onlineDriversError.value =
            'Canlı konum bağlantısı koptu. Harita çalışmaya devam ediyor.'
          void fetchOnlineDrivers({ quiet: true })
        }
      })

    startStalePrune()
    startOnlineRefresh()
    return onlineChannel
  }

  async function unsubscribeDriverLocations() {
    stopStalePrune()
    stopOnlineRefresh()
    if (!onlineChannel) return
    const ch = onlineChannel
    onlineChannel = null
    try {
      await supabase.removeChannel(ch)
    } catch {
      // ignore cleanup errors
    }
  }

  return {
    driver,
    vehicle,
    loading,
    saving,
    loaded,
    errorMessage,
    locationError,
    locationSharing,
    onlineDrivers,
    onlineDriversLoading,
    onlineDriversError,
    needsOnboarding,
    isOnline,
    vehicleLabel,
    ensureLoaded,
    loadDriverData,
    completeOnboarding,
    setOnline,
    startLocationWatch,
    stopLocationWatch,
    formatLastLocation,
    resetLocal,
    fetchOnlineDrivers,
    subscribeToDriverLocations,
    unsubscribeDriverLocations,
    VEHICLE_TYPES,
    DRIVER_LOCATION_STALE_MS,
  }
})
