import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'react-hot-toast';
import { Mail, UserPlus } from 'lucide-react';
import { adminUserService, type AdminUserListItem } from '../../../services/adminUserService';
import type { Pessoa } from '../../../types/pessoa';
import { LiveSearchSelect } from '../../../components/ui/LiveSearchSelect';
import { PersonEmailModal, type PersonEmailTarget } from '../../../components/admin/PersonEmailModal';
import { userFacingError } from '../../../utils/userFacingError';
import { GroupPicker } from './GroupPicker';
import type { AccessContextId, AdminGroup } from './usersAdminModel';

interface IndividualAccessTabProps {
    contextId: AccessContextId;
    contextLabel: string;
    grupos: AdminGroup[];
    groupModules: Record<string, string[]>;
    onOpenUser: (user: AdminUserListItem) => void;
    onCreated: () => void;
}

type AccountCheck =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'none' }
    | { state: 'exists'; user: AdminUserListItem }
    | { state: 'error' };

async function findExistingAccount(pessoa: Pessoa, contextId: AccessContextId): Promise<AdminUserListItem | null> {
    const email = pessoa.email?.trim().toLowerCase();
    const response = await adminUserService.listUsers({
        search: email || pessoa.nome_completo,
        accessScope: 'all',
        targetEncontroId: contextId,
        pageSize: 50,
    });
    return response.users.find(user => user.pessoaId === pessoa.id)
        || (email ? response.users.find(user => user.email.trim().toLowerCase() === email) : undefined)
        || null;
}

export function IndividualAccessTab({ contextId, contextLabel, grupos, groupModules, onOpenUser, onCreated }: IndividualAccessTabProps) {
    const [pessoa, setPessoa] = useState<Pessoa | null>(null);
    const [account, setAccount] = useState<AccountCheck>({ state: 'idle' });
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);
    const [emailTarget, setEmailTarget] = useState<PersonEmailTarget | null>(null);
    const checkRef = useRef(0);

    const checkAccount = async (selected: Pessoa) => {
        const requestId = ++checkRef.current;
        setAccount({ state: 'checking' });
        try {
            const existing = await findExistingAccount(selected, contextId);
            if (requestId !== checkRef.current) return;
            setAccount(existing ? { state: 'exists', user: existing } : { state: 'none' });
        } catch {
            if (requestId !== checkRef.current) return;
            setAccount({ state: 'error' });
        }
    };

    const handleSelectPessoa = (selected: Pessoa | null) => {
        setPessoa(selected);
        setSelectedGroupIds([]);
        if (selected) void checkAccount(selected);
        else setAccount({ state: 'idle' });
    };

    const reset = () => {
        checkRef.current += 1;
        setPessoa(null);
        setAccount({ state: 'idle' });
        setSelectedGroupIds([]);
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!pessoa?.email || account.state !== 'none' || selectedGroupIds.length === 0) return;

        setCreating(true);
        try {
            await adminUserService.createUser({
                email: pessoa.email,
                pessoaId: pessoa.id,
                gruposIds: selectedGroupIds,
                encontroId: contextId,
            });
            toast.success('Conta criada e convite enviado por e-mail.');
            reset();
            onCreated();
        } catch (error: unknown) {
            toast.error(userFacingError(error, 'Não foi possível criar a conta. Tente novamente.'));
        } finally {
            setCreating(false);
        }
    };

    const hasEmail = !!pessoa?.email;
    const canChooseGroups = !!pessoa && hasEmail && account.state === 'none';
    const canCreate = canChooseGroups && selectedGroupIds.length > 0 && !creating;

    return (
        <>
            <form className="users-individual" onSubmit={handleSubmit}>
                <div>
                    <h2 className="users-admin-section-title">Acesso individual</h2>
                    <p className="text-muted users-admin-section-text">
                        Cria a conta de uma pessoa e concede perfis em {contextLabel}. A pessoa recebe um convite por e-mail
                        para definir a senha. Se ela já tiver conta, ajuste os perfis em “Gerenciar acesso”.
                    </p>
                </div>

                <ol className="users-steps">
                    <li className={`users-step${pessoa ? ' users-step--done' : ' users-step--current'}`}>
                        <span className="users-step__number">1</span>
                        <div className="users-step__body">
                            <h3>Pessoa</h3>
                            <LiveSearchSelect<Pessoa>
                                value={pessoa?.id || ''}
                                onChange={(_, selected) => handleSelectPessoa(selected)}
                                fetchData={(search, page) => adminUserService.searchPeople(search, page, 20)}
                                getOptionLabel={option => option.nome_completo}
                                getOptionValue={option => option.id}
                                placeholder="Buscar pessoa por nome, e-mail ou telefone..."
                                pageSize={20}
                                initialOptions={pessoa ? [pessoa] : []}
                                renderOption={option => (
                                    <div>
                                        <div className="users-option__name">{option.nome_completo}</div>
                                        <div className="users-option__detail">{option.email || 'Sem e-mail cadastrado'}</div>
                                    </div>
                                )}
                            />
                            {pessoa && !hasEmail && (
                                <div className="users-admin-callout users-admin-callout--danger">
                                    <p>{pessoa.nome_completo} não tem e-mail cadastrado. O convite de acesso é enviado por e-mail.</p>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setEmailTarget({ pessoaId: pessoa.id, nome: pessoa.nome_completo })}
                                    >
                                        <Mail size={14} /> Cadastrar e-mail
                                    </button>
                                </div>
                            )}
                            {pessoa && hasEmail && account.state === 'checking' && <p className="text-muted users-step__note">Verificando se já existe conta...</p>}
                            {pessoa && account.state === 'error' && (
                                <div className="users-admin-callout users-admin-callout--danger">
                                    <p>Não foi possível verificar se a pessoa já tem conta.</p>
                                    <button type="button" className="btn-secondary" onClick={() => checkAccount(pessoa)}>Tentar novamente</button>
                                </div>
                            )}
                            {pessoa && account.state === 'exists' && (
                                <div className="users-admin-callout">
                                    <p><strong>{pessoa.nome_completo}</strong> já tem conta ({account.user.email}). Conceda ou retire perfis pela conta existente.</p>
                                    <button type="button" className="btn-primary" onClick={() => onOpenUser(account.user)}>Gerenciar acesso</button>
                                </div>
                            )}
                            {pessoa && hasEmail && account.state === 'none' && (
                                <p className="users-step__note users-step__note--ok">Sem conta ainda. O convite irá para {pessoa.email}.</p>
                            )}
                        </div>
                    </li>

                    <li className={`users-step${canChooseGroups ? (selectedGroupIds.length > 0 ? ' users-step--done' : ' users-step--current') : ' users-step--pending'}`}>
                        <span className="users-step__number">2</span>
                        <div className="users-step__body">
                            <h3>{contextId ? `Perfis em ${contextLabel}` : 'Perfis permanentes'}</h3>
                            {canChooseGroups ? (
                                <GroupPicker
                                    grupos={grupos}
                                    groupModules={groupModules}
                                    selectedIds={selectedGroupIds}
                                    onChange={setSelectedGroupIds}
                                    disabled={creating}
                                />
                            ) : (
                                <p className="text-muted users-step__note">Escolha uma pessoa com e-mail e sem conta.</p>
                            )}
                        </div>
                    </li>

                    <li className={`users-step${canCreate ? ' users-step--current' : ' users-step--pending'}`}>
                        <span className="users-step__number">3</span>
                        <div className="users-step__body">
                            <h3>Criar conta e enviar convite</h3>
                            <div className="users-step__actions">
                                {pessoa && <button type="button" className="btn-text" onClick={reset} disabled={creating}>Limpar</button>}
                                <button type="submit" className="btn-primary" disabled={!canCreate}>
                                    <UserPlus size={16} /> {creating ? 'Criando...' : 'Criar conta e enviar convite'}
                                </button>
                            </div>
                        </div>
                    </li>
                </ol>
            </form>

            <PersonEmailModal
                target={emailTarget}
                onClose={() => setEmailTarget(null)}
                onSaved={email => {
                    if (!pessoa) return;
                    const updated = { ...pessoa, email };
                    setPessoa(updated);
                    void checkAccount(updated);
                }}
            />
        </>
    );
}
