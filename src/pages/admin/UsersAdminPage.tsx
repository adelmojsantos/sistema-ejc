import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, RotateCcw, Search, ShieldCheck, UserPlus, X, Trash2 } from 'lucide-react';
import { ActionStepper } from '../../components/ui/ActionStepper';
import { adminUserService, type AdminUsersSummary } from '../../services/adminUserService';
import type { Pessoa } from '../../types/pessoa';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { useEncontros } from '../../contexts/EncontroContext';
import { useDebounce } from '../../hooks/useDebounce';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportConfigService, type ExportConfig } from '../../services/exportConfigService';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export interface UserExtended {
    id: string;
    email: string;
    temporary_password: boolean;
    created_at: string;
    grupos: import('../../services/adminUserService').UserGrupoVinculo[];
    nome?: string;
    encontrosIds?: string[];
    equipesNomes?: Record<string, string>; // encontro_id -> nome_da_equipe
}

export function UsersAdminPage() {
    const [users, setUsers] = useState<UserExtended[]>([]);
    const [grupos, setGrupos] = useState<{ id: string, nome: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<AdminUsersSummary>({
        totalUsers: 0,
        totalTemporaryPassword: 0,
        totalWithoutPerson: 0,
        totalWithTargetAccess: 0,
        filteredTotal: 0,
    });
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [totalUsers, setTotalUsers] = useState(0);
    const [selectedGruposIds, setSelectedGruposIds] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);
    const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
    const [updatingRoleById, setUpdatingRoleById] = useState<Record<string, boolean>>({});
    const [resettingPasswordById, setResettingPasswordById] = useState<Record<string, boolean>>({});
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [selectedUserDetails, setSelectedUserDetails] = useState<UserExtended | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [selectedPessoa, setSelectedPessoa] = useState<Pessoa | null>(null);
    const [individualStep, setIndividualStep] = useState<'contexto' | 'pessoa' | 'perfil' | 'criar'>('pessoa');

    // Bulk creation state
    const [creationMode, setCreationMode] = useState<'individual' | 'lote'>('individual');
    const { encontros, encontroAtivo } = useEncontros();
    const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
    const [selectedEquipeId, setSelectedEquipeId] = useState<string>('');
    const [selectedEquipeNome, setSelectedEquipeNome] = useState<string>('');
    const [teamMembers, setTeamMembers] = useState<InscricaoEnriched[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [bulkGruposIds, setBulkGruposIds] = useState<string[]>([]);
    const [bulkStep, setBulkStep] = useState<'encontro' | 'equipe' | 'membros' | 'acesso' | 'criar'>('encontro');
    const [bulkEncontroAlteradoManual, setBulkEncontroAlteradoManual] = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [bulkResults, setBulkResults] = useState<{ id: string; success: boolean; message?: string }[]>([]);

    const [exportConfigs, setExportConfigs] = useState<ExportConfig[]>([]);
    const [selectedExportConfigId, setSelectedExportConfigId] = useState<string>('none');

    const [targetEncontroId, setTargetEncontroId] = useState<string | null>(null); // The context for permissions

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 400);
    const [filterGrupoId, setFilterGrupoId] = useState<string>('all');
    const [filterEncontroId, setFilterEncontroId] = useState<string>('all');
    const [filterTempPassword, setFilterTempPassword] = useState<'all' | 'sim' | 'nao'>('all');

    const loadSupportData = useCallback(async () => {
        try {
            const gruposData = await adminUserService.listGrupos();
            setGrupos(gruposData);

            const configs = await exportConfigService.listarTodas();
            setExportConfigs(configs);
            if (configs.length > 0) setSelectedExportConfigId(prev => prev === 'none' ? configs[0].id : prev);
        } catch (err) {
            console.warn('Could not load users support data', err);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await adminUserService.listUsers({
                page: currentPage,
                pageSize,
                search: debouncedSearchTerm,
                grupoId: filterGrupoId,
                encontroId: filterEncontroId,
                tempPassword: filterTempPassword,
                targetEncontroId,
            });

            setUsers(response.users as UserExtended[]);
            setTotalUsers(response.total);
            setSummary(response.summary);

        } catch (err: unknown) {
            console.error('Falha em loadUsers', err);
            setError(`Erro ao carregar (Veja console): ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearchTerm, filterGrupoId, filterEncontroId, filterTempPassword, targetEncontroId]);

    useEffect(() => {
        loadSupportData();
    }, [loadSupportData]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        setCurrentPage(0);
    }, [debouncedSearchTerm, filterGrupoId, filterEncontroId, filterTempPassword, targetEncontroId]);

    // Inicializa encontro a partir do contexto global
    useEffect(() => {
        if (encontros.length === 0) return;
        if (!selectedEncontroId) {
            const active = encontroAtivo || encontros[0];
            setSelectedEncontroId(active.id);
            if (targetEncontroId === null) setTargetEncontroId(active.id);
        }
    }, [encontros, encontroAtivo, selectedEncontroId, targetEncontroId]);

    useEffect(() => {
        if (creationMode !== 'lote') return;
        if (!targetEncontroId || bulkEncontroAlteradoManual) return;

        if (selectedEncontroId !== targetEncontroId) {
            setSelectedEncontroId(targetEncontroId);
            setSelectedEquipeId('');
            setSelectedEquipeNome('');
            setTeamMembers([]);
            setSelectedMemberIds([]);
            setBulkResults([]);
        }

        setBulkStep('equipe');
    }, [creationMode, targetEncontroId, selectedEncontroId, bulkEncontroAlteradoManual]);

    const handleClearSelection = () => {
        setSelectedPessoa(null);
        setSelectedGruposIds([]);
        setIndividualStep('pessoa');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleCreateUser = async (event: SyntheticEvent) => {
        event.preventDefault();

        const email = selectedPessoa?.email;
        if (!selectedPessoa || !email) {
            toast.error('Selecione uma pessoa com e-mail cadastrado.');
            return;
        }
        if (selectedGruposIds.length === 0) {
            toast.error('Selecione ao menos um perfil de acesso.');
            return;
        }

        setCreating(true);
        try {
            const result = await adminUserService.createUser({ email, gruposIds: selectedGruposIds, encontroId: targetEncontroId });
            setTempPasswords((prev) => ({ ...prev, [result.user.id]: result.temporaryPassword }));
            toast.success('Usuário criado com senha temporária.');
            handleClearSelection();
            loadUsers();
        } catch (createError: unknown) {
            const message = createError instanceof Error ? createError.message : 'Erro ao criar usuário.';
            toast.error(message);
        } finally {
            setCreating(false);
        }
    };

    const handleToggleSelectedGrupo = (grupoId: string) => {
        setSelectedGruposIds(prev => {
            const next = prev.includes(grupoId)
                ? prev.filter(x => x !== grupoId)
                : [...prev, grupoId];

            if (next.length > 0) {
                setIndividualStep('criar');
            } else {
                setIndividualStep('perfil');
            }

            return next;
        });
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeleting(true);
        try {
            await adminUserService.deleteUser(userToDelete);
            toast.success('Acesso removido com sucesso.');
            setUsers((prev) => prev.filter(u => u.id !== userToDelete));
            setUserToDelete(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Erro ao remover usuário.';
            toast.error(message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleLoadTeamMembers = async (encontroId = selectedEncontroId, equipeId = selectedEquipeId) => {
        if (!encontroId || !equipeId) return;
        setLoadingMembers(true);
        setSelectedMemberIds([]);
        setBulkResults([]);
        try {
            const membros = await adminUserService.listTeamMembers(encontroId, equipeId);
            setTeamMembers(membros as unknown as InscricaoEnriched[]);
            setBulkStep('membros');
        } catch {
            toast.error('Erro ao carregar membros da equipe.');
        } finally {
            setLoadingMembers(false);
        }
    };

    const handleBulkEncontroChange = (encontroId: string) => {
        setBulkEncontroAlteradoManual(true);
        setSelectedEncontroId(encontroId);
        setSelectedEquipeId('');
        setSelectedEquipeNome('');
        setTeamMembers([]);
        setSelectedMemberIds([]);
        setBulkResults([]);
        setBulkStep('equipe');
    };

    const handleBulkEquipeChange = (equipeId: string, equipe?: Equipe | null) => {
        setSelectedEquipeId(equipeId);
        setSelectedEquipeNome(equipe?.nome || '');
        setTeamMembers([]);
        setSelectedMemberIds([]);
        setBulkResults([]);

        if (selectedEncontroId && equipeId) {
            void handleLoadTeamMembers(selectedEncontroId, equipeId);
        }
    };

    const handleToggleBulkMember = (pessoaId: string) => {
        setSelectedMemberIds(prev => {
            const next = prev.includes(pessoaId) ? prev.filter(id => id !== pessoaId) : [...prev, pessoaId];
            // setBulkStep(next.length > 0 ? 'acesso' : 'membros');
            return next;
        });
    };

    const handleToggleAllBulkMembers = () => {
        const availableMembers = teamMembers.filter(m => m.pessoas?.email && !users.some(u => u.email === m.pessoas?.email));
        if (selectedMemberIds.length === availableMembers.length) {
            setSelectedMemberIds([]);
            setBulkStep('membros');
        } else {
            setSelectedMemberIds(availableMembers.map(m => m.pessoa_id));
            if (availableMembers.length > 0) setBulkStep('acesso');
        }
    };

    const handleToggleBulkGrupo = (grupoId: string) => {
        setBulkGruposIds(prev => {
            const next = prev.includes(grupoId)
                ? prev.filter(x => x !== grupoId)
                : [...prev, grupoId];

            if (next.length > 0) {
                setBulkStep('criar');
            } else {
                setBulkStep('acesso');
            }

            return next;
        });
    };

    const handleBulkCreate = async () => {
        if (selectedMemberIds.length === 0) return;
        if (bulkGruposIds.length === 0) {
            toast.error('Selecione ao menos um perfil padrão para criar os acessos.');
            return;
        }

        setCreating(true);
        const results = [];

        for (const pessoaId of selectedMemberIds) {
            const member = teamMembers.find(m => m.pessoa_id === pessoaId);
            if (!member || !member.pessoas?.email) continue;

            try {
                const result = await adminUserService.createUser({ email: member.pessoas.email, gruposIds: bulkGruposIds, encontroId: targetEncontroId });
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
        if (successes > 0) loadUsers();
    };

    const handleConfirmMemberInBulk = async (participacaoId: string) => {
        try {
            await inscricaoService.confirmarDados(participacaoId);
            toast.success('Membro confirmado.');
            setTeamMembers(prev => prev.map(m => m.id === participacaoId ? { ...m, dados_confirmados: true } : m));
        } catch {
            toast.error('Erro ao confirmar dados.');
        }
    };

    const handleToggleGroups = async (userId: string, gId: string, currentVinculos: import('../../services/adminUserService').UserGrupoVinculo[]) => {
        setUpdatingRoleById((prev) => ({ ...prev, [userId]: true }));
        try {
            const hasVinculo = currentVinculos.some(v => v.grupo_id === gId && v.encontro_id === targetEncontroId);
            const action = hasVinculo ? 'remove' : 'add';
            const newVinculos = await adminUserService.updateGrupos(userId, currentVinculos, action, gId, targetEncontroId);

            setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, grupos: newVinculos } : user)));
            setSelectedUserDetails((prev) => (prev?.id === userId ? { ...prev, grupos: newVinculos } : prev));
            toast.success(action === 'add' ? 'Acesso concedido.' : 'Acesso revogado.');
        } catch (updateError: unknown) {
            console.error('Error updating group:', updateError);
            const message = (updateError instanceof Error) ? updateError.message : 'Erro ao atualizar grupo.';
            toast.error(message);
        } finally {
            setUpdatingRoleById((prev) => ({ ...prev, [userId]: false }));
        }
    }

    const handleResetTemporaryPassword = async (userId: string) => {
        setResettingPasswordById((prev) => ({ ...prev, [userId]: true }));
        try {
            const result = await adminUserService.resetTemporaryPassword(userId);
            setTempPasswords((prev) => ({ ...prev, [userId]: result.temporaryPassword }));
            setUsers((prev) => prev.map((user) => (user.id === userId ? result.user : user)));
            setSelectedUserDetails((prev) => (prev?.id === userId ? { ...prev, ...result.user } : prev));
            toast.success('Senha temporária redefinida.');
        } catch (resetError: unknown) {
            const message = resetError instanceof Error ? resetError.message : 'Erro ao redefinir senha.';
            toast.error(message);
        } finally {
            setResettingPasswordById((prev) => ({ ...prev, [userId]: false }));
        }
    };

    const handleExportPDF = () => {
        if (filteredUsers.length === 0) {
            toast.error('Nenhum usuário para exportar.');
            return;
        }

        const config = exportConfigs.find(c => c.id === selectedExportConfigId);
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        let startY = 30;

        if (config) {
            if (config.imagem_esq_base64) {
                try { doc.addImage(config.imagem_esq_base64, 'PNG', 14, 10, 30, 30); } catch { /* ignore */ }
            }
            if (config.imagem_dir_base64) {
                try { doc.addImage(config.imagem_dir_base64, 'PNG', 166, 10, 30, 30); } catch { /* ignore */ }
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(config.titulo || '', 105, 18, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(config.subtitulo || '', 105, 24, { align: 'center' });

            doc.text(config.tema || '', 105, 30, { align: 'center' });

            if (config.observacoes) {
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.text(config.observacoes, 105, 38, { align: 'center' });
                startY = 60;
            } else {
                startY = 60;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Relatório de Usuários do Sistema', 14, startY - 8);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${filteredUsers.length} usuário(s)`, 14, startY - 2);
            doc.setTextColor(0);
        } else {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Relatório de Usuários do Sistema', 14, 18);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${filteredUsers.length} usuário(s)`, 14, 24);
            doc.setTextColor(0);
        }

        const targetIdToUse = (filterEncontroId !== 'all' ? filterEncontroId : targetEncontroId) || '';

        // Prepare and sort data
        const dataForExport = filteredUsers.map(u => {
            const equipe = u.equipesNomes?.[targetIdToUse] || Object.values(u.equipesNomes || {})[0] || '— Sem Equipe —';
            return {
                ...u,
                resolvedEquipe: equipe,
                resolvedNome: u.nome || '[Sem vínculo]'
            };
        });

        dataForExport.sort((a, b) => {
            const eqComp = a.resolvedEquipe.localeCompare(b.resolvedEquipe);
            if (eqComp !== 0) return eqComp;
            return a.resolvedNome.localeCompare(b.resolvedNome);
        });

        const columns = ['Equipe', 'Identificação (Nome / E-mail)', 'Senha Temporária'];

        const rows = dataForExport.map(u => {
            const currentEquipe = u.resolvedEquipe;
            const nameEmailStr = `${u.resolvedNome}\n${u.email}`;
            const tempPasswordText = tempPasswords[u.id] ? `Temporária pronta: ${tempPasswords[u.id]}` : (u.temporary_password ? u.email : 'Senha Própria');

            return [currentEquipe, nameEmailStr, tempPasswordText];
        });

        autoTable(doc, {
            head: [columns],
            body: rows,
            startY: startY,
            styles: {
                fontSize: 8,
                cellPadding: 3,
                lineColor: [220, 220, 220],
                lineWidth: 0.25,
            },
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [37, 99, 235], cellWidth: 50 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 50 }
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250],
            },
            margin: { left: 14, right: 14 }
        });

        doc.save(`usuarios_export_${new Date().getTime()}.pdf`);
        toast.success('PDF gerado com sucesso!');
    };

    const handleExportCSV = () => {
        const rows = [
            ['Nome', 'Email', 'Criado em', 'Senha Temporária', 'Grupos']
        ];

        filteredUsers.forEach(u => {
            const gNames = u.grupos?.map(v => grupos.find(g => g.id === v.grupo_id)?.nome || '').filter(Boolean).join('; ') || '';
            rows.push([
                `"${u.nome || 'Sem vínculo'}"`,
                `"${u.email}"`,
                `"${new Date(u.created_at).toLocaleDateString('pt-BR')}"`,
                u.temporary_password ? 'Sim' : 'Não',
                `"${gNames}"`
            ]);
        });

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `usuarios_export_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredUsers = users;
    const totalPages = Math.max(Math.ceil(totalUsers / pageSize), 1);
    const pageStart = totalUsers === 0 ? 0 : currentPage * pageSize + 1;
    const pageEnd = Math.min((currentPage + 1) * pageSize, totalUsers);
    const contextoSelecionado = targetEncontroId
        ? encontros.find((encontro) => encontro.id === targetEncontroId)
        : null;
    const contextoLabel = contextoSelecionado
        ? (contextoSelecionado.nome || String(contextoSelecionado.edicao || '') || contextoSelecionado.tema || 'Encontro selecionado')
        : 'Acesso global permanente';
    const bulkEncontroSelecionado = selectedEncontroId
        ? encontros.find((encontro) => encontro.id === selectedEncontroId)
        : null;
    const bulkEncontroLabel = bulkEncontroSelecionado
        ? (bulkEncontroSelecionado.nome || String(bulkEncontroSelecionado.edicao || '') || bulkEncontroSelecionado.tema || 'Encontro selecionado')
        : 'Selecione o encontro';
    const bulkEquipeLabel = selectedEquipeNome || (selectedEquipeId ? 'Equipe selecionada' : 'Selecione a equipe');
    const membrosElegiveis = teamMembers.filter(m => (m.pessoas?.email ?? '') !== '' && !users.some(u => u.email === m.pessoas?.email));
    const bulkAcessosLabel = bulkGruposIds.length > 0
        ? bulkGruposIds.map(id => grupos.find(g => g.id === id)?.nome).filter(Boolean).join(', ')
        : 'Selecione ao menos um perfil';

    return (
        <div className="container" style={{ paddingBottom: '2rem' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
                        <ShieldCheck size={22} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                        Gestão de acessos
                    </h1>
                    <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
                        Configure usuários, perfis de acesso e senhas temporárias por contexto de encontro.
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}>Contexto de edição:</label>
                    <select
                        className="form-input"
                        style={{ padding: '0.2rem 2rem 0.2rem 0.5rem', height: '32px', minWidth: '220px', fontWeight: 600, color: targetEncontroId === null ? 'var(--danger-text)' : 'inherit' }}
                        value={targetEncontroId === null ? 'global' : (targetEncontroId || '')}
                        onChange={e => setTargetEncontroId(e.target.value === 'global' ? null : e.target.value)}
                    >
                        <option value="global" style={{ color: 'var(--danger-text)' }}>Escopo global permanente</option>
                        {encontros.map(e => (
                            <option key={e.id} value={e.id}>{e.nome || e.edicao || e.tema} {e.ativo ? '⭐ (Atual Ativo)' : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            <section className="access-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                <div className="card" style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)', fontWeight: 700, textTransform: 'uppercase' }}>Usuários</span>
                    <strong style={{ display: 'block', fontSize: '1.6rem', marginTop: '0.25rem' }}>{summary.totalUsers}</strong>
                    <small style={{ color: 'var(--muted-text)' }}>Total cadastrado no sistema</small>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)', fontWeight: 700, textTransform: 'uppercase' }}>Primeiro acesso</span>
                    <strong style={{ display: 'block', fontSize: '1.6rem', marginTop: '0.25rem', color: 'var(--warning-color)' }}>{summary.totalTemporaryPassword}</strong>
                    <small style={{ color: 'var(--muted-text)' }}>Com senha temporária</small>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)', fontWeight: 700, textTransform: 'uppercase' }}>Sem pessoa</span>
                    <strong style={{ display: 'block', fontSize: '1.6rem', marginTop: '0.25rem' }}>{summary.totalWithoutPerson}</strong>
                    <small style={{ color: 'var(--muted-text)' }}>Usuários sem vínculo cadastral</small>
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)', fontWeight: 700, textTransform: 'uppercase' }}>No contexto</span>
                    <strong style={{ display: 'block', fontSize: '1.6rem', marginTop: '0.25rem', color: 'var(--primary-color)' }}>{summary.totalWithTargetAccess}</strong>
                    <small style={{ color: 'var(--muted-text)' }}>Com acesso no contexto selecionado</small>
                </div>
            </section>

            <section className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Conceder novo acesso</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--secondary-bg)', padding: '0.25rem', borderRadius: '12px' }}>
                        <button
                            type="button"
                            className={`btn-text ${creationMode === 'individual' ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedPessoa(null)
                                setCreationMode('individual')
                                if(selectedEncontroId) setIndividualStep('pessoa')
                            }}
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
                            onClick={() => {
                                setSelectedEquipeId('')
                                setSelectedEquipeNome('')
                                setSelectedMemberIds([])
                                setSelectedGruposIds([])
                                setBulkGruposIds([])
                                setCreationMode('lote')
                            }}
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
                    <form onSubmit={handleCreateUser} onKeyDown={handleKeyDown}>
                        <ActionStepper
                            steps={[
                                {
                                    id: 'contexto',
                                    title: 'Contexto',
                                    summary: contextoLabel,
                                    status: individualStep === 'contexto' ? 'current' : 'completed',
                                    onEdit: () => setIndividualStep('contexto'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div className="form-group">
                                            <label className="form-label">Contexto de edição</label>
                                            <select
                                                className="form-input"
                                                value={targetEncontroId === null ? 'global' : (targetEncontroId || '')}
                                                onChange={e => setTargetEncontroId(e.target.value === 'global' ? null : e.target.value)}
                                            >
                                                <option value="global">Escopo global permanente</option>
                                                {encontros.map(e => (
                                                    <option key={e.id} value={e.id}>
                                                        {e.nome || e.edicao || e.tema} {e.ativo ? '(Atual ativo)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    onClick={() => setIndividualStep('pessoa')}
                                                >
                                                    Continuar
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'pessoa',
                                    title: 'Pessoa',
                                    summary: selectedPessoa?.email
                                        ? `${selectedPessoa.nome_completo} · ${selectedPessoa.email}`
                                        : 'Busque uma pessoa com e-mail',
                                    status: selectedPessoa?.email
                                        ? (individualStep === 'pessoa' ? 'current' : 'completed')
                                        : (individualStep === 'pessoa' ? 'current' : 'pending'),
                                    onEdit: () => setIndividualStep('pessoa'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div className="form-group">
                                            <label className="form-label">
                                                Pessoa <span className="form-label-required">*</span>
                                            </label>
                                            <LiveSearchSelect<Pessoa>
                                                value={selectedPessoa?.id || ''}
                                                onChange={(_, pessoa) => {
                                                    setSelectedPessoa(pessoa);
                                                    if (pessoa?.email) {
                                                        setIndividualStep('perfil');
                                                    }
                                                }}
                                                fetchData={(search, page) => adminUserService.searchPeople(search, page, 20)}
                                                getOptionLabel={(pessoa) => pessoa.nome_completo}
                                                getOptionValue={(pessoa) => pessoa.id}
                                                placeholder="Buscar pessoa por nome, e-mail ou telefone..."
                                                pageSize={20}
                                                renderOption={(pessoa) => (
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{pessoa.nome_completo}</div>
                                                        <div style={{ color: 'var(--muted-text)', fontSize: '0.78rem' }}>
                                                            {pessoa.email || 'Sem e-mail cadastrado'}
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                            {selectedPessoa && !selectedPessoa.email && (
                                                <div style={{ marginTop: '0.5rem', color: 'var(--danger-text, #e53e3e)', fontSize: '0.82rem' }}>
                                                    Esta pessoa não tem e-mail cadastrado.
                                                </div>
                                            )}
                                            {selectedPessoa && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-text"
                                                        onClick={handleClearSelection}
                                                        style={{ padding: 0, fontSize: '0.78rem', color: 'var(--primary-color)' }}
                                                    >
                                                        Limpar seleção
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-primary"
                                                        disabled={!selectedPessoa.email}
                                                        onClick={() => setIndividualStep('perfil')}
                                                    >
                                                        Continuar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    id: 'perfil',
                                    title: 'Perfil',
                                    summary: selectedGruposIds.length > 0
                                        ? selectedGruposIds.map(id => grupos.find(g => g.id === id)?.nome).filter(Boolean).join(', ')
                                        : 'Selecione ao menos um perfil',
                                    status: selectedPessoa?.email
                                        ? (selectedGruposIds.length > 0 && individualStep !== 'perfil' ? 'completed' : individualStep === 'perfil' ? 'current' : 'pending')
                                        : 'pending',
                                    onEdit: () => setIndividualStep('perfil'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div className="form-group">
                                            <label className="form-label">Perfis de acesso</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                {grupos.map((g) => (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => handleToggleSelectedGrupo(g.id)}
                                                        style={{
                                                            padding: '0.3rem 0.6rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.8rem',
                                                            border: `1px solid ${selectedGruposIds.includes(g.id) ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                            background: selectedGruposIds.includes(g.id) ? 'var(--primary-color)' : 'transparent',
                                                            color: selectedGruposIds.includes(g.id) ? '#fff' : 'var(--text-color)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {g.nome}
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    disabled={selectedGruposIds.length === 0}
                                                    onClick={() => setIndividualStep('criar')}
                                                >
                                                    Continuar
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'criar',
                                    title: 'Criar usuário',
                                    summary: selectedPessoa?.email && selectedGruposIds.length > 0
                                        ? `Senha temporária será o e-mail ${selectedPessoa.email}`
                                        : 'Complete as etapas anteriores',
                                    status: selectedPessoa?.email && selectedGruposIds.length > 0 && individualStep === 'criar' ? 'current' : 'pending',
                                    children: (
                                        <div>
                                            <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '1rem', color: 'var(--muted-text)', fontSize: '0.86rem' }}>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Contexto:</strong> {contextoLabel}</span>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Pessoa:</strong> {selectedPessoa?.nome_completo}</span>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Perfis:</strong> {selectedGruposIds.map(id => grupos.find(g => g.id === id)?.nome).filter(Boolean).join(', ')}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button className="btn-primary" type="submit" disabled={creating || !selectedPessoa?.email || selectedGruposIds.length === 0}>
                                                    <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                                    {creating ? 'Criando...' : 'Criar usuário'}
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </form>
                ) : (
                    <div className="bulk-creation-form">
                        <ActionStepper
                            steps={[
                                {
                                    id: 'encontro',
                                    title: 'Encontro',
                                    summary: bulkEncontroLabel,
                                    status: selectedEncontroId ? (bulkStep === 'encontro' ? 'current' : 'completed') : 'current',
                                    onEdit: () => setBulkStep('encontro'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div className="form-group">
                                            <label className="form-label">Encontro</label>
                                            <LiveSearchSelect<Encontro>
                                                value={selectedEncontroId}
                                                onChange={(val) => handleBulkEncontroChange(val)}
                                                fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                                                getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
                                                getOptionValue={(e) => String(e.id)}
                                                placeholder="Selecione um encontro..."
                                                initialOptions={encontros}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    disabled={!selectedEncontroId}
                                                    onClick={() => setBulkStep('equipe')}
                                                >
                                                    Continuar
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'equipe',
                                    title: 'Equipe',
                                    summary: loadingMembers ? 'Buscando membros...' : bulkEquipeLabel,
                                    status: selectedEncontroId
                                        ? (selectedEquipeId && bulkStep !== 'equipe' ? 'completed' : bulkStep === 'equipe' ? 'current' : 'pending')
                                        : 'pending',
                                    onEdit: () => setBulkStep('equipe'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div className="form-group">
                                            <label className="form-label">Equipe</label>
                                            <LiveSearchSelect<Equipe>
                                                value={selectedEquipeId}
                                                onChange={(val, equipe) => handleBulkEquipeChange(val, equipe)}
                                                fetchData={async (search, page) => await equipeService.buscarComPaginacao(search, page)}
                                                getOptionLabel={(e) => e.nome || ''}
                                                getOptionValue={(e) => String(e.id)}
                                                placeholder="Selecione uma equipe..."
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    disabled={!selectedEncontroId || !selectedEquipeId || loadingMembers}
                                                    onClick={() => handleLoadTeamMembers()}
                                                >
                                                    <Search size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                                    {loadingMembers ? 'Buscando...' : 'Continuar'}
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'membros',
                                    title: 'Selecionar membros',
                                    summary: teamMembers.length > 0
                                        ? `${selectedMemberIds.length} de ${membrosElegiveis.length} elegível(is) selecionado(s)`
                                        : 'Carregue os membros da equipe',
                                    status: selectedEquipeId
                                        ? (selectedMemberIds.length > 0 && bulkStep !== 'membros' ? 'completed' : bulkStep === 'membros' ? 'current' : 'pending')
                                        : 'pending',
                                    onEdit: () => setBulkStep('membros'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div>
                                            {loadingMembers && (
                                                <div className="text-center text-muted" style={{ padding: '1.5rem' }}>Buscando membros...</div>
                                            )}
                                            {!loadingMembers && selectedEquipeId && teamMembers.length === 0 && (
                                                <div className="text-center text-muted" style={{ padding: '1.5rem' }}>Nenhum membro encontrado.</div>
                                            )}
                                            {teamMembers.length > 0 && (
                                                <>
                                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--secondary-bg)', borderRadius: '8px', flexWrap: 'wrap' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedMemberIds.length > 0 && selectedMemberIds.length === membrosElegiveis.length}
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
                                                                    flexWrap: 'wrap',
                                                                }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        disabled={!isEligible || creating}
                                                                        onChange={() => handleToggleBulkMember(member.pessoa_id)}
                                                                        style={{ width: '1.2rem', height: '1.2rem', cursor: isEligible ? 'pointer' : 'not-allowed' }}
                                                                    />
                                                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pessoa?.nome_completo}</div>
                                                                        <div style={{ fontSize: '0.8rem', color: 'var(--muted-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                            {pessoa?.email || 'Sem e-mail'}
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.8rem', textAlign: 'right', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end', marginLeft: 'auto' }}>
                                                                        {!hasEmail && <span style={{ color: 'var(--danger-text)' }}>Falta e-mail</span>}
                                                                        {existingUser && <span style={{ color: 'var(--success-text)' }}>Já cadastrado</span>}
                                                                        {result && (
                                                                            <span style={{ color: result.success ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                                                                                {result.success ? '✓ Criado' : `✗ ${result.message}`}
                                                                            </span>
                                                                        )}
                                                                        {member.dados_confirmados ? (
                                                                            <span style={{
                                                                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                                                                color: '#10b981',
                                                                                padding: '0.2rem 0.5rem',
                                                                                borderRadius: '20px',
                                                                                fontSize: '0.7rem',
                                                                                fontWeight: 700,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '0.3rem',
                                                                                border: '1px solid rgba(16, 185, 129, 0.2)'
                                                                            }}>
                                                                                <CheckCircle size={12} /> Confirmado
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); handleConfirmMemberInBulk(member.id); }}
                                                                                style={{
                                                                                    padding: '0.1rem 0.4rem',
                                                                                    fontSize: '0.7rem',
                                                                                    background: 'none',
                                                                                    border: '1px solid var(--border-color)',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                Confirmar Dados
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                                                        <button
                                                            type="button"
                                                            className="btn-primary"
                                                            disabled={selectedMemberIds.length === 0}
                                                            onClick={() => setBulkStep('acesso')}
                                                        >
                                                            Continuar
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ),
                                },
                                {
                                    id: 'acesso',
                                    title: 'Acesso',
                                    summary: bulkAcessosLabel,
                                    status: selectedMemberIds.length > 0
                                        ? (bulkGruposIds.length > 0 && bulkStep !== 'acesso' ? 'completed' : bulkStep === 'acesso' ? 'current' : 'pending')
                                        : 'pending',
                                    onEdit: () => setBulkStep('acesso'),
                                    editLabel: 'Alterar',
                                    children: (
                                        <div className="form-group">
                                            <label className="form-label">Perfis padrão</label>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                                                {grupos.map((g) => (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => handleToggleBulkGrupo(g.id)}
                                                        style={{
                                                            padding: '0.2rem 0.6rem',
                                                            borderRadius: '20px',
                                                            fontSize: '0.75rem',
                                                            border: `1px solid ${bulkGruposIds.includes(g.id) ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                            background: bulkGruposIds.includes(g.id) ? 'var(--primary-color)' : 'transparent',
                                                            color: bulkGruposIds.includes(g.id) ? '#fff' : 'var(--text-color)',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {g.nome}
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn-primary"
                                                    disabled={bulkGruposIds.length === 0}
                                                    onClick={() => setBulkStep('criar')}
                                                >
                                                    Continuar
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    id: 'criar',
                                    title: 'Criar',
                                    summary: selectedMemberIds.length > 0 && bulkGruposIds.length > 0
                                        ? `${selectedMemberIds.length} usuário(s) com ${bulkGruposIds.length} perfil(is)`
                                        : 'Complete as etapas anteriores',
                                    status: selectedMemberIds.length > 0 && bulkGruposIds.length > 0 && bulkStep === 'criar' ? 'current' : 'pending',
                                    children: (
                                        <div>
                                            <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '1rem', color: 'var(--muted-text)', fontSize: '0.86rem' }}>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Encontro:</strong> {bulkEncontroLabel}</span>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Equipe:</strong> {bulkEquipeLabel}</span>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Membros:</strong> {selectedMemberIds.length} selecionado(s)</span>
                                                <span><strong style={{ color: 'var(--text-color)' }}>Acessos:</strong> {bulkAcessosLabel}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button className="btn-primary" onClick={handleBulkCreate} disabled={creating || selectedMemberIds.length === 0 || bulkGruposIds.length === 0}>
                                                    <UserPlus size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                                    {creating ? 'Processando...' : `Criar ${selectedMemberIds.length} usuário(s)`}
                                                </button>
                                            </div>
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </div>
                )}
            </section>

            <section className="card">
                <div className="admin-users-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Usuários cadastrados</h2>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--muted-text)' }}>
                            {totalUsers === 0 ? 'Nenhum usuário encontrado' : `${pageStart}-${pageEnd} de ${totalUsers} usuário(s)`}
                            {summary.filteredTotal !== summary.totalUsers && (
                                <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>
                                    · {summary.filteredTotal} no filtro
                                </span>
                            )}
                            {filteredUsers.filter(u => u.temporary_password).length > 0 && (
                                <span style={{ marginLeft: '0.5rem', color: 'var(--warning-color)', fontWeight: 600 }}>
                                    · {filteredUsers.filter(u => u.temporary_password).length} nesta página com senha pendente
                                </span>
                            )}
                        </p>
                    </div>
                    <button className="btn-secondary" type="button" onClick={loadUsers} disabled={loading} title="Atualizar lista" style={{ padding: '0.4rem 0.75rem' }}>
                        <RotateCcw size={15} />
                    </button>
                </div>

                {loading && <p className="text-muted">Carregando usuários...</p>}
                {!loading && error && <div className="alert alert--error">{error}</div>}

                {/* Area de Filtros */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-1)', borderRadius: '8px 8px 0 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Consultar por nome, e-mail ou equipe</label>
                            <div className="form-input-wrapper">
                                <div className="form-input-icon">
                                    <Search size={16} />
                                </div>
                                <input
                                    type="text"
                                    className="form-input form-input--with-icon"
                                    placeholder="Buscar usuário..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        style={{
                                            position: 'absolute',
                                            right: '0.6rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--muted-text)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.2rem',
                                        }}
                                        title="Limpar busca"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Perfil de acesso</label>
                            <select className="form-input" value={filterGrupoId} onChange={e => setFilterGrupoId(e.target.value)}>
                                <option value="all">Todos os perfis</option>
                                {grupos.map(g => (
                                    <option key={g.id} value={g.id}>{g.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Participação no encontro</label>
                            <select className="form-input" value={filterEncontroId} onChange={e => setFilterEncontroId(e.target.value)}>
                                <option value="all">Todos os encontros</option>
                                {encontros.map(enc => (
                                    <option key={enc.id} value={enc.id}>{enc.edicao} - {enc.tema}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Status da conta</label>
                            <select className="form-input" value={filterTempPassword} onChange={e => setFilterTempPassword(e.target.value as 'all' | 'sim' | 'nao')}>
                                <option value="all">Sem distinção</option>
                                <option value="sim">Primeiro acesso pendente</option>
                                <option value="nao">Primeiro acesso concluído</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Cabeçalho Oficial do PDF</label>
                            <select className="form-input" value={selectedExportConfigId} onChange={e => setSelectedExportConfigId(e.target.value)}>
                                <option value="none">Sem cabeçalho (Simples)</option>
                                {exportConfigs.map(c => (
                                    <option key={c.id} value={c.id}>{c.titulo} {(c as ExportConfig & { encontros?: { nome: string } | null }).encontros?.nome ? `(${(c as ExportConfig & { encontros?: { nome: string } | null }).encontros!.nome})` : ''}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', justifySelf: 'start', minWidth: '220px' }}>
                            <button onClick={handleExportCSV} className="btn-secondary" style={{ height: '39px', flex: 1, padding: '0 0.5rem', fontSize: '0.85rem' }}>
                                Planilha CSV
                            </button>
                            <button onClick={handleExportPDF} className="btn-primary" style={{ height: '39px', flex: 1, padding: '0 0.5rem', fontSize: '0.85rem' }}>
                                Acessos PDF
                            </button>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0, maxWidth: '160px' }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Por página</label>
                            <select className="form-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(0); }}>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                </div>

                {!loading && !error && (
                    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                        {filteredUsers.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Nenhum usuário encontrado.</div>
                        )}
                        {filteredUsers.map((user) => {
                            const tempPassword = tempPasswords[user.id];
                            const passwordResetting = !!resettingPasswordById[user.id];
                            const initial = (user.nome || user.email).charAt(0).toUpperCase();
                            const activeGroups = grupos.filter(g => user.grupos?.some(v => v.grupo_id === g.id && v.encontro_id === targetEncontroId));
                            const targetEquipe = targetEncontroId ? user.equipesNomes?.[targetEncontroId] : Object.values(user.equipesNomes || {})[0];

                            return (
                                <div key={user.id} style={{
                                    display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start',
                                    padding: '1rem 1.25rem',
                                    background: 'var(--surface-1)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    transition: 'box-shadow 0.2s'
                                }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                                        background: 'var(--primary-color)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: '1.1rem'
                                    }}>{initial}</div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: '160px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                            {user.nome || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Sem vínculo</span>}
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--muted-text)' }}>{user.email}</div>
                                        {targetEquipe && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--muted-text)', marginTop: '0.15rem' }}>{targetEquipe}</div>
                                        )}
                                        {user.temporary_password && !tempPassword && (
                                            <span style={{ fontSize: '0.7rem', background: 'var(--warning-color)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '12px', display: 'inline-block', marginTop: '0.3rem', fontWeight: 600 }}>
                                                Senha Pendente
                                            </span>
                                        )}
                                        {tempPassword && (
                                            <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <code style={{ fontSize: '0.78rem', background: 'var(--secondary-bg)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                                    {tempPassword}
                                                </code>
                                                <button
                                                    type="button"
                                                    title="Copiar senha"
                                                    onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Senha copiada!'); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Perfis ativos */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', minWidth: '140px', maxWidth: '280px' }}>
                                        {activeGroups.length === 0 ? (
                                            <span style={{ fontSize: '0.78rem', color: 'var(--muted-text)' }}>Sem perfil neste contexto</span>
                                        ) : (
                                            activeGroups.slice(0, 3).map(g => (
                                                <span
                                                    key={g.id}
                                                    style={{
                                                        padding: '0.2rem 0.55rem',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '999px',
                                                        border: '1px solid var(--primary-color)',
                                                        background: 'var(--primary-color)',
                                                        color: '#fff',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {g.nome}
                                                </span>
                                            ))
                                        )}
                                        {activeGroups.length > 3 && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>+{activeGroups.length - 3}</span>
                                        )}
                                    </div>

                                    {/* Ação */}
                                    <div style={{ flexShrink: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setSelectedUserDetails(user)}
                                            style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
                                        >
                                            Detalhes
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            disabled={passwordResetting}
                                            onClick={() => handleResetTemporaryPassword(user.id)}
                                            style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
                                        >
                                            <RotateCcw size={13} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
                                            {passwordResetting ? 'Redefinindo...' : 'Nova senha'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setUserToDelete(user.id)}
                                            style={{ fontSize: '0.82rem', padding: '0.4rem', color: 'var(--danger-text)', borderColor: 'transparent', background: 'transparent' }}
                                            title="Remover acesso"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && !error && totalUsers > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>
                            Página {currentPage + 1} de {totalPages}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={currentPage === 0 || loading}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={currentPage >= totalPages - 1 || loading}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </section>
            <ConfirmDialog
                isOpen={!!userToDelete}
                title="Remover Acesso"
                message={
                    <>
                        <p>Tem certeza que deseja remover o acesso deste usuário?</p>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted-text)' }}>
                            Isso apagará o usuário do sistema de login. As participações no histórico serão mantidas.
                        </p>
                    </>
                }
                onConfirm={handleDeleteUser}
                onCancel={() => setUserToDelete(null)}
                confirmText={isDeleting ? 'Removendo...' : 'Sim, Remover Acesso'}
                cancelText="Cancelar"
            />
            {selectedUserDetails && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        background: 'rgba(15, 23, 42, 0.45)',
                    }}
                    onClick={() => setSelectedUserDetails(null)}
                >
                    <aside
                        className="card"
                        style={{
                            width: 'min(460px, 100%)',
                            height: '100%',
                            borderRadius: 0,
                            padding: '1.5rem',
                            overflowY: 'auto',
                            boxShadow: 'var(--shadow-xl)',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{selectedUserDetails.nome || 'Usuário sem pessoa vinculada'}</h2>
                                <p style={{ margin: '0.25rem 0 0', color: 'var(--muted-text)', fontSize: '0.9rem' }}>{selectedUserDetails.email}</p>
                            </div>
                            <button className="btn-secondary" type="button" onClick={() => setSelectedUserDetails(null)} style={{ padding: '0.35rem' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <section style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--surface-1)' }}>
                                <strong>Status da conta</strong>
                                <p style={{ margin: '0.35rem 0 0', color: selectedUserDetails.temporary_password ? 'var(--warning-color)' : 'var(--success-color)', fontWeight: 700 }}>
                                    {selectedUserDetails.temporary_password ? 'Primeiro acesso pendente' : 'Primeiro acesso concluído'}
                                </p>
                                <small style={{ color: 'var(--muted-text)' }}>
                                    Criado em {new Date(selectedUserDetails.created_at).toLocaleDateString('pt-BR')}
                                </small>
                            </section>

                            <section style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--surface-1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                    <strong>Perfis no contexto atual</strong>
                                    {updatingRoleById[selectedUserDetails.id] && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-text)' }}>Atualizando...</span>
                                    )}
                                </div>
                                <p style={{ margin: '0.25rem 0 0', color: 'var(--muted-text)', fontSize: '0.8rem' }}>
                                    Clique nos perfis para conceder ou revogar acesso no contexto selecionado.
                                </p>
                                <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    {grupos.map(g => {
                                        const active = selectedUserDetails.grupos?.some(v => v.grupo_id === g.id && v.encontro_id === targetEncontroId);
                                        return (
                                            <button
                                                key={g.id}
                                                type="button"
                                                disabled={!!updatingRoleById[selectedUserDetails.id]}
                                                onClick={() => handleToggleGroups(selectedUserDetails.id, g.id, selectedUserDetails.grupos || [])}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '1rem',
                                                    width: '100%',
                                                    padding: '0.65rem 0.75rem',
                                                    borderRadius: '10px',
                                                    border: `1px solid ${active ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                    background: active ? 'var(--primary-color)' : 'var(--card-bg)',
                                                    color: active ? '#fff' : 'var(--text-color)',
                                                    cursor: 'pointer',
                                                    fontWeight: 700,
                                                    textAlign: 'left',
                                                }}
                                            >
                                                <span>{g.nome}</span>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{active ? 'Ativo' : 'Inativo'}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--surface-1)' }}>
                                <strong>Ações de conta</strong>
                                <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        disabled={!!resettingPasswordById[selectedUserDetails.id]}
                                        onClick={() => handleResetTemporaryPassword(selectedUserDetails.id)}
                                        style={{ justifyContent: 'center' }}
                                    >
                                        <RotateCcw size={14} style={{ marginRight: '0.35rem' }} />
                                        {resettingPasswordById[selectedUserDetails.id] ? 'Redefinindo...' : 'Gerar nova senha temporária'}
                                    </button>
                                    {tempPasswords[selectedUserDetails.id] && (
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={() => { navigator.clipboard.writeText(tempPasswords[selectedUserDetails.id]); toast.success('Senha copiada!'); }}
                                            style={{ justifyContent: 'center' }}
                                        >
                                            Copiar senha temporária
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => {
                                            setUserToDelete(selectedUserDetails.id);
                                            setSelectedUserDetails(null);
                                        }}
                                        style={{ justifyContent: 'center', color: 'var(--danger-text)' }}
                                    >
                                        <Trash2 size={14} style={{ marginRight: '0.35rem' }} />
                                        Remover acesso
                                    </button>
                                </div>
                            </section>

                            <section style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--surface-1)' }}>
                                <strong>Participações encontradas</strong>
                                <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
                                    {(selectedUserDetails.encontrosIds || []).length === 0 && (
                                        <span style={{ color: 'var(--muted-text)', fontSize: '0.85rem' }}>Nenhuma participação vinculada à pessoa.</span>
                                    )}
                                    {(selectedUserDetails.encontrosIds || []).map(encontroId => {
                                        const encontro = encontros.find(e => e.id === encontroId);
                                        const equipe = selectedUserDetails.equipesNomes?.[encontroId] || 'Sem equipe';
                                        return (
                                            <div key={encontroId} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                                                <div style={{ fontWeight: 700 }}>{encontro?.nome || encontroId}</div>
                                                <div style={{ color: 'var(--muted-text)', fontSize: '0.82rem' }}>{equipe}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}
