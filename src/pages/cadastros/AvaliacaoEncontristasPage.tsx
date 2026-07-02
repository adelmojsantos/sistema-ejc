import { ChevronLeft, ClipboardCheck, Loader, Pencil, Plus, Save, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useEncontros } from '../../contexts/EncontroContext';
import { pesquisaEncontristaService } from '../../services/pesquisaEncontristaService';
import type { PesquisaEncontristaConfig, PesquisaEncontristaEnvio } from '../../types/pesquisaEncontrista';
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
  const [tab, setTab] = useState<'perguntas' | 'respostas'>('perguntas');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEnvio, setSelectedEnvio] = useState<PesquisaEncontristaEnvio | null>(null);
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
    ])
      .then(([nextConfig, nextPerguntas, nextEnvios]) => {
        setConfig(nextConfig);
        setPerguntas(nextPerguntas);
        setEnvios(nextEnvios);
      })
      .catch((error) => {
        console.error(error);
        toast.error('Não foi possível carregar a pesquisa dos encontristas.');
      })
      .finally(() => setLoading(false));
  }, [encontroId]);

  const sections = useMemo(() => {
    const result = new Map<string, PesquisaSatisfacaoQuestion[]>();
    perguntas.forEach((pergunta) => {
      const key = pergunta.sectionTitle;
      result.set(key, [...(result.get(key) ?? []), pergunta]);
    });
    return Array.from(result.entries());
  }, [perguntas]);

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
        <button className={tab === 'perguntas' ? 'is-active' : ''} onClick={() => setTab('perguntas')}>Perguntas ({perguntas.filter(item => item.active !== false).length})</button>
        <button className={tab === 'respostas' ? 'is-active' : ''} onClick={() => setTab('respostas')}>Respostas ({envios.length})</button>
      </nav>

      {loading ? (
        <div className="pesquisa-encontristas-admin__loading"><Loader className="animate-spin" /></div>
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
      ) : (
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
                <button className="btn-secondary" onClick={() => setSelectedEnvio(selectedEnvio?.id === envio.id ? null : envio)}>
                  {selectedEnvio?.id === envio.id ? 'Fechar' : 'Ver respostas'}
                </button>
              </div>
            ))}
          </div>
          {selectedEnvio && (
            <article className="card pesquisa-encontristas-admin__answer-detail">
              <h3>Respostas de {selectedEnvio.participacoes?.pessoas?.nome_completo ?? 'Encontrista'}</h3>
              {perguntas.filter(item => item.active !== false).map(pergunta => (
                <div key={pergunta.id}>
                  <strong>{pergunta.title}</strong>
                  <p>{answerText(selectedEnvio, pergunta)}</p>
                </div>
              ))}
            </article>
          )}
        </section>
      )}

      <style>{`
        .pesquisa-encontristas-admin { display: grid; gap: 1rem; padding: 1.25rem; }
        .pesquisa-encontristas-admin__header { align-items: center; display: grid; gap: 1rem; grid-template-columns: auto 1fr minmax(220px, 320px); }
        .pesquisa-encontristas-admin__header h1, .pesquisa-encontristas-admin__header p { margin: 0; }
        .pesquisa-encontristas-admin__header span { color: var(--primary-color); font-size: .75rem; font-weight: 800; text-transform: uppercase; }
        .pesquisa-encontristas-admin__header p, .pesquisa-encontristas-admin__toolbar span, .pesquisa-encontristas-admin__section-heading p { color: var(--muted-text); }
        .pesquisa-encontristas-admin__toolbar { align-items: center; display: flex; justify-content: space-between; padding: 1rem; }
        .pesquisa-encontristas-admin__toolbar span { display: block; font-size: .85rem; margin-top: .2rem; }
        .pesquisa-encontristas-admin__tabs { border-bottom: 1px solid var(--border-color); display: flex; gap: .5rem; }
        .pesquisa-encontristas-admin__tabs button { background: none; border: 0; border-bottom: 3px solid transparent; color: var(--muted-text); cursor: pointer; font-weight: 800; padding: .8rem 1rem; }
        .pesquisa-encontristas-admin__tabs button.is-active { border-color: var(--primary-color); color: var(--primary-color); }
        .pesquisa-encontristas-admin__section-heading { align-items: center; display: flex; justify-content: space-between; margin: .5rem 0 1rem; }
        .pesquisa-encontristas-admin__section-heading h2, .pesquisa-encontristas-admin__section-heading p { margin: 0; }
        .pesquisa-encontristas-admin__sections { display: grid; gap: 1rem; }
        .pesquisa-encontristas-admin__sections article { padding: 1rem; }
        .pesquisa-encontristas-admin__sections h3 { margin-top: 0; }
        .pesquisa-encontristas-admin__question { align-items: center; border-top: 1px solid var(--border-color); display: grid; gap: .75rem; grid-template-columns: 28px 1fr auto auto; padding: .8rem 0; }
        .pesquisa-encontristas-admin__question > span { align-items: center; background: var(--secondary-bg); border-radius: 50%; display: flex; height: 28px; justify-content: center; }
        .pesquisa-encontristas-admin__question small { color: var(--muted-text); display: block; margin-top: .2rem; }
        .pesquisa-encontristas-admin__question.is-inactive { opacity: .5; }
        .pesquisa-encontristas-admin__form { display: grid; gap: .8rem; margin-bottom: 1rem; padding: 1rem; }
        .pesquisa-encontristas-admin__form h3 { margin: 0; }
        .pesquisa-encontristas-admin__form label { display: grid; font-size: .85rem; font-weight: 700; gap: .3rem; }
        .pesquisa-encontristas-admin__form-grid { display: grid; gap: .8rem; grid-template-columns: 1fr 120px; }
        .pesquisa-encontristas-admin__form .pesquisa-encontristas-admin__check { align-items: center; display: flex; }
        .pesquisa-encontristas-admin__actions { display: flex; gap: .5rem; justify-content: flex-end; }
        .pesquisa-encontristas-admin__responses { padding: 1rem; }
        .pesquisa-encontristas-admin__responses > div { align-items: center; border-top: 1px solid var(--border-color); display: grid; gap: .6rem; grid-template-columns: auto 1fr auto auto auto; padding: .8rem 0; }
        .pesquisa-encontristas-admin__responses > div:first-child { border-top: 0; }
        .pesquisa-encontristas-admin__responses small { color: var(--muted-text); }
        .pesquisa-encontristas-admin__answer-detail { display: grid; gap: .8rem; margin-top: 1rem; padding: 1rem; }
        .pesquisa-encontristas-admin__answer-detail h3, .pesquisa-encontristas-admin__answer-detail p { margin: 0; }
        .pesquisa-encontristas-admin__answer-detail > div { border-top: 1px solid var(--border-color); padding-top: .8rem; }
        .pesquisa-encontristas-admin__answer-detail p { color: var(--muted-text); margin-top: .25rem; white-space: pre-wrap; }
        .pesquisa-encontristas-admin__loading { display: flex; justify-content: center; padding: 4rem; }
        @media (max-width: 700px) {
          .pesquisa-encontristas-admin { padding: .75rem; }
          .pesquisa-encontristas-admin__header { grid-template-columns: auto 1fr; }
          .pesquisa-encontristas-admin__header select { grid-column: 1 / -1; }
          .pesquisa-encontristas-admin__toolbar, .pesquisa-encontristas-admin__section-heading { align-items: stretch; flex-direction: column; gap: .75rem; }
          .pesquisa-encontristas-admin__responses > div { grid-template-columns: auto 1fr auto; }
          .pesquisa-encontristas-admin__responses small, .pesquisa-encontristas-admin__responses button { grid-column: 2 / -1; }
        }
      `}</style>
    </div>
  );
}
