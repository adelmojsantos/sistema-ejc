import { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Search, UsersRound, Plus, X, Check, Loader, Camera } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { CirculoRow } from '../../components/circulo/CirculoRow';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { circuloService } from '../../services/circuloService';
import { normalizeString } from '../../utils/stringUtils';
import type { Circulo, CirculoFormData } from '../../types/circulo';

export function CirculosPage() {
    const navigate = useNavigate();
    const [circulos, setCirculos] = useState<Circulo[]>([]);
    const [filtered, setFiltered] = useState<Circulo[]>([]);
    const [search, setSearch] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newNome, setNewNome] = useState('');
    const [newImageFile, setNewImageFile] = useState<File | null>(null);
    const [newImagePreview, setNewImagePreview] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Circulo | null>(null);
    const [imagePreviewTarget, setImagePreviewTarget] = useState<Circulo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const load = useCallback(async () => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const data = await circuloService.listar();
            setCirculos(data);
            setFiltered(data);
        } catch (err: unknown) {
            const errorObj = err as { message?: string };
            setFetchError(errorObj.message || 'Erro ao carregar círculos. Tente novamente.');
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const q = normalizeString(search);
        setFiltered(!q ? circulos : circulos.filter((p) => normalizeString(p.nome || '').includes(q)));
    }, [search, circulos]);

    const handleBack = () => {
        navigate('/circulos');
    };

    const handleCreate = async () => {
        if (!newNome.trim()) return;
        setIsLoading(true);
        try {
            const imageUrl = newImageFile ? await circuloService.uploadImagem(newImageFile) : null;
            const nova = await circuloService.criar({ nome: newNome.trim(), imagem_url: imageUrl });
            setCirculos((prev) => [...prev, nova].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')));
            setNewNome('');
            setNewImageFile(null);
            setNewImagePreview('');
            setIsAdding(false);
            toast.success('Círculo criado com sucesso!');
        } catch {
            toast.error('Erro ao criar círculo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setNewImageFile(file);
        setNewImagePreview(URL.createObjectURL(file));
        event.target.value = '';
    };

    const handleCancelCreate = () => {
        setIsAdding(false);
        setNewNome('');
        setNewImageFile(null);
        setNewImagePreview('');
    };

    const handleRemoveNewImage = () => {
        setNewImageFile(null);
        setNewImagePreview('');
    };

    const handleUpdate = async (id: number, data: CirculoFormData) => {
        try {
            const atualizada = await circuloService.atualizar(id, data);
            setCirculos((prev) => prev.map((p) => (p.id === atualizada.id ? atualizada : p)));
            toast.success('Círculo atualizado com sucesso!');
        } catch {
            toast.error('Erro ao atualizar círculo.');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await circuloService.excluir(deleteTarget.id);
            setCirculos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('Círculo excluído com sucesso!');
        } catch (err: unknown) {
            const errorObj = err as { code?: string };
            if (errorObj.code === '23503') {
                toast.error('Não é possível excluir pois existem registros vinculados.');
            } else {
                toast.error('Erro ao excluir círculo.');
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <PageHeader 
                title="Círculos"
                subtitle="Gestão de Cadastros"
                onBack={handleBack}
                actions={!isAdding && (
                    <button onClick={() => setIsAdding(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Novo Círculo
                    </button>
                )}
            />

            <div className="search-bar">
                <Search size={18} style={{ opacity: 0.5 }} />
                <input
                    className="search-input"
                    type="text"
                    placeholder="Buscar círculo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', color: 'var(--text-color)', opacity: 0.5 }}
                        aria-label="Limpar busca"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label
                            className="pessoa-avatar small"
                            style={{ backgroundColor: '#f59e0b15', color: '#f59e0b', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}
                            title={newImagePreview ? 'Trocar imagem do círculo' : 'Adicionar imagem do círculo'}
                        >
                            {newImagePreview ? (
                                <img src={newImagePreview} alt="Prévia do círculo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <UsersRound size={18} />
                            )}
                            <div className="avatar-overlay">
                                <Camera size={12} color="white" />
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleNewImageChange}
                            />
                        </label>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                                autoFocus
                                className="search-input"
                                placeholder="Nome do novo círculo..."
                                style={{ margin: 0, padding: '0.6rem 0.8rem', borderRadius: '8px', width: '100%', border: '1px solid var(--border-color)' }}
                                value={newNome}
                                onChange={(e) => setNewNome(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate();
                                    if (e.key === 'Escape') setIsAdding(false);
                                }}
                            />
                            <label className="circulo-upload-action">
                                <Camera size={14} />
                                {newImageFile ? newImageFile.name : 'Adicionar imagem do círculo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleNewImageChange}
                                />
                            </label>
                            {newImagePreview && (
                                <button
                                    type="button"
                                    className="circulo-upload-action circulo-upload-action--danger"
                                    onClick={handleRemoveNewImage}
                                >
                                    <X size={14} />
                                    Remover imagem selecionada
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                                className="icon-btn"
                                onClick={handleCreate}
                                disabled={isLoading || !newNome.trim()}
                                style={{ color: '#10b981' }}
                                title="Confirmar"
                            >
                                {isLoading ? <Loader size={16} className="animate-spin" /> : <Check size={20} />}
                            </button>
                            <button
                                className="icon-btn"
                                onClick={handleCancelCreate}
                                disabled={isLoading}
                                style={{ color: '#ef4444' }}
                                title="Cancelar"
                            >
                                <X size={20} />
                            </button>
                        </div>
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

                        .circulo-upload-action {
                            align-self: flex-start;
                            color: var(--muted-text);
                            display: inline-flex;
                            align-items: center;
                            gap: 0.35rem;
                            font-size: 0.78rem;
                            font-weight: 700;
                            cursor: pointer;
                            max-width: 100%;
                        }

                        .circulo-upload-action:hover {
                            color: var(--primary-color);
                        }

                        .circulo-upload-action {
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                    `}</style>
                </div>
            )}

            {isFetching && (
                <div className="empty-state">Carregando...</div>
            )}

            {fetchError && !isFetching && (
                <div className="empty-state">
                    <p style={{ color: '#ef4444' }}>{fetchError}</p>
                    <button onClick={load}>Tentar novamente</button>
                </div>
            )}

            {!isFetching && !fetchError && filtered.length === 0 && !isAdding ? (
                <div className="empty-state">
                    <UsersRound size={48} style={{ opacity: 0.3 }} />
                    <p>Nenhum círculo cadastrado.</p>
                    <button onClick={() => setIsAdding(true)}>
                        <Plus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                        Adicionar primeiro círculo
                    </button>
                </div>
            ) : !isFetching && !fetchError && filtered.length > 0 && (
                <div className="pessoa-grid">
                    {filtered.map((e) => (
                        <CirculoRow
                            key={e.id}
                            circulo={e}
                            onUpdate={handleUpdate}
                            onDelete={setDeleteTarget}
                            onPreviewImage={setImagePreviewTarget}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog isOpen={!!deleteTarget} title="Excluir Círculo" message={`Deseja excluir "${deleteTarget?.nome}"?`} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} isLoading={isDeleting} isDestructive={true} />
            <Modal
                isOpen={!!imagePreviewTarget}
                onClose={() => setImagePreviewTarget(null)}
                title={imagePreviewTarget?.nome || 'Imagem do círculo'}
                maxWidth="720px"
            >
                {imagePreviewTarget?.imagem_url && (
                    <div className="circulo-image-preview-modal">
                        <img src={imagePreviewTarget.imagem_url} alt={imagePreviewTarget.nome || 'Círculo'} />
                    </div>
                )}
            </Modal>

            <style>{`
                .circulo-image-preview-modal {
                    display: flex;
                    justify-content: center;
                }

                .circulo-image-preview-modal img {
                    width: 100%;
                    max-height: min(70vh, 620px);
                    object-fit: contain;
                    border-radius: 8px;
                    background: var(--secondary-bg);
                    border: 1px solid var(--border-color);
                }

                .circulo-upload-action--danger {
                    border: 0;
                    background: transparent;
                    color: #ef4444;
                    padding: 0;
                }
            `}</style>
        </div>
    );
}
