import { useEffect, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, Users, LayoutGrid, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { supabase } from '../../lib/supabase';
import type { Encontro } from '../../types/encontro';

interface TeamConfirmationWithEquipe {
    id: string;
    equipe_id: string;
    foto_url: string | null;
    foto_posicao_y: number;
    equipes: {
        nome: string;
    };
}

export function SecretariaFotosPage() {
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [selectedEncontro, setSelectedEncontro] = useState<string>('');
    const [teams, setTeams] = useState<TeamConfirmationWithEquipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [adjustingId, setAdjustingId] = useState<string | null>(null);
    const [tempPos, setTempPos] = useState<number>(50);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);

    useEffect(() => {
        async function loadEncontros() {
            try {
                const data = await encontroService.listar();
                setEncontros(data);
                if (data.length > 0) {
                    setSelectedEncontro(data[0].id);
                }
            } catch (error) {
                console.error('Erro ao carregar encontros:', error);
                toast.error('Erro ao carregar encontros');
            } finally {
                setLoading(false);
            }
        }
        loadEncontros();
    }, []);

    useEffect(() => {
        if (!selectedEncontro) return;

        async function loadTeams() {
            setLoadingTeams(true);
            try {
                const { data, error } = await supabase
                    .from('equipe_confirmacoes')
                    .select('id, equipe_id, foto_url, foto_posicao_y, equipes(nome)')
                    .eq('encontro_id', selectedEncontro);

                if (error) throw error;
                
                // Ordenar alfabeticamente pelo nome da equipe
                const sortedData = (data || []).sort((a: any, b: any) => 
                    (a.equipes?.nome || '').localeCompare(b.equipes?.nome || '')
                );

                setTeams(sortedData as unknown as TeamConfirmationWithEquipe[]);
            } catch (error) {
                console.error('Erro ao carregar equipes:', error);
                toast.error('Erro ao carregar equipes do encontro');
            } finally {
                setLoadingTeams(false);
            }
        }
        loadTeams();
    }, [selectedEncontro]);

    const handleUpload = async (confirmacaoId: string, file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecione um arquivo de imagem válido.');
            return;
        }

        setUploading(confirmacaoId);
        const loadingToast = toast.loading('Enviando foto...');

        try {
            const publicUrl = await equipeService.uploadFoto(confirmacaoId, file);
            await equipeService.atualizarFotoConfirmacao(confirmacaoId, publicUrl);

            setTeams((prev) => prev.map((t) =>
                t.id === confirmacaoId ? { ...t, foto_url: publicUrl, foto_posicao_y: 50 } : t
            ));

            toast.success('Foto atualizada com sucesso!', { id: loadingToast });
        } catch (error) {
            console.error('Erro no upload:', error);
            toast.error('Erro ao enviar a foto.', { id: loadingToast });
        } finally {
            setUploading(null);
            setDragOverId(null);
        }
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (adjustingId) return;
        setDragOverId(id);
    };

    const handleDragLeave = () => {
        setDragOverId(null);
    };

    const handleDrop = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (adjustingId) return;
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleUpload(id, file);
        } else {
            setDragOverId(null);
        }
    };

    const handleStartAdjust = (team: TeamConfirmationWithEquipe) => {
        setAdjustingId(team.id);
        setTempPos(team.foto_posicao_y || 50);
    };

    const handleSaveAdjustment = async (id: string) => {
        try {
            await equipeService.atualizarPosicaoFoto(id, tempPos);
            setTeams(prev => prev.map(t => t.id === id ? { ...t, foto_posicao_y: tempPos } : t));
            setAdjustingId(null);
            toast.success('Enquadramento salvo!');
        } catch (error) {
            toast.error('Erro ao salvar ajuste');
        }
    };

    const handleRemoveFoto = async () => {
        if (!deleteTarget) return;
        setIsRemoving(true);
        try {
            await equipeService.atualizarFotoConfirmacao(deleteTarget, '');
            setTeams((prev) => prev.map((t) => 
                t.id === deleteTarget ? { ...t, foto_url: null } : t
            ));
            toast.success('Foto removida');
            setDeleteTarget(null);
        } catch (error) {
            toast.error('Erro ao remover');
        } finally {
            setIsRemoving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="container" style={{ paddingBottom: '4rem' }}>
            <PageHeader
                title="Fotos das Equipes"
                subtitle="Arraste para subir e ajuste o enquadramento manualmente"
            />

            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Search size={18} className="text-primary" />
                    <select
                        className="form-input"
                        style={{ margin: 0, flex: 1 }}
                        value={selectedEncontro}
                        onChange={(e) => setSelectedEncontro(e.target.value)}
                    >
                        {encontros.map(e => (
                            <option key={e.id} value={e.id}>
                                {e.nome} ({new Date(e.data_inicio).getFullYear()})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loadingTeams ? (
                <div className="p-12 text-center opacity-50"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
            ) : (
                <div className="equipes-grid">
                    {teams.map((team) => (
                        <div
                            key={team.id}
                            className={`card foto-card ${dragOverId === team.id ? 'dragging' : ''} ${adjustingId === team.id ? 'adjusting' : ''}`}
                            onDragOver={(e) => handleDragOver(e, team.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, team.id)}
                        >
                            <div className="card-header">
                                <Users size={14} />
                                <span>{team.equipes.nome}</span>
                            </div>

                            <div className="photo-frame landscape">
                                {team.foto_url ? (
                                    <div className="image-wrapper" style={{ height: '100%', position: 'relative' }}>
                                        <img
                                            src={team.foto_url}
                                            alt=""
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                objectPosition: `center ${adjustingId === team.id ? tempPos : (team.foto_posicao_y || 50)}%`
                                            }}
                                        />

                                        {adjustingId === team.id ? (
                                            <div className="adjust-overlay">
                                                <input
                                                    type="range"
                                                    min="0" max="100"
                                                    value={tempPos}
                                                    onChange={(e) => setTempPos(parseInt(e.target.value))}
                                                />
                                            </div>
                                        ) : (
                                            <div className="card-actions">
                                                <button onClick={() => handleStartAdjust(team)} className="action-btn" title="Ajustar Enquadramento">
                                                    <LayoutGrid size={14} />
                                                </button>
                                                <button onClick={() => setDeleteTarget(team.id)} className="action-btn danger">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <ImageIcon size={24} />
                                        <span>Solte a foto aqui</span>
                                    </div>
                                )}

                                {uploading === team.id && <div className="loading-overlay"><div className="spinner"></div></div>}
                            </div>

                            {adjustingId === team.id ? (
                                <button className="btn-primary btn-sm" onClick={() => handleSaveAdjustment(team.id)} style={{ width: '100%', marginTop: '0.5rem' }}>
                                    Salvar Enquadramento
                                </button>
                            ) : (
                                <label className="upload-label">
                                    <Camera size={14} /> {team.foto_url ? 'Trocar' : 'Subir Foto'}
                                    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(team.id, e.target.files[0])} hidden />
                                </label>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .equipes-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                }

                @media (max-width: 768px) {
                    .equipes-grid {
                        grid-template-columns: 1fr;
                    }
                }

                .foto-card { padding: 0.75rem; transition: 0.2s; border: 1px solid var(--border-color); }
                .card-header { display: flex; alignItems: center; gap: 0.5rem; margin-bottom: 0.75rem; font-weight: 600; font-size: 0.85rem; }
                .photo-frame { position: relative; background: var(--secondary-bg); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color); }
                .photo-frame.landscape { aspect-ratio: 21 / 9; }
                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.3; font-size: 0.7rem; gap: 0.4rem; }
                .loading-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; }
                .card-actions { position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.4rem; opacity: 0; transition: 0.2s; }
                .foto-card:hover .card-actions { opacity: 1; }
                .action-btn { background: rgba(0,0,0,0.5); color: white; border: none; padding: 0.4rem; border-radius: 6px; cursor: pointer; backdrop-filter: blur(4px); }
                .action-btn:hover { background: var(--primary-color); }
                .action-btn.danger:hover { background: #ef4444; }
                .upload-label { cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 0.75rem; font-size: 0.8rem; color: var(--primary-color); font-weight: 600; }
                .dragging { border: 2px dashed var(--primary-color); background: var(--primary-color)05; }
                .adjust-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 1rem; background: linear-gradient(transparent, rgba(0,0,0,0.8)); display: flex; flex-direction: column; }
                .adjusting { border-color: var(--primary-color); box-shadow: 0 0 0 2px var(--primary-color)20; }
                input[type=range] { cursor: ns-resize; width: 100%; accent-color: var(--primary-color); }
            `}</style>
            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title="Remover Foto"
                message="Deseja apagar a foto desta equipe? Esta ação não pode ser desfeita."
                onConfirm={handleRemoveFoto}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isRemoving}
                isDestructive={true}
            />
        </div>
    );
}
