import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  Loader,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { useEncontros } from '../../contexts/EncontroContext';
import { pesquisaEncontristaService } from '../../services/pesquisaEncontristaService';
import type {
  PesquisaEncontristaConfig,
  PesquisaEncontristaEquipeResumo,
  PesquisaEncontristaEnvio,
  PesquisaEncontristaPainel,
  PesquisaEncontristaPerguntaResumo,
  PesquisaEncontristaResumoIA,
} from '../../types/pesquisaEncontrista';
import type {
  PesquisaSatisfacaoPerguntaFormData,
  PesquisaSatisfacaoQuestion,
  PesquisaSatisfacaoQuestionType,
} from '../../types/pesquisaSatisfacao';

const typeLabels: Record<PesquisaSatisfacaoQuestionType, string> = {
  sim_nao_partes: 'Sim, Não e Em partes',
  texto: 'Texto livre',
  nota: 'Nota 1 a 10',
  sim_nao: 'Sim ou Não',
  sim_nao_texto: 'Sim ou Não + detalhe',
};

const MAX_RESUMOS_IA_POR_ENCONTRO = 5;

type Tab = 'resumo' | 'perguntas' | 'respostas' | 'equipes';

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'geral';
}

function emptyForm(encontroId: string, ordem: number): PesquisaSatisfacaoPerguntaFormData {
  return {
    encontro_id: encontroId,
    ordem,
    section_id: 'avaliacao_geral',
    section_title: 'Avaliação Geral do Encontro',
    title: '',
    type: 'sim_nao_partes',
    required: true,
    active: true,
  };
}

export function AvaliacaoEncontristasPage() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();
  const [encontroId, setEncontroId] = useState('');
  const [config, setConfig] = useState<PesquisaEncontristaConfig | null>(null);
  const [perguntas, setPerguntas] = useState<PesquisaSatisfacaoQuestion[]>([]);
  const [envios, setEnvios] = useState<PesquisaEncontristaEnvio[]>([]);
  const [painel, setPainel] = useState<PesquisaEncontristaPainel | null>(null);
  const [equipeResumos, setEquipeResumos] = useState<PesquisaEncontristaEquipeResumo[]>([]);
  const [resumosIA, setResumosIA] = useState<PesquisaEncontristaResumoIA[]>([]);
  const [tab, setTab] = useState<Tab>('resumo');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingResumoIA, setGeneratingResumoIA] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEnvio, setSelectedEnvio] = useState<PesquisaEncontristaEnvio | null>(null);
  const [responsesModalSummary, setResponsesModalSummary] = useState<PesquisaEncontristaPerguntaResumo | null>(null);
  const [selectedEquipeResumo, setSelectedEquipeResumo] = useState<PesquisaEncontristaEquipeResumo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PesquisaSatisfacaoPerguntaFormData>(emptyForm('', 1));

  useEffect(() => {
    if (!encontroId && encontros.length) setEncontroId(encontroAtivo?.id ?? encontros[0].id);
  }, [encontroId, encontroAtivo, encontros]);

  useEffect(() => {
    if (!encontroId) return;
    setLoading(true);
    Promise.all([
      pesquisaEncontristaService.obterConfig(encontroId),
      pesquisaEncontristaService.listarPerguntas(encontroId),
      pesquisaEncontristaService.listarEnvios(encontroId),
      pesquisaEncontristaService.listarPainel(encontroId),
      pesquisaEncontristaService.listarResumoEscolhasEquipes(encontroId),
    ])
      .then(([nextConfig, nextPerguntas, nextEnvios, nextPainel, nextEquipeResumos]) => {
        setConfig(nextConfig);
        setPerguntas(nextPerguntas);
        setEnvios(nextEnvios);
        setPainel(nextPainel);
        setEquipeResumos(nextEquipeResumos);
      })
      .catch((error) => {
        console.error(error);
        toast.error('Não foi possível carregar a pesquisa dos encontristas.');
      })
      .finally(() => setLoading(false));

    pesquisaEncontristaService.listarResumosIA(encontroId)
      .then(setResumosIA)
      .catch((error) => {
        console.warn('Não foi possível carregar os relatórios de IA dos encontristas.', error);
        setResumosIA([]);
      });
  }, [encontroId]);

  const sections = useMemo(() => {
    const result = new Map<string, PesquisaSatisfacaoQuestion[]>();
    perguntas.forEach((pergunta) => {
      const key = pergunta.sectionTitle;
      result.set(key, [...(result.get(key) ?? []), pergunta]);
    });
    return Array.from(result.entries());
  }, [perguntas]);

  const completion = painel?.totalParticipantes
    ? (painel.totalEnviados / painel.totalParticipantes) * 100
    : 0;
  const ultimoResumoIA = resumosIA.find((item) => item.status === 'completed') ?? null;
  const relatorioAtual = resumosIA[0] ?? null;
  const totalResumosIA = resumosIA.length;
  const limiteResumosIAAtingido = totalResumosIA >= MAX_RESUMOS_IA_POR_ENCONTRO;
  const podeGerarResumoIA = !!encontroId && (painel?.totalEnviados ?? 0) > 0 && !generatingResumoIA && !limiteResumosIAAtingido;

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm(encontroId, Math.max(0, ...perguntas.map(item => item.ordem ?? 0)) + 1));
    setShowForm(true);
  };

  const openEdit = (pergunta: PesquisaSatisfacaoQuestion) => {
    setEditingId(pergunta.id);
    setForm({
      encontro_id: encontroId,
      ordem: pergunta.ordem ?? 1,
      section_id: pergunta.sectionId,
      section_title: pergunta.sectionTitle,
      title: pergunta.title,
      type: pergunta.type,
      required: pergunta.required ?? true,
      active: pergunta.active ?? true,
    });
    setShowForm(true);
  };

  const saveQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.section_title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        section_title: form.section_title.trim(),
        section_id: slug(form.section_title),
      };
      if (editingId) await pesquisaEncontristaService.atualizarPergunta(editingId, payload);
      else await pesquisaEncontristaService.criarPergunta(payload);
      setPerguntas(await pesquisaEncontristaService.listarPerguntas(encontroId));
      setShowForm(false);
      toast.success(editingId ? 'Pergunta atualizada.' : 'Pergunta criada.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar a pergunta.');
    } finally {
      setSaving(false);
    }
  };

  const removeQuestion = async (pergunta: PesquisaSatisfacaoQuestion) => {
    if (!window.confirm(`Remover a pergunta “${pergunta.title}”?`)) return;
    try {
      await pesquisaEncontristaService.excluirPergunta(pergunta.id);
      setPerguntas(await pesquisaEncontristaService.listarPerguntas(encontroId));
      toast.success('Pergunta removida.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível remover a pergunta.');
    }
  };

  const togglePublication = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const next = await pesquisaEncontristaService.atualizarPublicacao(encontroId, !config.publicada);
      setConfig(next);
      toast.success(next.publicada ? 'Pesquisa publicada para os encontristas.' : 'Pesquisa despublicada.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível alterar a publicação.');
    } finally {
      setSaving(false);
    }
  };

  const answerText = (envio: PesquisaEncontristaEnvio, pergunta: PesquisaSatisfacaoQuestion) => {
    const resposta = envio.respostas[pergunta.id];
    if (!resposta) return 'Sem resposta';
    if (pergunta.type === 'nota') return resposta.nota ? `Nota ${resposta.nota}` : 'Sem resposta';
    if (pergunta.type === 'sim_nao') return resposta.simNao === 'sim' ? 'Sim' : resposta.simNao === 'nao' ? 'Não' : 'Sem resposta';
    if (pergunta.type === 'sim_nao_texto') {
      if (resposta.simNao === 'nao') return 'Não';
      return resposta.simNao === 'sim' ? `Sim — ${resposta.texto?.trim() || 'sem detalhe'}` : 'Sem resposta';
    }
    if (pergunta.type === 'sim_nao_partes') {
      const option = resposta.opcao === 'sim' ? 'Sim' : resposta.opcao === 'nao' ? 'Não' : resposta.opcao === 'em_partes' ? 'Em partes' : '';
      return [option, resposta.observacao?.trim()].filter(Boolean).join(' — ') || 'Sem resposta';
    }
    return resposta.texto?.trim() || 'Sem resposta';
  };

  const gerarResumoIA = async () => {
    if (limiteResumosIAAtingido) {
      toast.error(`Limite de ${MAX_RESUMOS_IA_POR_ENCONTRO} relatórios atingido para este encontro.`);
      return;
    }
    if (!podeGerarResumoIA) return;
    setGeneratingResumoIA(true);
    try {
      const report = await pesquisaEncontristaService.gerarResumoIA(encontroId);
      setResumosIA((current) => [report, ...current.filter((item) => item.id !== report.id)]);
      toast.success('Relatório dos encontristas concluído.');
      setResumosIA(await pesquisaEncontristaService.listarResumosIA(encontroId));
    } catch (error) {
      console.error('Erro ao gerar relatório IA dos encontristas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar relatório.');
      setResumosIA(await pesquisaEncontristaService.listarResumosIA(encontroId));
    } finally {
      setGeneratingResumoIA(false);
    }
  };

  return (
    <div className="pesquisa-encontristas-admin">
      <header className="pesquisa-encontristas-admin__header">
        <button className="icon-btn" onClick={() => navigate('/cadastros')} title="Voltar"><ChevronLeft /></button>
        <div>
          <span>Cadastro e acompanhamento</span>
          <h1>Pesquisa dos encontristas</h1>
          <p>A avaliação aparece antes da ficha pós-encontro e da escolha das equipes.</p>
        </div>
        <select className="form-input" value={encontroId} onChange={event => setEncontroId(event.target.value)}>
          {encontros.map(encontro => <option key={encontro.id} value={encontro.id}>{encontro.nome}</option>)}
        </select>
      </header>

      <div className="pesquisa-encontristas-admin__toolbar card">
        <div>
          <strong>{config?.publicada ? 'Pesquisa publicada' : 'Pesquisa não publicada'}</strong>
          <span>{config?.publicada ? 'Os encontristas devem respondê-la antes da ficha.' : 'O acesso segue diretamente para a ficha atual.'}</span>
        </div>
        <button className={config?.publicada ? 'btn-secondary' : 'btn-primary'} onClick={togglePublication} disabled={saving || loading}>
          {saving ? <Loader className="animate-spin" size={16} /> : <ClipboardCheck size={16} />}
          {config?.publicada ? 'Despublicar' : 'Publicar pesquisa'}
        </button>
      </div>

      <nav className="pesquisa-encontristas-admin__tabs">
        <button className={tab === 'perguntas' ? 'is-active' : ''} onClick={() => setTab('perguntas')}>
          <span>Perguntas</span>
          <strong>{perguntas.filter(item => item.active !== false).length}</strong>
        </button>
        <button className={tab === 'respostas' ? 'is-active' : ''} onClick={() => setTab('respostas')}>
          <span>Respostas</span>
          <strong>{envios.length}</strong>
        </button>
        <button className={tab === 'resumo' ? 'is-active' : ''} onClick={() => setTab('resumo')}>
          <span>Resumo</span>
        </button>
        <button className={tab === 'equipes' ? 'is-active' : ''} onClick={() => setTab('equipes')}>
          <span>Opções de equipes</span>
          <strong>{equipeResumos.length}</strong>
        </button>
      </nav>

      {loading ? (
        <div className="pesquisa-encontristas-admin__loading"><Loader className="animate-spin" /></div>
      ) : tab === 'resumo' ? (
        <section className="pesquisa-encontristas-admin__dashboard">
          <div className="pesquisa-encontristas-admin__section-heading">
            <div>
              <h2>Visão geral</h2>
              <p>Acompanhamento da participação dos encontristas e consolidação das respostas enviadas.</p>
            </div>
          </div>

          <div className="pesquisa-encontristas-admin__metrics">
            <article className="card">
              <Users />
              <span>Encontristas</span>
              <strong>{painel?.totalParticipantes ?? 0}</strong>
            </article>
            <article className="card is-success">
              <CheckCircle2 />
              <span>Concluídas</span>
              <strong>{painel?.totalEnviados ?? 0}</strong>
            </article>
            <article className="card is-warning">
              <Clock3 />
              <span>Rascunhos</span>
              <strong>{painel?.totalRascunhos ?? 0}</strong>
            </article>
            <article className="card is-muted">
              <CircleDashed />
              <span>Pendentes</span>
              <strong>{painel?.totalPendentes ?? 0}</strong>
            </article>
          </div>

          <article className="card pesquisa-encontristas-admin__progress-card">
            <div>
              <BarChart3 />
              <div>
                <strong>{Math.round(completion)}% concluído</strong>
                <span>{painel?.totalEnviados ?? 0} de {painel?.totalParticipantes ?? 0} encontristas enviaram a avaliação</span>
              </div>
            </div>
            <div className="pesquisa-encontristas-admin__progress">
              <span style={{ width: `${Math.min(completion, 100)}%` }} />
            </div>
          </article>

          <div className="pesquisa-encontristas-admin__section-heading">
            <div>
              <h2>Resumo por pergunta</h2>
              <p>Os indicadores consideram somente avaliações concluídas.</p>
            </div>
          </div>
          <div className="pesquisa-encontristas-admin__question-summaries">
            {painel?.perguntaResumos.length
              ? painel.perguntaResumos.map((resumo) => (
                <QuestionSummary
                  key={resumo.pergunta.id}
                  resumo={resumo}
                  onViewAll={() => setResponsesModalSummary(resumo)}
                />
              ))
              : <article className="card pesquisa-encontristas-admin__empty">Nenhuma pergunta ativa para resumir.</article>}
          </div>

          <section className="pesquisa-encontristas-admin__manual-ai">
            <div className="pesquisa-encontristas-admin__section-heading">
              <div>
                <h2>Resumo com IA</h2>
                <p>Gere manualmente uma consolidação dos principais pontos citados na avaliação.</p>
                <span className="pesquisa-encontristas-admin__ai-limit">
                  {Math.min(totalResumosIA, MAX_RESUMOS_IA_POR_ENCONTRO)} de {MAX_RESUMOS_IA_POR_ENCONTRO} relatórios gerados neste encontro
                </span>
              </div>
              <button type="button" className="btn-primary" onClick={gerarResumoIA} disabled={!podeGerarResumoIA}>
                {generatingResumoIA ? <Loader className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {limiteResumosIAAtingido ? 'Limite atingido' : ultimoResumoIA ? 'Gerar novo relatório' : 'Gerar relatório com IA'}
              </button>
            </div>

            {limiteResumosIAAtingido && (
              <article className="card pesquisa-encontristas-admin__ai-status">
                <Sparkles size={18} />
                <div>
                  <strong>Limite de relatórios atingido</strong>
                  <p>Este encontro já possui {MAX_RESUMOS_IA_POR_ENCONTRO} relatórios gerados com IA.</p>
                </div>
              </article>
            )}

            {generatingResumoIA && (
              <article className="card pesquisa-encontristas-admin__ai-status">
                <Loader className="animate-spin" size={18} />
                <div>
                  <strong>Gerando relatório...</strong>
                  <p>Isso pode levar alguns segundos. Mantenha a tela aberta até concluir.</p>
                </div>
              </article>
            )}

            {relatorioAtual?.status === 'error' && (
              <article className="card pesquisa-encontristas-admin__ai-error">
                <strong>O último relatório falhou.</strong>
                <p>{relatorioAtual.erro_mensagem || 'Tente gerar novamente.'}</p>
              </article>
            )}

            {ultimoResumoIA?.resultado ? (
              <AiReportEncontristas report={ultimoResumoIA} />
            ) : (
              !generatingResumoIA && <article className="card pesquisa-encontristas-admin__empty">Nenhum relatório de IA gerado para este encontro.</article>
            )}
          </section>

          <div className="pesquisa-encontristas-admin__section-heading">
            <div>
              <h2>Acompanhamento individual</h2>
              <p>Inclui quem ainda não iniciou a avaliação.</p>
            </div>
          </div>
          <div className="card pesquisa-encontristas-admin__respondents">
            {!painel?.respondentes.length ? <p>Nenhum encontrista cadastrado neste encontro.</p> : painel.respondentes.map((respondente) => (
              <div key={respondente.participacaoId}>
                <Users size={17} />
                <strong>{respondente.nome}</strong>
                <span className={`pesquisa-status pesquisa-status--${respondente.status}`}>
                  {respondente.status === 'enviado' ? 'Enviada' : respondente.status === 'rascunho' ? 'Rascunho' : 'Pendente'}
                </span>
                <small>{respondente.enviadoEm ? new Date(respondente.enviadoEm).toLocaleString('pt-BR') : '—'}</small>
              </div>
            ))}
          </div>
        </section>
      ) : tab === 'perguntas' ? (
        <section>
          <div className="pesquisa-encontristas-admin__section-heading">
            <div><h2>Perguntas</h2><p>Use as mesmas modalidades da pesquisa das equipes.</p></div>
            <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nova pergunta</button>
          </div>

          {showForm && (
            <form className="card pesquisa-encontristas-admin__form" onSubmit={saveQuestion}>
              <h3>{editingId ? 'Editar pergunta' : 'Nova pergunta'}</h3>
              <label>Seção<input className="form-input" value={form.section_title} onChange={event => setForm(current => ({ ...current, section_title: event.target.value }))} required /></label>
              <label>Pergunta<textarea className="form-input" rows={3} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} required /></label>
              <div className="pesquisa-encontristas-admin__form-grid">
                <label>Tipo<select className="form-input" value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value as PesquisaSatisfacaoQuestionType }))}>
                  {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <label>Ordem<input className="form-input" type="number" min={1} value={form.ordem} onChange={event => setForm(current => ({ ...current, ordem: Number(event.target.value) }))} /></label>
              </div>
              <label className="pesquisa-encontristas-admin__check"><input type="checkbox" checked={form.required} onChange={event => setForm(current => ({ ...current, required: event.target.checked }))} /> Resposta obrigatória</label>
              <div className="pesquisa-encontristas-admin__actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary" disabled={saving}>{saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />} Salvar</button>
              </div>
            </form>
          )}

          <div className="pesquisa-encontristas-admin__sections">
            {sections.map(([title, items]) => (
              <article className="card" key={title}>
                <h3>{title}</h3>
                {items.map(pergunta => (
                  <div className={`pesquisa-encontristas-admin__question ${pergunta.active === false ? 'is-inactive' : ''}`} key={pergunta.id}>
                    <span>{pergunta.ordem}</span>
                    <div><strong>{pergunta.title}</strong><small>{typeLabels[pergunta.type]}{pergunta.required ? ' · obrigatória' : ' · opcional'}</small></div>
                    <button className="icon-btn" onClick={() => openEdit(pergunta)} title="Editar"><Pencil size={16} /></button>
                    {pergunta.active !== false && <button className="icon-btn" onClick={() => removeQuestion(pergunta)} title="Remover"><Trash2 size={16} /></button>}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : tab === 'respostas' ? (
        <section>
          <div className="pesquisa-encontristas-admin__section-heading">
            <div><h2>Respostas recebidas</h2><p>Rascunhos e pesquisas concluídas pelos encontristas.</p></div>
          </div>
          <div className="card pesquisa-encontristas-admin__responses">
            {!envios.length ? <p>Nenhuma resposta iniciada até agora.</p> : envios.map(envio => (
              <div key={envio.id}>
                <Users size={17} />
                <strong>{envio.participacoes?.pessoas?.nome_completo ?? 'Encontrista'}</strong>
                <span className={`pesquisa-status pesquisa-status--${envio.status}`}>{envio.status === 'enviado' ? 'Enviada' : 'Rascunho'}</span>
                <small>{new Date(envio.enviado_em ?? envio.updated_at).toLocaleString('pt-BR')}</small>
                <button className="btn-secondary" onClick={() => setSelectedEnvio(envio)}>
                  Ver respostas
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : tab === 'equipes' ? (
        <section>
          <div className="pesquisa-encontristas-admin__section-heading">
            <div>
              <h2>Opções de equipes preenchidas</h2>
              <p>Resumo das escolhas feitas na ficha pós-encontro, separadas por ordem de preferência.</p>
            </div>
          </div>

          <div className="pesquisa-encontristas-admin__team-choice-grid">
            {!equipeResumos.length ? (
              <article className="card pesquisa-encontristas-admin__empty">Nenhuma escolha de equipe preenchida até agora.</article>
            ) : equipeResumos.map((resumo) => (
              <article className="card pesquisa-encontristas-admin__team-choice" key={resumo.equipeId}>
                <header>
                  <div>
                    <span>Equipe</span>
                    <h3>{resumo.equipeNome}</h3>
                  </div>
                  <strong>{resumo.total}</strong>
                </header>
                <div className="pesquisa-encontristas-admin__team-choice-counts">
                  <span><strong>{resumo.primeiraOpcao}</strong> 1ª opção</span>
                  <span><strong>{resumo.segundaOpcao}</strong> 2ª opção</span>
                  <span><strong>{resumo.terceiraOpcao}</strong> 3ª opção</span>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setSelectedEquipeResumo(resumo)}>
                  Ver quem escolheu
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <Modal
        isOpen={!!selectedEquipeResumo}
        onClose={() => setSelectedEquipeResumo(null)}
        title="Encontristas por opção de equipe"
        maxWidth="760px"
      >
        {selectedEquipeResumo && (
          <div className="pesquisa-encontristas-admin__team-choice-modal">
            <header>
              <span>{selectedEquipeResumo.total} escolha(s)</span>
              <h3>{selectedEquipeResumo.equipeNome}</h3>
              <p>{selectedEquipeResumo.primeiraOpcao} como 1ª opção · {selectedEquipeResumo.segundaOpcao} como 2ª · {selectedEquipeResumo.terceiraOpcao} como 3ª</p>
            </header>
            <div className="pesquisa-encontristas-admin__team-choice-list">
              {[1, 2, 3].map((ordem) => {
                const escolhas = selectedEquipeResumo.escolhas.filter((item) => item.ordemPreferencia === ordem);
                return (
                  <section key={ordem}>
                    <h4>{ordem}ª opção ({escolhas.length})</h4>
                    {escolhas.length ? escolhas.map((item) => (
                      <article key={`${item.participacaoId}-${ordem}`} className="pesquisa-encontristas-admin__team-choice-person">
                        <header>
                          <Users size={16} />
                          <strong>{item.nome}</strong>
                        </header>
                        <div className="pesquisa-encontristas-admin__team-choice-tags">
                          <span>{item.tocaInstrumento ? `Toca: ${item.instrumentos || 'instrumento não informado'}` : 'Não toca instrumento'}</span>
                          <span>{item.temCarro ? 'Tem carro' : 'Sem carro'}</span>
                          <span>{item.temMoto ? 'Tem moto' : 'Sem moto'}</span>
                        </div>
                        {!!item.preferencias.length && (
                          <ol className="pesquisa-encontristas-admin__team-choice-preferences">
                            {item.preferencias.map((preferencia) => (
                              <li key={`${item.participacaoId}-${preferencia.equipeId}`}>
                                {preferencia.ordemPreferencia}ª opção: <strong>{preferencia.equipeNome}</strong>
                              </li>
                            ))}
                          </ol>
                        )}
                        {item.observacoes && <p>{item.observacoes}</p>}
                      </article>
                    )) : <p>Ninguém marcou esta ordem de preferência.</p>}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedEnvio}
        onClose={() => setSelectedEnvio(null)}
        title="Respostas do encontrista"
        maxWidth="760px"
      >
        {selectedEnvio && (
          <div className="pesquisa-encontristas-admin__answer-modal">
            <header>
              <span>{selectedEnvio.status === 'enviado' ? 'Avaliação enviada' : 'Rascunho salvo'}</span>
              <h3>{selectedEnvio.participacoes?.pessoas?.nome_completo ?? 'Encontrista'}</h3>
              <p>{new Date(selectedEnvio.enviado_em ?? selectedEnvio.updated_at).toLocaleString('pt-BR')}</p>
            </header>
            <div className="pesquisa-encontristas-admin__answer-list">
              {perguntas.filter(item => item.active !== false).map(pergunta => (
                <article key={pergunta.id}>
                  <strong>{pergunta.title}</strong>
                  <p>{answerText(selectedEnvio, pergunta)}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!responsesModalSummary}
        onClose={() => setResponsesModalSummary(null)}
        title="Todas as respostas"
        maxWidth="760px"
      >
        {responsesModalSummary && (
          <div className="pesquisa-encontristas-admin__all-responses">
            <header>
              <span>{responsesModalSummary.pergunta.sectionTitle}</span>
              <h3>{responsesModalSummary.pergunta.title}</h3>
              <p>{responsesModalSummary.textos?.length ?? 0} comentários dos encontristas.</p>
            </header>
            <div className="pesquisa-encontristas-admin__all-responses-list">
              {(responsesModalSummary.textos ?? []).map((item, index) => (
                <article key={`${item.nome}-${index}`}>
                  <strong>{item.nome}</strong>
                  <p>{item.texto}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        .pesquisa-encontristas-admin { display: grid; gap: 1rem; max-width: 100%; overflow-x: hidden; padding: 1.25rem; }
        .pesquisa-encontristas-admin * { min-width: 0; }
        .pesquisa-encontristas-admin__header { align-items: center; display: grid; gap: 1rem; grid-template-columns: auto 1fr minmax(220px, 320px); }
        .pesquisa-encontristas-admin__header h1, .pesquisa-encontristas-admin__header p { margin: 0; }
        .pesquisa-encontristas-admin__header h1 { font-size: clamp(1.45rem, 4vw, 2.1rem); line-height: 1.1; overflow-wrap: anywhere; }
        .pesquisa-encontristas-admin__header span { color: var(--primary-color); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__header p, .pesquisa-encontristas-admin__toolbar span, .pesquisa-encontristas-admin__section-heading p { color: var(--muted-text); }
        .pesquisa-encontristas-admin__toolbar { align-items: center; display: flex; justify-content: space-between; padding: 1rem; }
        .pesquisa-encontristas-admin__toolbar span { display: block; font-size: .85rem; margin-top: .2rem; }
        .pesquisa-encontristas-admin__tabs { background: color-mix(in srgb, var(--card-bg) 82%, var(--primary-color) 18%); border: 1px solid var(--border-color); border-radius: 18px; box-shadow: inset 0 1px 0 rgba(255,255,255,.04); display: flex; gap: .45rem; overflow-x: auto; padding: .45rem; scrollbar-width: thin; }
        .pesquisa-encontristas-admin__tabs button { align-items: center; background: transparent; border: 1px solid transparent; border-radius: 14px; color: var(--muted-text); cursor: pointer; display: inline-flex; flex: 1 0 auto; font-weight: 800; gap: .55rem; justify-content: center; min-height: 46px; padding: .7rem 1rem; transition: background .18s ease, border-color .18s ease, color .18s ease, transform .18s ease; white-space: nowrap; }
        .pesquisa-encontristas-admin__tabs button:hover { background: color-mix(in srgb, var(--primary-color) 12%, transparent); color: var(--text-color); }
        .pesquisa-encontristas-admin__tabs button.is-active { background: linear-gradient(135deg, var(--primary-color), #2563eb); border-color: color-mix(in srgb, var(--primary-color) 65%, white 35%); box-shadow: 0 12px 28px rgba(37,99,235,.25); color: white; transform: translateY(-1px); }
        .pesquisa-encontristas-admin__tabs button strong { align-items: center; background: color-mix(in srgb, var(--muted-text) 16%, transparent); border-radius: 999px; color: inherit; display: inline-flex; font-size: .74rem; height: 24px; justify-content: center; min-width: 24px; padding: 0 .45rem; }
        .pesquisa-encontristas-admin__tabs button.is-active strong { background: rgba(255,255,255,.2); color: white; }
        .pesquisa-encontristas-admin__section-heading { align-items: center; display: flex; gap: .75rem; justify-content: space-between; margin: .5rem 0 1rem; }
        .pesquisa-encontristas-admin__section-heading h2, .pesquisa-encontristas-admin__section-heading p { margin: 0; }
        .pesquisa-encontristas-admin__sections { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__sections article { padding: 1rem; }
        .pesquisa-encontristas-admin__sections h3 { margin-top: 0; }
        .pesquisa-encontristas-admin__question { align-items: center; border-top: 1px solid var(--border-color); display: grid; gap: .75rem; grid-template-columns: 28px 1fr auto auto; padding: .8rem 0; }
        .pesquisa-encontristas-admin__question strong { overflow-wrap: anywhere; }
        .pesquisa-encontristas-admin__question > span { align-items: center; background: var(--secondary-bg); border-radius: 50%; display: flex; height: 28px; justify-content: center; }
        .pesquisa-encontristas-admin__question small { color: var(--muted-text); display: block; margin-top: .2rem; }
        .pesquisa-encontristas-admin__question.is-inactive { opacity: .5; }
        .pesquisa-encontristas-admin__form { display: grid; gap: .8rem; margin-bottom: 1rem; padding: 1rem; }
        .pesquisa-encontristas-admin__form h3 { margin: 0; }
        .pesquisa-encontristas-admin__form label { display: grid; font-size: .85rem; font-weight: 700; gap: .3rem; }
        .pesquisa-encontristas-admin__form-grid { display: grid; gap: .8rem; grid-template-columns: 1fr 120px; }
        .pesquisa-encontristas-admin__form .pesquisa-encontristas-admin__check { align-items: center; display: flex; }
        .pesquisa-encontristas-admin__actions { display: flex; gap: .5rem; justify-content: flex-end; }
        .pesquisa-encontristas-admin__dashboard { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__metrics { display: grid; gap: .85rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .pesquisa-encontristas-admin__metrics article { display: grid; gap: .25rem; grid-template-columns: auto 1fr; padding: 1rem; }
        .pesquisa-encontristas-admin__metrics svg { color: var(--primary-color); grid-row: 1 / 3; }
        .pesquisa-encontristas-admin__metrics span { color: var(--muted-text); font-size: .78rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__metrics strong { font-size: 1.75rem; line-height: 1; }
        .pesquisa-encontristas-admin__metrics .is-success svg { color: #16a34a; }
        .pesquisa-encontristas-admin__metrics .is-warning svg { color: #d97706; }
        .pesquisa-encontristas-admin__metrics .is-muted svg { color: var(--muted-text); }
        .pesquisa-encontristas-admin__progress-card { display: grid; gap: .85rem; padding: 1rem; }
        .pesquisa-encontristas-admin__progress-card > div:first-child { align-items: center; display: flex; gap: .75rem; }
        .pesquisa-encontristas-admin__progress-card svg { color: var(--primary-color); }
        .pesquisa-encontristas-admin__progress-card span { color: var(--muted-text); display: block; font-size: .84rem; margin-top: .2rem; }
        .pesquisa-encontristas-admin__progress { background: var(--secondary-bg); border-radius: 999px; height: 10px; overflow: hidden; }
        .pesquisa-encontristas-admin__progress > span { background: linear-gradient(90deg, var(--primary-color), #16a34a); border-radius: inherit; display: block; height: 100%; margin: 0; transition: width .25s ease; }
        .pesquisa-encontristas-admin__question-summaries { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pesquisa-encontristas-admin__summary { display: grid; gap: .8rem; padding: 1rem; }
        .pesquisa-encontristas-admin__summary header { align-items: flex-start; display: flex; gap: .65rem; }
        .pesquisa-encontristas-admin__summary header svg { color: var(--primary-color); flex: 0 0 auto; }
        .pesquisa-encontristas-admin__summary h3, .pesquisa-encontristas-admin__summary p { margin: 0; overflow-wrap: anywhere; }
        .pesquisa-encontristas-admin__summary header span { color: var(--muted-text); display: block; font-size: .78rem; margin-top: .2rem; }
        .pesquisa-encontristas-admin__average { color: var(--primary-color); font-size: 1.2rem; }
        .pesquisa-encontristas-admin__bars { display: grid; gap: .45rem; }
        .pesquisa-encontristas-admin__bar { align-items: center; display: grid; gap: .5rem; grid-template-columns: 70px 1fr 28px; }
        .pesquisa-encontristas-admin__bar > span { color: var(--muted-text); font-size: .78rem; }
        .pesquisa-encontristas-admin__bar-track { background: var(--secondary-bg); border-radius: 999px; height: 8px; overflow: hidden; }
        .pesquisa-encontristas-admin__bar-track span { background: var(--primary-color); display: block; height: 100%; }
        .pesquisa-encontristas-admin__comments { display: grid; gap: .5rem; }
        .pesquisa-encontristas-admin__comments div { background: var(--secondary-bg); border-radius: 8px; padding: .6rem; }
        .pesquisa-encontristas-admin__comments strong { display: block; font-size: .78rem; }
        .pesquisa-encontristas-admin__comments p { color: var(--muted-text); font-size: .82rem; margin-top: .15rem; white-space: pre-wrap; }
        .pesquisa-encontristas-admin__comments > span { color: var(--muted-text); font-size: .78rem; }
        .pesquisa-encontristas-admin__comments-more { align-self: flex-start; background: none; border: 0; color: var(--primary-color); cursor: pointer; font-size: .78rem; font-weight: 800; padding: 0; text-align: left; }
        .pesquisa-encontristas-admin__comments-more:hover { text-decoration: underline; }
        .pesquisa-encontristas-admin__all-responses { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__all-responses header { display: grid; gap: .25rem; }
        .pesquisa-encontristas-admin__all-responses header span { color: var(--primary-color); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__all-responses h3, .pesquisa-encontristas-admin__all-responses p { margin: 0; }
        .pesquisa-encontristas-admin__all-responses header p { color: var(--muted-text); }
        .pesquisa-encontristas-admin__all-responses-list { display: grid; gap: .75rem; }
        .pesquisa-encontristas-admin__all-responses-list article { background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: .85rem; }
        .pesquisa-encontristas-admin__all-responses-list strong { display: block; margin-bottom: .25rem; }
        .pesquisa-encontristas-admin__all-responses-list p { color: var(--muted-text); white-space: pre-wrap; }
        .pesquisa-encontristas-admin__empty { color: var(--muted-text); grid-column: 1 / -1; padding: 1rem; }
        .pesquisa-encontristas-admin__respondents { padding: 1rem; }
        .pesquisa-encontristas-admin__respondents > div { align-items: center; border-top: 1px solid var(--border-color); display: grid; gap: .6rem; grid-template-columns: auto 1fr auto minmax(120px, auto); padding: .75rem 0; }
        .pesquisa-encontristas-admin__respondents > div:first-child { border-top: 0; }
        .pesquisa-encontristas-admin__respondents small { color: var(--muted-text); text-align: right; }
        .pesquisa-encontristas-admin__responses { padding: 1rem; }
        .pesquisa-encontristas-admin__responses > div { align-items: center; border-top: 1px solid var(--border-color); display: grid; gap: .6rem; grid-template-columns: auto 1fr auto auto auto; padding: .8rem 0; }
        .pesquisa-encontristas-admin__responses > div:first-child { border-top: 0; }
        .pesquisa-encontristas-admin__responses small { color: var(--muted-text); }
        .pesquisa-encontristas-admin__team-choice-grid { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .pesquisa-encontristas-admin__team-choice { display: grid; gap: .85rem; padding: 1rem; }
        .pesquisa-encontristas-admin__team-choice header { align-items: flex-start; display: flex; justify-content: space-between; gap: 1rem; }
        .pesquisa-encontristas-admin__team-choice header span { color: var(--muted-text); font-size: .72rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__team-choice h3 { margin: .15rem 0 0; }
        .pesquisa-encontristas-admin__team-choice header > strong { align-items: center; background: var(--primary-color); border-radius: 999px; color: white; display: inline-flex; height: 42px; justify-content: center; min-width: 42px; padding: 0 .75rem; }
        .pesquisa-encontristas-admin__team-choice-counts { display: grid; gap: .4rem; grid-template-columns: repeat(3, 1fr); }
        .pesquisa-encontristas-admin__team-choice-counts span { background: var(--secondary-bg); border-radius: 10px; color: var(--muted-text); display: grid; font-size: .75rem; gap: .15rem; padding: .55rem; text-align: center; }
        .pesquisa-encontristas-admin__team-choice-counts strong { color: var(--text-color); font-size: 1.15rem; }
        .pesquisa-encontristas-admin__team-choice-modal { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__team-choice-modal header { display: grid; gap: .2rem; }
        .pesquisa-encontristas-admin__team-choice-modal header span { color: var(--primary-color); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__team-choice-modal h3, .pesquisa-encontristas-admin__team-choice-modal p { margin: 0; }
        .pesquisa-encontristas-admin__team-choice-modal header p { color: var(--muted-text); }
        .pesquisa-encontristas-admin__team-choice-list { display: grid; gap: .85rem; }
        .pesquisa-encontristas-admin__team-choice-list section { background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: .85rem; }
        .pesquisa-encontristas-admin__team-choice-list h4 { margin: 0 0 .65rem; }
        .pesquisa-encontristas-admin__team-choice-list p { color: var(--muted-text); margin: 0; }
        .pesquisa-encontristas-admin__team-choice-person { border-top: 1px solid var(--border-color); display: grid; gap: .55rem; padding: .75rem 0; }
        .pesquisa-encontristas-admin__team-choice-person:first-of-type { border-top: 0; padding-top: 0; }
        .pesquisa-encontristas-admin__team-choice-person header { align-items: center; display: flex; gap: .5rem; }
        .pesquisa-encontristas-admin__team-choice-person header strong { overflow-wrap: anywhere; }
        .pesquisa-encontristas-admin__team-choice-tags { display: flex; flex-wrap: wrap; gap: .4rem; }
        .pesquisa-encontristas-admin__team-choice-tags span { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 999px; color: var(--muted-text); font-size: .76rem; font-weight: 700; padding: .25rem .55rem; }
        .pesquisa-encontristas-admin__team-choice-preferences { color: var(--muted-text); display: grid; gap: .2rem; margin: 0; padding-left: 1.1rem; }
        .pesquisa-encontristas-admin__team-choice-preferences strong { color: var(--text-color); }
        .pesquisa-encontristas-admin__team-choice-person > p { background: var(--card-bg); border-left: 3px solid var(--primary-color); border-radius: 8px; padding: .55rem .7rem; white-space: pre-wrap; }
        .pesquisa-encontristas-admin__answer-modal { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__answer-modal header { display: grid; gap: .2rem; }
        .pesquisa-encontristas-admin__answer-modal header span { color: var(--primary-color); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__answer-modal h3, .pesquisa-encontristas-admin__answer-modal p { margin: 0; }
        .pesquisa-encontristas-admin__answer-modal header p { color: var(--muted-text); }
        .pesquisa-encontristas-admin__answer-list { display: grid; gap: .75rem; }
        .pesquisa-encontristas-admin__answer-list article { background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: .85rem; }
        .pesquisa-encontristas-admin__answer-list p { color: var(--muted-text); margin-top: .25rem; white-space: pre-wrap; }
        .pesquisa-encontristas-admin__manual-ai { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__manual-ai-guide { align-items: center; display: flex; gap: .9rem; padding: 1rem; }
        .pesquisa-encontristas-admin__manual-ai-guide svg { color: var(--primary-color); flex: 0 0 auto; }
        .pesquisa-encontristas-admin__manual-ai-guide strong, .pesquisa-encontristas-admin__manual-ai-guide p { margin: 0; }
        .pesquisa-encontristas-admin__manual-ai-guide p { color: var(--muted-text); margin-top: .2rem; }
        .pesquisa-encontristas-admin__manual-ai-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .pesquisa-encontristas-admin__manual-ai-card { display: grid; gap: .85rem; padding: 1rem; }
        .pesquisa-encontristas-admin__manual-ai-card header { align-items: flex-start; display: flex; gap: .75rem; justify-content: space-between; }
        .pesquisa-encontristas-admin__manual-ai-card h3, .pesquisa-encontristas-admin__manual-ai-card p { margin: 0; }
        .pesquisa-encontristas-admin__manual-ai-card p { color: var(--muted-text); font-size: .84rem; margin-top: .2rem; }
        .pesquisa-encontristas-admin__manual-ai-card textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size: .82rem; line-height: 1.55; min-height: 420px; resize: vertical; white-space: pre-wrap; }
        .pesquisa-encontristas-admin__ai-limit { color: var(--muted-text); display: block; font-size: .82rem; font-weight: 700; margin-top: .35rem; }
        .pesquisa-encontristas-admin__ai-status, .pesquisa-encontristas-admin__ai-error { align-items: flex-start; display: flex; gap: .75rem; padding: 1rem; }
        .pesquisa-encontristas-admin__ai-status svg { color: var(--primary-color); flex: 0 0 auto; }
        .pesquisa-encontristas-admin__ai-status p, .pesquisa-encontristas-admin__ai-error p { color: var(--muted-text); margin: .2rem 0 0; }
        .pesquisa-encontristas-admin__ai-error { border-color: rgba(239,68,68,.35); }
        .pesquisa-encontristas-admin__ai-error strong { color: #ef4444; }
        .pesquisa-encontristas-admin__ai-report { display: grid; gap: 1rem; padding: 1rem; }
        .pesquisa-encontristas-admin__ai-report > header { border-bottom: 1px solid var(--border-color); display: grid; gap: .25rem; padding-bottom: 1rem; }
        .pesquisa-encontristas-admin__ai-report > header span { color: var(--primary-color); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__ai-report h3, .pesquisa-encontristas-admin__ai-report h4, .pesquisa-encontristas-admin__ai-report p { margin: 0; }
        .pesquisa-encontristas-admin__ai-report > header p { color: var(--muted-text); }
        .pesquisa-encontristas-admin__ai-report section { display: grid; gap: .65rem; }
        .pesquisa-encontristas-admin__ai-report ul { color: var(--muted-text); margin: 0; padding-left: 1.2rem; }
        .pesquisa-encontristas-admin__ai-list { display: grid; gap: .75rem; }
        .pesquisa-encontristas-admin__ai-list > div { background: var(--secondary-bg); border: 1px solid var(--border-color); border-radius: 12px; display: grid; gap: .35rem; padding: .85rem; }
        .pesquisa-encontristas-admin__ai-list p { color: var(--muted-text); white-space: pre-wrap; }
        .pesquisa-encontristas-admin__loading { display: flex; justify-content: center; padding: 4rem; }
        @media (max-width: 980px) {
          .pesquisa-encontristas-admin__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pesquisa-encontristas-admin__team-choice-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pesquisa-encontristas-admin__question-summaries, .pesquisa-encontristas-admin__manual-ai-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 700px) {
          .pesquisa-encontristas-admin { padding: .75rem; }
          .pesquisa-encontristas-admin__header { grid-template-columns: auto 1fr; }
          .pesquisa-encontristas-admin__header select { grid-column: 1 / -1; }
          .pesquisa-encontristas-admin__toolbar, .pesquisa-encontristas-admin__section-heading { align-items: stretch; flex-direction: column; gap: .75rem; }
          .pesquisa-encontristas-admin__toolbar button, .pesquisa-encontristas-admin__section-heading button { justify-content: center; width: 100%; }
          .pesquisa-encontristas-admin__tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: visible; }
          .pesquisa-encontristas-admin__tabs button { flex: initial; font-size: .86rem; min-height: 48px; padding: .65rem .55rem; white-space: normal; }
          .pesquisa-encontristas-admin__tabs button span { overflow-wrap: anywhere; }
          .pesquisa-encontristas-admin__metrics, .pesquisa-encontristas-admin__question-summaries, .pesquisa-encontristas-admin__team-choice-grid { grid-template-columns: 1fr; }
          .pesquisa-encontristas-admin__manual-ai-card header { align-items: stretch; flex-direction: column; }
          .pesquisa-encontristas-admin__manual-ai-card header button { justify-content: center; width: 100%; }
          .pesquisa-encontristas-admin__manual-ai-card textarea { min-height: 320px; }
          .pesquisa-encontristas-admin__question { grid-template-columns: 28px 1fr auto auto; }
          .pesquisa-encontristas-admin__respondents > div { grid-template-columns: auto 1fr auto; }
          .pesquisa-encontristas-admin__respondents small { grid-column: 2 / -1; text-align: left; }
          .pesquisa-encontristas-admin__responses > div { grid-template-columns: auto 1fr auto; }
          .pesquisa-encontristas-admin__responses small, .pesquisa-encontristas-admin__responses button { grid-column: 2 / -1; }
          .pesquisa-encontristas-admin__responses button { justify-content: center; width: 100%; }
        }
        @media (max-width: 460px) {
          .pesquisa-encontristas-admin { gap: .8rem; padding: .6rem; }
          .pesquisa-encontristas-admin__header { gap: .75rem; grid-template-columns: 1fr; }
          .pesquisa-encontristas-admin__header .icon-btn { justify-self: start; }
          .pesquisa-encontristas-admin__tabs { border-radius: 14px; gap: .35rem; padding: .35rem; }
          .pesquisa-encontristas-admin__tabs button { align-items: flex-start; flex-direction: column; gap: .25rem; min-height: 58px; }
          .pesquisa-encontristas-admin__tabs button strong { height: 22px; min-width: 22px; }
          .pesquisa-encontristas-admin__form-grid { grid-template-columns: 1fr; }
          .pesquisa-encontristas-admin__actions { flex-direction: column-reverse; }
          .pesquisa-encontristas-admin__actions button { justify-content: center; width: 100%; }
          .pesquisa-encontristas-admin__question { align-items: start; grid-template-columns: 28px 1fr; }
          .pesquisa-encontristas-admin__question .icon-btn { min-height: 40px; width: 100%; }
          .pesquisa-encontristas-admin__question .icon-btn:first-of-type { grid-column: 1 / 2; }
          .pesquisa-encontristas-admin__question .icon-btn:last-of-type { grid-column: 2 / 3; }
          .pesquisa-encontristas-admin__bar { grid-template-columns: 58px 1fr 24px; }
          .pesquisa-encontristas-admin__team-choice-counts { grid-template-columns: 1fr; }
          .pesquisa-encontristas-admin__manual-ai-guide { align-items: flex-start; }
          .pesquisa-encontristas-admin__manual-ai-card textarea { font-size: .78rem; min-height: 280px; }
          .pesquisa-encontristas-admin__respondents > div { align-items: start; grid-template-columns: auto 1fr; }
          .pesquisa-encontristas-admin__respondents .pesquisa-status, .pesquisa-encontristas-admin__respondents small { grid-column: 2 / -1; justify-self: start; }
          .pesquisa-encontristas-admin__responses > div { align-items: start; grid-template-columns: auto 1fr; }
          .pesquisa-encontristas-admin__responses .pesquisa-status, .pesquisa-encontristas-admin__responses small, .pesquisa-encontristas-admin__responses button { grid-column: 2 / -1; justify-self: stretch; }
        }
      `}</style>
    </div>
  );
}

function AiReportEncontristas({ report }: { report: PesquisaEncontristaResumoIA }) {
  const result = report.resultado;
  if (!result) return null;

  return (
    <article className="card pesquisa-encontristas-admin__ai-report">
      <header>
        <span>Relatório concluído</span>
        <h3>Resumo gerado em {new Date(report.created_at).toLocaleString('pt-BR')}</h3>
        <p>{report.total_respostas} respostas consideradas · Modelo {report.model}</p>
      </header>

      <section>
        <h4>Síntese geral</h4>
        <p>{result.resumoGeral.sintese}</p>
      </section>

      {!!result.resumoGeral.pontosFortes.length && (
        <section>
          <h4>Pontos fortes</h4>
          <ul>{result.resumoGeral.pontosFortes.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}

      {!!result.resumoGeral.principaisProblemas.length && (
        <section>
          <h4>Pontos de atenção</h4>
          <div className="pesquisa-encontristas-admin__ai-list">
            {result.resumoGeral.principaisProblemas.map((item) => (
              <div key={item.tema}>
                <strong>{item.tema}</strong>
                <p>{item.resumo}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!result.resumoGeral.equipesMaisCitadas.length && (
        <section>
          <h4>Equipes mais citadas</h4>
          <div className="pesquisa-encontristas-admin__ai-list">
            {result.resumoGeral.equipesMaisCitadas.map((item) => (
              <div key={item.equipe}>
                <strong>{item.equipe}</strong>
                <p>{item.contexto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!!result.perguntas.length && (
        <section>
          <h4>Resumo por pergunta</h4>
          <div className="pesquisa-encontristas-admin__ai-list">
            {result.perguntas.map((pergunta) => (
              <div key={pergunta.questionId ?? pergunta.pergunta}>
                <strong>{pergunta.pergunta}</strong>
                <p>{pergunta.resumo}</p>
                {!!pergunta.sugestoesMencionadas.length && (
                  <ul>{pergunta.sugestoesMencionadas.map((item) => <li key={item}>{item}</li>)}</ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function QuestionSummary({ resumo, onViewAll }: { resumo: PesquisaEncontristaPerguntaResumo; onViewAll?: () => void }) {
  const maxCount = Math.max(...(resumo.opcoes?.map((item) => item.count) ?? [0]), 1);
  const comments = resumo.textos ?? [];

  return (
    <article className="card pesquisa-encontristas-admin__summary">
      <header>
        <MessageSquareText size={19} />
        <div>
          <h3>{resumo.pergunta.title}</h3>
          <span>{resumo.pergunta.sectionTitle} · {resumo.totalRespondidas} respostas</span>
        </div>
      </header>

      {typeof resumo.media === 'number' && (
        <strong className="pesquisa-encontristas-admin__average">Média {resumo.media.toFixed(1)}</strong>
      )}

      {!!resumo.opcoes?.length && (
        <div className="pesquisa-encontristas-admin__bars">
          {resumo.opcoes.map((opcao) => (
            <div className="pesquisa-encontristas-admin__bar" key={opcao.label}>
              <span>{opcao.label}</span>
              <div className="pesquisa-encontristas-admin__bar-track">
                <span style={{ width: `${(opcao.count / maxCount) * 100}%` }} />
              </div>
              <strong>{opcao.count}</strong>
            </div>
          ))}
        </div>
      )}

      {!!comments.length && (
        <div className="pesquisa-encontristas-admin__comments">
          {comments.slice(0, 3).map((comentario, index) => (
            <div key={`${comentario.nome}-${index}`}>
              <strong>{comentario.nome}</strong>
              <p>{comentario.texto}</p>
            </div>
          ))}
          {comments.length > 3 && (
            <button type="button" className="pesquisa-encontristas-admin__comments-more" onClick={onViewAll}>
              + {comments.length - 3} comentários
            </button>
          )}
        </div>
      )}
    </article>
  );
}
