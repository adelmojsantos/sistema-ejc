import type { Encontro } from '../../types/encontro';
import { Calendar, MapPin, Pencil, Trash2, Music, Youtube, Quote } from 'lucide-react';

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
    return (
        <div className={`pessoa-row ${encontro.ativo ? 'border-active' : ''}`}>
            {/* Icon + Main Info */}
            <div className="pessoa-row-main">
                <div className={`pessoa-avatar small ${encontro.ativo ? 'bg-active' : 'bg-dim'}`}>
                    {encontro.edicao ?? '?'}
                </div>
                <div className="pessoa-row-info">
                    <h3 className="pessoa-row-name">
                        {encontro.nome}
                        {encontro.ativo && (
                            <span className="badge-active" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>ATIVO</span>
                        )}
                    </h3>
                    <span className="pessoa-row-sub">
                        <Calendar size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {formatDateRange(encontro.data_inicio, encontro.data_fim)}
                    </span>
                </div>
            </div>

            {/* Local Column */}
            <div className="pessoa-row-col desktop-only">
                <span className="pessoa-row-label">Local</span>
                <span className="pessoa-row-value">
                    <MapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle', opacity: 0.5 }} />
                    {encontro.local || 'Não definido'}
                </span>
            </div>

            {/* Coluna Tema e Música */}
            {(encontro.tema || encontro.musica) && (
                <div className="pessoa-row-col">
                    <div className="encontro-details-col">
                        {encontro.tema && (
                            <div className="encontro-tema-text">
                                <Quote size={10} style={{ marginRight: '4px', opacity: 0.5 }} />
                                <span>{encontro.tema}</span>
                            </div>
                        )}
                        {encontro.musica && (
                            <div className="encontro-musica-col-content">
                                <span className="pessoa-row-value" style={{ fontSize: '0.85rem' }}>
                                    <Music size={12} style={{ marginRight: '4px', opacity: 0.5 }} />
                                    {encontro.musica}
                                </span>
                                <div className="encontro-musica-links">
                                    {encontro.link_musica && (
                                        <a
                                            href={encontro.link_musica}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="musica-link-icon"
                                            title="Ouvir Música"
                                            style={{ color: 'var(--primary-color)' }}
                                        >
                                            <Music size={12} />
                                        </a>
                                    )}
                                    {encontro.link_youtube && (
                                        <a
                                            href={encontro.link_youtube}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="musica-link-icon youtube"
                                            title="Ver no YouTube"
                                        >
                                            <Youtube size={12} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="pessoa-row-actions">
                <button
                    className="icon-btn"
                    onClick={() => onEdit(encontro)}
                    title="Editar"
                    aria-label="Editar encontro"
                >
                    <Pencil size={16} />
                </button>
                <button
                    className="icon-btn icon-btn-danger"
                    onClick={() => onDelete(encontro)}
                    title="Excluir"
                    aria-label="Excluir encontro"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <style>{`
        .bg-active { background-color: #10b981 !important; }
        .bg-dim { background-color: #94a3b8 !important; }
        .badge-active { background-color: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        .border-active { border-left: 4px solid #10b981 !important; }
        .encontro-details-col { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; justify-content: center; }
        .encontro-tema-text { display: flex; align-items: center; font-size: 0.75rem; font-style: italic; color: var(--text-color); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .encontro-musica-col-content { display: flex; align-items: center; gap: 8px; }
        .encontro-musica-links { display: flex; gap: 4px; align-items: center; }
        .musica-link-icon { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; background: var(--secondary-bg); border: 1px solid var(--border-color); transition: all 0.2s; }
        .musica-link-icon:hover { transform: translateY(-2px); background: var(--border-color); }
        .musica-link-icon.youtube:hover { color: #ff0000; border-color: #ff0000; }
      `}</style>
        </div>
    );
}
