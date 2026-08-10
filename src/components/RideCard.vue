<template>
  <v-card class="ride-card mb-4" border>
    <v-card-item class="pb-2">
      <div class="d-flex align-center justify-space-between flex-wrap ga-2 w-100">
        <div class="d-flex align-center ga-2">
          <v-icon icon="mdi-clock-outline" size="18" color="primary" />
          <span class="text-body-2 text-medium-emphasis">
            Oluşturulma: <strong class="text-high-emphasis">{{ formattedDate }}</strong>
          </span>
        </div>
        <v-chip
          :color="statusColor"
          size="small"
          variant="flat"
          class="status-badge font-weight-medium"
        >
          {{ ride.status }}
        </v-chip>
      </div>
    </v-card-item>

    <v-divider />

    <v-card-text class="pt-4">
      <div class="detail-section mb-4">
        <div class="section-title">Yolcu Bilgileri</div>
        <div class="passenger-block">
          <v-avatar color="primary" size="44" class="flex-shrink-0">
            <v-icon icon="mdi-account" color="white" />
          </v-avatar>
          <div class="passenger-meta">
            <div class="font-weight-bold text-body-1">{{ ride.passengerName }}</div>
            <div v-if="ride.phone" class="text-body-2 text-medium-emphasis d-flex align-center mt-1">
              <v-icon icon="mdi-phone" size="16" class="mr-1" />
              {{ ride.phone }}
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <div class="section-title">Rota</div>
        <div class="route-grid">
          <div class="route-row">
            <v-icon icon="mdi-map-marker" color="primary" size="20" class="mr-2" />
            <div>
              <div class="text-caption text-medium-emphasis">Başlangıç</div>
              <div class="font-weight-medium">{{ ride.from }}</div>
            </div>
          </div>

          <div class="route-row">
            <v-icon icon="mdi-map-marker-check" color="accent" size="20" class="mr-2" />
            <div>
              <div class="text-caption text-medium-emphasis">Varış</div>
              <div class="font-weight-medium">{{ ride.to }}</div>
            </div>
          </div>
        </div>

        <div v-if="ride.driverName" class="mt-3 text-body-2 text-medium-emphasis">
          Sürücü: {{ ride.driverName }}
        </div>
      </div>
    </v-card-text>

    <v-card-actions v-if="hasActions" class="flex-wrap ga-2 px-4 pb-4">
      <v-spacer class="d-none d-sm-block" />

      <v-btn
        v-if="showCancel"
        color="error"
        variant="tonal"
        block
        class="action-btn"
        @click="$emit('cancel', ride.id)"
      >
        Talebi İptal Et
      </v-btn>

      <v-btn
        v-if="showAccept"
        color="primary"
        variant="flat"
        block
        class="action-btn"
        @click="$emit('accept', ride.id)"
      >
        Kabul Et
      </v-btn>

      <v-btn
        v-if="showComplete"
        color="success"
        variant="flat"
        block
        class="action-btn"
        @click="$emit('complete', ride.id)"
      >
        Tamamlandı Yap
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { computed } from 'vue'
import { RIDE_STATUS } from '@/data/mockData'

const props = defineProps({
  ride: {
    type: Object,
    required: true,
  },
  showAccept: {
    type: Boolean,
    default: false,
  },
  showComplete: {
    type: Boolean,
    default: false,
  },
  showCancel: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['accept', 'complete', 'cancel'])

const hasActions = computed(
  () => props.showAccept || props.showComplete || props.showCancel,
)

const statusColor = computed(() => {
  switch (props.ride.status) {
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
})

const formattedDate = computed(() => {
  try {
    return new Date(props.ride.createdAt).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
})
</script>

<style scoped>
.ride-card {
  border-radius: 16px !important;
  overflow: hidden;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #5a6a72;
  margin-bottom: 10px;
}

.passenger-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(15, 76, 92, 0.04);
}

.route-grid {
  display: grid;
  gap: 12px;
}

@media (min-width: 600px) {
  .route-grid {
    grid-template-columns: 1fr 1fr;
  }

  .action-btn {
    width: auto !important;
    flex: 0 0 auto;
  }
}

.route-row {
  display: flex;
  align-items: flex-start;
}

.status-badge {
  letter-spacing: 0.01em;
}
</style>
