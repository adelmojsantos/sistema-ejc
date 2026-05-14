import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Users, Shield, Trash2, Loader, PlusCircle } from 'lucide-react';
import { bibliotecaService, type BibliotecaCompartilhamento } from '../../../services/bibliotecaService';
import { useEquipes } from '../../../contexts/EquipeContext';
import { toast } from 'react-hot-toast';

interface ShareItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: string;
    itemName: string;
    itemType: 'pasta' | 'arquivo';
}

export function ShareItemModal({ isOpen, onClose, itemId, itemName, itemType }: ShareItemModalProps) {
    const { equipes } = useEquipes();
    const [gruposAcesso, setGruposAcesso] = useState<{ id: string, nome: string }[]>([]);
    const [compartilhamentos, setCompartilhamentos] = useState<BibliotecaCompartilhamento[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [targetType, setTargetType] = useState<'grupo' | 'equipe'>('grupo');
    const [selectedTargetId, setSelectedTargetId] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadInitialData();
        }
    }, [isOpen, itemId]);

    const loadInitialData = async () => {
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
    };

    const handleAddShare = async () => {
        if (!selectedTargetId) return;
        setSubmitting(true);
        try {
            await bibliotecaService.compartilharItem({
                [itemType === 'pasta' ? 'pastaId' : 'arquivoId']: itemId,
                grupoId: targetType === 'grupo' ? selectedTargetId : undefined,
                equipeId: targetType === 'equipe' ? selectedTargetId : undefined
            });
            toast.success('Compartilhamento adicionado');
            setSelectedTargetId('');
            loadInitialData();
        } catch (error: any) {
            if (error.code === '23505') {
                toast.error('Este item já está compartilhado com este destino');
            } else {
                toast.error('Erro ao compartilhar item');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveShare = async (id: string) => {
        try {
            await bibliotecaService.removerCompartilhamento(id);
            toast.success('Compartilhamento removido');
            loadInitialData();
        } catch (error) {
            toast.error('Erro ao remover compartilhamento');
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
                            onChange={(e) => { setTargetType(e.target.value as any); setSelectedTargetId(''); }}
                        >
                            <option value="grupo">Grupo de Acesso (Perfil de Usuário)</option>
                            <option value="equipe">Equipe EJC (Trabalho no Encontro)</option>
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
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{share.grupo_id ? 'Grupo de Acesso' : 'Equipe EJC'}</div>
                                    </div>
                                </div>
                                <button 
                                    className="icon-btn text-danger" 
                                    style={{ padding: '8px' }}
                                    onClick={() => handleRemoveShare(share.id)}
                                    title="Remover"
                                >
                                    <Trash2 size={20} />
                                </button>
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
