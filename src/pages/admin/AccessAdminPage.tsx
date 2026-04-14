import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Save, Trash2 } from 'lucide-react';
import { Header } from '../../components/Header';
import { adminAccessService } from '../../services/adminAccessService';
import type { Grupo, Permissao, GrupoPermissao } from '../../services/adminAccessService';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function AccessAdminPage() {
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [permissoes, setPermissoes] = useState<Permissao[]>([]);
    const [relacoes, setRelacoes] = useState<GrupoPermissao[]>([]);
    
    const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
    const [grupoPermissoesIds, setGrupoPermissoesIds] = useState<string[]>([]);
    
    const [isCreating, setIsCreating] = useState(false);
    const [newNome, setNewNome] = useState('');
    const [newDescricao, setNewDescricao] = useState('');
    const [isSavingRelation, setIsSavingRelation] = useState(false);

    const [loading, setLoading] = useState(true);

    const [grupoToDelete, setGrupoToDelete] = useState<string | null>(null);

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

    const handleSelectGrupo = (grupo: Grupo) => {
        setSelectedGrupo(grupo);
        setIsCreating(false);
        const permissoesDoGrupo = relacoes
            .filter(r => r.grupo_id === grupo.id)
            .map(r => r.permissao_id);
        setGrupoPermissoesIds(permissoesDoGrupo);
    };

    const handleTogglePermissao = (permissaoId: string) => {
        setGrupoPermissoesIds(prev => 
            prev.includes(permissaoId) 
                ? prev.filter(id => id !== permissaoId)
                : [...prev, permissaoId]
        );
    };

    const handleSavePermissoes = async () => {
        if (!selectedGrupo) return;
        setIsSavingRelation(true);
        try {
            await adminAccessService.updateGrupoPermissoes(selectedGrupo.id, grupoPermissoesIds);
            
            // update local relation state
            setRelacoes(prev => [
                ...prev.filter(r => r.grupo_id !== selectedGrupo.id),
                ...grupoPermissoesIds.map(pid => ({ grupo_id: selectedGrupo.id, permissao_id: pid }))
            ]);
            toast.success('Permissões salvas no grupo.');
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
            handleSelectGrupo(newGrupo);
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
            if (selectedGrupo?.id === grupoToDelete) {
                setSelectedGrupo(null);
            }
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
            <Header />
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
                <p className="text-muted">Carregando...</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 2fr', gap: '1.5rem', alignItems: 'start' }}>
                    
                    {/* Lista de Grupos */}
                    <section className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-1)' }}>
                            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Grupos</h2>
                            <button className="btn-secondary" onClick={() => { setIsCreating(true); setSelectedGrupo(null); }} style={{ padding: '0.4rem 0.6rem' }} title="Novo Grupo">
                                <Plus size={16} />
                            </button>
                        </div>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                            {grupos.map(g => (
                                <div 
                                    key={g.id}
                                    onClick={() => handleSelectGrupo(g)}
                                    style={{
                                        padding: '1rem',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        background: selectedGrupo?.id === g.id && !isCreating ? 'var(--primary-light)' : 'transparent',
                                        borderLeft: selectedGrupo?.id === g.id && !isCreating ? '4px solid var(--primary-color)' : '4px solid transparent',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, color: selectedGrupo?.id === g.id && !isCreating ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                            {g.nome}
                                        </div>
                                        {g.descricao && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)', marginTop: '0.2rem' }}>
                                                {g.descricao.length > 50 ? g.descricao.substring(0, 50) + '...' : g.descricao}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Detalhes do Grupo (Criação ou Edição de Permissões) */}
                    {isCreating ? (
                        <section className="card">
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Plus size={20} className="text-primary" /> Novo Grupo
                            </h2>
                            <form onSubmit={handleCreateGrupo}>
                                <div className="form-group">
                                    <label className="form-label">Nome do Grupo <span style={{color: 'var(--danger-text)'}}>*</span></label>
                                    <input 
                                        type="text"
                                        className="form-input" 
                                        required
                                        value={newNome}
                                        onChange={e => setNewNome(e.target.value)}
                                        placeholder="Ex: Equipe de Apoio, Finanças..."
                                    />
                                </div>
                                <div className="form-group" style={{ marginTop: '1rem' }}>
                                    <label className="form-label">Descrição (opcional)</label>
                                    <textarea 
                                        className="form-input" 
                                        rows={3}
                                        value={newDescricao}
                                        onChange={e => setNewDescricao(e.target.value)}
                                        placeholder="O que este grupo pode fazer..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                                    <button type="submit" className="btn-primary" disabled={isSavingRelation || !newNome}>
                                        <Save size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                        Criar Grupo
                                    </button>
                                </div>
                            </form>
                        </section>
                    ) : selectedGrupo ? (
                        <section className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--primary-color)' }}>{selectedGrupo.nome}</h2>
                                    {selectedGrupo.descricao && (
                                        <p style={{ margin: '0.2rem 0 0', color: 'var(--muted-text)', fontSize: '0.9rem' }}>{selectedGrupo.descricao}</p>
                                    )}
                                </div>
                                <button className="btn-secondary danger" style={{ padding: '0.4rem' }} title="Excluir Grupo" onClick={() => setGrupoToDelete(selectedGrupo.id)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                                Permissões / Opções do Sistema
                            </h3>
                            
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {permissoes.map(p => {
                                    const isEnabled = grupoPermissoesIds.includes(p.id);
                                    return (
                                        <label 
                                            key={p.id} 
                                            style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                padding: '1rem',
                                                background: 'var(--surface-1)',
                                                border: `1px solid ${isEnabled ? 'var(--primary-border, var(--primary-color))' : 'var(--border-color)'}`,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>{p.descricao}</div>
                                                <code style={{ fontSize: '0.75rem', color: 'var(--muted-text)', marginTop: '0.2rem', display: 'inline-block' }}>{p.chave}</code>
                                            </div>
                                            
                                            {/* Toggle Switch */}
                                            <div style={{
                                                position: 'relative',
                                                width: '44px',
                                                height: '24px',
                                                background: isEnabled ? 'var(--primary-color)' : 'var(--border-color)',
                                                borderRadius: '24px',
                                                transition: '0.3s'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '2px',
                                                    left: isEnabled ? '22px' : '2px',
                                                    width: '20px',
                                                    height: '20px',
                                                    background: '#fff',
                                                    borderRadius: '50%',
                                                    transition: '0.3s',
                                                    boxShadow: 'var(--shadow-sm)'
                                                }} />
                                                <input 
                                                    type="checkbox"
                                                    checked={isEnabled}
                                                    onChange={() => handleTogglePermissao(p.id)}
                                                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                                />
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                <button className="btn-primary" onClick={handleSavePermissoes} disabled={isSavingRelation}>
                                    <Save size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                    {isSavingRelation ? 'Salvando...' : 'Salvar Ajustes'}
                                </button>
                            </div>
                        </section>
                    ) : (
                        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                            <div className="text-center text-muted">
                                <Shield size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                                <p>Selecione um grupo ao lado para configurar seus acessos,<br />ou crie um novo grupo.</p>
                            </div>
                        </div>
                    )}
                </div>
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
