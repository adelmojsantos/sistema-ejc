import { useState } from 'react';
import type { Circulo } from '../../types/circulo';
import { UsersRound, Pencil, Trash2, Check, X, Loader } from 'lucide-react';

interface CirculoRowProps {
    circulo: Circulo;
    onUpdate: (id: number, data: { nome: string }) => Promise<void>;
    onDelete: (circulo: Circulo) => void;
}

export function CirculoRow({ circulo, onUpdate, onDelete }: CirculoRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempNome, setTempNome] = useState(circulo.nome || '');
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        if (!tempNome.trim()) return;
        setIsLoading(true);
        try {
            await onUpdate(circulo.id, { nome: tempNome });
            setIsEditing(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setTempNome(circulo.nome || '');
        setIsEditing(false);
    };

    return (
        <div className="pessoa-row">
            <div className="pessoa-row-main" style={{ flex: 1 }}>
                <div className="pessoa-avatar small" style={{ backgroundColor: '#f59e0b' }}>
                    <UsersRound size={18} />
                </div>
                <div className="pessoa-row-info" style={{ flex: 1 }}>
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                            <input
                                autoFocus
                                className="search-input"
                                style={{
                                    padding: '0.6rem 0.8rem',
                                    height: 'auto',
                                    fontSize: '0.9rem',
                                    border: '2px solid var(--primary-color)',
                                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.15)',
                                    outline: 'none',
                                    borderRadius: '8px',
                                    width: '100%',
                                    flex: 1
                                }}
                                value={tempNome}
                                onChange={(e) => setTempNome(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                    if (e.key === 'Escape') handleCancel();
                                }}
                            />
                        </div>
                    ) : (
                        <h3 className="pessoa-row-name">{circulo.nome}</h3>
                    )}
                </div>
            </div>

            <div className="pessoa-row-actions">
                {isEditing ? (
                    <>
                        <button
                            className="icon-btn"
                            onClick={handleSave}
                            disabled={isLoading || !tempNome.trim()}
                            title="Salvar"
                            style={{ color: '#10b981' }}
                        >
                            {isLoading ? <Loader size={16} className="animate-spin" /> : <Check size={18} />}
                        </button>
                        <button
                            className="icon-btn"
                            onClick={handleCancel}
                            disabled={isLoading}
                            title="Cancelar"
                            style={{ color: '#ef4444' }}
                        >
                            <X size={18} />
                        </button>
                    </>
                ) : (
                    <>
                        <button className="icon-btn" onClick={() => setIsEditing(true)} title="Editar"><Pencil size={16} /></button>
                        <button className="icon-btn icon-btn-danger" onClick={() => onDelete(circulo)} title="Excluir"><Trash2 size={16} /></button>
                    </>
                )}
            </div>
        </div>
    );
}
