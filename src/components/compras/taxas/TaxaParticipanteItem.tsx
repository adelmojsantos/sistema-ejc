import React from 'react';
import { CheckCircle, Loader, XCircle } from 'lucide-react';
import type { InscricaoEnriched } from '../../../types/inscricao';

interface TaxaParticipanteItemProps {
  participante: InscricaoEnriched;
  isUpdating: boolean;
  activeTab: 'encontristas' | 'equipes';
  onToggle: (id: string, currentStatus: boolean) => void;
}

export const TaxaParticipanteItem: React.FC<TaxaParticipanteItemProps> = ({
  participante,
  isUpdating,
  activeTab,
  onToggle
}) => {
  const isPago = participante.pago_taxa;

  return (
    <div className="card" style={{
      padding: '0.8rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1.5rem',
      borderLeft: `4px solid ${isPago ? 'var(--success-border)' : 'var(--danger-border)'}`,
      transition: 'transform 0.2s',
      flexWrap: 'wrap',
      backgroundColor: `${isPago ? 'var(--success-bg)' : 'var(--secondary-bg)'}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1, minWidth: '300px' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.15rem 0', fontWeight: 700 }}>
            {participante.pessoas?.nome_completo}
          </h3>
          <p style={{ fontSize: '0.8rem', margin: 0, opacity: 0.6, fontWeight: 500 }}>
            {activeTab === 'encontristas' 
              ? (participante.pessoas?.cpf || 'Encontrista') 
              : (participante.equipes?.nome || 'Sem Equipe')}
          </p>
        </div>

        <div style={{ minWidth: '110px', textAlign: 'center' }}>
          {isPago ? (
            <span style={{
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-text)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: '1px solid var(--success-border)'
            }}>
              <CheckCircle size={14} /> PAGO
            </span>
          ) : (
            <span style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: '1px solid var(--danger-border)'
            }}>
              <XCircle size={14} /> PENDENTE
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: '180px' }}>
        <button
          className={isPago ? "btn-secondary" : "btn-primary"}
          style={{
            padding: '0.4rem 1.25rem',
            fontSize: '0.8rem',
            minWidth: '160px',
            justifyContent: 'center'
          }}
          disabled={isUpdating}
          onClick={() => onToggle(participante.id, isPago || false)}
        >
          {isUpdating ? (
            <Loader className="animate-spin" size={16} />
          ) : (
            isPago ? 'Estornar' : 'Confirmar'
          )}
        </button>
      </div>
    </div>
  );
};
