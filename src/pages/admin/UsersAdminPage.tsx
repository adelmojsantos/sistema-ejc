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
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
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

    // Bulk creation state
    const [creationMode, setCreationMode] = useState<'individual' | 'lote'>('individual');
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
    const [selectedEquipeId, setSelectedEquipeId] = useState<string>('');
    const [teamMembers, setTeamMembers] = useState<InscricaoEnriched[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [bulkRole, setBulkRole] = useState<UserRole>('viewer');
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [bulkResults, setBulkResults] = useState<{ id: string; success: boolean; message?: string }[]>([]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminUserService.listUsers();
            setUsers(data);

            const encontrosData = await encontroService.listar();
            setEncontros(encontrosData);

            const active = encontrosData.find(e => e.ativo);
            if (active) setSelectedEncontroId(active.id);
            else if (encontrosData.length > 0) setSelectedEncontroId(encontrosData[0].id);

        } catch {
            setError('Erro ao carregar usuários ou filtros.');
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

    const handleLoadTeamMembers = async () => {
        if (!selectedEncontroId || !selectedEquipeId) return;
        setLoadingMembers(true);
        setSelectedMemberIds([]);
        setBulkResults([]);
        try {
            const inscricoes = await inscricaoService.listarPorEncontro(selectedEncontroId);
            const teamFilteres = inscricoes.filter(i => i.equipe_id === selectedEquipeId);
            setTeamMembers(teamFilteres);
        } catch {
            toast.error('Erro ao carregar membros da equipe.');
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleToggleBulkMember = (pessoaId: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(pessoaId) ? prev.filter(id => id !== pessoaId) : [...prev, pessoaId]
        );
    };

    const handleToggleAllBulkMembers = () => {
        const availableMembers = teamMembers.filter(m => m.pessoas?.email && !users.some(u => u.email === m.pessoas?.email));
        if (selectedMemberIds.length === availableMembers.length) {
            setSelectedMemberIds([]);
        } else {
            setSelectedMemberIds(availableMembers.map(m => m.pessoa_id));
        }
    };

    const handleBulkCreate = async () => {
        if (selectedMemberIds.length === 0) return;
        setCreating(true);
        const results = [];

        for (const pessoaId of selectedMemberIds) {
            const member = teamMembers.find(m => m.pessoa_id === pessoaId);
            if (!member || !member.pessoas?.email) continue;

            try {
                const result = await adminUserService.createUser({ email: member.pessoas.email, role: bulkRole });
                setUsers(prev => [...prev, result.user]);
                setTempPasswords(prev => ({ ...prev, [result.user.id]: result.temporaryPassword }));
                results.push({ id: pessoaId, success: true });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Erro ao criar';
                results.push({ id: pessoaId, success: false, message });
            }
        }

        setBulkResults(results);
        setCreating(false);
        const successes = results.filter(r => r.success).length;
        if (successes > 0) toast.success(`${successes} usuário(s) criado(s) com sucesso.`);
        if (results.length > successes) toast.error(`${results.length - successes} erro(s) encontrados.`);
        setSelectedMemberIds([]);
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Novo usuário</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--secondary-bg)', padding: '0.25rem', borderRadius: '12px' }}>
                        <button
                            type="button"
                            className={`btn-text ${creationMode === 'individual' ? 'active' : ''}`}
                            onClick={() => setCreationMode('individual')}
                            style={{
                                backgroundColor: creationMode === 'individual' ? 'var(--surface-1)' : 'transparent',
                                color: creationMode === 'individual' ? 'var(--primary-color)' : 'var(--muted-text)',
                                boxShadow: creationMode === 'individual' ? 'var(--shadow-sm)' : 'none',
                                borderRadius: '8px',
                                padding: '0.5rem 1rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            Individual
                        </button>
                        <button
                            type="button"
                            className={`btn-text ${creationMode === 'lote' ? 'active' : ''}`}
                            onClick={() => setCreationMode('lote')}
                            style={{
                                backgroundColor: creationMode === 'lote' ? 'var(--surface-1)' : 'transparent',
                                color: creationMode === 'lote' ? 'var(--primary-color)' : 'var(--muted-text)',
                                boxShadow: creationMode === 'lote' ? 'var(--shadow-sm)' : 'none',
                                borderRadius: '8px',
                                padding: '0.5rem 1rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            Em Lote (Equipe)
                        </button>
                    </div>
                </div>

                {creationMode === 'individual' ? (
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
                ) : (
                    <div className="bulk-creation-form">
                        <FormRow>
                            <div className="form-group col-4">
                                <label className="form-label">Encontro</label>
                                <LiveSearchSelect<Encontro>
                                    value={selectedEncontroId}
                                    onChange={(val) => setSelectedEncontroId(val)}
                                    fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                                    getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
                                    getOptionValue={(e) => String(e.id)}
                                    placeholder="Selecione um Encontro..."
                                    initialOptions={encontros}
                                />
                            </div>
                            <div className="form-group col-4">
                                <label className="form-label">Equipe</label>
                                <LiveSearchSelect<Equipe>
                                    value={selectedEquipeId}
                                    onChange={(val) => setSelectedEquipeId(val)}
                                    fetchData={async (search, page) => await equipeService.buscarComPaginacao(search, page)}
                                    getOptionLabel={(e) => e.nome || ''}
                                    getOptionValue={(e) => String(e.id)}
                                    placeholder="Selecione uma Equipe..."
                                />
                            </div>
                            <div className="form-group col-4" style={{ display: 'flex', flexDirection: 'column' }}>
                                <label className="form-label" style={{ visibility: 'hidden' }}>Buscar</label>
                                <button className="btn-primary" style={{ width: '100%', flex: 1 }} onClick={handleLoadTeamMembers} disabled={!selectedEncontroId || !selectedEquipeId || loadingMembers}>
                                    <Search size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                    {loadingMembers ? 'Buscando...' : 'Buscar Membros'}
                                </button>
                            </div>
                        </FormRow>

                        {teamMembers.length > 0 && (
                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Membros da Equipe ({teamMembers.length})</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <label className="form-label" style={{ margin: 0 }}>Role (para todos):</label>
                                            <select className="form-input" style={{ width: 'auto', padding: '0.4rem 1.5rem 0.4rem 0.75rem' }} value={bulkRole} onChange={e => setBulkRole(e.target.value as UserRole)}>
                                                {USER_ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--secondary-bg)', borderRadius: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedMemberIds.length > 0 && selectedMemberIds.length === teamMembers.filter(m => (m.pessoas?.email ?? '') !== '' && !users.some(u => u.email === m.pessoas?.email)).length}
                                            onChange={handleToggleAllBulkMembers}
                                            style={{ width: '1.2rem', height: '1.2rem' }}
                                        />
                                        Selecionar todos elegíveis
                                    </label>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--muted-text)' }}>
                                        {selectedMemberIds.length} selecionados
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                    {teamMembers.map(member => {
                                        const pessoa = member.pessoas;
                                        const hasEmail = !!pessoa?.email;
                                        const existingUser = users.find(u => u.email === (pessoa?.email || ''));
                                        const isEligible = hasEmail && !existingUser;
                                        const isSelected = selectedMemberIds.includes(member.pessoa_id);
                                        const result = bulkResults.find(r => r.id === member.pessoa_id);

                                        return (
                                            <div key={member.id} className="bulk-member-card" style={{
                                                display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem',
                                                background: isSelected ? 'var(--primary-light)' : 'var(--card-bg)',
                                                border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                borderRadius: '8px',
                                                opacity: isEligible ? 1 : 0.6,
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={!isEligible || creating}
                                                    onChange={() => handleToggleBulkMember(member.pessoa_id)}
                                                    style={{ width: '1.2rem', height: '1.2rem', cursor: isEligible ? 'pointer' : 'not-allowed' }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pessoa?.nome_completo}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {pessoa?.email || 'Sem e-mail'}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', textAlign: 'right', minWidth: '100px' }}>
                                                    {!hasEmail && <span style={{ color: 'var(--danger-text)' }}>Falta e-mail</span>}
                                                    {existingUser && <span style={{ color: 'var(--success-text)' }}>Já cadastrado ({existingUser.role})</span>}
                                                    {result && (
                                                        <span style={{ color: result.success ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                                                            {result.success ? '✓ Criado' : `✗ ${result.message}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                    <button className="btn-primary" onClick={handleBulkCreate} disabled={creating || selectedMemberIds.length === 0}>
                                        <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                        {creating ? 'Processando...' : `Criar ${selectedMemberIds.length} usuário(s)`}
                                    </button>
                                </div>
                            </div>
                        )}
                        {!loadingMembers && selectedEquipeId && teamMembers.length === 0 && (
                            <div className="text-center text-muted" style={{ padding: '2rem' }}>
                                Nenhum membro encontrado ou busca não realizada.
                            </div>
                        )}
                    </div>
                )}
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
