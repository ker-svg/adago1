<template>
  <div v-if="fare" class="fare-card">
    <div>
      <div class="label">Tahmini ücret</div>
      <div class="amount">{{ fare.formatted }}</div>
    </div>
    <div class="breakdown">
      <div>Açılış {{ fare.baseFare }} {{ fare.currency }}</div>
      <div>+ {{ fare.distanceKm }} km × {{ fare.perKm }} {{ fare.currency }}</div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  fare: {
    type: Object,
    default: null,
  },
})
</script>

<style scoped>
.fare-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(135deg, #0a1628 0%, #134e4a 100%);
  color: #fff;
}

.label {
  font-size: 0.75rem;
  opacity: 0.8;
}

.amount {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #6ee7b7;
}

.breakdown {
  text-align: right;
  font-size: 0.72rem;
  opacity: 0.88;
  line-height: 1.4;
}
</style>
