import type { SyntheticEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, RotateCcw, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { FormRow } from '../../components/ui/FormRow';
import { supabase } from '../../lib/supabase';
import { adminUserService } from '../../services/adminUserService';
import { pessoaService } from '../../services/pessoaService';
import type { Pessoa } from '../../types/pessoa';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { useDebounce } from '../../hooks/useDebounce';
import type { InscricaoEnriched } from '../../types/inscricao';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportConfigService, type ExportConfig } from '../../services/exportConfigService';

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
    const [selectedGruposIds, setSelectedGruposIds] = useState<string[]>([]);
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
    const [bulkGruposIds, setBulkGruposIds] = useState<string[]>([]);
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

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminUserService.listUsers();

            // Buscar vínculo de Pessoas para obter Nome e Encontros
            const { data: pessoasData } = await supabase
                .from('pessoas')
                .select('email, nome_completo, participacoes(encontro_id, equipes(nome))');

            const pessoasMap = new Map<string, { nome: string, encontrosIds: string[], equipesNomes: Record<string, string> }>();
            if (pessoasData) {
                for (const p of pessoasData) {
                    if (p.email) {
                        const participacoes = (p.participacoes as { encontro_id: string; equipes: { nome: string }[] | { nome: string } | null }[]) || [];
                        const eqNomes: Record<string, string> = {};
                        participacoes.forEach(part => {
                            const equipe = Array.isArray(part.equipes) ? part.equipes[0] : part.equipes;
                            if (part.encontro_id && equipe?.nome) {
                                eqNomes[part.encontro_id] = equipe.nome;
                            }
                        });

                        pessoasMap.set(p.email.toLowerCase(), {
                            nome: p.nome_completo,
                            encontrosIds: participacoes.map(i => i.encontro_id),
                            equipesNomes: eqNomes
                        });
                    }
                }
            }

            const extendedUsers: UserExtended[] = data.map(u => {
                const pInfo = pessoasMap.get(u.email.toLowerCase());
                return {
                    ...u,
                    nome: pInfo?.nome,
                    encontrosIds: pInfo?.encontrosIds || [],
                    equipesNomes: pInfo?.equipesNomes || {}
                };
            });

            setUsers(extendedUsers);

            const gruposData = await adminUserService.listGrupos();
            setGrupos(gruposData);
            if (gruposData.length > 0) {
                // Seleciona o Viwer/padrão por default ou vazio 
                const defaultGroup = gruposData.find(g => g.nome.includes('Visua'));
                const defaultId = defaultGroup ? defaultGroup.id : gruposData[0]?.id;
                if (defaultId) {
                    setSelectedGruposIds([defaultId]);
                    setBulkGruposIds([defaultId]);
                }
            }

            const encontrosData = await encontroService.listar();
            setEncontros(encontrosData);

            try {
                const configs = await exportConfigService.listarTodas();
                setExportConfigs(configs);
                if (configs.length > 0) setSelectedExportConfigId(configs[0].id);
            } catch (e) {
                console.warn('Could not load export configs', e);
            }

            const active = encontrosData.find(e => e.ativo);
            if (active) {
                setSelectedEncontroId(active.id);
                if (targetEncontroId === null) setTargetEncontroId(active.id); // Init
            }
            else if (encontrosData.length > 0) {
                setSelectedEncontroId(encontrosData[0].id);
                if (targetEncontroId === null) setTargetEncontroId(encontrosData[0].id);
            }

        } catch (err: unknown) {
            console.error('Falha em loadUsers', err);
            setError(`Erro ao carregar (Veja console): ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }, [targetEncontroId]);

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
            const result = await adminUserService.createUser({ email, gruposIds: selectedGruposIds, encontroId: targetEncontroId });
            setUsers((prev) => [...prev, result.user]);
            setTempPasswords((prev) => ({ ...prev, [result.user.id]: result.temporaryPassword }));
            toast.success('Usuário criado com senha temporária.');
            handleClearSelection();
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

    const sortedUsers = useMemo(
        () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
        [users]
    );

    const filteredUsers = useMemo(() => {
        return sortedUsers.filter(user => {
            if (filterGrupoId !== 'all' && !(user.grupos || []).some(v => v.grupo_id === filterGrupoId)) return false;
            if (filterEncontroId !== 'all' && !(user.encontrosIds || []).includes(filterEncontroId)) return false;
            if (filterTempPassword !== 'all') {
                const wantsTemp = filterTempPassword === 'sim';
                if (user.temporary_password !== wantsTemp) return false;
            }
            if (debouncedSearchTerm) {
                const term = debouncedSearchTerm.toLowerCase().trim();
                const matchEmail = user.email.toLowerCase().includes(term);
                const matchName = user.nome?.toLowerCase().includes(term);
                const matchEquipe = Object.values(user.equipesNomes || {}).some(name => name.toLowerCase().includes(term));
                if (!matchEmail && !matchName && !matchEquipe) return false;
            }
            return true;
        });
    }, [sortedUsers, filterGrupoId, filterEncontroId, filterTempPassword, debouncedSearchTerm]);

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
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-1)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-color)' }}>Gerenciando contexto:</label>
                    <select
                        className="form-input"
                        style={{ padding: '0.2rem 2rem 0.2rem 0.5rem', height: '32px', minWidth: '220px', fontWeight: 600, color: targetEncontroId === null ? 'var(--danger-text)' : 'inherit' }}
                        value={targetEncontroId === null ? 'global' : (targetEncontroId || '')}
                        onChange={e => setTargetEncontroId(e.target.value === 'global' ? null : e.target.value)}
                    >
                        <option value="global" style={{ color: 'var(--danger-text)' }}>🌍 Escopo Global (Permamente)</option>
                        {encontros.map(e => (
                            <option key={e.id} value={e.id}>{e.nome || e.edicao || e.tema} {e.ativo ? '⭐ (Atual Ativo)' : ''}</option>
                        ))}
                    </select>
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

                            {/* Grupos select */}
                            <div className="form-group col-12" style={{ marginTop: '0.5rem' }}>
                                <label className="form-label">Grupos de Acesso</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {grupos.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedGruposIds(prev =>
                                                    prev.includes(g.id)
                                                        ? prev.filter(x => x !== g.id)
                                                        : [...prev, g.id]
                                                );
                                            }}
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
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                                            <label className="form-label" style={{ margin: 0 }}>Grupos padrōes:</label>
                                            {grupos.map((g) => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setBulkGruposIds(prev =>
                                                            prev.includes(g.id)
                                                                ? prev.filter(x => x !== g.id)
                                                                : [...prev, g.id]
                                                        );
                                                    }}
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
                                                <div style={{ fontSize: '0.8rem', textAlign: 'right', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                                                    {!hasEmail && <span style={{ color: 'var(--danger-text)' }}>Falta e-mail</span>}
                                                    {existingUser && <span style={{ color: 'var(--success-text)' }}>Já cadastrado</span>}
                                                    {result && (
                                                        <span style={{ color: result.success ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 600 }}>
                                                            {result.success ? '✓ Criado' : `✗ ${result.message}`}
                                                        </span>
                                                    )}
                                                    
                                                    {/* Confirmation Status */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

                {/* Area de Filtros */}
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-1)', borderRadius: '8px 8px 0 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Consultar por Nome / E-mail</label>
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
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Filtrar por Grupo Base</label>
                            <select className="form-input" value={filterGrupoId} onChange={e => setFilterGrupoId(e.target.value)}>
                                <option value="all">Todas as Pastas/Grupos</option>
                                {grupos.map(g => (
                                    <option key={g.id} value={g.id}>{g.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Filtrar por Edição Cadastrada</label>
                            <select className="form-input" value={filterEncontroId} onChange={e => setFilterEncontroId(e.target.value)}>
                                <option value="all">Qualquer Edição (Todos)</option>
                                {encontros.map(enc => (
                                    <option key={enc.id} value={enc.id}>{enc.edicao} - {enc.tema}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--muted-text)' }}>Status da Conta</label>
                            <select className="form-input" value={filterTempPassword} onChange={e => setFilterTempPassword(e.target.value as 'all' | 'sim' | 'nao')}>
                                <option value="all">Sem distinção</option>
                                <option value="sim">Somente com Senha Temporária</option>
                                <option value="nao">Usuários com Senha Própria</option>
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
                    </div>
                </div>

                {!loading && !error && (
                    <div className="admin-users-table-wrapper" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                        <table className="admin-users-table">
                            <thead>
                                <tr>
                                    <th>Nome / E-mail</th>
                                    <th>Grupos de Acesso</th>
                                    <th>Senha temporária</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => {
                                    const tempPassword = tempPasswords[user.id];
                                    const roleUpdating = !!updatingRoleById[user.id];
                                    const passwordResetting = !!resettingPasswordById[user.id];

                                    return (
                                        <tr key={user.id}>
                                            <td>
                                                <div style={{ fontWeight: 500 }}>{user.nome || <span className="text-muted" style={{ fontStyle: 'italic' }}>Sem registro de pessoa</span>}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--muted-text)' }}>{user.email}</div>
                                                {tempPassword && (
                                                    <code className="admin-temp-password">Senha temporária: {tempPassword}</code>
                                                )}
                                                {user.temporary_password && !tempPassword && (
                                                    <span style={{ fontSize: '0.7rem', background: 'var(--warning-color)', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.2rem' }}>
                                                        Senha Pendente
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxWidth: '280px' }}>
                                                    {grupos.map(g => {
                                                        const isSelected = user.grupos?.some(v => v.grupo_id === g.id && v.encontro_id === targetEncontroId);
                                                        return (
                                                            <button
                                                                key={g.id}
                                                                type="button"
                                                                disabled={roleUpdating || targetEncontroId === undefined}
                                                                onClick={() => handleToggleGroups(user.id, g.id, user.grupos || [])}
                                                                title={isSelected ? 'Clique para remover' : 'Clique para adicionar'}
                                                                style={{
                                                                    padding: '0.2rem 0.5rem',
                                                                    fontSize: '0.75rem',
                                                                    borderRadius: '4px',
                                                                    border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                                    background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                                    color: isSelected ? 'var(--primary-color)' : 'var(--muted-text)',
                                                                    cursor: roleUpdating ? 'not-allowed' : 'pointer',
                                                                    transition: 'all 0.2s',
                                                                    opacity: roleUpdating ? 0.6 : 1
                                                                }}
                                                            >
                                                                {g.nome}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
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
