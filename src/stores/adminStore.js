import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mapAuthError, supabase } from '@/lib/supabase'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export const useAdminStore = defineStore('admin', () => {
  const loading = ref(false)
  const errorMessage = ref('')

  const stats = ref(null)
  const users = ref([])
  const drivers = ref([])
  const rides = ref([])
  const commissions = ref([])
  const driverFinancials = ref([])

  async function loadAll({ commissionStatus = 'all' } = {}) {
    loading.value = true
    errorMessage.value = ''
    try {
      await Promise.all([
        fetchStats(),
        fetchUsers(),
        fetchDrivers(),
        fetchRides(),
        fetchCommissions(commissionStatus),
        fetchDriverFinancials(),
      ])
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Admin verileri yüklenemedi.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    const { data, error } = await supabase.rpc('get_admin_dashboard_stats')
    if (error) throw error
    const row = typeof data === 'string' ? JSON.parse(data) : data
    stats.value = {
      totalUsers: num(row?.total_users),
      totalPassengers: num(row?.total_passengers),
      totalDrivers: num(row?.total_drivers),
      onlineDrivers: num(row?.online_drivers),
      totalRides: num(row?.total_rides),
      completedRides: num(row?.completed_rides),
      cancelledRides: num(row?.cancelled_rides),
      totalFareAmount: num(row?.total_fare_amount),
      totalCommission: num(row?.total_commission),
      totalDriverNet: num(row?.total_driver_net),
      pendingCommission: num(row?.pending_commission),
      collectedCommission: num(row?.collected_commission),
    }
    return stats.value
  }

  async function fetchUsers() {
    const { data, error } = await supabase.rpc('get_admin_users')
    if (error) throw error
    users.value = (data || []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      role: row.role,
      createdAt: row.created_at,
    }))
    return users.value
  }

  async function fetchDrivers() {
    const { data, error } = await supabase.rpc('get_admin_drivers')
    if (error) throw error
    drivers.value = (data || []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      isOnline: Boolean(row.is_online),
      rating: num(row.rating),
      completedTrips: num(row.completed_trips),
      vehicleType: row.vehicle_type || '—',
      brand: row.brand || '',
      model: row.model || '',
      plate: row.plate || '—',
      lastLocationAt: row.last_location_at,
      lastLat: row.last_lat,
      lastLng: row.last_lng,
    }))
    return drivers.value
  }

  async function fetchRides() {
    const { data, error } = await supabase.rpc('get_admin_rides')
    if (error) throw error
    rides.value = (data || []).map((row) => ({
      id: row.id,
      passengerName: row.passenger_name,
      driverName: row.driver_name || '—',
      from: row.from_label,
      to: row.to_label,
      status: row.status,
      tripPhase: row.trip_phase,
      estimatedFare: num(row.estimated_fare),
      grossFare: num(row.gross_fare),
      commissionAmount: num(row.commission_amount),
      driverNetAmount: num(row.driver_net_amount),
      commissionStatus: row.commission_status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }))
    return rides.value
  }

  async function fetchCommissions(status = 'all') {
    const { data, error } = await supabase.rpc('get_admin_commissions', {
      p_status: status === 'all' ? null : status,
    })
    if (error) throw error
    commissions.value = (data || []).map((row) => ({
      id: row.id,
      completedAt: row.completed_at,
      passengerName: row.passenger_name,
      driverName: row.driver_name || '—',
      from: row.from_label,
      to: row.to_label,
      grossFare: num(row.gross_fare),
      commissionRate: num(row.commission_rate),
      commissionAmount: num(row.commission_amount),
      driverNetAmount: num(row.driver_net_amount),
      commissionStatus: row.commission_status,
    }))
    return commissions.value
  }

  async function fetchDriverFinancials() {
    const { data, error } = await supabase.rpc('get_admin_driver_financials')
    if (error) throw error
    driverFinancials.value = (data || []).map((row) => ({
      driverId: row.driver_id,
      driverName: row.driver_name,
      completedRides: num(row.completed_rides),
      totalGross: num(row.total_gross),
      totalCommission: num(row.total_commission),
      totalNet: num(row.total_net),
    }))
    return driverFinancials.value
  }

  function resetLocal() {
    stats.value = null
    users.value = []
    drivers.value = []
    rides.value = []
    commissions.value = []
    driverFinancials.value = []
    errorMessage.value = ''
    loading.value = false
  }

  return {
    loading,
    errorMessage,
    stats,
    users,
    drivers,
    rides,
    commissions,
    driverFinancials,
    loadAll,
    fetchStats,
    fetchUsers,
    fetchDrivers,
    fetchRides,
    fetchCommissions,
    fetchDriverFinancials,
    resetLocal,
  }
})
