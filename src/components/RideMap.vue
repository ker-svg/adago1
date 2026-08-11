<template>
  <div class="map-shell">
    <div ref="mapEl" class="map-canvas" />
    <div v-if="pickHint" class="pick-hint">{{ pickHint }}</div>
  </div>
</template>

<script setup>
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { MAP_BOUNDS, MAP_CENTER, MAP_DEFAULT_ZOOM } from '@/data/mockData'

const props = defineProps({
  fromCoords: { type: Object, default: null },
  toCoords: { type: Object, default: null },
  route: { type: Array, default: () => [] },
  drivers: { type: Array, default: () => [] },
  pickMode: { type: String, default: null },
  interactive: { type: Boolean, default: true },
  fitDrivers: { type: Boolean, default: false },
})

const emit = defineEmits(['pick'])

const mapEl = ref(null)
let map = null
let fromMarker = null
let toMarker = null
let routeGlow = null
let routeLine = null
const driverMarkers = new Map()

const pickHint = computed(() => {
  if (props.pickMode === 'from') return 'Haritaya dokun — başlangıç noktası'
  if (props.pickMode === 'to') return 'Haritaya dokun — varış noktası'
  return ''
})

function makePin(letter, tone) {
  return L.divIcon({
    className: 'adago-pin-wrap',
    html: `<div class="adago-pin ${tone}"><span>${letter}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -36],
  })
}

function carIcon() {
  return L.divIcon({
    className: 'adago-car-wrap',
    html: `
      <div class="adago-car">
        <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="#0A1628"/>
          <path d="M11 23h18l-1.5-5.5a3 3 0 0 0-2.9-2.2H15.4a3 3 0 0 0-2.9 2.2L11 23Z" fill="#10B981"/>
          <circle cx="15" cy="24.5" r="2.2" fill="#fff"/>
          <circle cx="25" cy="24.5" r="2.2" fill="#fff"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function ensureMap() {
  if (map || !mapEl.value) return

  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: true,
    minZoom: 9,
    maxZoom: 18,
    maxBounds: MAP_BOUNDS,
    maxBoundsViscosity: 0.85,
  }).setView(MAP_CENTER, MAP_DEFAULT_ZOOM)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OSM &copy; CARTO',
  }).addTo(map)

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  map.on('click', (event) => {
    if (!props.interactive || !props.pickMode) return
    emit('pick', {
      mode: props.pickMode,
      lat: event.latlng.lat,
      lng: event.latlng.lng,
    })
  })

  setTimeout(() => map?.invalidateSize(), 120)
}

function clearRouteLayers() {
  if (fromMarker) {
    map.removeLayer(fromMarker)
    fromMarker = null
  }
  if (toMarker) {
    map.removeLayer(toMarker)
    toMarker = null
  }
  if (routeGlow) {
    map.removeLayer(routeGlow)
    routeGlow = null
  }
  if (routeLine) {
    map.removeLayer(routeLine)
    routeLine = null
  }
}

function renderDrivers() {
  if (!map) return
  const seen = new Set()

  // Yalnızca prop — mock / random / fallback üretme
  const list = (props.drivers || []).filter((driver) => {
    if (!driver || driver.id == null) return false
    if (!Number.isFinite(Number(driver.lat)) || !Number.isFinite(Number(driver.lng))) {
      return false
    }
    return true
  })

  for (const driver of list) {
    seen.add(driver.id)
    const latLng = [Number(driver.lat), Number(driver.lng)]
    const popup = `
      <div class="adago-popup">
        <strong>${driver.name || 'Sürücü'}</strong>
        <div>⭐ ${driver.rating ?? '—'} · ${driver.vehicleType || '—'}</div>
      </div>
    `

    if (driverMarkers.has(driver.id)) {
      const marker = driverMarkers.get(driver.id)
      marker.setLatLng(latLng)
      marker.setPopupContent(popup)
    } else {
      const marker = L.marker(latLng, {
        icon: carIcon(),
        zIndexOffset: 200,
      })
        .addTo(map)
        .bindPopup(popup)
      driverMarkers.set(driver.id, marker)
    }
  }

  for (const [id, marker] of driverMarkers.entries()) {
    if (!seen.has(id)) {
      map.removeLayer(marker)
      driverMarkers.delete(id)
    }
  }
}

function renderOverlays({ fit = true } = {}) {
  if (!map) return
  clearRouteLayers()

  const boundsPoints = []

  if (props.fromCoords) {
    fromMarker = L.marker([props.fromCoords.lat, props.fromCoords.lng], {
      icon: makePin('A', 'from'),
      zIndexOffset: 500,
    })
      .addTo(map)
      .bindTooltip('Başlangıç', { direction: 'top', offset: [0, -28] })
    boundsPoints.push([props.fromCoords.lat, props.fromCoords.lng])
  }

  if (props.toCoords) {
    toMarker = L.marker([props.toCoords.lat, props.toCoords.lng], {
      icon: makePin('B', 'to'),
      zIndexOffset: 500,
    })
      .addTo(map)
      .bindTooltip('Varış', { direction: 'top', offset: [0, -28] })
    boundsPoints.push([props.toCoords.lat, props.toCoords.lng])
  }

  if (props.route?.length > 1) {
    routeGlow = L.polyline(props.route, {
      color: '#ffffff',
      weight: 10,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map)

    routeLine = L.polyline(props.route, {
      color: '#10B981',
      weight: 5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map)

    boundsPoints.push(...props.route)
  }

  renderDrivers()

  if (!fit) return

  const sheetPad = window.innerWidth < 960 ? 220 : 48

  if (boundsPoints.length > 1) {
    map.fitBounds(boundsPoints, {
      paddingTopLeft: [36, 88],
      paddingBottomRight: [36, sheetPad],
      maxZoom: 14,
      animate: true,
    })
  } else if (boundsPoints.length === 1) {
    map.setView(boundsPoints[0], 14, { animate: true })
  } else if (props.fitDrivers && props.drivers?.length) {
    const driverBounds = props.drivers
      .filter(
        (d) =>
          d &&
          Number.isFinite(Number(d.lat)) &&
          Number.isFinite(Number(d.lng)),
      )
      .map((d) => [Number(d.lat), Number(d.lng)])
    if (driverBounds.length) {
      map.fitBounds(driverBounds, {
        padding: [56, 56],
        maxZoom: 13,
        animate: true,
      })
    }
  }
}

onMounted(() => {
  ensureMap()
  renderOverlays()
  window.addEventListener('resize', invalidate)
})

onUnmounted(() => {
  window.removeEventListener('resize', invalidate)
  driverMarkers.clear()
  if (map) {
    map.remove()
    map = null
  }
})

function invalidate() {
  map?.invalidateSize()
}

watch(
  () => [props.fromCoords, props.toCoords, props.route],
  () => renderOverlays({ fit: true }),
  { deep: true },
)

watch(
  () => props.drivers,
  () => renderDrivers(),
  { deep: true },
)

watch(
  () => props.pickMode,
  () => {
    if (map) {
      map.getContainer().style.cursor = props.pickMode ? 'crosshair' : ''
    }
  },
)

defineExpose({ invalidate })
</script>

<style scoped>
.map-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 280px;
}

.map-canvas {
  width: 100%;
  height: 100%;
  background: #dce7e4;
}

.pick-hint {
  position: absolute;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 500;
  background: rgba(10, 22, 40, 0.92);
  color: #fff;
  padding: 10px 16px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(10, 22, 40, 0.25);
}
</style>

<style>
.adago-pin-wrap,
.adago-car-wrap {
  background: transparent !important;
  border: none !important;
}

.adago-pin {
  width: 34px;
  height: 34px;
  border-radius: 50% 50% 50% 4px;
  transform: rotate(-45deg);
  display: grid;
  place-items: center;
  box-shadow: 0 6px 16px rgba(10, 22, 40, 0.28);
  border: 3px solid #fff;
}

.adago-pin span {
  transform: rotate(45deg);
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.adago-pin.from {
  background: #0a1628;
}

.adago-pin.to {
  background: #10b981;
}

.adago-car {
  filter: drop-shadow(0 3px 6px rgba(10, 22, 40, 0.35));
  transition: transform 0.4s ease;
}

.adago-popup {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12px;
  line-height: 1.45;
  min-width: 120px;
}

.adago-popup strong {
  display: block;
  margin-bottom: 2px;
  color: #0a1628;
}

.leaflet-bottom.leaflet-right {
  bottom: 14px;
  right: 10px;
}

.leaflet-control-zoom {
  border: 0 !important;
  box-shadow: 0 8px 20px rgba(10, 22, 40, 0.14) !important;
  border-radius: 14px !important;
  overflow: hidden;
}

.leaflet-control-zoom a {
  width: 38px !important;
  height: 38px !important;
  line-height: 38px !important;
  color: #0a1628 !important;
  font-size: 16px !important;
}

.leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.75) !important;
  font-size: 10px !important;
  border-radius: 8px 0 0 0;
}
</style>
