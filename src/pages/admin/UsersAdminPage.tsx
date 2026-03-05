import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';
import { adminUserService } from '../../services/adminUserService';
import type { UserRole } from '../../types/auth';
import { USER_ROLES } from '../../types/auth';

const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    secretaria: 'Secretaria',
    visitacao: 'Visitação',
    viewer: 'Visualização'
};

export function UsersAdminPage() {
    const [users, setUsers] = useState<Awaited<ReturnType<typeof adminUserService.listUsers>>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('viewer');
    const [creating, setCreating] = useState(false);
    const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
    const [updatingRoleById, setUpdatingRoleById] = useState<Record<string, boolean>>({});
    const [resettingPasswordById, setResettingPasswordById] = useState<Record<string, boolean>>({});

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminUserService.listUsers();
            setUsers(data);
        } catch {
            setError('Erro ao carregar usuários.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
        [users]
    );

    const handleCreateUser = async (event: FormEvent) => {
        event.preventDefault();
        setCreating(true);

        try {
            const result = await adminUserService.createUser({ email, role });
            setUsers((prev) => [...prev, result.user]);
            setTempPasswords((prev) => ({ ...prev, [result.user.id]: result.temporaryPassword }));
            toast.success('Usuário criado com senha temporária.');
            setEmail('');
            setRole('viewer');
        } catch (createError: unknown) {
            const message = createError instanceof Error ? createError.message : 'Erro ao criar usuário.';
            toast.error(message);
        } finally {
            setCreating(false);
        }
    };

    const handleChangeRole = async (userId: string, newRole: UserRole) => {
        setUpdatingRoleById((prev) => ({ ...prev, [userId]: true }));
        try {
            await adminUserService.updateRole(userId, newRole);
            setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user)));
            toast.success('Role atualizada.');
        } catch (updateError: unknown) {
            const message = updateError instanceof Error ? updateError.message : 'Erro ao atualizar role.';
            toast.error(message);
        } finally {
            setUpdatingRoleById((prev) => ({ ...prev, [userId]: false }));
        }
    };

    const handleResetTemporaryPassword = async (userId: string) => {
        setResettingPasswordById((prev) => ({ ...prev, [userId]: true }));
        try {
            const result = await adminUserService.resetTemporaryPassword(userId);
            setTempPasswords((prev) => ({ ...prev, [userId]: result.temporaryPassword }));
            setUsers((prev) => prev.map((user) => (user.id === userId ? result.user : user)));
            toast.success('Senha temporária redefinida.');
        } catch (resetError: unknown) {
            const message = resetError instanceof Error ? resetError.message : 'Erro ao redefinir senha.';
            toast.error(message);
        } finally {
            setResettingPasswordById((prev) => ({ ...prev, [userId]: false }));
        }
    };

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
                        <ShieldCheck size={22} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                        Gestão de usuários
                    </h1>
                    <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                        Criação por administrador com senha temporária e roles.
                    </p>
                </div>
            </div>

            <section className="card" style={{ marginBottom: '1rem' }}>
                <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Novo usuário</h2>
                <form onSubmit={handleCreateUser} className="admin-users-create-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="new-user-email">E-mail</label>
                        <input
                            id="new-user-email"
                            className="form-input"
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="usuario@email.com"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="new-user-role">Role</label>
                        <select
                            id="new-user-role"
                            className="form-input"
                            value={role}
                            onChange={(event) => setRole(event.target.value as UserRole)}
                        >
                            {USER_ROLES.map((roleOption) => (
                                <option key={roleOption} value={roleOption}>
                                    {roleLabels[roleOption]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button className="btn-primary" type="submit" disabled={creating}>
                        <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                        {creating ? 'Criando...' : 'Criar usuário'}
                    </button>
                </form>
            </section>

            <section className="card">
                <div className="admin-users-table-header">
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Usuários cadastrados</h2>
                    <button className="btn-secondary" type="button" onClick={loadUsers} disabled={loading}>
                        Atualizar
                    </button>
                </div>

                {loading && <p className="text-muted">Carregando usuários...</p>}
                {!loading && error && <div className="alert alert--error">{error}</div>}

                {!loading && !error && (
                    <div className="admin-users-table-wrapper">
                        <table className="admin-users-table">
                            <thead>
                                <tr>
                                    <th>E-mail</th>
                                    <th>Role</th>
                                    <th>Senha temporária</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedUsers.map((user) => {
                                    const tempPassword = tempPasswords[user.id];
                                    const roleUpdating = !!updatingRoleById[user.id];
                                    const passwordResetting = !!resettingPasswordById[user.id];

                                    return (
                                        <tr key={user.id}>
                                            <td>
                                                <div>{user.email}</div>
                                                {tempPassword && (
                                                    <code className="admin-temp-password">Senha temporária: {tempPassword}</code>
                                                )}
                                            </td>
                                            <td>
                                                <select
                                                    className="form-input"
                                                    value={user.role}
                                                    disabled={roleUpdating}
                                                    onChange={(event) => handleChangeRole(user.id, event.target.value as UserRole)}
                                                >
                                                    {USER_ROLES.map((roleOption) => (
                                                        <option key={roleOption} value={roleOption}>
                                                            {roleLabels[roleOption]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>{user.temporary_password ? 'Sim' : 'Não'}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    disabled={passwordResetting}
                                                    onClick={() => handleResetTemporaryPassword(user.id)}
                                                >
                                                    <RotateCcw size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                                                    {passwordResetting ? 'Redefinindo...' : 'Redefinir senha'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
