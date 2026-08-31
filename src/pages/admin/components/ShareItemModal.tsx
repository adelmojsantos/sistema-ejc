import React, { useCallback, useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Users, Shield, Trash2, Loader, PlusCircle } from 'lucide-react';
import { bibliotecaService, type BibliotecaCompartilhamento } from '../../../services/bibliotecaService';
import { useEquipes } from '../../../hooks/useEquipes';
import { toast } from 'react-hot-toast';

interface ShareItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string;
    itemName: string;
    itemType: 'pasta' | 'arquivo';
    isGoogleDrive?: boolean;
    isGoogleManaged?: boolean;
}

export function ShareItemModal({
    isOpen,
    onClose,
    itemId,
    itemName,
    itemType,
    isGoogleDrive = false,
    isGoogleManaged = false,
}: ShareItemModalProps) {
    const { equipes } = useEquipes();
    const [gruposAcesso, setGruposAcesso] = useState<{ id: string, nome: string }[]>([]);
    const [compartilhamentos, setCompartilhamentos] = useState<BibliotecaCompartilhamento[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [targetType, setTargetType] = useState<'grupo' | 'equipe'>('grupo');
    const [selectedTargetId, setSelectedTargetId] = useState('');
    const [googleRole, setGoogleRole] = useState<'reader' | 'writer'>('reader');

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [gData, cData] = await Promise.all([
                bibliotecaService.listarGruposAcesso(),
                bibliotecaService.listarCompartilhamentos(itemId, itemType)
            ]);
            setGruposAcesso(gData);
            setCompartilhamentos(cData);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [itemId, itemType]);

    useEffect(() => {
        if (isOpen) {
            void loadInitialData();
        }
    }, [isOpen, loadInitialData]);

    const handleAddShare = async () => {
        if (!selectedTargetId) return;
        setSubmitting(true);
        try {
            await bibliotecaService.compartilharItem({
                [itemType === 'pasta' ? 'pastaId' : 'arquivoId']: itemId,
                grupoId: targetType === 'grupo' ? selectedTargetId : undefined,
                equipeId: targetType === 'equipe' ? selectedTargetId : undefined,
                googleRole
            });
            try {
                const sync = await bibliotecaService.sincronizarItemGoogle({
                    [itemType === 'pasta' ? 'pastaId' : 'arquivoId']: itemId,
                });
                const failed = sync.results.reduce((total, result) => total + result.errors.length, 0);
                toast.success(failed > 0
                    ? 'Compartilhamento salvo; algumas permissões do Google ficaram pendentes.'
                    : 'Compartilhamento adicionado e permissões sincronizadas.');
            } catch {
                toast.success('Compartilhamento salvo. A sincronização com o Google ficou pendente.');
            }
            setSelectedTargetId('');
            void loadInitialData();
        } catch (error: unknown) {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
                toast.error('Este item já está compartilhado com este destino');
            } else {
                toast.error('Erro ao compartilhar item');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveShare = async (id: string) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await bibliotecaService.removerCompartilhamento(id);
            try {
                const sync = await bibliotecaService.sincronizarItemGoogle({
                    [itemType === 'pasta' ? 'pastaId' : 'arquivoId']: itemId,
                });
                const failed = sync.results.reduce((total, result) => total + result.errors.length, 0);
                toast.success(failed > 0
                    ? 'Compartilhamento removido; algumas revogações ficaram pendentes.'
                    : 'Compartilhamento e permissões removidos.');
            } catch {
                toast.success('Compartilhamento removido. A revogação no Google ficou pendente.');
            }
            void loadInitialData();
        } catch (error) {
            toast.error('Erro ao remover compartilhamento');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRoleChange = async (
        share: BibliotecaCompartilhamento,
        role: 'reader' | 'writer'
    ) => {
        if (share.google_role === role || submitting) return;
        setSubmitting(true);
        try {
            await bibliotecaService.atualizarPapelGoogleCompartilhamento(share.id, role);
            try {
                const sync = await bibliotecaService.sincronizarItemGoogle({
                    [itemType === 'pasta' ? 'pastaId' : 'arquivoId']: itemId,
                });
                const failed = sync.results.reduce((total, result) => total + result.errors.length, 0);
                toast.success(failed > 0
                    ? 'Permissão atualizada; a sincronização ficou pendente.'
                    : 'Permissão atualizada no Google Drive.');
            } catch {
                toast.success('Permissão salva. A sincronização com o Google ficou pendente.');
            }
            void loadInitialData();
        } catch {
            toast.error('Erro ao atualizar a permissão');
        } finally {
            setSubmitting(false);
        }
    };

    const getTargetName = (share: BibliotecaCompartilhamento) => {
        if (share.grupo_id) {
            return gruposAcesso.find(g => g.id === share.grupo_id)?.nome || 'Grupo desconhecido';
        }
        if (share.equipe_id) {
            return equipes.find(e => e.id === share.equipe_id)?.nome || 'Equipe desconhecida';
        }
        return 'Desconhecido';
    };

    // Estilo comum para os selects para evitar corte de texto
    const selectStyle: React.CSSProperties = {
        height: '45px',
        width: '100%',
        padding: '0 1rem',
        fontSize: '0.95rem',
        backgroundColor: 'var(--surface-2)',
        color: 'var(--text-color)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'block',
        lineHeight: '45px', // Alinha verticalmente
        appearance: 'auto', // Garante a seta do navegador se necessário, ou 'none' para custom
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Compartilhar ${itemType === 'pasta' ? 'Pasta' : 'Arquivo'}`}>
            <div style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
                <p style={{ fontSize: '0.95rem', opacity: 0.8, display: 'flex', gap: '0.5rem' }}>
                    Compartilhando: <strong style={{ color: 'var(--primary-color)' }}>{itemName}</strong>
                </p>
                {isGoogleManaged && (
                    <p style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        As permissões individuais deste arquivo serão sincronizadas no Google Drive.
                    </p>
                )}
                {isGoogleDrive && !isGoogleManaged && (
                    <p style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        Este é um link manual. O acesso também precisa ser concedido diretamente no Google Drive.
                    </p>
                )}
                {itemType === 'pasta' && (
                    <p style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(37, 99, 235, 0.08)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        A permissão escolhida será aplicada aos arquivos gerenciados nesta pasta e nas subpastas.
                    </p>
                )}
            </div>

            <div className="card" style={{ 
                padding: '1.5rem', 
                backgroundColor: 'rgba(255, 255, 255, 0.03)', 
                marginBottom: '2rem', 
                border: '1px solid var(--border-color)',
                borderRadius: '12px'
            }}>
                <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <PlusCircle size={18} color="var(--primary-color)" /> Novo Compartilhamento
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', display: 'block', opacity: 0.9 }}>
                            Compartilhar com:
                        </label>
                        <select 
                            style={selectStyle}
                            value={targetType}
                            onChange={(e) => { setTargetType(e.target.value as 'grupo' | 'equipe'); setSelectedTargetId(''); }}
                        >
                            <option value="grupo">Grupo de Acesso (Perfil de Usuário)</option>
                            <option value="equipe">Equipe EJC (Trabalho no Encontro)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', display: 'block', opacity: 0.9 }}>
                            Permissão nos documentos Google:
                        </label>
                        <select
                            style={selectStyle}
                            value={googleRole}
                            onChange={(event) => setGoogleRole(event.target.value as 'reader' | 'writer')}
                        >
                            <option value="reader">Leitor — pode visualizar</option>
                            <option value="writer">Editor — pode alterar</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.6rem', display: 'block', opacity: 0.9 }}>
                            {targetType === 'grupo' ? 'Selecionar o Grupo:' : 'Selecionar a Equipe:'}
                        </label>
                        <select 
                            style={selectStyle}
                            value={selectedTargetId}
                            onChange={(e) => setSelectedTargetId(e.target.value)}
                        >
                            <option value="">Clique para selecionar...</option>
                            {targetType === 'grupo' ? (
                                gruposAcesso.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)
                            ) : (
                                equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)
                            )}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                        <button 
                            className="btn-primary" 
                            style={{ 
                                height: '46px', 
                                padding: '0 3rem', 
                                borderRadius: '23px',
                                fontSize: '1rem',
                                fontWeight: 700,
                                boxShadow: '0 4px 15px rgba(37, 99, 235, 0.2)'
                            }}
                            onClick={handleAddShare}
                            disabled={submitting || !selectedTargetId}
                        >
                            {submitting ? <Loader className="animate-spin" size={18} /> : 'Salvar Compartilhamento'}
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 0.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Vínculos Ativos
                </h4>
                
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Loader className="animate-spin" size={28} color="var(--primary-color)" />
                    </div>
                ) : compartilhamentos.length === 0 ? (
                    <div style={{ 
                        padding: '2.5rem', 
                        textAlign: 'center', 
                        border: '1px dashed var(--border-color)', 
                        borderRadius: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)'
                    }}>
                        <p style={{ fontSize: '0.9rem', opacity: 0.4 }}>
                            Este item ainda não foi compartilhado.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {compartilhamentos.map(share => (
                            <div key={share.id} style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
                                padding: '1.2rem', background: 'var(--surface-1)', borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ 
                                        width: '40px', height: '40px', borderRadius: '10px', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backgroundColor: 'rgba(37, 99, 235, 0.12)', color: 'var(--primary-color)'
                                    }}>
                                        {share.grupo_id ? <Shield size={20} /> : <Users size={20} />}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600 }}>{getTargetName(share)}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                                            {share.grupo_id ? 'Grupo de Acesso' : 'Equipe EJC'} · {share.google_role === 'writer' ? 'Editor' : 'Leitor'} no Google
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                                    <select
                                        aria-label={`Permissão Google de ${getTargetName(share)}`}
                                        value={share.google_role}
                                        disabled={submitting}
                                        onChange={(event) => void handleRoleChange(
                                            share,
                                            event.target.value as 'reader' | 'writer'
                                        )}
                                        style={{ ...selectStyle, width: 'auto', minWidth: '110px', height: '40px' }}
                                    >
                                        <option value="reader">Leitor</option>
                                        <option value="writer">Editor</option>
                                    </select>
                                    <button
                                        className="icon-btn text-danger"
                                        style={{ padding: '8px' }}
                                        onClick={() => handleRemoveShare(share.id)}
                                        disabled={submitting}
                                        title="Remover"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                <button className="btn-secondary" style={{ padding: '0.7rem 2.5rem', borderRadius: '8px' }} onClick={onClose}>Fechar</button>
            </div>
        </Modal>
    );
}
