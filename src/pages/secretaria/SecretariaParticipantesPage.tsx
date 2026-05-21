import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import { pessoaService } from '../../services/pessoaService';
import { useEncontros } from '../../contexts/EncontroContext';
import type { InscricaoEnriched } from '../../types/inscricao';
import { ChevronLeft, Search, Users, User, Download, FileText, FileSpreadsheet, MapPin, Loader, Plus, CheckCircle, XCircle, Clock, UserMinus, X, Car } from 'lucide-react';
import type { Encontro } from '../../types/encontro';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useDebounce } from '../../hooks/useDebounce';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { geocodeWithFallback } from '../../utils/geocoding';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateAge } from '../../utils/dateUtils';
import { formatTelefone } from '../../utils/cpfUtils';

type GeoItemStatus = 'pending' | 'processing' | 'success' | 'error' | 'skipped';

interface GeoProgressItem {
  pessoa_id: string;
  nome: string;
  status: GeoItemStatus;
  message?: string;
}


export function SecretariaParticipantesPage() {
  const { setIsLoading: setGlobalLoading } = useLoading();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { encontros } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConfirmGeoModal, setShowConfirmGeoModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [participantToUnlink, setParticipantToUnlink] = useState<InscricaoEnriched | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVeiculo, setFilterVeiculo] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [pendingGeoCount, setPendingGeoCount] = useState(0);
  const [geoProgressItems, setGeoProgressItems] = useState<GeoProgressItem[]>([]);
  const [geoDone, setGeoDone] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const progressListRef = useRef<HTMLDivElement>(null);

  // Seleciona encontro ativo automaticamente quando o contexto carregar
  useEffect(() => {
    const encontroParam = searchParams.get('encontro');
    if (encontroParam) {
      setSelectedEncontroId(encontroParam);
    } else if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, searchParams, selectedEncontroId]);

  const loadParticipantes = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      // Filtro server-side: busca apenas participantes (participante=true)
      const data = await inscricaoService.listarParticipantesPorEncontro(selectedEncontroId);
      setParticipantes(data);
    } catch {
      toast.error('Erro ao carregar participantes.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    setGlobalLoading(isLoading);
  }, [isLoading, setGlobalLoading]);

  useEffect(() => {
    loadParticipantes();
  }, [selectedEncontroId, loadParticipantes]);

  const filteredParticipantes = React.useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
    const termDigits = normalize(term);

    return participantes
      .filter(p => {
        // Filtro de veículo
        if (filterVeiculo && !p.recepcao_dados) return false;

        if (!term) return true;

        const pData = p.pessoas;
        if (!pData) return false;

        const matchNome = pData.nome_completo?.toLowerCase().includes(term);
        const matchCpf = pData.cpf && (pData.cpf.includes(term) || (termDigits && normalize(pData.cpf).includes(termDigits)));
        const matchEmail = pData.email?.toLowerCase().includes(term);
        const matchTelefone = pData.telefone && ((termDigits && normalize(pData.telefone).includes(termDigits)) || pData.telefone.includes(term));
        const matchComunidade = pData.comunidade?.toLowerCase().includes(term);
        const matchBairro = pData.bairro?.toLowerCase().includes(term);
        const matchCidade = pData.cidade?.toLowerCase().includes(term);

        return !!(matchNome || matchCpf || matchEmail || matchTelefone || matchComunidade || matchBairro || matchCidade);
      })
      .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));
  }, [participantes, debouncedSearch, filterVeiculo]);

  const selectedEncontro = encontros.find(e => e.id === selectedEncontroId);

  const handleUpdateGeolocalizacao = () => {
    const pending = filteredParticipantes.filter(p => !p.pessoas?.latitude || !p.pessoas?.longitude);
    if (pending.length === 0) {
      toast.success('Todos os participantes já possuem geolocalização!');
      return;
    }
    setPendingGeoCount(pending.length);
    setShowConfirmGeoModal(true);
  };

  const executeBulkGeocoding = async () => {
    setShowConfirmGeoModal(false);
    const pending = filteredParticipantes.filter(p => !p.pessoas?.latitude || !p.pessoas?.longitude);

    // Build initial progress items
    const initialItems: GeoProgressItem[] = pending.map(p => ({
      pessoa_id: p.pessoa_id,
      nome: p.pessoas?.nome_completo || p.pessoa_id,
      status: 'pending',
    }));
    setGeoProgressItems(initialItems);
    setGeoDone(false);
    setShowProgressModal(true);
    setIsUpdatingGeo(true);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];

        // Mark as processing
        setGeoProgressItems(prev =>
          prev.map((item, idx) => idx === i ? { ...item, status: 'processing' } : item)
        );

        // Auto-scroll to current item
        setTimeout(() => {
          const el = progressListRef.current?.querySelector(`[data-idx="${i}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);

        if (!p.pessoas?.endereco) {
          setGeoProgressItems(prev =>
            prev.map((item, idx) => idx === i ? { ...item, status: 'skipped', message: 'Sem endereço' } : item)
          );
          skippedCount++;
          continue;
        }

        const coords = await geocodeWithFallback(p.pessoas);
        if (coords) {
          await pessoaService.atualizar(p.pessoa_id, {
            latitude: coords[0],
            longitude: coords[1],
          });
          setGeoProgressItems(prev =>
            prev.map((item, idx) => idx === i
              ? { ...item, status: 'success', message: `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` }
              : item
            )
          );
          successCount++;
        } else {
          setGeoProgressItems(prev =>
            prev.map((item, idx) => idx === i ? { ...item, status: 'error', message: 'Endereço não encontrado' } : item)
          );
          errorCount++;
        }

        // geocodeWithFallback already handles internal delays; add a small
        // extra gap only when the address was found on the first variant
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await loadParticipantes();
      toast.success(`Geocodificação concluída: ${successCount} sucesso(s), ${errorCount} erro(s), ${skippedCount} pulado(s).`);
    } catch (error) {
      console.error('Erro no bulk geocode:', error);
    } finally {
      setIsUpdatingGeo(false);
      setGeoDone(true);
    }
  };

  const handleUnlink = async () => {
    if (!participantToUnlink) return;
    setIsUnlinking(true);
    try {
      await inscricaoService.desvincularDoEncontro(participantToUnlink.id);
      toast.success(`${participantToUnlink.pessoas?.nome_completo} desvinculado(a) com sucesso.`);
      setParticipantToUnlink(null);
      await loadParticipantes();
    } catch {
      toast.error('Erro ao desvincular participante.');
    } finally {
      setIsUnlinking(false);
    }
  };

  const getExportData = () => {
    return filteredParticipantes.map((p, idx) => {
      const pData = p.pessoas;
      const origem = p.origem || pData?.origem || '—';
      const origemTexto = origem === 'online' ? 'Online' : (origem !== '—' ? 'Presencial' : '—');
      
      return {
        '#': idx + 1,
        'Nome Completo': pData?.nome_completo || '—',
        'Data de Nascimento': pData?.data_nascimento ? new Date(pData.data_nascimento.includes('T') ? pData.data_nascimento : `${pData.data_nascimento}T12:00:00`).toLocaleDateString('pt-BR') : '—',
        'Idade': calculateAge(pData?.data_nascimento) || '—',
        'Telefone': formatTelefone(pData?.telefone),
        'Logradouro': pData?.endereco || '—',
        'Número': pData?.numero || '—',
        'Bairro': pData?.bairro || '—',
        'Cidade': pData?.cidade || '—',
        'Estado': pData?.estado || '—',
        'CEP': pData?.cep || '—',
        'Comunidade': pData?.comunidade || '—',
        'Origem': origemTexto,
        'Veículo': p.recepcao_dados ? `${p.recepcao_dados.veiculo_tipo === 'moto' ? 'Moto' : 'Carro'} - ${p.recepcao_dados.veiculo_modelo} (${p.recepcao_dados.veiculo_placa})` : '—',
      };
    });
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const data = getExportData();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      doc.setFontSize(16);
      doc.text(`Participantes: ${selectedEncontro?.nome || 'Encontro'}`, 14, 18);
      
      autoTable(doc, {
        head: [['#', 'Nome', 'Nasc.', 'Idade', 'Telefone', 'Endereço', 'Bairro', 'Cidade', 'Origem', 'Veículo']],
        body: data.map(d => [
          d['#'], 
          d['Nome Completo'], 
          d['Data de Nascimento'], 
          d['Idade'], 
          d['Telefone'], 
          `${d['Logradouro']}${d['Número'] !== '—' ? `, ${d['Número']}` : ''}`, 
          d['Bairro'], 
          d['Cidade'],
          d['Origem'],
          d['Veículo'],
        ]),
        startY: 25,
        styles: { fontSize: 8 },
        columnStyles: {
          1: { cellWidth: 50 }, // Nome
          5: { cellWidth: 50 }, // Endereço
        }
      });
      
      doc.save(`participantes_${selectedEncontro?.nome || 'encontro'}.pdf`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Participantes');
      
      // Auto-size columns
      const maxWidths = Object.keys(data[0] || {}).map(key => {
        return Math.max(
          key.length,
          ...data.map(row => String(row[key as keyof typeof row]).length)
        );
      });
      worksheet['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));

      XLSX.writeFile(workbook, `participantes_${selectedEncontro?.nome || 'encontro'}.xlsx`);
      setShowExportMenu(false);
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao gerar planilha.');
    } finally {
      setIsExporting(false);
    }
  };

  // Contagem de participantes com veículo (para exibir no botão)
  const countComVeiculo = React.useMemo(
    () => participantes.filter(p => !!p.recepcao_dados).length,
    [participantes]
  );

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
                <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Participantes do Encontro</h1>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/inscricao')}
                className="btn-secondary flex items-center gap-2"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                <Plus size={16} /> <span className="hide-mobile">Nova Inscrição</span>
              </button>

              <button
                onClick={handleUpdateGeolocalizacao}
                disabled={isUpdatingGeo || filteredParticipantes.length === 0}
                className="btn-secondary flex items-center gap-2"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                {isUpdatingGeo ? <Loader size={16} className="animate-spin" /> : <MapPin size={16} />}
                <span className="hide-mobile">{isUpdatingGeo ? 'Atualizando...' : 'Atualizar Geo'}</span>
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-primary flex items-center gap-2"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  disabled={filteredParticipantes.length === 0}
                >
                  <Download size={16} />
                  <span className="hide-mobile">Exportar</span>
                </button>

                {showExportMenu && (
                  <>
                    <div onClick={() => setShowExportMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
                    <div style={{
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
                      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', opacity: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                        Exportar como
                      </div>
                      <button 
                        onClick={handleExportPDF} 
                        className="dropdown-item-custom"
                        disabled={isExporting}
                      >
                        <div className="icon-box-pdf">
                          {isExporting ? <Loader size={18} className="animate-spin" /> : <FileText size={18} />}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PDF</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{isExporting ? 'Gerando...' : 'Documento formatado'}</div>
                        </div>
                      </button>
                      <button 
                        onClick={handleExportExcel} 
                        className="dropdown-item-custom"
                        disabled={isExporting}
                      >
                        <div className="icon-box-excel">
                          {isExporting ? <Loader size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                        </div>
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

              <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                <label className="form-label">Buscar Participante</label>
                <div className="form-input-wrapper">
                  <div className="form-input-icon">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    className="form-input form-input--with-icon"
                    placeholder="Nome, e-mail, telefone, bairro ou cidade..."
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Filtros
                  {countComVeiculo > 0 && !isLoading && (
                    <span style={{ fontSize: '0.7rem', opacity: 0.55, fontWeight: 400 }}>
                      ({countComVeiculo} com veículo)
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => setFilterVeiculo(v => !v)}
                  className={filterVeiculo ? 'btn-primary flex items-center gap-2' : 'btn-secondary flex items-center gap-2'}
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.55rem 1rem',
                    width: '100%',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  title={filterVeiculo ? 'Remover filtro de veículo' : 'Mostrar apenas participantes com veículo'}
                >
                  <Car size={16} />
                  <span>Com veículo{filterVeiculo ? ' ✓' : ''}</span>
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="card text-center py-8">
              <Loader size={32} className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }} />
              <p>Carregando participantes...</p>
            </div>
          ) : filteredParticipantes.length === 0 ? (
            <div className="empty-state">
              <Users size={48} style={{ opacity: 0.3 }} />
              <p>
                {filterVeiculo && participantes.length > 0
                  ? 'Nenhum participante com veículo encontrado.'
                  : 'Nenhum participante encontrado.'}
              </p>
              {filterVeiculo && (
                <button
                  type="button"
                  onClick={() => setFilterVeiculo(false)}
                  className="btn-secondary"
                  style={{ marginTop: '1rem', fontSize: '0.85rem' }}
                >
                  Remover filtro de veículo
                </button>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.85rem', opacity: 0.6, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span>Mostrando <strong>{filteredParticipantes.length}</strong> de <strong>{participantes.length}</strong> {participantes.length === 1 ? 'participante encontrado' : 'participantes encontrados'}</span>
                {filterVeiculo && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(37,99,235,0.1)', color: 'var(--primary-color)', borderRadius: '20px', padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(37,99,235,0.25)' }}>
                    <Car size={12} /> Filtro: com veículo
                    <button type="button" onClick={() => setFilterVeiculo(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', padding: 0, marginLeft: '0.1rem' }}><X size={11} /></button>
                  </span>
                )}
              </p>

              <div className="pessoa-grid secretaria-pessoa-grid">
                {filteredParticipantes.map((p) => {
                  const hasGeo = !!(p.pessoas?.latitude && p.pessoas?.longitude);
                  const endereco = p.pessoas?.endereco
                    ? `${p.pessoas.endereco}${p.pessoas.numero ? `, ${p.pessoas.numero}` : ''}`
                    : 'Endereço não informado';
                  const localidade = [p.pessoas?.bairro, p.pessoas?.cidade].filter(Boolean).join(' - ') || 'Bairro/Cidade não informados';

                  return (
                    <div key={p.id} className="pessoa-row secretaria-pessoa-row">
                      <div className="pessoa-row-main secretaria-pessoa-main">
                        <div className="pessoa-avatar small">
                          <User size={18} />
                        </div>
                        <div className="pessoa-row-info">
                          <h3 className="pessoa-row-name">{p.pessoas?.nome_completo || 'Nome não informado'}</h3>
                          <span className="pessoa-row-sub" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ opacity: 0.6 }}>{p.pessoas?.comunidade || formatTelefone(p.pessoas?.telefone)}</span>
                            {p.recepcao_dados && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(37,99,235,0.08)', color: 'var(--primary-color)', borderRadius: '12px', padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, border: '1px solid rgba(37,99,235,0.2)', flexShrink: 0 }}>
                                <Car size={10} />
                                {p.recepcao_dados.veiculo_tipo === 'moto' ? 'Moto' : 'Carro'} · {p.recepcao_dados.veiculo_placa}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="pessoa-row-col secretaria-pessoa-contact">
                        <span className="pessoa-row-label">Contato</span>
                        <div className="pessoa-row-value-group">
                          <span className="pessoa-row-value">{formatTelefone(p.pessoas?.telefone)}</span>
                          {p.pessoas?.email && (
                            <span className="pessoa-row-sub" style={{ opacity: 0.65, fontSize: '0.75rem' }}>
                              {p.pessoas.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pessoa-row-col secretaria-pessoa-address">
                        <span className="pessoa-row-label">Endereço</span>
                        <span className="pessoa-row-value secretaria-address-main" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={12} style={{ flexShrink: 0, color: hasGeo ? 'var(--success-border)' : 'var(--danger-border)', opacity: hasGeo ? 1 : 0.45 }} />
                          <span>
                            {endereco}
                          </span>
                        </span>
                        <span className="pessoa-row-sub secretaria-address-sub" style={{ opacity: 0.65, fontSize: '0.75rem' }}>
                          {localidade}
                        </span>
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
                  );
                })}
              </div>
            </>
          )}
        </div>

      {/* ── Confirm geo modal ── */}
      <Modal
        isOpen={showConfirmGeoModal}
        onClose={() => setShowConfirmGeoModal(false)}
        title="Confirmar Atualização"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary-color)', margin: '0 auto 1.5rem auto'
          }}>
            <MapPin size={32} />
          </div>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Atualizar coordenadas?</h3>
          <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
            Serão processados <strong>{pendingGeoCount}</strong> participante(s) sem geolocalização.
            <br />O processo pode levar alguns minutos (1 req/s).
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => setShowConfirmGeoModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={executeBulkGeocoding} className="btn-primary">Sim, Iniciar</button>
          </div>
        </div>
      </Modal>

      {/* ── Progress modal ── */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => { if (geoDone) setShowProgressModal(false); }}
        title="Atualizando Geolocalização"
        maxWidth="680px"
      >
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
            marginBottom: '1.25rem', padding: '1rem',
            backgroundColor: 'rgba(37,99,235,0.04)',
            borderRadius: '10px', border: '1px solid var(--border-color)',
          }}>
            {([
              { label: 'Total', count: geoProgressItems.length, color: 'var(--text-color)' },
              { label: 'Sucesso', count: geoProgressItems.filter(i => i.status === 'success').length, color: '#10b981' },
              { label: 'Erro', count: geoProgressItems.filter(i => i.status === 'error').length, color: '#ef4444' },
              { label: 'Sem endereço', count: geoProgressItems.filter(i => i.status === 'skipped').length, color: '#f59e0b' },
              { label: 'Pendente', count: geoProgressItems.filter(i => i.status === 'pending' || i.status === 'processing').length, color: '#94a3b8' },
            ] as { label: string; count: number; color: string }[]).map(({ label, count, color }) => (
              <div key={label} style={{ flex: '1 1 80px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          <div
            ref={progressListRef}
            style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
          >
            {geoProgressItems.map((item, idx) => {
              type CfgMap = Record<GeoItemStatus, { icon: React.ReactNode; color: string; bg: string; label: string }>;
              const statusConfig: CfgMap = {
                pending: { icon: <Clock size={15} />, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Aguardando' },
                processing: { icon: <Loader size={15} className="animate-spin" />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'Processando' },
                success: { icon: <CheckCircle size={15} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Sucesso' },
                error: { icon: <XCircle size={15} />, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Erro' },
                skipped: { icon: <MapPin size={15} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Ignorado' },
              };
              const cfg = statusConfig[item.status];
              return (
                <div
                  key={item.pessoa_id}
                  data-idx={idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.6rem 0.9rem', borderRadius: '8px',
                    backgroundColor: cfg.bg,
                    border: `1px solid ${cfg.color}33`,
                    transition: 'background-color 0.3s',
                  }}
                >
                  <div style={{ color: cfg.color, flexShrink: 0, display: 'flex' }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.nome}
                    </div>
                    {item.message && (
                      <div style={{ fontSize: '0.75rem', color: cfg.color, opacity: 0.85 }}>{item.message}</div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 700, color: cfg.color,
                    padding: '0.15rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap',
                    border: `1px solid ${cfg.color}44`,
                  }}>
                    {cfg.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
            {!geoDone && (
              <span style={{ fontSize: '0.8rem', opacity: 0.55, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Loader size={13} className="animate-spin" /> Processando, aguarde...
              </span>
            )}
            <button
              className="btn-primary"
              disabled={!geoDone}
              onClick={() => setShowProgressModal(false)}
              style={{ opacity: geoDone ? 1 : 0.4, cursor: geoDone ? 'pointer' : 'not-allowed' }}
            >
              {geoDone ? 'Concluído ✓' : 'Aguarde...'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!participantToUnlink}
        title="Desvincular Participante"
        message={
          <>
            Tem certeza que deseja desvincular o(a) participante <strong style={{ color: 'var(--text-color)' }}>{participantToUnlink?.pessoas?.nome_completo}</strong> deste encontro?
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
        .secretaria-pessoa-row {
          display: grid;
          grid-template-columns: minmax(260px, 1.45fr) minmax(190px, 0.85fr) minmax(280px, 1.25fr) auto;
          align-items: center;
        }
        .secretaria-pessoa-main,
        .secretaria-pessoa-contact,
        .secretaria-pessoa-address {
          min-width: 0;
        }
        .secretaria-pessoa-contact,
        .secretaria-pessoa-address {
          display: flex;
        }
        .secretaria-pessoa-contact .pessoa-row-value,
        .secretaria-pessoa-contact .pessoa-row-sub,
        .secretaria-pessoa-address .pessoa-row-value,
        .secretaria-pessoa-address .pessoa-row-sub {
          overflow-wrap: anywhere;
        }
        .secretaria-address-main span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .secretaria-address-sub {
          display: block;
        }
        .secretaria-pessoa-actions {
          justify-content: flex-end;
          margin-left: 0;
        }
        @media (max-width: 900px) {
          .secretaria-pessoa-grid {
            gap: 0.85rem;
            border: none;
            overflow: visible;
          }
          .secretaria-pessoa-row {
            grid-template-columns: 1fr;
            align-items: stretch;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 0.9rem;
            gap: 0.8rem;
          }
          .secretaria-pessoa-row:last-child {
            border-bottom: 1px solid var(--border-color);
          }
          .secretaria-pessoa-contact,
          .secretaria-pessoa-address {
            display: flex;
          }
          .secretaria-address-main span,
          .secretaria-pessoa-contact .pessoa-row-sub {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
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
