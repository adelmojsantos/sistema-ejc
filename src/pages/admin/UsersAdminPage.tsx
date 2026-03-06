import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { RotateCcw, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { FormRow } from '../../components/ui/FormRow';
import { supabase } from '../../lib/supabase';
import { adminUserService } from '../../services/adminUserService';
import { pessoaService } from '../../services/pessoaService';
import type { Pessoa } from '../../types/pessoa';
import type { UserRole } from '../../types/auth';
import { USER_ROLES } from '../../types/auth';
import { Header } from '../../components/Header';

const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    secretaria: 'Secretaria',
    visitacao: 'Visitação',
    viewer: 'Visualização',
};

export function UsersAdminPage() {
    const [users, setUsers] = useState<Awaited<ReturnType<typeof adminUserService.listUsers>>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState<UserRole>('viewer');
    const [creating, setCreating] = useState(false);
    const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
    const [updatingRoleById, setUpdatingRoleById] = useState<Record<string, boolean>>({});
    const [resettingPasswordById, setResettingPasswordById] = useState<Record<string, boolean>>({});

    // Live search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Pessoa[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

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
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                loadUsers();
            } else {
                setError('Sessão não encontrada. Faça login novamente.');
                setLoading(false);
            }
        });
    }, [loadUsers]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setSelectedPessoa(null);
        setShowDropdown(true);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (value.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await pessoaService.buscarPorSemelhanca(value.trim());
                setSearchResults(results);
                setShowDropdown(true);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    };

    const handleSelectPessoa = (pessoa: Pessoa) => {
        setSelectedPessoa(pessoa);
        setSearchQuery(pessoa.nome_completo);
        setShowDropdown(false);
        setSearchResults([]);
    };

    const handleClearSelection = () => {
        setSelectedPessoa(null);
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
    };

    const handleCreateUser = async (event: SyntheticEvent) => {
        event.preventDefault();

        const email = selectedPessoa?.email;
        if (!selectedPessoa || !email) {
            toast.error('Selecione uma pessoa com e-mail cadastrado.');
            return;
        }

        setCreating(true);
        try {
            const result = await adminUserService.createUser({ email, role });
            setUsers((prev) => [...prev, result.user]);
            setTempPasswords((prev) => ({ ...prev, [result.user.id]: result.temporaryPassword }));
            toast.success('Usuário criado com senha temporária.');
            handleClearSelection();
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

    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
        [users]
    );

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <Header />
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
                <form onSubmit={handleCreateUser}>
                    <FormRow>
                        {/* Live search combobox */}
                        <div className="form-group col-6" ref={wrapperRef} style={{ position: 'relative' }}>
                            <label className="form-label" htmlFor="pessoa-search">
                                Pessoa <span className="form-label-required">*</span>
                            </label>
                            <div className="form-input-wrapper">
                                <div className="form-input-icon">
                                    <Search size={16} />
                                </div>
                                <input
                                    id="pessoa-search"
                                    className="form-input form-input--with-icon"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Buscar pelo nome..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        style={{
                                            position: 'absolute',
                                            right: '0.6rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--color-text-muted)',
                                            padding: '0.2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Selected person badge */}
                            {selectedPessoa && (
                                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                    {selectedPessoa.email
                                        ? <span>✉ {selectedPessoa.email}</span>
                                        : <span style={{ color: 'var(--color-danger, #e53e3e)' }}>⚠ Esta pessoa não tem e-mail cadastrado</span>
                                    }
                                </div>
                            )}

                            {/* Dropdown */}
                            {showDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 2px)',
                                    left: 0,
                                    right: 0,
                                    zIndex: 50,
                                    background: 'var(--surface-1)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '0.5rem',
                                    boxShadow: 'var(--shadow-lg)',
                                    overflow: 'hidden',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                }}>
                                    {searching && (
                                        <div style={{ padding: '0.75rem 1rem', color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                                            Buscando...
                                        </div>
                                    )}
                                    {!searching && searchResults.length === 0 && (
                                        <div style={{ padding: '0.75rem 1rem', color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                                            Nenhuma pessoa encontrada.
                                        </div>
                                    )}
                                    {!searching && searchResults.map((pessoa) => (
                                        <button
                                            key={pessoa.id}
                                            type="button"
                                            disabled={!pessoa.email}
                                            onClick={() => handleSelectPessoa(pessoa)}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '0.6rem 1rem',
                                                // Reset global button styles
                                                background: 'var(--surface-1)',
                                                color: 'var(--text-color)',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border-color)',
                                                borderRadius: 0,
                                                boxShadow: 'none',
                                                cursor: pessoa.email ? 'pointer' : 'not-allowed',
                                                opacity: pessoa.email ? 1 : 0.5,
                                                fontSize: '0.875rem',
                                                fontWeight: 'normal',
                                                minHeight: 'unset',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (pessoa.email) (e.currentTarget as HTMLButtonElement).style.background = 'var(--secondary-bg)';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-1)';
                                            }}
                                        >
                                            <div style={{ fontWeight: 500, color: 'var(--text-color)' }}>{pessoa.nome_completo}</div>
                                            <div style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>
                                                {pessoa.email ?? '— sem e-mail'}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Role select */}
                        <div className="form-group col-6">
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
                    </FormRow>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button className="btn-primary" type="submit" disabled={creating || !selectedPessoa?.email}>
                            <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                            {creating ? 'Criando...' : 'Criar usuário'}
                        </button>
                    </div>
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
