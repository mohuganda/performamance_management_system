/** Great-circle distance in meters (WGS84 sphere). */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadius = 6_371_000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Same formula as backend LocationAccuracyPercent. */
export function locationAccuracyPercent(distanceM: number, radiusM: number): number {
  if (radiusM <= 0) return 0
  const pct = (1 - distanceM / radiusM) * 100
  if (pct < 0) return 0
  if (pct > 100) return 100
  return pct
}
