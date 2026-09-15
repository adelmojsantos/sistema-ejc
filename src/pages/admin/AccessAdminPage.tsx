import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { adminAccessService } from '../../services/adminAccessService';
import { bibliotecaService } from '../../services/bibliotecaService';
import type { Grupo, Permissao, GrupoPermissao } from '../../services/adminAccessService';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import './AccessAdminPage.css';

const PERMISSION_TERM_LABELS: Record<string, string> = {
    admin: 'Administração',
    almoxarifado: 'Almoxarifado',
    arquivos: 'Arquivos',
    biblioteca: 'Biblioteca',
    cadastros: 'Cadastros',
    circulos: 'Círculos',
    compras: 'Compras',
    consultar: 'Consultar',
    coordenador: 'Coordenadores',
    coordenar: 'Coordenação',
    criar: 'Criar',
    cuidados: 'Cuidados',
    dashboard: 'Página inicial',
    diagnosticos: 'Diagnósticos técnicos',
    drive: 'Drive',
    duplas: 'Duplas',
    email: 'E-mail',
    financeiro: 'Financeiro',
    gerenciar: 'Gerenciar',
    google: 'Google',
    importar: 'Importar',
    inscricao: 'Inscrições',
    institucional: 'institucional',
    ligacao: 'Ligação',
    mediador: 'Mediadores',
    movimentar: 'Movimentar estoque',
    pedidos: 'Pedidos',
    recepcao: 'Recepção',
    recreacao: 'Recreação',
    responder: 'Responder',
    secretaria: 'Secretaria',
    visitacao: 'Visitação',
};

const SPECIFIC_PERMISSION_PARENT_KEYS: Record<string, string> = {
    almoxarifado_compras_operar: 'modulo_almoxarifado',
    almoxarifado_consultar: 'modulo_almoxarifado',
    almoxarifado_gerenciar: 'modulo_almoxarifado',
    almoxarifado_movimentar: 'modulo_almoxarifado',
    almoxarifado_pedidos_criar: 'modulo_almoxarifado',
    almoxarifado_pedidos_gerenciar: 'modulo_almoxarifado',
    biblioteca_google_importar: 'modulo_biblioteca',
    email_institucional_gerenciar: 'modulo_email_institucional',
    email_institucional_responder: 'modulo_email_institucional',
    financeiro_gerenciar: 'modulo_financeiro',
};

function humanizePermissionKey(key: string) {
    return key
        .replace(/^modulo_/, '')
        .split('_')
        .map(term => PERMISSION_TERM_LABELS[term] || `${term.charAt(0).toUpperCase()}${term.slice(1)}`)
        .join(' · ');
}

function getPermissionName(permission: Permissao) {
    const registeredName = permission.nome?.trim();
    if (!registeredName) return humanizePermissionKey(permission.chave);

    return registeredName.replace(/^Acesso\s+(?:à|às|ao|aos)\s+/i, '');
}

function sortPermissions(permissions: Permissao[]) {
    return [...permissions].sort((first, second) =>
        getPermissionName(first).localeCompare(getPermissionName(second), 'pt-BR')
    );
}

function haveSameIds(first: string[], second: string[]) {
    if (first.length !== second.length) return false;
    const secondIds = new Set(second);
    return first.every(id => secondIds.has(id));
}

function getNestedPermissionName(permission: Permissao, parentPermission: Permissao) {
    const name = getPermissionName(permission);
    const parentName = getPermissionName(parentPermission);
    return name.replace(new RegExp(`^${parentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—–-]\\s*`, 'i'), '');
}

interface PermissionSwitchProps {
    permission: Permissao;
    name: string;
    isEnabled: boolean;
    onToggle: () => void;
    onShowDetails: (permission: Permissao) => void;
}

function PermissionSwitch({
    permission,
    name,
    isEnabled,
    onToggle,
    onShowDetails,
}: PermissionSwitchProps) {
    return (
        <div className="access-permission-row__actions">
            <button
                type="button"
                className="access-permission-row__info"
                aria-label={`Ver detalhes de ${name}`}
                title={`Ver detalhes de ${name}`}
                onClick={() => onShowDetails(permission)}
            >
                O que libera?
            </button>
            <label className="access-permission-switch">
                <input
                    type="checkbox"
                    role="switch"
                    checked={isEnabled}
                    aria-label={`${name}: ${isEnabled ? 'liberado' : 'bloqueado'}`}
                    onChange={onToggle}
                />
                <span className="access-permission-switch__track" aria-hidden="true" />
            </label>
        </div>
    );
}

interface ModulePermissionAccordionProps {
    modulePermission: Permissao;
    specificPermissions: Permissao[];
    activePermissionIds: string[];
    onToggleModule: (permission: Permissao) => void;
    onToggleSpecific: (permission: Permissao, parentPermission: Permissao) => void;
    onShowDetails: (permission: Permissao) => void;
}

function ModulePermissionAccordion({
    modulePermission,
    specificPermissions,
    activePermissionIds,
    onToggleModule,
    onToggleSpecific,
    onShowDetails,
}: ModulePermissionAccordionProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const moduleName = getPermissionName(modulePermission);
    const isEnabled = activePermissionIds.includes(modulePermission.id);
    const hasSpecificPermissions = specificPermissions.length > 0;
    const detailsId = `module-permission-${modulePermission.id}`;

    return (
        <div className={`access-module-permission ${isEnabled ? 'access-module-permission--enabled' : ''}`}>
            <div className="access-module-permission__header">
                {hasSpecificPermissions ? (
                    <button
                        type="button"
                        className="access-module-permission__expand"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
                        onClick={() => setIsExpanded(current => !current)}
                    >
                        {isExpanded ? <ChevronUp size={19} aria-hidden="true" /> : <ChevronDown size={19} aria-hidden="true" />}
                        <span>{moduleName}</span>
                        <span className="access-module-permission__count">
                            {specificPermissions.length} {specificPermissions.length === 1 ? 'ação adicional' : 'ações adicionais'}
                        </span>
                    </button>
                ) : (
                    <span className="access-module-permission__name">{moduleName}</span>
                )}
                <PermissionSwitch
                    permission={modulePermission}
                    name={moduleName}
                    isEnabled={isEnabled}
                    onToggle={() => onToggleModule(modulePermission)}
                    onShowDetails={onShowDetails}
                />
            </div>

            <AnimatePresence initial={false}>
                {hasSpecificPermissions && isExpanded && (
                    <motion.div
                        id={detailsId}
                        className="access-module-permission__details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                    >
                        <p className="access-module-permission__hint">
                            Ações adicionais deste módulo. Ao ativar uma delas, o acesso ao módulo também será liberado.
                        </p>
                        <div className="access-specific-permission-list">
                            {specificPermissions.map(permission => {
                                const name = getNestedPermissionName(permission, modulePermission);
                                const childIsEnabled = activePermissionIds.includes(permission.id);

                                return (
                                    <div
                                        key={permission.id}
                                        className={`access-specific-permission-row ${childIsEnabled ? 'access-specific-permission-row--enabled' : ''}`}
                                    >
                                        <span className="access-permission-row__name">{name}</span>
                                        <PermissionSwitch
                                            permission={permission}
                                            name={`${moduleName} — ${name}`}
                                            isEnabled={childIsEnabled}
                                            onToggle={() => onToggleSpecific(permission, modulePermission)}
                                            onShowDetails={onShowDetails}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

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
    const [selectedPermission, setSelectedPermission] = useState<Permissao | null>(null);

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

    const handleToggleModule = (grupoId: string, modulePermission: Permissao) => {
        setTempPermissoes(prev => {
            const current = prev[grupoId] || [];
            const isEnabled = current.includes(modulePermission.id);
            const childPermissionIds = new Set(
                permissoes
                    .filter(permission => SPECIFIC_PERMISSION_PARENT_KEYS[permission.chave] === modulePermission.chave)
                    .map(permission => permission.id)
            );
            const next = isEnabled
                ? current.filter(id => id !== modulePermission.id && !childPermissionIds.has(id))
                : [...current, modulePermission.id];
            return { ...prev, [grupoId]: next };
        });
    };

    const handleToggleSpecificPermission = (
        grupoId: string,
        permission: Permissao,
        parentPermission: Permissao
    ) => {
        setTempPermissoes(prev => {
            const current = prev[grupoId] || [];
            const isEnabled = current.includes(permission.id);

            if (isEnabled) {
                return {
                    ...prev,
                    [grupoId]: current.filter(id => id !== permission.id),
                };
            }

            const next = Array.from(new Set([
                ...current,
                parentPermission.id,
                permission.id,
            ]));
            return { ...prev, [grupoId]: next };
        });
    };

    const handleSavePermissoes = async (grupoId: string) => {
        const ids = tempPermissoes[grupoId] || [];
        const savedIds = relacoes
            .filter(relation => relation.grupo_id === grupoId)
            .map(relation => relation.permissao_id);
        const libraryPermissionId = permissoes.find(
            permission => permission.chave === 'modulo_biblioteca'
        )?.id;
        const libraryAccessChanged = Boolean(
            libraryPermissionId
            && ids.includes(libraryPermissionId) !== savedIds.includes(libraryPermissionId)
        );

        setIsSavingRelation(true);
        try {
            await adminAccessService.updateGrupoPermissoes(grupoId, ids);
            
            setRelacoes(prev => [
                ...prev.filter(r => r.grupo_id !== grupoId),
                ...ids.map(pid => ({ grupo_id: grupoId, permissao_id: pid }))
            ]);

            if (!libraryAccessChanged) {
                toast.success('Permissões salvas com sucesso.');
                return;
            }

            try {
                const syncResult = await bibliotecaService.sincronizarGoogleDrive(25);
                const failures = syncResult.results.reduce(
                    (total, item) => total + item.errors.length,
                    0
                );
                const status = await bibliotecaService.obterStatusGoogleDrive();

                if (failures > 0 || status.pendingCount > 0) {
                    toast.success('Permissão da Biblioteca salva.');
                    toast('Alguns acessos do Google ainda estão sendo processados.');
                } else {
                    toast.success('Permissão da Biblioteca e acessos do Google atualizados.');
                }
            } catch {
                toast.success('Permissão da Biblioteca salva.');
                toast.error('Não foi possível sincronizar agora os acessos do Google. A Biblioteca tentará novamente ao ser aberta.');
            }
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
        <div className="container access-admin-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
                        <Shield size={22} className="access-admin-page__title-icon" />
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
                        <div className="access-admin-page__create-action">
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
                                <div className="access-admin-page__form-actions" style={{ marginTop: '1.5rem' }}>
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
                            const savedPerms = relacoes
                                .filter(relation => relation.grupo_id === g.id)
                                .map(relation => relation.permissao_id);
                            const hasPendingChanges = !haveSameIds(activePerms, savedPerms);
                            const modulePermissions = sortPermissions(
                                permissoes.filter(permission => permission.chave.startsWith('modulo_'))
                            );
                            const specificPermissions = sortPermissions(
                                permissoes.filter(permission => !permission.chave.startsWith('modulo_'))
                            );
                            const ungroupedSpecificPermissions = specificPermissions.filter(
                                permission => !SPECIFIC_PERMISSION_PARENT_KEYS[permission.chave]
                            );

                            return (
                                <motion.article 
                                    key={g.id} 
                                    layout
                                    variants={{
                                        hidden: { opacity: 0, y: 10 },
                                        visible: { opacity: 1, y: 0 }
                                    }}
                                    whileHover={isExpanded ? {} : { scale: 1.01, boxShadow: 'var(--shadow-lg)' }}
                                    className={`card access-admin-page__group ${isExpanded ? 'access-admin-page__group--expanded' : ''}`}
                                    style={{ 
                                        borderLeft: `4px solid ${isExpanded ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                    }}
                                >
                                    {/* Header do Card */}
                                    <div 
                                        onClick={() => toggleGroupExpand(g.id)}
                                        className="access-admin-page__group-header"
                                    >
                                        <div className="access-admin-page__group-summary">
                                            <div className="access-admin-page__group-name">
                                                <h3 style={{ color: isExpanded ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                                    {g.nome}
                                                </h3>
                                                <span className="badge badge-secondary" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                                    {activePerms.length} permissões ativas
                                                </span>
                                            </div>
                                            <p className="access-admin-page__group-description">
                                                {g.descricao || 'Sem descrição.'}
                                            </p>
                                        </div>

                                        <div className="access-admin-page__group-actions" onClick={e => e.stopPropagation()}>
                                            <button 
                                                className="btn-secondary access-admin-page__delete-button"
                                                title="Excluir Grupo" 
                                                onClick={() => setGrupoToDelete(g.id)}
                                            >
                                                <Trash2 size={14} />
                                                <span>Excluir</span>
                                            </button>
                                            <div style={{ color: 'var(--muted-text)', display: 'flex' }}>
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
                                                <div className="access-admin-page__permissions-panel">
                                                    <div className="access-admin-page__permissions-header">
                                                        <div>
                                                            <h4 className="access-admin-page__permissions-title">Permissões disponíveis</h4>
                                                            {hasPendingChanges && (
                                                                <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                                                                    Alterações ainda não salvas
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="btn-primary access-admin-page__save-button"
                                                            onClick={() => handleSavePermissoes(g.id)}
                                                            disabled={isSavingRelation || !hasPendingChanges}
                                                        >
                                                            <Save size={16} aria-hidden="true" />
                                                            Salvar
                                                        </button>
                                                    </div>

                                                    <section className="access-permission-section" aria-label="Módulos">
                                                        <div className="access-permission-section__header">
                                                            <h5 className="access-permission-section__title">Módulos</h5>
                                                        </div>
                                                        <div className="access-module-permission-list">
                                                            {modulePermissions.map(modulePermission => (
                                                                <ModulePermissionAccordion
                                                                    key={modulePermission.id}
                                                                    modulePermission={modulePermission}
                                                                    specificPermissions={specificPermissions.filter(
                                                                        permission => SPECIFIC_PERMISSION_PARENT_KEYS[permission.chave] === modulePermission.chave
                                                                    )}
                                                                    activePermissionIds={activePerms}
                                                                    onToggleModule={permission => handleToggleModule(g.id, permission)}
                                                                    onToggleSpecific={(permission, parentPermission) =>
                                                                        handleToggleSpecificPermission(g.id, permission, parentPermission)
                                                                    }
                                                                    onShowDetails={setSelectedPermission}
                                                                />
                                                            ))}
                                                        </div>
                                                    </section>

                                                    {ungroupedSpecificPermissions.length > 0 && (
                                                        <section className="access-permission-section" aria-label="Outras permissões">
                                                            <div className="access-permission-section__header">
                                                                <h5 className="access-permission-section__title">Outras permissões</h5>
                                                            </div>
                                                            <div className="access-module-permission-list">
                                                                {ungroupedSpecificPermissions.map(permission => {
                                                                    const name = getPermissionName(permission);
                                                                    const isEnabled = activePerms.includes(permission.id);

                                                                    return (
                                                                        <div
                                                                            key={permission.id}
                                                                            className={`access-module-permission ${isEnabled ? 'access-module-permission--enabled' : ''}`}
                                                                        >
                                                                            <div className="access-module-permission__header">
                                                                                <span className="access-module-permission__name">{name}</span>
                                                                                <PermissionSwitch
                                                                                    permission={permission}
                                                                                    name={name}
                                                                                    isEnabled={isEnabled}
                                                                                    onToggle={() => handleToggleSpecificPermission(g.id, permission, permission)}
                                                                                    onShowDetails={setSelectedPermission}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </section>
                                                    )}
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

            <Modal
                isOpen={selectedPermission !== null}
                onClose={() => setSelectedPermission(null)}
                title={selectedPermission ? getPermissionName(selectedPermission) : 'Detalhes da permissão'}
            >
                {selectedPermission && (
                    <div className="access-permission-modal">
                        <p className="access-permission-modal__description">
                            {selectedPermission.descricao || 'Esta permissão não possui uma descrição cadastrada.'}
                        </p>
                        {selectedPermission.chave === 'modulo_biblioteca' && (
                            <div className="access-permission-modal__notice">
                                Libera o gerenciamento de todo o acervo: visualizar, criar, enviar, editar,
                                excluir e compartilhar pastas e arquivos. Para liberar somente itens específicos,
                                use o compartilhamento da própria Biblioteca.
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
