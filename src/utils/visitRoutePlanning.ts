import { getPlanningCoordinate, isRouteReadyLocation, type PersonGeolocationMetadata } from '../types/geolocation';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface VisitRouteStop extends PersonGeolocationMetadata {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  cep?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(from: RouteCoordinate, to: RouteCoordinate): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const latitudeA = toRadians(from.latitude);
  const latitudeB = toRadians(to.latitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function suggestVisitRoute<T extends VisitRouteStop>(
  visits: T[],
  start?: RouteCoordinate | null,
): T[] {
  const ready = visits.filter(visit => getPlanningCoordinate(visit) != null);
  const unavailable = visits.filter(visit => getPlanningCoordinate(visit) == null);
  if (ready.length < 2) return [...ready, ...unavailable];

  const remaining = [...ready];
  const ordered: T[] = [];
  let cursor = start || {
    latitude: getPlanningCoordinate(remaining[0])!.latitude,
    longitude: getPlanningCoordinate(remaining[0])!.longitude,
  };

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((visit, index) => {
      const distance = haversineDistanceKm(cursor, getPlanningCoordinate(visit)!);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    const [nearest] = remaining.splice(nearestIndex, 1);
    ordered.push(nearest);
    cursor = getPlanningCoordinate(nearest)!;
  }

  return [...ordered, ...unavailable];
}

export function buildGoogleMapsRouteUrl(visits: VisitRouteStop[]): string | null {
  // Four stops are portable across desktop and mobile Google Maps URLs.
  const ready = visits.filter(visit => getNavigationDestination(visit) != null).slice(0, 4);
  if (ready.length === 0) return null;
  const destination = ready.at(-1)!;
  const params = new URLSearchParams({
    api: '1',
    destination: getNavigationDestination(destination)!,
    travelmode: 'driving',
  });
  if (ready.length > 1) {
    params.set('waypoints', ready.slice(0, -1).map(visit => getNavigationDestination(visit)!).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsStopUrl(visit: VisitRouteStop): string | null {
  const destination = getNavigationDestination(visit);
  if (!destination) return null;
  const params = new URLSearchParams({ api: '1', query: destination });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildWazeStopUrl(visit: VisitRouteStop): string | null {
  const destination = getNavigationDestination(visit);
  if (!destination) return null;
  const params = new URLSearchParams({ navigate: 'yes', utm_source: 'sistema_ejc' });
  if (isRouteReadyLocation(visit)) params.set('ll', destination);
  else params.set('q', destination);
  return `https://www.waze.com/ul?${params.toString()}`;
}

export function buildNavigationAddress(visit: VisitRouteStop): string | null {
  if (!visit.endereco?.trim() || !visit.numero?.trim() || !visit.cidade?.trim() || !visit.estado?.trim()) return null;
  return [
    `${visit.endereco.trim()}, ${visit.numero.trim()}`,
    visit.bairro?.trim(),
    `${visit.cidade.trim()} - ${visit.estado.trim().toUpperCase()}`,
    visit.cep?.replace(/\D/g, ''),
    'Brasil',
  ].filter(Boolean).join(', ');
}

function getNavigationDestination(visit: VisitRouteStop): string | null {
  if (isRouteReadyLocation(visit)) return `${visit.latitude},${visit.longitude}`;
  return buildNavigationAddress(visit);
}
