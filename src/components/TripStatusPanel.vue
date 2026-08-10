<template>
  <div class="trip-status">
    <div class="d-flex align-center justify-space-between mb-2">
      <div class="title">{{ phaseTitle }}</div>
      <v-chip size="small" :color="phaseColor" variant="flat">
        {{ ride.tripPhase || ride.status }}
      </v-chip>
    </div>

    <div class="route">{{ ride.from }} → {{ ride.to }}</div>

    <div v-if="ride.assignedDriver" class="driver-box mt-3">
      <div class="driver-avatar">🚗</div>
      <div class="flex-grow-1">
        <div class="driver-name">{{ ride.assignedDriver.name }}</div>
        <div class="driver-meta">
          ⭐ {{ ride.assignedDriver.rating }} · {{ ride.assignedDriver.vehicleType }}
        </div>
      </div>
      <div class="eta">
        <div class="eta-value">{{ ride.assignedDriver.etaMin }} dk</div>
        <div class="eta-label">varış</div>
      </div>
    </div>

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
  ride: {
    type: Object,
    required: true,
  },
})

const steps = [
  { key: 'assign', label: TRIP_PHASE.ASSIGNING, index: 0 },
  { key: 'enroute', label: TRIP_PHASE.EN_ROUTE, index: 1 },
  { key: 'progress', label: TRIP_PHASE.IN_PROGRESS, index: 2 },
  { key: 'done', label: TRIP_PHASE.COMPLETED, index: 3 },
]

const currentIndex = computed(() => {
  switch (props.ride.tripPhase) {
    case TRIP_PHASE.EN_ROUTE:
      return 1
    case TRIP_PHASE.IN_PROGRESS:
      return 2
    case TRIP_PHASE.COMPLETED:
      return 3
    case TRIP_PHASE.ASSIGNING:
    default:
      return 0
  }
})

const phaseTitle = computed(() => {
  if (props.ride.tripPhase === TRIP_PHASE.ASSIGNING) return 'Eşleştiriliyor'
  if (props.ride.tripPhase === TRIP_PHASE.EN_ROUTE) return 'Sürücün yolda'
  if (props.ride.tripPhase === TRIP_PHASE.IN_PROGRESS) return 'Yolculuk devam ediyor'
  if (props.ride.tripPhase === TRIP_PHASE.COMPLETED) return 'Yolculuk bitti'
  return 'Yolculuk durumu'
})

const phaseColor = computed(() => {
  switch (props.ride.tripPhase) {
    case TRIP_PHASE.EN_ROUTE:
      return 'info'
    case TRIP_PHASE.IN_PROGRESS:
      return 'primary'
    case TRIP_PHASE.COMPLETED:
      return 'success'
    default:
      return 'warning'
  }
})
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
