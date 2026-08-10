import { FARE_CONFIG } from '@/data/mockData'

export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10
}

/**
 * Açılış ücreti + km başına ücret.
 * Kısa mesafede minimumFare uygulanır; tutar tam TL’ye yuvarlanır.
 */
export function calculateFare(distanceKm) {
  const distance = Math.max(0, Number(distanceKm) || 0)
  const raw = FARE_CONFIG.baseFare + distance * FARE_CONFIG.perKm
  const floor = Number(FARE_CONFIG.minimumFare) || 0
  const amount = Math.max(floor, Math.round(raw))

  return {
    baseFare: FARE_CONFIG.baseFare,
    perKm: FARE_CONFIG.perKm,
    minimumFare: floor,
    distanceKm: Math.round(distance * 10) / 10,
    amount,
    currency: FARE_CONFIG.currency,
    formatted: `${amount} ${FARE_CONFIG.currency}`,
  }
}

/**
 * Yaklaşık ETA (dk) — mesafe / ortalama şehir hızı
 */
export function estimateEtaMinutes(distanceKm, avgSpeedKmh = 28) {
  if (!distanceKm || distanceKm <= 0) return 1
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60))
}
