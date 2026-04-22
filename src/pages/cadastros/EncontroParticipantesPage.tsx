import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import type { InscricaoEnriched } from '../../types/inscricao';
import { equipeService } from '../../services/equipeService';
import { ChevronLeft, Search, Filter, Users, UserCheck, Shield, User, Download, FileText, FileSpreadsheet, X } from 'lucide-react';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { exportConfigService } from '../../services/exportConfigService';

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  try {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return date;
  }
}

function maskCpf(cpf: string | null | undefined) {
  if (!cpf) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return cpf;
}

export function EncontroParticipantesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filters — read initial values from URL query params
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [filterTeamId, setFilterTeamId] = useState<string>(searchParams.get('filter') || 'all');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [encontrosData, equipesData] = await Promise.all([
          encontroService.listar(),
          equipeService.listar()
        ]);
        setEncontros(encontrosData);
        setEquipes(equipesData);

        // Check if a specific encontro was passed via URL
        const encontroParam = searchParams.get('encontro');
        if (encontroParam) {
          setSelectedEncontroId(encontroParam);
        } else {
          const active = encontrosData.find(e => e.ativo);
          if (active) setSelectedEncontroId(active.id);
          else if (encontrosData.length > 0) setSelectedEncontroId(encontrosData[0].id);
        }
      } catch {
        toast.error('Erro ao carregar dados iniciais.');
      }
    };
    loadInitialData();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedEncontroId) return;

    const loadParticipantes = async () => {
      setIsLoading(true);
      try {
        const data = await inscricaoService.listarPorEncontro(selectedEncontroId);
        setParticipantes(data);
      } catch {
        toast.error('Erro ao carregar participantes.');
      } finally {
        setIsLoading(false);
      }
    };
    loadParticipantes();
  }, [selectedEncontroId]);

  const filteredParticipantes = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    const normalize = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
    const termDigits = normalize(term);

    return participantes
      .filter(p => {
        let matchesFilter = true;
        if (filterTeamId === 'encontristas') {
          matchesFilter = p.participante === true;
        } else if (filterTeamId !== 'all') {
          matchesFilter = p.equipe_id === filterTeamId;
        }
        if (!matchesFilter) return false;

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

  const selectedEncontro = encontros.find(e => e.id === selectedEncontroId);

  const getFilterLabel = () => {
    if (filterTeamId === 'all') return 'Todos';
    if (filterTeamId === 'encontristas') return 'Encontristas';
    const eq = equipes.find(e => e.id === filterTeamId);
    return eq?.nome || 'Equipe';
  };

  // ─── Export helpers ────────────────────────────────────────────────
  const getExportData = () => {
    return filteredParticipantes.map((p, idx) => ({
      '#': idx + 1,
      'Nome Completo': p.pessoas?.nome_completo || '—',
      'CPF': maskCpf(p.pessoas?.cpf),
      'Telefone': formatTelefone(p.pessoas?.telefone),
      'E-mail': p.pessoas?.email || '—',
      'Comunidade': p.pessoas?.comunidade || '—',
      'Data de Nascimento': formatDate(p.pessoas?.data_nascimento),
      'Cidade': p.pessoas?.cidade || '—',
      'Bairro': p.pessoas?.bairro || '—',
      'Tipo': p.participante ? 'Encontrista' : (p.equipes?.nome || 'Equipe'),
      'Função': p.coordenador ? 'Coordenador' : (p.participante ? 'Encontrista' : 'Membro'),
    }));
  };

  const getExportTitle = () => {
    const encontroName = selectedEncontro?.nome || 'Encontro';
    const filterLabel = getFilterLabel();
    return `${encontroName} - ${filterLabel}`;
  };

  const handleExportPDF = async () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    let config = null;
    try {
      config = await exportConfigService.obter(selectedEncontroId);
    } catch (e) {
      console.warn('Config de exportação não encontrada', e);
    }
    const hasConfig = config && config.config_telas && config.config_telas['EncontroParticipantes'];

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let startY = 30;

    if (hasConfig && config) {
        if (config.imagem_esq_base64) {
            try { doc.addImage(config.imagem_esq_base64, 'PNG', 14, 10, 30, 30); } catch { /* ignore */ }
        }
        if (config.imagem_dir_base64) {
            try { doc.addImage(config.imagem_dir_base64, 'PNG', 253, 10, 30, 30); } catch { /* ignore */ }
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(config.titulo || '', 148.5, 18, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(config.subtitulo || '', 148.5, 24, { align: 'center' });
        
        doc.text(config.tema || '', 148.5, 30, { align: 'center' });
        
        if (config.observacoes) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(config.observacoes, 148.5, 38, { align: 'center' });
            startY = 58;
        } else {
            startY = 52;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const title = getExportTitle();
        doc.text(title, 14, startY - 6);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${data.length} registro(s)`, 14, startY + 2);
        doc.setTextColor(0);
        startY += 8;

    } else {
        const title = getExportTitle();
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, 18);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} • Total: ${data.length} registro(s)`, 14, 24);
        doc.setTextColor(0);
    }

    const columns = ['#', 'Nome Completo', 'Telefone', 'Comunidade', 'Nasc.', 'Cidade', 'Tipo', 'Função'];
    const rows = data.map(d => [
      d['#'],
      d['Nome Completo'],
      d['Telefone'],
      d['Comunidade'],
      d['Data de Nascimento'],
      d['Cidade'],
      d['Tipo'],
      d['Função'],
    ]);

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: startY,
      styles: {
        fontSize: 8,
        cellPadding: 3,
        lineColor: [220, 220, 220],
        lineWidth: 0.25,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: 14, right: 14 },
    });

    const fileName = `participantes_${selectedEncontro?.nome?.replace(/\s+/g, '_') || 'encontro'}_${getFilterLabel().toLowerCase()}.pdf`;
    doc.save(fileName);
    toast.success('PDF exportado com sucesso!');
    setShowExportMenu(false);
  };

  const handleExportExcel = async () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum registro para exportar.');
      return;
    }

    let config = null;
    try {
      config = await exportConfigService.obter(selectedEncontroId);
    } catch (e) {
      console.warn('Config de exportação não encontrada', e);
    }
    const hasConfig = config && config.config_telas && config.config_telas['EncontroParticipantes'];

    const ws = XLSX.utils.json_to_sheet([]);

    if (hasConfig && config) {
        XLSX.utils.sheet_add_aoa(ws, [
            [config.titulo],
            [config.subtitulo],
            [config.tema],
            [config.observacoes || ''],
            [`${getExportTitle()} - Gerado em: ${new Date().toLocaleDateString('pt-BR')}`]
        ], { origin: 'A1' });
        XLSX.utils.sheet_add_json(ws, data, { origin: 'A6', skipHeader: false });
    } else {
        XLSX.utils.sheet_add_json(ws, data, { origin: 'A1', skipHeader: false });
    }

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 35 },  // Nome
      { wch: 16 },  // CPF
      { wch: 18 },  // Telefone
      { wch: 28 },  // E-mail
      { wch: 20 },  // Comunidade
      { wch: 14 },  // Nasc
      { wch: 16 },  // Cidade
      { wch: 16 },  // Bairro
      { wch: 14 },  // Tipo
      { wch: 14 },  // Função
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes');

    const fileName = `participantes_${selectedEncontro?.nome?.replace(/\s+/g, '_') || 'encontro'}_${getFilterLabel().toLowerCase()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel exportado com sucesso!');
    setShowExportMenu(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate(-1)} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Listagem</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Participantes do Encontro</h1>
          </div>
        </div>

        {/* Export Button */}
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
              {/* Overlay to close on click outside */}
              <div
                onClick={() => setShowExportMenu(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  zIndex: 100,
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  minWidth: '220px',
                  overflow: 'hidden',
                  animation: 'fadeInUp 0.2s ease',
                }}
              >
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', opacity: 0.5, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Exportar como
                </div>
                <button
                  onClick={handleExportPDF}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-color)',
                    fontSize: '0.9rem',
                    transition: 'background-color 0.15s',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb, 0, 0, 254), 0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}>
                    <FileText size={18} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PDF</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Documento formatado</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcel}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-color)',
                    fontSize: '0.9rem',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb, 0, 0, 254), 0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}>
                    <FileSpreadsheet size={18} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Excel</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Planilha editável</div>
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
            <label className="form-label">Filtrar por Equipe/Tipo</label>
            <div style={{ position: 'relative' }}>
              <Filter size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
              <select
                className="form-input"
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              >
                <option value="all">Todos</option>
                <option value="encontristas">Apenas Encontristas</option>
                <optgroup label="Equipes">
                  {equipes.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </optgroup>
              </select>
            </div>
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
          <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
            <Filter size={32} color="var(--primary-color)" />
          </div>
          <p>Carregando lista de participantes...</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
              {filteredParticipantes.length} Registro(s) Encontrado(s)
            </h2>
            {filterTeamId !== 'all' && (
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: 'rgba(var(--primary-rgb, 0, 0, 254), 0.08)',
                color: 'var(--primary-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <Filter size={12} />
                Filtro: {getFilterLabel()}
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Participante</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Contato</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Tipo / Equipe</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Função</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipantes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                      <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                      <p style={{ margin: 0 }}>Nenhum participante encontrado para este filtro.</p>
                    </td>
                  </tr>
                ) : (
                  filteredParticipantes.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: idx === filteredParticipantes.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(var(--primary-rgb, 0, 0, 254), 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary-color)'
                          }}>
                            <User size={16} />
                          </div>
                          <div>
                            <span style={{ fontWeight: 500, display: 'block' }}>{p.pessoas?.nome_completo}</span>
                            {p.pessoas?.comunidade && (
                              <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{p.pessoas.comunidade}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          <span style={{ display: 'block' }}>{formatTelefone(p.pessoas?.telefone)}</span>
                          {p.pessoas?.email && (
                            <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{p.pessoas.email}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {p.participante ? (
                          <span style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <UserCheck size={12} /> ENCONTRISTA
                          </span>
                        ) : (
                          <span style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            color: 'var(--primary-color)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <Users size={12} /> {p.equipes?.nome || 'Sem Equipe'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {p.coordenador ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            <Shield size={14} /> Coordenador
                          </span>
                        ) : (
                          <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                            {p.participante ? 'Encontrista' : 'Membro'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
