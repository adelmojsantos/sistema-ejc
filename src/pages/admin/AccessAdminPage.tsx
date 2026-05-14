import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { adminAccessService } from '../../services/adminAccessService';
import type { Grupo, Permissao, GrupoPermissao } from '../../services/adminAccessService';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function AccessAdminPage() {
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [permissoes, setPermissoes] = useState<Permissao[]>([]);
    const [relacoes, setRelacoes] = useState<GrupoPermissao[]>([]);
    
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newNome, setNewNome] = useState('');
    const [newDescricao, setNewDescricao] = useState('');
    const [isSavingRelation, setIsSavingRelation] = useState(false);
    const [loading, setLoading] = useState(true);
    const [grupoToDelete, setGrupoToDelete] = useState<string | null>(null);

    // Estado temporário para edições de permissões por grupo
    const [tempPermissoes, setTempPermissoes] = useState<Record<string, string[]>>({});

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [g, p, r] = await Promise.all([
                adminAccessService.listGrupos(),
                adminAccessService.listPermissoes(),
                adminAccessService.listGrupoPermissoes()
            ]);
            setGrupos(g);
            setPermissoes(p);
            setRelacoes(r);
        } catch {
            toast.error('Erro ao carregar dados de acesso.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const initialTemp: Record<string, string[]> = {};
        grupos.forEach(g => {
            initialTemp[g.id] = relacoes.filter(r => r.grupo_id === g.id).map(r => r.permissao_id);
        });
        setTempPermissoes(initialTemp);
    }, [grupos, relacoes]);

    const toggleGroupExpand = (grupoId: string) => {
        setExpandedGroupId(prev => prev === grupoId ? null : grupoId);
    };

    const handleTogglePermissao = (grupoId: string, permissaoId: string) => {
        setTempPermissoes(prev => {
            const current = prev[grupoId] || [];
            const next = current.includes(permissaoId)
                ? current.filter(id => id !== permissaoId)
                : [...current, permissaoId];
            return { ...prev, [grupoId]: next };
        });
    };

    const setPermissaoState = (grupoId: string, permissaoId: string, value: boolean) => {
        setTempPermissoes(prev => {
            const current = prev[grupoId] || [];
            const next = value 
                ? (current.includes(permissaoId) ? current : [...current, permissaoId])
                : current.filter(id => id !== permissaoId);
            return { ...prev, [grupoId]: next };
        });
    };

    const handleSavePermissoes = async (grupoId: string) => {
        const ids = tempPermissoes[grupoId] || [];
        setIsSavingRelation(true);
        try {
            await adminAccessService.updateGrupoPermissoes(grupoId, ids);
            
            setRelacoes(prev => [
                ...prev.filter(r => r.grupo_id !== grupoId),
                ...ids.map(pid => ({ grupo_id: grupoId, permissao_id: pid }))
            ]);
            toast.success('Permissões salvas com sucesso.');
        } catch {
            toast.error('Erro ao salvar permissões.');
        } finally {
            setIsSavingRelation(false);
        }
    };

    const handleCreateGrupo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNome) return;

        setIsSavingRelation(true);
        try {
            const newGrupo = await adminAccessService.createGrupo(newNome, newDescricao);
            setGrupos(prev => [...prev, newGrupo].sort((a,b) => a.nome.localeCompare(b.nome)));
            setNewNome('');
            setNewDescricao('');
            setIsCreating(false);
            setExpandedGroupId(newGrupo.id); // Abre o novo grupo
            toast.success('Grupo criado com sucesso.');
        } catch {
            toast.error('Erro ao criar grupo.');
        } finally {
            setIsSavingRelation(false);
        }
    };

    const handleDeleteGrupo = async () => {
        if (!grupoToDelete) return;
        setIsSavingRelation(true);
        try {
            await adminAccessService.deleteGrupo(grupoToDelete);
            setGrupos(prev => prev.filter(g => g.id !== grupoToDelete));
            toast.success('Grupo excluído.');
        } catch {
            toast.error('Erro ao excluir grupo.');
        } finally {
            setIsSavingRelation(false);
            setGrupoToDelete(null);
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
                        <Shield size={22} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                        Grupos e Acessos
                    </h1>
                    <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                        Crie grupos e controle os módulos visíveis para cada papel no sistema.
                    </p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <p className="text-muted">Carregando grupos...</p>
                </div>
            ) : (
                <motion.div 
                    style={{ display: 'grid', gap: '1rem' }}
                    initial="hidden"
                    animate="visible"
                    variants={{
                        visible: {
                            transition: {
                                staggerChildren: 0.05
                            }
                        }
                    }}
                >
                    
                    {/* Botão de Criação / Formulário de Criação */}
                    {!isCreating ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                            <button className="btn-primary" onClick={() => setIsCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={18} /> Novo Grupo
                            </button>
                        </div>
                    ) : (
                        <section className="card animate-fade-in" style={{ border: '2px dashed var(--primary-color)', background: 'var(--surface-1)' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={20} className="text-primary" /> Novo Grupo de Acesso
                            </h2>
                            <form onSubmit={handleCreateGrupo}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Nome do Grupo <span style={{color: 'var(--danger-text)'}}>*</span></label>
                                        <input 
                                            type="text"
                                            className="form-input" 
                                            required
                                            value={newNome}
                                            onChange={e => setNewNome(e.target.value)}
                                            placeholder="Ex: Coordenadores, Apoio..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Descrição (opcional)</label>
                                        <input 
                                            type="text"
                                            className="form-input" 
                                            value={newDescricao}
                                            onChange={e => setNewDescricao(e.target.value)}
                                            placeholder="O que os membros deste grupo podem fazer?"
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                                    <button type="submit" className="btn-primary" disabled={isSavingRelation || !newNome}>
                                        <Save size={16} style={{ marginRight: '0.4rem' }} />
                                        Criar Grupo
                                    </button>
                                </div>
                            </form>
                        </section>
                    )}

                    {/* Lista de Grupos em Cards */}
                    {grupos.length === 0 && !isCreating ? (
                        <div className="card text-center text-muted" style={{ padding: '3rem' }}>
                            <Shield size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                            <p>Nenhum grupo cadastrado.</p>
                        </div>
                    ) : (
                        grupos.map(g => {
                            const isExpanded = expandedGroupId === g.id;
                            const activePerms = tempPermissoes[g.id] || [];

                            return (
                                <motion.article 
                                    key={g.id} 
                                    layout
                                    variants={{
                                        hidden: { opacity: 0, y: 10 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    whileHover={isExpanded ? {} : { scale: 1.01, boxShadow: 'var(--shadow-lg)', borderColor: 'var(--primary-color)' }}
                                    className="card" 
                                    style={{ 
                                        padding: '0', 
                                        overflow: 'hidden',
                                        borderLeft: `4px solid ${isExpanded ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                        transition: 'all 0.2s ease',
                                        boxShadow: isExpanded ? 'var(--shadow-md)' : 'none',
                                        position: 'relative',
                                        zIndex: isExpanded ? 10 : 1
                                    }}
                                >
                                    {/* Header do Card */}
                                    <div 
                                        onClick={() => toggleGroupExpand(g.id)}
                                        style={{ 
                                            padding: '1.25rem 1.5rem', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            background: isExpanded ? 'var(--surface-1)' : 'transparent',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                                            <div style={{ minWidth: '180px' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: isExpanded ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                                    {g.nome}
                                                </h3>
                                                <span className="badge badge-secondary" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                                    {activePerms.length} permissões ativas
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted-text)', flex: 1 }} className="hide-mobile">
                                                {g.descricao || 'Sem descrição.'}
                                            </p>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={e => e.stopPropagation()}>
                                            <button 
                                                className="btn-secondary" 
                                                style={{ 
                                                    padding: '0.5rem 0.8rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.4rem',
                                                    fontSize: '0.8rem',
                                                    backgroundColor: '#ef4444',
                                                    color: '#ffffff',
                                                    border: 'none'
                                                }} 
                                                title="Excluir Grupo" 
                                                onClick={() => setGrupoToDelete(g.id)}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                            >
                                                <Trash2 size={14} />
                                                <span>Excluir</span>
                                            </button>
                                            <div
                                                style={{ 
                                                    padding: '0.4rem', 
                                                    color: 'var(--muted-text)',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conteúdo Expandido (Permissões) */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Permissões Disponíveis</h4>
                                                        <button className="btn-primary" onClick={() => handleSavePermissoes(g.id)} disabled={isSavingRelation}>
                                                            <Save size={16} style={{ marginRight: '0.4rem' }} />
                                                            Salvar Permissões
                                                        </button>
                                                    </div>

                                                    <div style={{ 
                                                        display: 'grid', 
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                                                        gap: '1rem' 
                                                    }}>
                                                        {permissoes.map(p => {
                                                            const isEnabled = activePerms.includes(p.id);
                                                            return (
                                                                <motion.div 
                                                                    key={p.id} 
                                                                    whileHover={{ scale: 1.01 }}
                                                                    whileTap={{ scale: 0.99 }}
                                                                    onClick={() => handleTogglePermissao(g.id, p.id)}
                                                                    style={{ 
                                                                        display: 'flex', 
                                                                        flexDirection: 'column',
                                                                        gap: '1rem',
                                                                        padding: '1.25rem',
                                                                        background: isEnabled ? 'rgba(34, 197, 94, 0.05)' : 'var(--surface-1)',
                                                                        border: `1px solid ${isEnabled ? 'var(--success-border)' : 'var(--border-color)'}`,
                                                                        borderRadius: '12px',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.95rem' }}>{p.descricao}</div>
                                                                        <code style={{ fontSize: '0.7rem', color: 'var(--muted-text)', marginTop: '0.2rem', display: 'inline-block' }}>{p.chave}</code>
                                                                    </div>
                                                                    
                                                                    {/* Segmented Control Sim/Não embaixo 100% width */}
                                                                    <div style={{ 
                                                                        display: 'flex', 
                                                                        background: 'var(--bg-color)', 
                                                                        padding: '2px', 
                                                                        borderRadius: '8px', 
                                                                        border: '1px solid var(--border-color)',
                                                                        width: '100%'
                                                                    }} onClick={e => e.stopPropagation()}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setPermissaoState(g.id, p.id, true);
                                                                            }}
                                                                            style={{
                                                                                flex: 1,
                                                                                padding: '8px 20px',
                                                                                fontSize: '0.8rem',
                                                                                fontWeight: 700,
                                                                                borderRadius: '6px',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                backgroundColor: isEnabled ? 'var(--success-border)' : 'transparent',
                                                                                color: isEnabled ? '#fff' : 'var(--muted-text)',
                                                                                transition: '0.2s'
                                                                            }}
                                                                        >
                                                                            Sim
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setPermissaoState(g.id, p.id, false);
                                                                            }}
                                                                            style={{
                                                                                flex: 1,
                                                                                padding: '8px 20px',
                                                                                fontSize: '0.8rem',
                                                                                fontWeight: 700,
                                                                                borderRadius: '6px',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                backgroundColor: !isEnabled ? 'var(--danger-border)' : 'transparent',
                                                                                color: !isEnabled ? '#fff' : 'var(--muted-text)',
                                                                                transition: '0.2s'
                                                                            }}
                                                                        >
                                                                            Não
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.article>
                            );
                        })
                    )}
                </motion.div>
            )}

            <ConfirmDialog 
                isOpen={!!grupoToDelete}
                title="Excluir Grupo"
                message="Tem certeza que quer excluir este grupo? Atenção: isso removerá as permissões de todos os usuários que pertencem somente a ele."
                confirmText="Excluir Grupo"
                cancelText="Cancelar"
                isDestructive={true}
                onConfirm={handleDeleteGrupo}
                onCancel={() => setGrupoToDelete(null)}
                isLoading={isSavingRelation}
            />
        </div>
    );
}
