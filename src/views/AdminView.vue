<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand-block">
        <span class="brand-dot" />
        <div>
          <div class="brand">AdaGo</div>
          <div class="brand-sub">Yönetim Paneli</div>
        </div>
      </div>

      <nav class="nav-list">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="nav-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <v-icon :icon="tab.icon" size="18" class="mr-2" />
          {{ tab.label }}
        </button>
      </nav>

      <button type="button" class="logout-btn" @click="handleLogout">
        Çıkış
      </button>
    </aside>

    <main class="admin-main">
      <header class="admin-header">
        <div>
          <h1 class="page-title">{{ currentTabLabel }}</h1>
          <p class="page-sub">Gerçek Supabase verileri · RLS korumalı</p>
        </div>
        <v-btn
          color="primary"
          variant="flat"
          :loading="adminStore.loading"
          @click="refresh"
        >
          Yenile
        </v-btn>
      </header>

      <v-alert
        v-if="adminStore.errorMessage"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
        @click:close="adminStore.errorMessage = ''"
      >
        {{ adminStore.errorMessage }}
      </v-alert>

      <div v-if="adminStore.loading && !adminStore.stats" class="loading-box">
        <v-progress-circular indeterminate color="primary" />
        <span>Veriler yükleniyor...</span>
      </div>

      <template v-else>
        <!-- Dashboard -->
        <section v-if="activeTab === 'dashboard'" class="section">
          <div class="stat-grid">
            <div v-for="card in dashboardCards" :key="card.label" class="stat-card">
              <div class="stat-label">{{ card.label }}</div>
              <div class="stat-value">{{ card.value }}</div>
            </div>
          </div>
        </section>

        <!-- Users -->
        <section v-else-if="activeTab === 'users'" class="section">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Rol</th>
                  <th>Kayıt tarihi</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="adminStore.users.length === 0">
                  <td colspan="4" class="empty">Kayıtlı kullanıcı yok.</td>
                </tr>
                <tr v-for="user in adminStore.users" :key="user.id">
                  <td>{{ user.fullName }}</td>
                  <td>
                    <span class="pill" :class="user.role">{{ roleLabel(user.role) }}</span>
                  </td>
                  <td>{{ formatDate(user.createdAt) }}</td>
                  <td>
                    <v-btn
                      v-if="user.role !== 'admin'"
                      size="small"
                      variant="tonal"
                      color="primary"
                      :loading="historyLoadingId === user.id"
                      @click="openUserHistory(user)"
                    >
                      Geçmişi Gör
                    </v-btn>
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Drivers -->
        <section v-else-if="activeTab === 'drivers'" class="section">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sürücü</th>
                  <th>Durum</th>
                  <th>Rating</th>
                  <th>Tamamlanan</th>
                  <th>Araç</th>
                  <th>Plaka</th>
                  <th>Son konum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="adminStore.drivers.length === 0">
                  <td colspan="8" class="empty">Kayıtlı sürücü yok.</td>
                </tr>
                <tr v-for="driver in adminStore.drivers" :key="driver.id">
                  <td>{{ driver.fullName }}</td>
                  <td>
                    <span class="pill" :class="driver.isOnline ? 'online' : 'offline'">
                      {{ driver.isOnline ? 'Online' : 'Offline' }}
                    </span>
                  </td>
                  <td>{{ driver.rating }}</td>
                  <td>{{ driver.completedTrips }}</td>
                  <td>
                    {{ driver.vehicleType }}
                    <span v-if="driver.brand || driver.model" class="muted">
                      · {{ [driver.brand, driver.model].filter(Boolean).join(' ') }}
                    </span>
                  </td>
                  <td>{{ driver.plate }}</td>
                  <td>{{ formatDate(driver.lastLocationAt) }}</td>
                  <td>
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      :loading="historyLoadingId === driver.id"
                      @click="openDriverHistory(driver)"
                    >
                      Yolculuklar
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Rides -->
        <section v-else-if="activeTab === 'rides'" class="section">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Yolcu</th>
                  <th>Sürücü</th>
                  <th>Rota</th>
                  <th>Durum</th>
                  <th>Faz</th>
                  <th>Ücret</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="adminStore.rides.length === 0">
                  <td colspan="7" class="empty">Yolculuk yok.</td>
                </tr>
                <tr v-for="ride in adminStore.rides" :key="ride.id">
                  <td>{{ formatDate(ride.createdAt) }}</td>
                  <td>{{ ride.passengerName }}</td>
                  <td>{{ ride.driverName }}</td>
                  <td>{{ ride.from }} → {{ ride.to }}</td>
                  <td>
                    <span class="pill status">{{ statusLabel(ride.status) }}</span>
                  </td>
                  <td>
                    <span class="pill phase">{{ tripPhaseLabel(ride.tripPhase) }}</span>
                  </td>
                  <td>
                    {{
                      ride.status === 'completed'
                        ? formatMoney(ride.grossFare)
                        : formatMoney(ride.estimatedFare)
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Commissions -->
        <section v-else-if="activeTab === 'commissions'" class="section">
          <div class="filter-row">
            <label for="commission-filter">Komisyon durumu</label>
            <select
              id="commission-filter"
              v-model="commissionFilter"
              @change="onCommissionFilter"
            >
              <option value="all">Tümü</option>
              <option value="pending">Bekleyen</option>
              <option value="collected">Tahsil edildi</option>
            </select>
          </div>

          <h2 class="block-title">Ride bazlı komisyonlar (%5)</h2>
          <div class="table-wrap mb">
            <table>
              <thead>
                <tr>
                  <th>Yolculuk</th>
                  <th>Tarih</th>
                  <th>Yolcu</th>
                  <th>Sürücü</th>
                  <th>Rota</th>
                  <th>Brüt</th>
                  <th>Oran</th>
                  <th>AdaGo</th>
                  <th>Sürücü net</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="adminStore.commissions.length === 0">
                  <td colspan="10" class="empty">Tamamlanan komisyon yok.</td>
                </tr>
                <tr v-for="row in adminStore.commissions" :key="row.id">
                  <td class="mono">{{ shortId(row.id) }}</td>
                  <td>{{ formatDate(row.completedAt) }}</td>
                  <td>{{ row.passengerName }}</td>
                  <td>{{ row.driverName }}</td>
                  <td>{{ row.from }} → {{ row.to }}</td>
                  <td>{{ formatMoney(row.grossFare) }}</td>
                  <td>%{{ Math.round((row.commissionRate || 0.05) * 100) }}</td>
                  <td class="accent">{{ formatMoney(row.commissionAmount) }}</td>
                  <td>{{ formatMoney(row.driverNetAmount) }}</td>
                  <td>
                    <span class="pill" :class="row.commissionStatus">
                      {{ commissionStatusLabel(row.commissionStatus) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 class="block-title">Sürücü finans özeti</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sürücü</th>
                  <th>Tamamlanan</th>
                  <th>Toplam brüt</th>
                  <th>Toplam AdaGo komisyonu</th>
                  <th>Toplam sürücü net</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="adminStore.driverFinancials.length === 0">
                  <td colspan="5" class="empty">Finans verisi yok.</td>
                </tr>
                <tr
                  v-for="row in adminStore.driverFinancials"
                  :key="row.driverId"
                >
                  <td>{{ row.driverName }}</td>
                  <td>{{ row.completedRides }}</td>
                  <td>{{ formatMoney(row.totalGross) }}</td>
                  <td class="accent">{{ formatMoney(row.totalCommission) }}</td>
                  <td>{{ formatMoney(row.totalNet) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </main>

    <v-dialog v-model="historyDialog" max-width="920" scrollable>
      <v-card class="history-dialog">
        <v-card-title class="dialog-title">
          {{ historyTitle }}
        </v-card-title>
        <v-card-subtitle v-if="historyStore.adminUserStats">
          {{ roleLabel(historyStore.adminUserStats.role) }}
          · Toplam {{ historyStore.adminUserStats.totalRides }}
          · Tamamlanan {{ historyStore.adminUserStats.completedRides }}
          · İptal {{ historyStore.adminUserStats.cancelledRides }}
          <template v-if="historyStore.adminUserStats.role === 'driver'">
            · Brüt {{ formatMoney(historyStore.adminUserStats.totalGross) }}
            · AdaGo {{ formatMoney(historyStore.adminUserStats.totalCommission) }}
            · Net {{ formatMoney(historyStore.adminUserStats.totalNet) }}
          </template>
        </v-card-subtitle>

        <v-card-text>
          <v-alert
            v-if="historyStore.adminError"
            type="error"
            variant="tonal"
            class="mb-3"
          >
            {{ historyStore.adminError }}
          </v-alert>

          <div v-if="historyStore.adminLoading" class="loading-box">
            <v-progress-circular indeterminate color="primary" size="24" />
            <span>Geçmiş yükleniyor...</span>
          </div>

          <div
            v-else-if="historyStore.adminUserHistory.length === 0"
            class="empty dialog-empty"
          >
            Bu kullanıcının henüz yolculuk kaydı yok.
          </div>

          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Rota</th>
                  <th>Yolcu</th>
                  <th>Sürücü</th>
                  <th>Durum</th>
                  <th>Mesafe</th>
                  <th>Ücret</th>
                  <th>Komisyon</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="ride in historyStore.adminUserHistory"
                  :key="ride.id"
                >
                  <td>{{ formatDate(ride.completedAt || ride.cancelledAt || ride.createdAt) }}</td>
                  <td>{{ ride.from }} → {{ ride.to }}</td>
                  <td>{{ ride.passengerName }}</td>
                  <td>{{ ride.driverName }}</td>
                  <td>
                    <span class="pill status">{{ statusLabel(ride.status) }}</span>
                  </td>
                  <td>{{ ride.distanceKm != null ? `${ride.distanceKm} km` : '—' }}</td>
                  <td>
                    {{
                      formatMoney(
                        ride.status === 'completed' && ride.grossFare != null
                          ? ride.grossFare
                          : ride.estimatedFare,
                      )
                    }}
                  </td>
                  <td class="accent">
                    {{
                      ride.status === 'completed'
                        ? formatMoney(ride.commissionAmount)
                        : '—'
                    }}
                  </td>
                  <td>
                    {{
                      ride.status === 'completed'
                        ? formatMoney(ride.driverNetAmount)
                        : '—'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeHistory">Kapat</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useAdminStore } from '@/stores/adminStore'
import { useHistoryStore } from '@/stores/historyStore'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const historyStore = useHistoryStore()

const activeTab = ref('dashboard')
const commissionFilter = ref('all')
const historyDialog = ref(false)
const historyTitle = ref('')
const historyLoadingId = ref(null)

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'mdi-view-dashboard' },
  { id: 'users', label: 'Kullanıcılar', icon: 'mdi-account-group' },
  { id: 'drivers', label: 'Sürücüler', icon: 'mdi-car' },
  { id: 'rides', label: 'Yolculuklar', icon: 'mdi-map-marker-path' },
  { id: 'commissions', label: 'Komisyonlar', icon: 'mdi-cash-multiple' },
]

const currentTabLabel = computed(
  () => tabs.find((t) => t.id === activeTab.value)?.label || 'Admin',
)

const dashboardCards = computed(() => {
  const s = adminStore.stats || {}
  return [
    { label: 'Toplam kullanıcı', value: s.totalUsers ?? 0 },
    { label: 'Toplam yolcu', value: s.totalPassengers ?? 0 },
    { label: 'Toplam sürücü', value: s.totalDrivers ?? 0 },
    { label: 'Online sürücü', value: s.onlineDrivers ?? 0 },
    { label: 'Toplam yolculuk', value: s.totalRides ?? 0 },
    { label: 'Tamamlanan', value: s.completedRides ?? 0 },
    { label: 'İptal edilen', value: s.cancelledRides ?? 0 },
    { label: 'Toplam yolculuk tutarı', value: formatMoney(s.totalFareAmount) },
    { label: 'Toplam AdaGo komisyonu', value: formatMoney(s.totalCommission) },
    { label: 'Sürücülere kalan toplam', value: formatMoney(s.totalDriverNet) },
    { label: 'Bekleyen komisyon', value: formatMoney(s.pendingCommission) },
    { label: 'Tahsil edilen komisyon', value: formatMoney(s.collectedCommission) },
  ]
})

onMounted(async () => {
  if (authStore.currentRole !== 'admin') {
    await router.replace('/admin/login')
    return
  }
  try {
    await adminStore.loadAll({ commissionStatus: commissionFilter.value })
  } catch {
    // errorMessage store'da
  }
})

async function refresh() {
  try {
    await adminStore.loadAll({ commissionStatus: commissionFilter.value })
  } catch {
    // shown via alert
  }
}

async function onCommissionFilter() {
  try {
    await adminStore.fetchCommissions(commissionFilter.value)
  } catch {
    // shown via alert
  }
}

async function openUserHistory(user) {
  historyLoadingId.value = user.id
  historyTitle.value = `${user.fullName} — yolculuk geçmişi`
  historyDialog.value = true
  try {
    await historyStore.fetchAdminUserHistory(user.id)
  } catch {
    // adminError store'da
  } finally {
    historyLoadingId.value = null
  }
}

async function openDriverHistory(driver) {
  historyLoadingId.value = driver.id
  historyTitle.value = `${driver.fullName} — yolculuklar`
  historyDialog.value = true
  try {
    await historyStore.fetchAdminUserHistory(driver.id)
  } catch {
    // adminError store'da
  } finally {
    historyLoadingId.value = null
  }
}

function closeHistory() {
  historyDialog.value = false
  historyStore.clearAdminSelection()
}

async function handleLogout() {
  adminStore.resetLocal()
  historyStore.resetLocal()
  try {
    await authStore.signOut()
  } finally {
    router.push('/admin/login')
  }
}

function roleLabel(role) {
  if (role === 'passenger') return 'Yolcu'
  if (role === 'driver') return 'Sürücü'
  if (role === 'admin') return 'Admin'
  return role
}

function statusLabel(status) {
  const map = {
    pending: 'Bekliyor',
    accepted: 'Kabul Edildi',
    completed: 'Tamamlandı',
    cancelled: 'İptal Edildi',
  }
  return map[status] || status
}

function tripPhaseLabel(phase) {
  const map = {
    assigning: 'Sürücü aranıyor',
    en_route: 'Sürücü yolda',
    arrived: 'Sürücü geldi',
    passenger_onboard: 'Yolcu alındı',
    in_progress: 'Yolculuk devam ediyor',
    completed: 'Tamamlandı',
  }
  return map[phase] || phase || '—'
}

function commissionStatusLabel(status) {
  if (status === 'pending') return 'Bekleyen'
  if (status === 'collected') return 'Tahsil edildi'
  return status || '—'
}

function formatMoney(value) {
  const n = Number(value) || 0
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`
}

function formatDate(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('tr-TR')
  } catch {
    return value
  }
}

function shortId(id) {
  if (!id) return '—'
  return String(id).slice(0, 8)
}
</script>

<style scoped>
.admin-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 240px 1fr;
  background: #f3f5f6;
  color: #0a1628;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

.admin-sidebar {
  background: #0a1628;
  color: #fff;
  padding: 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.25);
}

.brand {
  font-weight: 800;
  letter-spacing: -0.04em;
  font-size: 1.15rem;
}

.brand-sub {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.55);
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  text-align: left;
  padding: 11px 12px;
  border-radius: 12px;
  font-weight: 650;
  font-size: 0.9rem;
  cursor: pointer;
}

.nav-item.active,
.nav-item:hover {
  background: rgba(16, 185, 129, 0.16);
  color: #fff;
}

.nav-item.active {
  box-shadow: inset 3px 0 0 #10b981;
}

.logout-btn {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: transparent;
  color: #fff;
  border-radius: 12px;
  padding: 10px;
  font-weight: 700;
  cursor: pointer;
}

.admin-main {
  padding: 24px;
  overflow: auto;
}

.admin-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-title {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.page-sub {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.85rem;
}

.loading-box {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: #6b7280;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid #e8ecef;
  box-shadow: 0 8px 20px rgba(10, 22, 40, 0.04);
}

.stat-label {
  font-size: 0.78rem;
  color: #6b7280;
  font-weight: 650;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0a1628;
}

.table-wrap {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e8ecef;
  overflow: auto;
}

.table-wrap.mb {
  margin-bottom: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

th,
td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #f0f2f4;
  font-size: 0.86rem;
}

th {
  background: #f8fafb;
  color: #4b5563;
  font-weight: 700;
  white-space: nowrap;
}

.empty {
  text-align: center;
  color: #9ca3af;
  padding: 28px !important;
}

.pill {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: #eef2f7;
  color: #334155;
}

.pill.passenger {
  background: #ecfdf5;
  color: #065f46;
}

.pill.driver {
  background: #eff6ff;
  color: #1d4ed8;
}

.pill.admin {
  background: #0a1628;
  color: #10b981;
}

.pill.online {
  background: #d1fae5;
  color: #047857;
}

.pill.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.pill.status {
  background: #eef2ff;
  color: #3730a3;
}

.pill.phase {
  background: #ecfdf5;
  color: #065f46;
}

.pill.pending {
  background: #fff7ed;
  color: #9a3412;
}

.pill.collected {
  background: #ecfdf5;
  color: #065f46;
}

.muted {
  color: #9ca3af;
}

.history-dialog {
  border-radius: 18px !important;
}

.dialog-title {
  font-weight: 800 !important;
  color: #0a1628;
}

.dialog-empty {
  text-align: center;
  padding: 28px !important;
  color: #9ca3af;
}

.accent {
  color: #059669;
  font-weight: 700;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.filter-row label {
  font-size: 0.85rem;
  font-weight: 700;
}

.filter-row select {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
}

.block-title {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 800;
}

@media (max-width: 900px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: sticky;
    top: 0;
    z-index: 20;
    padding: 12px;
  }

  .nav-list {
    flex-direction: row;
    overflow-x: auto;
    flex: initial;
  }

  .nav-item {
    white-space: nowrap;
  }

  .logout-btn {
    display: none;
  }

  .admin-main {
    padding: 16px;
  }
}
</style>
