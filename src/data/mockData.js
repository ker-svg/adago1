export const RIDE_STATUS = {
  PENDING: 'Bekliyor',
  ACCEPTED: 'Kabul Edildi',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal Edildi',
}

/** Yolcu yolculuk yaşam döngüsü */
export const TRIP_PHASE = {
  ASSIGNING: 'Sürücü aranıyor',
  EN_ROUTE: 'Sürücü size geliyor',
  ARRIVED: 'Sürücü geldi',
  PASSENGER_ONBOARD: 'Yolcu alındı',
  IN_PROGRESS: 'Yolculuk devam ediyor',
  COMPLETED: 'Yolculuk tamamlandı',
}

/** DB trip_phase → UI */
export const TRIP_PHASE_FROM_DB = {
  assigning: TRIP_PHASE.ASSIGNING,
  en_route: TRIP_PHASE.EN_ROUTE,
  arrived: TRIP_PHASE.ARRIVED,
  passenger_onboard: TRIP_PHASE.PASSENGER_ONBOARD,
  in_progress: TRIP_PHASE.IN_PROGRESS,
  completed: TRIP_PHASE.COMPLETED,
}

export const FARE_CONFIG = {
  /** KKTC paylaşımlı ulaşım — yaklaşık 2025–2026 TL tarifesi */
  baseFare: 50, // açılış ücreti (₺)
  perKm: 30, // km başına (₺)
  minimumFare: 80, // kısa mesafelerde taban ücret (₺)
  currency: '₺',
}

/** AdaGo harita — Kuzey Kıbrıs odaklı */
export const MAP_CENTER = [35.2, 33.45]
export const MAP_DEFAULT_ZOOM = 11
export const MAP_BOUNDS = [
  [34.55, 32.15],
  [35.75, 34.75],
]

export const locationPoints = [
  { name: 'Lefkoşa', lat: 35.1856, lng: 33.3823 },
  { name: 'Girne', lat: 35.3417, lng: 33.3167 },
  { name: 'Gazimağusa', lat: 35.1264, lng: 33.9378 },
  { name: 'Güzelyurt', lat: 35.2010, lng: 32.9932 },
  { name: 'İskele', lat: 35.2881, lng: 33.8919 },
  { name: 'Lefke', lat: 35.1115, lng: 32.8492 },
  { name: 'Lapta', lat: 35.3375, lng: 33.1653 },
  { name: 'Alsancak', lat: 35.3360, lng: 33.2100 },
  { name: 'Kyrenia Harbour', lat: 35.3412, lng: 33.3195 },
  { name: 'Ercan Havalimanı', lat: 35.1547, lng: 33.4961 },
]

export const mockLocations = locationPoints.map((p) => p.name)

export function getLocationByName(name) {
  return locationPoints.find((p) => p.name === name) || null
}

export const mockPassenger = {
  id: 'passenger-1',
  name: 'Ayşe Yılmaz',
  phone: '0533 123 45 67',
  role: 'passenger',
}

export const mockDriver = {
  id: 'driver-1',
  name: 'Mehmet Demir',
  role: 'driver',
  vehicleType: 'Sedan',
  rating: 4.8,
  completedTrips: 214,
}

/** Haritada görünen yakın sürücü simülasyonu */
export const initialNearbyDrivers = [
  {
    id: 'driver-1',
    name: 'Mehmet Demir',
    rating: 4.8,
    vehicleType: 'Sedan',
    lat: 35.192,
    lng: 33.365,
  },
  {
    id: 'near-2',
    name: 'Emre Çelik',
    rating: 4.6,
    vehicleType: 'Hatchback',
    lat: 35.175,
    lng: 33.401,
  },
  {
    id: 'near-3',
    name: 'Selin Aksoy',
    rating: 4.9,
    vehicleType: 'SUV',
    lat: 35.205,
    lng: 33.390,
  },
  {
    id: 'near-4',
    name: 'Burak Yıldız',
    rating: 4.5,
    vehicleType: 'Sedan',
    lat: 35.168,
    lng: 33.350,
  },
  {
    id: 'near-5',
    name: 'Deniz Kara',
    rating: 4.7,
    vehicleType: 'Minivan',
    lat: 35.198,
    lng: 33.420,
  },
  {
    id: 'near-6',
    name: 'Caner Öztürk',
    rating: 4.4,
    vehicleType: 'Sedan',
    lat: 35.210,
    lng: 33.355,
  },
]

export const initialRides = [
  {
    id: 'ride-demo-1',
    passengerId: 'passenger-demo',
    passengerName: 'Can Öztürk',
    phone: '0533 987 65 43',
    from: 'Lefkoşa',
    to: 'Girne',
    fromCoords: { lat: 35.1856, lng: 33.3823 },
    toCoords: { lat: 35.3417, lng: 33.3167 },
    route: [
      [35.1856, 33.3823],
      [35.22, 33.35],
      [35.28, 33.33],
      [35.3417, 33.3167],
    ],
    distanceKm: 18.5,
    durationMin: 28,
    estimatedFare: 605,
    status: RIDE_STATUS.PENDING,
    tripPhase: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ride-demo-2',
    passengerId: 'passenger-demo-2',
    passengerName: 'Elif Kara',
    phone: '0542 111 22 33',
    from: 'Girne',
    to: 'Gazimağusa',
    fromCoords: { lat: 35.3417, lng: 33.3167 },
    toCoords: { lat: 35.1264, lng: 33.9378 },
    route: [
      [35.3417, 33.3167],
      [35.25, 33.55],
      [35.1264, 33.9378],
    ],
    distanceKm: 42,
    durationMin: 48,
    estimatedFare: 1310,
    status: RIDE_STATUS.COMPLETED,
    tripPhase: TRIP_PHASE.COMPLETED,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    acceptedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    driverId: 'driver-1',
    driverName: 'Mehmet Demir',
    assignedDriver: {
      id: 'driver-1',
      name: 'Mehmet Demir',
      rating: 4.8,
      vehicleType: 'Sedan',
      etaMin: 4,
    },
  },
]
