import { User, Shield, Pencil, Trash2, Calendar } from 'lucide-react';
import type { InscricaoEnriched } from '../../types/inscricao';

interface InscricaoRowProps {
    inscricao: InscricaoEnriched;
    onEdit: (inscricao: InscricaoEnriched) => void;
    onDelete: (inscricao: InscricaoEnriched) => void;
}

export function InscricaoRow({ inscricao, onEdit, onDelete }: InscricaoRowProps) {
    const isParticipante = inscricao.participante;
    const isCoordenador = inscricao.coordenador;

    return (
        <div className="pessoa-row">
            <div className="pessoa-row-main">
                <div className="pessoa-avatar small" style={{ backgroundColor: isParticipante ? '#ec4899' : '#10b981' }}>
                    <User size={18} />
                </div>
                <div className="pessoa-row-info">
                    <h3 className="pessoa-row-name">{inscricao.pessoas?.nome_completo || 'Pessoa não encontrada'}</h3>
                    <span className="pessoa-row-sub">
                        <Calendar size={12} style={{ marginRight: 4 }} />
                        {inscricao.encontros?.nome || 'Encontro não encontrado'}
                    </span>
                </div>
            </div>

            <div className="pessoa-row-col desktop-only">
                <span className="pessoa-row-label">Função</span>
                <span className="pessoa-row-value">
                    {isParticipante ? 'Participante' : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Shield size={12} /> {inscricao.equipes?.nome || 'Sem Equipe'}
                            {isCoordenador && <b style={{ color: 'var(--primary-color)', fontSize: '0.7rem' }}>(COORD)</b>}
                        </span>
                    )}
                </span>
            </div>

            <div className="pessoa-row-actions">
                <button className="icon-btn" onClick={() => onEdit(inscricao)} title="Editar"><Pencil size={16} /></button>
                <button className="icon-btn icon-btn-danger" onClick={() => onDelete(inscricao)} title="Excluir"><Trash2 size={16} /></button>
            </div>
        </div>
    );
}
