import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mapAuthError, supabase } from '@/lib/supabase'

function num(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function mapHistoryRow(row) {
  if (!row) return null
  return {
    id: row.id,
    passengerName: row.passenger_name || '—',
    driverName: row.driver_name || '—',
    from: row.from_label,
    to: row.to_label,
    status: row.status,
    distanceKm: num(row.distance_km),
    durationMin: num(row.duration_min),
    estimatedFare: num(row.estimated_fare),
    grossFare: num(row.gross_fare),
    commissionRate: num(row.commission_rate),
    commissionAmount: num(row.commission_amount),
    driverNetAmount: num(row.driver_net_amount),
    createdAt: row.created_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at,
    route: row.route || [],
  }
}

function mapStats(data) {
  const row = typeof data === 'string' ? JSON.parse(data) : data || {}
  return {
    role: row.role || null,
    userId: row.user_id || null,
    fullName: row.full_name || null,
    totalRides: Number(row.total_rides) || 0,
    completedRides: Number(row.completed_rides) || 0,
    cancelledRides: Number(row.cancelled_rides) || 0,
    totalGross: Number(row.total_gross) || 0,
    totalCommission: Number(row.total_commission) || 0,
    totalNet: Number(row.total_net) || 0,
  }
}

export const useHistoryStore = defineStore('history', () => {
  const loading = ref(false)
  const errorMessage = ref('')
  const items = ref([])
  const stats = ref(null)

  const adminLoading = ref(false)
  const adminError = ref('')
  const adminUserStats = ref(null)
  const adminUserHistory = ref([])

  async function fetchMyHistory(status = 'all') {
    loading.value = true
    errorMessage.value = ''
    try {
      const { data, error } = await supabase.rpc('get_my_ride_history', {
        p_status: status === 'all' ? null : status,
      })
      if (error) throw error
      items.value = (data || []).map(mapHistoryRow).filter(Boolean)
      return items.value
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'Geçmiş yüklenemedi.'
      items.value = []
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchMyStats() {
    try {
      const { data, error } = await supabase.rpc('get_my_ride_history_stats')
      if (error) throw error
      stats.value = mapStats(data)
      return stats.value
    } catch (err) {
      errorMessage.value = mapAuthError(err) || 'İstatistikler yüklenemedi.'
      stats.value = null
      return null
    }
  }

  async function fetchAdminUserHistory(userId, status = 'all') {
    adminLoading.value = true
    adminError.value = ''
    try {
      const [statsRes, histRes] = await Promise.all([
        supabase.rpc('get_admin_user_ride_stats', {
          target_user_id: userId,
        }),
        supabase.rpc('get_admin_user_ride_history', {
          target_user_id: userId,
          p_status: status === 'all' ? null : status,
        }),
      ])
      if (statsRes.error) throw statsRes.error
      if (histRes.error) throw histRes.error

      adminUserStats.value = mapStats(statsRes.data)
      adminUserHistory.value = (histRes.data || [])
        .map(mapHistoryRow)
        .filter(Boolean)
      return {
        stats: adminUserStats.value,
        history: adminUserHistory.value,
      }
    } catch (err) {
      adminError.value = mapAuthError(err) || 'Kullanıcı geçmişi yüklenemedi.'
      adminUserStats.value = null
      adminUserHistory.value = []
      throw err
    } finally {
      adminLoading.value = false
    }
  }

  function clearAdminSelection() {
    adminUserStats.value = null
    adminUserHistory.value = []
    adminError.value = ''
  }

  function resetLocal() {
    items.value = []
    stats.value = null
    errorMessage.value = ''
    loading.value = false
    clearAdminSelection()
    adminLoading.value = false
  }

  return {
    loading,
    errorMessage,
    items,
    stats,
    adminLoading,
    adminError,
    adminUserStats,
    adminUserHistory,
    fetchMyHistory,
    fetchMyStats,
    fetchAdminUserHistory,
    clearAdminSelection,
    resetLocal,
  }
})
