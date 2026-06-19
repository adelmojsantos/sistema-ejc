import {
  Baby,
  ChevronLeft,
  Heart,
  Info,
  Loader,
  Plus,
  Printer,
  Search,
  Download,
  Trash2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useDebounce } from '../../hooks/useDebounce';
import logoEjc from '../../assets/logo-ejc.svg';

import { Modal } from '../../components/ui/Modal';

import { Gear, WhatsappLogo } from 'phosphor-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { RecreacaoDadosModal } from '../../components/coordenador/RecreacaoDadosModal';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { encontroService } from '../../services/encontroService';
import { recreacaoService } from '../../services/recreacaoService';
import type { Encontro } from '../../types/encontro';
import type { RecreacaoDados } from '../../types/recreacao';
import { formatChildAge } from '../../utils/ageUtils';
import './RecreacaoAdminPage.css';

type BadgeBackground = 'white' | 'yellow';

const chunkItems = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

const getFirstName = (fullName?: string | null) =>
  fullName?.trim().split(/\s+/)[0] || '';

export function RecreacaoAdminPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canChangeEncontro = hasPermission('modulo_admin');
  const canPrintBadges = hasPermission('modulo_secretaria') || hasPermission('modulo_admin');

  const { encontros, encontroAtivo } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [registros, setRegistros] = useState<RecreacaoDados[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [obsToShow, setObsToShow] = useState<string | null>(null);
  const [registroToDelete, setRegistroToDelete] = useState<RecreacaoDados | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [badgeBackground, setBadgeBackground] = useState<BadgeBackground>('white');

  // Seleciona encontro ativo via contexto
  useEffect(() => {
    if (!selectedEncontroId) {
      if (encontroAtivo) setSelectedEncontroId(encontroAtivo.id);
      else if (encontros.length > 0) setSelectedEncontroId(encontros[0].id);
    }
  }, [encontros, encontroAtivo, selectedEncontroId]);

  const loadRegistros = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      const data = await recreacaoService.listarTodosPorEncontro(selectedEncontroId);
      setRegistros(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados de recreação.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const handleEdit = (registro: RecreacaoDados) => {
    setSelectedParticipacaoId(registro.participacao_id);
    setSelectedChildId(registro.id);
    setIsAddingNew(false);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setSelectedParticipacaoId(null);
    setSelectedChildId(null);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!registroToDelete) return;

    setIsDeleting(true);
    try {
      await recreacaoService.excluir(registroToDelete.id);
      toast.success('Cadastro removido com sucesso.');
      setRegistroToDelete(null);
      await loadRegistros();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover cadastro de recreação.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateForExport = (date?: string | null) => {
    if (!date) return '';
    const [year, month, day] = date.split('-');
    return year && month && day ? `${day}/${month}/${year}` : date;
  };

  const sanitizeFileName = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();

  const handleExportExcel = () => {
    if (filteredRegistros.length === 0) {
      toast.error('Não há crianças para exportar.');
      return;
    }

    const selectedEncontro = encontros.find(encontro => encontro.id === selectedEncontroId);
    const rows = filteredRegistros.map(reg => ({
      'Nome da criança': reg.nome_crianca?.toUpperCase().trim(),
      'Data de nascimento': formatDateForExport(reg.data_nascimento),
      'Idade': formatChildAge(reg.data_nascimento, reg.idade),
      'Observações / Alergias': reg.observacoes?.trim() || '',
      'Responsável principal': reg.participacoes?.pessoas?.nome_completo?.trim() || '',
      'Equipe do responsável principal': reg.participacoes?.equipes?.nome?.trim() || '',
      'Segundo responsável': reg.outro_responsavel?.pessoas?.nome_completo?.trim() || '',
      'Equipe do segundo responsável': reg.outro_responsavel?.equipes?.nome?.trim() || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 32 },
      { wch: 18 },
      { wch: 18 },
      { wch: 42 },
      { wch: 32 },
      { wch: 28 },
      { wch: 32 },
      { wch: 28 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recreação Infantil');

    const encontroName = sanitizeFileName(selectedEncontro?.nome || 'encontro');
    XLSX.writeFile(workbook, `recreacao_infantil_${encontroName}.xlsx`);
  };

  const filteredRegistros = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    
    const filtered = term ? registros.filter(r => {
      const kidName = r.nome_crianca?.toLowerCase() || '';
      const resp1 = r.participacoes?.pessoas?.nome_completo?.toLowerCase() || '';
      const resp2 = r.outro_responsavel?.pessoas?.nome_completo?.toLowerCase() || '';
      const equipe1 = r.participacoes?.equipes?.nome?.toLowerCase() || '';

      return kidName.includes(term) || resp1.includes(term) || resp2.includes(term) || equipe1.includes(term);
    }) : registros;

    return [...filtered].sort((a, b) => 
      (a.nome_crianca || '').localeCompare(b.nome_crianca || '')
    );
  }, [registros, debouncedSearch]);

  const badgePages = useMemo(() => chunkItems(filteredRegistros, 8), [filteredRegistros]);
  const selectedEncontro = encontros.find(encontro => encontro.id === selectedEncontroId);

  const handlePrintBadges = () => {
    if (!canPrintBadges) return;

    if (filteredRegistros.length === 0) {
      toast.error('Não há crianças para imprimir.');
      return;
    }

    const previousTitle = document.title;
    const cleanupPrintMode = () => {
      document.body.classList.remove('recreacao-badges-printing');
      document.title = previousTitle;
    };

    document.title = `Cracha Recreação - ${selectedEncontro?.nome || 'Encontro'}`;
    document.body.classList.add('recreacao-badges-printing');
    window.addEventListener('afterprint', cleanupPrintMode, { once: true });
    window.print();
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/dashboard')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Módulo de Recreação</p>
            <h1 className="page-title text-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>Gestão de Recreação</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={handleExportExcel}
            className="btn-secondary flex items-center gap-2"
            disabled={isLoading || filteredRegistros.length === 0}
          >
            <Download size={18} />
            <span>Exportar Excel</span>
          </button>

          {canPrintBadges && (
            <button
              onClick={() => setShowBadges(current => !current)}
              className="btn-secondary flex items-center gap-2"
              disabled={isLoading || filteredRegistros.length === 0}
            >
              <Printer size={18} />
              <span>{showBadges ? 'Fechar crachás' : 'Imprimir crachás'}</span>
            </button>
          )}

          <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            <span>Novo Cadastro</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Encontro</label>
            <LiveSearchSelect<Encontro>
              value={selectedEncontroId}
              onChange={(val) => setSelectedEncontroId(val)}
              fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
              getOptionLabel={(e) => `${e.nome} ${e.ativo ? '(Ativo)' : ''}`}
              getOptionValue={(e) => String(e.id)}
              placeholder="Selecionar encontro..."
              initialOptions={encontros}
              disabled={!canChangeEncontro}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Buscar Criança ou Responsável</label>
            <div className="form-input-wrapper">
              <div className="form-input-icon">
                <Search size={16} />
              </div>
              <input
                type="text"
                className="form-input form-input--with-icon"
                placeholder="Criança, pai/mãe, equipe..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted-text)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.2rem',
                  }}
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {canPrintBadges && showBadges && filteredRegistros.length > 0 && (
        <section className="recreacao-badges-panel">
          <style>{'@media print { @page { margin: 0; size: A4 portrait; } }'}</style>
          <div className="recreacao-badges-controls">
            <div>
              <h2>Prévia dos crachás</h2>
              <p>
                {filteredRegistros.length} crachá(s), com 8 por folha A4. A impressão respeita a busca atual.
              </p>
            </div>

            <div className="recreacao-badges-actions">
              <fieldset className="recreacao-badges-background">
                <legend>Fundo do crachá</legend>
                <label>
                  <input
                    type="radio"
                    name="badge-background"
                    value="white"
                    checked={badgeBackground === 'white'}
                    onChange={() => setBadgeBackground('white')}
                  />
                  Branco / papel amarelo
                </label>
                <label>
                  <input
                    type="radio"
                    name="badge-background"
                    value="yellow"
                    checked={badgeBackground === 'yellow'}
                    onChange={() => setBadgeBackground('yellow')}
                  />
                  Amarelo impresso
                </label>
              </fieldset>

              <button type="button" className="btn-primary flex items-center gap-2" onClick={handlePrintBadges}>
                <Printer size={18} />
                Imprimir
              </button>
            </div>
          </div>

          <div className={`recreacao-badges-print-area recreacao-badges-print-area--${badgeBackground}`}>
            {badgePages.map((page, pageIndex) => (
              <div className="recreacao-badges-sheet" key={`badge-page-${pageIndex}`}>
                {page.map(reg => {
                  const responsaveis = [
                    getFirstName(reg.participacoes?.pessoas?.nome_completo),
                    getFirstName(reg.outro_responsavel?.pessoas?.nome_completo)
                  ].filter(Boolean);

                  return (
                    <article className="recreacao-badge" key={reg.id}>
                      <header className="recreacao-badge__header">
                        <div className="recreacao-badge__logo">
                          <img src={logoEjc} alt="Logo EJC" />
                        </div>

                        <div className="recreacao-badge__event">
                          <strong>
                            {selectedEncontro?.edicao
                              ? `${selectedEncontro.edicao}º EJC`
                              : selectedEncontro?.nome || 'EJC Capelinha'}
                          </strong>
                          {selectedEncontro?.tema && <span>{selectedEncontro.tema}</span>}
                        </div>

                        <div className="recreacao-badge__logo">
                          {selectedEncontro?.logo_url && (
                            <img src={selectedEncontro.logo_url} alt={`Logo ${selectedEncontro.nome}`} />
                          )}
                        </div>
                      </header>

                      <div className="recreacao-badge__body">
                        <h3>{reg.nome_crianca}</h3>
                        <p>{responsaveis.join(' e ') || 'Não informado'}</p>
                      </div>
                        <div className="recreacao-badge__body">
                        <span className='recreacao-badge__team'>Recreação Infantil</span>
                        </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      <p style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--muted-text)' }}>
        <strong style={{ color: 'var(--text-color)' }}>{registros.length}</strong> crianças cadastradas
      </p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <Loader size={48} className="animate-spin mb-4" />
          <p>Carregando dados de recreação...</p>
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="card text-center py-20">
          <Baby size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
          <h3 style={{ opacity: 0.6, marginBottom: '0.5rem' }}>Nenhum cadastro encontrado</h3>
          <p style={{ opacity: 0.4 }}>Tente ajustar seus filtros ou mude o encontro atual.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '1rem'
        }}>
          {filteredRegistros.map((reg) => (
            <div key={reg.id} className="card animate-fade-in hover-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '0',
                right: '0',
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                padding: '0.2rem 0.75rem',
                fontSize: '0.7rem',
                fontWeight: 800,
                borderBottomLeftRadius: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                zIndex: 5,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {formatChildAge(reg.data_nascimento, reg.idade)}
              </div>
              <div style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }} className="admin-card-content">
                {/* Linha 1: Nome da Criança */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    <Baby size={18} />
                  </div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: 'var(--text-color)'
                  }}>{reg.nome_crianca}</h3>
                </div>

                {/* Linha 2: Grid de Responsáveis, Obs e Botão */}
                <div className="card-main-row" style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(300px, 2fr) minmax(200px, 1.2fr) 220px',
                  alignItems: 'center',
                  gap: '2rem'
                }}>
                  {/* Grupo Responsáveis */}
                  <div className="responsibles-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Heart size={12} fill="currentColor" /> Responsáveis
                    </div>
                    <div className="responsibles-row" style={{
                      display: 'flex',
                      gap: '2rem',
                      alignItems: 'flex-start'
                    }}>
                      {/* Primeiro Responsável */}
                      <div className="resp-item" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div className="resp-name" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{reg.participacoes?.pessoas?.nome_completo}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>({reg.participacoes?.equipes?.nome || 'Sem Equipe'})</div>
                          {reg.participacoes?.pessoas?.telefone && (
                            <a
                              href={`https://wa.me/55${reg.participacoes.pessoas.telefone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '0.75rem',
                                color: '#10b981',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              <WhatsappLogo size={12} weight="fill" />
                              {reg.participacoes.pessoas.telefone}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Segundo Responsável */}
                      {reg.outro_responsavel && (
                        <div className="resp-item second-resp" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          borderLeft: '1px solid var(--border-color)',
                          paddingLeft: '1.5rem'
                        }}>
                          <div className="resp-name" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{reg.outro_responsavel.pessoas?.nome_completo}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>({reg.outro_responsavel.equipes?.nome})</div>
                            {reg.outro_responsavel.pessoas?.telefone && (
                              <a
                                href={`https://wa.me/55${reg.outro_responsavel.pessoas.telefone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.75rem',
                                  color: '#10b981',
                                  fontWeight: 700,
                                  textDecoration: 'none'
                                }}
                              >
                                <WhatsappLogo size={12} weight="fill" />
                                {reg.outro_responsavel.pessoas.telefone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grupo Observações */}
                  <div className="obs-container">
                    {reg.observacoes && (
                      <div
                        className="obs-section"
                        onClick={() => setObsToShow(reg.observacoes || null)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info size={12} fill="currentColor" /> Observações
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          opacity: 0.7,
                          backgroundColor: 'rgba(var(--primary-rgb), 0.05)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px dashed rgba(var(--primary-rgb), 0.2)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {reg.observacoes}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleEdit(reg)}
                      className="btn-success flex items-center justify-center gap-2"
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        flex: 1,
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <Gear size={16} /> Editar
                    </button>
                    <button
                      onClick={() => setRegistroToDelete(reg)}
                      className="btn-danger-solid flex items-center justify-center gap-2"
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        flex: 1,
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <Trash2 size={16} /> Remover
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <RecreacaoDadosModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedParticipacaoId(null);
            setSelectedChildId(null);
            setIsAddingNew(false);
          }}
          participacaoId={selectedParticipacaoId || ''}
          encontroId={selectedEncontroId}
          onSave={() => {
            loadRegistros();
          }}
          allowParticipantSelection={isAddingNew}
          initialChildId={selectedChildId}
        />
      )}

      <Modal
        isOpen={!!obsToShow}
        onClose={() => setObsToShow(null)}
        title="Observações da Criança"
        maxWidth="500px"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1rem', color: 'var(--text-color)', whiteSpace: 'pre-wrap' }}>
            {obsToShow}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button onClick={() => setObsToShow(null)} className="btn-primary">
              Entendido
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!registroToDelete}
        title="Remover cadastro"
        message={
          <>
            Tem certeza que deseja remover o cadastro de{' '}
            <strong>{registroToDelete?.nome_crianca}</strong> da recreação infantil?
          </>
        }
        confirmText="Remover"
        cancelText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setRegistroToDelete(null)}
        isLoading={isDeleting}
        isDestructive
      />

      <style>{`
        .hover-card {
          transition: all 0.2s ease-in-out;
          border: 1px solid var(--border-color);
        }
        .hover-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          border-color: rgba(var(--primary-rgb), 0.3);
        }
        .obs-hover:hover {
          background: rgba(var(--primary-rgb), 0.15) !important;
          transform: scale(1.02);
        }
        .badge-age {
          display: inline-block;
          background-color: var(--primary-color);
          color: white;
          padding: 0.15rem 0.6rem;
          border-radius: 6px;
          font-weight: 700;
          font-family: inherit;
          font-size: 0.8rem;
          letter-spacing: 0.05em;
          box-shadow: 0 2px 4px rgba(var(--primary-rgb), 0.2);
          text-transform: uppercase;
          margin-top: 4px;
        }
        @media (max-width: 768px) {
          .admin-card-content {
            gap: 0.75rem !important;
          }
          .card-main-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
          }
          .card-info-group {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.75rem !important;
          }
          .responsibles-row {
            overflow-x: auto;
            padding-bottom: 4px;
            gap: 1.5rem !important;
          }
          .responsibles-row::-webkit-scrollbar {
            display: none;
          }
          .responsibles-row > div.second-resp {
            border-left: 1px solid var(--border-color) !important;
            padding-left: 1.5rem !important;
          }
          .responsibles-row > div {
            min-width: fit-content;
          }
          .admin-card-actions {
            width: 100%;
            margin-top: 0.25rem;
            gap: 0.5rem !important;
          }
          .admin-card-actions button {
            flex: 1;
          }
          .obs-section {
            max-width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
