import { useMemo, useState } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, Loader, Save } from 'lucide-react';
import type { PesquisaSatisfacaoQuestion, PesquisaSatisfacaoResposta, PesquisaSatisfacaoRespostas } from '../../types/pesquisaSatisfacao';
import { PESQUISA_SATISFACAO_QUESTIONS } from '../../types/pesquisaSatisfacao';

interface PesquisaSatisfacaoFormProps {
  questions?: PesquisaSatisfacaoQuestion[];
  respostas: PesquisaSatisfacaoRespostas;
  disabled?: boolean;
  saving?: boolean;
  submitLabel?: string;
  onChange: (respostas: PesquisaSatisfacaoRespostas) => void;
  onSaveDraft: () => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
}

function needsObservation(resposta: PesquisaSatisfacaoResposta | undefined) {
  return resposta?.opcao === 'nao' || resposta?.opcao === 'em_partes';
}

function questionAnswered(question: PesquisaSatisfacaoQuestion, resposta: PesquisaSatisfacaoResposta | undefined) {
  if (!question.required) return true;

  if (question.type === 'sim_nao_partes') {
    if (!resposta?.opcao) return false;
    if (needsObservation(resposta) && !resposta.observacao?.trim()) return false;
    return true;
  }

  if (question.type === 'texto') return !!resposta?.texto?.trim();
  if (question.type === 'nota') return !!resposta?.nota;
  if (question.type === 'sim_nao') return !!resposta?.simNao;
  return false;
}

function buildSections(questions: PesquisaSatisfacaoQuestion[]) {
  return Array.from(
    questions.reduce((map, question) => {
      if (!map.has(question.sectionId)) {
        map.set(question.sectionId, {
          id: question.sectionId,
          title: question.sectionTitle,
          questions: [] as PesquisaSatisfacaoQuestion[],
        });
      }
      map.get(question.sectionId)!.questions.push(question);
      return map;
    }, new Map<string, { id: string; title: string; questions: PesquisaSatisfacaoQuestion[] }>())
      .values()
  );
}

function sectionComplete(section: { questions: PesquisaSatisfacaoQuestion[] }, respostas: PesquisaSatisfacaoRespostas) {
  return section.questions.every((question) => questionAnswered(question, respostas[question.id]));
}

export function pesquisaSatisfacaoCompleta(
  respostas: PesquisaSatisfacaoRespostas,
  questions: PesquisaSatisfacaoQuestion[] = PESQUISA_SATISFACAO_QUESTIONS
) {
  const sections = buildSections(questions);
  return sections.length > 0 && sections.every((section) => sectionComplete(section, respostas));
}

export function PesquisaSatisfacaoForm({
  questions = PESQUISA_SATISFACAO_QUESTIONS,
  respostas,
  disabled = false,
  saving = false,
  submitLabel = 'Enviar pesquisa',
  onChange,
  onSaveDraft,
  onSubmit,
}: PesquisaSatisfacaoFormProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const sections = useMemo(() => buildSections(questions), [questions]);
  const safeSectionIndex = Math.min(currentSectionIndex, Math.max(sections.length - 1, 0));
  const currentSection = sections[safeSectionIndex];
  const isFirst = currentSectionIndex === 0;
  const isLast = currentSectionIndex === sections.length - 1;

  const answeredSections = useMemo(
    () => sections.filter((section) => sectionComplete(section, respostas)).length,
    [respostas, sections]
  );

  const updateResposta = (questionId: string, patch: PesquisaSatisfacaoResposta) => {
    onChange({
      ...respostas,
      [questionId]: {
        ...(respostas[questionId] ?? {}),
        ...patch,
      },
    });
  };

  const goNext = () => {
    if (!currentSection || !sectionComplete(currentSection, respostas)) return;
    setCurrentSectionIndex((current) => Math.min(current + 1, sections.length - 1));
  };

  if (!currentSection) {
    return <div className="empty-state">Nenhuma pergunta cadastrada para esta pesquisa.</div>;
  }

  return (
    <div className="pesquisa-satisfacao-form">
      <div className="pesquisa-satisfacao-progress">
        <div>
          <strong>{answeredSections} de {sections.length} seções completas</strong>
          <span>{disabled ? 'Pesquisa enviada.' : 'Você pode salvar rascunho e continuar depois.'}</span>
        </div>
        <div className="pesquisa-satisfacao-progress__bar">
          <span style={{ width: `${Math.round((answeredSections / sections.length) * 100)}%` }} />
        </div>
      </div>

      <div className="pesquisa-satisfacao-steps" aria-label="Seções da pesquisa">
        {sections.map((section, index) => {
          const complete = sectionComplete(section, respostas);
          return (
            <button
              key={section.id}
              type="button"
              className={`pesquisa-satisfacao-step ${index === currentSectionIndex ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}
              onClick={() => setCurrentSectionIndex(index)}
            >
              <span>{index + 1}</span>
              {section.title}
            </button>
          );
        })}
      </div>

      <section className="pesquisa-satisfacao-section">
        <header>
          <span>Seção {currentSectionIndex + 1}</span>
          <h2>{currentSection.title}</h2>
        </header>

        <div className="pesquisa-satisfacao-questions">
          {currentSection.questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              resposta={respostas[question.id]}
              disabled={disabled}
              onChange={(patch) => updateResposta(question.id, patch)}
            />
          ))}
        </div>
      </section>

      <footer className="pesquisa-satisfacao-actions">
        <button type="button" className="btn-secondary" disabled={isFirst || saving} onClick={() => setCurrentSectionIndex((current) => Math.max(current - 1, 0))}>
          <ChevronLeft size={16} />
          Anterior
        </button>

        {!disabled && (
          <button type="button" className="btn-secondary" disabled={saving} onClick={onSaveDraft}>
            {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
            Salvar rascunho
          </button>
        )}

        {isLast ? (
          <button type="button" className="btn-primary" disabled={saving || disabled || !pesquisaSatisfacaoCompleta(respostas, questions)} onClick={onSubmit}>
            {saving ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />}
            {submitLabel}
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={saving || !sectionComplete(currentSectionIndex, respostas)} onClick={goNext}>
            Avançar
            <ChevronRight size={16} />
          </button>
        )}
      </footer>

      <style>{`
        .pesquisa-satisfacao-form {
          display: grid;
          gap: 1rem;
        }

        .pesquisa-satisfacao-progress {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          display: grid;
          gap: 0.75rem;
          padding: 1rem;
        }

        .pesquisa-satisfacao-progress strong {
          display: block;
          color: var(--text-color);
          font-size: 0.95rem;
        }

        .pesquisa-satisfacao-progress span {
          display: block;
          color: var(--muted-text);
          font-size: 0.82rem;
          margin-top: 0.2rem;
        }

        .pesquisa-satisfacao-progress__bar {
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 999px;
          height: 9px;
          overflow: hidden;
        }

        .pesquisa-satisfacao-progress__bar span {
          background: linear-gradient(90deg, var(--primary-color), #10b981);
          display: block;
          height: 100%;
        }

        .pesquisa-satisfacao-steps {
          align-items: stretch;
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(auto-fit, minmax(178px, 1fr));
        }

        .pesquisa-satisfacao-step {
          align-items: center;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-color);
          cursor: pointer;
          display: inline-flex;
          font-weight: 800;
          gap: 0.45rem;
          justify-content: flex-start;
          line-height: 1.18;
          min-height: 48px;
          min-width: 0;
          overflow-wrap: anywhere;
          padding: 0.55rem 0.7rem;
          text-align: left;
          white-space: normal;
        }

        .pesquisa-satisfacao-step span {
          align-items: center;
          background: var(--secondary-bg);
          border-radius: 999px;
          display: inline-flex;
          flex: 0 0 24px;
          flex-shrink: 0;
          height: 24px;
          justify-content: center;
          font-size: 0.72rem;
        }

        .pesquisa-satisfacao-step.is-active {
          border-color: var(--primary-color);
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
        }

        .pesquisa-satisfacao-step.is-complete span {
          background: rgba(16, 185, 129, 0.14);
          color: #10b981;
        }

        .pesquisa-satisfacao-section {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 1rem;
        }

        .pesquisa-satisfacao-section header {
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 1rem;
          padding-bottom: 0.85rem;
        }

        .pesquisa-satisfacao-section header span {
          color: var(--primary-color);
          display: block;
          font-size: 0.72rem;
          font-weight: 900;
          margin-bottom: 0.25rem;
          text-transform: uppercase;
        }

        .pesquisa-satisfacao-section h2 {
          color: var(--text-color);
          font-size: 1.2rem;
          margin: 0;
        }

        .pesquisa-satisfacao-questions {
          display: grid;
          gap: 1rem;
        }

        .pesquisa-question {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          display: grid;
          gap: 0.75rem;
          padding: 0.9rem;
        }

        .pesquisa-question > strong {
          color: var(--text-color);
          font-size: 0.95rem;
          line-height: 1.35;
        }

        .pesquisa-options {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        }

        .pesquisa-option {
          border: 1px solid var(--border-color);
          border-radius: 9px;
          background: var(--card-bg);
          color: var(--text-color);
          cursor: pointer;
          font-weight: 850;
          min-height: 40px;
        }

        .pesquisa-option.is-selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.22);
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.45);
          color: #d1fae5;
        }

        .pesquisa-question textarea {
          min-height: 110px;
          resize: vertical;
        }

        .pesquisa-note-grid {
          display: grid;
          grid-template-columns: repeat(10, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .pesquisa-note-grid button {
          border: 1px solid var(--border-color);
          border-radius: 9px;
          background: var(--card-bg);
          color: var(--text-color);
          cursor: pointer;
          font-weight: 900;
          height: 38px;
        }

        .pesquisa-note-grid button.is-selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.22);
          box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.45);
          color: #d1fae5;
        }

        .pesquisa-satisfacao-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          justify-content: flex-end;
        }

        .pesquisa-satisfacao-actions button {
          align-items: center;
          display: inline-flex;
          gap: 0.4rem;
          justify-content: center;
        }

        @media (max-width: 560px) {
          .pesquisa-satisfacao-section {
            padding: 0.8rem;
          }

          .pesquisa-note-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .pesquisa-satisfacao-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function QuestionField({
  question,
  resposta,
  disabled,
  onChange,
}: {
  question: PesquisaSatisfacaoQuestion;
  resposta: PesquisaSatisfacaoResposta | undefined;
  disabled: boolean;
  onChange: (patch: PesquisaSatisfacaoResposta) => void;
}) {
  return (
    <article className="pesquisa-question">
      <strong>{question.title}</strong>

      {question.type === 'sim_nao_partes' && (
        <>
          <div className="pesquisa-options">
            {[
              ['sim', 'Sim'],
              ['nao', 'Não'],
              ['em_partes', 'Em partes'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`pesquisa-option ${resposta?.opcao === value ? 'is-selected' : ''}`}
                disabled={disabled}
                onClick={() => onChange({ opcao: value as PesquisaSatisfacaoResposta['opcao'] })}
              >
                {label}
              </button>
            ))}
          </div>

          {needsObservation(resposta) && (
            <textarea
              className="form-input"
              disabled={disabled}
              value={resposta?.observacao ?? ''}
              onChange={(event) => onChange({ observacao: event.target.value })}
              placeholder="Conte brevemente o motivo..."
            />
          )}
        </>
      )}

      {question.type === 'texto' && (
        <textarea
          className="form-input"
          disabled={disabled}
          value={resposta?.texto ?? ''}
          onChange={(event) => onChange({ texto: event.target.value })}
          placeholder="Digite sua resposta..."
        />
      )}

      {question.type === 'nota' && (
        <div className="pesquisa-note-grid">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((nota) => (
            <button
              key={nota}
              type="button"
              disabled={disabled}
              className={resposta?.nota === nota ? 'is-selected' : ''}
              onClick={() => onChange({ nota })}
            >
              {nota}
            </button>
          ))}
        </div>
      )}

      {question.type === 'sim_nao' && (
        <div className="pesquisa-options">
          {[
            ['sim', 'Sim'],
            ['nao', 'Não'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`pesquisa-option ${resposta?.simNao === value ? 'is-selected' : ''}`}
              disabled={disabled}
              onClick={() => onChange({ simNao: value as 'sim' | 'nao' })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
