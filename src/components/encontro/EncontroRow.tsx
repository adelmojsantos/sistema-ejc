import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Calendar, Check, Copy, LinkIcon, MapPin, Music, Pencil, Quote, Trash2, Youtube } from 'lucide-react';
import type { Encontro } from '../../types/encontro';

interface EncontroRowProps {
    encontro: Encontro;
    onEdit: (encontro: Encontro) => void;
    onDelete: (encontro: Encontro) => void;
}

function formatDateRange(start: string, end: string) {
    if (!start || !end) return '';

    const dStart = new Date(start + 'T00:00:00');
    const dEnd = new Date(end + 'T00:00:00');

    const dates: Date[] = [];
    const current = new Date(dStart);

    while (current <= dEnd) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    const groups: { month: number; year: number; days: number[] }[] = [];

    dates.forEach(date => {
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const day = date.getDate();

        let group = groups.find(g => g.month === month && g.year === year);
        if (!group) {
            group = { month, year, days: [] };
            groups.push(group);
        }
        group.days.push(day);
    });

    const parts = groups.map(g => {
        const formattedDays = g.days.map(d => String(d).padStart(2, '0'));
        let daysStr = '';

        if (formattedDays.length > 1) {
            const lastDay = formattedDays.pop();
            daysStr = formattedDays.join(', ') + ' e ' + lastDay;
        } else {
            daysStr = formattedDays[0];
        }

        const monthStr = String(g.month).padStart(2, '0');
        return `${daysStr}/${monthStr}`;
    });

    const finalYear = groups[groups.length - 1].year;

    if (parts.length === 1) {
        return `${parts[0]}/${finalYear}`;
    }

    const lastPart = parts.pop();
    return parts.join(' e ') + ' e ' + lastPart + '/' + finalYear;
}

export function EncontroRow({ encontro, onEdit, onDelete }: EncontroRowProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/formulario?encontro=${encontro.id}`;
        navigator.clipboard.writeText(url);
        
        setCopied(true);
        toast.success('Link copiado!');
        
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`pessoa-row container-encontro-row ${encontro.ativo ? 'is-active' : ''}`}>
            {/* Zona 1: Encontro + Data */}
            <div className="pessoa-row-main" style={{ flex: '0 0 250px' }}>
                <div className={`pessoa-avatar small ${encontro.ativo ? 'bg-active' : 'bg-dim'}`}>
                    {encontro.edicao ?? '?'}
                </div>
                <div className="pessoa-row-info">
                    <div className="title-with-badge">
                        <h3 className="pessoa-row-name">{encontro.nome}</h3>
                        {encontro.ativo && <span className="badge-ativo-pill">ATIVO</span>}
                    </div>
                    <div className="pessoa-row-sub">
                        <span className="meta-info">
                            <Calendar size={12} />
                            {formatDateRange(encontro.data_inicio, encontro.data_fim)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Divisor Desktop */}
            <div className="desktop-divider" />

            {/* Zona 2: Local */}
            <div className="encontro-local-zone">
                <span className="section-label">LOCAL</span>
                {encontro.local ? (
                    <div className="meta-info">
                        <MapPin size={14} className="icon-dim" />
                        <span className="local-text">{encontro.local}</span>
                    </div>
                ) : (
                    <span className="no-info">Não definido</span>
                )}
            </div>

            {/* Divisor Desktop */}
            <div className="desktop-divider" />

            {/* Zona 3: Tema, Música e Link */}
            <div className="encontro-mid-section">
                {encontro.tema && (
                    <div className="encontro-detail-item tema">
                        <Quote size={12} className="icon-dim" />
                        <span className="musica-nome">{encontro.tema}</span>
                    </div>
                )}
                {encontro.musica && (
                    <div className="encontro-detail-item musica">
                        <Music size={12} className="icon-dim" />
                        <span className="musica-nome">{encontro.musica}</span>
                        <div className="musica-actions">
                            {encontro.link_musica && (
                                <a href={encontro.link_musica} target="_blank" rel="noopener noreferrer" className="mini-link-btn" title="Ouvir">
                                    <Music size={12} />
                                </a>
                            )}
                            {encontro.link_youtube && (
                                <a href={encontro.link_youtube} target="_blank" rel="noopener noreferrer" className="mini-link-btn youtube" title="YouTube">
                                    <Youtube size={12} />
                                </a>
                            )}
                        </div>
                    </div>
                )}
                {encontro.formulario_publico_ativo && (
                    <div className="encontro-detail-item musica">
                        <LinkIcon size={12} className="icon-dim" />
                        <span className="musica-nome">Link Formulários Recepção e Recreação</span>
                        <div className="musica-actions">
                            <button 
                                className={`mini-link-btn ${copied ? 'copied' : ''}`} 
                                onClick={handleCopy}
                                title="Copiar Link"
                            >
                                {copied ? <Check size={12} className="icon-check-anim" /> : <Copy size={12} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Ações */}
            <div className="pessoa-row-actions">
                <button className="icon-btn" onClick={() => onEdit(encontro)} title="Editar">
                    <Pencil size={16} />
                </button>
                <button className="icon-btn icon-btn-danger" onClick={() => onDelete(encontro)} title="Excluir">
                    <Trash2 size={16} />
                </button>
            </div>

            <style>{`
                .container-encontro-row { position: relative; gap: 1.5rem; }
                .container-encontro-row.is-active { border-left: 4px solid #10b981 !important; }
                
                .title-with-badge { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
                .badge-ativo-pill { background: #10b981; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; }
                .bg-active { background: #10b981 !important; color: white !important; }
                .bg-dim { background: #94a3b8 !important; color: white !important; }
                
                .meta-info { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; opacity: 0.7; }
                .desktop-divider { width: 1px; height: 32px; background: var(--border-color); opacity: 0.5; }
                
                .encontro-local-zone { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 150px; }
                .section-label { font-size: 0.65rem; font-weight: 800; opacity: 0.5; letter-spacing: 0.05em; margin-bottom: 2px; }
                .local-text { font-size: 0.85rem; font-weight: 500; opacity: 0.9; }
                .no-info { font-size: 0.8rem; opacity: 0.4; font-style: italic; }

                .encontro-mid-section { flex: 2; display: flex; flex-direction: column; gap: 4px; min-width: 250px; }
                .encontro-detail-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; width: 100%; }
                .encontro-detail-item.tema { font-style: italic; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; opacity: 0.8; }
                .musica-nome { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .icon-dim { opacity: 0.5; flex-shrink: 0; }
                
                .musica-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }
                .mini-link-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: var(--secondary-bg); border: 1px solid var(--border-color); color: var(--text-color); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
                .mini-link-btn:hover { background: var(--primary-color) !important; color: white !important; border-color: var(--primary-color); transform: translateY(-1px); }
                .mini-link-btn.copied { background: #10b981 !important; color: white !important; border-color: #10b981; }
                .mini-link-btn svg { display: block; flex-shrink: 0; transition: transform 0.2s ease; }
                .icon-check-anim { animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

                @keyframes check-pop {
                    0% { transform: scale(0.5) rotate(-20deg); opacity: 0; }
                    100% { transform: scale(1) rotate(0); opacity: 1; }
                }

                @media (max-width: 1100px) {
                    .container-encontro-row { flex-direction: column; align-items: flex-start; padding: 1rem; gap: 0.75rem; border-radius: 12px !important; }
                    .desktop-divider { display: none; }
                    .pessoa-row-main { width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; flex: none !important; }
                    .encontro-local-zone { width: 100%; min-width: 0; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color); }
                    .encontro-mid-section { width: 100%; min-width: 0; padding-top: 0.25rem; }
                    .pessoa-row-actions { position: absolute; top: 0.75rem; right: 0.75rem; padding: 0; background: transparent; border: none; }
                }

                @media (max-width: 640px) {
                    .pessoa-row-actions { top: 0.75rem; right: 0.75rem; scale: 0.85; }
                    .container-encontro-row { gap: 0.5rem; }
                    .title-with-badge { padding-right: 4.5rem; } /* Avoid overlap with actions */
                }
            `}</style>
        </div>
    );
}
