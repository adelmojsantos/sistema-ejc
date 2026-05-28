import { useState, useRef } from 'react';
import type { Equipe, EquipeFormData } from '../../types/equipe';
import { Shield, Pencil, Trash2, Check, X, Loader, Camera } from 'lucide-react';
import { equipeService } from '../../services/equipeService';
import { toast } from 'react-hot-toast';

interface EquipeRowProps {
    equipe: Equipe;
    onUpdate: (id: string, data: EquipeFormData) => Promise<void>;
    onDelete: (equipe: Equipe) => void;
}

export function EquipeRow({ equipe, onUpdate, onDelete }: EquipeRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editNome, setEditNome] = useState(equipe.nome || '');
    const [editAcesso, setEditAcesso] = useState<'verde' | 'amarela' | 'vermelha'>(equipe.acesso_plenario || 'verde');
    const [editAparecePosEncontro, setEditAparecePosEncontro] = useState(equipe.aparece_pos_encontro !== false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        const trimmedNome = editNome.trim();
        const hasChanges = trimmedNome !== equipe.nome || 
            editAcesso !== (equipe.acesso_plenario || 'verde') || 
            editAparecePosEncontro !== (equipe.aparece_pos_encontro !== false);

        if (!trimmedNome || !hasChanges) {
            setIsEditing(false);
            setEditNome(equipe.nome || '');
            setEditAcesso(equipe.acesso_plenario || 'verde');
            setEditAparecePosEncontro(equipe.aparece_pos_encontro !== false);
            return;
        }

        setIsSaving(true);
        try {
            await onUpdate(equipe.id, { 
                nome: trimmedNome, 
                foto_url: equipe.foto_url, 
                acesso_plenario: editAcesso,
                aparece_pos_encontro: editAparecePosEncontro
            });
            setIsEditing(false);
        } catch (error) {
            console.error('Erro ao atualizar equipe:', error);
            setEditNome(equipe.nome || '');
            setEditAcesso(equipe.acesso_plenario || 'verde');
            setEditAparecePosEncontro(equipe.aparece_pos_encontro !== false);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditNome(equipe.nome || '');
        setEditAcesso(equipe.acesso_plenario || 'verde');
        setEditAparecePosEncontro(equipe.aparece_pos_encontro !== false);
        setIsEditing(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const url = await equipeService.uploadFoto(equipe.id, file);
            await onUpdate(equipe.id, { 
                nome: equipe.nome || '', 
                foto_url: url, 
                acesso_plenario: equipe.acesso_plenario || 'verde',
                aparece_pos_encontro: equipe.aparece_pos_encontro !== false
            });
            toast.success('Foto da equipe atualizada!');
        } catch (error) {
            console.error('Erro no upload da foto da equipe:', error);
            toast.error('Erro ao enviar foto.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="pessoa-row">
            <div className="pessoa-row-main" style={{ width: '100%' }}>
                <div
                    className="pessoa-avatar small"
                    style={{
                        backgroundColor: '#6366f1',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    title="Mudar foto da equipe"
                >
                    {isUploading ? (
                        <Loader size={18} className="animate-spin" />
                    ) : equipe.foto_url ? (
                        <img src={equipe.foto_url} alt={equipe.nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <Shield size={18} />
                    )}
                    <div className="avatar-overlay">
                        <Camera size={12} color="white" />
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                </div>
                <div className="pessoa-row-info" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {isEditing ? (
                        <>
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
                            <select
                                className="search-input"
                                style={{
                                    padding: '0.5rem',
                                    fontSize: '0.85rem',
                                    border: '1px solid var(--border-color)',
                                    outline: 'none',
                                    borderRadius: '6px',
                                    background: 'var(--secondary-bg)',
                                    color: editAcesso === 'verde' ? '#10b981' : editAcesso === 'amarela' ? '#f59e0b' : '#f25353ff',
                                    fontWeight: 600
                                }}
                                value={editAcesso}
                                onChange={(e) => setEditAcesso(e.target.value as 'verde' | 'amarela' | 'vermelha')}
                                disabled={isSaving}
                            >
                                <option value="verde" style={{ color: '#10b981' }}>🟢 Acesso Total (Plenário + Encontristas)</option>
                                <option value="amarela" style={{ color: '#f59e0b' }}>🟡 Acesso Parcial (Encontristas apenas)</option>
                                <option value="vermelha" style={{ color: '#dc2626' }}>🔴 Escondida</option>
                            </select>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)', cursor: 'pointer', marginTop: '0.25rem' }}>
                                <input
                                    type="checkbox"
                                    checked={editAparecePosEncontro}
                                    onChange={(e) => setEditAparecePosEncontro(e.target.checked)}
                                    disabled={isSaving}
                                />
                                Aparece na ficha de pós-encontro
                            </label>
                        </>
                    ) : (
                        <div>
                            <h3 className="pessoa-row-name">{equipe.nome}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                <span className="pessoa-row-sub">Equipe de Trabalho</span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: (equipe.acesso_plenario || 'verde') === 'verde' ? 'rgba(16, 185, 129, 0.1)' : (equipe.acesso_plenario || 'verde') === 'amarela' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                                    color: (equipe.acesso_plenario || 'verde') === 'verde' ? '#10b981' : (equipe.acesso_plenario || 'verde') === 'amarela' ? '#f59e0b' : '#dc2626'
                                }}>
                                    {(equipe.acesso_plenario || 'verde') === 'verde' ? '🟢 Acesso Total' : (equipe.acesso_plenario || 'verde') === 'amarela' ? '🟡 Acesso Parcial' : '🔴 Escondida'}
                                </span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: (equipe.aparece_pos_encontro !== false) ? 'rgba(99, 102, 241, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                    color: (equipe.aparece_pos_encontro !== false) ? 'var(--primary-color)' : 'var(--muted-text)'
                                }}>
                                    {equipe.aparece_pos_encontro !== false ? '✓ Pós-Encontro' : '✗ Pós-Encontro'}
                                </span>
                            </div>
                        </div>
                    )}
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

            <style>{`
                .avatar-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .pessoa-avatar:hover .avatar-overlay {
                    opacity: 1;
                }
            `}</style>
        </div>
    );
}
