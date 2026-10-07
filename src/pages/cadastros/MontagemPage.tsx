import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Plus, Trash2, Loader, Check, X, UserPlus, History, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { HistoricoModal } from '../../components/pessoa/HistoricoModal';
import { inscricaoService } from '../../services/inscricaoService';
import type { InscricaoEnriched } from '../../types/inscricao';
import { pessoaService } from '../../services/pessoaService';
import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../hooks/useEquipes';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import { pesquisaEncontristaService } from '../../services/pesquisaEncontristaService';
import type { PesquisaEncontristaDetalhe, PesquisaEncontristaPreferenciasEncontro } from '../../types/pesquisaEncontrista';
import { findPreviousEncounter } from '../../utils/encontroPrevious';
import './MontagemPage.css';

interface StagedMembro {
    pessoa_id: string;
    equipe_id: string;
    nome_completo: string;
    cpf: string | null;
    coordenador: boolean;
    preferenciaOrigem?: {
        encontroNome: string;
        ordemPreferencia: number;
    };
}

type PessoaSearchResult = Pessoa & {
    infoEquipe?: { id: string | null; nome: string };
    noStaging: boolean;
};

type PreferenciaEquipeEncontrista = {
    encontrista: PesquisaEncontristaDetalhe;
    preferencia: PesquisaEncontristaDetalhe['preferencias'][number];
};

export function MontagemPage() {
    const navigate = useNavigate();
    const { encontros, encontroSelecionadoId: selectedEncontroId } = useEncontros();
    const { equipes } = useEquipes();

    // States
    const [inscricoes, setInscricoes] = useState<InscricaoEnriched[]>([]); // Membros persistidos
    const [searchResults, setSearchResults] = useState<PessoaSearchResult[]>([]); // Para busca

    const [selectedEquipeId, setSelectedEquipeId] = useState<string>('');

    // UI States
    const [searchPessoa, setSearchPessoa] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [showQuickAddPerson, setShowQuickAddPerson] = useState(false);
    const [staging, setStaging] = useState<StagedMembro[]>([]); // Novos para salvar

    const isFetching = !encontros.length;
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingPerson, setIsSavingPerson] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<InscricaoEnriched | null>(null);
    const [historyTarget, setHistoryTarget] = useState<Pessoa | null>(null);
    const [expandedEquipeId, setExpandedEquipeId] = useState<string | null>(null);
    const [preferenciasAnteriores, setPreferenciasAnteriores] = useState<PesquisaEncontristaPreferenciasEncontro | null>(null);
    const [isLoadingPreferencias, setIsLoadingPreferencias] = useState(false);
    const [preferenciasError, setPreferenciasError] = useState(false);
    const [preferenciaEquipeId, setPreferenciaEquipeId] = useState<string | null>(null);

    const encontroAnterior = useMemo(
        () => findPreviousEncounter(encontros, selectedEncontroId),
        [encontros, selectedEncontroId]
    );

    // Efeito para rolar até a equipe expandida
    useEffect(() => {
        if (expandedEquipeId) {
            const element = document.getElementById(`equipe-card-${expandedEquipeId}`);
            if (element) {
                // Delay curto para sincronizar com a animação do framer-motion
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }, [expandedEquipeId]);

    // Load memberships when Encontro changes (versão leve para montagem)
    const loadInscricoes = useCallback(async () => {
        if (!selectedEncontroId) return;
        try {
            const data = await inscricaoService.listarResumoPorEncontro(selectedEncontroId);
            setInscricoes(data);
            setStaging([]); // Limpa rascunho ao mudar encontro
        } catch {
            toast.error('Erro ao carregar membros.');
        }
    }, [selectedEncontroId]);

    useEffect(() => { loadInscricoes(); }, [loadInscricoes]);

    useEffect(() => {
        setPreferenciaEquipeId(null);
        if (!encontroAnterior) {
            setPreferenciasAnteriores(null);
            setPreferenciasError(false);
            return;
        }

        let active = true;
        setIsLoadingPreferencias(true);
        setPreferenciasError(false);
        setPreferenciasAnteriores(null);
        pesquisaEncontristaService.listarPreferenciasPorEncontrista(encontroAnterior.id)
            .then((data) => {
                if (active) setPreferenciasAnteriores(data);
            })
            .catch((error) => {
                console.error('Erro ao carregar preferências do encontro anterior:', error);
                if (active) {
                    setPreferenciasAnteriores(null);
                    setPreferenciasError(true);
                }
            })
            .finally(() => {
                if (active) setIsLoadingPreferencias(false);
            });

        return () => { active = false; };
    }, [encontroAnterior]);

    const preferenciasPorEquipe = useMemo(() => {
        const result = new Map<string, PreferenciaEquipeEncontrista[]>();
        (preferenciasAnteriores?.encontristas ?? []).forEach((encontrista) => {
            encontrista.preferencias.forEach((preferencia) => {
                if (!preferencia.equipeDisponivel) return;
                const current = result.get(preferencia.equipeId) ?? [];
                current.push({ encontrista, preferencia });
                result.set(preferencia.equipeId, current);
            });
        });
        result.forEach((items) => {
            items.sort((a, b) => a.preferencia.ordemPreferencia - b.preferencia.ordemPreferencia
                || a.encontrista.nome.localeCompare(b.encontrista.nome, 'pt-BR'));
        });
        return result;
    }, [preferenciasAnteriores]);

    const preferenciaEquipe = equipes.find((equipe) => equipe.id === preferenciaEquipeId) ?? null;
    const preferenciasSelecionadas = preferenciaEquipeId ? preferenciasPorEquipe.get(preferenciaEquipeId) ?? [] : [];

    const equipeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        inscricoes.forEach(i => {
            if (i.equipe_id) {
                counts[i.equipe_id] = (counts[i.equipe_id] || 0) + 1;
            }
        });
        const countsWithoutStaging = { ...counts };
        staging.forEach((item) => {
            counts[item.equipe_id] = (counts[item.equipe_id] || 0) + 1;
        });
        return { withStaging: counts, withoutStaging: countsWithoutStaging };
    }, [inscricoes, staging]);

    // Busca de pessoas (debounced)
    useEffect(() => {
        if (searchPessoa.length < 2) {
            setSearchResults([]);
            return;
        }

        const handler = setTimeout(async () => {
            setIsSearching(true);
            try {
                const { data } = await pessoaService.buscarComPaginacao(searchPessoa, 1, 20);

                // Mapear quem já está no encontro para saber a equipe (ID e Nome)
                const inscricoesMap = new Map(inscricoes.map(i => [i.pessoa_id, { id: i.equipe_id, nome: i.equipes?.nome || 'Outra equipe' }]));
                const jaNoStagingIds = new Set(staging.map(s => s.pessoa_id));

                const enrichedResults = data.map(p => ({
                    ...p,
                    infoEquipe: inscricoesMap.get(p.id),
                    noStaging: jaNoStagingIds.has(p.id)
                }));

                setSearchResults(enrichedResults);
            } catch (error) {
                console.error("Erro na busca:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [searchPessoa, inscricoes, staging]);

    // Handlers
    const addToStaging = (p: Pessoa) => {
        if (!selectedEquipeId) return;
        setStaging(prev => [...prev, {
            pessoa_id: p.id,
            equipe_id: selectedEquipeId,
            nome_completo: p.nome_completo,
            cpf: p.cpf,
            coordenador: false
        }]);
        setSearchPessoa('');
        setShowSearchResults(false);
    };

    const removeFromStaging = (pessoa_id: string) => {
        setStaging(prev => prev.filter(s => s.pessoa_id !== pessoa_id));
    };

    const addPreferenceToStaging = (
        encontrista: PesquisaEncontristaDetalhe,
        equipeId: string,
        ordemPreferencia: number,
    ) => {
        const existing = inscricoes.find((item) => item.pessoa_id === encontrista.pessoaId);
        if (existing) {
            toast.error(existing.equipes?.nome
                ? `Esta pessoa já está vinculada a ${existing.equipes.nome} neste encontro.`
                : 'Esta pessoa já está vinculada ao encontro atual.');
            return;
        }
        if (staging.some((item) => item.pessoa_id === encontrista.pessoaId)) return;

        setSelectedEquipeId(equipeId);
        setStaging((current) => [...current, {
            pessoa_id: encontrista.pessoaId,
            equipe_id: equipeId,
            nome_completo: encontrista.nome,
            cpf: null,
            coordenador: false,
            preferenciaOrigem: {
                encontroNome: preferenciasAnteriores?.encontro.nome ?? encontroAnterior?.nome ?? 'Encontro anterior',
                ordemPreferencia,
            },
        }]);
    };

    const handleQuickAddPerson = async (formData: PessoaFormData, _shouldConfirm: boolean) => {
        setIsSavingPerson(true);
        try {
            const newPerson = await pessoaService.criar(formData);
            // Adiciona direto ao staging
            addToStaging(newPerson);
            setShowQuickAddPerson(false);
            toast.success('Pessoa cadastrada e adicionada com sucesso!');
        } catch {
            toast.error('Erro ao cadastrar pessoa.');
        } finally {
            setIsSavingPerson(false);
        }
    };

    const handleSaveStaging = async () => {
        if (staging.length === 0) return;
        setIsLoading(true);
        try {
            // Re-validação final: verificar se alguém do staging foi adicionado por outro usuário recentemente
            const updatedInscricoes = await inscricaoService.listarPorEncontro(selectedEncontroId);
            const jaCadastradosIds = new Set(updatedInscricoes.map(i => i.pessoa_id));

            const validStaging = staging.filter(s => !jaCadastradosIds.has(s.pessoa_id));

            if (validStaging.length !== staging.length) {
                toast.error('Alguns membros já foram vinculados a outras equipes. O rascunho será atualizado.');
                setInscricoes(updatedInscricoes);
                setStaging(validStaging);
                setIsLoading(false);
                return;
            }

            const payload = staging.map(s => ({
                encontro_id: selectedEncontroId,
                equipe_id: s.equipe_id,
                pessoa_id: s.pessoa_id,
                coordenador: s.coordenador,
                participante: false,
                dados_confirmados: false,
                confirmado_em: null,
                pago_taxa: false
            }));
            await inscricaoService.criarMuitos(payload);
            await loadInscricoes();
            toast.success('Membros salvos com sucesso!');
        } catch {
            toast.error('Erro ao salvar novos membros. Verifique se já não estão vinculados.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleCoord = async (membro: InscricaoEnriched) => {
        try {
            await inscricaoService.atualizar(membro.id, { coordenador: !membro.coordenador });
            setInscricoes(prev => prev.map(i => i.id === membro.id ? { ...i, coordenador: !i.coordenador } : i));
            toast.success('Cargo atualizado com sucesso!');
        } catch {
            toast.error('Erro ao atualizar cargo.');
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsLoading(true);
        try {
            await inscricaoService.desvincularDoEncontro(deleteTarget.id);
            setInscricoes(prev => prev.filter(i => i.id !== deleteTarget.id));
            setDeleteTarget(null);
            toast.success('Membro removido com sucesso!');
        } catch {
            toast.error('Erro ao remover membro.');
        } finally {
            setIsLoading(false);
        }
    };

    // Fechar resultados ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.search-container-custom')) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando dados...</div>;

    return (
        <div className="container montagem-container" style={{ paddingBottom: '2rem' }}>
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/cadastros')} className="icon-btn" title="Voltar"><ChevronLeft size={18} /></button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Montagem de Equipes</h1>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Selecione o encontro e gerencie as equipes abaixo</p>
                    </div>
                </div>

            </div>

            <motion.div
                style={{ display: 'grid', gap: '1rem' }}
                initial="hidden"
                animate="visible"
                variants={{
                    visible: { transition: { staggerChildren: 0.05 } }
                }}
            >
                {equipes.map(eq => {
                    const isExpanded = expandedEquipeId === eq.id;
                    const count = equipeCounts.withStaging[eq.id] || 0;
                    const preferenciasDaEquipe = preferenciasPorEquipe.get(eq.id) ?? [];

                    // Membros filtrados para esta equipe
                    const membrosDaEquipe = isExpanded ? inscricoes
                        .filter(i => i.equipe_id === eq.id)
                        .sort((a, b) => {
                            if (a.coordenador && !b.coordenador) return -1;
                            if (!a.coordenador && b.coordenador) return 1;
                            const nomeA = a.pessoas?.nome_completo || '';
                            const nomeB = b.pessoas?.nome_completo || '';
                            return nomeA.localeCompare(nomeB);
                        }) : [];

                    return (
                        <motion.article
                            key={eq.id}
                            id={`equipe-card-${eq.id}`}
                            layout
                            className="card"
                            style={{
                                padding: 0,
                                marginBottom: '1rem',
                                overflow: 'visible',
                                border: isExpanded ? '1px solid rgba(255,255,255,0.05)' : '1px solid var(--border-color)',
                                scrollMarginTop: '180px'
                            }}
                        >
                            {/* Header da Equipe - Sticky Wrapper */}
                            <div style={{
                                position: 'sticky',
                                top: '65px',
                                zIndex: 30,
                                padding: '0 1px',
                                background: isExpanded ? 'var(--bg-color)' : 'transparent',
                                borderRadius: isExpanded ? '12px 12px 0 0' : '0',
                                transition: 'all 0.2s'
                            }}>
                                {/* Espaço para o gap */}
                                {isExpanded && <div style={{ height: '15px' }} />}

                                <div
                                    onClick={() => {
                                        if (isExpanded) {
                                            setExpandedEquipeId(null);
                                        } else {
                                            setExpandedEquipeId(eq.id);
                                            setSelectedEquipeId(eq.id);
                                            setSearchPessoa('');
                                            setShowSearchResults(false);
                                        }
                                    }}
                                    style={{
                                        padding: '1.25rem 1.5rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: isExpanded ? 'transparent' : 'var(--secondary-bg)',
                                        borderBottom: 'none',
                                        borderRadius: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: isExpanded ? 'var(--primary-color)' : 'var(--text-color)' }}>
                                                {eq.nome}
                                            </h3>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                                                    {count} membros
                                                </span>
                                            </div>
                                        </div>

                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--muted-text)' }}>
                                        {/* Botão de Salvar no Header (lado do chevron) */}
                                        {staging.length > 0 && isExpanded && (
                                            <motion.button
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSaveStaging();
                                                }}
                                                className="btn-primary"
                                                disabled={isLoading}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    fontSize: '0.85rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.3)',
                                                    marginRight: '0.5rem'
                                                }}
                                            >
                                                {isLoading ? (
                                                    <span className="spinner-border spinner-border-sm" />
                                                ) : (
                                                    <Save size={16} />
                                                )}
                                                Confirmar alterações ({staging.length})
                                            </motion.button>
                                        )}
                                        {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                    </div>
                                </div>
                            </div>

                            {/* Conteúdo Expandido */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <div style={{
                                            padding: '1.5rem',
                                            background: 'var(--bg-color)',
                                            borderRadius: '0 0 12px 12px'
                                        }}>

                                            {/* Busca dentro da Equipe */}
                                            <div className="search-container-custom" style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                                <div className="search-bar" style={{ marginBottom: 0, background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
                                                    <Search size={18} style={{ opacity: 0.5 }} />
                                                    <input
                                                        className="search-input"
                                                        placeholder={`Adicionar pessoa em ${eq.nome}...`}
                                                        value={searchPessoa}
                                                        onChange={e => { setSearchPessoa(e.target.value); setShowSearchResults(true); }}
                                                        onFocus={() => setShowSearchResults(true)}
                                                    />
                                                    {searchPessoa && (
                                                        <button
                                                            onClick={() => { setSearchPessoa(''); setShowSearchResults(false); }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--muted-text)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    )}
                                                </div>

                                                {showSearchResults && searchPessoa.length >= 2 && (
                                                    <div className="card shadow" style={{
                                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                                        marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto', padding: 0
                                                    }}>
                                                        {isSearching ? (
                                                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                                                <Loader size={24} className="animate-spin" style={{ margin: '0 auto', opacity: 0.3 }} />
                                                            </div>
                                                        ) : searchResults.length === 0 ? (
                                                            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                                                                <p style={{ opacity: 0.5, marginBottom: '1rem', fontSize: '0.9rem' }}>Ninguém encontrado</p>
                                                                <button onClick={() => { setShowQuickAddPerson(true); setShowSearchResults(false); }} className="btn-secondary" style={{ width: '100%' }}>
                                                                    <UserPlus size={16} style={{ marginRight: '0.5rem' }} /> Cadastrar Novo
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {searchResults.map(p => {
                                                                    const info = p.infoEquipe;
                                                                    const isInCurrentTeam = info?.id === eq.id;
                                                                    const isInOtherTeam = info && info.id !== eq.id;
                                                                    const noStaging = p.noStaging;
                                                                    const isDisabled = isInOtherTeam || noStaging;

                                                                    const handleClickSearchRow = () => {
                                                                        if (isInCurrentTeam) {
                                                                            const membro = inscricoes.find(i => i.pessoa_id === p.id && i.equipe_id === eq.id);
                                                                            if (membro) setDeleteTarget(membro);
                                                                        } else if (!isDisabled) {
                                                                            addToStaging(p);
                                                                        }
                                                                    };

                                                                    return (
                                                                        <div
                                                                            key={p.id}
                                                                            onClick={handleClickSearchRow}
                                                                            style={{
                                                                                padding: '0.75rem 1rem',
                                                                                borderBottom: '1px solid var(--border-color)',
                                                                                cursor: (isDisabled && !isInCurrentTeam) ? 'not-allowed' : 'pointer',
                                                                                opacity: (isDisabled && !isInCurrentTeam) ? 0.6 : 1,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                background: isInCurrentTeam ? 'rgba(239, 68, 68, 0.05)' : (isDisabled ? 'var(--secondary-bg)' : 'transparent')
                                                                            }}
                                                                        >
                                                                            <div>
                                                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isInCurrentTeam ? '#ef4444' : 'inherit' }}>{p.nome_completo}</div>
                                                                                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                                                                                    {isInCurrentTeam ? 'Já está nesta equipe (Clique para remover)' : (isInOtherTeam ? `Já em: ${info.nome}` : (noStaging ? 'No rascunho' : `CPF: ${p.cpf || 'Não inf.'}`))}
                                                                                </div>
                                                                            </div>
                                                                            {isInCurrentTeam ? (
                                                                                <Trash2 size={16} color="#ef4444" />
                                                                            ) : (
                                                                                !isDisabled ? <Plus size={16} color="var(--primary-color)" /> : <Check size={16} color={noStaging ? "var(--warning-color)" : "var(--success-border)"} />
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div style={{ padding: '0.75rem', background: 'var(--surface-2)', textAlign: 'center' }}>
                                                                    <button onClick={() => { setShowQuickAddPerson(true); setShowSearchResults(false); }} className="btn-text" style={{ fontSize: '0.8rem' }}>
                                                                        <Plus size={14} /> Não encontrou? Cadastre aqui
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {encontroAnterior && (
                                                <section className="montagem-preference-summary" aria-live="polite">
                                                    <div>
                                                        {isLoadingPreferencias ? (
                                                            <small><Loader size={14} className="animate-spin" /> Carregando...</small>
                                                        ) : preferenciasError ? (
                                                            <small className="is-error">Preferências indisponíveis</small>
                                                        ) : (
                                                            <>
                                                                <strong>{preferenciasDaEquipe.length} encontrista{preferenciasDaEquipe.length === 1 ? '' : 's'} optaram por esta equipe no pós-encontro</strong>
                                                                <span>
                                                                    Encontro de origem: {encontroAnterior.edicao ? `${encontroAnterior.edicao}º EJC · ` : ''}{encontroAnterior.nome}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        disabled={isLoadingPreferencias || preferenciasError}
                                                        onClick={() => setPreferenciaEquipeId(eq.id)}
                                                    >
                                                        Ver encontristas
                                                    </button>
                                                </section>
                                            )}

                                            {/* Listagem de Membros */}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
                                                {/* Membros em Staging */}
                                                {staging.filter((item) => item.equipe_id === eq.id).map(s => (
                                                    <motion.div
                                                        key={s.pessoa_id}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        style={{
                                                            padding: '1rem',
                                                            background: 'rgba(245, 158, 11, 0.05)',
                                                            border: '1px solid #f59e0b',
                                                            borderRadius: '12px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.75rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.nome_completo}</div>
                                                                <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>RASCUNHO</span>
                                                                {s.preferenciaOrigem && (
                                                                    <small className="montagem-staged-preference">
                                                                        {s.preferenciaOrigem.ordemPreferencia}ª opção no {s.preferenciaOrigem.encontroNome}
                                                                    </small>
                                                                )}
                                                            </div>
                                                            <button
                                                                className="btn-secondary danger"
                                                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                                onClick={() => removeFromStaging(s.pessoa_id)}
                                                            >
                                                                <Trash2 size={14} /> Remover
                                                            </button>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            <div style={{ display: 'flex', background: 'var(--bg-color)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setStaging(prev => prev.map(item => item.pessoa_id === s.pessoa_id ? { ...item, coordenador: true } : item))}
                                                                    style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', border: 'none', backgroundColor: s.coordenador ? 'var(--success-border)' : 'transparent', color: s.coordenador ? '#fff' : 'var(--muted-text)', cursor: 'pointer', transition: '0.2s' }}
                                                                >
                                                                    Coordenador
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setStaging(prev => prev.map(item => item.pessoa_id === s.pessoa_id ? { ...item, coordenador: false } : item))}
                                                                    style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', border: 'none', backgroundColor: !s.coordenador ? 'var(--primary-color)' : 'transparent', color: !s.coordenador ? '#fff' : 'var(--muted-text)', cursor: 'pointer', transition: '0.2s' }}
                                                                >
                                                                    Membro
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}

                                                {/* Membros Salvos */}
                                                {membrosDaEquipe.map(m => (
                                                    <motion.div
                                                        key={m.id}
                                                        layout
                                                        style={{
                                                            padding: '1rem',
                                                            background: m.coordenador ? 'rgba(34, 197, 94, 0.05)' : 'var(--surface-1)',
                                                            border: `1px solid ${m.coordenador ? 'var(--success-border)' : 'var(--border-color)'}`,
                                                            borderRadius: '12px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '0.75rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{m.pessoas?.nome_completo}</div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                                                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>CPF: {m.pessoas?.cpf || '---'}</span>
                                                                    <button className="btn-text" style={{ padding: '0.2rem', minHeight: 'auto' }} onClick={() => setHistoryTarget({ ...m.pessoas, id: m.pessoa_id } as Pessoa)}>
                                                                        <History size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <button
                                                                className="btn-secondary danger"
                                                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                                                onClick={() => setDeleteTarget(m)}
                                                            >
                                                                <Trash2 size={14} /> Remover
                                                            </button>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            <div style={{ display: 'flex', background: 'var(--bg-color)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => !m.coordenador && handleToggleCoord(m)}
                                                                    style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', border: 'none', backgroundColor: m.coordenador ? 'var(--success-border)' : 'transparent', color: m.coordenador ? '#fff' : 'var(--muted-text)', cursor: 'pointer', transition: '0.2s' }}
                                                                >
                                                                    Coordenador
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => m.coordenador && handleToggleCoord(m)}
                                                                    style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px', border: 'none', backgroundColor: !m.coordenador ? 'var(--primary-color)' : 'transparent', color: !m.coordenador ? '#fff' : 'var(--muted-text)', cursor: 'pointer', transition: '0.2s' }}
                                                                >
                                                                    Membro
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* Espaço extra no fim */}
                                            <div style={{ height: '1rem' }} />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.article>
                    );
                })}
            </motion.div>

            <Modal
                isOpen={!!preferenciaEquipe}
                onClose={() => setPreferenciaEquipeId(null)}
                title={preferenciaEquipe ? `Interessados em ${preferenciaEquipe.nome}` : 'Preferências de equipe'}
                maxWidth="820px"
            >
                {preferenciaEquipe && encontroAnterior && (
                    <div className="montagem-preference-modal">
                        {!preferenciasSelecionadas.length ? (
                            <div className="montagem-preference-modal__empty">Nenhum encontrista marcou esta equipe.</div>
                        ) : (
                            <div className="montagem-preference-modal__list">
                                {preferenciasSelecionadas.map(({ encontrista, preferencia }) => {
                                    const currentMembership = inscricoes.find((item) => item.pessoa_id === encontrista.pessoaId);
                                    const stagedMembership = staging.find((item) => item.pessoa_id === encontrista.pessoaId);
                                    const assignedTeamName = currentMembership
                                        ? currentMembership.equipes?.nome ?? equipes.find((item) => item.id === currentMembership.equipe_id)?.nome
                                        : stagedMembership
                                            ? equipes.find((item) => item.id === stagedMembership.equipe_id)?.nome
                                            : null;
                                    const isAssigned = Boolean(currentMembership) || Boolean(stagedMembership);

                                    return (
                                        <article key={encontrista.pessoaId}>
                                            <div className="montagem-preference-modal__person">
                                                <span className={`montagem-preference-order montagem-preference-order--${preferencia.ordemPreferencia}`}>
                                                    {preferencia.ordemPreferencia}ª opção
                                                </span>
                                                <strong>{encontrista.nome}</strong>
                                            </div>
                                            <ol>
                                                {encontrista.preferencias.map((item) => (
                                                    <li key={item.equipeId}>{item.ordemPreferencia}ª {item.equipeNome}</li>
                                                ))}
                                            </ol>
                                            {isAssigned ? (
                                                <span className="montagem-preference-assigned">
                                                    {assignedTeamName
                                                        ? `Já em: ${assignedTeamName}`
                                                        : 'Adicionado em uma equipe'}
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => addPreferenceToStaging(encontrista, preferenciaEquipe.id, preferencia.ordemPreferencia)}
                                                >
                                                    <Plus size={15} />
                                                    Adicionar à equipe
                                                </button>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Remover Membro"
                message={`Deseja remover "${deleteTarget?.pessoas?.nome_completo}" desta equipe?`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                isLoading={isLoading}
                isDestructive={true}
            />

            {/* Modal de Cadastro Rápido */}
            {showQuickAddPerson && (
                <div className="modal-overlay" style={{ padding: '2rem', alignItems: 'flex-start', overflowY: 'auto' }}>
                    <div className="card shadow" style={{ width: '100%', maxWidth: '800px', padding: '2rem', margin: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', position: 'relative', top: 0, background: 'var(--card-bg)', zIndex: 10, paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Cadastrar Encontreiro</h2>
                            <button className="icon-btn" onClick={() => setShowQuickAddPerson(false)}><X size={20} /></button>
                        </div>
                        <PessoaForm
                            onSubmit={handleQuickAddPerson}
                            onCancel={() => setShowQuickAddPerson(false)}
                            isLoading={isSavingPerson}
                        />
                    </div>
                </div>
            )}

            {historyTarget && (
                <HistoricoModal
                    pessoa={historyTarget}
                    isOpen={!!historyTarget}
                    onClose={() => setHistoryTarget(null)}
                />
            )}
        </div>
    );
}
