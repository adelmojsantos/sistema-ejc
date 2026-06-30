import { BarChart3, ChevronLeft, ClipboardList, Copy, FileQuestion, Loader, Pencil, Plus, Save, Search, Share2, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { useEncontros } from '../../contexts/EncontroContext';
import {
  pesquisaSatisfacaoService,
  type PesquisaSatisfacaoPainel,
  type PesquisaSatisfacaoPerguntaResumo,
  type PesquisaSatisfacaoRelatorioIAResultado,
  type PesquisaSatisfacaoRespondente,
  type PesquisaSatisfacaoResumoIA,
} from '../../services/pesquisaSatisfacaoService';
import { encontroService } from '../../services/encontroService';
import type { Encontro } from '../../types/encontro';
import type {
  PesquisaSatisfacaoPerguntaFormData,
  PesquisaSatisfacaoQuestion,
  PesquisaSatisfacaoQuestionType,
  PesquisaSatisfacaoStatus,
} from '../../types/pesquisaSatisfacao';

type Tab = 'perguntas' | 'respostas';
type StatusFilter = 'todos' | PesquisaSatisfacaoStatus;
const RESUMOS_IA_LIMITE = 5;

const typeLabels: Record<PesquisaSatisfacaoQuestionType, string> = {
  sim_nao_partes: 'Sim, Não e Em partes',
  texto: 'Texto livre',
  nota: 'Nota 1 a 10',
  sim_nao: 'Sim ou Não',
};

function emptyForm(encontroId = '', ordem = 1): PesquisaSatisfacaoPerguntaFormData {
  return {
    encontro_id: encontroId,
    ordem,
    section_id: 'nova_secao',
    section_title: 'Nova seção',
    title: '',
    type: 'texto',
    required: true,
    active: true,
  };
}

function normalizeSectionId(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'secao';
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function AvaliacaoEncontroPage() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();

  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [tab, setTab] = useState<Tab>('respostas');
  const [perguntas, setPerguntas] = useState<PesquisaSatisfacaoQuestion[]>([]);
  const [painel, setPainel] = useState<PesquisaSatisfacaoPainel | null>(null);
  const [painelGeral, setPainelGeral] = useState<PesquisaSatisfacaoPainel | null>(null);
  const [resumosIA, setResumosIA] = useState<PesquisaSatisfacaoResumoIA[]>([]);
  const [publicada, setPublicada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingResumoIA, setGeneratingResumoIA] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [responsesModalSummary, setResponsesModalSummary] = useState<PesquisaSatisfacaoPerguntaResumo | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<PesquisaSatisfacaoQuestion | null>(null);
  const [formData, setFormData] = useState<PesquisaSatisfacaoPerguntaFormData>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<PesquisaSatisfacaoQuestion | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [equipeFilter, setEquipeFilter] = useState('todas');
  const [questionFilter, setQuestionFilter] = useState('todas');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!selectedEncontroId && encontroAtivo) {
      setSelectedEncontroId(encontroAtivo.id);
    } else if (!selectedEncontroId && encontros.length > 0) {
      setSelectedEncontroId(encontros[0].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const load = useCallback(async () => {
    if (!selectedEncontroId) return;
    setLoading(true);
    try {
      await pesquisaSatisfacaoService.garantirPerguntasPadrao(selectedEncontroId);
      const [configData, perguntasData, painelGeralData, resumosIAData, painelFiltradoData] = await Promise.all([
        pesquisaSatisfacaoService.obterConfig(selectedEncontroId),
        pesquisaSatisfacaoService.listarPerguntas(selectedEncontroId, true),
        pesquisaSatisfacaoService.listarPainel(selectedEncontroId),
        pesquisaSatisfacaoService.listarResumosIA(selectedEncontroId),
        equipeFilter === 'todas'
          ? Promise.resolve(null)
          : pesquisaSatisfacaoService.listarPainel(selectedEncontroId, equipeFilter),
      ]);
      setPublicada(configData.publicada);
      setPerguntas(perguntasData);
      setPainelGeral(painelGeralData);
      setPainel(painelFiltradoData ?? painelGeralData);
      setResumosIA(resumosIAData);
    } catch (error) {
      console.error('Erro ao carregar pesquisa de satisfação:', error);
      toast.error('Erro ao carregar avaliação.');
    } finally {
      setLoading(false);
    }
  }, [selectedEncontroId, equipeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const activeQuestions = useMemo(() => perguntas.filter((pergunta) => pergunta.active !== false), [perguntas]);
  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const pergunta of perguntas) {
      map.set(pergunta.sectionId, pergunta.sectionTitle);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [perguntas]);

  const equipeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const respondente of painelGeral?.respondentes ?? []) {
      map.set(respondente.equipeId, respondente.equipeNome);
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [painelGeral]);

  const filteredRespondentes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (painel?.respondentes ?? []).filter((respondente) => {
      if (term && !respondente.equipeNome.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [painel, search]);

  const equipesRespondentes = useMemo(() => {
    const map = new Map<string, { equipeId: string; equipeNome: string; integrantes: PesquisaSatisfacaoRespondente[] }>();
    for (const respondente of filteredRespondentes) {
      if (!map.has(respondente.equipeId)) {
        map.set(respondente.equipeId, {
          equipeId: respondente.equipeId,
          equipeNome: respondente.equipeNome,
          integrantes: [],
        });
      }
      map.get(respondente.equipeId)!.integrantes.push(respondente);
    }

    return Array.from(map.values())
      .filter((equipe) => statusFilter === 'todos' || equipe.integrantes.some((integrante) => integrante.status === statusFilter))
      .map((equipe) => {
        const respondidas = equipe.integrantes.filter((integrante) => integrante.status === 'enviado').length;
        const rascunhos = equipe.integrantes.filter((integrante) => integrante.status === 'rascunho').length;
        const aResponder = equipe.integrantes.length - respondidas;
        return {
          ...equipe,
          respondidas,
          rascunhos,
          aResponder,
        };
      })
      .sort((a, b) => a.equipeNome.localeCompare(b.equipeNome, 'pt-BR'));
  }, [filteredRespondentes, statusFilter]);

  const questionSummaries = useMemo(() => {
    const summaries = painel?.perguntaResumos ?? [];
    if (questionFilter === 'todas') return summaries;
    return summaries.filter((summary) => summary.pergunta.id === questionFilter);
  }, [painel, questionFilter]);

  const completion = painel && painel.totalParticipantes > 0
    ? (painel.totalEnviados / painel.totalParticipantes) * 100
    : 0;
  const notaGeral = painel?.perguntaResumos.find((summary) => summary.pergunta.title.toLowerCase().includes('nota geral'));
  const serviria = painel?.perguntaResumos.find((summary) => summary.pergunta.title.toLowerCase().includes('serviria novamente'));
  const relatorioAtual = resumosIA[0] ?? null;
  const relatorioEmAndamento = resumosIA.find((item) => item.status === 'pending' || item.status === 'generating') ?? null;
  const ultimoResumoIA = resumosIA.find((item) => item.status === 'completed') ?? null;
  const resumosRestantes = Math.max(RESUMOS_IA_LIMITE - resumosIA.length, 0);
  const podeGerarResumoIA = !!selectedEncontroId
    && (painel?.totalEnviados ?? 0) > 0
    && (resumosRestantes > 0 || !!relatorioEmAndamento || relatorioAtual?.status === 'error')
    && !generatingResumoIA;

  const openCreateModal = () => {
    const nextOrder = perguntas.length > 0 ? Math.max(...perguntas.map((item) => item.ordem ?? 0)) + 1 : 1;
    setEditingQuestion(null);
    setFormData(emptyForm(selectedEncontroId, nextOrder));
    setQuestionModalOpen(true);
  };

  const openEditModal = (question: PesquisaSatisfacaoQuestion) => {
    setEditingQuestion(question);
    setFormData({
      encontro_id: selectedEncontroId,
      ordem: question.ordem ?? 1,
      section_id: question.sectionId,
      section_title: question.sectionTitle,
      title: question.title,
      type: question.type,
      required: question.required ?? true,
      active: question.active ?? true,
    });
    setQuestionModalOpen(true);
  };

  const handleSectionTitleChange = (value: string) => {
    setFormData((current) => ({
      ...current,
      section_title: value,
      section_id: editingQuestion ? current.section_id : normalizeSectionId(value),
    }));
  };

  const saveQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEncontroId || !formData.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...formData,
        encontro_id: selectedEncontroId,
        section_id: formData.section_id || normalizeSectionId(formData.section_title),
        section_title: formData.section_title.trim(),
        title: formData.title.trim(),
      };
      if (editingQuestion) {
        await pesquisaSatisfacaoService.atualizarPergunta(editingQuestion.id, payload);
        toast.success('Pergunta atualizada.');
      } else {
        await pesquisaSatisfacaoService.criarPergunta(payload);
        toast.success('Pergunta criada.');
      }
      setQuestionModalOpen(false);
      await load();
    } catch (error) {
      console.error('Erro ao salvar pergunta:', error);
      toast.error('Erro ao salvar pergunta.');
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await pesquisaSatisfacaoService.excluirPergunta(deleteTarget.id);
      toast.success('Pergunta removida.');
      setDeleteTarget(null);
      await load();
    } catch (error) {
      console.error('Erro ao remover pergunta:', error);
      toast.error('Erro ao remover pergunta.');
    } finally {
      setSaving(false);
    }
  };

  const togglePublicacao = async () => {
    if (!selectedEncontroId) return;
    if (!publicada && activeQuestions.length === 0) {
      toast.error('Cadastre ou ative ao menos uma pergunta antes de publicar.');
      setTab('perguntas');
      return;
    }
    setSaving(true);
    try {
      const next = await pesquisaSatisfacaoService.atualizarPublicacao(selectedEncontroId, !publicada);
      setPublicada(next.publicada);
      toast.success(next.publicada ? 'Pesquisa publicada para os coordenadores.' : 'Pesquisa despublicada.');
    } catch (error) {
      console.error('Erro ao atualizar publicação:', error);
      toast.error('Erro ao atualizar publicação.');
    } finally {
      setSaving(false);
    }
  };

  const equipeLink = (equipeId: string) => {
    if (!selectedEncontroId) return '';
    return `${window.location.origin}/pesquisa-satisfacao/equipe/${equipeId}?encontro=${selectedEncontroId}`;
  };

  const copyEquipeLink = async (equipeId: string) => {
    const link = equipeLink(equipeId);
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado.');
  };

  const gerarResumoIA = async () => {
    if (!selectedEncontroId || !podeGerarResumoIA) return;
    setGeneratingResumoIA(true);
    const updateProgress = (report: PesquisaSatisfacaoResumoIA) => {
      setResumosIA((current) => [
        report,
        ...current.filter((item) => item.id !== report.id),
      ]);
    };
    try {
      if (relatorioAtual?.status === 'error') {
        await pesquisaSatisfacaoService.tentarNovamenteResumoIA(relatorioAtual.id, updateProgress);
      } else {
        await pesquisaSatisfacaoService.gerarResumoIA(selectedEncontroId, updateProgress);
      }
      toast.success('Relatório detalhado concluído.');
      const next = await pesquisaSatisfacaoService.listarResumosIA(selectedEncontroId);
      setResumosIA(next);
    } catch (error) {
      console.error('Erro ao gerar relatório IA:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório.');
      const next = await pesquisaSatisfacaoService.listarResumosIA(selectedEncontroId);
      setResumosIA(next);
    } finally {
      setGeneratingResumoIA(false);
    }
  };

  return (
    <main className="main-content container fade-in pesquisa-admin-page">
      <header className="pesquisa-admin-hero">
        <div className="pesquisa-admin-title">
          <button onClick={() => navigate('/cadastros')} className="icon-btn" aria-label="Voltar">
            <ChevronLeft size={20} />
          </button>
          <div>
            <span>Cadastro e análise</span>
            <h1>Pesquisa de satisfação</h1>
          </div>
        </div>
        <div className="pesquisa-admin-encontro">
          <LiveSearchSelect<Encontro>
            value={selectedEncontroId}
            onChange={(value) => {
              setSelectedEncontroId(value);
              setEquipeFilter('todas');
              setQuestionFilter('todas');
            }}
            fetchData={async (searchTerm, page) => encontroService.buscarComPaginacao(searchTerm, page)}
            getOptionLabel={(encontro) => `${encontro.nome}${encontro.ativo ? ' (Ativo)' : ''}`}
            getOptionValue={(encontro) => String(encontro.id)}
            placeholder="Selecione o encontro"
            initialOptions={encontros}
          />
        </div>
      </header>

      <section className={`card pesquisa-publicacao-card ${publicada ? 'is-published' : ''}`}>
        <div>
          <span>Publicação</span>
          <h2>{publicada ? 'Pesquisa publicada' : 'Pesquisa não publicada'}</h2>
          <p>
            {publicada
              ? 'Os coordenadores conseguem acessar a pesquisa e compartilhar o link público da equipe.'
              : 'Os coordenadores ainda não conseguem acessar a pesquisa. Publique quando as perguntas estiverem prontas.'}
          </p>
        </div>
        <div className="pesquisa-publicacao-actions">
          <button type="button" className="btn-secondary" onClick={() => setLinksModalOpen(true)} disabled={!selectedEncontroId}>
            <Copy size={16} />
            Ver links por equipe
          </button>
          <button type="button" className={publicada ? 'btn-secondary' : 'btn-primary'} onClick={togglePublicacao} disabled={saving || !selectedEncontroId}>
            {saving ? <Loader className="animate-spin" size={16} /> : <Share2 size={16} />}
            {publicada ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </section>

      <section className="pesquisa-admin-tabs">
        <button type="button" className={tab === 'respostas' ? 'is-active' : ''} onClick={() => setTab('respostas')}>
          <BarChart3 size={18} />
          Respostas
        </button>
        <button type="button" className={tab === 'perguntas' ? 'is-active' : ''} onClick={() => setTab('perguntas')}>
          <FileQuestion size={18} />
          Perguntas
        </button>
      </section>

      <section className="pesquisa-admin-summary">
        <StatCard label="Perguntas ativas" value={activeQuestions.length} icon={<FileQuestion size={20} />} />
        <StatCard label="Respondidas" value={painel?.totalEnviados ?? 0} tone="success" />
        <StatCard label="Rascunhos" value={painel?.totalRascunhos ?? 0} tone="warning" />
        <StatCard label="Pendentes" value={painel?.totalPendentes ?? 0} tone="muted" />
      </section>

      {loading && (
        <div className="empty-state">
          <Loader className="animate-spin" size={20} />
          Carregando dados...
        </div>
      )}

      {!loading && tab === 'perguntas' && (
        <section className="card pesquisa-admin-card">
          <div className="pesquisa-admin-section-header">
            <div>
              <h2>Perguntas cadastradas</h2>
              <p>Altere, adicione ou remova perguntas da pesquisa deste encontro.</p>
            </div>
            <button type="button" className="btn-primary" onClick={openCreateModal} disabled={!selectedEncontroId}>
              <Plus size={16} />
              Adicionar pergunta
            </button>
          </div>

          <div className="pesquisa-question-admin-list">
            {perguntas.length === 0 ? (
              <div className="empty-state">Nenhuma pergunta cadastrada para este encontro.</div>
            ) : perguntas.map((pergunta) => (
              <article key={pergunta.id} className={`pesquisa-question-admin-card ${pergunta.active === false ? 'is-inactive' : ''}`}>
                <div>
                  <div className="pesquisa-question-admin-meta">
                    <span>#{pergunta.ordem}</span>
                    <Badge>{pergunta.sectionTitle}</Badge>
                    <Badge tone={pergunta.required ? 'warning' : 'muted'}>{pergunta.required ? 'Obrigatória' : 'Opcional'}</Badge>
                    <Badge tone={pergunta.active === false ? 'muted' : 'success'}>{pergunta.active === false ? 'Removida' : typeLabels[pergunta.type]}</Badge>
                  </div>
                  <h3>{pergunta.title}</h3>
                </div>
                <div className="pesquisa-question-admin-actions">
                  <button type="button" className="icon-btn" onClick={() => openEditModal(pergunta)} aria-label="Editar pergunta">
                    <Pencil size={16} />
                  </button>
                  {pergunta.active !== false && (
                    <button type="button" className="icon-btn danger" onClick={() => setDeleteTarget(pergunta)} aria-label="Remover pergunta">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && tab === 'respostas' && (
        <section className="pesquisa-dashboard">
          <div className="card pesquisa-admin-card pesquisa-overview">
            <div className="pesquisa-admin-section-header">
              <div>
                <h2>Resumo geral</h2>
                <p>Visão rápida do preenchimento e dos principais indicadores.</p>
              </div>
            </div>
            <div className="pesquisa-progress">
              <div>
                <strong>{formatPercent(completion)} concluído</strong>
                <span>{painel?.totalEnviados ?? 0} de {painel?.totalParticipantes ?? 0} integrantes enviaram.</span>
              </div>
              <div className="pesquisa-progress-bar"><span style={{ width: `${completion}%` }} /></div>
            </div>
            <div className="pesquisa-overview-grid">
              <MiniMetric label="Nota média" value={notaGeral?.media ? notaGeral.media.toFixed(1) : '-'} />
              <MiniMetric
                label="Serviriam novamente"
                value={serviria?.opcoes?.find((item) => item.label === 'Sim')?.count ?? 0}
              />
              <MiniMetric label="Equipes no filtro" value={equipeFilter === 'todas' ? equipeOptions.length : 1} />
            </div>
          </div>

          <div className="card pesquisa-admin-card">
            <div className="pesquisa-filters">
              <label>
                <span>Equipe</span>
                <select value={equipeFilter} onChange={(event) => setEquipeFilter(event.target.value)}>
                  <option value="todas">Todas as equipes</option>
                  {equipeOptions.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                  <option value="todos">Todos</option>
                  <option value="enviado">Respondidas</option>
                  <option value="rascunho">Rascunhos</option>
                  <option value="pendente">Pendentes</option>
                </select>
              </label>
              <label>
                <span>Pergunta</span>
                <select value={questionFilter} onChange={(event) => setQuestionFilter(event.target.value)}>
                  <option value="todas">Todas as perguntas</option>
                  {activeQuestions.map((pergunta) => (
                    <option key={pergunta.id} value={pergunta.id}>{pergunta.title}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Buscar</span>
                <div className="pesquisa-search">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Equipe" />
                </div>
              </label>
            </div>
          </div>

          <section className="card pesquisa-admin-card pesquisa-ai-summary">
            <div className="pesquisa-admin-section-header">
              <div className="pesquisa-ai-title">
                <span><Sparkles size={18} /></span>
                <div>
                  <h2>Resumo geral com IA</h2>
                  <p>Analisa todas as respostas em lotes, detalha cada pergunta e consolida ações prioritárias.</p>
                </div>
              </div>
              <button type="button" className="btn-primary" onClick={gerarResumoIA} disabled={!podeGerarResumoIA}>
                {generatingResumoIA ? <Loader className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {relatorioAtual?.status === 'error'
                  ? 'Tentar novamente'
                  : relatorioEmAndamento
                    ? 'Continuar relatório'
                    : ultimoResumoIA
                      ? 'Gerar novo relatório'
                      : 'Gerar relatório com IA'}
              </button>
            </div>
            <div className="pesquisa-ai-meta">
              <Badge tone={resumosRestantes > 0 ? 'primary' : 'muted'}>
                {resumosIA.length}/{RESUMOS_IA_LIMITE} relatórios iniciados
              </Badge>
              <span>
                {relatorioEmAndamento
                  ? `${relatorioEmAndamento.perguntas_concluidas} de ${relatorioEmAndamento.total_perguntas} perguntas concluídas.`
                  : resumosRestantes > 0
                  ? `${resumosRestantes} ${resumosRestantes === 1 ? 'geração restante' : 'gerações restantes'} neste encontro.`
                  : 'Limite de relatórios atingido para este encontro.'}
              </span>
            </div>
            {relatorioEmAndamento && (
              <div className="pesquisa-ai-progress" role="status">
                <div>
                  <Loader className="animate-spin" size={16} />
                  <strong>Relatório em processamento</strong>
                  <span>
                    {relatorioEmAndamento.erro_mensagem
                      || 'O trabalho salvo pode ser retomado se esta página for fechada.'}
                  </span>
                </div>
                <div className="pesquisa-progress-bar">
                  <span
                    style={{
                      width: `${relatorioEmAndamento.total_perguntas > 0
                        ? (relatorioEmAndamento.perguntas_concluidas / relatorioEmAndamento.total_perguntas) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {relatorioAtual?.status === 'error' && (
              <div className="pesquisa-ai-error" role="alert">
                <strong>O processamento foi interrompido.</strong>
                <span>{relatorioAtual.erro_mensagem || 'Tente novamente para continuar das etapas já salvas.'}</span>
              </div>
            )}
            {ultimoResumoIA ? (
              <article className="pesquisa-ai-content">
                <div>
                  <strong>Último relatório concluído</strong>
                  <span>
                    Gerado em {new Date(ultimoResumoIA.created_at).toLocaleString('pt-BR')} · {ultimoResumoIA.total_respostas} respostas consideradas
                  </span>
                </div>
                {ultimoResumoIA.resultado
                  ? <StructuredAiReport result={ultimoResumoIA.resultado} />
                  : (
                    <div className="pesquisa-ai-markdown">
                      <ReactMarkdown>{ultimoResumoIA.conteudo ?? ''}</ReactMarkdown>
                    </div>
                  )}
              </article>
            ) : (
              !relatorioEmAndamento
              && relatorioAtual?.status !== 'error'
              && <div className="empty-state">Nenhum relatório gerado para este encontro.</div>
            )}
          </section>

          <div className="pesquisa-dashboard-grid">
            <section className="card pesquisa-admin-card">
              <div className="pesquisa-admin-section-header">
                <div>
                  <h2>Análise por pergunta</h2>
                  <p>Quantidades por resposta e textos relevantes para levantamento dos dados.</p>
                </div>
              </div>
              <div className="pesquisa-question-analysis-list">
                {questionSummaries.length === 0 ? (
                  <div className="empty-state">Nenhuma pergunta encontrada.</div>
                ) : questionSummaries.map((summary) => (
                  <QuestionSummaryCard
                    key={summary.pergunta.id}
                    summary={summary}
                    onViewAll={() => setResponsesModalSummary(summary)}
                  />
                ))}
              </div>
            </section>

            <section className="card pesquisa-admin-card">
              <div className="pesquisa-admin-section-header">
                <div>
                  <h2>Respostas por equipe</h2>
                  <p>Quantidade respondida e a responder, sem identificar individualmente os integrantes.</p>
                </div>
              </div>
              <div className="pesquisa-respondentes-list">
                {equipesRespondentes.length === 0 ? (
                  <div className="empty-state">Nenhuma equipe encontrada para os filtros.</div>
                ) : equipesRespondentes.map((equipe) => (
                  <article key={equipe.equipeId} className="pesquisa-respondente pesquisa-team-response">
                    <div>
                      <strong>{equipe.equipeNome}</strong>
                      <span>{equipe.respondidas} respondidas · {equipe.aResponder} a responder</span>
                    </div>
                    <div className="pesquisa-team-response-badges">
                      <Badge tone="success">{equipe.respondidas} respondidas</Badge>
                      {equipe.rascunhos > 0 && <Badge tone="warning">{equipe.rascunhos} rascunhos</Badge>}
                      <Badge tone={equipe.aResponder > 0 ? 'warning' : 'success'}>{equipe.aResponder} a responder</Badge>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      )}

      <Modal
        isOpen={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        title={editingQuestion ? 'Editar pergunta' : 'Adicionar pergunta'}
        maxWidth="680px"
      >
        <form className="pesquisa-question-form" onSubmit={saveQuestion}>
          <div className="pesquisa-form-grid">
            <label>
              <span>Ordem</span>
              <input
                type="number"
                min={1}
                value={formData.ordem}
                onChange={(event) => setFormData((current) => ({ ...current, ordem: Number(event.target.value) || 1 }))}
                required
              />
            </label>
            <label>
              <span>Seção</span>
              <input
                list="pesquisa-secoes"
                value={formData.section_title}
                onChange={(event) => handleSectionTitleChange(event.target.value)}
                required
              />
              <datalist id="pesquisa-secoes">
                {sections.map((section) => <option key={section.id} value={section.title} />)}
              </datalist>
            </label>
          </div>

          <label>
            <span>Pergunta</span>
            <textarea
              value={formData.title}
              onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
              rows={3}
              required
            />
          </label>

          <div className="pesquisa-form-grid">
            <label>
              <span>Tipo de resposta</span>
              <select
                value={formData.type}
                onChange={(event) => setFormData((current) => ({ ...current, type: event.target.value as PesquisaSatisfacaoQuestionType }))}
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={formData.active ? 'active' : 'inactive'}
                onChange={(event) => setFormData((current) => ({ ...current, active: event.target.value === 'active' }))}
              >
                <option value="active">Ativa</option>
                <option value="inactive">Removida</option>
              </select>
            </label>
          </div>

          <label className="pesquisa-check">
            <input
              type="checkbox"
              checked={formData.required}
              onChange={(event) => setFormData((current) => ({ ...current, required: event.target.checked }))}
            />
            Obrigatória
          </label>

          <div className="pesquisa-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setQuestionModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={linksModalOpen}
        onClose={() => setLinksModalOpen(false)}
        title="Links públicos por equipe"
        maxWidth="760px"
      >
        <div className="pesquisa-links-modal">
          <div className="pesquisa-links-modal__header">
            <p>Copie o link direto de cada equipe para enviar junto com o QR ou mensagem da coordenação.</p>
            <Badge tone={publicada ? 'success' : 'warning'}>{publicada ? 'Publicado' : 'Não publicado'}</Badge>
          </div>
          <div className="pesquisa-team-links">
            {equipeOptions.length === 0 ? (
              <div className="empty-state">Nenhuma equipe encontrada neste encontro.</div>
            ) : equipeOptions.map((equipe) => {
              const link = equipeLink(equipe.id);
              return (
                <article key={equipe.id} className="pesquisa-team-link-card">
                  <div>
                    <strong>{equipe.nome}</strong>
                    <code>{link}</code>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => copyEquipeLink(equipe.id)}>
                    <Copy size={16} />
                    Copiar
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!responsesModalSummary}
        onClose={() => setResponsesModalSummary(null)}
        title="Todas as respostas"
        maxWidth="760px"
      >
        {responsesModalSummary && (
          <div className="pesquisa-all-responses">
            <header>
              <Badge tone="muted">{responsesModalSummary.pergunta.sectionTitle}</Badge>
              <h3>{responsesModalSummary.pergunta.title}</h3>
              <p>{responsesModalSummary.textos?.length ?? 0} respostas textuais, exibidas anonimamente por equipe.</p>
            </header>
            <div className="pesquisa-all-responses-list">
              {(responsesModalSummary.textos ?? []).map((item, index) => (
                <article key={`${item.equipeNome}-${index}`}>
                  <strong>{item.equipeNome}</strong>
                  <p>{item.texto}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remover pergunta?"
        message="A pergunta sairá do formulário, mas respostas antigas continuam preservadas para histórico."
        confirmText="Remover"
        cancelText="Cancelar"
        isLoading={saving}
        isDestructive
        onConfirm={deleteQuestion}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .pesquisa-admin-page {
          padding-bottom: 4rem;
        }

        .pesquisa-admin-hero {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .pesquisa-admin-title {
          align-items: center;
          display: flex;
          gap: 1rem;
        }

        .pesquisa-admin-title span,
        .pesquisa-admin-card h2 + p,
        .pesquisa-admin-card p {
          color: var(--muted-text);
        }

        .pesquisa-admin-title span {
          color: var(--primary-color);
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .pesquisa-admin-title h1 {
          color: var(--text-color);
          font-size: 1.65rem;
          margin: 0.12rem 0 0;
        }

        .pesquisa-admin-encontro {
          min-width: min(360px, 100%);
        }

        .pesquisa-publicacao-card {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding: 1rem;
        }

        .pesquisa-publicacao-card.is-published {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.28);
        }

        .pesquisa-publicacao-card span {
          color: var(--primary-color);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .pesquisa-publicacao-card h2 {
          color: var(--text-color);
          font-size: 1.08rem;
          margin: 0.2rem 0;
        }

        .pesquisa-publicacao-card p {
          color: var(--muted-text);
          line-height: 1.45;
          margin: 0;
        }

        .pesquisa-publicacao-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          justify-content: flex-end;
        }

        .pesquisa-admin-tabs,
        .pesquisa-admin-summary {
          display: grid;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .pesquisa-admin-tabs {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .pesquisa-admin-tabs button {
          align-items: center;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-color);
          cursor: pointer;
          display: inline-flex;
          font-weight: 900;
          gap: 0.5rem;
          justify-content: center;
          min-height: 46px;
        }

        .pesquisa-admin-tabs button.is-active {
          background: rgba(var(--primary-rgb), 0.12);
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        .pesquisa-admin-summary {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .pesquisa-stat-card,
        .pesquisa-admin-card {
          padding: 1rem;
        }

        .pesquisa-stat-card {
          align-items: center;
          display: flex;
          gap: 0.8rem;
        }

        .pesquisa-stat-icon {
          align-items: center;
          background: rgba(var(--primary-rgb), 0.11);
          border-radius: 10px;
          color: var(--primary-color);
          display: flex;
          height: 42px;
          justify-content: center;
          width: 42px;
        }

        .pesquisa-stat-card span {
          color: var(--muted-text);
          display: block;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .pesquisa-stat-card strong {
          color: var(--text-color);
          display: block;
          font-size: 1.45rem;
        }

        .pesquisa-admin-section-header {
          align-items: flex-start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .pesquisa-admin-section-header h2 {
          color: var(--text-color);
          font-size: 1.08rem;
          margin: 0;
        }

        .pesquisa-admin-section-header p {
          font-size: 0.86rem;
          margin: 0.25rem 0 0;
        }

        .pesquisa-question-admin-list,
        .pesquisa-question-analysis-list,
        .pesquisa-team-links,
        .pesquisa-respondentes-list {
          display: grid;
          gap: 0.75rem;
        }

        .pesquisa-question-admin-card {
          align-items: flex-start;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
          padding: 0.9rem;
        }

        .pesquisa-question-admin-card.is-inactive {
          opacity: 0.62;
        }

        .pesquisa-question-admin-meta {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.45rem;
        }

        .pesquisa-question-admin-meta > span {
          color: var(--muted-text);
          font-size: 0.75rem;
          font-weight: 900;
        }

        .pesquisa-question-admin-card h3 {
          color: var(--text-color);
          font-size: 0.98rem;
          line-height: 1.35;
          margin: 0;
        }

        .pesquisa-question-admin-actions,
        .pesquisa-modal-actions {
          display: flex;
          gap: 0.5rem;
        }

        .pesquisa-team-link-card {
          align-items: center;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          display: grid;
          gap: 0.75rem;
          grid-template-columns: minmax(0, 1fr) auto;
          padding: 0.85rem;
        }

        .pesquisa-team-link-card strong {
          color: var(--text-color);
          display: block;
          margin-bottom: 0.35rem;
        }

        .pesquisa-team-link-card code {
          color: var(--muted-text);
          display: block;
          font-size: 0.78rem;
          overflow-wrap: anywhere;
        }

        .pesquisa-links-modal {
          display: grid;
          gap: 1rem;
        }

        .pesquisa-links-modal__header {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .pesquisa-links-modal__header p {
          color: var(--muted-text);
          line-height: 1.45;
          margin: 0;
        }

        .pesquisa-dashboard,
        .pesquisa-dashboard-grid {
          display: grid;
          gap: 1rem;
        }

        .pesquisa-ai-title {
          align-items: flex-start;
          display: flex;
          gap: 0.75rem;
        }

        .pesquisa-ai-title > span {
          align-items: center;
          background: rgba(var(--primary-rgb), 0.12);
          border-radius: 9px;
          color: var(--primary-color);
          display: flex;
          flex: 0 0 40px;
          height: 40px;
          justify-content: center;
        }

        .pesquisa-ai-meta {
          align-items: center;
          color: var(--muted-text);
          display: flex;
          flex-wrap: wrap;
          font-size: 0.82rem;
          gap: 0.65rem;
          margin-bottom: 1rem;
        }

        .pesquisa-ai-progress,
        .pesquisa-ai-error {
          border: 1px solid var(--border-color);
          border-radius: 10px;
          display: grid;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding: 0.85rem;
        }

        .pesquisa-ai-progress > div:first-child {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .pesquisa-ai-progress span,
        .pesquisa-ai-error span {
          color: var(--muted-text);
          font-size: 0.82rem;
        }

        .pesquisa-ai-error {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.28);
        }

        .pesquisa-ai-error :is(strong, span) {
          display: block;
        }

        .pesquisa-ai-content {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 1rem;
        }

        .pesquisa-ai-structured {
          display: grid;
          gap: 1rem;
          margin-top: 1rem;
        }

        .pesquisa-ai-structured section,
        .pesquisa-ai-question,
        .pesquisa-ai-complaint {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 9px;
          padding: 0.9rem;
        }

        .pesquisa-ai-structured h3,
        .pesquisa-ai-structured h4,
        .pesquisa-ai-structured p {
          margin: 0;
        }

        .pesquisa-ai-structured h3 {
          font-size: 1rem;
          margin-bottom: 0.65rem;
        }

        .pesquisa-ai-structured h4 {
          font-size: 0.9rem;
        }

        .pesquisa-ai-list {
          display: grid;
          gap: 0.5rem;
          margin: 0.65rem 0 0;
          padding-left: 1.2rem;
        }

        .pesquisa-ai-question {
          margin-top: 0.65rem;
        }

        .pesquisa-ai-question summary {
          cursor: pointer;
          font-weight: 800;
        }

        .pesquisa-ai-question-body,
        .pesquisa-ai-complaints {
          display: grid;
          gap: 0.75rem;
          margin-top: 0.8rem;
        }

        .pesquisa-ai-question-meta,
        .pesquisa-ai-complaint-meta,
        .pesquisa-ai-teams {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .pesquisa-ai-complaint {
          background: var(--secondary-bg);
        }

        .pesquisa-ai-complaint p {
          line-height: 1.5;
          margin-top: 0.45rem;
        }

        .pesquisa-ai-content > div:first-child strong,
        .pesquisa-ai-content > div:first-child span {
          display: block;
        }

        .pesquisa-ai-content > div:first-child strong {
          color: var(--text-color);
        }

        .pesquisa-ai-content > div:first-child span {
          color: var(--muted-text);
          font-size: 0.8rem;
          margin-top: 0.2rem;
        }

        .pesquisa-ai-markdown {
          color: var(--text-color);
          line-height: 1.55;
          margin-top: 1rem;
          overflow-x: auto;
        }

        .pesquisa-ai-markdown :is(h1, h2, h3) {
          color: var(--text-color);
          margin: 1rem 0 0.45rem;
        }

        .pesquisa-ai-markdown h1 {
          font-size: 1.12rem;
        }

        .pesquisa-ai-markdown h2 {
          font-size: 1rem;
        }

        .pesquisa-ai-markdown h3 {
          font-size: 0.94rem;
        }

        .pesquisa-ai-markdown p,
        .pesquisa-ai-markdown ul,
        .pesquisa-ai-markdown ol {
          margin: 0.45rem 0;
        }

        .pesquisa-ai-markdown :is(ul, ol) {
          padding-left: 1.3rem;
        }

        .pesquisa-ai-markdown li + li {
          margin-top: 0.3rem;
        }

        .pesquisa-ai-markdown table {
          border-collapse: collapse;
          font-size: 0.86rem;
          margin: 0.75rem 0;
          min-width: 560px;
          width: 100%;
        }

        .pesquisa-ai-markdown :is(th, td) {
          border: 1px solid var(--border-color);
          padding: 0.6rem;
          text-align: left;
          vertical-align: top;
        }

        .pesquisa-ai-markdown th {
          background: rgba(var(--primary-rgb), 0.08);
          font-weight: 900;
        }

        .pesquisa-dashboard-grid {
          grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
          align-items: start;
        }

        .pesquisa-progress {
          display: grid;
          gap: 0.65rem;
        }

        .pesquisa-progress strong {
          color: var(--text-color);
          display: block;
          font-size: 1.35rem;
        }

        .pesquisa-progress span {
          color: var(--muted-text);
        }

        .pesquisa-progress-bar {
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 999px;
          height: 10px;
          overflow: hidden;
        }

        .pesquisa-progress-bar span {
          background: linear-gradient(90deg, var(--primary-color), #10b981);
          display: block;
          height: 100%;
        }

        .pesquisa-overview-grid,
        .pesquisa-filters {
          display: grid;
          gap: 0.75rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 1rem;
        }

        .pesquisa-filters {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 0;
        }

        .pesquisa-filters label,
        .pesquisa-question-form label {
          display: grid;
          gap: 0.35rem;
        }

        .pesquisa-filters span,
        .pesquisa-question-form span {
          color: var(--muted-text);
          font-size: 0.78rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .pesquisa-filters select,
        .pesquisa-filters input,
        .pesquisa-question-form input,
        .pesquisa-question-form select,
        .pesquisa-question-form textarea {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 9px;
          color: var(--text-color);
          min-height: 42px;
          padding: 0.65rem;
          width: 100%;
        }

        .pesquisa-search {
          align-items: center;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 9px;
          display: flex;
          gap: 0.45rem;
          padding: 0 0.65rem;
        }

        .pesquisa-search input {
          border: 0;
          padding-inline: 0;
        }

        .pesquisa-mini-metric {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 0.9rem;
        }

        .pesquisa-mini-metric span {
          color: var(--muted-text);
          display: block;
          font-size: 0.78rem;
          font-weight: 800;
        }

        .pesquisa-mini-metric strong {
          color: var(--text-color);
          display: block;
          font-size: 1.35rem;
          margin-top: 0.2rem;
        }

        .pesquisa-question-summary,
        .pesquisa-respondente {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 0.9rem;
        }

        .pesquisa-question-summary h3 {
          color: var(--text-color);
          font-size: 0.96rem;
          line-height: 1.35;
          margin: 0 0 0.35rem;
        }

        .pesquisa-bars {
          display: grid;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .pesquisa-bar-row {
          display: grid;
          gap: 0.4rem;
          grid-template-columns: 88px minmax(0, 1fr) 38px;
          align-items: center;
          color: var(--muted-text);
          font-size: 0.82rem;
          font-weight: 800;
        }

        .pesquisa-bar-track {
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 999px;
          height: 9px;
          overflow: hidden;
        }

        .pesquisa-bar-track span {
          background: #10b981;
          display: block;
          height: 100%;
        }

        .pesquisa-text-samples {
          display: grid;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .pesquisa-text-samples article {
          border-left: 3px solid var(--primary-color);
          padding-left: 0.65rem;
        }

        .pesquisa-text-samples strong,
        .pesquisa-respondente strong {
          color: var(--text-color);
        }

        .pesquisa-text-samples p,
        .pesquisa-respondente p {
          color: var(--muted-text);
          line-height: 1.45;
          margin: 0.18rem 0 0;
        }

        .pesquisa-team-response {
          align-items: center;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .pesquisa-team-response > div > span {
          color: var(--muted-text);
          display: block;
          font-size: 0.82rem;
          margin-top: 0.15rem;
        }

        .pesquisa-team-response-badges {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          justify-content: flex-end;
        }

        .pesquisa-more-responses {
          background: transparent;
          border: 0;
          cursor: pointer;
          justify-self: start;
          padding: 0;
        }

        .pesquisa-all-responses,
        .pesquisa-all-responses-list {
          display: grid;
          gap: 0.75rem;
        }

        .pesquisa-all-responses header h3 {
          color: var(--text-color);
          margin: 0.55rem 0 0.25rem;
        }

        .pesquisa-all-responses header p,
        .pesquisa-all-responses-list p {
          color: var(--muted-text);
          line-height: 1.5;
          margin: 0.2rem 0 0;
        }

        .pesquisa-all-responses-list {
          max-height: 60vh;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .pesquisa-all-responses-list article {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 0.85rem;
        }

        .pesquisa-question-form,
        .pesquisa-form-grid {
          display: grid;
          gap: 0.85rem;
        }

        .pesquisa-form-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .pesquisa-check {
          align-items: center;
          display: flex !important;
          flex-direction: row;
          gap: 0.55rem !important;
        }

        .pesquisa-check input {
          min-height: auto;
          width: auto;
        }

        .pesquisa-modal-actions {
          justify-content: flex-end;
          margin-top: 0.5rem;
        }

        .pesquisa-badge {
          border-radius: 999px;
          display: inline-flex;
          font-size: 0.72rem;
          font-weight: 900;
          padding: 0.25rem 0.55rem;
          white-space: nowrap;
        }

        .pesquisa-badge--primary { background: rgba(var(--primary-rgb), 0.12); color: var(--primary-color); }
        .pesquisa-badge--success { background: rgba(16, 185, 129, 0.13); color: #10b981; }
        .pesquisa-badge--warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .pesquisa-badge--muted { background: rgba(148, 163, 184, 0.12); color: var(--muted-text); }

        @media (max-width: 980px) {
          .pesquisa-admin-summary,
          .pesquisa-dashboard-grid,
          .pesquisa-filters,
          .pesquisa-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .pesquisa-admin-summary,
          .pesquisa-admin-tabs,
          .pesquisa-dashboard-grid,
          .pesquisa-filters,
          .pesquisa-overview-grid,
          .pesquisa-form-grid {
            grid-template-columns: 1fr;
          }

          .pesquisa-admin-section-header,
          .pesquisa-publicacao-card,
          .pesquisa-publicacao-actions,
          .pesquisa-publicacao-actions button,
          .pesquisa-question-admin-card,
          .pesquisa-admin-section-header .btn-primary {
            width: 100%;
          }

          .pesquisa-admin-section-header,
          .pesquisa-publicacao-card,
          .pesquisa-question-admin-card {
            flex-direction: column;
          }

          .pesquisa-team-link-card {
            grid-template-columns: 1fr;
          }

          .pesquisa-links-modal__header {
            align-items: flex-start;
            flex-direction: column;
          }

          .pesquisa-team-response-badges {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

function StructuredAiReport({ result }: { result: PesquisaSatisfacaoRelatorioIAResultado }) {
  const normalizedResult = normalizeAiReportForDisplay(result);
  const general = normalizedResult.resumoGeral;

  return (
    <div className="pesquisa-ai-structured">
      <section>
        <h3>Visão executiva</h3>
        <p>{general.sintese}</p>
      </section>

      <section>
        <h3>Pontos fortes</h3>
        <TextList items={general.pontosFortes} empty="Nenhum ponto forte sustentado pelas respostas." />
      </section>

      <section>
        <h3>Principais problemas</h3>
        <div className="pesquisa-ai-complaints">
          {general.principaisProblemas.length === 0
            ? <p>Nenhum ponto negativo recorrente identificado nas respostas.</p>
            : general.principaisProblemas.map((problem, index) => (
              <article className="pesquisa-ai-complaint" key={`${problem.tema}-${index}`}>
                <div className="pesquisa-ai-complaint-meta">
                  <h4>{problem.tema}</h4>
                  <Badge tone="muted">~{problem.ocorrenciasAproximadas} relatos</Badge>
                </div>
                <p>{problem.resumo}</p>
                <OriginTeamBadges teams={problem.equipesOrigem} />
              </article>
            ))}
        </div>
      </section>

      <section>
        <h3>Equipes de origem mais presentes nos pontos negativos</h3>
        {general.equipesMaisCitadas.length === 0
          ? <p>Nenhuma equipe de origem foi identificada nos pontos negativos.</p>
          : (
            <ul className="pesquisa-ai-list">
              {general.equipesMaisCitadas.map((team) => (
                <li key={team.equipe}>
                  <strong>{team.equipe}</strong> — cerca de {team.ocorrenciasAproximadas} ocorrências. {team.contexto}
                </li>
              ))}
            </ul>
          )}
      </section>

      <section>
        <h3>Análise por pergunta</h3>
        {normalizedResult.perguntas.map((question) => (
          <details className="pesquisa-ai-question" key={question.questionId ?? question.pergunta}>
            <summary>{question.pergunta}</summary>
            <div className="pesquisa-ai-question-body">
              <div className="pesquisa-ai-question-meta">
                <Badge tone="muted">{question.secao}</Badge>
                <Badge>{question.quantidadeRespostas} respostas</Badge>
              </div>
              <p>{question.resumo}</p>
              <div>
                <h4>Pontos positivos</h4>
                <TextList items={question.pontosPositivos} empty="Nenhum ponto positivo identificado." />
              </div>
              <div>
                <h4>Pontos negativos</h4>
                {question.pontosNegativos.length === 0
                  ? <p>Nenhum ponto negativo identificado.</p>
                  : (
                    <div className="pesquisa-ai-complaints">
                      {question.pontosNegativos.map((point, index) => (
                        <article className="pesquisa-ai-complaint" key={`${point.ponto}-${index}`}>
                          <div className="pesquisa-ai-complaint-meta">
                            <strong>{point.ponto}</strong>
                            <Badge tone="muted">~{point.ocorrenciasAproximadas} relatos</Badge>
                            <Badge tone={point.recorrencia === 'recorrente' ? 'warning' : 'muted'}>
                              {point.recorrencia}
                            </Badge>
                          </div>
                          <p>{point.descricao}</p>
                          <OriginTeamBadges teams={point.equipesOrigem} />
                        </article>
                      ))}
                    </div>
                  )}
              </div>
              <div>
                <h4>Sugestões mencionadas nas respostas</h4>
                <TextList
                  items={question.sugestoesMencionadas}
                  empty="Nenhuma sugestão de melhoria identificada nas respostas."
                />
              </div>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

function asAiObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asAiArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asAiStringArray(value: unknown) {
  return asAiArray(value).filter((item): item is string => typeof item === 'string' && !!item.trim());
}

function normalizeAiOriginTeams(value: unknown) {
  return asAiArray(value)
    .map((item) => {
      const team = asAiObject(item);
      const nome = typeof team.nome === 'string' ? team.nome : '';
      const count = Number(team.ocorrenciasAproximadas);
      return nome ? {
        nome,
        ocorrenciasAproximadas: Number.isFinite(count) ? count : 1,
      } : null;
    })
    .filter((item): item is { nome: string; ocorrenciasAproximadas: number } => Boolean(item));
}

function normalizeAiReportForDisplay(value: unknown): PesquisaSatisfacaoRelatorioIAResultado {
  const report = asAiObject(value);
  const metadata = asAiObject(report.metadata);
  const general = asAiObject(report.resumoGeral);
  const questions = asAiArray(report.perguntas).map((item) => {
    const question = asAiObject(item);
    const negativePoints: PesquisaSatisfacaoRelatorioIAResultado['perguntas'][number]['pontosNegativos'] = [];
    const seen = new Set<string>();
    const addNegativePoint = (candidate: unknown, recurring = false) => {
      const point = asAiObject(candidate);
      const title = typeof point.ponto === 'string'
        ? point.ponto
        : typeof point.tema === 'string'
          ? point.tema
          : typeof candidate === 'string'
            ? candidate
            : '';
      const key = title.trim().toLocaleLowerCase('pt-BR');
      if (!key || seen.has(key)) return;
      seen.add(key);
      const count = Number(point.ocorrenciasAproximadas);
      negativePoints.push({
        ponto: title,
        descricao: typeof point.descricao === 'string' ? point.descricao : title,
        equipesOrigem: normalizeAiOriginTeams(point.equipesOrigem),
        ocorrenciasAproximadas: Number.isFinite(count) ? count : 1,
        recorrencia: point.recorrencia === 'recorrente' || recurring ? 'recorrente' : 'pontual',
      });
    };

    // Compatibilidade com relatórios v5: reclamações continham as equipes de origem.
    asAiArray(question.reclamacoes).forEach((point) => addNegativePoint(point));
    asAiArray(question.pontosNegativos).forEach((point) => addNegativePoint(point));
    asAiArray(question.pontosAtencaoRecorrentes).forEach((point) => addNegativePoint(point, true));

    return {
      questionId: typeof question.questionId === 'string' ? question.questionId : null,
      pergunta: typeof question.pergunta === 'string' ? question.pergunta : 'Pergunta sem título',
      secao: typeof question.secao === 'string' ? question.secao : 'Sem seção',
      tipo: question.tipo as PesquisaSatisfacaoQuestion['type'],
      quantidadeRespostas: Number(question.quantidadeRespostas) || 0,
      resumo: typeof question.resumo === 'string' ? question.resumo : '',
      pontosPositivos: asAiStringArray(question.pontosPositivos),
      pontosNegativos: negativePoints,
      sugestoesMencionadas: asAiStringArray(
        question.sugestoesMencionadas ?? question.sugestoesDeMelhoria,
      ),
    };
  });

  return {
    metadata: {
      encontroId: String(metadata.encontroId ?? ''),
      generatedAt: String(metadata.generatedAt ?? ''),
      totalQuestions: Number(metadata.totalQuestions) || questions.length,
      totalAnswers: Number(metadata.totalAnswers) || 0,
      totalRespondents: Number(metadata.totalRespondents) || 0,
      reportVersion: Number(metadata.reportVersion) || 1,
      promptVersion: String(metadata.promptVersion ?? ''),
    },
    resumoGeral: {
      sintese: typeof general.sintese === 'string' ? general.sintese : '',
      pontosFortes: asAiStringArray(general.pontosFortes),
      principaisProblemas: asAiArray(general.principaisProblemas).map((item) => {
        const problem = asAiObject(item);
        const count = Number(problem.ocorrenciasAproximadas);
        return {
          tema: typeof problem.tema === 'string' ? problem.tema : 'Ponto negativo',
          resumo: typeof problem.resumo === 'string'
            ? problem.resumo
            : typeof problem.descricao === 'string'
              ? problem.descricao
              : '',
          equipesOrigem: normalizeAiOriginTeams(problem.equipesOrigem),
          ocorrenciasAproximadas: Number.isFinite(count) ? count : 1,
        };
      }),
      equipesMaisCitadas: asAiArray(general.equipesMaisCitadas).map((item) => {
        const team = asAiObject(item);
        return {
          equipe: typeof team.equipe === 'string' ? team.equipe : 'Equipe não identificada',
          ocorrenciasAproximadas: Number(team.ocorrenciasAproximadas) || 1,
          contexto: typeof team.contexto === 'string' ? team.contexto : '',
        };
      }),
    },
    perguntas: questions,
  };
}

function TextList({ items = [], empty }: { items?: string[]; empty?: string }) {
  if (items.length === 0) return empty ? <p>{empty}</p> : null;
  return <ul className="pesquisa-ai-list">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>;
}

function OriginTeamBadges({ teams = [] }: {
  teams?: Array<{ nome: string; ocorrenciasAproximadas: number }>;
}) {
  if (teams.length === 0) return null;
  return (
    <div className="pesquisa-ai-teams">
      {teams.map((team) => (
        <Badge key={team.nome} tone="muted">
          {team.nome}: ~{team.ocorrenciasAproximadas}
        </Badge>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, tone = 'primary' }: { label: string; value: string | number; icon?: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'muted' }) {
  return (
    <article className="card pesquisa-stat-card">
      <div className={`pesquisa-stat-icon pesquisa-badge--${tone}`}>
        {icon ?? <ClipboardList size={20} />}
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="pesquisa-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Badge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'muted' }) {
  return <span className={`pesquisa-badge pesquisa-badge--${tone}`}>{children}</span>;
}

function QuestionSummaryCard({
  summary,
  onViewAll,
}: {
  summary: PesquisaSatisfacaoPerguntaResumo;
  onViewAll: () => void;
}) {
  const maxCount = Math.max(...(summary.opcoes?.map((item) => item.count) ?? [0]), 1);

  return (
    <article className="pesquisa-question-summary">
      <h3>{summary.pergunta.title}</h3>
      <Badge tone="muted">{summary.pergunta.sectionTitle}</Badge>
      <Badge>{summary.totalRespondidas} respostas</Badge>
      {typeof summary.media === 'number' && <Badge tone="success">Média {summary.media.toFixed(1)}</Badge>}

      {summary.opcoes && (
        <div className="pesquisa-bars">
          {summary.opcoes.map((option) => (
            <div className="pesquisa-bar-row" key={option.label}>
              <span>{option.label}</span>
              <div className="pesquisa-bar-track"><span style={{ width: `${(option.count / maxCount) * 100}%` }} /></div>
              <strong>{option.count}</strong>
            </div>
          ))}
        </div>
      )}

      {summary.textos && summary.textos.length > 0 && (
        <div className="pesquisa-text-samples">
          {summary.textos.slice(0, 6).map((item, index) => (
            <article key={`${item.equipeNome}-${index}`}>
              <strong>{item.equipeNome}</strong>
              <p>{item.texto}</p>
            </article>
          ))}
          {summary.textos.length > 6 && (
            <button type="button" className="pesquisa-more-responses" onClick={onViewAll}>
              <Badge tone="muted">+{summary.textos.length - 6} respostas</Badge>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
