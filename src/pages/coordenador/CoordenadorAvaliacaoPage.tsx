import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, Loader, Lock, Save, Star, X } from 'lucide-react';
import { ActionStepper, type ActionStep } from '../../components/ui/ActionStepper';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
  avaliacaoEncontroService,
  type AvaliacaoEnvio,
  type AvaliacaoPergunta,
} from '../../services/avaliacaoEncontroService';

interface EncontroAvaliacaoInfo {
  nome: string;
  data_fim: string | null;
}

interface EquipeMemberOption {
  id: string;
  nome: string;
}

function dateKey(value: string | null | undefined) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isAtOrAfterEndDate(dataFim: string | null | undefined) {
  return !!dataFim && dateKey(dataFim) <= todayKey();
}

function respostaPreenchida(pergunta: AvaliacaoPergunta, value: string | undefined) {
  if (pergunta.tipo === 'nota_justificativa') {
    const parsed = parseNotaJustificativa(value);
    return !!parsed?.nota && !!stripHtml(parsed.justificativa).trim();
  }

  if (pergunta.tipo === 'participante_destaque') {
    const destaque = parseParticipantesDestaque(value);
    return !!destaque && destaque.participacaoIds.length > 0 && !!stripHtml(destaque.justificativa).trim();
  }

  return !!stripHtml(value).trim();
}

function stripHtml(value: string | undefined | null) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseNotaJustificativa(value: string | undefined | null) {
  if (!value?.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value) as { nota?: number | string; justificativa?: string };
    if (!('nota' in parsed) && !('justificativa' in parsed)) return null;
    return {
      nota: parsed.nota ? String(parsed.nota) : '',
      justificativa: parsed.justificativa ?? '',
    };
  } catch {
    return null;
  }
}

function parseParticipantesDestaque(value: string | undefined | null) {
  if (!value?.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value) as { participacao_ids?: string[]; participantes_nomes?: string[]; justificativa?: string };
    if (!('participacao_ids' in parsed) && !('justificativa' in parsed)) return null;
    return {
      participacaoIds: Array.isArray(parsed.participacao_ids) ? parsed.participacao_ids : [],
      participantesNomes: Array.isArray(parsed.participantes_nomes) ? parsed.participantes_nomes : [],
      justificativa: parsed.justificativa ?? '',
    };
  } catch {
    return null;
  }
}

function getEscalaMax(pergunta: AvaliacaoPergunta) {
  if (pergunta.opcoes && !Array.isArray(pergunta.opcoes) && typeof pergunta.opcoes === 'object' && 'escala_max' in pergunta.opcoes) {
    return Number(pergunta.opcoes.escala_max) || (pergunta.tipo === 'nota_justificativa' ? 5 : 10);
  }
  return pergunta.tipo === 'nota_justificativa' ? 5 : 10;
}

export function CoordenadorAvaliacaoPage() {
  const { user, userParticipacao, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [perguntas, setPerguntas] = useState<AvaliacaoPergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [envio, setEnvio] = useState<AvaliacaoEnvio | null>(null);
  const [encontro, setEncontro] = useState<EncontroAvaliacaoInfo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [teamMembers, setTeamMembers] = useState<EquipeMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasPermission('modulo_admin');
  const isSent = envio?.status === 'enviado';
  const isReleased = isAdmin || isAtOrAfterEndDate(encontro?.data_fim);
  const equipeId = userParticipacao?.equipe_id ?? null;
  const encontroId = userParticipacao?.encontro_id ?? null;

  const answeredCount = useMemo(
    () => perguntas.filter((pergunta) => respostaPreenchida(pergunta, respostas[pergunta.id])).length,
    [perguntas, respostas]
  );

  const progress = perguntas.length > 0 ? Math.round((answeredCount / perguntas.length) * 100) : 0;
  const currentPergunta = perguntas[currentIndex] ?? null;

  const loadAvaliacao = useCallback(async () => {
    if (!encontroId || !equipeId || !userParticipacao?.coordenador) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [estado, encontroResult, membrosResult] = await Promise.all([
        avaliacaoEncontroService.obterEstado(encontroId, equipeId),
        supabase
          .from('encontros')
          .select('nome, data_fim')
          .eq('id', encontroId)
          .maybeSingle(),
        supabase
          .from('participacoes')
          .select('id, pessoas(nome_completo)')
          .eq('encontro_id', encontroId)
          .eq('equipe_id', equipeId)
          .eq('coordenador', false)
          .order('pessoas(nome_completo)', { ascending: true }),
      ]);

      if (encontroResult.error) throw encontroResult.error;
      if (membrosResult.error) throw membrosResult.error;

      const respostasMap = estado.respostas.reduce<Record<string, string>>((acc, resposta) => {
        acc[resposta.pergunta_id] = avaliacaoEncontroService.respostaParaValor(resposta);
        return acc;
      }, {});

      const firstPending = estado.perguntas.findIndex((pergunta) => pergunta.obrigatoria && !respostaPreenchida(pergunta, respostasMap[pergunta.id]));

      setPerguntas(estado.perguntas);
      setRespostas(respostasMap);
      setEnvio(estado.envio);
      setEncontro((encontroResult.data ?? null) as EncontroAvaliacaoInfo | null);
      setTeamMembers((membrosResult.data ?? []).map((item) => {
        const pessoa = Array.isArray(item.pessoas) ? item.pessoas[0] : item.pessoas;
        return { id: item.id, nome: pessoa?.nome_completo || 'Sem nome' };
      }).sort((a, b) => a.nome.localeCompare(b.nome)));
      setCurrentIndex(firstPending >= 0 ? firstPending : 0);
    } catch (error) {
      console.error('Erro ao carregar avaliação:', error);
      toast.error('Erro ao carregar avaliação do encontro.');
    } finally {
      setLoading(false);
    }
  }, [encontroId, equipeId, userParticipacao?.coordenador]);

  useEffect(() => {
    loadAvaliacao();
  }, [loadAvaliacao]);

  useEffect(() => {
    if (currentIndex > perguntas.length - 1) {
      setCurrentIndex(Math.max(perguntas.length - 1, 0));
    }
  }, [currentIndex, perguntas.length]);

  const updateResposta = (perguntaId: string, value: string) => {
    setRespostas((prev) => ({ ...prev, [perguntaId]: value }));
  };

  const salvarPerguntaAtual = async () => {
    if (!user?.id || !encontroId || !equipeId || !currentPergunta || isSent) return true;

    const value = respostas[currentPergunta.id] ?? '';
    if (currentPergunta.obrigatoria && !respostaPreenchida(currentPergunta, value)) {
      toast.error('Responda esta pergunta para continuar.');
      return false;
    }

    if (respostaPreenchida(currentPergunta, value) || currentPergunta.obrigatoria) {
      await avaliacaoEncontroService.salvarResposta({
        encontroId,
        equipeId,
        pergunta: currentPergunta,
        valor: value,
        userId: user.id,
      });
      await avaliacaoEncontroService.salvarRascunho(encontroId, equipeId, user.id);
    }

    return true;
  };

  const handleNext = async () => {
    if (!currentPergunta || currentIndex >= perguntas.length - 1) return;

    setSaving(true);
    try {
      const saved = await salvarPerguntaAtual();
      if (!saved) return;
      setCurrentIndex((prev) => Math.min(prev + 1, perguntas.length - 1));
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      toast.error('Erro ao salvar rascunho.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!user?.id || !encontroId || !equipeId || isSent) return;

    const missingRequired = perguntas.filter((pergunta) => pergunta.obrigatoria && !respostaPreenchida(pergunta, respostas[pergunta.id]));
    if (missingRequired.length > 0) {
      const firstMissingIndex = perguntas.findIndex((pergunta) => pergunta.id === missingRequired[0].id);
      setCurrentIndex(Math.max(firstMissingIndex, 0));
      toast.error('Responda todas as perguntas obrigatórias antes de enviar.');
      return;
    }

    setSaving(true);
    try {
      const perguntasComValor = perguntas.filter((pergunta) => respostaPreenchida(pergunta, respostas[pergunta.id]) || pergunta.obrigatoria);
      await Promise.all(perguntasComValor.map((pergunta) =>
        avaliacaoEncontroService.salvarResposta({
          encontroId,
          equipeId,
          pergunta,
          valor: respostas[pergunta.id] ?? '',
          userId: user.id,
        })
      ));
      await avaliacaoEncontroService.enviar(encontroId, equipeId, user.id);
      toast.success('Avaliação enviada com sucesso!');
      await loadAvaliacao();
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação.');
    } finally {
      setSaving(false);
    }
  };

  const steps: ActionStep[] = perguntas.map((pergunta, index) => {
    const answered = respostaPreenchida(pergunta, respostas[pergunta.id]);
    const status: ActionStep['status'] = index < currentIndex || (isSent && answered) ? 'completed' : index === currentIndex ? 'current' : 'pending';

    return {
      id: pergunta.id,
      title: `Pergunta ${index + 1}`,
      status,
      summary: answered && index !== currentIndex ? <span>Respondida</span> : undefined,
      onEdit: () => setCurrentIndex(index),
      editLabel: 'Abrir',
      children: (
        <QuestionStep
          pergunta={pergunta}
          value={respostas[pergunta.id] ?? ''}
          disabled={isSent || saving}
          index={index}
          total={perguntas.length}
          isSent={isSent}
          saving={saving}
          isFirst={index === 0}
          isLast={index === perguntas.length - 1}
          teamMembers={teamMembers}
          onChange={(value) => updateResposta(pergunta.id, value)}
          onSaveDraft={async () => {
            setSaving(true);
            try {
              await salvarPerguntaAtual();
              toast.success('Rascunho salvo.');
            } catch (error) {
              console.error('Erro ao salvar rascunho:', error);
              toast.error('Erro ao salvar rascunho.');
            } finally {
              setSaving(false);
            }
          }}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      ),
    };
  });

  if (loading) {
    return (
      <main className="main-content container avaliacao-resposta-page">
        <div className="empty-state">
          <Loader className="animate-spin" size={22} />
          Carregando avaliação...
        </div>
      </main>
    );
  }

  if (!userParticipacao?.coordenador || !encontroId || !equipeId) {
    return (
      <main className="main-content container avaliacao-resposta-page">
        <AccessCard
          icon={<Lock size={24} />}
          title="Avaliação indisponível"
          description="Esta tela é destinada ao coordenador da equipe do encontro ativo."
          onBack={() => navigate('/coordenador/minha-equipe')}
        />
      </main>
    );
  }

  if (!isReleased) {
    return (
      <main className="main-content container avaliacao-resposta-page">
        <AccessCard
          icon={<Lock size={24} />}
          title="Avaliação ainda não liberada"
          description={`A avaliação será liberada no último dia do encontro${encontro?.data_fim ? ` (${new Date(`${encontro.data_fim}T12:00:00`).toLocaleDateString('pt-BR')})` : ''}.`}
          onBack={() => navigate('/coordenador/minha-equipe')}
        />
      </main>
    );
  }

  return (
    <main className="main-content container avaliacao-resposta-page">
      <section className="avaliacao-response-hero card">
        <button type="button" className="btn-secondary" onClick={() => navigate('/coordenador/minha-equipe')}>
          <ArrowLeft size={16} />
          Minha equipe
        </button>
        <div>
          <span className="avaliacao-response-eyebrow">Avaliação do encontro</span>
          <h1>{encontro?.nome ?? 'Encontro'}</h1>
          <p>{userParticipacao.equipes?.nome ?? 'Sua equipe'} · {answeredCount} de {perguntas.length} respostas</p>
        </div>
        <span className={`avaliacao-response-status avaliacao-response-status--${envio?.status ?? 'pendente'}`}>
          {isSent ? 'Enviada' : envio?.status === 'rascunho' ? 'Rascunho' : 'Em andamento'}
        </span>
      </section>

      <section className="avaliacao-response-progress card">
        <div>
          <strong>{progress}% preenchido</strong>
          <span>{isSent ? 'Esta avaliação já foi enviada.' : 'As respostas são salvas como rascunho ao avançar.'}</span>
        </div>
        <div className="avaliacao-response-progress__bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      {perguntas.length === 0 ? (
        <div className="empty-state">A avaliação ainda não possui perguntas configuradas.</div>
      ) : (
        <section className="avaliacao-response-grid">
          <ActionStepper steps={steps} className="avaliacao-response-stepper" />
        </section>
      )}

      <style>{`
        .avaliacao-resposta-page {
          padding-bottom: 4rem;
        }

        .avaliacao-response-hero {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
          padding: 1.25rem;
        }

        .avaliacao-response-eyebrow {
          display: block;
          margin-bottom: 0.25rem;
          color: var(--primary-color);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .avaliacao-response-hero h1 {
          margin: 0;
          font-size: 1.55rem;
          letter-spacing: 0;
        }

        .avaliacao-response-hero p {
          margin: 0.3rem 0 0;
          color: var(--text-muted);
          font-size: 0.92rem;
        }

        .avaliacao-response-status {
          border-radius: 999px;
          padding: 0.42rem 0.78rem;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .avaliacao-response-status--enviado {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
        }

        .avaliacao-response-status--rascunho,
        .avaliacao-response-status--pendente {
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
        }

        .avaliacao-response-progress {
          display: grid;
          grid-template-columns: minmax(0, 220px) 1fr;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
          padding: 1rem;
        }

        .avaliacao-response-progress strong,
        .avaliacao-response-actions strong {
          display: block;
          font-size: 0.95rem;
        }

        .avaliacao-response-progress span,
        .avaliacao-response-actions span {
          display: block;
          margin-top: 0.2rem;
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .avaliacao-response-progress__bar {
          height: 10px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(var(--primary-rgb), 0.1);
        }

        .avaliacao-response-progress__bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--primary-color), #10b981);
          transition: width 0.2s ease;
        }

        .avaliacao-response-grid {
          display: block;
        }

        .avaliacao-response-stepper .action-stepper__content {
          padding: 1rem;
        }

        .avaliacao-question {
          display: grid;
          gap: 1rem;
          padding: 0.1rem 0 0;
        }

        .avaliacao-question__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid var(--border-color);
        }

        .avaliacao-question__title {
          margin: 0;
          font-size: 1rem;
          line-height: 1.32;
          font-weight: 750;
        }

        .avaliacao-question__description {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.92rem;
          line-height: 1.45;
        }

        .avaliacao-question__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.55rem;
        }

        .avaliacao-question__pill {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 0.28rem 0.58rem;
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .avaliacao-question__pill--required {
          background: rgba(245, 158, 11, 0.14);
          color: #f59e0b;
        }

        .avaliacao-question__editor .rich-text-editor-wrapper {
          background: var(--card-bg);
        }

        .avaliacao-question__description.rich-text-content {
          padding: 0;
          background: transparent;
        }

        .avaliacao-question__description.rich-text-content :is(p, ul, ol) {
          margin-top: 0.35rem;
          margin-bottom: 0;
        }

        .avaliacao-question__footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.85rem;
          border-top: 1px solid var(--border-color);
        }

        .avaliacao-question__footer-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .avaliacao-choice-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.65rem;
        }

        .avaliacao-choice {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 0.8rem;
          background: rgba(var(--primary-rgb), 0.03);
          color: var(--text-color);
          font-weight: 800;
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .avaliacao-choice.is-selected {
          border-color: var(--primary-color);
          background: rgba(var(--primary-rgb), 0.12);
          color: var(--primary-color);
        }

        .avaliacao-note-field {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          align-items: start;
        }

        .avaliacao-note-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(38px, 1fr));
          gap: 0.5rem;
          max-width: 320px;
        }

        .avaliacao-note-option {
          width: 100%;
          height: 40px;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--card-bg);
          color: var(--text-color);
          font-weight: 900;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .avaliacao-note-option:hover:not(:disabled),
        .avaliacao-note-option.is-selected {
          border-color: var(--primary-color);
          background: rgba(var(--primary-rgb), 0.14);
          color: var(--primary-color);
          transform: translateY(-1px);
        }

        .avaliacao-note-option:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .avaliacao-highlight-field {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid rgba(245, 158, 11, 0.28);
          border-radius: 14px;
          background: rgba(245, 158, 11, 0.07);
        }

        .avaliacao-highlight-callout {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          color: #f59e0b;
        }

        .avaliacao-highlight-callout strong {
          display: block;
          color: var(--text-color);
          font-size: 0.95rem;
        }

        .avaliacao-highlight-callout span {
          display: block;
          margin-top: 0.2rem;
          color: var(--text-muted);
          font-size: 0.82rem;
        }

        .avaliacao-highlight-select {
          display: grid;
          gap: 0.45rem;
        }

        .avaliacao-highlight-select label {
          margin: 0;
          color: var(--text-color);
          font-size: 0.86rem;
          font-weight: 800;
        }

        .avaliacao-highlight-select__row {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0.55rem;
          align-items: center;
        }

        .avaliacao-highlight-selected {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .avaliacao-highlight-chip {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          gap: 0.4rem;
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.14);
          color: var(--text-color);
          padding: 0.35rem 0.45rem 0.35rem 0.65rem;
          font-size: 0.82rem;
          font-weight: 750;
        }

        .avaliacao-highlight-chip span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .avaliacao-highlight-chip button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border: 0;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.18);
          color: #f59e0b;
          cursor: pointer;
        }

        .avaliacao-highlight-empty {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.82rem;
          line-height: 1.35;
        }

        @media (max-width: 860px) {
          .avaliacao-response-hero,
          .avaliacao-response-progress {
            grid-template-columns: 1fr;
          }

          .avaliacao-response-hero .btn-secondary,
          .avaliacao-response-status {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 520px) {
          .avaliacao-response-hero {
            padding: 1rem;
          }

          .avaliacao-response-hero h1 {
            font-size: 1.25rem;
          }

          .avaliacao-response-stepper .action-stepper__content {
            padding: 0.55rem 0 0;
          }

          .avaliacao-response-stepper .action-stepper__item--current .action-stepper__body {
            border-color: transparent;
            background: transparent;
            box-shadow: none;
            overflow: visible;
          }

          .avaliacao-response-stepper .action-stepper__item--current .action-stepper__header {
            padding: 0.25rem 0 0.45rem;
          }

          .avaliacao-question__title {
            font-size: 0.94rem;
            line-height: 1.28;
          }

          .avaliacao-question__description {
            font-size: 0.82rem;
            line-height: 1.35;
          }

          .avaliacao-question__header,
          .avaliacao-question__footer {
            flex-direction: column;
            align-items: stretch;
          }

          .avaliacao-question__footer-actions,
          .avaliacao-question__footer-actions .btn-secondary,
          .avaliacao-question__footer-actions .btn-primary {
            width: 100%;
            justify-content: center;
          }

          .avaliacao-choice-grid {
            grid-template-columns: 1fr;
          }

          .avaliacao-note-field {
            grid-template-columns: 1fr;
          }

          .avaliacao-note-options {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            max-width: none;
            gap: 0.45rem;
          }

          .avaliacao-note-option {
            height: 38px;
            border-radius: 9px;
          }

          .avaliacao-highlight-field {
            padding: 0.85rem;
          }

          .avaliacao-highlight-chip {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}

interface QuestionStepProps {
  pergunta: AvaliacaoPergunta;
  value: string;
  disabled: boolean;
  index: number;
  total: number;
  isSent: boolean;
  saving: boolean;
  isFirst: boolean;
  isLast: boolean;
  teamMembers: EquipeMemberOption[];
  onChange: (value: string) => void;
  onSaveDraft: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

function QuestionStep({
  pergunta,
  value,
  disabled,
  index,
  total,
  isSent,
  saving,
  isFirst,
  isLast,
  teamMembers,
  onChange,
  onSaveDraft,
  onPrevious,
  onNext,
  onSubmit,
}: QuestionStepProps) {
  return (
    <div className="avaliacao-question">
      <div className="avaliacao-question__header">
        <div>
          <h2 className="avaliacao-question__title">{pergunta.titulo}</h2>
          {pergunta.descricao && (
            <div
              className="avaliacao-question__description rich-text-content"
              dangerouslySetInnerHTML={{ __html: pergunta.descricao }}
            />
          )}
          <div className="avaliacao-question__meta">
            <span className="avaliacao-question__pill">{index + 1} de {total}</span>
            <span className={`avaliacao-question__pill ${pergunta.obrigatoria ? 'avaliacao-question__pill--required' : ''}`}>
              {pergunta.obrigatoria ? 'Obrigatória' : 'Opcional'}
            </span>
          </div>
        </div>
      </div>

      {pergunta.tipo === 'nota' && (
        <select className="form-select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecione uma nota</option>
          {Array.from({ length: getEscalaMax(pergunta) }, (_, index) => String(index + 1)).map((nota) => (
            <option key={nota} value={nota}>{nota}</option>
          ))}
        </select>
      )}

      {pergunta.tipo === 'nota_justificativa' && (
        <NotaJustificativaField
          pergunta={pergunta}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {pergunta.tipo === 'participante_destaque' && (
        <ParticipantesDestaqueField
          value={value}
          disabled={disabled}
          teamMembers={teamMembers}
          onChange={onChange}
        />
      )}

      {pergunta.tipo === 'sim_nao' && (
        <div className="avaliacao-choice-grid">
          {[
            ['sim', 'Sim'],
            ['nao', 'Não'],
          ].map(([optionValue, label]) => (
            <button
              key={optionValue}
              type="button"
              className={`avaliacao-choice ${value === optionValue ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => onChange(optionValue)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {pergunta.tipo === 'multipla_escolha' && (
        <div className="avaliacao-choice-grid">
          {(Array.isArray(pergunta.opcoes) ? pergunta.opcoes : []).map((opcao) => (
            <button
              key={opcao}
              type="button"
              className={`avaliacao-choice ${value === opcao ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => onChange(opcao)}
            >
              {opcao}
            </button>
          ))}
        </div>
      )}

      {(pergunta.tipo === 'texto' || pergunta.tipo === 'texto_longo') && (
        <div className="avaliacao-question__editor">
          <RichTextEditor
          content={value}
          onChange={onChange}
          disabled={disabled}
          placeholder="Digite a resposta da equipe..."
          minHeight={pergunta.tipo === 'texto' ? '140px' : '220px'}
          toolbarMode="list"
          />
        </div>
      )}

      <div className="avaliacao-question__footer">
        <span className="avaliacao-question__description">
          {isSent ? 'Avaliação enviada.' : 'Você pode salvar o rascunho ou avançar após responder.'}
        </span>
        <div className="avaliacao-question__footer-actions">
          {!isSent && (
            <button type="button" className="btn-secondary" disabled={saving} onClick={onSaveDraft}>
              {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
              Salvar rascunho
            </button>
          )}
          <button type="button" className="btn-secondary common-button" disabled={isFirst || saving} onClick={onPrevious}>
            <ChevronLeft size={18} />
            Anterior
          </button>
          {isLast ? (
            <button type="button" className="btn-primary common-button" disabled={saving || isSent} onClick={onSubmit}>
              {saving ? <Loader className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              Enviar
            </button>
          ) : (
            <button type="button" className="btn-primary common-button" disabled={saving} onClick={onNext}>
                {saving ? <Loader className="animate-spin" size={18} /> :
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Avançar
                    <ChevronRight size={18} />
                  </span>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NotaJustificativaField({
  pergunta,
  value,
  disabled,
  onChange,
}: {
  pergunta: AvaliacaoPergunta;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const parsed = parseNotaJustificativa(value) ?? { nota: '', justificativa: '' };
  const escalaMax = getEscalaMax(pergunta);

  const update = (next: { nota?: string; justificativa?: string }) => {
    onChange(JSON.stringify({
      nota: next.nota ?? parsed.nota,
      justificativa: next.justificativa ?? parsed.justificativa,
    }));
  };

  return (
    <div className="avaliacao-note-field">
      <div className="form-group avaliacao-note-picker" style={{ margin: 0 }}>
        <label>Nota</label>
        <div className="avaliacao-note-options">
          {Array.from({ length: escalaMax }, (_, index) => String(index + 1)).map((nota) => (
            <button
              key={nota}
              type="button"
              className={`avaliacao-note-option ${parsed.nota === nota ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => update({ nota })}
            >
              {nota}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Justificativa *</label>
        <RichTextEditor
          content={parsed.justificativa}
          onChange={(content) => update({ justificativa: content })}
          disabled={disabled}
          placeholder="Justifique a nota..."
          minHeight="160px"
          toolbarMode="list"
        />
      </div>
    </div>
  );
}

function ParticipantesDestaqueField({
  value,
  disabled,
  teamMembers,
  onChange,
}: {
  value: string;
  disabled: boolean;
  teamMembers: EquipeMemberOption[];
  onChange: (value: string) => void;
}) {
  const parsed = parseParticipantesDestaque(value) ?? { participacaoIds: [], participantesNomes: [], justificativa: '' };
  const selectedIds = parsed.participacaoIds;
  const selectedMembers = selectedIds.map((id, index) => {
    const member = teamMembers.find((item) => item.id === id);
    return {
      id,
      nome: member?.nome ?? parsed.participantesNomes[index] ?? 'Participante selecionado',
    };
  });

  const fetchTeamMemberOptions = useCallback(async (search: string, page: number) => {
    const pageSize = 8;
    const query = normalizeSearch(search);
    const currentSelectedIds = parseParticipantesDestaque(value)?.participacaoIds ?? [];
    const availableMembers = teamMembers.filter((member) => !currentSelectedIds.includes(member.id));
    const filtered = query
      ? availableMembers.filter((member) => normalizeSearch(member.nome).includes(query))
      : availableMembers;

    return filtered.slice(page * pageSize, (page + 1) * pageSize);
  }, [teamMembers, value]);

  const update = (next: { participacaoIds?: string[]; justificativa?: string }) => {
    const participacaoIds = next.participacaoIds ?? selectedIds;
    const nomes = teamMembers
      .filter((member) => participacaoIds.includes(member.id))
      .map((member) => member.nome);

    onChange(JSON.stringify({
      participacao_ids: participacaoIds,
      participantes_nomes: nomes,
      justificativa: next.justificativa ?? parsed.justificativa,
    }));
  };

  const addMember = (memberId: string) => {
    if (!memberId || selectedIds.includes(memberId)) return;
    update({ participacaoIds: [...selectedIds, memberId] });
  };

  const removeMember = (memberId: string) => {
    update({ participacaoIds: selectedIds.filter((id) => id !== memberId) });
  };

  return (
    <div className="avaliacao-highlight-field">
      <div className="avaliacao-highlight-callout">
        <Star size={18} />
        <div>
          <strong>Participantes destaque da equipe</strong>
          <span>Busque os membros destaque e justifique a escolha.</span>
        </div>
      </div>

      <div className="avaliacao-highlight-select">
        <label>Adicionar participante destaque *</label>
        <div className="avaliacao-highlight-select__row">
          <LiveSearchSelect<EquipeMemberOption>
            value=""
            onChange={(memberId) => addMember(memberId)}
            fetchData={fetchTeamMemberOptions}
            getOptionLabel={(member) => member.nome}
            getOptionValue={(member) => member.id}
            placeholder="Busque pelo nome do participante..."
            disabled={disabled}
            pageSize={8}
            initialOptions={teamMembers}
          />
        </div>
      </div>

      <div className="avaliacao-highlight-selected" aria-label="Participantes destaque selecionados">
        {selectedMembers.length > 0 ? selectedMembers.map((member) => (
          <span key={member.id} className="avaliacao-highlight-chip">
            <span>{member.nome}</span>
            {!disabled && (
              <button type="button" onClick={() => removeMember(member.id)} aria-label={`Remover ${member.nome}`}>
                <X size={14} />
              </button>
            )}
          </span>
        )) : (
          <p className="avaliacao-highlight-empty">Nenhum participante destaque selecionado.</p>
        )}
      </div>

      <div className="form-group" style={{ margin: 0 }}>
        <label>Justificativa *</label>
        <RichTextEditor
          content={parsed.justificativa}
          onChange={(content) => update({ justificativa: content })}
          disabled={disabled}
          placeholder="Explique por que estas pessoas foram destaque..."
          minHeight="160px"
          toolbarMode="list"
        />
      </div>
    </div>
  );
}

interface AccessCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  onBack: () => void;
}

function AccessCard({ icon, title, description, onBack }: AccessCardProps) {
  return (
    <div className="card" style={{ padding: '1.25rem', display: 'grid', gap: '1rem', maxWidth: 560 }}>
      <div style={{ color: 'var(--primary-color)' }}>{icon}</div>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.35rem' }}>{title}</h1>
        <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', lineHeight: 1.5 }}>{description}</p>
      </div>
      <button type="button" className="btn-secondary" onClick={onBack} style={{ justifySelf: 'start' }}>
        <ArrowLeft size={16} />
        Voltar
      </button>
    </div>
  );
}
