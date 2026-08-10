/**
 * OSRM public API ile rota çizer.
 * Başarısız olursa düz çizgi (fallback) döner.
 */
import { haversineKm } from '@/utils/fare'

export async function fetchDrivingRoute(fromCoords, toCoords, options = {}) {
  const { signal } = options
  const start = `${fromCoords.lng},${fromCoords.lat}`
  const end = `${toCoords.lng},${toCoords.lat}`
  const url = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`

  try {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error('OSRM request failed')
    const data = await response.json()
    const coords = data?.routes?.[0]?.geometry?.coordinates
    if (!coords?.length) throw new Error('No route geometry')

    return {
      route: coords.map(([lng, lat]) => [lat, lng]),
      distanceKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
      durationMin: Math.round(data.routes[0].duration / 60),
      isFallback: false,
    }
  } catch (err) {
    if (err?.name === 'AbortError') throw err

    return {
      route: [
        [fromCoords.lat, fromCoords.lng],
        [toCoords.lat, toCoords.lng],
      ],
      distanceKm: haversineKm(fromCoords, toCoords),
      durationMin: null,
      isFallback: true,
    }
  }
}
