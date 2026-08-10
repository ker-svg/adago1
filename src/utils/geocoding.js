/**
 * AdaGo konum arama — Nominatim (OSM) + yerel mock konumlar.
 */
import { MAP_BOUNDS, locationPoints } from '@/data/mockData'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const MAX_RESULTS = 8
const CACHE_LIMIT = 40

/** viewbox: left, top, right, bottom (lon,lat,lon,lat) */
const VIEWBOX = [
  MAP_BOUNDS[0][1],
  MAP_BOUNDS[1][0],
  MAP_BOUNDS[1][1],
  MAP_BOUNDS[0][0],
].join(',')

const resultCache = new Map()

export function isWithinMapBounds(lat, lng) {
  const [[south, west], [north, east]] = MAP_BOUNDS
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= south &&
    lat <= north &&
    lng >= west &&
    lng <= east
  )
}

export function getLocalLocationItems() {
  return locationPoints.map((point) => ({
    id: `local-${point.name}`,
    name: point.name,
    displayName: point.name,
    lat: point.lat,
    lng: point.lng,
    type: 'local',
  }))
}

export function filterLocalLocations(query) {
  const items = getLocalLocationItems()
  const q = String(query || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
  if (!q) return items
  return items.filter((item) =>
    item.name.toLocaleLowerCase('tr-TR').includes(q),
  )
}

function shortenDisplayName(displayName, primaryName) {
  if (!displayName) return primaryName
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 2) return parts.join(', ')

  // İlk anlamlı parçalar (mekan + bölge / şehir)
  return parts.slice(0, 3).join(', ')
}

function normalizeNominatimItem(item) {
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (!isWithinMapBounds(lat, lng)) return null

  const primaryName =
    (item.name && String(item.name).trim()) ||
    String(item.display_name || '')
      .split(',')[0]
      ?.trim() ||
    'Konum'

  const displayName = shortenDisplayName(item.display_name, primaryName)

  return {
    id: `osm-${item.place_id ?? `${lat.toFixed(5)},${lng.toFixed(5)}`}`,
    name: primaryName,
    displayName,
    lat,
    lng,
    type: item.type || item.class || 'place',
  }
}

function rememberCache(key, value) {
  if (resultCache.size >= CACHE_LIMIT) {
    const oldest = resultCache.keys().next().value
    resultCache.delete(oldest)
  }
  resultCache.set(key, value)
}

/**
 * Nominatim üzerinden KKTC odaklı konum arar.
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{id,name,displayName,lat,lng,type}>>}
 */
export async function searchLocations(query, signal) {
  const q = String(query || '').trim()
  if (q.length < 3) return []

  const cacheKey = q.toLocaleLowerCase('tr-TR')
  if (resultCache.has(cacheKey)) {
    return resultCache.get(cacheKey)
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '12',
    viewbox: VIEWBOX,
    bounded: '0',
  })

  try {
    const response = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'tr,en',
      },
    })

    if (!response.ok) throw new Error('Nominatim request failed')

    const data = await response.json()
    if (!Array.isArray(data)) return []

    const normalized = []
    const seen = new Set()

    for (const raw of data) {
      const item = normalizeNominatimItem(raw)
      if (!item) continue
      if (seen.has(item.id)) continue
      seen.add(item.id)
      normalized.push(item)
      if (normalized.length >= MAX_RESULTS) break
    }

    rememberCache(cacheKey, normalized)
    return normalized
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return []
  }
}

/**
 * Yerel + remote sonuçları birleştirir; yakın/aynı isimli duplicate'leri eler.
 */
export function mergeLocationResults(localItems, remoteItems, limit = MAX_RESULTS) {
  const merged = [...(localItems || [])]

  for (const remote of remoteItems || []) {
    const duplicate = merged.some((local) => {
      const sameName =
        local.name.toLocaleLowerCase('tr-TR') ===
        remote.name.toLocaleLowerCase('tr-TR')
      const near =
        Math.abs(local.lat - remote.lat) < 0.008 &&
        Math.abs(local.lng - remote.lng) < 0.008
      return sameName || near
    })
    if (!duplicate) merged.push(remote)
    if (merged.length >= limit) break
  }

  return merged.slice(0, limit)
}
