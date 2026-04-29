import React from 'react';
import { Shield, Users, Edit2, Trash2, Check, X } from 'lucide-react';
import type { VisitaGrupo, VisitaParticipacaoEnriched } from '../../types/visitacao';

interface DuoCardProps {
  grupo: VisitaGrupo;
  vinculos: VisitaParticipacaoEnriched[];
  isEditing: boolean;
  tempName: string;
  onEdit: (id: string, currentName: string) => void;
  onCancelEdit: () => void;
  onSaveName: () => void;
  onTempNameChange: (name: string) => void;
  onDelete: (id: string) => void;
}

export const DuoCard: React.FC<DuoCardProps> = ({
  grupo,
  vinculos,
  isEditing,
  tempName,
  onEdit,
  onCancelEdit,
  onSaveName,
  onTempNameChange,
  onDelete
}) => {
  const visitantes = vinculos.filter(v => v.grupo_id === grupo.id && v.visitante);
  const totalMembros = vinculos.filter(v => v.grupo_id === grupo.id && !v.visitante).length;

  return (
    <div className="visita-grupo-card" style={{ transition: 'all 0.2s' }}>
      <div className="visita-card-header">
        {isEditing ? (
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <input
              className="form-input"
              style={{ height: '32px', fontSize: '0.9rem', padding: '0 8px' }}
              value={tempName}
              onChange={e => onTempNameChange(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && onSaveName()}
            />
            <button onClick={onSaveName} className="icon-btn text-primary">
              <Check size={16} />
            </button>
            <button onClick={onCancelEdit} className="icon-btn">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <h4 className="visita-card-title">{grupo.nome}</h4>
            <div className="visita-card-actions">
              <button onClick={() => onEdit(grupo.id, grupo.nome || '')} className="icon-btn" title="Editar Nome">
                <Edit2 size={14} />
              </button>
              <button onClick={() => onDelete(grupo.id)} className="icon-btn text-danger" title="Excluir Dupla">
                <Trash2 size={14} />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="visita-card-info-row">
        <div className="visita-card-visitors-inline" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {visitantes.map(v => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 500 }}>
              <Shield size={14} />
              <span>{v.participacoes?.pessoas?.nome_completo?.split(' ')[0]}</span>
            </div>
          ))}
          {visitantes.length === 0 && <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Sem visitantes</span>}
        </div>

        <div className="visita-card-stats-inline" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          <Users size={14} style={{ opacity: 0.6 }} />
          <span style={{ fontWeight: 600 }}>{totalMembros}</span>
        </div>
      </div>
    </div>
  );
};
