import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Plus, Shield, Users, Trash2, Loader, Check, X, UserPlus, History } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { PessoaForm } from '../../components/pessoa/PessoaForm';
import { HistoricoModal } from '../../components/pessoa/HistoricoModal';
import { inscricaoService } from '../../services/inscricaoService';
import type { InscricaoEnriched } from '../../types/inscricao';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { pessoaService } from '../../services/pessoaService';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';

interface StagedMembro {
    pessoa_id: string;
    nome_completo: string;
    cpf: string | null;
    coordenador: boolean;
}

export function MontagemPage() {
    const navigate = useNavigate();

    // States
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [equipes, setEquipes] = useState<Equipe[]>([]);
    const [inscricoes, setInscricoes] = useState<InscricaoEnriched[]>([]); // Membros persistidos
    const [searchResults, setSearchResults] = useState<(Pessoa & { equipeAtual?: string, noStaging?: boolean })[]>([]); // Para busca

    const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
    const [selectedEquipeId, setSelectedEquipeId] = useState<string>('');

    // UI States
    const [searchPessoa, setSearchPessoa] = useState('');
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [showQuickAddPerson, setShowQuickAddPerson] = useState(false);
    const [staging, setStaging] = useState<StagedMembro[]>([]); // Novos para salvar

    const [isFetching, setIsFetching] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingPerson, setIsSavingPerson] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<InscricaoEnriched | null>(null);
    const [historyTarget, setHistoryTarget] = useState<Pessoa | null>(null);

    const searchRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        async function loadBaseData() {
            try {
                const [es, eqs] = await Promise.all([
                    encontroService.listar(),
                    equipeService.listar()
                ]);
                setEncontros(es);
                setEquipes(eqs);
                if (es.length > 0) setSelectedEncontroId(es[es.length - 1].id);
            } finally {
                setIsFetching(false);
            }
        }
        loadBaseData();
    }, []);

    // Load memberships when Encontro changes
    const loadInscricoes = useCallback(async () => {
        if (!selectedEncontroId) return;
        setIsFetching(true);
        try {
            const data = await inscricaoService.listarPorEncontro(selectedEncontroId);
            setInscricoes(data);
            setStaging([]); // Limpa rascunho ao mudar encontro
        } finally {
            setIsFetching(false);
        }
    }, [selectedEncontroId]);

    useEffect(() => { loadInscricoes(); }, [loadInscricoes]);

    // Derived Data
    const membrosSalvos = useMemo(() => {
        if (!selectedEquipeId) return [];
        return inscricoes.filter(i => i.equipe_id === selectedEquipeId);
    }, [inscricoes, selectedEquipeId]);

    const equipeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        inscricoes.forEach(i => {
            if (i.equipe_id) {
                counts[i.equipe_id] = (counts[i.equipe_id] || 0) + 1;
            }
        });
        const countsWithoutStaging = { ...counts };
        // Adiciona contagem do staging
        if (selectedEquipeId) { // Only count staging for the currently selected team
            counts[selectedEquipeId] = (counts[selectedEquipeId] || 0) + staging.length;
        }
        return { withStaging: counts, withoutStaging: countsWithoutStaging };
    }, [inscricoes, staging, selectedEquipeId]);

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
                
                // Mapear quem já está no encontro para saber a equipe
                const inscricoesMap = new Map(inscricoes.map(i => [i.pessoa_id, i.equipes?.nome || 'Outra equipe']));
                const jaNoStagingIds = new Set(staging.map(s => s.pessoa_id));

                const enrichedResults = data.map(p => ({
                    ...p,
                    equipeAtual: inscricoesMap.get(p.id),
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
        setStaging(prev => [...prev, {
            pessoa_id: p.id,
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

    const toggleStagingCoord = (pessoa_id: string) => {
        setStaging(prev => prev.map(s => s.pessoa_id === pessoa_id ? { ...s, coordenador: !s.coordenador } : s));
    };

    const handleQuickAddPerson = async (formData: PessoaFormData) => {
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
                equipe_id: selectedEquipeId,
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
            await inscricaoService.excluir(deleteTarget.id);
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
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedEquipe = useMemo(() => equipes.find(e => e.id === selectedEquipeId), [equipes, selectedEquipeId]);

    if (isFetching && encontros.length === 0) return <div className="empty-state">Carregando dados...</div>;

    return (
        <div className="container montagem-container" style={{ paddingBottom: '2rem' }}>
            <style>{`
                .montagem-main-grid {
                    display: grid; 
                    grid-template-columns: 280px 1fr; 
                    gap: 2rem; 
                    margin-top: 1.5rem;
                }

                .mobile-team-selector {
                    display: none;
                    margin-bottom: 1.5rem;
                }

                .team-summary-line {
                    display: none;
                    padding: 0.75rem 1rem;
                    background: var(--secondary-bg);
                    border-radius: 8px;
                    border: 1px solid var(--border-color);
                    margin-bottom: 1rem;
                    font-size: 0.9rem;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                @media (max-width: 1024px) {
                    .montagem-main-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    
                    .desktop-sidebar {
                        display: none;
                    }

                    .mobile-team-selector {
                        display: block;
                    }

                    .team-summary-line {
                        justify-content: center;
                        text-align: center;
                    }

                    .pessoa-row {
                        flex-direction: column;
                        align-items: flex-start !important;
                        gap: 1rem !important;
                        padding: 1rem !important;
                    }

                    .pessoa-row-main {
                        width: 100%;
                    }

                    .pessoa-row > div:last-child {
                        width: 100%;
                        justify-content: space-between;
                        padding-top: 0.5rem;
                        border-top: 1px solid var(--border-color);
                    }
                }
            `}</style>
            <div className="page-header" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button onClick={() => navigate('/cadastros')} className="icon-btn" title="Voltar"><ChevronLeft size={18} /></button>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Equipes por Encontro</p>
                        <div style={{ width: '100%', maxWidth: '300px' }}>
                            <LiveSearchSelect<Encontro>
                                value={selectedEncontroId}
                                onChange={(val) => setSelectedEncontroId(val)}
                                fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                                getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
                                getOptionValue={(e) => String(e.id)}
                                placeholder="Selecione um Encontro..."
                                initialOptions={encontros}
                                className="montagem-header-select"
                            />
                        </div>
                    </div>
                </div>

                {staging.length > 0 && (
                    <button onClick={handleSaveStaging} disabled={isLoading} className="btn-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isLoading ? <Loader size={18} className="animate-spin" /> : <Check size={18} />}
                        Salvar Alterações ({staging.length})
                    </button>
                )}
            </div>

            <div className="montagem-main-grid" style={{ marginTop: '1.5rem' }}>
                {/* Sidebar: Equipes */}
                <aside className="desktop-sidebar">
                    <div className="card" style={{ padding: '0.5rem' }}>
                        <h3 style={{ padding: '1rem', margin: 0, fontSize: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <Shield size={16} style={{ marginRight: '0.5rem' }} /> Equipes
                        </h3>
                        <div style={{ padding: '0.5rem' }}>
                            {equipes.map(eq => (
                                <div
                                    key={eq.id}
                                    onClick={() => { setSelectedEquipeId(eq.id); setStaging([]); setSearchPessoa(''); }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: selectedEquipeId === eq.id ? 'var(--primary-color)' : 'transparent',
                                        color: selectedEquipeId === eq.id ? 'white' : 'inherit',
                                        marginBottom: '0.25rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{eq.nome}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        background: selectedEquipeId === eq.id ? 'rgba(255,255,255,0.2)' : 'var(--secondary-bg)',
                                        padding: '2px 8px',
                                        borderRadius: '10px'
                                    }}>
                                        {equipeCounts.withStaging[eq.id] || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Main: Membros da Equipe */}
                <main>
                    {/* Seletor Mobile */}
                    <div className="mobile-team-selector">
                        <select 
                            className="form-input"
                            value={selectedEquipeId}
                            onChange={(e) => { setSelectedEquipeId(e.target.value); setStaging([]); setSearchPessoa(''); }}
                        >
                            <option value="">Selecione uma equipe...</option>
                            {equipes.map(eq => (
                                <option key={eq.id} value={eq.id}>
                                    {eq.nome} ({equipeCounts.withoutStaging[eq.id] || 0})
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedEquipeId && (
                        <div className="team-summary-line fade-in">
                            <Shield size={16} className="text-primary" />
                            <span>
                                <strong>Equipe:</strong> {selectedEquipe?.nome}
                            </span>
                            <span style={{ opacity: 0.7, fontSize: '0.8rem', marginLeft: 'auto' }}>
                                {equipeCounts.withoutStaging[selectedEquipeId] || 0} membros confirmados
                            </span>
                        </div>
                    )}
                    {!selectedEquipeId ? (
                        <div className="empty-state card">
                            <Shield size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>Selecione uma equipe ao lado para gerenciar.</p>
                        </div>
                    ) : (
                        <div className="fade-in">
                            {/* Busca Integrada */}
                            <div ref={searchRef} style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                <div className="search-bar" style={{ marginBottom: 0 }}>
                                    <Search size={18} style={{ opacity: 0.5 }} />
                                    <input
                                        className="search-input"
                                        placeholder="Pesquisar pessoa para adicionar à equipe..."
                                        value={searchPessoa}
                                        onChange={e => { setSearchPessoa(e.target.value); setShowSearchResults(true); }}
                                        onFocus={() => setShowSearchResults(true)}
                                    />
                                </div>

                                {showSearchResults && searchPessoa.length >= 2 && (
                                    <div className="card shadow" style={{
                                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                                        marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto'
                                    }}>
                                        {isSearching ? (
                                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                                <Loader size={24} className="animate-spin" style={{ margin: '0 auto', opacity: 0.3 }} />
                                                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.5 }}>Buscando...</p>
                                            </div>
                                        ) : searchResults.length === 0 ? (
                                            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                                                <p style={{ opacity: 0.5, marginBottom: '1rem' }}>Ninguém disponível com este nome</p>
                                                <button
                                                    onClick={() => { setShowQuickAddPerson(true); setShowSearchResults(false); }}
                                                    className="btn-outline"
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                                >
                                                    <UserPlus size={16} /> Cadastrar Nova Pessoa
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {searchResults.map(p => {
                                                    const isDisabled = !!p.equipeAtual || p.noStaging;
                                                    return (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => !isDisabled && addToStaging(p)}
                                                            className={`pessoa-row ${!isDisabled ? 'row-hover' : ''}`}
                                                            style={{
                                                                borderRadius: 0,
                                                                borderBottom: '1px solid var(--border-color)',
                                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                                padding: '0.75rem 1rem',
                                                                opacity: isDisabled ? 0.6 : 1,
                                                                background: isDisabled ? 'var(--secondary-bg)' : 'transparent'
                                                            }}
                                                        >
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    {p.nome_completo}
                                                                    <button 
                                                                        className="icon-btn" 
                                                                        style={{ padding: '0.1rem', color: 'var(--primary-color)' }}
                                                                        title="Ver histórico"
                                                                        onClick={(e) => { e.stopPropagation(); setHistoryTarget(p); }}
                                                                    >
                                                                        <History size={14} />
                                                                    </button>
                                                                    {p.equipeAtual && (
                                                                        <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                                                                            EQUIPE: {p.equipeAtual.toUpperCase()}
                                                                        </span>
                                                                    )}
                                                                    {p.noStaging && (
                                                                        <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                                                                            NO RASCUNHO
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>CPF: {p.cpf}</div>
                                                            </div>
                                                            {!isDisabled ? <Plus size={16} /> : <Check size={16} style={{ color: p.noStaging ? '#f59e0b' : '#ef4444' }} />}
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border-color)', background: 'var(--secondary-bg)' }}>
                                                    <button
                                                        onClick={() => { setShowQuickAddPerson(true); setShowSearchResults(false); }}
                                                        className="btn-link"
                                                        style={{ width: '100%', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                                    >
                                                        <Plus size={14} /> Não encontrou? Cadastre aqui
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="card" style={{ padding: 0 }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--secondary-bg)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                                    <h2 style={{ margin: 0, fontSize: '1rem' }}>Membros da Equipe</h2>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{membrosSalvos.length + staging.length} total</span>
                                </div>

                                {membrosSalvos.length === 0 && staging.length === 0 ? (
                                    <div style={{ padding: '4rem 2rem', textAlign: 'center', opacity: 0.5 }}>
                                        <Users size={32} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                        <p>Nenhum membro vinculado. Use a busca acima para adicionar.</p>
                                    </div>
                                ) : (
                                    <div className="pessoa-list">
                                        {/* Membros em Staging (Não salvos) */}
                                        {staging.map(s => (
                                            <div key={s.pessoa_id} className="pessoa-row" style={{ borderBottom: '1px solid var(--border-color)', borderRadius: 0, background: 'rgba(245, 158, 11, 0.05)', borderLeft: '4px solid #f59e0b' }}>
                                                <div className="pessoa-row-main" style={{ flex: 1 }}>
                                                    <div className="pessoa-avatar small" style={{ backgroundColor: s.coordenador ? '#367910ff' : '#f59e0b', color: 'white' }}>
                                                        <Plus size={16} />
                                                    </div>
                                                    <div className="pessoa-row-info">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <h4 className="pessoa-row-name" style={{ margin: 0 }}>{s.nome_completo}</h4>
                                                            <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: 'white', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>NOVO</span>
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>CPF: {s.cpf}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => s.coordenador && toggleStagingCoord(s.pessoa_id)}
                                                            className="role-radio-btn"
                                                            style={{
                                                                padding: '0.25rem 0.6rem',
                                                                fontSize: '0.6rem',
                                                                fontWeight: 'bold',
                                                                borderRadius: 0,
                                                                backgroundColor: !s.coordenador ? '#0000FE' : 'transparent',
                                                                color: !s.coordenador ? 'white' : 'inherit',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                opacity: !s.coordenador ? 1 : 0.5
                                                            }}
                                                        >
                                                            MEMBRO
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => !s.coordenador && toggleStagingCoord(s.pessoa_id)}
                                                            className="role-radio-btn"
                                                            style={{
                                                                padding: '0.25rem 0.6rem',
                                                                fontSize: '0.6rem',
                                                                fontWeight: 'bold',
                                                                borderRadius: 0,
                                                                backgroundColor: s.coordenador ? '#137e0aff' : 'transparent',
                                                                color: s.coordenador ? 'white' : 'inherit',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                opacity: s.coordenador ? 1 : 0.5
                                                            }}
                                                        >
                                                            COORDENADOR
                                                        </button>
                                                    </div>
                                                    <button className="icon-btn icon-btn-danger" onClick={() => removeFromStaging(s.pessoa_id)} title="Remover"><X size={16} /></button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Membros Salvos */}
                                        {membrosSalvos.map((m) => (
                                            <div key={m.id} className="pessoa-row" style={{ borderBottom: '1px solid var(--border-color)', borderRadius: 0 }}>
                                                <div className="pessoa-row-main" style={{ flex: 1 }}>
                                                    <div className="pessoa-avatar small" style={{ backgroundColor: m.coordenador ? '#137e0aff' : 'var(--secondary-bg)', color: m.coordenador ? 'white' : 'inherit' }}>
                                                        {m.coordenador ? <Shield size={16} /> : <Users size={16} />}
                                                    </div>
                                                    <div className="pessoa-row-info">
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <h4 className="pessoa-row-name" style={{ margin: 0 }}>{m.pessoas?.nome_completo}</h4>
                                                            <button 
                                                                className="icon-btn" 
                                                                style={{ padding: '0.1rem', color: 'var(--primary-color)' }}
                                                                title="Ver histórico"
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    setHistoryTarget({ ...m.pessoas, id: m.pessoa_id } as Pessoa); 
                                                                }}
                                                            >
                                                                <History size={14} />
                                                            </button>
                                                        </div>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>CPF: {m.pessoas?.cpf}</span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => m.coordenador && handleToggleCoord(m)}
                                                            className="role-radio-btn"
                                                            style={{
                                                                padding: '0.25rem 0.6rem',
                                                                fontSize: '0.6rem',
                                                                fontWeight: 'bold',
                                                                borderRadius: 0,
                                                                backgroundColor: !m.coordenador ? '#0000FE' : 'transparent',
                                                                color: !m.coordenador ? 'white' : 'inherit',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                opacity: !m.coordenador ? 1 : 0.5
                                                            }}
                                                        >
                                                            MEMBRO
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => !m.coordenador && handleToggleCoord(m)}
                                                            className="role-radio-btn"
                                                            style={{
                                                                padding: '0.25rem 0.6rem',
                                                                fontSize: '0.6rem',
                                                                fontWeight: 'bold',
                                                                borderRadius: 0,
                                                                backgroundColor: m.coordenador ? '#137e0aff' : 'transparent',
                                                                color: m.coordenador ? 'white' : 'inherit',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s',
                                                                opacity: m.coordenador ? 1 : 0.5
                                                            }}
                                                        >
                                                            COORDENADOR
                                                        </button>
                                                    </div>
                                                    <button className="icon-btn icon-btn-danger" onClick={() => setDeleteTarget(m)} title="Remover"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Remover Membro"
                message={`Deseja remover "${deleteTarget?.pessoas?.nome_completo}" desta equipe ? `}
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