/**
 * Haversine formula — find the nearest location from a list of cities
 * given the user's GPS coordinates.
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationWithCoords {
  slug: string;
  latitude: number | null;
  longitude: number | null;
}

/** Earth's mean radius in kilometres */
const EARTH_RADIUS_KM = 6371;

/** Convert degrees → radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance (km) between two points
 * using the Haversine formula.
 */
function haversineDistance(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      sinHalfLng *
      sinHalfLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Given the user's coordinates and a list of locations (with lat/lng),
 * return the slug of the nearest location.
 *
 * Returns `null` if no locations have valid coordinates.
 */
export function findNearestLocation(
  userCoords: Coordinates,
  locations: LocationWithCoords[]
): string | null {
  let nearestSlug: string | null = null;
  let nearestDistance = Infinity;

  for (const loc of locations) {
    if (loc.latitude == null || loc.longitude == null) continue;

    const distance = haversineDistance(userCoords, {
      latitude: loc.latitude,
      longitude: loc.longitude,
    });

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSlug = loc.slug;
    }
  }

  return nearestSlug;
}
