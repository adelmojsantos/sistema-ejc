import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, Users, LayoutGrid, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { equipeService } from '../../services/equipeService';
import { supabase } from '../../lib/supabase';
import { useEncontros } from '../../contexts/EncontroContext';

interface TeamConfirmationWithEquipe {
    id: string;
    equipe_id: string;
    foto_url: string | null;
    foto_posicao_y: number;
    equipes: {
        nome: string;
    };
}

interface TeamMember {
    id: string;
    equipe_id: string;
    pessoas: {
        nome_completo: string;
    } | null;
}

export function SecretariaFotosPage() {
    const { encontros } = useEncontros();
    const [selectedEncontro, setSelectedEncontro] = useState<string>('');
    const [teams, setTeams] = useState<TeamConfirmationWithEquipe[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [adjustingId, setAdjustingId] = useState<string | null>(null);
    const [tempPos, setTempPos] = useState<number>(50);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [selectedUploadTeamId, setSelectedUploadTeamId] = useState<string | null>(null);
    const [isPhotoActionSheetOpen, setIsPhotoActionSheetOpen] = useState(false);
    const [membersByTeam, setMembersByTeam] = useState<Record<string, TeamMember[]>>({});
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Seleciona o primeiro encontro quando o contexto carregar
    useEffect(() => {
        if (encontros.length > 0 && !selectedEncontro) {
            setSelectedEncontro(encontros[0].id);
        }
    }, [encontros, selectedEncontro]);

    useEffect(() => {
        if (!selectedEncontro) return;

        async function loadTeams() {
            setLoadingTeams(true);
            try {
                const [teamsResult, membersResult] = await Promise.all([
                    supabase
                        .from('equipe_confirmacoes')
                        .select('id, equipe_id, foto_url, foto_posicao_y, equipes(nome)')
                        .eq('encontro_id', selectedEncontro),
                    supabase
                        .from('participacoes')
                        .select('id, equipe_id, pessoas(nome_completo)')
                        .eq('encontro_id', selectedEncontro)
                        .eq('participante', false)
                        .not('equipe_id', 'is', null)
                ]);

                if (teamsResult.error) throw teamsResult.error;
                if (membersResult.error) throw membersResult.error;
                
                // Ordenar alfabeticamente pelo nome da equipe
                const sortedData = [
                    ...((teamsResult.data || []) as unknown as TeamConfirmationWithEquipe[])
                ].sort((a, b) => a.equipes.nome.localeCompare(
                    b.equipes.nome,
                    'pt-BR',
                    { sensitivity: 'base' }
                ));

                const groupedMembers = ((membersResult.data || []) as unknown as TeamMember[])
                    .reduce<Record<string, TeamMember[]>>((groups, member) => {
                        if (!groups[member.equipe_id]) groups[member.equipe_id] = [];
                        groups[member.equipe_id].push(member);
                        return groups;
                    }, {});

                Object.values(groupedMembers).forEach((members) => {
                    members.sort((a, b) =>
                        (a.pessoas?.nome_completo || '').localeCompare(
                            b.pessoas?.nome_completo || '',
                            'pt-BR',
                            { sensitivity: 'base' }
                        )
                    );
                });

                setTeams(sortedData);
                setMembersByTeam(groupedMembers);
                setSelectedTeamId(null);
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

    const openPhotoPicker = (teamId: string) => {
        if (uploading || adjustingId) return;
        setSelectedUploadTeamId(teamId);

        if (window.innerWidth <= 768) {
            setIsPhotoActionSheetOpen(true);
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleSharedFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const teamId = selectedUploadTeamId;
        event.target.value = '';
        setIsPhotoActionSheetOpen(false);

        if (file && teamId) {
            handleUpload(teamId, file);
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
        } catch {
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
        } catch {
            toast.error('Erro ao remover');
        } finally {
            setIsRemoving(false);
        }
    };

    if (!encontros.length) return <div className="p-8 text-center">Carregando encontros...</div>;

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
                                <button
                                    type="button"
                                    className="team-name-button"
                                    onClick={() => setSelectedTeamId(team.equipe_id)}
                                    aria-label={`Ver integrantes da equipe ${team.equipes.nome}`}
                                >
                                    {team.equipes.nome}
                                </button>
                            </div>

                            <div
                                className="photo-frame landscape"
                                onClick={() => openPhotoPicker(team.id)}
                                role="button"
                                tabIndex={0}
                                aria-label={`${team.foto_url ? 'Trocar' : 'Adicionar'} foto da equipe ${team.equipes.nome}`}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return;
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        openPhotoPicker(team.id);
                                    }
                                }}
                            >
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
                                                <button onClick={(event) => { event.stopPropagation(); handleStartAdjust(team); }} className="action-btn" title="Ajustar Enquadramento">
                                                    <LayoutGrid size={14} />
                                                </button>
                                                <button onClick={(event) => { event.stopPropagation(); setDeleteTarget(team.id); }} className="action-btn danger">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <ImageIcon size={24} />
                                        <span>Clique ou solte a foto aqui</span>
                                    </div>
                                )}

                                {uploading === team.id && <div className="loading-overlay"><div className="spinner"></div></div>}
                            </div>

                            {adjustingId === team.id ? (
                                <button className="btn-primary btn-sm" onClick={() => handleSaveAdjustment(team.id)} style={{ width: '100%', marginTop: '0.5rem' }}>
                                    Salvar Enquadramento
                                </button>
                            ) : (
                                <button type="button" className="upload-label" onClick={() => openPhotoPicker(team.id)}>
                                    <Camera size={14} /> {team.foto_url ? 'Trocar' : 'Subir Foto'}
                                </button>
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
                .card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; font-weight: 600; font-size: 0.85rem; }
                .team-name-button {
                    border: 0;
                    padding: 0;
                    background: transparent;
                    color: inherit;
                    font: inherit;
                    text-align: left;
                    cursor: pointer;
                    text-decoration: underline;
                    text-decoration-color: transparent;
                    text-underline-offset: 3px;
                    transition: color 0.2s, text-decoration-color 0.2s;
                }
                .team-name-button:hover,
                .team-name-button:focus-visible {
                    color: var(--primary-color);
                    text-decoration-color: currentColor;
                }
                .team-name-button:focus-visible {
                    outline: 2px solid var(--primary-color);
                    outline-offset: 3px;
                }
                .team-members-list {
                    margin: 0;
                    padding: 0;
                    list-style: none;
                    display: grid;
                    gap: 0.5rem;
                }
                .team-member-item {
                    display: grid;
                    grid-template-columns: 2.25rem minmax(0, 1fr);
                    align-items: center;
                    gap: 0.75rem;
                    min-height: 2.5rem;
                    padding: 0.45rem 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .team-member-item:last-child { border-bottom: 0; }
                .team-member-number {
                    color: var(--primary-color);
                    font-variant-numeric: tabular-nums;
                    font-weight: 700;
                    text-align: right;
                }
                .team-member-name {
                    min-width: 0;
                    overflow-wrap: anywhere;
                    font-weight: 500;
                }
                .team-members-empty {
                    margin: 0;
                    padding: 1.5rem 0;
                    text-align: center;
                    opacity: 0.65;
                }
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
                .photo-frame[role="button"] { cursor: pointer; }
                .photo-frame[role="button"]:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 3px; }
                .foto-card:not(.adjusting) .photo-frame:hover .empty-state { opacity: 0.6; }
                .upload-label {
                    border: 0;
                    background: transparent;
                    width: 100%;
                    padding: 0;
                }

                .photo-actions-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    z-index: 99999;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                }
                @media (min-width: 640px) {
                    .photo-actions-modal-overlay {
                        align-items: center;
                    }
                }
                .photo-actions-modal {
                    background: var(--card-bg, #ffffff);
                    width: 100%;
                    max-width: 500px;
                    border-top-left-radius: 24px;
                    border-top-right-radius: 24px;
                    padding: 1.5rem;
                    box-shadow: 0 -10px 25px rgba(0,0,0,0.15);
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @media (min-width: 640px) {
                    .photo-actions-modal {
                        border-radius: 20px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
                        animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                }
                .photo-actions-header { text-align: center; }
                .photo-actions-header h3 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--text-color);
                }
                .photo-actions-header p {
                    margin: 0.25rem 0 0;
                    font-size: 0.85rem;
                    color: var(--text-color);
                    opacity: 0.7;
                }
                .photo-actions-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .photo-action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    background: var(--secondary-bg, #f8f9fa);
                    color: var(--text-color);
                    font-weight: 600;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .photo-action-btn:hover {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }
                .photo-actions-cancel {
                    padding: 0.75rem;
                    border-radius: 12px;
                    border: none;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }
                .photo-actions-cancel:hover {
                    background: #ef4444;
                    color: white;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleSharedFileChange}
                disabled={!!uploading}
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handleSharedFileChange}
                disabled={!!uploading}
            />

            <ConfirmDialog 
                isOpen={!!deleteTarget}
                title="Remover Foto"
                message="Deseja apagar a foto desta equipe? Esta ação não pode ser desfeita."
                onConfirm={handleRemoveFoto}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isRemoving}
                isDestructive={true}
            />

            <Modal
                isOpen={!!selectedTeamId}
                onClose={() => setSelectedTeamId(null)}
                title={teams.find((team) => team.equipe_id === selectedTeamId)?.equipes.nome || 'Equipe'}
                maxWidth="560px"
            >
                {(selectedTeamId && membersByTeam[selectedTeamId]?.length) ? (
                    <ol className="team-members-list">
                        {membersByTeam[selectedTeamId].map((member, index) => (
                            <li key={member.id} className="team-member-item">
                                <span className="team-member-number">
                                    {(index + 1).toString().padStart(2, '0')}
                                </span>
                                <span className="team-member-name">
                                    {member.pessoas?.nome_completo || 'Nome não informado'}
                                </span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="team-members-empty">Nenhum integrante vinculado a esta equipe.</p>
                )}
            </Modal>

            {isPhotoActionSheetOpen && (
                <div className="photo-actions-modal-overlay" onClick={() => setIsPhotoActionSheetOpen(false)}>
                    <div className="photo-actions-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="photo-actions-header">
                            <h3>Adicionar Foto</h3>
                            <p>Como você deseja inserir a foto?</p>
                        </div>
                        <div className="photo-actions-buttons">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPhotoActionSheetOpen(false);
                                    cameraInputRef.current?.click();
                                }}
                                className="photo-action-btn"
                            >
                                <Camera size={20} />
                                Tirar Foto (Câmera)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPhotoActionSheetOpen(false);
                                    fileInputRef.current?.click();
                                }}
                                className="photo-action-btn"
                            >
                                <ImageIcon size={20} />
                                Escolher da Galeria
                            </button>
                        </div>
                        <button type="button" className="photo-actions-cancel" onClick={() => setIsPhotoActionSheetOpen(false)}>
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
