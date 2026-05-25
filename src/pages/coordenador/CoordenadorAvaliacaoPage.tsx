import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, ChevronLeft, ChevronRight, ClipboardCheck, Loader, Lock } from 'lucide-react';
import { ActionStepper, type ActionStep } from '../../components/ui/ActionStepper';
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

function isLastDay(dataFim: string | null | undefined) {
  return !!dataFim && dateKey(dataFim) === todayKey();
}

function respostaPreenchida(value: string | undefined) {
  return !!String(value ?? '').trim();
}

export function CoordenadorAvaliacaoPage() {
  const { user, userParticipacao, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [perguntas, setPerguntas] = useState<AvaliacaoPergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [envio, setEnvio] = useState<AvaliacaoEnvio | null>(null);
  const [encontro, setEncontro] = useState<EncontroAvaliacaoInfo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasPermission('modulo_admin');
  const isSent = envio?.status === 'enviado';
  const isReleased = isAdmin || isLastDay(encontro?.data_fim);
  const equipeId = userParticipacao?.equipe_id ?? null;
  const encontroId = userParticipacao?.encontro_id ?? null;

  const answeredCount = useMemo(
    () => perguntas.filter((pergunta) => respostaPreenchida(respostas[pergunta.id])).length,
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
      const [estado, encontroResult] = await Promise.all([
        avaliacaoEncontroService.obterEstado(encontroId, equipeId),
        supabase
          .from('encontros')
          .select('nome, data_fim')
          .eq('id', encontroId)
          .maybeSingle(),
      ]);

      if (encontroResult.error) throw encontroResult.error;

      const respostasMap = estado.respostas.reduce<Record<string, string>>((acc, resposta) => {
        acc[resposta.pergunta_id] = avaliacaoEncontroService.respostaParaValor(resposta);
        return acc;
      }, {});

      const firstPending = estado.perguntas.findIndex((pergunta) => pergunta.obrigatoria && !respostaPreenchida(respostasMap[pergunta.id]));

      setPerguntas(estado.perguntas);
      setRespostas(respostasMap);
      setEnvio(estado.envio);
      setEncontro((encontroResult.data ?? null) as EncontroAvaliacaoInfo | null);
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
    if (currentPergunta.obrigatoria && !respostaPreenchida(value)) {
      toast.error('Responda esta pergunta para continuar.');
      return false;
    }

    if (respostaPreenchida(value) || currentPergunta.obrigatoria) {
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

    const missingRequired = perguntas.filter((pergunta) => pergunta.obrigatoria && !respostaPreenchida(respostas[pergunta.id]));
    if (missingRequired.length > 0) {
      const firstMissingIndex = perguntas.findIndex((pergunta) => pergunta.id === missingRequired[0].id);
      setCurrentIndex(Math.max(firstMissingIndex, 0));
      toast.error('Responda todas as perguntas obrigatórias antes de enviar.');
      return;
    }

    setSaving(true);
    try {
      const perguntasComValor = perguntas.filter((pergunta) => respostaPreenchida(respostas[pergunta.id]) || pergunta.obrigatoria);
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
    const answered = respostaPreenchida(respostas[pergunta.id]);
    const status: ActionStep['status'] = index < currentIndex || (isSent && answered) ? 'completed' : index === currentIndex ? 'current' : 'pending';

    return {
      id: pergunta.id,
      title: `Pergunta ${index + 1}`,
      status,
      summary: (
        <span>
          {answered ? 'Respondida' : pergunta.obrigatoria ? 'Obrigatória' : 'Opcional'} · {pergunta.titulo}
        </span>
      ),
      onEdit: () => setCurrentIndex(index),
      editLabel: 'Abrir',
      children: (
        <QuestionStep
          pergunta={pergunta}
          value={respostas[pergunta.id] ?? ''}
          disabled={isSent || saving}
          onChange={(value) => updateResposta(pergunta.id, value)}
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

          <aside className="card avaliacao-response-actions">
            <ClipboardCheck size={24} />
            <div>
              <strong>Pergunta {currentIndex + 1} de {perguntas.length}</strong>
              <span>{currentPergunta?.obrigatoria ? 'Obrigatória' : 'Opcional'}</span>
            </div>

            {!isSent && (
              <button type="button" className="btn-secondary" disabled={saving} onClick={async () => {
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
              }}>
                {saving ? <Loader className="animate-spin" size={16} /> : null}
                Salvar rascunho
              </button>
            )}

            <div className="avaliacao-response-nav">
              <button type="button" className="btn-secondary" disabled={currentIndex === 0 || saving} onClick={handlePrevious}>
                <ChevronLeft size={16} />
                Anterior
              </button>
              {currentIndex < perguntas.length - 1 ? (
                <button type="button" className="btn-primary" disabled={saving} onClick={handleNext}>
                  {saving ? <Loader className="animate-spin" size={16} /> : <ChevronRight size={16} />}
                  Próxima
                </button>
              ) : (
                <button type="button" className="btn-primary" disabled={saving || isSent} onClick={handleSubmit}>
                  {saving ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                  Enviar
                </button>
              )}
            </div>
          </aside>
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
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 1rem;
          align-items: start;
        }

        .avaliacao-response-stepper .action-stepper__content {
          padding: 1rem;
        }

        .avaliacao-question {
          display: grid;
          gap: 0.85rem;
        }

        .avaliacao-question__title {
          margin: 0;
          font-size: 1.08rem;
          line-height: 1.35;
        }

        .avaliacao-question__description {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.92rem;
          line-height: 1.45;
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

        .avaliacao-response-actions {
          position: sticky;
          top: 1rem;
          display: grid;
          gap: 1rem;
          padding: 1rem;
        }

        .avaliacao-response-actions > svg {
          color: var(--primary-color);
        }

        .avaliacao-response-nav {
          display: grid;
          gap: 0.65rem;
        }

        @media (max-width: 860px) {
          .avaliacao-response-hero,
          .avaliacao-response-progress,
          .avaliacao-response-grid {
            grid-template-columns: 1fr;
          }

          .avaliacao-response-hero .btn-secondary,
          .avaliacao-response-status,
          .avaliacao-response-actions .btn-secondary,
          .avaliacao-response-actions .btn-primary {
            width: 100%;
            justify-content: center;
          }

          .avaliacao-response-actions {
            position: static;
            order: -1;
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
            padding: 0.85rem 0 0;
          }

          .avaliacao-choice-grid {
            grid-template-columns: 1fr;
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
  onChange: (value: string) => void;
}

function QuestionStep({ pergunta, value, disabled, onChange }: QuestionStepProps) {
  return (
    <div className="avaliacao-question">
      <div>
        <h2 className="avaliacao-question__title">{pergunta.titulo}</h2>
        {pergunta.descricao && <p className="avaliacao-question__description">{pergunta.descricao}</p>}
      </div>

      {pergunta.tipo === 'nota' && (
        <select className="form-select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          <option value="">Selecione uma nota</option>
          {Array.from({ length: 10 }, (_, index) => String(index + 1)).map((nota) => (
            <option key={nota} value={nota}>{nota}</option>
          ))}
        </select>
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
          {(pergunta.opcoes ?? []).map((opcao) => (
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
        <textarea
          className="form-textarea"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={pergunta.tipo === 'texto' ? 3 : 7}
          placeholder="Digite a resposta da equipe..."
          style={{ width: '100%', resize: 'vertical', minHeight: pergunta.tipo === 'texto' ? '108px' : '180px' }}
        />
      )}
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
