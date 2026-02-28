import { useState } from 'react';
import type { Equipe, EquipeFormData } from '../../types/equipe';
import { Shield, Pencil, Trash2, Check, X, Loader } from 'lucide-react';

interface EquipeRowProps {
    equipe: Equipe;
    onUpdate: (id: string, data: EquipeFormData) => Promise<void>;
    onDelete: (equipe: Equipe) => void;
}

export function EquipeRow({ equipe, onUpdate, onDelete }: EquipeRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editNome, setEditNome] = useState(equipe.nome || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const trimmedNome = editNome.trim();
        if (!trimmedNome || trimmedNome === equipe.nome) {
            setIsEditing(false);
            setEditNome(equipe.nome || '');
            return;
        }

        setIsSaving(true);
        try {
            await onUpdate(equipe.id, { nome: trimmedNome });
            setIsEditing(false);
        } catch (error) {
            console.error('Erro ao atualizar equipe:', error);
            setEditNome(equipe.nome || '');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditNome(equipe.nome || '');
        setIsEditing(false);
    };

    return (
        <div className="pessoa-row">
            <div className="pessoa-row-main" style={{ width: '100%' }}>
                <div className="pessoa-avatar small" style={{ backgroundColor: '#6366f1' }}>
                    <Shield size={18} />
                </div>
                <div className="pessoa-row-info" style={{ width: '100%' }}>
                    {isEditing ? (
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
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            disabled={isSaving}
                        />
                    ) : (
                        <h3 className="pessoa-row-name">{equipe.nome}</h3>
                    )}
                    <span className="pessoa-row-sub">Equipe de Trabalho</span>
                </div>
            </div>

            <div className="pessoa-row-actions">
                {isEditing ? (
                    <>
                        <button
                            className="icon-btn"
                            onClick={handleSave}
                            disabled={isSaving || !editNome.trim()}
                            title="Salvar"
                        >
                            {isSaving ? <Loader size={16} className="animate-spin" /> : <Check size={16} color="#10b981" />}
                        </button>
                        <button
                            className="icon-btn"
                            onClick={handleCancel}
                            disabled={isSaving}
                            title="Cancelar"
                        >
                            <X size={16} color="#ef4444" />
                        </button>
                    </>
                ) : (
                    <>
                        <button className="icon-btn" onClick={() => setIsEditing(true)} title="Editar"><Pencil size={16} /></button>
                        <button className="icon-btn icon-btn-danger" onClick={() => onDelete(equipe)} title="Excluir"><Trash2 size={16} /></button>
                    </>
                )}
            </div>
        </div>
    );
}
