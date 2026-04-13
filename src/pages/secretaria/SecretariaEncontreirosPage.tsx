import { ChevronLeft, Download, FileSpreadsheet, FileText, Filter, Loader, Search, Shield, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import type { InscricaoEnriched } from '../../types/inscricao';

function formatTelefone(tel: string | null | undefined) {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

export function SecretariaEncontreirosPage() {
  const navigate = useNavigate();

  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeamId, setFilterTeamId] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [encontrosData, equipesData] = await Promise.all([
          encontroService.listar(),
          equipeService.listar()
        ]);
        setEncontros(encontrosData);
        setEquipes(equipesData);
        const active = encontrosData.find(e => e.ativo);
        if (active) setSelectedEncontroId(active.id);
        else if (encontrosData.length > 0) setSelectedEncontroId(encontrosData[0].id);
      } catch {
        toast.error('Erro ao carregar dados iniciais.');
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedEncontroId) return;
    const loadParticipantes = async () => {
      setIsLoading(true);
      try {
        const data = await inscricaoService.listarPorEncontro(selectedEncontroId);
        setParticipantes(data.filter(p => !p.participante));
      } catch {
        toast.error('Erro ao carregar encontreiros.');
      } finally {
        setIsLoading(false);
      }
    };
    loadParticipantes();
  }, [selectedEncontroId]);

  const filteredParticipantes = participantes.filter(p => {
    const matchesSearch = p.pessoas?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = filterTeamId === 'all' || p.equipe_id === filterTeamId;
    return matchesSearch && matchesTeam;
  }).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));

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
                <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Listagem de Encontreiros</h1>
              </div>
            </div>

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
                    <button className="dropdown-item-custom">
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
                <label className="form-label">Buscar por Nome</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Digite o nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="card text-center py-8">
              <Loader size={32} className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }} />
              <p>Carregando encontreiros...</p>
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
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Trabalhador</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Contato</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Equipe</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Função</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipantes.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                          <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.3, display: 'inline-block' }} />
                          <p style={{ margin: 0 }}>Nenhum encontreiro encontrado.</p>
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
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontSize: '0.85rem' }}>
                              <span style={{ display: 'block' }}>{formatTelefone(p.pessoas?.telefone)}</span>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.25rem' }}>
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
                          </td>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            {p.coordenador ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                <Shield size={14} /> Coordenador
                              </span>
                            ) : (
                              <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>Membro</span>
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
      </main>

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
      `}</style>
    </div>
  );
}
