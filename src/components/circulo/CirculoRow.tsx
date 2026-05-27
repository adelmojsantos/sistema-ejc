import { useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import type { Circulo, CirculoFormData } from '../../types/circulo';
import { UsersRound, Pencil, Trash2, Check, X, Loader, Camera, ImageOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { circuloService } from '../../services/circuloService';

interface CirculoRowProps {
    circulo: Circulo;
    onUpdate: (id: number, data: CirculoFormData) => Promise<void>;
    onDelete: (circulo: Circulo) => void;
    onPreviewImage: (circulo: Circulo) => void;
}

export function CirculoRow({ circulo, onUpdate, onDelete, onPreviewImage }: CirculoRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempNome, setTempNome] = useState(circulo.nome || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        if (!tempNome.trim()) return;
        setIsLoading(true);
        try {
            await onUpdate(circulo.id, { nome: tempNome, imagem_url: circulo.imagem_url });
            setIsEditing(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setTempNome(circulo.nome || '');
        setIsEditing(false);
    };

    const handleAvatarClick = () => {
        if (circulo.imagem_url) {
            onPreviewImage(circulo);
            return;
        }

        fileInputRef.current?.click();
    };

    const handleSelectImage = (event?: MouseEvent) => {
        event?.stopPropagation();
        fileInputRef.current?.click();
    };

    const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const imageUrl = await circuloService.uploadImagem(file);
            await onUpdate(circulo.id, { nome: circulo.nome || tempNome, imagem_url: imageUrl });
            toast.success('Imagem do círculo atualizada!');
        } catch (error) {
            console.error('Erro ao enviar imagem do círculo:', error);
            toast.error('Erro ao enviar imagem.');
        } finally {
            setIsUploading(false);
            event.target.value = '';
        }
    };

    const handleRemoveImage = async () => {
        if (!circulo.imagem_url) return;

        setIsLoading(true);
        try {
            await onUpdate(circulo.id, { nome: circulo.nome || tempNome, imagem_url: null });
            toast.success('Imagem do círculo removida!');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pessoa-row">
            <div className="pessoa-row-main" style={{ flex: 1 }}>
                <div
                    className="pessoa-avatar small"
                    style={{ backgroundColor: '#f59e0b', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
                    onClick={handleAvatarClick}
                    title={circulo.imagem_url ? 'Ver imagem do círculo' : 'Adicionar imagem do círculo'}
                >
                    {isUploading ? (
                        <Loader size={18} className="animate-spin" />
                    ) : circulo.imagem_url ? (
                        <img src={circulo.imagem_url} alt={circulo.nome || 'Círculo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <UsersRound size={18} />
                    )}
                    <div className="avatar-overlay">
                        <Camera size={12} color="white" />
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onClick={(event) => event.stopPropagation()}
                        onChange={handleImageChange}
                    />
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
                        <div>
                            <h3 className="pessoa-row-name">{circulo.nome}</h3>
                            <button
                                type="button"
                                className="circulo-image-link"
                                onClick={handleSelectImage}
                                disabled={isUploading}
                            >
                                <Camera size={14} />
                                {circulo.imagem_url ? 'Trocar imagem do círculo' : 'Adicionar imagem do círculo'}
                            </button>
                            {circulo.imagem_url && (
                                <button
                                    type="button"
                                    className="circulo-image-link circulo-image-link--danger"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleRemoveImage();
                                    }}
                                    disabled={isLoading || isUploading}
                                >
                                    <ImageOff size={14} />
                                    Remover imagem
                                </button>
                            )}
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

            <style>{`
                .avatar-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.35);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .pessoa-avatar:hover .avatar-overlay {
                    opacity: 1;
                }

                .circulo-image-link {
                    appearance: none;
                    border: 0;
                    background: transparent;
                    color: var(--muted-text);
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 0.78rem;
                    font-weight: 700;
                    margin-top: 0.35rem;
                    padding: 0;
                    cursor: pointer;
                }

                .circulo-image-link + .circulo-image-link {
                    margin-left: 0.75rem;
                }

                .circulo-image-link:hover {
                    color: var(--primary-color);
                }

                .circulo-image-link--danger:hover {
                    color: #ef4444;
                }

                .circulo-image-link:disabled {
                    cursor: wait;
                    opacity: 0.65;
                }
            `}</style>
        </div>
    );
}
