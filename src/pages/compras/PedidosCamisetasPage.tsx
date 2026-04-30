import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shirt, ChevronLeft, Search, Copy, Download, Loader, ChevronDown, ChevronUp, X, Plus, Trash2, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useEncontros } from '../../contexts/EncontroContext';
import { useLoading } from '../../contexts/LoadingContext';
import { comprasService, type ResumoCamisetas, type CamisetaEquipeReport } from '../../services/comprasService';
import { equipeService } from '../../services/equipeService';
import { camisetaService } from '../../services/camisetaService';
import { supabase } from '../../lib/supabase';
import type { Equipe } from '../../types/equipe';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import { useDebounce } from '../../hooks/useDebounce';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import * as XLSX from 'xlsx';
import { PixPaymentInfo } from '../../components/financeiro/PixPaymentInfo';

export function PedidosCamisetasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { setIsLoading: setGlobalLoading } = useLoading();

  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const encontroData = encontros.find(e => e.id === selectedEncontroId);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [resumo, setResumo] = useState<ResumoCamisetas[]>([]);
  const [relatorioEquipes, setRelatorioEquipes] = useState<CamisetaEquipeReport[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);

  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showResumo, setShowResumo] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);
  const [viewDetailsConfig, setViewDetailsConfig] = useState<{ modeloId: string, tamanho: string, modeloNome: string } | null>(null);
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Estados para Novo Pedido
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [modelosCamiseta, setModelosCamiseta] = useState<CamisetaModelo[]>([]);
  const [tamanhosCamiseta, setTamanhosCamiseta] = useState<CamisetaTamanho[]>([]);
  const [equipeParticipantes, setEquipeParticipantes] = useState<{ id: string, nome: string }[]>([]);
  const [newOrderForm, setNewOrderForm] = useState({ equipe_id: '', participacao_id: '', modelo_id: '', tamanho: '', quantidade: 1 });
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Estado para Exclusão
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loading, setLoading] = useState(true);


  // Bloqueia a rolagem do corpo da página quando um modal está aberto
  useEffect(() => {
    if (viewDetailsConfig || isAddingOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewDetailsConfig, isAddingOrder]);

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
      const [pedData, resData, eqData, relEqData, modsData, tamsData] = await Promise.all([
        comprasService.listarPedidosDetalhados(selectedEncontroId),
        comprasService.listarResumoCamisetas(selectedEncontroId),
        equipeService.listar(),
        comprasService.listarRelatorioCamisetasPorEquipe(selectedEncontroId),
        camisetaService.listarModelos(selectedEncontroId),
        camisetaService.listarTamanhos()
      ]);
      setPedidos(pedData);
      setResumo(resData);
      setEquipes(eqData);
      setRelatorioEquipes(relEqData);
      // Filtra apenas modelos ativos para este encontro
      setModelosCamiseta(modsData.filter((m: any) => m.esta_ativo_no_encontro !== false));
      setTamanhosCamiseta(tamsData);
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

  const groupedPedidos = useMemo(() => {
    interface ModelGroup {
      model_nome: string;
      items: any[];
      total_valor_modelo: number;
    }

    interface PersonGroup {
      participacao_id: string;
      pessoa_nome: string;
      equipe_nome: string;
      models: Map<string, ModelGroup>;
      total_valor: number;
    }

    const personMap = new Map<string, PersonGroup>();

    filteredPedidos.forEach(p => {
      const pKey = p.participacao_id;
      if (!personMap.has(pKey)) {
        personMap.set(pKey, {
          participacao_id: p.participacao_id,
          pessoa_nome: p.pessoa_nome,
          equipe_nome: p.equipe_nome,
          models: new Map(),
          total_valor: 0
        });
      }

      const person = personMap.get(pKey)!;
      const mKey = p.modelo_id;
      if (!person.models.has(mKey)) {
        person.models.set(mKey, {
          model_nome: p.camiseta_modelos?.nome || 'Modelo não identificado',
          items: [],
          total_valor_modelo: 0
        });
      }

      const model = person.models.get(mKey)!;
      const itemTotal = (p.valor_unitario * p.quantidade);
      model.items.push(p);
      model.total_valor_modelo += itemTotal;
      person.total_valor += itemTotal;
    });

    return Array.from(personMap.values()).map(p => ({
      ...p,
      models: Array.from(p.models.values()).map(m => ({
        ...m,
        // Ordena os itens dentro de cada modelo pelo tamanho
        items: m.items.sort((a, b) => {
          const orderA = tamanhosCamiseta.find(t => t.sigla === a.tamanho && (t.modelo_id === a.modelo_id || !t.modelo_id))?.ordem ?? 999;
          const orderB = tamanhosCamiseta.find(t => t.sigla === b.tamanho && (t.modelo_id === b.modelo_id || !t.modelo_id))?.ordem ?? 999;
          return orderA - orderB;
        })
      }))
    }));
  }, [filteredPedidos, tamanhosCamiseta]);

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

  const loadTeamMembers = async (equipeId: string) => {
    if (!equipeId || !selectedEncontroId) {
      setEquipeParticipantes([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('participacoes')
        .select('id, pessoas!inner(nome_completo)')
        .eq('encontro_id', selectedEncontroId)
        .eq('equipe_id', equipeId);

      if (error) throw error;

      const sortedData = (data || []).map(p => ({
        id: p.id,
        nome: (p.pessoas as any)?.nome_completo || 'Sem Nome'
      })).sort((a, b) => a.nome.localeCompare(b.nome));

      setEquipeParticipantes(sortedData);
    } catch (e) {
      toast.error('Erro ao buscar participantes da equipe.');
    }
  };

  const handleAddOrder = async () => {
    if (!newOrderForm.participacao_id || !newOrderForm.modelo_id || !newOrderForm.tamanho) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setIsSavingOrder(true);
    try {
      await camisetaService.criarPedido({
        participacao_id: newOrderForm.participacao_id,
        modelo_id: newOrderForm.modelo_id,
        tamanho: newOrderForm.tamanho,
        quantidade: newOrderForm.quantidade
      });
      toast.success('Pedido adicionado com sucesso!');
      setIsAddingOrder(false);
      setNewOrderForm({ equipe_id: '', participacao_id: '', modelo_id: '', tamanho: '', quantidade: 1 });
      loadData();
    } catch (e) {
      toast.error('Erro ao adicionar pedido.');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await camisetaService.excluirPedido(deleteTarget);
      toast.success('Pedido removido.');
      setDeleteTarget(null);
      loadData();
    } catch {
      toast.error('Erro ao remover pedido.');
    } finally {
      setIsDeleting(false);
    }
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
          <button className="btn-secondary" onClick={() => setIsAddingOrder(true)} disabled={loading}>
            <Plus size={16} style={{ marginRight: '0.4rem' }} /> Novo Pedido
          </button>
          <button className="btn-secondary" onClick={handleCopySummary} disabled={loading}>
            <Copy size={16} style={{ marginRight: '0.4rem' }} /> Copiar
          </button>
          <button className="btn-primary" onClick={handleExportExcel} disabled={loading}>
            <Download size={16} style={{ marginRight: '0.4rem' }} /> Excel
          </button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>


        {/* Informações de Pagamento PIX */}
        <div style={{ marginBottom: '1.5rem' }}>
          <PixPaymentInfo 
            chave={encontroData?.pix_chave}
            tipo={encontroData?.pix_tipo}
            qrCodeUrl={encontroData?.pix_qrcode_url}
          />
        </div>

        {/* Resumo de Pedidos */}
        <section style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowResumo(!showResumo)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              cursor: 'pointer',
              backgroundColor: 'rgba(37, 99, 235, 0.05)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: '12px',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'var(--primary-color)', color: 'white', borderRadius: '10px', display: 'flex' }}>
                <Shirt size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-color)', fontWeight: 600 }}>
                  Resumo de Pedidos
                </h2>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, marginTop: '2px' }}>
                  {showResumo ? 'Clique para ocultar o quadro de totais' : 'Clique para expandir e ver o total de produção por modelo e tamanho'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6, color: 'var(--primary-color)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                {showResumo ? 'Ocultar' : 'Expandir'}
              </span>
              {showResumo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showResumo && (
            <div className="grid-container animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              {resumo.map(m => (
                <div key={m.modelo_id} className="card" style={{ padding: '1.25rem' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{m.modelo_nome}</h3>
                    <span className="badge badge-primary">{m.total} total</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {Object.entries(m.tamanhos)
                      .sort(([tamA], [tamB]) => {
                        const orderA = tamanhosCamiseta.find(t => t.sigla === tamA && (t.modelo_id === m.modelo_id || !t.modelo_id))?.ordem ?? 999;
                        const orderB = tamanhosCamiseta.find(t => t.sigla === tamB && (t.modelo_id === m.modelo_id || !t.modelo_id))?.ordem ?? 999;
                        return orderA - orderB;
                      })
                      .map(([tam, qtd]) => (
                        <div
                          key={`${m.modelo_id}-${tam}`}
                          className="card--clickable"
                          onClick={() => setViewDetailsConfig({ modeloId: m.modelo_id, tamanho: tam, modeloNome: m.modelo_nome })}
                          style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--surface-1)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>{tam}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{qtd}</div>
                        </div>
                      ))}
                  </div>
                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Valor Unit.: {m.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                      Total: {m.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              ))}
              {resumo.length === 0 && !loading && (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, gridColumn: '1 / -1' }}>
                  Nenhum pedido registrado para este encontro.
                </div>
              )}
            </div>
          )}
        </section>


        {/* Filtros */}
        <section style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              cursor: 'pointer',
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--surface-1)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'var(--surface-3)', color: 'var(--text-color)', borderRadius: '10px', display: 'flex' }}>
                <Search size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-color)', fontWeight: 600 }}>
                  Filtros de Pesquisa
                </h2>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, marginTop: '2px' }}>
                  {showFiltros ? 'Clique para ocultar os filtros' : 'Clique para expandir e filtrar por equipe ou buscar por participante'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                {showFiltros ? 'Ocultar' : 'Expandir'}
              </span>
              {showFiltros ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showFiltros && (
            <div className="card animate-fade-in" style={{ marginTop: '1rem' }}>
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
                  <div className="form-input-wrapper" style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '2.5rem', paddingRight: searchTerm ? '2.5rem' : '1rem' }}
                      placeholder="Nome do participante ou modelo..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="btn-icon"
                        onClick={() => setSearchTerm('')}
                        style={{ backgroundColor: 'transparent', position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, margin: 0, padding: '4px' }}
                        title="Limpar busca"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Resumo por Equipe */}
        <section className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {relatorioEquipes.filter(r => r.total_camisetas > 0).map(r => (
            <div
              key={r.equipe_id}
              className="card card--clickable"
              style={{
                padding: '0.5rem',
                borderTop: '4px solid var(--primary-color)',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                aspectRatio: '1 / 1',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                backgroundColor: r.comprovante_camisetas_url ? 'var(--success-bg)' : 'var(--card-bg)'
              }}
              onClick={() => setSelectedEquipeId(r.equipe_id)}
            >
              {r.comprovante_camisetas_url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(r.comprovante_camisetas_url!, '_blank');
                  }}
                  title="Ver Comprovante"
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--success-color)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <FileText size={14} />
                </button>
              )}
              <span className="badge badge-primary" style={{ fontSize: '1.2rem', padding: '0.25rem 0.75rem', marginBottom: '0.5rem' }}>
                {r.total_camisetas}
              </span>
              <h3 style={{ fontSize: '0.8rem', margin: '0 0 0.25rem 0', lineHeight: '1.2' }}>{r.equipe_nome}</h3>
              <p style={{ fontSize: '0.65rem', margin: '0 0 0.25rem 0', opacity: 0.6 }}>{r.total_pedidos} {r.total_pedidos === 1 ? 'pessoa' : 'pessoas'}</p>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                {r.total_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          ))}
        </section>

        {/* Listagem em Cards */}
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Listagem de Pedidos</h2>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <Loader className="animate-spin" size={24} style={{ margin: '0 auto' }} />
            </div>
          ) : groupedPedidos.length === 0 ? (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
              Nenhum pedido encontrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groupedPedidos.map(group => (
                <div key={group.participacao_id} className="card" style={{ padding: '1.25rem' }}>
                  {/* Cabeçalho da Pessoa com Total Geral */}
                  <div style={{
                    marginBottom: '1.25rem',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', margin: '0 0 0.15rem 0', fontWeight: 700 }}>{group.pessoa_nome}</h3>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{group.equipe_nome}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>Total do Pedido</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-color)' }}>
                        {group.total_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </div>

                  {/* Modelos de Camiseta */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {group.models.map(model => (
                      <div key={model.model_nome} style={{
                        flex: '1 1 300px',
                        minWidth: '280px',
                        padding: '1rem',
                        backgroundColor: 'rgba(var(--primary-rgb), 0.02)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        {/* Nome do Modelo */}
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: 'var(--primary-color)',
                          textTransform: 'uppercase',
                          marginBottom: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Shirt size={14} />
                            {model.model_nome}
                          </div>
                        </div>

                        {/* Itens sob este modelo */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                          {model.items.map(item => (
                            <div key={item.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.85rem',
                              padding: '0.4rem 0.6rem',
                              backgroundColor: 'rgba(0,0,0,0.03)',
                              borderRadius: '8px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ opacity: 0.7 }}>Tam:</span>
                                <span style={{ fontWeight: 700 }}>{item.tamanho}</span>
                                <span style={{ opacity: 0.3, margin: '0 0.35rem' }}>|</span>
                                <span style={{ opacity: 0.7 }}>Qtd:</span>
                                <span style={{ fontWeight: 700 }}>{item.quantidade}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                  onClick={() => setDeleteTarget(item.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    opacity: 0.5
                                  }}
                                  title="Remover"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Total por Modelo */}
                        <div style={{
                          marginTop: '1rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px dashed var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 700 }}>Subtotal {model.model_nome}</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                            {model.total_valor_modelo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Modal de Detalhes do Resumo */}
        {viewDetailsConfig && (
          <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '500px' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                  {viewDetailsConfig.modeloNome} <span style={{ opacity: 0.6 }}>&ndash;</span> {viewDetailsConfig.tamanho}
                </h2>
                <button className="btn-icon" onClick={() => setViewDetailsConfig(null)} style={{ margin: 0, display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {pedidos
                    .filter(p => p.modelo_id === viewDetailsConfig.modeloId && p.tamanho === viewDetailsConfig.tamanho)
                    .sort((a, b) => a.pessoa_nome.localeCompare(b.pessoa_nome))
                    .map(p => (
                      <div key={p.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.pessoa_nome}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{p.equipe_nome}</div>
                        </div>
                        <span className="badge badge-primary">{p.quantidade} {p.quantidade === 1 ? 'un' : 'uns'}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Novo Pedido */}
        {isAddingOrder && (
          <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '600px' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Adicionar Pedido</h2>
                <button className="btn-icon" onClick={() => setIsAddingOrder(false)} style={{ margin: 0, display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Equipe</label>
                  <select
                    className="form-input"
                    value={newOrderForm.equipe_id}
                    onChange={e => {
                      const eqId = e.target.value;
                      setNewOrderForm({ ...newOrderForm, equipe_id: eqId, participacao_id: '' });
                      loadTeamMembers(eqId);
                    }}
                  >
                    <option value="">Selecione uma equipe...</option>
                    {equipes.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Encontreiro/Participante</label>
                  <select
                    className="form-input"
                    value={newOrderForm.participacao_id}
                    onChange={e => setNewOrderForm({ ...newOrderForm, participacao_id: e.target.value })}
                    disabled={!newOrderForm.equipe_id}
                  >
                    <option value="">{newOrderForm.equipe_id ? 'Selecione uma pessoa...' : 'Selecione a equipe primeiro'}</option>
                    {equipeParticipantes.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Modelo</label>
                    <select
                      className="form-input"
                      value={newOrderForm.modelo_id}
                      onChange={e => {
                        const modId = e.target.value;
                        const availableSizes = tamanhosCamiseta.filter(t => !t.modelo_id || t.modelo_id === modId);
                        const newSize = availableSizes.length > 0 ? availableSizes[0].sigla : '';
                        setNewOrderForm({ ...newOrderForm, modelo_id: modId, tamanho: newSize });
                      }}
                    >
                      <option value="">Selecione...</option>
                      {modelosCamiseta.map(mod => (
                        <option key={mod.id} value={mod.id}>{mod.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tamanho</label>
                    <select
                      className="form-input"
                      value={newOrderForm.tamanho}
                      onChange={e => setNewOrderForm({ ...newOrderForm, tamanho: e.target.value })}
                      disabled={!newOrderForm.modelo_id}
                    >
                      {newOrderForm.modelo_id ? (
                        tamanhosCamiseta
                          .filter(t => !t.modelo_id || t.modelo_id === newOrderForm.modelo_id)
                          .map(t => (
                            <option key={t.id} value={t.sigla}>{t.sigla}</option>
                          ))
                      ) : (
                        <option value="">-</option>
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qtd.</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={newOrderForm.quantidade}
                      onChange={e => setNewOrderForm({ ...newOrderForm, quantidade: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                <button className="btn-text" onClick={() => setIsAddingOrder(false)}>Cancelar</button>
                <button
                  className="btn-primary"
                  onClick={handleAddOrder}
                  disabled={isSavingOrder || !newOrderForm.participacao_id || !newOrderForm.modelo_id || !newOrderForm.tamanho}
                >
                  {isSavingOrder ? 'Salvando...' : 'Adicionar Pedido'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="Remover Pedido"
          message="Deseja realmente remover este pedido de camiseta? Esta ação não pode ser desfeita."
          onConfirm={handleDeleteOrder}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Remover"
          isDestructive={true}
          isLoading={isDeleting}
        />
      </div>
    </div>
  );
}
