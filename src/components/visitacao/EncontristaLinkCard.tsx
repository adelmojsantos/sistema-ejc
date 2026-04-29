import React from 'react';
import { Link2, Link2Off, ExternalLink, Lock } from 'lucide-react';
import type { VisitaParticipacaoEnriched } from '../../types/visitacao';
import type { InscricaoEnriched } from '../../types/inscricao';

interface EncontristaLinkCardProps {
  participante: InscricaoEnriched;
  vinculo?: VisitaParticipacaoEnriched;
  selectedGrupoId: string;
  isLoading: boolean;
  onVincular: (id: string) => void;
  onDesvincular: (id: string) => void;
}

export const EncontristaLinkCard: React.FC<EncontristaLinkCardProps> = ({
  participante,
  vinculo,
  selectedGrupoId,
  isLoading,
  onVincular,
  onDesvincular
}) => {
  const isLinkedToSelected = vinculo?.grupo_id === selectedGrupoId;
  const isLinkedToOther = vinculo && vinculo.grupo_id !== selectedGrupoId;
  const pessoa = participante.pessoas;

  return (
    <div className={`item-link-card compact ${vinculo ? 'linked' : ''} ${isLinkedToSelected ? 'selected' : ''} ${isLinkedToOther ? 'busy' : ''}`}>
      <div className="item-link-card-info" style={{ flex: 1 }}>
        <h4 className="item-link-card-name" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          {pessoa?.nome_completo}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
          <span className="item-link-card-address" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {pessoa?.endereco}{pessoa?.numero ? `, ${pessoa.numero}` : ''} - {pessoa?.bairro || 'Sem Bairro'}
          </span>
          <a
            href={
              pessoa?.latitude && pessoa?.longitude
                ? `https://www.google.com/maps/search/?api=1&query=${pessoa.latitude},${pessoa.longitude}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pessoa?.endereco || ''}, ${pessoa?.numero || ''}, ${pessoa?.bairro || ''}, Franca, SP`)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover-opacity"
            title="Abrir no Google Maps"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} /> Ver no Mapa
          </a>
        </div>
      </div>

      <div className="item-link-card-actions">
        {!vinculo ? (
          <button
            onClick={() => onVincular(participante.id)}
            disabled={isLoading || !selectedGrupoId}
            className="btn-primary-sm btn-icon"
            style={{ padding: '0.5rem' }}
            title={selectedGrupoId ? 'Vincular' : 'Selecione uma Dupla'}
          >
            <Link2 size={18} />
          </button>
        ) : (
          isLinkedToSelected ? (
            <button
              onClick={() => onDesvincular(vinculo.id)}
              disabled={isLoading}
              className="btn-outline-danger-sm btn-icon"
              style={{ padding: '0.5rem' }}
              title="Desvincular"
            >
              <Link2Off size={18} />
            </button>
          ) : (
            <div className="busy-badge" title={`Vinculado em ${vinculo.visita_grupos?.nome}`} style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--muted-text)', background: 'var(--border-color)', borderRadius: '8px' }}>
              <Lock size={16} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{vinculo.visita_grupos?.nome?.split(' ')[0]}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
};
