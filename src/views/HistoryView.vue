<template>
  <div class="history-page">
    <v-container class="py-6 history-wrap">
      <div class="top-row">
        <div>
          <p class="eyebrow">AdaGo</p>
          <h1 class="title">Yolculuk Geçmişim</h1>
          <p class="subtitle">
            {{ isDriver ? 'Tamamladığınız ve iptal edilen yolculuklar' : 'Geçmiş talep ve yolculuklarınız' }}
          </p>
        </div>
        <v-btn variant="tonal" color="primary" :to="backPath">Geri</v-btn>
      </div>

      <div v-if="historyStore.stats" class="stats-row">
        <template v-if="isDriver">
          <div class="stat-pill">
            <span>Tamamlanan</span>
            <strong>{{ historyStore.stats.completedRides }}</strong>
          </div>
          <div class="stat-pill">
            <span>Brüt</span>
            <strong>{{ formatMoney(historyStore.stats.totalGross) }}</strong>
          </div>
          <div class="stat-pill accent">
            <span>AdaGo %5</span>
            <strong>{{ formatMoney(historyStore.stats.totalCommission) }}</strong>
          </div>
          <div class="stat-pill">
            <span>Net</span>
            <strong>{{ formatMoney(historyStore.stats.totalNet) }}</strong>
          </div>
        </template>
        <template v-else>
          <div class="stat-pill">
            <span>Toplam</span>
            <strong>{{ historyStore.stats.totalRides }}</strong>
          </div>
          <div class="stat-pill">
            <span>Tamamlanan</span>
            <strong>{{ historyStore.stats.completedRides }}</strong>
          </div>
          <div class="stat-pill">
            <span>İptal</span>
            <strong>{{ historyStore.stats.cancelledRides }}</strong>
          </div>
        </template>
      </div>

      <div class="filters">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          type="button"
          class="filter-chip"
          :class="{ active: statusFilter === opt.value }"
          @click="changeFilter(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <v-alert
        v-if="historyStore.errorMessage"
        type="error"
        variant="tonal"
        class="mb-4"
        closable
        @click:close="historyStore.errorMessage = ''"
      >
        {{ historyStore.errorMessage }}
      </v-alert>

      <div v-if="historyStore.loading" class="state-box">
        <v-progress-circular indeterminate color="primary" size="28" />
        <span>Geçmiş yükleniyor...</span>
      </div>

      <div
        v-else-if="filteredItems.length === 0"
        class="state-box empty"
      >
        Henüz yolculuk geçmişiniz bulunmuyor.
      </div>

      <div v-else class="cards">
        <button
          v-for="ride in filteredItems"
          :key="ride.id"
          type="button"
          class="ride-card"
          @click="openDetail(ride)"
        >
          <div class="card-top">
            <div class="date">{{ formatDateTime(displayDate(ride)) }}</div>
            <span class="status" :class="ride.status">
              {{ statusLabel(ride.status) }}
            </span>
          </div>

          <div class="route-block">
            <div class="place">{{ ride.from }}</div>
            <div class="arrow">↓</div>
            <div class="place">{{ ride.to }}</div>
          </div>

          <div class="meta">
            <span v-if="ride.distanceKm != null">{{ ride.distanceKm }} km</span>
            <span v-if="isDriver && ride.status === 'completed'">
              Net {{ formatMoney(ride.driverNetAmount) }}
            </span>
            <span v-else-if="!isDriver">
              {{ formatMoney(fareForRide(ride)) }}
            </span>
            <span v-if="!isDriver && ride.driverName && ride.driverName !== '—'">
              {{ ride.driverName }}
            </span>
            <span v-if="isDriver">{{ ride.passengerName }}</span>
          </div>
        </button>
      </div>
    </v-container>

    <v-dialog v-model="detailOpen" max-width="480">
      <v-card v-if="selected" class="detail-card">
        <v-card-title class="detail-title">Yolculuk detayı</v-card-title>
        <v-card-text>
          <div class="detail-row">
            <span>ID</span>
            <strong class="mono">{{ shortId(selected.id) }}</strong>
          </div>
          <div class="detail-row">
            <span>Durum</span>
            <strong>{{ statusLabel(selected.status) }}</strong>
          </div>
          <div class="detail-row">
            <span>Nereden</span>
            <strong>{{ selected.from }}</strong>
          </div>
          <div class="detail-row">
            <span>Nereye</span>
            <strong>{{ selected.to }}</strong>
          </div>
          <div v-if="selected.distanceKm != null" class="detail-row">
            <span>Mesafe</span>
            <strong>{{ selected.distanceKm }} km</strong>
          </div>
          <div v-if="selected.durationMin != null" class="detail-row">
            <span>Süre</span>
            <strong>~{{ selected.durationMin }} dk</strong>
          </div>
          <div class="detail-row">
            <span>Ücret</span>
            <strong>{{ formatMoney(fareForRide(selected)) }}</strong>
          </div>
          <template v-if="isDriver && selected.status === 'completed'">
            <div class="detail-row">
              <span>AdaGo %5</span>
              <strong>{{ formatMoney(selected.commissionAmount) }}</strong>
            </div>
            <div class="detail-row">
              <span>Sürücü net</span>
              <strong>{{ formatMoney(selected.driverNetAmount) }}</strong>
            </div>
          </template>
          <div v-if="!isDriver" class="detail-row">
            <span>Sürücü</span>
            <strong>{{ selected.driverName }}</strong>
          </div>
          <div v-if="isDriver" class="detail-row">
            <span>Yolcu</span>
            <strong>{{ selected.passengerName }}</strong>
          </div>
          <div class="detail-row">
            <span>Oluşturulma</span>
            <strong>{{ formatDateTime(selected.createdAt) }}</strong>
          </div>
          <div v-if="selected.completedAt" class="detail-row">
            <span>Tamamlanma</span>
            <strong>{{ formatDateTime(selected.completedAt) }}</strong>
          </div>
          <div v-if="selected.cancelledAt" class="detail-row">
            <span>İptal</span>
            <strong>{{ formatDateTime(selected.cancelledAt) }}</strong>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">Kapat</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useHistoryStore } from '@/stores/historyStore'

const route = useRoute()
const authStore = useAuthStore()
const historyStore = useHistoryStore()

const statusFilter = ref('all')
const detailOpen = ref(false)
const selected = ref(null)

const isDriver = computed(
  () =>
    authStore.currentRole === 'driver' ||
    route.meta.role === 'driver',
)

const backPath = computed(() => (isDriver.value ? '/driver' : '/passenger'))

const filterOptions = [
  { value: 'all', label: 'Tümü' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'cancelled', label: 'İptal' },
]

const filteredItems = computed(() => historyStore.items)

onMounted(async () => {
  await Promise.all([
    historyStore.fetchMyStats(),
    historyStore.fetchMyHistory(statusFilter.value),
  ])
})

async function changeFilter(value) {
  statusFilter.value = value
  await historyStore.fetchMyHistory(value)
}

function openDetail(ride) {
  selected.value = ride
  detailOpen.value = true
}

function fareForRide(ride) {
  if (ride.status === 'completed' && ride.grossFare != null) {
    return ride.grossFare
  }
  return ride.estimatedFare
}

function displayDate(ride) {
  return ride.completedAt || ride.cancelledAt || ride.createdAt
}

function statusLabel(status) {
  if (status === 'completed') return 'Tamamlandı'
  if (status === 'cancelled') return 'İptal Edildi'
  return status
}

function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ₺`
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    const date = d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const time = d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `${date}\n${time}`.replace('\n', ' · ')
  } catch {
    return value
  }
}

function shortId(id) {
  return id ? String(id).slice(0, 8) : '—'
}
</script>

<style scoped>
.history-page {
  min-height: calc(100dvh - 56px);
  background: linear-gradient(180deg, #eef3f5, #f8fafb);
}

.history-wrap {
  max-width: 760px;
}

.top-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0;
  color: #10b981;
  font-weight: 800;
  font-size: 0.78rem;
}

.title {
  margin: 4px 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0a1628;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.stat-pill {
  background: #fff;
  border: 1px solid #e8ecef;
  border-radius: 14px;
  padding: 10px 14px;
  min-width: 110px;
}

.stat-pill span {
  display: block;
  font-size: 0.72rem;
  color: #6b7280;
  font-weight: 650;
}

.stat-pill strong {
  font-size: 1rem;
  color: #0a1628;
}

.stat-pill.accent strong {
  color: #059669;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-chip {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  padding: 8px 14px;
  font-weight: 700;
  font-size: 0.82rem;
  color: #4b5563;
  cursor: pointer;
}

.filter-chip.active {
  background: #0a1628;
  border-color: #0a1628;
  color: #fff;
}

.state-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 16px;
  background: #fff;
  border-radius: 18px;
  border: 1px solid #e8ecef;
  color: #6b7280;
}

.state-box.empty {
  font-weight: 650;
}

.cards {
  display: grid;
  gap: 12px;
}

.ride-card {
  width: 100%;
  text-align: left;
  border: 1px solid #e8ecef;
  background: #fff;
  border-radius: 18px;
  padding: 16px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(10, 22, 40, 0.04);
}

.ride-card:hover {
  border-color: #10b981;
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.date {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 600;
}

.status {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
}

.status.completed {
  background: #ecfdf5;
  color: #047857;
}

.status.cancelled {
  background: #fef2f2;
  color: #b91c1c;
}

.route-block {
  margin-bottom: 10px;
}

.place {
  font-weight: 800;
  color: #0a1628;
  font-size: 1rem;
}

.arrow {
  color: #10b981;
  font-weight: 800;
  padding: 2px 0;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #6b7280;
  font-size: 0.8rem;
  font-weight: 650;
}

.detail-card {
  border-radius: 18px !important;
}

.detail-title {
  font-weight: 800 !important;
  color: #0a1628;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f2f4;
  font-size: 0.9rem;
  color: #6b7280;
}

.detail-row strong {
  color: #0a1628;
  text-align: right;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
}

@media (min-width: 900px) {
  .cards {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
