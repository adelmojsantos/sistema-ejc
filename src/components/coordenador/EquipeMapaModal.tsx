import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ExternalLink, MapPin } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import type { Pessoa } from '../../types/pessoa';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const teamIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
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

function mapsUrl(pessoa: Pessoa): string {
  const query = [pessoa.endereco, pessoa.numero, pessoa.bairro, pessoa.cidade, pessoa.estado, 'Brasil']
    .map(value => value?.trim())
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function EquipeMapaModal({ isOpen, onClose, equipeNome, members }: EquipeMapaModalProps) {
  const mappedMembers = useMemo(
    () => members.filter(member => member.pessoas.latitude != null && member.pessoas.longitude != null),
    [members],
  );
  const unmappedMembers = useMemo(
    () => members.filter(member => member.pessoas.latitude == null || member.pessoas.longitude == null),
    [members],
  );
  const points = useMemo(
    () => mappedMembers.map(member => [member.pessoas.latitude!, member.pessoas.longitude!] as [number, number]),
    [mappedMembers],
  );
  const center: [number, number] = points[0] ?? [-20.5383, -47.4008];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mapa da equipe — ${equipeNome || 'Minha equipe'}`} maxWidth="1000px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          {mappedMembers.length} de {members.length} integrantes possuem localização cadastrada.
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
                <Marker key={member.pessoa_id} position={[pessoa.latitude!, pessoa.longitude!]} icon={teamIcon}>
                  <Popup>
                    <strong>{pessoa.nome_completo}</strong>
                    <br />
                    {[pessoa.endereco, pessoa.numero, pessoa.bairro, pessoa.cidade, pessoa.estado]
                      .map(value => value?.trim())
                      .filter(Boolean)
                      .join(', ')}
                    <br />
                    <a href={mapsUrl(pessoa)} target="_blank" rel="noopener noreferrer">
                      Abrir rota no Maps
                    </a>
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
            {mappedMembers.map(member => (
              <a key={member.pessoa_id} href={mapsUrl(member.pessoas)} target="_blank" rel="noopener noreferrer" className="btn-text" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <ExternalLink size={14} /> {member.pessoas.nome_completo}
              </a>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
