import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { useMemo } from 'react';
import type { VisitaParticipacaoEnriched } from '../../types/visitacao';
import { CheckCircle2, MapPin, Phone, Car, ChevronRight, TriangleAlert } from 'lucide-react';
import { getPlanningCoordinate } from '../../types/geolocation';
import { buildGoogleMapsStopUrl } from '../../utils/visitRoutePlanning';

// Fix for default marker icons in Leaflet + Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const markerIcon = (color: string) => L.divIcon({
  className: '',
  html: `<span style="display:block;width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 25],
  popupAnchor: [0, -24],
});

const PendingIcon = markerIcon('#f59e0b');
const DoneIcon = markerIcon('#10b981');
const AbsentIcon = markerIcon('#64748b');



interface MyParticipantsMapProps {
  participantes: VisitaParticipacaoEnriched[];
  onSelect: (id: string) => void;
}

export function MyParticipantsMap({ participantes, onSelect }: MyParticipantsMapProps) {
  const markers = useMemo(() => {
    return participantes
      .filter(v => v.participacoes?.pessoas && getPlanningCoordinate(v.participacoes.pessoas))
      .map(v => {
        const pessoa = v.participacoes?.pessoas;
        const coordinate = getPlanningCoordinate(pessoa!)!;
        let icon = PendingIcon;
        if (v.status === 'realizada') icon = DoneIcon;
        else if (v.status === 'ausente') icon = AbsentIcon;


        return {
          id: v.id,
          nome: pessoa?.nome_completo,
          bairro: pessoa?.bairro,
          endereco: `${pessoa?.endereco}, ${pessoa?.numero}`,
          telefone: pessoa?.telefone,
          status: v.status,
          coords: [coordinate.latitude, coordinate.longitude] as [number, number],
          exact: coordinate.exact,
          mapsUrl: buildGoogleMapsStopUrl({ ...pessoa!, id: v.id }),
          icon
        };
      });
  }, [participantes]);

  const center: [number, number] = markers.length > 0 
    ? markers[0].coords 
    : [-20.5383, -47.4008]; // Franca, SP default
  const hasApproximateLocations = markers.some((marker) => !marker.exact);

  return (
    <div className="card" style={{ height: 'calc(100vh - 350px)', minHeight: '500px', position: 'relative', overflow: 'hidden', padding: 0 }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map(m => (
          <Marker 
            key={m.id} 
            position={m.coords} 
            icon={m.icon}
          >
            <Popup className="custom-map-popup">
              <div className="map-popup-container">
                <div className="map-popup-header" style={{ marginBottom: '0.75rem' }}>
                  <h4 className="map-popup-name" style={{ fontSize: '0.95rem', margin: 0 }}>{m.nome}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                    <MapPin size={12} />
                    <span>{m.bairro}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, marginTop: '0.3rem', color: m.exact ? '#059669' : '#b45309' }}>
                    {m.exact ? 'PONTO EXATO' : 'Localização aproximada'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                        <Car size={14} style={{ opacity: 0.5 }} />
                        <span>{m.endereco}</span>
                    </div>
                    {m.telefone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                            <Phone size={14} style={{ opacity: 0.5 }} />
                            <span>{m.telefone}</span>
                        </div>
                    )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '6px', 
                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                        textTransform: 'uppercase', width: 'fit-content',
                        backgroundColor: 
                            m.status === 'realizada' ? 'rgba(16, 185, 129, 0.1)' : 
                            m.status === 'pendente' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color: 
                            m.status === 'realizada' ? '#059669' : 
                            m.status === 'pendente' ? '#f59e0b' : '#64748b'
                    }}>
                        {m.status === 'realizada' && <CheckCircle2 size={12} />}
                        {m.status}
                    </div>

                    <button 
                      onClick={() => onSelect(m.id)}
                      className="btn-primary-sm w-full"
                      style={{ marginTop: '0.5rem', padding: '0.6rem' }}
                    >
                      Registrar Visita <ChevronRight size={14} />
                    </button>
                    
                    {m.mapsUrl && <a
                        href={m.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline-sm w-full"
                        style={{ textAlign: 'center', fontSize: '0.75rem', padding: '0.4rem', textDecoration: 'none', display: 'block' }}
                    >
                        Abrir no Maps
                    </a>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {hasApproximateLocations && (
        <div className="map-location-notice" role="note">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>Algumas localizações são aproximadas.</span>
        </div>
      )}
      
      <div className="map-legend" style={{ bottom: '10px', left: '10px', padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="map-legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#f59e0b' }} />
              <span>Pendente</span>
            </div>
            <div className="map-legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#10b981' }} />
              <span>Realizada</span>
            </div>
            <div className="map-legend-item">
              <div className="legend-dot" style={{ backgroundColor: '#64748b' }} />
              <span>Ausente</span>
            </div>
        </div>
      </div>

      <style>{`
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background-color: var(--card-bg) !important;
          color: var(--text-color) !important;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-float);
        }
        .custom-map-popup .leaflet-popup-content {
          margin: 0;
          width: 200px !important;
        }
        .map-popup-container {
          padding: 1rem;
        }
        .map-popup-name {
          font-weight: 700;
          color: var(--text-color);
        }
        .map-location-notice {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          max-width: min(320px, calc(100% - 20px));
          padding: 0.55rem 0.75rem;
          border: 1px solid rgba(217, 119, 6, 0.4);
          border-radius: 8px;
          background: color-mix(in srgb, var(--card-bg) 94%, #d97706 6%);
          color: var(--text-color);
          box-shadow: var(--shadow-md);
          font-size: 0.78rem;
          font-weight: 600;
        }
        .map-location-notice svg {
          flex-shrink: 0;
          color: #d97706;
        }
        .btn-outline-sm {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-color);
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-outline-sm:hover {
            background: var(--secondary-bg);
            border-color: var(--primary-color);
        }
      `}</style>
    </div>
  );
}
