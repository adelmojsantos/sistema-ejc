import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shirt, ChevronLeft, Search, Copy, Download, FileText, FileSpreadsheet, Loader, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useEncontros } from '../../contexts/EncontroContext';
import { useLoading } from '../../contexts/LoadingContext';
import { comprasService, ResumoCamisetas } from '../../services/comprasService';
import { equipeService } from '../../services/equipeService';
import type { Equipe } from '../../types/equipe';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useDebounce } from '../../hooks/useDebounce';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function PedidosCamisetasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { setIsLoading: setGlobalLoading } = useLoading();
  
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [resumo, setResumo] = useState<ResumoCamisetas[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  
  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, selectedEncontroId]);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setLoading(true);
    setGlobalLoading(true);
    try {
      const [pedidosData, resumoData, eqData] = await Promise.all([
        comprasService.listarPedidosDetalhados(selectedEncontroId),
        comprasService.listarResumoCamisetas(selectedEncontroId),
        equipeService.listar()
      ]);
      setPedidos(pedidosData);
      setResumo(resumoData);
      setEquipes(eqData);
    } catch {
      toast.error('Erro ao carregar dados de camisetas.');
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  }, [selectedEncontroId, setGlobalLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const matchEquipe = selectedEquipeId === 'all' || p.participacoes?.equipe_id === selectedEquipeId;
      const matchSearch = (p.pessoa_nome || '').toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                          (p.camiseta_modelos?.nome || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchEquipe && matchSearch;
    }).sort((a, b) => a.pessoa_nome.localeCompare(b.pessoa_nome));
  }, [pedidos, selectedEquipeId, debouncedSearch]);

  const handleCopySummary = () => {
    if (resumo.length === 0) {
      toast.error('Não há dados para copiar.');
      return;
    }

    let text = `👕 *RESUMO DE CAMISETAS*\n`;
    text += `Encontro: ${encontros.find(e => e.id === selectedEncontroId)?.nome}\n\n`;

    resumo.forEach(m => {
      text += `📦 *${m.modelo_nome.toUpperCase()}*\n`;
      Object.entries(m.tamanhos)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([tam, qtd]) => {
          text += `• ${tam}: ${qtd}\n`;
        });
      text += `👉 *Total: ${m.total}*\n\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success('Resumo copiado para o clipboard!');
  };

  const handleExportExcel = () => {
    const data = filteredPedidos.map(p => ({
      'Participante': p.pessoa_nome,
      'Equipe': p.equipe_nome,
      'Modelo': p.camiseta_modelos?.nome,
      'Tamanho': p.tamanho,
      'Qtd': p.quantidade,
      'Data Pedido': new Date(p.created_at).toLocaleDateString()
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, `pedidos_camisetas_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Pedidos de Camisetas</h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={handleCopySummary} disabled={loading}>
            <Copy size={16} style={{ marginRight: '0.4rem' }} /> Copiar Texto
          </button>
          <button className="btn-primary" onClick={handleExportExcel} disabled={loading}>
            <Download size={16} style={{ marginRight: '0.4rem' }} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Resumo Consolidado */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shirt size={20} className="text-primary" /> Resumo de Produção
        </h2>
        <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {resumo.map(m => (
            <div key={m.modelo_id} className="card" style={{ padding: '1.25rem' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', pb: '0.75rem', mb: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{m.modelo_nome}</h3>
                <span className="badge badge-primary">{m.total} total</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {Object.entries(m.tamanhos).map(([tam, qtd]) => (
                  <div key={tam} style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--surface-1)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>{tam}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{qtd}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {resumo.length === 0 && !loading && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, gridColumn: '1 / -1' }}>
              Nenhum pedido registrado para este encontro.
            </div>
          )}
        </div>
      </section>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
            <label className="form-label">Filtrar por Equipe</label>
            <select className="form-input" value={selectedEquipeId} onChange={e => setSelectedEquipeId(e.target.value)}>
              <option value="all">Todas as Equipes</option>
              {equipes.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nome}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '280px' }}>
            <label className="form-label">Buscar Pedido</label>
            <div className="form-input-wrapper">
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Nome do participante ou modelo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Listagem */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--surface-1)' }}>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Participante</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Equipe</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>Modelo</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Tam</th>
                <th style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Qtd</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center' }}>
                    <Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontWeight: 600 }}>{p.pessoa_nome}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>{p.equipe_nome}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>{p.camiseta_modelos?.nome}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span className="badge" style={{ background: 'var(--surface-2)' }}>{p.tamanho}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {p.quantidade}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
