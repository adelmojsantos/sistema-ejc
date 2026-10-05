import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Maximize2, Minimize2, RotateCcw, Settings2, UserPlus, Users2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  accessProvisioningService,
  type AccessProvisioningCandidate,
  type AccessProvisioningResult,
} from '../../services/accessProvisioningService';
import { userFacingError } from '../../utils/userFacingError';
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

export function TeamAccessReleasePanel({ encontroId, encontroLabel }: TeamAccessReleasePanelProps) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<AccessProvisioningCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<AccessProvisioningResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
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

  const actionableCandidates = useMemo(
    () => candidates.filter(candidate => !['pronto', 'sem_email', 'conflito_vinculo'].includes(candidate.status)),
    [candidates],
  );

  const toggleCandidate = (participationId: string) => {
    setSelectedIds(current => current.includes(participationId)
      ? current.filter(id => id !== participationId)
      : [...current, participationId]);
  };

  const toggleAllCandidates = () => {
    const actionableIds = actionableCandidates.map(candidate => candidate.participacao_id);
    setSelectedIds(current => current.length === actionableIds.length ? [] : actionableIds);
  };

  const handlePrepare = async () => {
    if (!encontroId || selectedIds.length === 0) return;
    setPreparing(true);
    setResults([]);
    try {
      const preparationResults = await accessProvisioningService.prepareCandidates(encontroId, selectedIds);
      const successCount = preparationResults.filter(result => result.success).length;
      const failureCount = preparationResults.length - successCount;
      if (successCount > 0) toast.success(`${successCount} acesso(s) preparado(s).`);
      if (failureCount > 0) toast.error(`${failureCount} acesso(s) precisam de correção.`);
      await loadCandidates();
      setResults(preparationResults);
    } catch (error: unknown) {
      toast.error(userFacingError(error, 'Não foi possível preparar os acessos selecionados.'));
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Liberar acessos de {encontroLabel}</h3>
          <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.86rem' }}>
            Somente pessoas com perfis definidos para sua equipe e função aparecem aqui.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/admin/usuarios/configurar-acessos?encontro=${encodeURIComponent(encontroId ?? '')}`)}
            disabled={!encontroId}
          >
            <Settings2 size={15} /> Configurar acessos por equipe
          </button>
          <button type="button" className="btn-secondary" onClick={loadCandidates} disabled={!encontroId || loading}>
            <RotateCcw size={15} /> {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button type="button" className="btn-primary" onClick={handlePrepare} disabled={preparing || selectedIds.length === 0}>
            <UserPlus size={16} /> {preparing ? 'Preparando...' : `Liberar selecionados (${selectedIds.length})`}
          </button>
        </div>
      </div>

      {!encontroId ? (
        <div className="alert alert--error">Selecione um encontro no contexto de edição para liberar acessos.</div>
      ) : loading ? (
        <p className="text-muted">Calculando acessos necessários...</p>
      ) : candidates.length === 0 ? (
        <div className="empty-state" style={{ padding: '1.5rem' }}>
          Nenhuma pessoa possui acesso configurado para sua equipe e função neste encontro.
        </div>
      ) : (
        <>
          <div className="team-access-list-toolbar">
            {actionableCandidates.length > 0 ? (
              <label className="team-access-select-all">
                <input type="checkbox" checked={selectedIds.length === actionableCandidates.length} onChange={toggleAllCandidates} />
                Selecionar todas as pendências
              </label>
            ) : <span />}
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
            {candidates.map(candidate => {
              const actionable = !['pronto', 'sem_email', 'conflito_vinculo'].includes(candidate.status);
              const result = results.find(current => current.participacao_id === candidate.participacao_id);
              return (
                <article key={candidate.participacao_id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.85rem', background: 'var(--surface-1)' }}>
                  <input type="checkbox" aria-label={`Selecionar ${candidate.nome_completo}`} checked={selectedIds.includes(candidate.participacao_id)} disabled={!actionable} onChange={() => toggleCandidate(candidate.participacao_id)} />
                  <div style={{ minWidth: '180px', flex: '1 1 220px' }}>
                    <strong style={{ display: 'block' }}>{candidate.nome_completo}</strong>
                    <small style={{ color: 'var(--muted-text)' }}>{candidate.email || 'Sem e-mail cadastrado'}</small>
                  </div>
                  <div style={{ fontSize: '0.82rem', flex: '1 1 150px' }}>
                    <strong style={{ display: 'block' }}>{candidate.equipe_nome}</strong>
                    <span style={{ color: 'var(--muted-text)' }}>{candidate.papel === 'coordenador' ? 'Coordenação' : 'Integrante'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: '1 1 180px' }}>
                    {candidate.grupos_nomes.map(groupName => <span key={groupName} className="badge">{groupName}</span>)}
                  </div>
                  <div style={{ textAlign: 'right', flex: '0 1 170px', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: candidate.status === 'pronto' ? 'var(--success-text)' : candidate.status === 'conflito_vinculo' || candidate.status === 'sem_email' ? 'var(--danger-text)' : 'var(--warning-color)' }}>
                      {STATUS_LABELS[candidate.status]}
                    </span>
                    {result && <small style={{ display: 'block', marginTop: '0.25rem', color: result.success ? 'var(--success-text)' : 'var(--danger-text)' }}>{result.success ? 'Processado' : result.message}</small>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--muted-text)', fontSize: '0.8rem' }}>
        <span><Users2 size={14} style={{ verticalAlign: 'middle' }} /> {candidates.length} pessoa(s) com acesso previsto</span>
        <span><CheckCircle size={14} style={{ verticalAlign: 'middle' }} /> {candidates.filter(candidate => candidate.status === 'pronto').length} com acesso correto</span>
      </div>
    </div>
  );
}
