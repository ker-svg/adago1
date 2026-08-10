import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { mapAuthError, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export const VEHICLE_TYPES = ['Sedan', 'Hatchback', 'SUV', 'Minivan']

const LOCATION_THROTTLE_MS = 4000
const MIN_MOVE_DEG = 0.00008 // ~9m civarı; daha küçük hareketleri atla

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

  let watchId = null
  let lastUploadAt = 0
  let lastUploadedCoords = null

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
      resetLocal()
      return null
    }
    if (loaded.value && !force) return { driver: driver.value, vehicle: vehicle.value }
    return loadDriverData()
  }

  function resetLocal() {
    stopLocationWatch()
    driver.value = null
    vehicle.value = null
    loaded.value = false
    errorMessage.value = ''
    locationError.value = ''
    locationSharing.value = false
  }

  async function loadDriverData() {
    if (authStore.currentRole !== 'driver' || !authStore.user?.id) {
      resetLocal()
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

      // Eski aktif araçları pasifleştir
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

  return {
    driver,
    vehicle,
    loading,
    saving,
    loaded,
    errorMessage,
    locationError,
    locationSharing,
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
    VEHICLE_TYPES,
  }
})
