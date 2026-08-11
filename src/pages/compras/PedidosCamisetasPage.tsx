import { CheckCircle, ChevronDown, ChevronLeft, Copy, Download, FileText, Loader, Plus, Search, Shirt, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CamisetaSeparationPanel, type CamisetaSeparationItem } from '../../components/compras/CamisetaSeparationPanel';
import { PaymentProofGalleryModal } from '../../components/compras/PaymentProofGalleryModal';
import { PixPaymentInfo } from '../../components/financeiro/PixPaymentInfo';
import { useEncontros } from '../../contexts/EncontroContext';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import { camisetaService } from '../../services/camisetaService';
import { comprasService, type CamisetaEquipeReport, type IntencaoCamisetaDetalhe } from '../../services/comprasService';
import { equipeService } from '../../services/equipeService';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import type { Equipe } from '../../types/equipe';

type PedidoDetalhado = Awaited<ReturnType<typeof comprasService.listarPedidosDetalhados>>[number];
export function PedidosCamisetasPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { encontros, encontroSelecionadoId: selectedEncontroId } = useEncontros();
  const encontroData = encontros.find(e => e.id === selectedEncontroId);
  const [pedidos, setPedidos] = useState<PedidoDetalhado[]>([]);
  const [relatorioEquipes, setRelatorioEquipes] = useState<CamisetaEquipeReport[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);

  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('busca') || '');
  const [intencoesDetalhadas, setIntencoesDetalhadas] = useState<IntencaoCamisetaDetalhe[]>([]);
  const [proofGallery, setProofGallery] = useState<{ equipeNome: string; urls: string[] } | null>(null);
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);


  // Bloqueia a rolagem do corpo da página quando um modal está aberto
  useEffect(() => {
    if (isAddingOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAddingOrder]);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setLoading(true);
    try {
      const [pedData, eqData, relEqData, modsData, tamsData, intDetailsData] = await Promise.all([
        comprasService.listarPedidosDetalhados(selectedEncontroId),
        equipeService.listar(),
        comprasService.listarRelatorioCamisetasPorEquipe(selectedEncontroId),
        camisetaService.listarModelos(selectedEncontroId),
        camisetaService.listarTamanhos(),
        comprasService.listarDetalhesIntencoes(selectedEncontroId).catch(() => [] as IntencaoCamisetaDetalhe[])
      ]);
      setPedidos(pedData);
      setEquipes(eqData);
      setRelatorioEquipes(relEqData);
      setIntencoesDetalhadas(intDetailsData);
      // Filtra apenas modelos ativos para este encontro
      setModelosCamiseta(modsData.filter(m => m.esta_ativo_no_encontro !== false));
      setTamanhosCamiseta(tamsData);
    } catch {
      toast.error('Erro ao carregar dados de camisetas.');
    } finally {
      setLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const matchEquipe = selectedEquipeId === 'all' || p.equipe_id === selectedEquipeId;
      const matchSearch = (p.pessoa_nome || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (p.camiseta_modelos?.nome || '').toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchEquipe && matchSearch;
    }).sort((a, b) => a.pessoa_nome.localeCompare(b.pessoa_nome));
  }, [pedidos, selectedEquipeId, debouncedSearch]);

  const groupedPedidos = useMemo(() => {
    interface ModelGroup {
      model_nome: string;
      items: PedidoDetalhado[];
      total_valor_modelo: number;
    }

    interface PersonGroup {
      participacao_id: string;
      pessoa_nome: string;
      equipe_nome: string;
      pago_camiseta: boolean;
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
          pago_camiseta: p.pago_camiseta,
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

  const teamSeparationItems = useMemo<CamisetaSeparationItem[]>(() => pedidos.map(pedido => ({
    id: `equipe-${pedido.id}`,
    groupKey: pedido.equipe_id || 'sem-equipe',
    groupName: pedido.equipe_nome || 'Sem equipe de trabalho',
    personName: pedido.pessoa_nome,
    modelName: pedido.camiseta_modelos?.nome || 'Modelo não identificado',
    size: pedido.tamanho || 'Não informado',
    quantity: pedido.quantidade,
    paid: pedido.pago_camiseta,
    missingGroup: !pedido.equipe_id,
  })), [pedidos]);

  const encounteredSeparationItems = useMemo<CamisetaSeparationItem[]>(() => intencoesDetalhadas.map(pedido => ({
    id: `encontrista-${pedido.id}`,
    groupKey: pedido.dupla_nome || 'sem-dupla',
    groupName: pedido.dupla_nome || 'Sem dupla de visitação',
    personName: pedido.encontrista_nome,
    modelName: pedido.modelo_nome || 'Modelo não identificado',
    size: pedido.tamanho || 'Não informado',
    quantity: pedido.quantidade,
    paid: pedido.pago,
    missingGroup: !pedido.dupla_nome,
    proofReference: pedido.comprovante_url,
  })), [intencoesDetalhadas]);

  const handleCopySummary = () => {
    const allItems = [...teamSeparationItems, ...encounteredSeparationItems];
    if (allItems.length === 0) {
      toast.error('Não há dados para copiar.');
      return;
    }

    const summary = new Map<string, {
      modelName: string;
      size: string;
      team: number;
      encountered: number;
      paid: number;
    }>();
    const addItem = (item: CamisetaSeparationItem, source: 'team' | 'encountered') => {
      const key = `${item.modelName}__${item.size}`;
      const current = summary.get(key) ?? {
        modelName: item.modelName,
        size: item.size,
        team: 0,
        encountered: 0,
        paid: 0,
      };
      current[source] += item.quantity;
      if (item.paid) current.paid += item.quantity;
      summary.set(key, current);
    };
    teamSeparationItems.forEach(item => addItem(item, 'team'));
    encounteredSeparationItems.forEach(item => addItem(item, 'encountered'));

    let text = `👕 *PEDIDOS DE CAMISETAS*\n`;
    text += `Encontro: ${encontros.find(e => e.id === selectedEncontroId)?.nome}\n\n`;
    Array.from(summary.values())
      .sort((a, b) => a.modelName.localeCompare(b.modelName, 'pt-BR') || a.size.localeCompare(b.size, 'pt-BR'))
      .forEach(item => {
        const total = item.team + item.encountered;
        text += `• *${item.modelName} · ${item.size}*: ${total} `;
        text += `(equipes ${item.team}, encontristas ${item.encountered}, pagas ${item.paid})\n`;
      });

    navigator.clipboard.writeText(text);
    toast.success('Resumo copiado.');
  };

  const handleExportSeparacaoExcel = (onlyPaid: boolean) => {
    const filterItems = (items: CamisetaSeparationItem[]) => onlyPaid
      ? items.filter(item => item.paid)
      : items;
    const teamItems = filterItems(teamSeparationItems);
    const encounteredItems = filterItems(encounteredSeparationItems);
    const allItems = [...teamItems, ...encounteredItems];

    if (allItems.length === 0) {
      toast.error(onlyPaid ? 'Não há pedidos pagos para exportar.' : 'Não há pedidos para exportar.');
      return;
    }

    const totalsMap = new Map<string, {
      modelName: string;
      size: string;
      teamTotal: number;
      encounteredTotal: number;
      paidTotal: number;
      pendingTotal: number;
    }>();

    const addToTotals = (item: CamisetaSeparationItem, source: 'team' | 'encountered') => {
      const key = `${item.modelName}__${item.size}`;
      const current = totalsMap.get(key) ?? {
        modelName: item.modelName,
        size: item.size,
        teamTotal: 0,
        encounteredTotal: 0,
        paidTotal: 0,
        pendingTotal: 0,
      };
      if (source === 'team') current.teamTotal += item.quantity;
      else current.encounteredTotal += item.quantity;
      if (item.paid) current.paidTotal += item.quantity;
      else current.pendingTotal += item.quantity;
      totalsMap.set(key, current);
    };

    teamItems.forEach(item => addToTotals(item, 'team'));
    encounteredItems.forEach(item => addToTotals(item, 'encountered'));

    const summaryRows = Array.from(totalsMap.values())
      .sort((a, b) => a.modelName.localeCompare(b.modelName, 'pt-BR') || a.size.localeCompare(b.size, 'pt-BR'))
      .map(item => ({
        'Modelo': item.modelName,
        'Tamanho': item.size,
        'Equipes': item.teamTotal,
        'Encontristas': item.encounteredTotal,
        'Total pedido': item.teamTotal + item.encounteredTotal,
        'Pago': item.paidTotal,
        'Pendente': item.pendingTotal,
      }));

    const sortItems = (a: CamisetaSeparationItem, b: CamisetaSeparationItem) => (
      a.groupName.localeCompare(b.groupName, 'pt-BR')
      || a.personName.localeCompare(b.personName, 'pt-BR')
      || a.modelName.localeCompare(b.modelName, 'pt-BR')
      || a.size.localeCompare(b.size, 'pt-BR')
    );
    const toRows = (items: CamisetaSeparationItem[], groupLabel: 'Equipe' | 'Dupla de visitação') => (
      [...items].sort(sortItems).map(item => ({
        [groupLabel]: item.groupName,
        'Pessoa': item.personName,
        'Modelo': item.modelName,
        'Tamanho': item.size,
        'Quantidade': item.quantity,
        'Pagamento': item.paid ? 'Pago' : 'Pendente',
      }))
    );

    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    summarySheet['!cols'] = [
      { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo geral');

    const teamRows = toRows(teamItems, 'Equipe');
    const teamSheet = XLSX.utils.json_to_sheet(teamRows);
    teamSheet['!cols'] = [
      { wch: 26 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];
    if (teamRows.length > 0) teamSheet['!autofilter'] = { ref: `A1:F${teamRows.length + 1}` };
    XLSX.utils.book_append_sheet(workbook, teamSheet, 'Pedidos das equipes');

    const encounteredRows = toRows(encounteredItems, 'Dupla de visitação');
    const encounteredSheet = XLSX.utils.json_to_sheet(encounteredRows);
    encounteredSheet['!cols'] = [
      { wch: 28 }, { wch: 34 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];
    if (encounteredRows.length > 0) encounteredSheet['!autofilter'] = { ref: `A1:F${encounteredRows.length + 1}` };
    XLSX.utils.book_append_sheet(workbook, encounteredSheet, 'Encontristas por dupla');

    const suffix = onlyPaid ? 'somente_pagos' : 'todos_os_pedidos';
    XLSX.writeFile(workbook, `camisetas_separacao_${suffix}_${new Date().getTime()}.xlsx`);
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

      type EquipeParticipanteRow = {
        id: string;
        pessoas?: { nome_completo?: string | null } | { nome_completo?: string | null }[] | null;
      };

      const sortedData = ((data || []) as EquipeParticipanteRow[]).map(p => {
        const pessoa = Array.isArray(p.pessoas) ? p.pessoas[0] : p.pessoas;
        return {
          id: p.id,
          nome: pessoa?.nome_completo || 'Sem Nome'
        };
      }).sort((a, b) => a.nome.localeCompare(b.nome));

      setEquipeParticipantes(sortedData);
    } catch {
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
    } catch {
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
    <div className="fade-in compras-camisetas-page">
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

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={() => setIsAddingOrder(true)} disabled={loading}>
            <Plus size={16} style={{ marginRight: '0.4rem' }} /> Novo Pedido
          </button>
          <button className="btn-secondary" onClick={handleCopySummary} disabled={loading}>
            <Copy size={16} style={{ marginRight: '0.4rem' }} /> Copiar resumo
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn-primary"
              onClick={() => setIsExportMenuOpen(open => !open)}
              disabled={loading}
              type="button"
            >
              <Download size={16} style={{ marginRight: '0.4rem' }} />
              Exportar
              <ChevronDown size={16} style={{ marginLeft: '0.4rem' }} />
            </button>
            {isExportMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 0.35rem)',
                  minWidth: '250px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.35rem',
                  zIndex: 20
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportSeparacaoExcel(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-color)',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Todos os pedidos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportSeparacaoExcel(true);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-color)',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Somente pedidos pagos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>


        {/* Informações de Pagamento PIX */}
        {encontroData?.pix_camisetas_chave && (
          <div style={{ marginBottom: '1.5rem' }}>
            <PixPaymentInfo
              chave={encontroData.pix_camisetas_chave}
              tipo={encontroData.pix_camisetas_tipo}
              qrCodeUrl={encontroData.pix_camisetas_qrcode_url}
              variant="compact"
            />
          </div>
        )}

        <CamisetaSeparationPanel
          teamItems={teamSeparationItems}
          encounteredItems={encounteredSeparationItems}
          loading={loading}
        />

        {/* Resumo por Equipe */}
        <section className="grid-container compras-team-filter-grid" style={{ marginBottom: '2rem' }}>
          {/* Card TOTAL GERAL */}
          <div
            className={`compras-team-filter-card ${selectedEquipeId === 'all' ? 'compras-team-filter-card--selected' : ''}`}
            style={{
              cursor: 'pointer',
            }}
            onClick={() => setSelectedEquipeId('all')}
          >
            <span className="badge badge-primary" style={{ fontSize: '1.1rem', padding: '0.2rem 0.6rem', marginBottom: '0.3rem' }}>
              {relatorioEquipes.reduce((acc, curr) => acc + curr.total_camisetas, 0)}
            </span>
            <h3 style={{ fontSize: '0.75rem', margin: '0 0 0.15rem 0', fontWeight: 700, textTransform: 'uppercase' }}>TODAS</h3>
            <p style={{ fontSize: '0.65rem', margin: '0 0 0.25rem 0', opacity: 0.6 }}>{relatorioEquipes.reduce((acc, curr) => acc + curr.total_pedidos, 0)} {relatorioEquipes.reduce((acc, curr) => acc + curr.total_pedidos, 0) === 1 ? 'pessoa' : 'pessoas'}</p>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-color)' }}>
              {(() => {
                const total = relatorioEquipes.reduce((acc, curr) => acc + curr.total_valor, 0);
                return total > 0 ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor a confirmar';
              })()}
            </span>
          </div>

          {relatorioEquipes.filter(r => r.total_camisetas > 0).map(r => {
            const comprovantes = r.comprovantes_camisetas_urls?.length
              ? r.comprovantes_camisetas_urls
              : r.comprovante_camisetas_url
                ? [r.comprovante_camisetas_url]
                : [];

            return (
              <div
                key={r.equipe_id}
                className={[
                  'compras-team-filter-card',
                  selectedEquipeId === r.equipe_id ? 'compras-team-filter-card--selected' : '',
                  comprovantes.length > 0 ? 'compras-team-filter-card--has-proof' : ''
                ].filter(Boolean).join(' ')}
                style={{
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onClick={() => setSelectedEquipeId(r.equipe_id)}
              >
                {comprovantes.length > 0 && (
                  <button
                    type="button"
                    className="compras-team-filter-card__proof-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setProofGallery({ equipeNome: r.equipe_nome, urls: comprovantes });
                    }}
                    title="Ver comprovantes"
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
                  {r.total_valor > 0 ? r.total_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor a confirmar'}
                </span>
              </div>
            );
          })}
        </section>


        {/* Listagem em Cards */}
        <div style={{ marginTop: '2rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Gerenciar pedidos das equipes</h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--muted-text)', fontSize: '0.8rem' }}>
                Adicione, ajuste ou remova os pedidos registrados pelos integrantes das equipes.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, justifyContent: 'flex-end', maxWidth: '600px', minWidth: '300px' }}>
              <div className="form-input-wrapper" style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: searchTerm ? '2.5rem' : '1rem', height: '38px', fontSize: '0.9rem' }}
                  placeholder="Buscar participante ou modelo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="btn-icon"
                    onClick={() => setSearchTerm('')}
                    style={{ backgroundColor: 'transparent', position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, margin: 0, padding: '4px' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                className="form-input"
                style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '0.9rem', padding: '0 0.75rem' }}
                value={selectedEquipeId}
                onChange={e => setSelectedEquipeId(e.target.value)}
              >
                <option value="all">Todas as Equipes</option>
                {equipes.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nome}</option>
                ))}
              </select>
            </div>
          </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{group.equipe_nome}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '999px',
                          background: group.pago_camiseta ? 'var(--success-bg)' : 'rgba(245,158,11,0.12)',
                          color: group.pago_camiseta ? 'var(--success-text)' : '#d97706',
                          fontSize: '0.68rem',
                          fontWeight: 800
                        }}>
                          {group.pago_camiseta && <CheckCircle size={12} />}
                          {group.pago_camiseta ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 700 }}>Total do Pedido</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary-color)' }}>
                        {group.total_valor > 0 ? group.total_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor a confirmar'}
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
                            {model.total_valor_modelo > 0 ? model.total_valor_modelo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor a confirmar'}
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
        {/* Galeria de comprovantes da equipe */}
        {proofGallery && (
          <PaymentProofGalleryModal
            title="Comprovantes de camisetas"
            entityName={proofGallery.equipeNome}
            urls={proofGallery.urls}
            onClose={() => setProofGallery(null)}
          />
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
