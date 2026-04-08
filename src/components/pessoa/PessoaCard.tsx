import { MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Pessoa } from '../../types/pessoa';

interface PessoaCardProps {
    pessoa: Pessoa;
    onEdit: (pessoa: Pessoa) => void;
    onDelete: (pessoa: Pessoa) => void;
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

function formatAddress(p: Pessoa) {
    const parts = [];
    if (p.endereco) parts.push(p.endereco);
    if (p.numero) parts.push(p.numero);
    if (p.bairro) parts.push(p.bairro);
    if (p.cidade) parts.push(p.cidade);

    if (parts.length === 0) return { fullAddress: 'Endereço não informado', partAddress: '' };

    let fullAddress = p.endereco || '';
    if (p.numero) fullAddress += `, ${p.numero}`;
    if (p.bairro) fullAddress += ` - ${p.bairro}`;
    if (p.cidade) fullAddress += `, ${p.cidade}`;

    let partAddress = p.bairro || '';
    if (p.cidade) partAddress += `, ${p.cidade}`;
    return {
        fullAddress,
        partAddress
    }
}

export function PessoaCard({ pessoa, onEdit, onDelete }: PessoaCardProps) {
    const { fullAddress, partAddress } = formatAddress(pessoa);
    const mapsUrl = fullAddress !== 'Endereço não informado'
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${fullAddress}, Brazil`)}`
        : null;

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
                        <span style={{ opacity: 0.6 }}>{pessoa.comunidade || formatTelefone(pessoa.telefone)}</span>
                    </span>
                </div>
            </div>

            {/* Contact Column — hidden on mobile */}
            <div className="pessoa-row-col desktop-only">
                <span className="pessoa-row-label">Contato</span>
                <div className="pessoa-row-value-group">
                    <span className="pessoa-row-value">{formatTelefone(pessoa.telefone)}</span>
                    {pessoa.email && (
                        <span className="pessoa-row-sub" style={{ opacity: 0.65, fontSize: '0.75rem' }}>
                            {pessoa.email}
                        </span>
                    )}
                </div>
            </div>

            {/* Address Column — tablets and up */}
            {mapsUrl ? (
                <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pessoa-row-col desktop-only"
                    style={{ textDecoration: 'none', color: 'var(--primary-color)' }}
                    title={fullAddress}
                >
                    <span className="pessoa-row-label">Endereço</span>
                    <span className="pessoa-row-value" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={12} style={{ flexShrink: 0 }} />
                        <span style={{ textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {partAddress || fullAddress}
                        </span>
                    </span>
                </a>
            ) : null}

            {/* Actions */}
            <div className="pessoa-row-actions">
                <button
                    className="icon-btn"
                    onClick={() => onEdit(pessoa)}
                    title="Editar"
                    aria-label="Editar pessoa"
                >
                    <Pencil size={15} />
                </button>
                <button
                    className="icon-btn icon-btn-danger"
                    onClick={() => onDelete(pessoa)}
                    title="Excluir"
                    aria-label="Excluir pessoa"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );
}
