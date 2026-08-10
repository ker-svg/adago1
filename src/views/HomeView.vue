<template>
  <div class="splash">
    <div class="splash-map">
      <RideMap
        :drivers="rideStore.nearbyDrivers"
        :interactive="false"
        fit-drivers
      />
      <div class="splash-scrim" />
    </div>

    <div class="splash-card">
      <div class="logo-row">
        <span class="logo-dot" />
        <p class="eyebrow">AdaGo</p>
      </div>
      <h1>Ada’da yolculuk, bir dokunuş uzağında.</h1>
      <p class="lead">
        Kuzey Kıbrıs için modern ride-hailing prototipi — harita, rota ve yakındaki sürücüler.
      </p>
      <v-btn color="primary" size="large" block class="cta" to="/login">
        Yolculuğa Başla
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import RideMap from '@/components/RideMap.vue'
import { useRideStore } from '@/stores/rideStore'

const rideStore = useRideStore()

onMounted(() => {
  rideStore.startDriverSimulation()
})

onUnmounted(() => {
  rideStore.stopDriverSimulation()
})
</script>

<style scoped>
.splash {
  position: relative;
  min-height: 100dvh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

.splash-map {
  position: absolute;
  inset: 0;
}

.splash-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(10, 22, 40, 0.15) 0%, rgba(10, 22, 40, 0.55) 55%, rgba(10, 22, 40, 0.78) 100%);
  pointer-events: none;
  z-index: 400;
}

.splash-card {
  position: relative;
  z-index: 500;
  width: min(440px, 100%);
  background: rgba(255, 255, 255, 0.97);
  border-radius: 28px;
  padding: 26px 22px 22px;
  box-shadow: 0 24px 60px rgba(10, 22, 40, 0.35);
  backdrop-filter: blur(8px);
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.logo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
}

.eyebrow {
  margin: 0;
  letter-spacing: -0.03em;
  font-size: 1.05rem;
  color: #0a1628;
  font-weight: 800;
}

h1 {
  margin: 0;
  font-size: clamp(1.6rem, 5vw, 2.1rem);
  line-height: 1.12;
  letter-spacing: -0.04em;
  color: #0a1628;
}

.lead {
  margin: 12px 0 20px;
  color: #64748b;
  line-height: 1.55;
  font-size: 0.95rem;
}

.cta {
  border-radius: 16px !important;
  font-weight: 700 !important;
  letter-spacing: -0.01em;
}

@media (min-width: 900px) {
  .splash {
    align-items: center;
    justify-content: flex-end;
    padding-right: 8vw;
  }

  .splash-scrim {
    background:
      linear-gradient(90deg, rgba(10, 22, 40, 0.1) 20%, rgba(10, 22, 40, 0.55) 100%);
  }
}
</style>
