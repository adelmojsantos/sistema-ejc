import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ClipboardCheck,
  FileQuestion,
  Loader,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { useEncontros } from '../../contexts/EncontroContext';
import {
  avaliacaoEncontroService,
  type AvaliacaoEquipeResumo,
  type AvaliacaoPergunta,
  type AvaliacaoPerguntaFormData,
  type AvaliacaoPerguntaTipo,
} from '../../services/avaliacaoEncontroService';
import { encontroService } from '../../services/encontroService';
import type { Encontro } from '../../types/encontro';

const tipoLabels: Record<AvaliacaoPerguntaTipo, string> = {
  texto: 'Texto curto',
  texto_longo: 'Texto longo',
  nota: 'Nota',
  sim_nao: 'Sim/Não',
  multipla_escolha: 'Múltipla escolha',
};

const emptyForm = (encontroId = '', ordem = 1): AvaliacaoPerguntaFormData => ({
  encontro_id: encontroId,
  ordem,
  titulo: '',
  descricao: '',
  tipo: 'texto_longo',
  obrigatoria: true,
  opcoes: null,
  ativa: true,
});

type StatusFilter = 'todos' | 'enviado' | 'rascunho' | 'pendente';

const tipoDescriptions: Record<AvaliacaoPerguntaTipo, string> = {
  texto: 'Resposta objetiva em poucas linhas.',
  texto_longo: 'Campo aberto para avaliação detalhada.',
  nota: 'Escala numérica de 1 a 10.',
  sim_nao: 'Resposta fechada entre sim e não.',
  multipla_escolha: 'Lista de alternativas para escolher.',
};

function optionsToText(opcoes: string[] | null) {
  return (opcoes ?? []).join('\n');
}

function textToOptions(value: string) {
  const options = value
    .split('\n')
    .map((option) => option.trim())
    .filter(Boolean);

  return options.length > 0 ? options : null;
}

export function AvaliacaoEncontroPage() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();

  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [perguntas, setPerguntas] = useState<AvaliacaoPergunta[]>([]);
  const [resumoEquipes, setResumoEquipes] = useState<AvaliacaoEquipeResumo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPergunta, setEditingPergunta] = useState<AvaliacaoPergunta | null>(null);
  const [formData, setFormData] = useState<AvaliacaoPerguntaFormData>(emptyForm());
  const [opcoesTexto, setOpcoesTexto] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [deleteTarget, setDeleteTarget] = useState<AvaliacaoPergunta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!selectedEncontroId && encontroAtivo) {
      setSelectedEncontroId(encontroAtivo.id);
    } else if (!selectedEncontroId && encontros.length > 0) {
      setSelectedEncontroId(encontros[0].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;

    setIsLoading(true);
    try {
      const [perguntasData, resumoData] = await Promise.all([
        avaliacaoEncontroService.listarPerguntas(selectedEncontroId),
        avaliacaoEncontroService.listarResumoEquipes(selectedEncontroId),
      ]);
      setPerguntas(perguntasData);
      setResumoEquipes(resumoData);
    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      toast.error('Erro ao carregar avaliação do encontro.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    const enviados = resumoEquipes.filter((item) => item.status === 'enviado').length;
    const rascunhos = resumoEquipes.filter((item) => item.status === 'rascunho').length;
    const pendentes = resumoEquipes.filter((item) => item.status === 'pendente').length;
    return { enviados, rascunhos, pendentes, total: resumoEquipes.length };
  }, [resumoEquipes]);

  const selectedEncontro = useMemo(
    () => encontros.find((encontro) => encontro.id === selectedEncontroId),
    [encontros, selectedEncontroId]
  );

  const filteredResumoEquipes = useMemo(() => {
    if (statusFilter === 'todos') return resumoEquipes;
    return resumoEquipes.filter((item) => item.status === statusFilter);
  }, [resumoEquipes, statusFilter]);

  const completionPercent = stats.total > 0 ? Math.round((stats.enviados / stats.total) * 100) : 0;

  const openCreateModal = () => {
    const nextOrder = perguntas.length > 0 ? Math.max(...perguntas.map((item) => item.ordem)) + 1 : 1;
    setEditingPergunta(null);
    setFormData(emptyForm(selectedEncontroId, nextOrder));
    setOpcoesTexto('');
    setIsModalOpen(true);
  };

  const openEditModal = (pergunta: AvaliacaoPergunta) => {
    setEditingPergunta(pergunta);
    setFormData({
      encontro_id: pergunta.encontro_id,
      ordem: pergunta.ordem,
      titulo: pergunta.titulo,
      descricao: pergunta.descricao ?? '',
      tipo: pergunta.tipo,
      obrigatoria: pergunta.obrigatoria,
      opcoes: pergunta.opcoes,
      ativa: pergunta.ativa,
    });
    setOpcoesTexto(optionsToText(pergunta.opcoes));
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.encontro_id || !formData.titulo.trim()) {
      toast.error('Informe o encontro e o título da pergunta.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        titulo: formData.titulo.trim(),
        descricao: formData.descricao?.trim() || null,
        opcoes: formData.tipo === 'multipla_escolha' ? textToOptions(opcoesTexto) : null,
      };

      if (editingPergunta) {
        await avaliacaoEncontroService.atualizarPergunta(editingPergunta.id, payload);
        toast.success('Pergunta atualizada.');
      } else {
        await avaliacaoEncontroService.criarPergunta(payload);
        toast.success('Pergunta criada.');
      }

      setIsModalOpen(false);
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar pergunta:', error);
      toast.error('Erro ao salvar pergunta.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await avaliacaoEncontroService.excluirPergunta(deleteTarget.id);
      toast.success('Pergunta removida.');
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      console.error('Erro ao remover pergunta:', error);
      toast.error('Erro ao remover pergunta.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="main-content container fade-in avaliacao-page" style={{ paddingBottom: '4rem' }}>
      <header
        className="avaliacao-hero"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/cadastros')} className="icon-btn" aria-label="Voltar">
            <ChevronLeft size={20} />
          </button>
          <div>
            <span className="avaliacao-eyebrow">Configuração por encontro</span>
            <h1 style={{ margin: '0.15rem 0 0', fontSize: '1.65rem' }}>Avaliação do Encontro</h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.92rem', color: 'var(--muted-text)', maxWidth: 560, lineHeight: 1.5 }}>
              Perguntas por encontro e acompanhamento das respostas das equipes.
            </p>
            {selectedEncontro && (
              <div className="avaliacao-context-pill">
                <ClipboardCheck size={15} />
                {selectedEncontro.nome}
                {selectedEncontro.ativo ? <span>Ativo</span> : null}
              </div>
            )}
          </div>
        </div>

        <div className="avaliacao-actions">
          <div className="avaliacao-encontro-select">
            <LiveSearchSelect<Encontro>
              value={selectedEncontroId}
              onChange={(value) => setSelectedEncontroId(value)}
              fetchData={async (search, page) => encontroService.buscarComPaginacao(search, page)}
              getOptionLabel={(encontro) => `${encontro.nome}${encontro.ativo ? ' (Ativo)' : ''}`}
              getOptionValue={(encontro) => String(encontro.id)}
              placeholder="Selecione o encontro"
              initialOptions={encontros}
            />
          </div>
          <button
            className="btn-primary"
            onClick={openCreateModal}
            disabled={!selectedEncontroId}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} />
            Nova pergunta
          </button>
        </div>
      </header>

      <section className="avaliacao-summary">
        <StatCard label="Perguntas" value={perguntas.length} tone="primary" icon={<FileQuestion size={20} />} />
        <StatCard
          label="Enviadas"
          value={`${stats.enviados}/${stats.total}`}
          tone="success"
          active={statusFilter === 'enviado'}
          onClick={() => setStatusFilter(statusFilter === 'enviado' ? 'todos' : 'enviado')}
        />
        <StatCard
          label="Rascunhos"
          value={stats.rascunhos}
          tone="warning"
          active={statusFilter === 'rascunho'}
          onClick={() => setStatusFilter(statusFilter === 'rascunho' ? 'todos' : 'rascunho')}
        />
        <StatCard
          label="Pendentes"
          value={stats.pendentes}
          tone="muted"
          active={statusFilter === 'pendente'}
          onClick={() => setStatusFilter(statusFilter === 'pendente' ? 'todos' : 'pendente')}
        />
      </section>

      <section className="avaliacao-progress card">
        <div>
          <strong>{completionPercent}% das equipes enviaram</strong>
          <span>{stats.total === 0 ? 'Nenhuma equipe vinculada ao encontro.' : `${stats.enviados} de ${stats.total} equipes com avaliação finalizada.`}</span>
        </div>
        <div className="avaliacao-progress-bar" aria-hidden="true">
          <span style={{ width: `${completionPercent}%` }} />
        </div>
      </section>

      <section
        className="avaliacao-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Perguntas</h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
                As equipes responderão estas perguntas em Minha Equipe.
              </p>
            </div>
            <div className="avaliacao-section-actions">
              {isLoading && <Loader className="animate-spin" size={20} />}
              <button
                className="btn-secondary"
                onClick={openCreateModal}
                disabled={!selectedEncontroId}
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.8rem' }}
              >
                <Plus size={16} />
                Adicionar
              </button>
            </div>
          </div>

          {perguntas.length === 0 && !isLoading ? (
            <EmptyState text="Nenhuma pergunta cadastrada para este encontro." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {perguntas.map((pergunta) => (
                <article
                  key={pergunta.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(var(--primary-rgb), 0.025)',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        #{pergunta.ordem}
                      </span>
                      <Badge>{tipoLabels[pergunta.tipo]}</Badge>
                      {pergunta.obrigatoria && <Badge tone="warning">Obrigatória</Badge>}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '0.98rem' }}>{pergunta.titulo}</h3>
                    {pergunta.descricao && (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.84rem', opacity: 0.68, lineHeight: 1.45 }}>
                        {pergunta.descricao}
                      </p>
                    )}
                    {pergunta.tipo === 'multipla_escolha' && pergunta.opcoes && pergunta.opcoes.length > 0 && (
                      <div className="avaliacao-options-preview">
                        {pergunta.opcoes.map((opcao) => <span key={opcao}>{opcao}</span>)}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button className="icon-btn" onClick={() => openEditModal(pergunta)} aria-label="Editar pergunta">
                      <Pencil size={16} />
                    </button>
                    <button className="icon-btn danger" onClick={() => setDeleteTarget(pergunta)} aria-label="Remover pergunta">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Equipes</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
              Acompanhamento por equipe neste encontro.
            </p>
          </div>

          {resumoEquipes.length === 0 && !isLoading ? (
            <EmptyState text="Nenhuma equipe vinculada a este encontro." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {filteredResumoEquipes.map((item) => (
                <article
                  key={item.equipe_id}
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: item.status === 'enviado' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(var(--primary-rgb), 0.025)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.92rem' }}>{item.equipe_nome}</strong>
                      <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>
                        {item.total_respostas}/{item.total_perguntas} respostas
                      </span>
                    </div>
                    <Badge tone={item.status === 'enviado' ? 'success' : item.status === 'rascunho' ? 'warning' : 'muted'}>
                      {item.status === 'enviado' ? 'Enviada' : item.status === 'rascunho' ? 'Rascunho' : 'Pendente'}
                    </Badge>
                  </div>
                  {item.enviado_em && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.76rem', opacity: 0.6 }}>
                      Enviada em {new Date(item.enviado_em).toLocaleString('pt-BR')}
                    </p>
                  )}
                </article>
              ))}
              {filteredResumoEquipes.length === 0 && resumoEquipes.length > 0 && (
                <EmptyState text="Nenhuma equipe encontrada para o filtro selecionado." />
              )}
            </div>
          )}
        </div>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPergunta ? 'Editar pergunta' : 'Nova pergunta'}
        maxWidth="720px"
      >
        <form onSubmit={handleSave} className="avaliacao-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              className="form-input"
              value={formData.titulo}
              onChange={(event) => setFormData((prev) => ({ ...prev, titulo: event.target.value }))}
              placeholder="Ex.: O que funcionou melhor na equipe?"
            />
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <textarea
              className="form-textarea"
              value={formData.descricao ?? ''}
              onChange={(event) => setFormData((prev) => ({ ...prev, descricao: event.target.value }))}
              rows={3}
              placeholder="Orientação opcional para a equipe"
            />
          </div>

          <div className="avaliacao-type-grid">
            {(Object.keys(tipoLabels) as AvaliacaoPerguntaTipo[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                className={`avaliacao-type-card ${formData.tipo === tipo ? 'is-selected' : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, tipo }))}
              >
                <strong>{tipoLabels[tipo]}</strong>
                <span>{tipoDescriptions[tipo]}</span>
              </button>
            ))}
          </div>

          <div className="avaliacao-form-grid">
            <div className="form-group">
              <label>Tipo selecionado</label>
              <div className="avaliacao-selected-type">{tipoLabels[formData.tipo]}</div>
            </div>

            <div className="form-group">
              <label>Ordem</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={formData.ordem}
                onChange={(event) => setFormData((prev) => ({ ...prev, ordem: Number(event.target.value) }))}
              />
            </div>
          </div>

          {formData.tipo === 'multipla_escolha' && (
            <div className="form-group">
              <label>Opções</label>
              <textarea
                className="form-textarea"
                value={opcoesTexto}
                onChange={(event) => setOpcoesTexto(event.target.value)}
                rows={4}
                placeholder={'Uma opção por linha\nEx.: Ótimo\nBom\nPrecisa melhorar'}
              />
            </div>
          )}

          <label className="avaliacao-required-toggle">
            <input
              type="checkbox"
              checked={formData.obrigatoria}
              onChange={(event) => setFormData((prev) => ({ ...prev, obrigatoria: event.target.checked }))}
            />
            Pergunta obrigatória
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSaving}>
              {isSaving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remover pergunta"
        message={`Deseja remover a pergunta "${deleteTarget?.titulo}"? As respostas existentes permanecerão no histórico, mas a pergunta não aparecerá mais para as equipes.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        confirmText="Remover"
        isDestructive
        isLoading={isDeleting}
      />

      <style>{`
        .avaliacao-page {
          --avaliacao-soft: rgba(var(--primary-rgb), 0.055);
        }

        .avaliacao-hero {
          margin-bottom: 1.5rem;
          padding: 1.25rem;
          border: 1px solid var(--border-color);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.08), rgba(var(--primary-rgb), 0.015));
        }

        .avaliacao-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .avaliacao-encontro-select {
          width: 260px;
        }

        .avaliacao-eyebrow {
          display: inline-flex;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--primary-color);
        }

        .avaliacao-context-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          margin-top: 0.8rem;
          padding: 0.42rem 0.72rem;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--card-bg);
          font-size: 0.82rem;
          font-weight: 700;
        }

        .avaliacao-context-pill span {
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .avaliacao-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .avaliacao-section-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-shrink: 0;
        }

        .avaliacao-stat-card {
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          border: 1px solid var(--border-color);
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .avaliacao-stat-card.is-clickable {
          cursor: pointer;
        }

        .avaliacao-stat-card.is-clickable:hover,
        .avaliacao-stat-card.is-active {
          transform: translateY(-2px);
          border-color: var(--primary-color);
          background: var(--avaliacao-soft);
        }

        .avaliacao-progress {
          display: grid;
          grid-template-columns: minmax(0, 280px) 1fr;
          gap: 1rem;
          align-items: center;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
        }

        .avaliacao-progress strong {
          display: block;
          font-size: 0.95rem;
        }

        .avaliacao-progress span {
          display: block;
          margin-top: 0.2rem;
          font-size: 0.8rem;
          opacity: 0.65;
        }

        .avaliacao-progress-bar {
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(var(--primary-rgb), 0.12);
        }

        .avaliacao-progress-bar span {
          display: block;
          height: 100%;
          margin: 0;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--primary-color), #10b981);
          transition: width 0.25s ease;
        }

        .avaliacao-options-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.75rem;
        }

        .avaliacao-options-preview span {
          padding: 0.25rem 0.5rem;
          border-radius: 999px;
          background: rgba(var(--primary-rgb), 0.08);
          color: var(--primary-color);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .avaliacao-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .avaliacao-form-grid {
          display: grid;
          grid-template-columns: 1fr 160px;
          gap: 1rem;
        }

        .avaliacao-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.7rem;
        }

        .avaliacao-type-card {
          text-align: left;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--card-bg);
          color: var(--text-color);
          padding: 0.85rem;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
        }

        .avaliacao-type-card:hover,
        .avaliacao-type-card.is-selected {
          border-color: var(--primary-color);
          background: rgba(var(--primary-rgb), 0.07);
          transform: translateY(-1px);
        }

        .avaliacao-type-card strong {
          display: block;
          font-size: 0.85rem;
        }

        .avaliacao-type-card span {
          display: block;
          margin-top: 0.3rem;
          font-size: 0.74rem;
          opacity: 0.64;
          line-height: 1.35;
        }

        .avaliacao-selected-type {
          display: flex;
          align-items: center;
          min-height: 42px;
          padding: 0 0.85rem;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: rgba(var(--primary-rgb), 0.045);
          color: var(--primary-color);
          font-weight: 800;
        }

        .avaliacao-required-toggle {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          width: fit-content;
          padding: 0.7rem 0.85rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 700;
          background: rgba(var(--primary-rgb), 0.035);
        }

        @media (max-width: 980px) {
          .avaliacao-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .avaliacao-hero {
            padding: 1rem;
          }

          .avaliacao-actions,
          .avaliacao-encontro-select,
          .avaliacao-actions .btn-primary {
            width: 100%;
          }

          .avaliacao-section-actions {
            width: 100%;
            justify-content: space-between;
          }

          .avaliacao-section-actions .btn-secondary {
            flex: 1;
            justify-content: center;
          }

          .avaliacao-progress {
            grid-template-columns: 1fr;
          }

          .avaliacao-type-grid {
            grid-template-columns: 1fr;
          }

          .avaliacao-form-grid {
            grid-template-columns: 1fr;
          }

          .avaliacao-form .btn-primary,
          .avaliacao-form .btn-secondary {
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: 'primary' | 'success' | 'warning' | 'muted';
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const color = tone === 'success' ? '#10b981' : tone === 'warning' ? '#f59e0b' : tone === 'muted' ? '#64748b' : 'var(--primary-color)';
  const content = icon ?? (tone === 'success' ? <CheckCircle size={20} /> : tone === 'warning' ? <AlertCircle size={20} /> : <ClipboardCheck size={20} />);

  return (
    <article
      className={`card avaliacao-stat-card ${onClick ? 'is-clickable' : ''} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: `${color}18`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {content}
      </span>
      <div>
        <strong style={{ display: 'block', fontSize: '1.35rem', lineHeight: 1 }}>{value}</strong>
        <span style={{ fontSize: '0.75rem', opacity: 0.58, fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
      </div>
    </article>
  );
}

function Badge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'muted' }) {
  const color = tone === 'success' ? '#10b981' : tone === 'warning' ? '#f59e0b' : tone === 'muted' ? '#64748b' : 'var(--primary-color)';
  return (
    <span style={{
      fontSize: '0.68rem',
      fontWeight: 800,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      padding: '0.25rem 0.5rem',
      borderRadius: '999px',
      background: `${color}16`,
      color,
    }}>
      {children}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      padding: '2.5rem 1rem',
      textAlign: 'center',
      borderRadius: '14px',
      border: '1px dashed var(--border-color)',
      color: 'var(--muted-text)',
    }}>
      <ClipboardCheck size={36} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}
