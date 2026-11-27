import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Download, FileText, Mail, RotateCcw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import {
    adminUserService,
    type AdminUserListItem,
    type AdminUsersSummary,
} from '../../../services/adminUserService';
import type { ExportConfig } from '../../../services/exportConfigService';
import { useDebounce } from '../../../hooks/useDebounce';
import { userFacingError } from '../../../utils/userFacingError';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import {
    getContextGroupIds,
    getContextTeam,
    getUserListViews,
    getUserSituation,
    USER_SITUATION_LABELS,
    viewToQuery,
    type AccessContextId,
    type AdminGroup,
    type UserListView,
} from './usersAdminModel';
import { exportUsersCsv, exportUsersPdf } from './usersExport';

const EMPTY_SUMMARY: AdminUsersSummary = {
    totalUsers: 0,
    totalTemporaryPassword: 0,
    totalWithoutPerson: 0,
    totalWithTargetAccess: 0,
    filteredTotal: 0,
};

interface UsersListTabProps {
    contextId: AccessContextId;
    contextLabel: string;
    grupos: AdminGroup[];
    exportConfigs: ExportConfig[];
    reloadToken: number;
    onOpenUser: (user: AdminUserListItem) => void;
    onUserRemoved: () => void;
}

export function UsersListTab({ contextId, contextLabel, grupos, exportConfigs, reloadToken, onOpenUser, onUserRemoved }: UsersListTabProps) {
    const [users, setUsers] = useState<AdminUserListItem[]>([]);
    const [summary, setSummary] = useState<AdminUsersSummary>(EMPTY_SUMMARY);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [view, setView] = useState<UserListView>('com_acesso');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 400);
    const [grupoId, setGrupoId] = useState('all');
    const [onlyParticipants, setOnlyParticipants] = useState(false);
    const [pageSize, setPageSize] = useState(20);
    const [page, setPage] = useState(0);
    const [showMoreFilters, setShowMoreFilters] = useState(false);

    const [resettingById, setResettingById] = useState<Record<string, boolean>>({});
    const [userToDelete, setUserToDelete] = useState<AdminUserListItem | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirmSecurePending, setConfirmSecurePending] = useState(false);
    const [securingPending, setSecuringPending] = useState(false);
    const [exporting, setExporting] = useState(false);
    const requestRef = useRef(0);

    const isPermanent = contextId === null;
    const effectiveGrupoId = view === 'sem_acesso' ? 'all' : grupoId;
    const participationFilter = onlyParticipants && contextId ? contextId : 'all';

    const query = useMemo(() => ({
        ...viewToQuery(view),
        search: debouncedSearch,
        grupoId: effectiveGrupoId,
        encontroId: participationFilter,
        targetEncontroId: contextId,
    }), [view, debouncedSearch, effectiveGrupoId, participationFilter, contextId]);

    const loadUsers = useCallback(async () => {
        const requestId = ++requestRef.current;
        setLoading(true);
        setError(null);
        try {
            const response = await adminUserService.listUsers({ ...query, page, pageSize });
            if (requestId !== requestRef.current) return;
            setUsers(response.users);
            setTotal(response.total);
            setSummary(response.summary);
        } catch (loadError: unknown) {
            if (requestId !== requestRef.current) return;
            setError(userFacingError(loadError, 'Não foi possível carregar os usuários. Tente novamente.'));
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [query, page, pageSize]);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers, reloadToken]);

    // Ao trocar de encontro, volta para a primeira página.
    const [lastContextId, setLastContextId] = useState(contextId);
    if (lastContextId !== contextId) {
        setLastContextId(contextId);
        setPage(0);
        if (!contextId) setOnlyParticipants(false);
    }

    const changeFilter = (apply: () => void) => {
        apply();
        setPage(0);
    };

    const views = getUserListViews(summary, isPermanent);
    const groupNames = useMemo(() => new Map(grupos.map(grupo => [grupo.id, grupo.nome])), [grupos]);
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const pageStart = total === 0 ? 0 : page * pageSize + 1;
    const pageEnd = Math.min((page + 1) * pageSize, total);
    const extraFilterCount = [searchTerm.trim() !== '', effectiveGrupoId !== 'all', onlyParticipants].filter(Boolean).length;

    const clearExtraFilters = () => changeFilter(() => {
        setSearchTerm('');
        setGrupoId('all');
        setOnlyParticipants(false);
    });

    const handleSendRecovery = async (user: AdminUserListItem) => {
        setResettingById(current => ({ ...current, [user.id]: true }));
        try {
            const result = await adminUserService.sendPasswordRecovery(user.id);
            setUsers(current => current.map(item => (item.id === user.id ? { ...item, ...result.user } : item)));
            toast.success('Link de acesso enviado por e-mail.');
        } catch (resetError: unknown) {
            toast.error(userFacingError(resetError, 'Não foi possível enviar o link. Tente novamente.'));
        } finally {
            setResettingById(current => ({ ...current, [user.id]: false }));
        }
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        try {
            await adminUserService.deleteUser(userToDelete.id);
            toast.success('Conta removida.');
            setUserToDelete(null);
            onUserRemoved();
            await loadUsers();
        } catch (deleteError: unknown) {
            toast.error(userFacingError(deleteError, 'Não foi possível remover a conta. Tente novamente.'));
        } finally {
            setDeleting(false);
        }
    };

    const handleSecurePending = async () => {
        setSecuringPending(true);
        try {
            const result = await adminUserService.securePendingPasswords();
            const message = `${result.invalidated} senha(s) temporária(s) invalidada(s) e ${result.recoveryEmailsSent} link(s) enviado(s).`;
            if (result.failed > 0) toast.error(`${message} ${result.failed} falha(s).`);
            else toast.success(message);
            await loadUsers();
        } catch (secureError: unknown) {
            toast.error(userFacingError(secureError, 'Não foi possível proteger os primeiros acessos pendentes.'));
        } finally {
            setSecuringPending(false);
            setConfirmSecurePending(false);
        }
    };

    const handleExport = async (format: 'csv' | 'pdf') => {
        if (total === 0) {
            toast.error('Nenhum usuário para exportar.');
            return;
        }
        setExporting(true);
        try {
            const allUsers = await adminUserService.listAllUsers(query);
            const input = { users: allUsers, grupos, contextId, contextLabel };
            if (format === 'csv') {
                exportUsersCsv(input);
            } else {
                const config = contextId ? exportConfigs.find(current => current.encontro_id === contextId) : undefined;
                exportUsersPdf(input, config);
            }
            toast.success(`${allUsers.length} usuário(s) exportado(s).`);
        } catch (exportError: unknown) {
            toast.error(userFacingError(exportError, 'Não foi possível exportar os usuários.'));
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="users-list">
            <div className="users-views" role="tablist" aria-label="Situação dos usuários">
                {views.map(option => (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={view === option.id}
                        className={`users-view${view === option.id ? ' users-view--active' : ''}`}
                        title={option.hint}
                        onClick={() => changeFilter(() => setView(option.id))}
                    >
                        <span className="users-view__label">{option.label}</span>
                        {option.count !== null && <span className="users-view__count">{option.count}</span>}
                    </button>
                ))}
            </div>

            {view === 'primeiro_acesso' && summary.totalTemporaryPassword > 0 && (
                <div className="users-admin-callout">
                    <div>
                        <strong>Senhas temporárias antigas</strong>
                        <p>
                            {summary.totalTemporaryPassword} conta(s) no sistema inteiro ainda não definiram a senha.
                            Você pode invalidar as senhas temporárias e enviar um link novo para cada uma.
                        </p>
                    </div>
                    <button type="button" className="btn-secondary" disabled={securingPending} onClick={() => setConfirmSecurePending(true)}>
                        <Mail size={14} /> Proteger e enviar links
                    </button>
                </div>
            )}

            <div className="users-toolbar">
                <div className="form-input-wrapper users-toolbar__search">
                    <div className="form-input-icon"><Search size={16} /></div>
                    <input
                        type="search"
                        className="form-input form-input--with-icon"
                        placeholder={contextId ? 'Buscar por nome, e-mail ou equipe neste encontro' : 'Buscar por nome ou e-mail'}
                        aria-label="Buscar usuários"
                        value={searchTerm}
                        onChange={event => changeFilter(() => setSearchTerm(event.target.value))}
                    />
                    {searchTerm && (
                        <button type="button" className="icon-btn users-toolbar__clear-search" aria-label="Limpar busca" onClick={() => changeFilter(() => setSearchTerm(''))}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <select
                    className="form-input users-toolbar__group"
                    aria-label="Filtrar por perfil"
                    value={effectiveGrupoId}
                    disabled={view === 'sem_acesso'}
                    onChange={event => changeFilter(() => setGrupoId(event.target.value))}
                >
                    <option value="all">{isPermanent ? 'Todos os perfis permanentes' : 'Todos os perfis do encontro'}</option>
                    {grupos.map(grupo => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
                </select>
                <button
                    type="button"
                    className={`btn-secondary users-toolbar__more${showMoreFilters ? ' is-active' : ''}`}
                    aria-expanded={showMoreFilters}
                    onClick={() => setShowMoreFilters(current => !current)}
                >
                    <SlidersHorizontal size={15} /> Mais opções
                </button>
            </div>

            {showMoreFilters && (
                <div className="users-more-filters">
                    {contextId && (
                        <label className="users-checkbox">
                            <input
                                type="checkbox"
                                checked={onlyParticipants}
                                onChange={event => changeFilter(() => setOnlyParticipants(event.target.checked))}
                            />
                            Somente quem participa de {contextLabel}
                        </label>
                    )}
                    <label className="users-more-filters__page-size">
                        Por página
                        <select className="form-input" value={pageSize} onChange={event => changeFilter(() => setPageSize(Number(event.target.value)))}>
                            {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                    </label>
                    <div className="users-more-filters__export">
                        <button type="button" className="btn-secondary" disabled={exporting} onClick={() => handleExport('csv')}>
                            <Download size={14} /> Planilha CSV
                        </button>
                        <button type="button" className="btn-secondary" disabled={exporting} onClick={() => handleExport('pdf')}>
                            <FileText size={14} /> PDF
                        </button>
                    </div>
                </div>
            )}

            <div className="users-result-bar">
                <span>
                    {loading ? 'Carregando...' : total === 0 ? 'Nenhum usuário' : `${pageStart}–${pageEnd} de ${total}`}
                    {extraFilterCount > 0 && (
                        <button type="button" className="btn-text users-result-bar__clear" onClick={clearExtraFilters}>
                            Limpar busca e filtros ({extraFilterCount})
                        </button>
                    )}
                </span>
                <button type="button" className="icon-btn" onClick={loadUsers} disabled={loading} aria-label="Atualizar lista" title="Atualizar lista">
                    <RotateCcw size={15} />
                </button>
            </div>

            {error && <div className="alert alert--error">{error}</div>}

            {!error && !loading && users.length === 0 && (
                <div className="empty-state users-empty">
                    {view === 'com_acesso' && !debouncedSearch && effectiveGrupoId === 'all'
                        ? `Ninguém tem perfil em ${contextLabel} ainda. Use “Liberar acessos das equipes” ou “Acesso individual”.`
                        : 'Nenhum usuário corresponde a esta visão.'}
                </div>
            )}

            <ul className={`users-rows${loading ? ' users-rows--loading' : ''}`} aria-label="Usuários">
                {users.map(user => {
                    const situation = getUserSituation(user, contextId);
                    const contextGroups = getContextGroupIds(user, contextId);
                    const team = getContextTeam(user, contextId);
                    const resetting = !!resettingById[user.id];
                    return (
                        <li key={user.id} className="users-row">
                            <button type="button" className="users-row__main" onClick={() => onOpenUser(user)}>
                                <span className="users-row__avatar" aria-hidden="true">{(user.nome || user.email).charAt(0).toUpperCase()}</span>
                                <span className="users-row__identity">
                                    <strong>{user.nome || 'Conta sem pessoa vinculada'}</strong>
                                    <small>{user.email}</small>
                                    {team && <small className="users-row__team">{team}</small>}
                                </span>
                                <span className="users-row__groups">
                                    {contextGroups.length === 0
                                        ? <span className="text-muted users-row__no-group">Sem perfil {isPermanent ? 'permanente' : 'neste encontro'}</span>
                                        : contextGroups.map(id => <span key={id} className="users-admin-chip users-admin-chip--primary">{groupNames.get(id) || 'Perfil'}</span>)}
                                </span>
                                <span className={`users-admin-status users-admin-status--${situation}`}>{USER_SITUATION_LABELS[situation]}</span>
                            </button>
                            <div className="users-row__actions">
                                <button type="button" className="btn-secondary users-row__manage" onClick={() => onOpenUser(user)}>
                                    Gerenciar acesso
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    disabled={resetting}
                                    onClick={() => handleSendRecovery(user)}
                                    aria-label={`Enviar link de acesso para ${user.email}`}
                                    title={user.temporary_password ? 'Reenviar convite (link para definir senha)' : 'Enviar link para redefinir senha'}
                                >
                                    <Mail size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn users-row__delete"
                                    onClick={() => setUserToDelete(user)}
                                    aria-label={`Remover conta de ${user.email}`}
                                    title="Remover conta"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {total > pageSize && (
                <nav className="users-pagination" aria-label="Paginação">
                    <button type="button" className="btn-secondary" disabled={page === 0 || loading} onClick={() => setPage(current => Math.max(current - 1, 0))}>
                        <ChevronLeft size={16} /> Anterior
                    </button>
                    <span>Página {page + 1} de {totalPages}</span>
                    <button type="button" className="btn-secondary" disabled={page >= totalPages - 1 || loading} onClick={() => setPage(current => Math.min(current + 1, totalPages - 1))}>
                        Próxima <ChevronRight size={16} />
                    </button>
                </nav>
            )}

            <ConfirmDialog
                isOpen={!!userToDelete}
                title="Remover conta"
                message={(
                    <>
                        <p>Remover a conta de <strong>{userToDelete?.nome || userToDelete?.email}</strong>?</p>
                        <p>A pessoa perde o login e todos os perfis, em todos os encontros. O cadastro e as participações continuam no histórico.</p>
                        <p>Para tirar o acesso só deste encontro, use “Gerenciar acesso” e desmarque os perfis.</p>
                    </>
                )}
                onConfirm={handleDelete}
                onCancel={() => setUserToDelete(null)}
                confirmText="Remover conta"
                loadingText="Removendo..."
                isLoading={deleting}
                isDestructive
                cancelText="Cancelar"
            />
            <ConfirmDialog
                isOpen={confirmSecurePending}
                title="Proteger primeiros acessos"
                message={(
                    <>
                        <p>As senhas temporárias antigas serão invalidadas e cada conta receberá um link para definir a própria senha.</p>
                        <p>Isso vale para todas as {summary.totalTemporaryPassword} conta(s) pendentes do sistema, não só deste encontro.</p>
                    </>
                )}
                onConfirm={handleSecurePending}
                onCancel={() => setConfirmSecurePending(false)}
                confirmText={`Proteger ${summary.totalTemporaryPassword} conta(s)`}
                loadingText="Protegendo..."
                isLoading={securingPending}
                cancelText="Cancelar"
            />
        </div>
    );
}
