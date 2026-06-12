import { ChevronLeft, Download, FileSpreadsheet, FileText, Filter, Loader, Search, Shield, User, Users, UserMinus, X } from 'lucide-react';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import { useEncontros } from '../../contexts/EncontroContext';
import { useEquipes } from '../../hooks/useEquipes';
import type { Encontro } from '../../types/encontro';
import type { InscricaoEnriched } from '../../types/inscricao';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function formatEnderecoCompleto(pessoa: InscricaoEnriched['pessoas']) {
  if (!pessoa) return '—';

  const logradouro = [pessoa.endereco, pessoa.numero].filter(Boolean).join(', ');
  const cidadeEstado = [pessoa.cidade, pessoa.estado].filter(Boolean).join('/');
  const partes = [logradouro, pessoa.complemento, pessoa.bairro, cidadeEstado, pessoa.cep].filter(Boolean);

  return partes.length > 0 ? partes.join(' - ') : '—';
}

export function SecretariaEncontreirosPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { equipes } = useEquipes();

  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [participantToUnlink, setParticipantToUnlink] = useState<InscricaoEnriched | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);

  // Seleciona encontro ativo automaticamente quando o contexto carregar
  useEffect(() => {
    if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, selectedEncontroId]);

  const loadParticipantes = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      // Filtro server-side: busca apenas encontreiros (participante=false)
      const data = await inscricaoService.listarEncontreirosPorEncontro(selectedEncontroId);
      setParticipantes(data);
    } catch {
      toast.error('Erro ao carregar encontreiros.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadParticipantes();
  }, [loadParticipantes]);

  const handleUnlink = async () => {
    if (!participantToUnlink) return;
    setIsUnlinking(true);
    try {
      await inscricaoService.desvincularDoEncontro(participantToUnlink.id);
      toast.success(`${participantToUnlink.pessoas?.nome_completo} desvinculado(a) com sucesso.`);
      setParticipantToUnlink(null);
      await loadParticipantes();
    } catch {
      toast.error('Erro ao desvincular encontreiro.');
    } finally {
      setIsUnlinking(false);
    }
  };

  const selectedEncontro = encontros.find(e => e.id === selectedEncontroId);

  const filteredParticipantes = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
    const termDigits = normalize(term);

    return participantes
      .filter(p => {
        const matchesTeam = filterTeamId === 'all' || p.equipe_id === filterTeamId;
        if (!matchesTeam) return false;

        if (!term) return true;

        const matchNome = p.pessoas?.nome_completo?.toLowerCase().includes(term);
        const matchCpf = p.pessoas?.cpf && (p.pessoas.cpf.includes(term) || (termDigits && normalize(p.pessoas.cpf).includes(termDigits)));
        const matchEmail = p.pessoas?.email?.toLowerCase().includes(term);
        const matchTelefone = p.pessoas?.telefone && ((termDigits && normalize(p.pessoas.telefone).includes(termDigits)) || p.pessoas.telefone.includes(term));
        const matchComunidade = p.pessoas?.comunidade?.toLowerCase().includes(term);
        const matchBairro = p.pessoas?.bairro?.toLowerCase().includes(term);

        return !!(matchNome || matchCpf || matchEmail || matchTelefone || matchComunidade || matchBairro);
      })
      .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [participantes, debouncedSearch, filterTeamId]);

  const getExportData = () => filteredParticipantes.map((participacao, index) => ({
    '#': index + 1,
    'Nome Completo': participacao.pessoas?.nome_completo || '—',
    'Equipe': participacao.equipes?.nome || 'Sem Equipe',
    'Função': participacao.coordenador ? 'Coordenador' : 'Membro',
    'Telefone': formatTelefone(participacao.pessoas?.telefone),
    'E-mail': participacao.pessoas?.email || '—',
    'Endereço Completo': formatEnderecoCompleto(participacao.pessoas)
  }));

  const exportFileName = `encontreiros_${selectedEncontro?.nome || 'encontro'}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .toLowerCase();

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const data = getExportData();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFontSize(16);
      doc.text(`Encontreiros: ${selectedEncontro?.nome || 'Encontro'}`, 14, 18);

      autoTable(doc, {
        head: [['#', 'Nome', 'Equipe', 'Função', 'Telefone', 'E-mail', 'Endereço Completo']],
        body: data.map(item => [
          item['#'],
          item['Nome Completo'],
          item['Equipe'],
          item['Função'],
          item['Telefone'],
          item['E-mail'],
          item['Endereço Completo']
        ]),
        startY: 25,
        styles: { fontSize: 8 },
        columnStyles: {
          1: { cellWidth: 45 },
          2: { cellWidth: 32 },
          5: { cellWidth: 45 },
          6: { cellWidth: 75 }
        }
      });

      doc.save(`${exportFileName}.pdf`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar encontreiros em PDF:', error);
      toast.error('Erro ao gerar PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const data = getExportData();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Encontreiros');

      worksheet['!cols'] = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row]).length)) + 2
      }));

      XLSX.writeFile(workbook, `${exportFileName}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar encontreiros em Excel:', error);
      toast.error('Erro ao gerar planilha.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="fade-in">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => navigate(-1)} className="icon-btn">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Secretaria</p>
              <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Listagem de Encontreiros</h1>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-primary flex items-center gap-2"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              disabled={filteredParticipantes.length === 0 || isExporting}
            >
              {isExporting ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
              <span className="hide-mobile">Exportar</span>
            </button>

            {showExportMenu && (
              <>
                <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                <div className="secretaria-encontreiros-export-menu" style={{
                  position: 'absolute',
                  right: 0,
                  top: '120%',
                  zIndex: 100,
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  minWidth: '220px',
                  overflow: 'hidden',
                  animation: 'fadeInUp 0.2s ease'
                }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', opacity: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', textAlign: 'left' }}>
                    Exportar como
                  </div>
                  <button className="dropdown-item-custom" onClick={handleExportPDF} disabled={isExporting}>
                    <div className="icon-box-pdf">{isExporting ? <Loader size={18} className="animate-spin" /> : <FileText size={18} />}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PDF</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Gerando...' : 'Documento formatado'}</div>
                    </div>
                  </button>
                  <button className="dropdown-item-custom" onClick={handleExportExcel} disabled={isExporting}>
                    <div className="icon-box-excel">{isExporting ? <Loader size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Excel</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Gerando...' : 'Planilha editável'}</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Encontro</label>
              <LiveSearchSelect<Encontro>
                value={selectedEncontroId}
                onChange={(val) => setSelectedEncontroId(val)}
                fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                getOptionLabel={(e) => `${e.nome}${e.tema ? ` (${e.tema})` : ''} ${e.ativo ? '(Ativo)' : ''}`}
                getOptionValue={(e) => String(e.id)}
                placeholder="Selecione um Encontro..."
                initialOptions={encontros}
                className="montagem-header-select"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Equipe</label>
              <div style={{ position: 'relative' }}>
                <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <select
                  className="form-input"
                  value={filterTeamId}
                  onChange={(e) => setFilterTeamId(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                >
                  <option value="all">Todos os Encontreiros</option>
                  {equipes.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Buscar Encontreiro</label>
              <div className="form-input-wrapper">
                <div className="form-input-icon">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  className="form-input form-input--with-icon"
                  placeholder="Nome, CPF, e-mail ou bairro..."
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

        {isLoading ? (
          <div className="card text-center py-8">
            <Loader size={32} className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }} />
            <p>Carregando encontreiros...</p>
          </div>
        ) : filteredParticipantes.length === 0 ? (
          <div className="empty-state">
            <Users size={48} style={{ opacity: 0.3 }} />
            <p>Nenhum encontreiro encontrado.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
              Mostrando <strong>{filteredParticipantes.length}</strong> de <strong>{participantes.length}</strong> {participantes.length === 1 ? 'encontreiro encontrado' : 'encontreiros encontrados'}
            </p>

            <div className="pessoa-grid secretaria-encontreiros-grid">
              {filteredParticipantes.map((p) => (
                <div key={p.id} className="pessoa-row secretaria-encontreiro-row">
                  <div className="pessoa-row-main">
                    <div className="pessoa-avatar small">
                      <User size={18} />
                    </div>
                    <div className="pessoa-row-info">
                      <h3 className="pessoa-row-name">{p.pessoas?.nome_completo || 'Nome não informado'}</h3>
                      <span className="pessoa-row-sub">
                        <span style={{ opacity: 0.6 }}>{p.equipes?.nome || 'Sem Equipe'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pessoa-row-col">
                    <span className="pessoa-row-label">Contato</span>
                    <span className="pessoa-row-value">{formatTelefone(p.pessoas?.telefone)}</span>
                  </div>

                  <div className="pessoa-row-col">
                    <span className="pessoa-row-label">Equipe</span>
                    <span className="secretaria-team-badge">
                      <Users size={12} /> {p.equipes?.nome || 'Sem Equipe'}
                    </span>
                  </div>

                  <div className="pessoa-row-col">
                    <span className="pessoa-row-label">Função</span>
                    {p.coordenador ? (
                      <span className="secretaria-role-badge coordinator">
                        <Shield size={14} /> Coordenador
                      </span>
                    ) : (
                      <span className="secretaria-role-badge">Membro</span>
                    )}
                  </div>

                  <div className="pessoa-row-actions secretaria-pessoa-actions">
                    {selectedEncontro?.ativo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setParticipantToUnlink(p); }}
                        className="secretaria-unlink-button"
                        title="Desvincular do encontro"
                        aria-label="Desvincular do encontro"
                      >
                        <UserMinus size={16} />
                        <span>Desvincular</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!participantToUnlink}
        title="Desvincular Encontreiro"
        message={
          <>
            Tem certeza que deseja desvincular o(a) encontreiro(a) <strong style={{ color: 'var(--text-color)' }}>{participantToUnlink?.pessoas?.nome_completo}</strong> deste encontro?
            <br /><br />
            Esta ação <strong style={{ color: 'var(--danger-text)' }}>apenas removerá o vínculo</strong> da pessoa com este encontro específico. O cadastro da pessoa no sistema de pessoas será mantido intacto.
          </>
        }
        confirmText="Sim, desvincular"
        cancelText="Cancelar"
        onConfirm={handleUnlink}
        onCancel={() => setParticipantToUnlink(null)}
        isLoading={isUnlinking}
        isDestructive={true}
      />

      <style>{`
        .dropdown-item-custom {
          width: 100%;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-color);
          transition: background-color 0.15s;
          justify-content: flex-start;
          text-align: left;
        }
        .dropdown-item-custom > div:last-child {
          min-width: 0;
          text-align: left;
        }
        .dropdown-item-custom:hover {
          background-color: var(--primary-light);
        }
        .icon-box-pdf, .icon-box-excel {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-box-pdf {
          background-color: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        .icon-box-excel {
          background-color: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .action-btn-hover:hover {
          background-color: rgba(239, 68, 68, 0.1);
        }
        .secretaria-encontreiro-row {
          grid-template-columns: minmax(260px, 1.35fr) minmax(170px, 0.75fr) minmax(190px, 0.9fr) minmax(140px, 0.7fr) auto;
        }
        .secretaria-team-badge {
          width: fit-content;
          max-width: 100%;
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          background-color: rgba(37, 99, 235, 0.1);
          color: var(--primary-color);
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          overflow-wrap: anywhere;
        }
        .secretaria-role-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: var(--muted-text);
        }
        .secretaria-role-badge.coordinator {
          color: #f59e0b;
          font-weight: 700;
        }
        .secretaria-unlink-button {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid rgba(239, 68, 68, 0.7);
          background: transparent;
          color: #ef4444;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .secretaria-unlink-button svg {
          display: block;
          width: 16px;
          height: 16px;
          color: #ef4444;
          stroke: #ef4444;
          flex-shrink: 0;
        }
        .secretaria-unlink-button:hover {
          background: rgba(239, 68, 68, 0.08);
          border-color: #ef4444;
          transform: translateY(-1px);
        }
        .secretaria-unlink-button span {
          display: none;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .secretaria-pessoa-actions {
          justify-content: flex-end;
        }
        @media (max-width: 900px) {
          .secretaria-encontreiros-grid {
            gap: 0.85rem;
            border: none;
            overflow: visible;
          }
          .secretaria-encontreiro-row {
            grid-template-columns: 1fr;
            align-items: stretch;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.9rem;
            gap: 0.8rem;
          }
          .secretaria-encontreiro-row:last-child {
            border-bottom: 1px solid var(--border-color);
          }
          .secretaria-pessoa-actions {
            justify-content: flex-start;
            padding-top: 0.35rem;
            border-top: 1px solid var(--border-color);
          }
          .secretaria-unlink-button {
            width: 100%;
            height: 40px;
          }
          .secretaria-unlink-button span {
            display: inline;
          }
        }
      `}</style>
    </>
  );
}
