import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLoading } from '../../contexts/LoadingContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import { pessoaService } from '../../services/pessoaService';
import type { InscricaoEnriched } from '../../types/inscricao';
import { ChevronLeft, Search, Users, User, Download, FileText, FileSpreadsheet, MapPin, Loader, Plus, CheckCircle, XCircle, Clock, UserMinus, X } from 'lucide-react';
import type { Encontro } from '../../types/encontro';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { geocodeWithFallback } from '../../utils/geocoding';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type GeoItemStatus = 'pending' | 'processing' | 'success' | 'error' | 'skipped';

interface GeoProgressItem {
  pessoa_id: string;
  nome: string;
  status: GeoItemStatus;
  message?: string;
}

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function SecretariaParticipantesPage() {
  const { setIsLoading: setGlobalLoading } = useLoading();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingGeo, setIsUpdatingGeo] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConfirmGeoModal, setShowConfirmGeoModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [participantToUnlink, setParticipantToUnlink] = useState<InscricaoEnriched | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingGeoCount, setPendingGeoCount] = useState(0);
  const [geoProgressItems, setGeoProgressItems] = useState<GeoProgressItem[]>([]);
  const [geoDone, setGeoDone] = useState(false);
  const progressListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await encontroService.listar();
        setEncontros(data);
        const encontroParam = searchParams.get('encontro');
        if (encontroParam) {
          setSelectedEncontroId(encontroParam);
        } else {
          const active = data.find(e => e.ativo);
          if (active) setSelectedEncontroId(active.id);
          else if (data.length > 0) setSelectedEncontroId(data[0].id);
        }
      } catch {
        toast.error('Erro ao carregar encontros.');
      }
    };
    loadInitialData();
  }, [searchParams]);

  const loadParticipantes = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      const data = await inscricaoService.listarPorEncontro(selectedEncontroId);
      setParticipantes(data.filter(p => p.participante === true));
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

  const filteredParticipantes = participantes.filter(p =>
    p.pessoas?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));

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
    return filteredParticipantes.map((p, idx) => ({
      '#': idx + 1,
      'Nome Completo': p.pessoas?.nome_completo || '—',
      'Telefone': formatTelefone(p.pessoas?.telefone),
      'Comunidade': p.pessoas?.comunidade || '—',
      'Bairro': p.pessoas?.bairro || '—',
      'Cidade': p.pessoas?.cidade || '—',
    }));
  };

  const handleExportPDF = async () => {
    const data = getExportData();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16);
    doc.text(`Participantes: ${selectedEncontro?.nome || 'Encontro'}`, 14, 18);
    autoTable(doc, {
      head: [['#', 'Nome Completo', 'Telefone', 'Comunidade', 'Bairro', 'Cidade']],
      body: data.map(d => [d['#'], d['Nome Completo'], d['Telefone'], d['Comunidade'], d['Bairro'], d['Cidade']]),
      startY: 25,
    });
    doc.save(`participantes_${selectedEncontro?.nome || 'encontro'}.pdf`);
    setShowExportMenu(false);
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="main-content container">
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
                      <button onClick={handleExportPDF} className="dropdown-item-custom">
                        <div className="icon-box-pdf"><FileText size={18} /></div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>PDF</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Documento formatado</div>
                        </div>
                      </button>
                      <button className="dropdown-item-custom">
                        <div className="icon-box-excel"><FileSpreadsheet size={18} /></div>
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
                <label className="form-label">Buscar por Nome</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', opacity: 0.4 }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Digite o nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', width: '100%' }}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center', padding: 0 }}
                      title="Limpar busca"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="card text-center py-8">
              <Loader size={32} className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }} />
              <p>Carregando participantes...</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                  {filteredParticipantes.length} Registro(s) Encontrado(s)
                </h2>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', textAlign: 'left' }}>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Participante</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Contato</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Endereço / Bairro</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, textAlign: 'center' }}>Mapa</th>
                      {selectedEncontro?.ativo && (
                        <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, textAlign: 'center', width: '80px' }}>Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipantes.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                          <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.3, display: 'inline-block' }} />
                          <p style={{ margin: 0 }}>Nenhum participante encontrado.</p>
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
                                <span style={{ fontWeight: 600, display: 'block' }}>{p.pessoas?.nome_completo}</span>
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
                            <div style={{ fontSize: '0.85rem' }}>
                              <span style={{ display: 'block' }}>{p.pessoas?.endereco}{p.pessoas?.numero ? `, ${p.pessoas.numero}` : ''}</span>
                              <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{p.pessoas?.bairro} - {p.pessoas?.cidade}</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                            <div style={{ color: p.pessoas?.latitude ? 'var(--success-border)' : 'var(--danger-border)', opacity: p.pessoas?.latitude ? 1 : 0.3 }}>
                              <MapPin size={18} style={{ margin: '0 auto' }} />
                            </div>
                          </td>
                          {selectedEncontro?.ativo && (
                            <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setParticipantToUnlink(p); }}
                                className="icon-btn action-btn-hover"
                                style={{ color: 'var(--danger-text)', margin: '0 auto', display: 'flex' }}
                                title="Desvincular do encontro"
                              >
                                <UserMinus size={18} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

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
      `}</style>
    </div>
  );
}
