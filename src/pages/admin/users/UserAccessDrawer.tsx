import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Circle, Mail, X } from 'lucide-react';
import { adminUserService, type AdminUserListItem } from '../../../services/adminUserService';
import type { Pessoa } from '../../../types/pessoa';
import { LiveSearchSelect } from '../../../components/ui/LiveSearchSelect';
import { userFacingError } from '../../../utils/userFacingError';
import { GroupPicker } from './GroupPicker';
import {
    getContextGroupIds,
    getContextTeam,
    getUserChecklist,
    type AccessContextId,
    type AdminGroup,
    type ChecklistState,
} from './usersAdminModel';

interface UserAccessDrawerProps {
    user: AdminUserListItem;
    contextId: AccessContextId;
    contextLabel: string;
    grupos: AdminGroup[];
    groupModules: Record<string, string[]>;
    onUserChange: (user: AdminUserListItem) => void;
    onClose: () => void;
}

const CHECKLIST_ICONS: Record<ChecklistState, typeof CheckCircle2> = {
    done: CheckCircle2,
    warning: AlertTriangle,
    pending: Circle,
};

export function UserAccessDrawer({ user, contextId, contextLabel, grupos, groupModules, onUserChange, onClose }: UserAccessDrawerProps) {
    const [updatingGroupId, setUpdatingGroupId] = useState<string | null>(null);
    const [sendingLink, setSendingLink] = useState(false);
    const [linkPessoa, setLinkPessoa] = useState<Pessoa | null>(null);
    const [linking, setLinking] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const checklist = getUserChecklist(user, contextId, contextLabel);
    const activeGroupIds = new Set(getContextGroupIds(user, contextId));
    const team = getContextTeam(user, contextId);
    const isPermanent = contextId === null;

    const handleToggleGroup = async (grupoId: string) => {
        setUpdatingGroupId(grupoId);
        try {
            const action = activeGroupIds.has(grupoId) ? 'remove' : 'add';
            const updatedGroups = await adminUserService.updateGrupos(user.id, user.grupos, action, grupoId, contextId);
            onUserChange({ ...user, grupos: updatedGroups });
            toast.success(action === 'add' ? 'Perfil concedido.' : 'Perfil retirado.');
        } catch (error: unknown) {
            toast.error(userFacingError(error, 'Não foi possível atualizar o perfil. Tente novamente.'));
        } finally {
            setUpdatingGroupId(null);
        }
    };

    const handleSendLink = async () => {
        setSendingLink(true);
        try {
            const result = await adminUserService.sendPasswordRecovery(user.id);
            onUserChange({ ...user, ...result.user });
            toast.success('Link de acesso enviado por e-mail.');
        } catch (error: unknown) {
            toast.error(userFacingError(error, 'Não foi possível enviar o link. Tente novamente.'));
        } finally {
            setSendingLink(false);
        }
    };

    const handleLinkPerson = async () => {
        if (!linkPessoa) return;
        setLinking(true);
        try {
            await adminUserService.linkUserToPerson(user.id, linkPessoa.id);
            onUserChange({ ...user, pessoaId: linkPessoa.id, pessoaVinculo: 'explicit', nome: linkPessoa.nome_completo });
            setLinkPessoa(null);
            toast.success('Pessoa vinculada à conta.');
        } catch (error: unknown) {
            toast.error(userFacingError(error, 'Não foi possível vincular a pessoa. Tente novamente.'));
        } finally {
            setLinking(false);
        }
    };

    return (
        <div className="users-drawer-overlay" onClick={onClose}>
            <aside
                className="users-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="users-drawer-title"
                onClick={event => event.stopPropagation()}
            >
                <header className="users-drawer__header">
                    <div>
                        <span className="users-drawer__eyebrow">{isPermanent ? 'Acessos permanentes' : contextLabel}</span>
                        <h2 id="users-drawer-title">{user.nome || 'Conta sem pessoa vinculada'}</h2>
                        <p>{user.email}</p>
                        {team && <span className="users-admin-chip">{team}</span>}
                    </div>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
                        <X size={18} />
                    </button>
                </header>

                <section className="users-drawer__section" aria-labelledby="users-drawer-checklist">
                    <h3 id="users-drawer-checklist">O que falta</h3>
                    <ol className="users-checklist">
                        {checklist.map(item => {
                            const Icon = CHECKLIST_ICONS[item.state];
                            return (
                                <li key={item.id} className={`users-checklist__item users-checklist__item--${item.state}`}>
                                    <Icon size={18} aria-hidden="true" />
                                    <div>
                                        <strong>{item.label}</strong>
                                        <small>{item.detail}</small>
                                        {item.id === 'senha' && (
                                            <button type="button" className="btn-text users-checklist__action" disabled={sendingLink} onClick={handleSendLink}>
                                                <Mail size={13} />
                                                {sendingLink
                                                    ? 'Enviando...'
                                                    : item.state === 'done' ? 'Enviar link para redefinir senha' : 'Reenviar convite por e-mail'}
                                            </button>
                                        )}
                                        {item.id === 'pessoa' && item.state !== 'done' && (
                                            <div className="users-checklist__link">
                                                <LiveSearchSelect<Pessoa>
                                                    value={linkPessoa?.id || ''}
                                                    onChange={(_, pessoa) => setLinkPessoa(pessoa)}
                                                    fetchData={(search, page) => adminUserService.searchPeople(search, page, 20)}
                                                    getOptionLabel={pessoa => `${pessoa.nome_completo}${pessoa.email ? ` — ${pessoa.email}` : ''}`}
                                                    getOptionValue={pessoa => pessoa.id}
                                                    placeholder="Buscar a pessoa correta..."
                                                    initialOptions={linkPessoa ? [linkPessoa] : []}
                                                />
                                                <button type="button" className="btn-primary" disabled={!linkPessoa || linking} onClick={handleLinkPerson}>
                                                    {linking ? 'Vinculando...' : 'Confirmar vínculo'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </section>

                <section className="users-drawer__section" aria-labelledby="users-drawer-groups">
                    <h3 id="users-drawer-groups">{isPermanent ? 'Perfis permanentes' : `Perfis em ${contextLabel}`}</h3>
                    <p className="users-drawer__hint">
                        {isPermanent
                            ? 'Perfis permanentes valem em qualquer encontro. Use somente para administração e dirigência.'
                            : 'Os perfis valem apenas para este encontro. Quando outro encontro for ativado, eles deixam de valer.'}
                    </p>
                    <GroupPicker
                        grupos={grupos}
                        groupModules={groupModules}
                        selectedIds={[...activeGroupIds]}
                        disabled={updatingGroupId !== null}
                        onChange={ids => {
                            const toggled = ids.find(id => !activeGroupIds.has(id))
                                ?? [...activeGroupIds].find(id => !ids.includes(id));
                            if (toggled) void handleToggleGroup(toggled);
                        }}
                    />
                    {updatingGroupId && <p className="users-drawer__hint" role="status">Salvando...</p>}
                </section>
            </aside>
        </div>
    );
}
