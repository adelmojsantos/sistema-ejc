import L from 'leaflet';
import teamMapMarker from '../assets/team-map-marker.png';

export const teamMapMarkerIcon = L.icon({
  iconUrl: teamMapMarker,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

/**
 * Usa o mesmo pin do mapa da equipe e acrescenta um número na área circular.
 */
export function createNumberedMarkerIcon(number: number): L.DivIcon {
  const label = Number.isFinite(number) ? Math.max(1, Math.trunc(number)) : 1;

  return L.divIcon({
    className: 'leaflet-numbered-marker',
    html: `<span class="leaflet-numbered-marker__pin" style="background-image:url('${teamMapMarker}')"><span class="leaflet-numbered-marker__label">${label}</span></span>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}
