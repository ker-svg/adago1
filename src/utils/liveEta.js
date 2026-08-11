/**
 * Canlı takip ETA yardımcıları (OSRM throttle + saat formatı)
 */
import { fetchDrivingRoute } from '@/utils/route'
import { haversineKm } from '@/utils/fare'

export const ETA_ROUTE_THROTTLE_MS = 12_000
export const ETA_MIN_MOVE_KM = 0.12

export function formatArrivalClock(durationMin) {
  if (durationMin == null || !Number.isFinite(Number(durationMin))) return null
  const d = new Date(Date.now() + Number(durationMin) * 60_000)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function shouldRefreshEtaRoute({
  lastAt,
  lastCoords,
  nextCoords,
  throttleMs = ETA_ROUTE_THROTTLE_MS,
  minMoveKm = ETA_MIN_MOVE_KM,
  force = false,
}) {
  if (force) return true
  if (!lastAt) return true
  if (Date.now() - lastAt >= throttleMs) return true
  if (lastCoords && nextCoords) {
    const moved = haversineKm(lastCoords, nextCoords)
    if (moved >= minMoveKm) return true
  }
  return false
}

/**
 * Abort + token ile güvenli OSRM çağrısı.
 * @returns {{ route, distanceKm, durationMin, arrivalClock, isFallback } | null}
 */
export async function fetchLiveEtaRoute(fromCoords, toCoords, options = {}) {
  const { signal } = options
  if (
    !fromCoords ||
    !toCoords ||
    !Number.isFinite(fromCoords.lat) ||
    !Number.isFinite(fromCoords.lng) ||
    !Number.isFinite(toCoords.lat) ||
    !Number.isFinite(toCoords.lng)
  ) {
    return null
  }

  const result = await fetchDrivingRoute(fromCoords, toCoords, { signal })
  return {
    route: result.route || [],
    distanceKm: result.distanceKm,
    durationMin: result.durationMin,
    arrivalClock: formatArrivalClock(result.durationMin),
    isFallback: Boolean(result.isFallback),
  }
}
