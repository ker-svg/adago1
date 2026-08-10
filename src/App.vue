<template>
  <v-app class="ride-app" :class="{ 'map-mode': isMapPage }">
    <Navbar />
    <v-main :class="{ 'map-main': isMapPage }">
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Navbar from '@/components/Navbar.vue'

const route = useRoute()
const isMapPage = computed(() => Boolean(route.meta.mapPage))
</script>

<style>
.ride-app {
  background: #f3f5f6;
}

.ride-app.map-mode {
  position: relative;
}

.map-main {
  --v-layout-top: 0px !important;
  padding: 0 !important;
}

.map-main .v-main__wrap {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
</style>
