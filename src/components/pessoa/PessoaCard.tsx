import type { Pessoa } from '../../types/pessoa';
import { MapPin, Pencil, Trash2 } from 'lucide-react';

interface PessoaCardProps {
    pessoa: Pessoa;
    onEdit: (pessoa: Pessoa) => void;
    onDelete: (pessoa: Pessoa) => void;
}

function formatCpf(cpf: string | null | undefined) {
    if (!cpf) return '—';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatTelefone(tel: string | null | undefined) {
    if (!tel) return '—';
    const d = tel.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}



function getInitials(name: string | null | undefined) {
    if (!name) return '?';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join('');
}

export function PessoaCard({ pessoa, onEdit, onDelete }: PessoaCardProps) {
    return (
        <div className="pessoa-row">
            {/* Avatar + Main Info */}
            <div className="pessoa-row-main">
                <div className="pessoa-avatar small">
                    {getInitials(pessoa.nome_completo)}
                </div>
                <div className="pessoa-row-info">
                    <h3 className="pessoa-row-name">{pessoa.nome_completo}</h3>
                    <span className="pessoa-row-sub">
                        <MapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {pessoa.comunidade}
                    </span>
                </div>
            </div>

            {/* CPF Column (Desktop) */}
            <div className="pessoa-row-col desktop-only">
                <span className="pessoa-row-label">CPF</span>
                <span className="pessoa-row-value">{formatCpf(pessoa.cpf)}</span>
            </div>

            {/* Contact Column */}
            <div className="pessoa-row-col">
                <span className="pessoa-row-label">Contato</span>
                <div className="pessoa-row-value-group">
                    <span className="pessoa-row-value">{formatTelefone(pessoa.telefone)}</span>
                    <span className="pessoa-row-sub">{pessoa.email}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="pessoa-row-actions">
                <button
                    className="icon-btn"
                    onClick={() => onEdit(pessoa)}
                    title="Editar"
                    aria-label="Editar pessoa"
                >
                    <Pencil size={16} />
                </button>
                <button
                    className="icon-btn icon-btn-danger"
                    onClick={() => onDelete(pessoa)}
                    title="Excluir"
                    aria-label="Excluir pessoa"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
