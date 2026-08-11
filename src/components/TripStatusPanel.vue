<template>
  <div class="trip-status">
    <div class="d-flex align-center justify-space-between mb-2">
      <div class="title">{{ phaseTitle }}</div>
      <v-chip size="small" :color="phaseColor" variant="flat">
        {{ ride.tripPhase || ride.status }}
      </v-chip>
    </div>

    <div class="route">{{ ride.from }} → {{ ride.to }}</div>

    <div v-if="driverInfo" class="driver-box mt-3">
      <div class="driver-avatar">🚗</div>
      <div class="flex-grow-1">
        <div class="driver-name">{{ driverInfo.name }}</div>
        <div class="driver-meta">
          <span v-if="driverInfo.rating">⭐ {{ driverInfo.rating }}</span>
          <span v-if="driverInfo.vehicleType"> · {{ driverInfo.vehicleType }}</span>
        </div>
      </div>
      <div v-if="etaPrimary" class="eta">
        <div class="eta-value">{{ etaPrimary }}</div>
        <div class="eta-label">{{ etaLabel }}</div>
      </div>
    </div>

    <div v-if="etaSecondary" class="eta-card mt-3">
      <div class="eta-card-row">
        <span>{{ etaSecondaryLabel }}</span>
        <strong>{{ etaSecondary }}</strong>
      </div>
      <div v-if="etaDistance" class="eta-card-row muted">
        <span>Kalan mesafe</span>
        <strong>{{ etaDistance }}</strong>
      </div>
      <div v-if="etaArrivalClock" class="eta-card-row muted">
        <span>Tahmini varış</span>
        <strong>{{ etaArrivalClock }}</strong>
      </div>
    </div>

    <v-alert
      v-if="staleWarning"
      type="warning"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      {{ staleWarning }}
    </v-alert>

    <div class="steps mt-3">
      <div
        v-for="step in steps"
        :key="step.key"
        class="step"
        :class="{
          done: step.index < currentIndex,
          active: step.index === currentIndex,
        }"
      >
        <span class="bullet" />
        <span>{{ step.label }}</span>
      </div>
    </div>

    <div v-if="ride.estimatedFare" class="fare-line mt-3">
      Tahmini ücret:
      <strong>{{ ride.estimatedFare }} ₺</strong>
    </div>

    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TRIP_PHASE } from '@/data/mockData'

const props = defineProps({
  ride: { type: Object, required: true },
  /** Canlı ETA: { minutes, distanceKm, arrivalClock, mode: 'pickup'|'destination'|'arrived' } */
  liveEta: { type: Object, default: null },
  staleWarning: { type: String, default: '' },
})

const steps = [
  { key: 'assign', label: TRIP_PHASE.ASSIGNING, index: 0 },
  { key: 'enroute', label: TRIP_PHASE.EN_ROUTE, index: 1 },
  { key: 'arrived', label: TRIP_PHASE.ARRIVED, index: 2 },
  { key: 'onboard', label: TRIP_PHASE.PASSENGER_ONBOARD, index: 3 },
  { key: 'progress', label: TRIP_PHASE.IN_PROGRESS, index: 4 },
  { key: 'done', label: TRIP_PHASE.COMPLETED, index: 5 },
]

const currentIndex = computed(() => {
  switch (props.ride.tripPhase) {
    case TRIP_PHASE.EN_ROUTE:
      return 1
    case TRIP_PHASE.ARRIVED:
      return 2
    case TRIP_PHASE.PASSENGER_ONBOARD:
      return 3
    case TRIP_PHASE.IN_PROGRESS:
      return 4
    case TRIP_PHASE.COMPLETED:
      return 5
    case TRIP_PHASE.ASSIGNING:
    default:
      return 0
  }
})

const phaseTitle = computed(() => {
  const p = props.ride.tripPhase
  if (p === TRIP_PHASE.ASSIGNING) return 'Sürücü aranıyor'
  if (p === TRIP_PHASE.EN_ROUTE) return 'Sürücünüz geliyor'
  if (p === TRIP_PHASE.ARRIVED) return 'Sürücünüz geldi'
  if (p === TRIP_PHASE.PASSENGER_ONBOARD) return 'Yolcu alındı'
  if (p === TRIP_PHASE.IN_PROGRESS) return 'Yolculuk devam ediyor'
  if (p === TRIP_PHASE.COMPLETED) return 'Yolculuk tamamlandı'
  return 'Yolculuk durumu'
})

const phaseColor = computed(() => {
  switch (props.ride.tripPhase) {
    case TRIP_PHASE.EN_ROUTE:
      return 'info'
    case TRIP_PHASE.ARRIVED:
      return 'warning'
    case TRIP_PHASE.PASSENGER_ONBOARD:
    case TRIP_PHASE.IN_PROGRESS:
      return 'primary'
    case TRIP_PHASE.COMPLETED:
      return 'success'
    default:
      return 'secondary'
  }
})

const driverInfo = computed(() => {
  if (props.ride.assignedDriver) return props.ride.assignedDriver
  if (props.ride.driverName || props.ride.driverId) {
    return {
      name: props.ride.driverName || 'Sürücü',
      rating: null,
      vehicleType: null,
    }
  }
  return null
})

const etaPrimary = computed(() => {
  if (props.liveEta?.mode === 'arrived') return 'Konumda'
  if (props.liveEta?.minutes != null) return `${props.liveEta.minutes} dk`
  if (props.ride.assignedDriver?.etaMin != null && props.ride.tripPhase === TRIP_PHASE.EN_ROUTE) {
    return `${props.ride.assignedDriver.etaMin} dk`
  }
  return null
})

const etaLabel = computed(() => {
  if (props.liveEta?.mode === 'destination') return 'varış'
  if (props.liveEta?.mode === 'arrived') return ''
  return 'yanınızda'
})

const etaSecondary = computed(() => {
  if (props.liveEta?.mode === 'arrived') return 'Sürücü konumda'
  if (props.liveEta?.minutes != null) {
    return props.liveEta.mode === 'destination'
      ? `Varışa yaklaşık ${props.liveEta.minutes} dk`
      : `Sürücünüz yaklaşık ${props.liveEta.minutes} dk sonra yanınızda`
  }
  return null
})

const etaSecondaryLabel = computed(() =>
  props.liveEta?.mode === 'destination' ? 'Varış ETA' : 'Pickup ETA',
)

const etaDistance = computed(() => {
  if (props.liveEta?.distanceKm == null) return null
  return `${props.liveEta.distanceKm} km`
})

const etaArrivalClock = computed(() => props.liveEta?.arrivalClock || null)
</script>

<style scoped>
.title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #111827;
}

.route {
  font-weight: 600;
  color: #374151;
}

.driver-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f3f5f7;
}

.driver-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #fff;
  font-size: 1.2rem;
}

.driver-name {
  font-weight: 700;
  color: #111827;
}

.driver-meta {
  font-size: 0.78rem;
  color: #6b7280;
}

.eta {
  text-align: right;
}

.eta-value {
  font-weight: 800;
  color: #059669;
}

.eta-label {
  font-size: 0.7rem;
  color: #6b7280;
}

.eta-card {
  padding: 12px;
  border-radius: 14px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.eta-card-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.88rem;
  color: #065f46;
  font-weight: 650;
}

.eta-card-row + .eta-card-row {
  margin-top: 6px;
}

.eta-card-row.muted {
  color: #047857;
  font-weight: 600;
  font-size: 0.82rem;
}

.steps {
  display: grid;
  gap: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: #9ca3af;
}

.step .bullet {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
}

.step.active {
  color: #0a1628;
  font-weight: 700;
}

.step.active .bullet {
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.18);
}

.step.done {
  color: #6b7280;
}

.step.done .bullet {
  background: #2e7d32;
}

.fare-line {
  font-size: 0.9rem;
  color: #4b5563;
}
</style>
