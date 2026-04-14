import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { useMemo } from 'react';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { VisitaParticipacaoEnriched } from '../../types/visitacao';
import { Users, CheckCircle2, MapPin, Trash2 } from 'lucide-react';
import { applyJitter } from '../../utils/geocoding';

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

// Custom Icons for Linked vs Available
const AvailableIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const LinkedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface EncontristaMapProps {
  participantes: InscricaoEnriched[];
  vinculos: VisitaParticipacaoEnriched[];
  selectedGrupoId: string;
  onVincular: (participacaoId: string) => void;
  onDesvincular?: (vinculoId: string) => void;
  onShowUnmappedClick?: () => void;
}

export function EncontristaMap({ participantes, vinculos, selectedGrupoId, onVincular, onDesvincular, onShowUnmappedClick }: EncontristaMapProps) {
  const markers = useMemo(() => {
    return participantes
      .filter(p => p.pessoas?.latitude && p.pessoas?.longitude)
      .map(p => {
        const vinculo = vinculos.find(v => v.participacao_id === p.id && !v.visitante);
        return {
          id: p.id,
          nome: p.pessoas?.nome_completo,
          bairro: p.pessoas?.bairro,
          coords: applyJitter([p.pessoas!.latitude!, p.pessoas!.longitude!]),
          isLinked: !!vinculo,
          vinculoGrupo: vinculo?.visita_grupos?.nome,
          vinculoGrupoId: vinculo?.grupo_id,
          vinculoId: vinculo?.id
        };
      });
  }, [participantes, vinculos]);

  const center: [number, number] = [-20.5383, -47.4008]; // Franca, SP center

  return (
    <div className="card" style={{ height: '600px', position: 'relative', overflow: 'hidden', padding: 0 }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map(m => (
          <Marker 
            key={m.id} 
            position={m.coords} 
            icon={m.isLinked ? LinkedIcon : AvailableIcon}
          >
            <Popup className="custom-map-popup">
              <div className="map-popup-container">
                <div className="map-popup-header">
                  <h4 className="map-popup-name">{m.nome}</h4>
                  <span className="map-popup-bairro">{m.bairro || 'Bairro ñ informado'}</span>
                </div>
                
                {m.isLinked ? (
                  <div className="flex-col gap-2">
                    <div className="map-popup-linked-badge">
                      <CheckCircle2 size={14} />
                      <span>Vinculado a: <strong>{m.vinculoGrupo}</strong></span>
                    </div>
                    {m.vinculoGrupoId === selectedGrupoId && onDesvincular ? (
                      <button 
                        onClick={() => m.vinculoId && onDesvincular(m.vinculoId)}
                        className="btn-outline-danger-sm w-full"
                        style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Trash2 size={14} /> Desvincular
                      </button>
                    ) : (
                      <div style={{ marginTop: '8px', fontSize: '0.75rem', textAlign: 'center', opacity: 0.6 }}>
                        (Vinculado em outra dupla)
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="map-popup-actions">
                    <button 
                      onClick={() => onVincular(m.id)}
                      disabled={!selectedGrupoId}
                      className="btn-primary-sm w-full"
                    >
                      <Users size={14} /> Vincular nesta dupla
                    </button>
                    {!selectedGrupoId && (
                      <span className="map-popup-warning">
                        Selecione uma dupla primeiro
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      <div className="map-legend">
        <div className="map-legend-item">
          <div className="legend-dot available" />
          <span>Disponível</span>
        </div>
        <div className="map-legend-item">
          <div className="legend-dot linked" />
          <span>Já vinculado</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.5 }}>
          {markers.length} de {participantes.length} mapeados
        </div>
      </div>

      {participantes.length > 0 && markers.length < participantes.length && (
        <div 
          onClick={onShowUnmappedClick}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 1000,
            backgroundColor: 'var(--card-bg)',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            border: '1px solid var(--border-color)',
            color: 'var(--text-color)',
            backdropFilter: 'blur(8px)',
            cursor: onShowUnmappedClick ? 'pointer' : 'default'
          }}
          className={onShowUnmappedClick ? 'hover-opacity' : ''}
        >
          <MapPin size={14} style={{ color: 'var(--accent-color)' }} />
          <span>{participantes.length - markers.length} s/ coordenadas</span>
        </div>
      )}

      <style>{`
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background-color: var(--card-bg) !important;
          color: var(--text-color) !important;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-float);
        }
        .custom-map-popup .leaflet-popup-content {
          margin: 0;
          width: 250px !important;
        }
        .map-popup-container {
          padding: 1.25rem;
        }
        .map-popup-header {
          margin-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 0.75rem;
        }
        .map-popup-name {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-color);
        }
        .map-popup-bairro {
          font-size: 0.75rem;
          opacity: 0.6;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-color);
        }
        .map-popup-linked-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background-color: var(--success-bg);
          color: var(--success-text);
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .map-popup-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .map-popup-warning {
          font-size: 0.7rem;
          color: var(--danger-text);
          font-style: italic;
          text-align: center;
        }
        .btn-primary-sm {
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: filter 0.2s;
        }
        .btn-primary-sm:hover {
          filter: brightness(1.1);
        }
        .btn-primary-sm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
