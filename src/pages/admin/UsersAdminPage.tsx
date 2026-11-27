import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Info, ShieldCheck, UserPlus, Users2, UsersRound, Wand2 } from 'lucide-react';
import { adminUserService, type AdminUserListItem } from '../../services/adminUserService';
import { adminAccessService } from '../../services/adminAccessService';
import { exportConfigService, type ExportConfig } from '../../services/exportConfigService';
import { useEncontros } from '../../contexts/EncontroContext';
import { getPermissionName } from '../../utils/permissionLabels';
import { TeamAccessReleasePanel } from '../../components/admin/TeamAccessReleasePanel';
import { UsersListTab } from './users/UsersListTab';
import { UserAccessDrawer } from './users/UserAccessDrawer';
import { IndividualAccessTab } from './users/IndividualAccessTab';
import { TeamCustomAccessTab } from './users/TeamCustomAccessTab';
import { getEncontroLabel, type AccessContextId, type AdminGroup } from './users/usersAdminModel';
import './users/UsersAdminPage.css';

type UsersTab = 'usuarios' | 'liberar' | 'equipe' | 'individual';

const PERMANENT_OPTION = 'permanente';

const TABS: { id: UsersTab; label: string; icon: typeof Users2; requiresEncounter: boolean }[] = [
    { id: 'usuarios', label: 'Usuários', icon: Users2, requiresEncounter: false },
    { id: 'liberar', label: 'Liberar acessos das equipes', icon: Wand2, requiresEncounter: true },
    { id: 'equipe', label: 'Por equipe (perfis personalizados)', icon: UsersRound, requiresEncounter: true },
    { id: 'individual', label: 'Acesso individual', icon: UserPlus, requiresEncounter: false },
];

function isUsersTab(value: string | null): value is UsersTab {
    return TABS.some(tab => tab.id === value);
}

export function UsersAdminPage() {
    const { encontros, encontroSelecionadoId } = useEncontros();
    const [searchParams, setSearchParams] = useSearchParams();
    const [overriddenContext, setOverriddenContext] = useState<{ value: AccessContextId } | null>(null);
    const [grupos, setGrupos] = useState<AdminGroup[]>([]);
    const [groupModules, setGroupModules] = useState<Record<string, string[]>>({});
    const [exportConfigs, setExportConfigs] = useState<ExportConfig[]>([]);
    const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
    const [drawerChanged, setDrawerChanged] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    // Segue o encontro escolhido no sistema até o administrador escolher outro nesta tela.
    const contextId: AccessContextId = overriddenContext ? overriddenContext.value : (encontroSelecionadoId || null);
    const contextEncontro = contextId ? encontros.find(encontro => encontro.id === contextId) : undefined;
    const isPermanent = contextId === null;
    const contextLabel = isPermanent ? 'Acessos permanentes' : getEncontroLabel(contextEncontro);

    const requestedTab = searchParams.get('aba');
    const activeTab: UsersTab = isUsersTab(requestedTab)
        && !(isPermanent && TABS.find(tab => tab.id === requestedTab)?.requiresEncounter)
        ? requestedTab
        : 'usuarios';

    useEffect(() => {
        let cancelled = false;
        const loadSupportData = async () => {
            try {
                const [loadedGroups, permissoes, grupoPermissoes, configs] = await Promise.all([
                    adminUserService.listGrupos(),
                    adminAccessService.listPermissoes(),
                    adminAccessService.listGrupoPermissoes(),
                    exportConfigService.listarTodas(),
                ]);
                const permissionsById = new Map(permissoes.map(permissao => [permissao.id, permissao]));
                const modules: Record<string, string[]> = {};
                for (const grupo of loadedGroups) {
                    const granted = grupoPermissoes
                        .filter(item => item.grupo_id === grupo.id)
                        .map(item => permissionsById.get(item.permissao_id))
                        .filter((permissao): permissao is NonNullable<typeof permissao> => !!permissao);
                    const topLevel = granted.filter(permissao => permissao.chave.startsWith('modulo_'));
                    modules[grupo.id] = (topLevel.length > 0 ? topLevel : granted)
                        .map(getPermissionName)
                        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
                }
                if (cancelled) return;
                setGrupos(loadedGroups);
                setGroupModules(modules);
                setExportConfigs(configs);
            } catch (error) {
                console.warn('Não foi possível carregar perfis e configurações da tela de usuários.', error);
            }
        };
        void loadSupportData();
        return () => {
            cancelled = true;
        };
    }, []);

    const sortedEncontros = useMemo(
        () => [...encontros].sort((a, b) => Number(b.ativo) - Number(a.ativo) || (b.edicao ?? 0) - (a.edicao ?? 0)),
        [encontros],
    );

    const changeTab = (tab: UsersTab) => {
        setSearchParams(current => {
            const next = new URLSearchParams(current);
            if (tab === 'usuarios') next.delete('aba');
            else next.set('aba', tab);
            return next;
        }, { replace: true });
    };

    const openUser = useCallback((user: AdminUserListItem) => {
        setSelectedUser(user);
        setDrawerChanged(false);
    }, []);

    const closeDrawer = useCallback(() => {
        setSelectedUser(null);
        if (drawerChanged) setReloadToken(token => token + 1);
        setDrawerChanged(false);
    }, [drawerChanged]);

    const bumpReload = useCallback(() => setReloadToken(token => token + 1), []);

    return (
        <div className="container users-admin-page">
            <header className="users-admin-header">
                <div className="users-admin-header__title">
                    <h1 className="page-title">
                        <ShieldCheck size={22} aria-hidden="true" />
                        Usuários e acessos
                    </h1>
                    <p className="text-muted">
                        A conta é da pessoa e vale no sistema todo. Os perfis (o que ela pode acessar) são concedidos por encontro.
                    </p>
                </div>
                <div className="users-admin-context">
                    <label className="form-label" htmlFor="users-admin-context">Encontro</label>
                    <select
                        id="users-admin-context"
                        className="form-input"
                        value={contextId ?? PERMANENT_OPTION}
                        onChange={event => setOverriddenContext({
                            value: event.target.value === PERMANENT_OPTION ? null : event.target.value,
                        })}
                    >
                        {sortedEncontros.map(encontro => (
                            <option key={encontro.id} value={encontro.id}>
                                {getEncontroLabel(encontro)}{encontro.ativo ? ' (ativo)' : ''}
                            </option>
                        ))}
                        <option value={PERMANENT_OPTION}>Acessos permanentes (administração e dirigência)</option>
                    </select>
                </div>
            </header>

            {isPermanent ? (
                <div className="users-admin-banner users-admin-banner--info">
                    <Info size={18} aria-hidden="true" />
                    <p>
                        <strong>Acessos permanentes</strong> valem em qualquer encontro e não expiram. Use somente para
                        administração e dirigência. Os demais acessos devem ser concedidos no encontro.
                    </p>
                </div>
            ) : contextEncontro && !contextEncontro.ativo ? (
                <div className="users-admin-banner users-admin-banner--warning">
                    <AlertTriangle size={18} aria-hidden="true" />
                    <p>
                        <strong>{contextLabel}</strong> não é o encontro ativo. Os perfis concedidos aqui só passam a valer
                        quando ele for ativado. Isso serve para preparar o próximo encontro.
                    </p>
                </div>
            ) : null}

            <div className="tabs-modern-container users-admin-tabs" role="tablist" aria-label="Seções de usuários e acessos">
                {TABS.filter(tab => !(isPermanent && tab.requiresEncounter)).map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`tab-btn-modern${activeTab === tab.id ? ' active' : ''}`}
                            onClick={() => changeTab(tab.id)}
                        >
                            <Icon size={16} aria-hidden="true" /> {tab.label}
                        </button>
                    );
                })}
            </div>

            <section className="card users-admin-panel" role="tabpanel">
                {activeTab === 'usuarios' && (
                    <UsersListTab
                        contextId={contextId}
                        contextLabel={contextLabel}
                        grupos={grupos}
                        exportConfigs={exportConfigs}
                        reloadToken={reloadToken}
                        onOpenUser={openUser}
                        onUserRemoved={() => setSelectedUser(null)}
                    />
                )}
                {activeTab === 'liberar' && contextId && (
                    <TeamAccessReleasePanel key={contextId} encontroId={contextId} encontroLabel={contextLabel} />
                )}
                {activeTab === 'equipe' && contextId && (
                    <TeamCustomAccessTab
                        key={contextId}
                        contextId={contextId}
                        contextLabel={contextLabel}
                        grupos={grupos}
                        groupModules={groupModules}
                        onChanged={bumpReload}
                    />
                )}
                {activeTab === 'individual' && (
                    <IndividualAccessTab
                        key={contextId ?? PERMANENT_OPTION}
                        contextId={contextId}
                        contextLabel={contextLabel}
                        grupos={grupos}
                        groupModules={groupModules}
                        onOpenUser={openUser}
                        onCreated={bumpReload}
                    />
                )}
            </section>

            {selectedUser && (
                <UserAccessDrawer
                    key={`${selectedUser.id}-${contextId ?? PERMANENT_OPTION}`}
                    user={selectedUser}
                    contextId={contextId}
                    contextLabel={contextLabel}
                    grupos={grupos}
                    groupModules={groupModules}
                    onUserChange={user => {
                        setSelectedUser(user);
                        setDrawerChanged(true);
                    }}
                    onClose={closeDrawer}
                />
            )}
        </div>
    );
}
