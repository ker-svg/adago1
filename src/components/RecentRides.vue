<template>
  <v-card class="recent-card pa-4 mb-6" border>
    <div class="d-flex align-center justify-space-between mb-3">
      <h2 class="text-subtitle-1 font-weight-bold mb-0">Son İşlemler</h2>
      <v-chip size="x-small" variant="tonal" color="primary">Son 5</v-chip>
    </div>

    <v-alert
      v-if="rides.length === 0"
      type="info"
      variant="tonal"
      density="compact"
    >
      Henüz işlem bulunmuyor.
    </v-alert>

    <div
      v-for="ride in rides"
      :key="ride.id"
      class="recent-item"
    >
      <div class="recent-main">
        <div class="font-weight-medium text-body-2">{{ ride.passengerName }}</div>
        <div class="text-caption text-medium-emphasis">
          {{ ride.from }} → {{ ride.to }}
        </div>
      </div>
      <div class="recent-meta">
        <v-chip :color="statusColor(ride.status)" size="x-small" variant="flat">
          {{ ride.status }}
        </v-chip>
        <div class="text-caption text-medium-emphasis mt-1 text-end">
          {{ formatDate(ride.createdAt) }}
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup>
import { computed } from 'vue'
import { RIDE_STATUS } from '@/data/mockData'
import { useRideStore } from '@/stores/rideStore'

const props = defineProps({
  items: {
    type: Array,
    default: null,
  },
})

const rideStore = useRideStore()

const rides = computed(() => props.items ?? rideStore.recentRides)

function statusColor(status) {
  switch (status) {
    case RIDE_STATUS.ACCEPTED:
      return 'info'
    case RIDE_STATUS.COMPLETED:
      return 'success'
    case RIDE_STATUS.CANCELLED:
      return 'error'
    case RIDE_STATUS.PENDING:
    default:
      return 'warning'
  }
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
</script>

<style scoped>
.recent-card {
  border-radius: 16px !important;
  background: rgba(255, 255, 255, 0.94);
}

.recent-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid rgba(15, 76, 92, 0.08);
}

.recent-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.recent-meta {
  flex-shrink: 0;
  text-align: right;
}
</style>
