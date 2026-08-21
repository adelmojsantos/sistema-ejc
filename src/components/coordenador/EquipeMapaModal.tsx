import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ExternalLink, MapPin } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import type { Pessoa } from '../../types/pessoa';
import { getPlanningCoordinate } from '../../types/geolocation';
import { buildGoogleMapsStopUrl } from '../../utils/visitRoutePlanning';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const teamIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const regionalIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:20px;height:20px;border-radius:50%;background:#f59e0b;border:3px dashed white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

interface TeamMemberForMap {
  pessoa_id: string;
  pessoas: Pessoa;
}

interface EquipeMapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipeNome: string;
  members: TeamMemberForMap[];
}

function FitTeamBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24] });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [map, points]);

  return null;
}

function mapsUrl(pessoa: Pessoa): string | null {
  return buildGoogleMapsStopUrl({ ...pessoa, id: pessoa.id });
}

export function EquipeMapaModal({ isOpen, onClose, equipeNome, members }: EquipeMapaModalProps) {
  const mappedMembers = useMemo(
    () => members.flatMap(member => {
      const coordinate = getPlanningCoordinate(member.pessoas);
      return coordinate ? [{ ...member, coordinate }] : [];
    }),
    [members],
  );
  const unmappedMembers = useMemo(
    () => members.filter(member => !getPlanningCoordinate(member.pessoas)),
    [members],
  );
  const points = useMemo(
    () => mappedMembers.map(member => [member.coordinate.latitude, member.coordinate.longitude] as [number, number]),
    [mappedMembers],
  );
  const center: [number, number] = points[0] ?? [-20.5383, -47.4008];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mapa da equipe — ${equipeNome || 'Minha equipe'}`} maxWidth="1000px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {mappedMembers.length} de {members.length} integrantes possuem referência no mapa. Pontos laranja são aproximados e servem apenas para conhecer a região.
        </div>

        <div style={{ height: 'min(58vh, 560px)', minHeight: '360px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitTeamBounds points={points} />
            {mappedMembers.map(member => {
              const pessoa = member.pessoas;
              return (
                <Marker key={member.pessoa_id} position={[member.coordinate.latitude, member.coordinate.longitude]} icon={member.coordinate.exact ? teamIcon : regionalIcon}>
                  <Popup>
                    <strong>{pessoa.nome_completo}</strong>
                    <br />
                    <span style={{ color: member.coordinate.exact ? '#059669' : '#b45309', fontWeight: 700 }}>
                      {member.coordinate.exact ? 'Ponto exato' : 'Localização aproximada'}
                    </span>
                    <br />
                    {[pessoa.endereco, pessoa.numero, pessoa.bairro, pessoa.cidade, pessoa.estado]
                      .map(value => value?.trim())
                      .filter(Boolean)
                      .join(', ')}
                    <br />
                    {mapsUrl(pessoa) && <a href={mapsUrl(pessoa)!} target="_blank" rel="noopener noreferrer">
                      Abrir rota no Maps
                    </a>}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {unmappedMembers.length > 0 && (
          <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              Sem localização ({unmappedMembers.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.8rem' }}>
              {unmappedMembers.map(member => (
                <span key={member.pessoa_id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <MapPin size={13} /> {member.pessoas.nome_completo}
                </span>
              ))}
            </div>
          </div>
        )}

        {mappedMembers.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {mappedMembers.filter(member => mapsUrl(member.pessoas)).map(member => (
              <a key={member.pessoa_id} href={mapsUrl(member.pessoas)!} target="_blank" rel="noopener noreferrer" className="btn-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <ExternalLink size={14} /> {member.pessoas.nome_completo}
              </a>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
