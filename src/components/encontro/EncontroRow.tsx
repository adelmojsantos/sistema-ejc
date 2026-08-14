import { Calendar, Check, Copy, LayoutGrid, LinkIcon, MapPin, Music, Pencil, Quote, Trash2, Youtube } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import type { Encontro } from '../../types/encontro';
import { buildPublicFormUrl } from '../../utils/publicFormUrl';

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
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = buildPublicFormUrl(encontro.id);
        navigator.clipboard.writeText(url);
        
        setCopied(true);
        toast.success('Link copiado!');
        
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`pessoa-row container-encontro-row ${encontro.ativo ? 'is-active' : ''}`}>
            <div className="encontro-row-layout">
                {/* Zona 1: Encontro + Data */}
                <div className="encontro-summary-zone">
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
                <div className="encontro-actions">
                    <button 
                        className={`icon-btn quadrante-btn ${encontro.ativo ? 'active-encounter' : 'historical-encounter'}`}
                        onClick={() => navigate(`/cadastros/encontros/${encontro.id}/quadrante`)} 
                        title={encontro.ativo ? 'Configurar Quadrante' : 'Ver Quadrante'}
                    >
                        <LayoutGrid size={15} />
                        <span>{encontro.ativo ? 'Configurar Quadrante' : 'Ver Quadrante'}</span>
                        {encontro.quadrante_ativo ? (
                            <span className="quadrante-status-dot active" />
                        ) : (
                            <span className="quadrante-status-dot inactive" />
                        )}
                    </button>
                    <button className="icon-btn" onClick={() => onEdit(encontro)} title="Editar">
                        <Pencil size={16} />
                        <span className="encontro-action-label">Editar</span>
                    </button>
                    <button className="icon-btn icon-btn-danger" onClick={() => onDelete(encontro)} title="Excluir">
                        <Trash2 size={16} />
                        <span className="encontro-action-label">Excluir</span>
                    </button>
                </div>
            </div>

            <style>{`
                .container-encontro-row {
                    position: relative;
                    display: block;
                    overflow: visible;
                    container-type: inline-size;
                }
                .container-encontro-row.is-active { border-left: 4px solid #10b981 !important; }
                .encontro-row-layout {
                    display: grid;
                    grid-template-columns: minmax(180px, 1fr) 1px minmax(130px, 0.7fr) 1px minmax(200px, 1fr);
                    align-items: start;
                    gap: 1rem;
                    min-width: 0;
                    width: 100%;
                }

                .container-encontro-row .encontro-actions {
                    display: flex;
                    gap: 0.5rem;
                    grid-column: 1 / -1;
                    justify-self: stretch;
                    justify-content: flex-end;
                    align-self: stretch;
                    align-items: center;
                    flex-wrap: wrap;
                    width: 100%;
                    min-width: 0;
                    padding-top: 0.75rem;
                    border-top: 1px solid var(--border-color);
                }

                .container-encontro-row .encontro-actions .icon-btn {
                    flex: 0 0 auto;
                    width: auto;
                    height: 40px;
                    min-height: 40px;
                    gap: 0.45rem;
                    padding: 0.45rem 0.75rem;
                }
                .container-encontro-row .encontro-actions .icon-btn-danger {
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.45);
                    background: rgba(239, 68, 68, 0.06);
                }
                .container-encontro-row .encontro-actions .icon-btn-danger:hover {
                    color: #fff;
                    border-color: #ef4444;
                    background: #ef4444;
                }
                
                .title-with-badge { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
                .badge-ativo-pill { background: #10b981; color: white; font-size: 0.6rem; font-weight: 800; padding: 1px 6px; border-radius: 4px; }
                .bg-active { background: #10b981 !important; color: white !important; }
                .bg-dim { background: #94a3b8 !important; color: white !important; }
                
                .meta-info { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; opacity: 0.7; }
                .desktop-divider { width: 1px; height: 32px; background: var(--border-color); opacity: 0.5; }
                .encontro-summary-zone { display: flex; align-items: center; gap: 1rem; min-width: 0; }
                
                .encontro-local-zone { display: flex; flex-direction: column; justify-content: center; gap: 4px; min-width: 0; }
                .section-label { font-size: 0.65rem; font-weight: 800; opacity: 0.5; letter-spacing: 0.05em; margin-bottom: 2px; }
                .local-text { font-size: 0.85rem; font-weight: 500; opacity: 0.9; }
                .no-info { font-size: 0.8rem; opacity: 0.4; font-style: italic; }

                .encontro-mid-section { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
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
                .quadrante-btn { display: flex !important; align-items: center; gap: 5px; padding: 0.35rem 0.75rem !important; border-radius: 8px !important; font-size: 0.75rem !important; font-weight: 700 !important; white-space: nowrap; width: auto !important; }
                .quadrante-btn.active-encounter { background: rgba(59,130,246,0.1) !important; border: 1px solid rgba(59,130,246,0.35) !important; color: var(--primary-color) !important; }
                .quadrante-btn.active-encounter:hover { background: var(--primary-color) !important; color: white !important; border-color: var(--primary-color) !important; }
                .quadrante-btn.historical-encounter { background: transparent !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; opacity: 0.78; }
                .quadrante-btn.historical-encounter:hover { background: var(--secondary-bg) !important; border-color: rgba(148, 163, 184, 0.65) !important; color: var(--text-color) !important; opacity: 1; }
                .quadrante-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
                .quadrante-status-dot.active { background: #10b981; box-shadow: 0 0 5px #10b981; }
                .quadrante-status-dot.inactive { background: #94a3b8; }
                .encontro-action-label {
                    display: inline;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                @keyframes check-pop {
                    0% { transform: scale(0.5) rotate(-20deg); opacity: 0; }
                    100% { transform: scale(1) rotate(0); opacity: 1; }
                }

                @container (max-width: 760px) {
                    .encontro-row-layout {
                        grid-template-columns: 1fr;
                        align-items: stretch;
                        gap: 0.75rem;
                    }
                    .desktop-divider { display: none; }
                    .encontro-summary-zone { width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; }
                    .encontro-local-zone { width: 100%; min-width: 0; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color); }
                    .encontro-mid-section { width: 100%; min-width: 0; padding-top: 0.25rem; }
                    .encontro-actions {
                        grid-column: 1 / -1;
                        width: 100%;
                        justify-content: flex-end;
                        flex-wrap: wrap;
                        padding-top: 0.75rem;
                        background: transparent;
                        border-top: 1px solid var(--border-color);
                    }
                }

                @container (max-width: 520px) {
                    .container-encontro-row .encontro-actions {
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        justify-content: stretch;
                        gap: 0.4rem;
                    }
                    .encontro-actions .quadrante-btn {
                        grid-column: 1 / -1;
                        justify-content: center;
                        width: 100% !important;
                    }
                    .encontro-actions .icon-btn:not(.quadrante-btn) {
                        width: 100%;
                        height: auto;
                        min-height: 36px;
                        min-width: 0;
                        gap: 0.45rem;
                        padding: 0.45rem 0.65rem;
                    }
                    .encontro-row-layout { gap: 0.5rem; }
                    .title-with-badge { padding-right: 0; }
                }
            `}</style>
        </div>
    );
}
