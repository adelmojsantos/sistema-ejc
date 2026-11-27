import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Mail, Maximize2, Minimize2, RotateCcw, Settings2, UserPlus, Users2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  accessProvisioningService,
  type AccessProvisioningCandidate,
  type AccessProvisioningResult,
} from '../../services/accessProvisioningService';
import { userFacingError } from '../../utils/userFacingError';
import { PersonEmailModal, type PersonEmailTarget } from './PersonEmailModal';
import { filterReleaseCandidates, isReleaseActionable, type CandidateFilters } from './teamAccessFilters';
import './TeamAccessReleasePanel.css';

interface TeamAccessReleasePanelProps {
  encontroId: string | null;
  encontroLabel: string;
}

const STATUS_LABELS: Record<AccessProvisioningCandidate['status'], string> = {
  sem_email: 'Sem e-mail',
  sem_usuario: 'Criar conta',
  sem_vinculo: 'Vincular conta',
  perfis_pendentes: 'Conceder perfis',
  pronto: 'Acesso correto',
  conflito_vinculo: 'Conflito de vínculo',
};

const STATUS_TONES: Record<AccessProvisioningCandidate['status'], 'success' | 'warning' | 'danger'> = {
  sem_email: 'danger',
  sem_usuario: 'warning',
  sem_vinculo: 'warning',
  perfis_pendentes: 'warning',
  pronto: 'success',
  conflito_vinculo: 'danger',
};

const DEFAULT_FILTERS: CandidateFilters = { equipeId: 'all', papel: 'all', status: 'all' };

export function TeamAccessReleasePanel({ encontroId, encontroLabel }: TeamAccessReleasePanelProps) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<AccessProvisioningCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<AccessProvisioningResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [filters, setFilters] = useState<CandidateFilters>(DEFAULT_FILTERS);
  const [emailTarget, setEmailTarget] = useState<PersonEmailTarget | null>(null);
  const requestRef = useRef(0);

  const loadCandidates = useCallback(async () => {
    const requestId = ++requestRef.current;
    setSelectedIds([]);
    setResults([]);

    if (!encontroId) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const loadedCandidates = await accessProvisioningService.listCandidates(encontroId);
      if (requestId !== requestRef.current) return;
      setCandidates(loadedCandidates);
    } catch (error: unknown) {
      if (requestId !== requestRef.current) return;
      toast.error(userFacingError(error, 'Não foi possível carregar as pessoas que podem receber acesso.'));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [encontroId]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const equipes = useMemo(() => {
    const byId = new Map<string, string>();
    candidates.forEach(candidate => byId.set(candidate.equipe_id, candidate.equipe_nome));
    return [...byId.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [candidates]);

  const visibleCandidates = useMemo(() => filterReleaseCandidates(candidates, filters), [candidates, filters]);
  const visibleActionableIds = useMemo(
    () => visibleCandidates.filter(isReleaseActionable).map(candidate => candidate.participacao_id),
    [visibleCandidates],
  );
  const counts = useMemo(() => ({
    pendentes: candidates.filter(isReleaseActionable).length,
    semEmail: candidates.filter(candidate => candidate.status === 'sem_email').length,
    prontos: candidates.filter(candidate => candidate.status === 'pronto').length,
    conflitos: candidates.filter(candidate => candidate.status === 'conflito_vinculo').length,
  }), [candidates]);

  const allVisibleSelected = visibleActionableIds.length > 0
    && visibleActionableIds.every(id => selectedIds.includes(id));
  const hasActiveFilters = filters.equipeId !== 'all' || filters.papel !== 'all' || filters.status !== 'all';

  const toggleCandidate = (participationId: string) => {
    setSelectedIds(current => current.includes(participationId)
      ? current.filter(id => id !== participationId)
      : [...current, participationId]);
  };

  const toggleAllVisible = () => {
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !visibleActionableIds.includes(id))
      : [...new Set([...current, ...visibleActionableIds])]);
  };

  const updateFilter = <K extends keyof CandidateFilters>(key: K, value: CandidateFilters[K]) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const handlePrepare = async () => {
    if (!encontroId || selectedIds.length === 0) return;
    setPreparing(true);
    setResults([]);
    try {
      const preparationResults = await accessProvisioningService.prepareCandidates(encontroId, selectedIds);
      const successCount = preparationResults.filter(result => result.success).length;
      const failureCount = preparationResults.length - successCount;
      if (successCount > 0) toast.success(`${successCount} acesso(s) liberado(s).`);
      if (failureCount > 0) toast.error(`${failureCount} acesso(s) precisam de correção.`);
      await loadCandidates();
      setResults(preparationResults);
    } catch (error: unknown) {
      toast.error(userFacingError(error, 'Não foi possível liberar os acessos selecionados.'));
    } finally {
      setPreparing(false);
    }
  };

  const configureUrl = `/admin/usuarios/configurar-acessos?encontro=${encodeURIComponent(encontroId ?? '')}`;

  return (
    <div className="team-access-panel">
      <div className="team-access-panel__header">
        <div>
          <h2 className="users-admin-section-title">Liberar acessos das equipes</h2>
          <p className="text-muted users-admin-section-text">
            Usa os perfis padrão definidos para cada equipe e função em {encontroLabel}. Quem não aparece aqui
            não tem perfil configurado para sua função. Para perfis diferentes do padrão, use a aba
            “Por equipe (perfis personalizados)”.
          </p>
        </div>
        <div className="team-access-panel__header-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(configureUrl)} disabled={!encontroId}>
            <Settings2 size={15} /> Configurar perfis padrão
          </button>
          <button type="button" className="btn-secondary" onClick={loadCandidates} disabled={!encontroId || loading}>
            <RotateCcw size={15} /> {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {!encontroId ? (
        <div className="alert alert--error">Selecione um encontro no topo da página para liberar acessos.</div>
      ) : loading ? (
        <p className="text-muted">Calculando acessos necessários...</p>
      ) : candidates.length === 0 ? (
        <div className="empty-state team-access-empty">
          Nenhuma equipe tem perfis padrão configurados neste encontro.
          <button type="button" className="btn-secondary" onClick={() => navigate(configureUrl)}>
            <Settings2 size={15} /> Configurar perfis padrão
          </button>
        </div>
      ) : (
        <>
          <div className="team-access-stats" aria-label="Resumo da liberação">
            <span><Users2 size={14} /> {candidates.length} com acesso previsto</span>
            <span className="team-access-stats__warning">{counts.pendentes} a liberar</span>
            <span className="team-access-stats__success"><CheckCircle size={14} /> {counts.prontos} com acesso correto</span>
            {counts.semEmail > 0 && <span className="team-access-stats__danger">{counts.semEmail} sem e-mail</span>}
            {counts.conflitos > 0 && <span className="team-access-stats__danger">{counts.conflitos} com conflito</span>}
          </div>

          <div className="team-access-filters">
            <div className="form-group">
              <label className="form-label" htmlFor="team-access-filter-equipe">Equipe</label>
              <select id="team-access-filter-equipe" className="form-input" value={filters.equipeId} onChange={event => updateFilter('equipeId', event.target.value)}>
                <option value="all">Todas as equipes</option>
                {equipes.map(equipe => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="team-access-filter-papel">Função</label>
              <select id="team-access-filter-papel" className="form-input" value={filters.papel} onChange={event => updateFilter('papel', event.target.value as CandidateFilters['papel'])}>
                <option value="all">Coordenação e integrantes</option>
                <option value="coordenador">Coordenação</option>
                <option value="integrante">Integrantes</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="team-access-filter-status">Situação</label>
              <select id="team-access-filter-status" className="form-input" value={filters.status} onChange={event => updateFilter('status', event.target.value as CandidateFilters['status'])}>
                <option value="all">Todas</option>
                <option value="pendentes">A liberar</option>
                <option value="sem_usuario">Criar conta</option>
                <option value="sem_vinculo">Vincular conta</option>
                <option value="perfis_pendentes">Conceder perfis</option>
                <option value="sem_email">Sem e-mail</option>
                <option value="conflito_vinculo">Conflito de vínculo</option>
                <option value="pronto">Acesso correto</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button type="button" className="btn-text team-access-filters__clear" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Limpar filtros
              </button>
            )}
          </div>

          <div className="team-access-list-toolbar">
            {visibleActionableIds.length > 0 ? (
              <label className="team-access-select-all">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                Selecionar {hasActiveFilters ? 'pendências filtradas' : 'todas as pendências'} ({visibleActionableIds.length})
              </label>
            ) : <span className="text-muted team-access-list-toolbar__hint">Nenhuma pendência {hasActiveFilters ? 'no filtro' : ''}</span>}
            <button
              type="button"
              className="btn-secondary team-access-expand-button"
              aria-expanded={isListExpanded}
              aria-controls="team-access-candidate-list"
              onClick={() => setIsListExpanded(current => !current)}
            >
              {isListExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              {isListExpanded ? 'Recolher lista' : 'Expandir lista'}
            </button>
          </div>
          <div
            id="team-access-candidate-list"
            className={`team-access-candidate-list${isListExpanded ? ' team-access-candidate-list--expanded' : ''}`}
            role="region"
            aria-label="Pessoas com acesso previsto"
          >
            {visibleCandidates.length === 0 && <p className="text-muted team-access-empty-filter">Ninguém corresponde aos filtros.</p>}
            {visibleCandidates.map(candidate => {
              const actionable = isReleaseActionable(candidate);
              const selected = selectedIds.includes(candidate.participacao_id);
              const result = results.find(current => current.participacao_id === candidate.participacao_id);
              return (
                <article
                  key={candidate.participacao_id}
                  className={`team-access-candidate${selected ? ' team-access-candidate--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${candidate.nome_completo}`}
                    checked={selected}
                    disabled={!actionable}
                    onChange={() => toggleCandidate(candidate.participacao_id)}
                  />
                  <div className="team-access-candidate__person">
                    <strong>{candidate.nome_completo}</strong>
                    <small>{candidate.email || 'Sem e-mail cadastrado'}</small>
                  </div>
                  <div className="team-access-candidate__team">
                    <strong>{candidate.equipe_nome}</strong>
                    <span>{candidate.papel === 'coordenador' ? 'Coordenação' : 'Integrante'}</span>
                  </div>
                  <div className="team-access-candidate__groups">
                    {candidate.grupos_nomes.map(groupName => <span key={groupName} className="users-admin-chip">{groupName}</span>)}
                  </div>
                  <div className="team-access-candidate__status">
                    <span className={`users-admin-status users-admin-status--${STATUS_TONES[candidate.status]}`}>
                      {STATUS_LABELS[candidate.status]}
                    </span>
                    {candidate.status === 'sem_email' && (
                      <button
                        type="button"
                        className="btn-text team-access-candidate__email"
                        onClick={() => setEmailTarget({
                          pessoaId: candidate.pessoa_id,
                          nome: candidate.nome_completo,
                          detalhe: `${candidate.equipe_nome} · ${candidate.papel === 'coordenador' ? 'Coordenação' : 'Integrante'}`,
                        })}
                      >
                        <Mail size={13} /> Cadastrar e-mail
                      </button>
                    )}
                    {result && (
                      <small className={result.success ? 'team-access-result--ok' : 'team-access-result--error'}>
                        {result.success ? 'Processado' : result.message}
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="team-access-footer">
            <span className="text-muted">{selectedIds.length} selecionado(s)</span>
            <button type="button" className="btn-primary" onClick={handlePrepare} disabled={preparing || selectedIds.length === 0}>
              <UserPlus size={16} /> {preparing ? 'Liberando...' : `Liberar selecionados (${selectedIds.length})`}
            </button>
          </div>
        </>
      )}

      <PersonEmailModal target={emailTarget} onClose={() => setEmailTarget(null)} onSaved={loadCandidates} />
    </div>
  );
}
