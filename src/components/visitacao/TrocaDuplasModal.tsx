import { useState, useMemo } from 'react';
import {
  ArrowRight,
  ArrowLeftRight,
  Check,
  Loader,
  Users,
  UserMinus,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { visitacaoService } from '../../services/visitacaoService';
import type { VisitaGrupo, VisitaParticipacaoEnriched } from '../../types/visitacao';

type SwapMode = 'individual' | 'mover_todos' | 'swap_completo';

interface TrocaDuplasModalProps {
  isOpen: boolean;
  onClose: () => void;
  grupos: VisitaGrupo[];
  vinculos: VisitaParticipacaoEnriched[];
  onSuccess: () => void;
}

export function TrocaDuplasModal({ isOpen, onClose, grupos, vinculos, onSuccess }: TrocaDuplasModalProps) {
  const [mode, setMode] = useState<SwapMode>('individual');
  const [grupoAId, setGrupoAId] = useState('');
  const [grupoBId, setGrupoBId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Encontristas (not visitors) in each group
  const membrosA = useMemo(() =>
    vinculos.filter(v => v.grupo_id === grupoAId && !v.visitante),
    [vinculos, grupoAId]
  );

  const membrosB = useMemo(() =>
    vinculos.filter(v => v.grupo_id === grupoBId && !v.visitante),
    [vinculos, grupoBId]
  );

  const grupoA = useMemo(() => grupos.find(g => g.id === grupoAId), [grupos, grupoAId]);
  const grupoB = useMemo(() => grupos.find(g => g.id === grupoBId), [grupos, grupoBId]);

  const canExecute = useMemo(() => {
    if (!grupoAId || !grupoBId || grupoAId === grupoBId) return false;
    if (mode === 'individual') return selectedIds.size > 0;
    if (mode === 'mover_todos') return membrosA.length > 0;
    if (mode === 'swap_completo') return membrosA.length > 0 || membrosB.length > 0;
    return false;
  }, [grupoAId, grupoBId, mode, selectedIds, membrosA, membrosB]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === membrosA.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(membrosA.map(m => m.id)));
    }
  };

  const handleExecute = async () => {
    if (!canExecute) return;
    setIsLoading(true);
    try {
      switch (mode) {
        case 'individual': {
          const ops = membrosA
            .filter(m => selectedIds.has(m.id))
            .map(m => visitacaoService.trocarGrupo(m.id, grupoBId));
          await Promise.all(ops);
          toast.success(`${ops.length} participante(s) movido(s) com sucesso!`);
          break;
        }
        case 'mover_todos': {
          const ops = membrosA.map(m => visitacaoService.trocarGrupo(m.id, grupoBId));
          await Promise.all(ops);
          toast.success(`${ops.length} participante(s) movido(s) para ${grupoB?.nome}!`);
          break;
        }
        case 'swap_completo': {
          // Move all A → B and all B → A in parallel
          const opsAtoB = membrosA.map(m => visitacaoService.trocarGrupo(m.id, grupoBId));
          const opsBtoA = membrosB.map(m => visitacaoService.trocarGrupo(m.id, grupoAId));
          await Promise.all([...opsAtoB, ...opsBtoA]);
          toast.success(`Troca completa realizada! ${opsAtoB.length + opsBtoA.length} vínculo(s) atualizados.`);
          break;
        }
      }
      onSuccess();
      handleReset();
      onClose();
    } catch (err) {
      console.error('Erro na troca:', err);
      toast.error('Erro ao realizar a troca de participantes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setGrupoAId('');
    setGrupoBId('');
    setSelectedIds(new Set());
    setMode('individual');
  };

  const handleClose = () => {
    if (!isLoading) {
      handleReset();
      onClose();
    }
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'individual': return 'Mover Selecionados';
      case 'mover_todos': return `Mover Todos (${membrosA.length})`;
      case 'swap_completo': return `Trocar Tudo (${membrosA.length + membrosB.length})`;
    }
  };

  const getConfirmationMessage = () => {
    switch (mode) {
      case 'individual':
        return `Mover ${selectedIds.size} participante(s) de "${grupoA?.nome}" para "${grupoB?.nome}"?`;
      case 'mover_todos':
        return `Mover todos os ${membrosA.length} participante(s) de "${grupoA?.nome}" para "${grupoB?.nome}"?`;
      case 'swap_completo':
        return `Trocar todos os participantes: ${membrosA.length} de "${grupoA?.nome}" ↔ ${membrosB.length} de "${grupoB?.nome}"?`;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Trocar Participantes entre Duplas"
      maxWidth="720px"
    >
      <div className="swap-modal-content">
        {/* Mode Selection */}
        <div className="swap-mode-tabs">
          <button
            className={`swap-mode-btn ${mode === 'individual' ? 'active' : ''}`}
            onClick={() => { setMode('individual'); setSelectedIds(new Set()); }}
          >
            <UserMinus size={16} />
            <span>Mover Um</span>
          </button>
          <button
            className={`swap-mode-btn ${mode === 'mover_todos' ? 'active' : ''}`}
            onClick={() => { setMode('mover_todos'); setSelectedIds(new Set()); }}
          >
            <ArrowRight size={16} />
            <span>Mover Todos A → B</span>
          </button>
          <button
            className={`swap-mode-btn ${mode === 'swap_completo' ? 'active' : ''}`}
            onClick={() => { setMode('swap_completo'); setSelectedIds(new Set()); }}
          >
            <ArrowLeftRight size={16} />
            <span>Trocar A ↔ B</span>
          </button>
        </div>

        {/* Duo Selectors */}
        <div className="swap-duo-selectors">
          <div className="swap-duo-select-group">
            <label className="swap-duo-label">
              <span className="swap-duo-badge swap-duo-badge-a">A</span>
              Dupla de Origem
            </label>
            <select
              className="form-input"
              value={grupoAId}
              onChange={e => { setGrupoAId(e.target.value); setSelectedIds(new Set()); }}
            >
              <option value="">Selecione a Dupla A...</option>
              {grupos
                .filter(g => g.id !== grupoBId)
                .map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nome} ({vinculos.filter(v => v.grupo_id === g.id && !v.visitante).length} encontristas)
                  </option>
                ))}
            </select>
          </div>

          <div className="swap-duo-arrow">
            {mode === 'swap_completo' ? <ArrowLeftRight size={24} /> : <ArrowRight size={24} />}
          </div>

          <div className="swap-duo-select-group">
            <label className="swap-duo-label">
              <span className="swap-duo-badge swap-duo-badge-b">B</span>
              Dupla de Destino
            </label>
            <select
              className="form-input"
              value={grupoBId}
              onChange={e => { setGrupoBId(e.target.value); setSelectedIds(new Set()); }}
            >
              <option value="">Selecione a Dupla B...</option>
              {grupos
                .filter(g => g.id !== grupoAId)
                .map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nome} ({vinculos.filter(v => v.grupo_id === g.id && !v.visitante).length} encontristas)
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Same duo warning */}
        {grupoAId && grupoBId && grupoAId === grupoBId && (
          <div className="swap-warning">
            <AlertTriangle size={16} />
            <span>Selecione duplas diferentes para a origem e destino.</span>
          </div>
        )}

        {/* Preview Area */}
        {grupoAId && grupoBId && grupoAId !== grupoBId && (
          <div className="swap-preview-area">
            {/* Individual mode: show selectable list */}
            {mode === 'individual' && (
              <div className="swap-section">
                <div className="swap-section-header">
                  <h4>
                    <Users size={16} />
                    Selecione os participantes para mover
                  </h4>
                  {membrosA.length > 0 && (
                    <button className="swap-select-all-btn" onClick={handleSelectAll}>
                      {selectedIds.size === membrosA.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  )}
                </div>
                {membrosA.length === 0 ? (
                  <p className="swap-empty-text">Nenhum encontrista vinculado à Dupla A.</p>
                ) : (
                  <div className="swap-participant-list">
                    {membrosA.map(m => (
                      <label key={m.id} className={`swap-participant-item ${selectedIds.has(m.id) ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => handleToggleSelect(m.id)}
                        />
                        <span className="swap-participant-name">
                          {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                        </span>
                        <span className="swap-participant-status">
                          {m.status === 'realizada' ? '✅' : m.status === 'pendente' ? '⏳' : m.status === 'ausente' ? '⚠️' : '❌'}
                        </span>
                        {selectedIds.has(m.id) && (
                          <span className="swap-move-indicator">
                            → {grupoB?.nome}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mover Todos mode: preview of what will move */}
            {mode === 'mover_todos' && (
              <div className="swap-preview-columns">
                <div className="swap-preview-col swap-preview-col-from">
                  <h4 className="swap-preview-col-title">
                    <span className="swap-duo-badge swap-duo-badge-a">A</span>
                    {grupoA?.nome}
                    <span className="swap-preview-count">{membrosA.length}</span>
                  </h4>
                  {membrosA.length === 0 ? (
                    <p className="swap-empty-text">Nenhum encontrista</p>
                  ) : (
                    <div className="swap-participant-list compact">
                      {membrosA.map(m => (
                        <div key={m.id} className="swap-participant-item preview moving-out">
                          <UserMinus size={14} />
                          <span className="swap-participant-name">
                            {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="swap-preview-arrow-col">
                  <ArrowRight size={28} />
                </div>

                <div className="swap-preview-col swap-preview-col-to">
                  <h4 className="swap-preview-col-title">
                    <span className="swap-duo-badge swap-duo-badge-b">B</span>
                    {grupoB?.nome}
                    <span className="swap-preview-count">{membrosB.length + membrosA.length}</span>
                  </h4>
                  <div className="swap-participant-list compact">
                    {membrosB.map(m => (
                      <div key={m.id} className="swap-participant-item preview existing">
                        <Users size={14} />
                        <span className="swap-participant-name">
                          {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                        </span>
                      </div>
                    ))}
                    {membrosA.map(m => (
                      <div key={`incoming-${m.id}`} className="swap-participant-item preview moving-in">
                        <UserPlus size={14} />
                        <span className="swap-participant-name">
                          {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                        </span>
                        <span className="swap-incoming-badge">Novo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Swap Completo mode: bidirectional preview */}
            {mode === 'swap_completo' && (
              <div className="swap-preview-columns">
                <div className="swap-preview-col">
                  <h4 className="swap-preview-col-title">
                    <span className="swap-duo-badge swap-duo-badge-a">A</span>
                    {grupoA?.nome}
                  </h4>
                  <div className="swap-mini-section">
                    <span className="swap-mini-label swap-label-out">Saindo ({membrosA.length})</span>
                    {membrosA.length === 0 ? (
                      <p className="swap-empty-text">Nenhum encontrista</p>
                    ) : (
                      <div className="swap-participant-list compact">
                        {membrosA.map(m => (
                          <div key={m.id} className="swap-participant-item preview moving-out">
                            <UserMinus size={14} />
                            <span className="swap-participant-name">
                              {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="swap-mini-section">
                    <span className="swap-mini-label swap-label-in">Entrando ({membrosB.length})</span>
                    {membrosB.length === 0 ? (
                      <p className="swap-empty-text">Nenhum encontrista</p>
                    ) : (
                      <div className="swap-participant-list compact">
                        {membrosB.map(m => (
                          <div key={`incoming-a-${m.id}`} className="swap-participant-item preview moving-in">
                            <UserPlus size={14} />
                            <span className="swap-participant-name">
                              {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="swap-preview-arrow-col">
                  <ArrowLeftRight size={28} />
                </div>

                <div className="swap-preview-col">
                  <h4 className="swap-preview-col-title">
                    <span className="swap-duo-badge swap-duo-badge-b">B</span>
                    {grupoB?.nome}
                  </h4>
                  <div className="swap-mini-section">
                    <span className="swap-mini-label swap-label-out">Saindo ({membrosB.length})</span>
                    {membrosB.length === 0 ? (
                      <p className="swap-empty-text">Nenhum encontrista</p>
                    ) : (
                      <div className="swap-participant-list compact">
                        {membrosB.map(m => (
                          <div key={m.id} className="swap-participant-item preview moving-out">
                            <UserMinus size={14} />
                            <span className="swap-participant-name">
                              {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="swap-mini-section">
                    <span className="swap-mini-label swap-label-in">Entrando ({membrosA.length})</span>
                    {membrosA.length === 0 ? (
                      <p className="swap-empty-text">Nenhum encontrista</p>
                    ) : (
                      <div className="swap-participant-list compact">
                        {membrosA.map(m => (
                          <div key={`incoming-b-${m.id}`} className="swap-participant-item preview moving-in">
                            <UserPlus size={14} />
                            <span className="swap-participant-name">
                              {m.participacoes?.pessoas?.nome_completo || 'Sem Nome'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmation & Actions */}
        {canExecute && (
          <div className="swap-confirmation">
            <p className="swap-confirmation-text">{getConfirmationMessage()}</p>
            <p className="swap-confirmation-note">
              <AlertTriangle size={14} />
              O status e dados das visitas serão preservados.
            </p>
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '1rem', borderTop: 'none', paddingTop: 0 }}>
          <button
            onClick={handleClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            onClick={handleExecute}
            disabled={!canExecute || isLoading}
            className="btn-primary"
            style={{ minWidth: '180px' }}
          >
            {isLoading ? (
              <Loader size={18} className="animate-spin" />
            ) : (
              <>
                <Check size={18} />
                {getModeLabel()}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
