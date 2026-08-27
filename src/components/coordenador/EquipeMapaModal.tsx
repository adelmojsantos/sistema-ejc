import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, ExternalLink, Loader, MapPin, Pencil, RefreshCw } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import type { Pessoa } from '../../types/pessoa';
import { getPlanningCoordinate, hasRegionalReference } from '../../types/geolocation';
import { geolocationService } from '../../services/geolocationService';
import { createNumberedMarkerIcon, teamMapMarkerIcon } from '../../utils/leafletMarkerIcon';

interface TeamMemberForMap {
  pessoa_id: string;
  pessoas: Pessoa;
  coordenador?: boolean | null;
}

interface EquipeMapaModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipeNome: string;
  members: TeamMemberForMap[];
  onUpdated?: () => Promise<void> | void;
  onEditMember?: (personId: string) => void;
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
  const address = [pessoa.endereco, pessoa.numero, pessoa.bairro, pessoa.cidade, pessoa.estado, pessoa.cep]
    .map(value => value?.trim()).filter(Boolean).join(', ');
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

function canUpdateLocation(pessoa: Pessoa) {
  return Boolean(pessoa.endereco?.trim() && pessoa.cidade?.trim()
    && (pessoa.estado?.trim() || pessoa.cidade.trim().localeCompare('Franca', 'pt-BR', { sensitivity: 'base' }) === 0));
}

interface AddressIssue {
  label: string;
  retryable: boolean;
}

function getAddressIssue(pessoa: Pessoa): AddressIssue | null {
  if (!pessoa.endereco?.trim()) return { label: 'Falta informar o logradouro', retryable: false };
  if (!pessoa.cidade?.trim()) return { label: 'Falta informar a cidade', retryable: false };
  const isFranca = pessoa.cidade.trim().localeCompare('Franca', 'pt-BR', { sensitivity: 'base' }) === 0;
  if (!pessoa.estado?.trim() && !isFranca) return { label: 'Falta informar o estado (UF)', retryable: false };

  switch (pessoa.geo_failure_code) {
    case 'missing_street':
      return { label: 'Falta informar o logradouro', retryable: false };
    case 'missing_city':
      return { label: 'Falta informar a cidade', retryable: false };
    case 'missing_state':
      return { label: 'Falta informar o estado (UF)', retryable: false };
    case 'incomplete_address':
      return { label: 'Endereço incompleto', retryable: false };
    case 'cep_not_found':
      return { label: 'CEP não encontrado', retryable: false };
    case 'cep_selection_required':
      return { label: 'Mais de um CEP possível', retryable: false };
    case 'cep_address_mismatch':
      return { label: 'CEP não corresponde à cidade/UF', retryable: false };
    case 'manual_confirmation_required':
      return { label: 'Endereço não localizado', retryable: false };
    case 'provider_unavailable':
      return { label: 'Serviço de localização indisponível', retryable: true };
    default:
      return null;
  }
}

function getFailureMessage(code: string | null): string {
  const messages: Record<string, string> = {
    missing_street: 'Falta informar o logradouro.',
    missing_city: 'Falta informar a cidade.',
    missing_state: 'Falta informar o estado (UF).',
    incomplete_address: 'O endereço está incompleto.',
    cep_not_found: 'Não foi possível encontrar o CEP deste endereço.',
    cep_selection_required: 'Há mais de um CEP possível. Revise o endereço para selecionar o correto.',
    cep_address_mismatch: 'O CEP não corresponde à cidade ou ao estado informado.',
    manual_confirmation_required: 'Não foi possível localizar este endereço. Revise os dados cadastrados.',
    provider_unavailable: 'O serviço de localização está indisponível. Tente novamente.',
  };
  return code ? messages[code] ?? 'Não foi possível atualizar a localização.' : 'Não foi possível atualizar a localização.';
}

function getMapCoordinate(pessoa: Pessoa) {
  if (hasRegionalReference(pessoa)) {
    return {
      latitude: pessoa.geo_reference_latitude!,
      longitude: pessoa.geo_reference_longitude!,
      exact: false,
    };
  }
  return getPlanningCoordinate(pessoa);
}

export function EquipeMapaModal({ isOpen, onClose, equipeNome, members, onUpdated, onEditMember }: EquipeMapaModalProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const mapMembers = useMemo(
    () => members.filter(member => !member.coordenador),
    [members],
  );
  const mappedMembers = useMemo(
    () => mapMembers.flatMap(member => {
      const coordinate = getMapCoordinate(member.pessoas);
      return coordinate ? [{ ...member, coordinate }] : [];
    }),
    [mapMembers],
  );
  const unmappedMembers = useMemo(
    () => mapMembers.filter(member => !getMapCoordinate(member.pessoas)),
    [mapMembers],
  );
  const markerGroups = useMemo(() => {
    const groups = new Map<string, { coordinate: { latitude: number; longitude: number }; members: typeof mappedMembers }>();
    for (const member of mappedMembers) {
      const key = `${member.coordinate.latitude.toFixed(6)}:${member.coordinate.longitude.toFixed(6)}`;
      const group = groups.get(key);
      if (group) {
        group.members.push(member);
      } else {
        groups.set(key, {
          coordinate: {
            latitude: member.coordinate.latitude,
            longitude: member.coordinate.longitude,
          },
          members: [member],
        });
      }
    }
    return [...groups.values()];
  }, [mappedMembers]);
  const points = useMemo(
    () => markerGroups.map(group => [group.coordinate.latitude, group.coordinate.longitude] as [number, number]),
    [markerGroups],
  );
  const center: [number, number] = points[0] ?? [-20.5383, -47.4008];

  const updateMember = async (member: TeamMemberForMap, notify = true) => {
    setUpdatingId(member.pessoa_id);
    try {
      const result = await geolocationService.geocodeTeamMember(member.pessoa_id);
      if (result.candidate) {
        if (notify) toast.success('Localização aproximada atualizada.');
        return true;
      }
      if (notify) toast.error(getFailureMessage(result.failureCode));
      return false;
    } catch {
      if (notify) toast.error('Não foi possível atualizar a localização.');
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const updatePending = async () => {
    const eligible = unmappedMembers.filter((member) => {
      const issue = getAddressIssue(member.pessoas);
      return canUpdateLocation(member.pessoas) && (!issue || issue.retryable);
    });
    if (eligible.length === 0) {
      toast.error('Nenhum endereço pendente possui dados suficientes para atualização.');
      return;
    }
    setBulkUpdating(true);
    try {
      let updated = 0;
      for (const member of eligible) {
        if (await updateMember(member, false)) updated += 1;
      }
      await onUpdated?.();
      toast.success(`${updated} de ${eligible.length} localizações atualizadas.`);
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mapa da equipe — ${equipeNome || 'Minha equipe'}`} maxWidth="1000px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
            {mappedMembers.length} com localização · {unmappedMembers.length} sem localização. Todos os pontos são aproximados.
          </div>
          {unmappedMembers.length > 0 && (
            <button type="button" className="btn-secondary" disabled={bulkUpdating} onClick={() => void updatePending()}>
              {bulkUpdating ? <Loader className="animate-spin" size={15} /> : <RefreshCw size={15} />}
              Atualizar pendentes
            </button>
          )}
        </div>

        <div style={{ height: 'min(58vh, 560px)', minHeight: '360px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitTeamBounds points={points} />
            {markerGroups.map(group => {
              const firstMember = group.members[0];
              if (!firstMember) return null;
              const isSharedLocation = group.members.length > 1;
              return (
                <Marker
                  key={`${group.coordinate.latitude}:${group.coordinate.longitude}`}
                  position={[group.coordinate.latitude, group.coordinate.longitude]}
                  icon={isSharedLocation ? createNumberedMarkerIcon(group.members.length) : teamMapMarkerIcon}
                >
                  <Popup>
                    {isSharedLocation ? (
                      <div style={{ display: 'grid', gap: '.65rem', minWidth: 220 }}>
                        <div>
                          <strong>{group.members.length} integrantes neste local</strong>
                          <br />
                          <span style={{ color: '#b45309', fontWeight: 700 }}>Localização aproximada</span>
                        </div>
                        {group.members.map(member => {
                          const pessoa = member.pessoas;
                          return (
                            <div key={member.pessoa_id} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '.55rem' }}>
                              <strong>{pessoa.nome_completo}</strong>
                              <br />
                              <span>{[pessoa.endereco, pessoa.numero, pessoa.bairro, pessoa.cidade, pessoa.estado]
                                .map(value => value?.trim())
                                .filter(Boolean)
                                .join(', ')}</span>
                              {mapsUrl(pessoa) && <><br /><a href={mapsUrl(pessoa)!} target="_blank" rel="noopener noreferrer">Abrir rota no Maps</a></>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <strong>{firstMember.pessoas.nome_completo}</strong>
                        <br />
                        <span style={{ color: '#b45309', fontWeight: 700 }}>Localização aproximada</span>
                        <br />
                        {[firstMember.pessoas.endereco, firstMember.pessoas.numero, firstMember.pessoas.bairro, firstMember.pessoas.cidade, firstMember.pessoas.estado]
                          .map(value => value?.trim())
                          .filter(Boolean)
                          .join(', ')}
                        <br />
                        {mapsUrl(firstMember.pessoas) && <a href={mapsUrl(firstMember.pessoas)!} target="_blank" rel="noopener noreferrer">
                          Abrir rota no Maps
                        </a>}
                      </>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <div style={{ display: 'grid', gap: '.55rem' }}>
          {mapMembers.map(member => {
            const mapped = Boolean(getMapCoordinate(member.pessoas));
            const canUpdate = canUpdateLocation(member.pessoas);
            const addressIssue = getAddressIssue(member.pessoas);
            const needsReview = Boolean(addressIssue && !addressIssue.retryable);
            return (
              <div key={member.pessoa_id} style={{ alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 10, display: 'flex', flexWrap: 'wrap', gap: '.6rem', justifyContent: 'space-between', padding: '.7rem .8rem' }}>
                <span style={{ alignItems: 'center', display: 'inline-flex', gap: '.4rem', fontSize: '.84rem', fontWeight: 700 }}>
                  {mapped && !addressIssue ? <MapPin size={15} color="#d97706" /> : <AlertTriangle size={15} color="#f59e0b" />}
                  {member.pessoas.nome_completo}
                  <small style={{ fontWeight: 600, opacity: .65 }}>
                    {addressIssue?.label ?? (mapped ? 'Localização aproximada' : 'Sem localização')}
                  </small>
                </span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                  {mapsUrl(member.pessoas) && <a href={mapsUrl(member.pessoas)!} target="_blank" rel="noopener noreferrer" className="btn-text"><ExternalLink size={14} /> Abrir mapa</a>}
                  {!needsReview && (
                    <button type="button" className="btn-text" disabled={updatingId === member.pessoa_id || bulkUpdating || !canUpdate} onClick={async () => { await updateMember(member); await onUpdated?.(); }}>
                      {updatingId === member.pessoa_id ? <Loader className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                      {addressIssue?.retryable ? 'Tentar novamente' : 'Atualizar localização'}
                    </button>
                  )}
                  {(needsReview || !canUpdate) && onEditMember && <button type="button" className="btn-text" onClick={() => onEditMember(member.pessoa_id)}><Pencil size={14} /> Revisar endereço</button>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
