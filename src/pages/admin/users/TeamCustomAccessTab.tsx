import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Mail, UserPlus } from 'lucide-react';
import { adminUserService, type AdminUserListItem } from '../../../services/adminUserService';
import { equipeService } from '../../../services/equipeService';
import { inscricaoService } from '../../../services/inscricaoService';
import type { Equipe } from '../../../types/equipe';
import { LiveSearchSelect } from '../../../components/ui/LiveSearchSelect';
import { PersonEmailModal, type PersonEmailTarget } from '../../../components/admin/PersonEmailModal';
import { userFacingError } from '../../../utils/userFacingError';
import { GroupPicker } from './GroupPicker';
import { getContextGroupIds, getTeamMemberAccessState, type AdminGroup, type TeamMemberAccessState } from './usersAdminModel';

interface TeamMember {
    id: string;
    pessoa_id: string;
    coordenador: boolean | null;
    dados_confirmados: boolean | null;
    pessoas: { id: string; nome_completo: string; email: string | null } | null;
}

interface MemberResult {
    success: boolean;
    message: string;
}

interface TeamCustomAccessTabProps {
    contextId: string;
    contextLabel: string;
    grupos: AdminGroup[];
    groupModules: Record<string, string[]>;
    onChanged: () => void;
}

const STATE_LABELS: Record<TeamMemberAccessState['kind'], string> = {
    sem_email: 'Sem e-mail',
    criar_conta: 'Sem conta: receberá convite',
    conceder: 'Tem conta',
    completo: 'Já possui os perfis',
};

export function TeamCustomAccessTab({ contextId, contextLabel, grupos, groupModules, onChanged }: TeamCustomAccessTabProps) {
    const [equipe, setEquipe] = useState<Equipe | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [accounts, setAccounts] = useState<AdminUserListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [groupIds, setGroupIds] = useState<string[]>([]);
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<Record<string, MemberResult>>({});
    const [emailTarget, setEmailTarget] = useState<PersonEmailTarget | null>(null);
    const requestRef = useRef(0);

    const loadTeam = useCallback(async (equipeId: string) => {
        const requestId = ++requestRef.current;
        setLoading(true);
        try {
            const [teamMembers, teamAccounts] = await Promise.all([
                adminUserService.listTeamMembers(contextId, equipeId),
                // Contas ligadas a quem participa deste encontro: base para saber quem já tem acesso.
                adminUserService.listAllUsers({ encontroId: contextId, accessScope: 'all', targetEncontroId: contextId }),
            ]);
            if (requestId !== requestRef.current) return;
            setMembers(teamMembers as unknown as TeamMember[]);
            setAccounts(teamAccounts);
        } catch (error: unknown) {
            if (requestId !== requestRef.current) return;
            toast.error(userFacingError(error, 'Não foi possível carregar os integrantes da equipe.'));
        } finally {
            if (requestId === requestRef.current) setLoading(false);
        }
    }, [contextId]);

    const handleEquipeChange = (equipeId: string, selected?: Equipe | null) => {
        setEquipe(equipeId ? selected ?? null : null);
        setSelectedIds([]);
        setResults({});
        setMembers([]);
        if (equipeId) void loadTeam(equipeId);
    };

    const memberStates = useMemo(() => new Map(members.map(member => [
        member.id,
        getTeamMemberAccessState(
            { pessoa_id: member.pessoa_id, email: member.pessoas?.email },
            accounts,
            contextId,
            groupIds,
        ),
    ])), [members, accounts, contextId, groupIds]);

    const selectableIds = members
        .filter(member => {
            const kind = memberStates.get(member.id)?.kind;
            return kind === 'criar_conta' || kind === 'conceder';
        })
        .map(member => member.id);
    const selectedEffective = selectedIds.filter(id => selectableIds.includes(id));
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.includes(id));
    const groupNames = new Map(grupos.map(grupo => [grupo.id, grupo.nome]));

    const toggleMember = (memberId: string) => {
        setSelectedIds(current => current.includes(memberId) ? current.filter(id => id !== memberId) : [...current, memberId]);
    };

    const handleConfirmData = async (participacaoId: string) => {
        try {
            await inscricaoService.confirmarDados(participacaoId);
            setMembers(current => current.map(member => member.id === participacaoId ? { ...member, dados_confirmados: true } : member));
            toast.success('Dados confirmados.');
        } catch {
            toast.error('Erro ao confirmar dados.');
        }
    };

    const handleProcess = async () => {
        if (selectedEffective.length === 0 || groupIds.length === 0) return;
        setProcessing(true);
        const nextResults: Record<string, MemberResult> = {};

        for (const memberId of selectedEffective) {
            const member = members.find(item => item.id === memberId);
            const state = memberStates.get(memberId);
            if (!member || !state) continue;

            try {
                if (state.kind === 'criar_conta' && member.pessoas?.email) {
                    await adminUserService.createUser({
                        email: member.pessoas.email,
                        pessoaId: member.pessoa_id,
                        gruposIds: groupIds,
                        encontroId: contextId,
                    });
                    nextResults[memberId] = { success: true, message: 'Conta criada e convite enviado' };
                } else if (state.kind === 'conceder') {
                    const account = accounts.find(item => item.id === state.userId);
                    let vinculos = account?.grupos ?? [];
                    for (const grupoId of state.missingGroupIds) {
                        vinculos = await adminUserService.updateGrupos(state.userId, vinculos, 'add', grupoId, contextId);
                    }
                    nextResults[memberId] = { success: true, message: `${state.missingGroupIds.length} perfil(is) concedido(s)` };
                }
            } catch (error: unknown) {
                nextResults[memberId] = { success: false, message: userFacingError(error, 'Não foi possível concluir.') };
            }
        }

        const successes = Object.values(nextResults).filter(result => result.success).length;
        const failures = Object.values(nextResults).length - successes;
        if (successes > 0) toast.success(`${successes} acesso(s) liberado(s).`);
        if (failures > 0) toast.error(`${failures} pessoa(s) precisam de correção.`);

        setSelectedIds([]);
        setProcessing(false);
        if (equipe) await loadTeam(String(equipe.id));
        setResults(nextResults);
        if (successes > 0) onChanged();
    };

    return (
        <div className="users-team-custom">
            <div>
                <h2 className="users-admin-section-title">Por equipe (perfis personalizados)</h2>
                <p className="text-muted users-admin-section-text">
                    Escolha uma equipe de {contextLabel}, marque as pessoas e os perfis que elas devem receber, mesmo que
                    sejam diferentes do padrão. Quem não tem conta recebe convite; quem já tem recebe só os perfis que faltam.
                </p>
            </div>

            <ol className="users-steps">
                <li className={`users-step${equipe ? ' users-step--done' : ' users-step--current'}`}>
                    <span className="users-step__number">1</span>
                    <div className="users-step__body">
                        <h3>Equipe</h3>
                        <LiveSearchSelect<Equipe>
                            value={equipe ? String(equipe.id) : ''}
                            onChange={(value, selected) => handleEquipeChange(value, selected)}
                            fetchData={(search, page) => equipeService.buscarComPaginacao(search, page)}
                            getOptionLabel={option => option.nome || ''}
                            getOptionValue={option => String(option.id)}
                            placeholder="Selecione a equipe..."
                            initialOptions={equipe ? [equipe] : []}
                        />
                    </div>
                </li>

                <li className={`users-step${groupIds.length > 0 ? ' users-step--done' : equipe ? ' users-step--current' : ' users-step--pending'}`}>
                    <span className="users-step__number">2</span>
                    <div className="users-step__body">
                        <h3>Perfis em {contextLabel}</h3>
                        {equipe
                            ? <GroupPicker grupos={grupos} groupModules={groupModules} selectedIds={groupIds} onChange={setGroupIds} disabled={processing} />
                            : <p className="text-muted users-step__note">Escolha a equipe primeiro.</p>}
                    </div>
                </li>

                <li className={`users-step${selectedEffective.length > 0 ? ' users-step--done' : equipe ? ' users-step--current' : ' users-step--pending'}`}>
                    <span className="users-step__number">3</span>
                    <div className="users-step__body">
                        <h3>Pessoas</h3>
                        {!equipe ? (
                            <p className="text-muted users-step__note">Escolha a equipe primeiro.</p>
                        ) : loading ? (
                            <p className="text-muted users-step__note">Carregando integrantes...</p>
                        ) : members.length === 0 ? (
                            <p className="text-muted users-step__note">Ninguém nesta equipe em {contextLabel}.</p>
                        ) : (
                            <>
                                {selectableIds.length > 0 && (
                                    <label className="users-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={() => setSelectedIds(allSelected ? [] : selectableIds)}
                                        />
                                        Selecionar todos ({selectableIds.length})
                                    </label>
                                )}
                                <ul className="users-member-list">
                                    {members.map(member => {
                                        const state = memberStates.get(member.id);
                                        if (!state) return null;
                                        const selectable = state.kind === 'criar_conta' || state.kind === 'conceder';
                                        const selected = selectable && selectedIds.includes(member.id);
                                        const account = 'userId' in state ? accounts.find(item => item.id === state.userId) : undefined;
                                        const currentGroups = account ? getContextGroupIds(account, contextId) : [];
                                        const result = results[member.id];
                                        return (
                                            <li key={member.id} className={`users-member${selected ? ' users-member--selected' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Selecionar ${member.pessoas?.nome_completo || 'integrante'}`}
                                                    checked={selected}
                                                    disabled={!selectable || processing}
                                                    onChange={() => toggleMember(member.id)}
                                                />
                                                <div className="users-member__identity">
                                                    <strong>{member.pessoas?.nome_completo || 'Pessoa sem nome'}</strong>
                                                    <small>{member.pessoas?.email || 'Sem e-mail cadastrado'} · {member.coordenador ? 'Coordenação' : 'Integrante'}</small>
                                                    {currentGroups.length > 0 && (
                                                        <small>Perfis atuais: {currentGroups.map(id => groupNames.get(id)).filter(Boolean).join(', ')}</small>
                                                    )}
                                                </div>
                                                <div className="users-member__state">
                                                    <span className={`users-admin-status users-admin-status--member-${state.kind}`}>
                                                        {state.kind === 'conceder' && groupIds.length > 0
                                                            ? `Tem conta: +${state.missingGroupIds.length} perfil(is)`
                                                            : STATE_LABELS[state.kind]}
                                                    </span>
                                                    {state.kind === 'sem_email' && (
                                                        <button
                                                            type="button"
                                                            className="btn-text users-member__link"
                                                            onClick={() => setEmailTarget({
                                                                pessoaId: member.pessoa_id,
                                                                nome: member.pessoas?.nome_completo || 'Pessoa',
                                                                detalhe: equipe.nome,
                                                            })}
                                                        >
                                                            <Mail size={13} /> Cadastrar e-mail
                                                        </button>
                                                    )}
                                                    {member.dados_confirmados ? (
                                                        <span className="users-member__confirmed"><CheckCircle size={12} /> Dados confirmados</span>
                                                    ) : (
                                                        <button type="button" className="btn-text users-member__link" onClick={() => handleConfirmData(member.id)}>
                                                            Confirmar dados
                                                        </button>
                                                    )}
                                                    {result && (
                                                        <small className={result.success ? 'team-access-result--ok' : 'team-access-result--error'}>{result.message}</small>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </div>
                </li>
            </ol>

            <div className="team-access-footer">
                <span className="text-muted">
                    {selectedEffective.length} pessoa(s) · {groupIds.length} perfil(is)
                </span>
                <button
                    type="button"
                    className="btn-primary"
                    disabled={processing || selectedEffective.length === 0 || groupIds.length === 0}
                    onClick={handleProcess}
                >
                    <UserPlus size={16} /> {processing ? 'Liberando...' : `Liberar acesso (${selectedEffective.length})`}
                </button>
            </div>

            <PersonEmailModal
                target={emailTarget}
                onClose={() => setEmailTarget(null)}
                onSaved={() => (equipe ? loadTeam(String(equipe.id)) : undefined)}
            />
        </div>
    );
}
