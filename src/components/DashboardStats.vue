<template>
  <v-row class="mb-2" dense>
    <v-col
      v-for="card in cards"
      :key="card.label"
      cols="12"
      sm="6"
      md="4"
      lg
    >
      <div class="stat-card" :style="{ '--accent': card.color }">
        <div class="stat-icon-wrap">
          <v-icon :icon="card.icon" size="22" />
        </div>
        <div class="stat-body">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
        </div>
      </div>
    </v-col>
  </v-row>
</template>

<script setup>
import { computed } from 'vue'
import { useRideStore } from '@/stores/rideStore'

const rideStore = useRideStore()

const cards = computed(() => [
  {
    label: 'Toplam Talep',
    value: rideStore.stats.total,
    icon: 'mdi-clipboard-list-outline',
    color: '#0F4C5C',
  },
  {
    label: 'Bekleyen Talep',
    value: rideStore.stats.pending,
    icon: 'mdi-clock-outline',
    color: '#ED6C02',
  },
  {
    label: 'Kabul Edilen Talep',
    value: rideStore.stats.accepted,
    icon: 'mdi-handshake-outline',
    color: '#0288D1',
  },
  {
    label: 'Tamamlanan Talep',
    value: rideStore.stats.completed,
    icon: 'mdi-check-circle-outline',
    color: '#2E7D32',
  },
  {
    label: 'İptal Edilen Talep',
    value: rideStore.stats.cancelled,
    icon: 'mdi-cancel',
    color: '#C62828',
  },
])
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px;
  border-radius: 16px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(245, 247, 248, 0.9));
  border: 1px solid rgba(15, 76, 92, 0.08);
  box-shadow: 0 8px 24px rgba(15, 76, 92, 0.06);
  min-height: 88px;
  height: 100%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(15, 76, 92, 0.1);
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--accent);
  flex-shrink: 0;
}

.stat-label {
  font-size: 0.78rem;
  color: #5a6a72;
  margin-bottom: 2px;
  line-height: 1.3;
}

.stat-value {
  font-size: clamp(1.35rem, 2.5vw, 1.6rem);
  font-weight: 700;
  color: #0f4c5c;
  line-height: 1.1;
}
</style>
