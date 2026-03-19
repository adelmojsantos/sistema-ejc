import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { encontroService } from '../../services/encontroService';
import { inscricaoService } from '../../services/inscricaoService';
import type { InscricaoEnriched } from '../../types/inscricao';
import { equipeService } from '../../services/equipeService';
import { ChevronLeft, Search, Filter, Users, UserCheck, Shield, User } from 'lucide-react';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import { toast } from 'react-hot-toast';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';

export function EncontroParticipantesPage() {
  const navigate = useNavigate();
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [participantes, setParticipantes] = useState<InscricaoEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTeamId, setFilterTeamId] = useState<string>('all'); // 'all', 'encontristas', or teamId

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
        setParticipantes(data);
      } catch {
        toast.error('Erro ao carregar participantes.');
      } finally {
        setIsLoading(false);
      }
    };
    loadParticipantes();
  }, [selectedEncontroId]);

  const filteredParticipantes = participantes.filter(p => {
    const matchesSearch = p.pessoas?.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filterTeamId === 'encontristas') {
      matchesFilter = p.participante === true;
    } else if (filterTeamId !== 'all') {
      matchesFilter = p.equipe_id === filterTeamId;
    }

    return matchesSearch && matchesFilter;
  }).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));


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
          <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
            <Filter size={32} color="var(--primary-color)" />
          </div>
          <p>Carregando lista de participantes...</p>
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
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Tipo / Equipe</th>
                  <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Função</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipantes.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                      Nenhum participante encontrado para este filtro.
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
                          <span style={{ fontWeight: 500 }}>{p.pessoas?.nome_completo}</span>
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
