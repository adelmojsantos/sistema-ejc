import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, CheckCircle, ChevronDown, ClipboardCopy, KeyRound, Loader, Mail, RotateCcw, Save, XCircle } from 'lucide-react';
import {
  accessProvisioningService,
  type AccessProvisioningResult,
  type MyTeamAccessOverview,
} from '../../services/accessProvisioningService';
import { userFacingError } from '../../utils/userFacingError';
import {
  COORDINATOR_STATUS_INFO,
  buildTeamAccessInstructions,
  buildTeamAccessReleasePlan,
  isCoordinatorReleasable,
} from '../../utils/teamAccessRelease';
import './CoordenadorAcessosPage.css';

type Step = 'selecao' | 'revisao' | 'resultado';

export function CoordenadorAcessosPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<MyTeamAccessOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('selecao');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<AccessProvisioningResult[]>([]);
  const requestRef = useRef(0);

  const load = useCallback(async (keepSelectedIds: string[] = []) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await accessProvisioningService.getMyTeamOverview();
      if (requestId !== requestRef.current) return;
      setOverview(data);
      const releasableIds = new Set((data.disponivel ? data.candidates : [])
        .filter(candidate => isCoordinatorReleasable(candidate.status))
        .map(candidate => candidate.participacao_id));
      setSelectedIds(keepSelectedIds.filter(id => releasableIds.has(id)));
    } catch (error: unknown) {
      if (requestId !== requestRef.current) return;
      setLoadError(userFacingError(error, 'Não foi possível carregar os integrantes da equipe.'));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const candidates = useMemo(() => (overview?.disponivel ? overview.candidates : []), [overview]);
  const releasable = useMemo(() => candidates.filter(candidate => isCoordinatorReleasable(candidate.status)), [candidates]);
  const plan = useMemo(() => buildTeamAccessReleasePlan(candidates, selectedIds), [candidates, selectedIds]);
  const instructions = useMemo(() => buildTeamAccessInstructions(window.location.origin), []);
  const readyCount = candidates.filter(candidate => candidate.status === 'pronto').length;

  const toggle = (participacaoId: string) => {
    setSelectedIds(current => current.includes(participacaoId)
      ? current.filter(id => id !== participacaoId)
      : [...current, participacaoId]);
  };

  const allSelected = releasable.length > 0 && selectedIds.length === releasable.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : releasable.map(candidate => candidate.participacao_id));

  const copyInstructions = async () => {
    try {
      await navigator.clipboard.writeText(instructions);
      toast.success('Orientações copiadas.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  };

  const saveEmail = async (participacaoId: string, email: string) => {
    try {
      await accessProvisioningService.setMyTeamMemberEmail(participacaoId, email);
      toast.success('E-mail salvo.');
      await load([...selectedIds, participacaoId]);
    } catch (error: unknown) {
      toast.error(userFacingError(error, 'Não foi possível salvar o e-mail.'));
    }
  };

  const confirm = async () => {
    const ids = [...plan.convites, ...plan.perfis].map(candidate => candidate.participacao_id);
    if (ids.length === 0) return;
    setProcessing(true);
    try {
      const response = await accessProvisioningService.prepareMyTeamAccesses(ids);
      setResults(response);
      setStep('resultado');
      const failures = response.filter(result => !result.success).length;
      if (failures === 0) toast.success('Acessos liberados.');
      else toast.error(`${failures} liberação(ões) não foram concluídas.`);
    } catch (error: unknown) {
      toast.error(userFacingError(error, 'Não foi possível liberar os acessos selecionados.'));
    } finally {
      setProcessing(false);
    }
  };

  const backToList = () => {
    setStep('selecao');
    setResults([]);
    void load();
  };

  const header = (
    <div className="team-release-header">
      <button
        type="button"
        className="icon-btn"
        aria-label="Voltar"
        onClick={() => (step === 'revisao' ? setStep('selecao') : navigate('/coordenador/minha-equipe'))}
      >
        <ArrowLeft size={20} />
      </button>
      <div style={{ minWidth: 0 }}>
        <h1 className="page-title text-gradient">
          {step === 'revisao' ? 'Revisar liberação' : step === 'resultado' ? 'Liberação concluída' : 'Liberar acessos'}
        </h1>
        {overview?.disponivel && <p>{overview.equipe_nome} · {overview.encontro_nome}</p>}
      </div>
    </div>
  );

  if (loading && !overview) {
    return (
      <div className="team-release-page">
        {header}
        <p className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Loader size={16} className="animate-spin" /> Carregando integrantes...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="team-release-page">
        {header}
        <div className="team-release-card">
          <p>{loadError}</p>
          <button type="button" className="btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => void load()}>
            <RotateCcw size={15} /> Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!overview?.disponivel) {
    return (
      <div className="team-release-page">
        {header}
        <div className="team-release-card">
          <h2>Liberação indisponível</h2>
          <p>{overview?.mensagem ?? 'A liberação de acessos não está disponível para sua equipe.'}</p>
        </div>
      </div>
    );
  }

  const gruposCard = (
    <div className="team-release-card">
      <h2>Os integrantes vão receber</h2>
      {overview.grupos_nomes.length > 0 ? (
        <div className="team-release-groups">
          {overview.grupos_nomes.map(nome => <span key={nome} className="badge">{nome}</span>)}
        </div>
      ) : (
        <p>A administração ainda não definiu os acessos dos integrantes da sua equipe para este encontro.</p>
      )}
    </div>
  );

  if (step === 'revisao') {
    const total = plan.convites.length + plan.perfis.length;
    return (
      <div className="team-release-page">
        {header}
        <p className="text-muted" style={{ margin: 0 }}>{total} integrante(s) selecionado(s). Confira antes de confirmar.</p>

        {plan.convites.length > 0 && (
          <details className="team-release-section" open>
            <summary>
              <Mail size={18} color="var(--primary-color)" />
              Receberão convite por e-mail ({plan.convites.length})
              <ChevronDown size={18} className="team-release-chevron" />
            </summary>
            <p className="team-release-section-desc">Ainda não têm conta no sistema. Confira se os e-mails estão corretos.</p>
            <ul className="team-release-names">
              {plan.convites.map(candidate => (
                <li key={candidate.participacao_id}>
                  {candidate.nome_completo} <small>— {candidate.email}</small>
                </li>
              ))}
            </ul>
          </details>
        )}

        {plan.perfis.length > 0 && (
          <details className="team-release-section" open>
            <summary>
              <KeyRound size={18} color="var(--primary-color)" />
              Receberão os perfis ({plan.perfis.length})
              <ChevronDown size={18} className="team-release-chevron" />
            </summary>
            <p className="team-release-section-desc">Já têm conta no sistema; nenhum e-mail será enviado.</p>
            <ul className="team-release-names">
              {plan.perfis.map(candidate => <li key={candidate.participacao_id}>{candidate.nome_completo}</li>)}
            </ul>
          </details>
        )}

        {gruposCard}

        <InstructionsCard siteUrl={window.location.origin} onCopy={copyInstructions} />

        <div className="team-release-actionbar">
          <button type="button" className="btn-secondary" onClick={() => setStep('selecao')} disabled={processing}>
            Voltar
          </button>
          <button type="button" className="btn-primary" onClick={() => void confirm()} disabled={processing || total === 0}>
            {processing ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {processing ? 'Liberando...' : 'Confirmar liberação'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'resultado') {
    const successes = results.filter(result => result.success);
    const failures = results.filter(result => !result.success);
    return (
      <div className="team-release-page">
        {header}
        <div className="team-release-result-summary">
          <span style={{ color: 'var(--success-text)' }}><CheckCircle size={15} style={{ verticalAlign: 'middle' }} /> {successes.length} concluído(s)</span>
          {failures.length > 0 && (
            <span style={{ color: 'var(--danger-text)' }}><XCircle size={15} style={{ verticalAlign: 'middle' }} /> {failures.length} com problema</span>
          )}
        </div>

        <ul className="team-release-list">
          {results.map(result => (
            <li key={result.participacao_id} className="team-release-item">
              {result.success
                ? <CheckCircle size={18} color="var(--success-text)" style={{ flexShrink: 0 }} />
                : <XCircle size={18} color="var(--danger-text)" style={{ flexShrink: 0 }} />}
              <div className="team-release-item-body">
                <strong>{result.nome_completo}</strong>
                <small>
                  {result.success
                    ? (result.created ? 'Convite enviado por e-mail' : 'Perfis concedidos')
                    : (result.message ?? 'Não foi possível concluir. Procure a administração.')}
                </small>
              </div>
            </li>
          ))}
        </ul>

        {successes.length > 0 && <InstructionsCard siteUrl={window.location.origin} onCopy={copyInstructions} />}

        <div className="team-release-actionbar">
          <button type="button" className="btn-primary" onClick={backToList}>
            Voltar à lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-release-page">
      {header}
      {gruposCard}

      {candidates.length === 0 ? (
        <div className="team-release-card">
          <p>Nenhum integrante da sua equipe possui acesso configurado neste encontro.</p>
        </div>
      ) : (
        <>
          <div className="team-release-toolbar">
            {releasable.length > 0 ? (
              <label>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                Selecionar todos os pendentes ({releasable.length})
              </label>
            ) : <span>Nenhuma liberação pendente.</span>}
            <span className="team-release-counts">{candidates.length} integrante(s) · {readyCount} com acesso</span>
          </div>

          <ul className="team-release-list" aria-label="Integrantes da equipe">
            {candidates.map(candidate => {
              const actionable = isCoordinatorReleasable(candidate.status);
              const selected = selectedIds.includes(candidate.participacao_id);
              const info = COORDINATOR_STATUS_INFO[candidate.status];
              const className = [
                'team-release-item',
                actionable ? 'team-release-item--selectable' : 'team-release-item--disabled',
                selected ? 'team-release-item--selected' : '',
                candidate.status === 'sem_email' ? 'team-release-item--with-form' : '',
              ].filter(Boolean).join(' ');
              // Linhas não selecionáveis não usam <label> para que o campo de e-mail
              // não acione o checkbox.
              const Row = actionable ? 'label' : 'div';
              return (
                <li key={candidate.participacao_id}>
                  <Row className={className}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${candidate.nome_completo}`}
                      checked={selected}
                      disabled={!actionable}
                      onChange={() => toggle(candidate.participacao_id)}
                    />
                    <span className="team-release-item-body">
                      <strong>{candidate.nome_completo}</strong>
                      <small>{candidate.email || 'Sem e-mail cadastrado'}</small>
                      <span className={`team-release-status team-release-status--${info.tone}`}>
                        {info.label}
                        {info.hint && <span className="team-release-status-hint"> · {info.hint}</span>}
                      </span>
                    </span>
                    {candidate.status === 'sem_email' && (
                      <MemberEmailForm
                        nome={candidate.nome_completo}
                        onSave={email => saveEmail(candidate.participacao_id, email)}
                      />
                    )}
                  </Row>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="team-release-actionbar">
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
          <RotateCcw size={15} /> {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        <button type="button" className="btn-primary" onClick={() => setStep('revisao')} disabled={selectedIds.length === 0}>
          Revisar liberação ({selectedIds.length})
        </button>
      </div>
    </div>
  );
}

function MemberEmailForm({ nome, onSave }: { nome: string; onSave: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await onSave(email);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="team-release-email-form" onSubmit={event => void submit(event)}>
      <input
        type="email"
        className="form-input"
        inputMode="email"
        autoComplete="off"
        placeholder="email@exemplo.com"
        aria-label={`E-mail de ${nome}`}
        value={email}
        onChange={event => setEmail(event.target.value)}
        disabled={saving}
        required
      />
      <button type="submit" className="btn-secondary" disabled={saving || !email.trim()}>
        {saving ? <Loader size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  );
}

function InstructionsCard({ siteUrl, onCopy }: { siteUrl: string; onCopy: () => void }) {
  return (
    <div className="team-release-card">
      <h2>Próximos passos para os integrantes</h2>
      <p className="team-release-steps-title">Quem recebe convite por e-mail:</p>
      <ol className="team-release-steps">
        <li>Abrir o e-mail de convite (conferir também a caixa de spam/lixo eletrônico).</li>
        <li>Clicar no link do e-mail e criar a senha.</li>
        <li>Entrar em <strong>{siteUrl}</strong> com o e-mail e a nova senha.</li>
      </ol>
      <p className="team-release-steps-title">Quem já tem conta:</p>
      <ul className="team-release-steps">
        <li>Sair e entrar novamente para ver os novos menus.</li>
      </ul>
      <button type="button" className="btn-secondary" onClick={onCopy} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
        <ClipboardCopy size={15} /> Copiar orientações
      </button>
    </div>
  );
}
