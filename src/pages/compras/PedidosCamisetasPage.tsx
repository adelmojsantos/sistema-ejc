import { CheckCircle, ChevronDown, ChevronLeft, ChevronUp, Copy, Download, FileText, Loader, Plus, Search, Shirt, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PixPaymentInfo } from '../../components/financeiro/PixPaymentInfo';
import { useEncontros } from '../../contexts/EncontroContext';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../lib/supabase';
import { camisetaService } from '../../services/camisetaService';
import { comprasService, type CamisetaEquipeReport, type IntencaoCamisetaDetalhe, type ResumoCamisetas, type ResumoIntencoes } from '../../services/comprasService';
import { equipeService } from '../../services/equipeService';
import type { CamisetaModelo, CamisetaTamanho } from '../../types/camiseta';
import type { Equipe } from '../../types/equipe';

type PedidoDetalhado = Awaited<ReturnType<typeof comprasService.listarPedidosDetalhados>>[number];
type DetailsConfig = {
  origem: 'pedido' | 'intencao';
  modeloId: string;
  tamanho: string;
  modeloNome: string;
};

const getProofType = (url: string) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|avif)$/.test(cleanUrl)) return 'image';
  if (cleanUrl.endsWith('.pdf')) return 'pdf';
  return 'file';
};

const getProofName = (url: string, index: number) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return name || `Comprovante ${index + 1}`;
  } catch {
    return `Comprovante ${index + 1}`;
  }
};

export function PedidosCamisetasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();

  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const encontroData = encontros.find(e => e.id === selectedEncontroId);
  const [pedidos, setPedidos] = useState<PedidoDetalhado[]>([]);
  const [resumo, setResumo] = useState<ResumoCamisetas[]>([]);
  const [relatorioEquipes, setRelatorioEquipes] = useState<CamisetaEquipeReport[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);

  const [selectedEquipeId, setSelectedEquipeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showResumo, setShowResumo] = useState(false);
  const [showIntencoes, setShowIntencoes] = useState(false);
  const [resumoIntencoes, setResumoIntencoes] = useState<ResumoIntencoes[]>([]);
  const [intencoesDetalhadas, setIntencoesDetalhadas] = useState<IntencaoCamisetaDetalhe[]>([]);
  const [viewDetailsConfig, setViewDetailsConfig] = useState<DetailsConfig | null>(null);
  const [showPaidIntentions, setShowPaidIntentions] = useState(false);
  const [paidIntentionsSearch, setPaidIntentionsSearch] = useState('');
  const [proofGallery, setProofGallery] = useState<{ equipeNome: string; urls: string[] } | null>(null);
  const [intencaoPaymentFilter, setIntencaoPaymentFilter] = useState<'todos' | 'pagos' | 'pendentes'>('todos');
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
    if (viewDetailsConfig || showPaidIntentions || proofGallery || isAddingOrder) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewDetailsConfig, showPaidIntentions, proofGallery, isAddingOrder]);

  useEffect(() => {
    setIntencaoPaymentFilter('todos');
  }, [viewDetailsConfig]);

  useEffect(() => {
    if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id ?? encontros[0].id);
    }
  }, [encontros, selectedEncontroId]);

  const loadData = useCallback(async () => {
    if (!selectedEncontroId) return;
    setLoading(true);
    try {
      const [pedData, resData, eqData, relEqData, modsData, tamsData, intData, intDetailsData] = await Promise.all([
        comprasService.listarPedidosDetalhados(selectedEncontroId),
        comprasService.listarResumoCamisetas(selectedEncontroId),
        equipeService.listar(),
        comprasService.listarRelatorioCamisetasPorEquipe(selectedEncontroId),
        camisetaService.listarModelos(selectedEncontroId),
        camisetaService.listarTamanhos(),
        comprasService.listarResumoIntencoes(selectedEncontroId).catch(() => [] as ResumoIntencoes[]),
        comprasService.listarDetalhesIntencoes(selectedEncontroId).catch(() => [] as IntencaoCamisetaDetalhe[])
      ]);
      setPedidos(pedData);
      setResumo(resData);
      setEquipes(eqData);
      setRelatorioEquipes(relEqData);
      setResumoIntencoes(intData);
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

  const detailsItems = useMemo(() => {
    if (!viewDetailsConfig) return [];

    if (viewDetailsConfig.origem === 'intencao') {
      return intencoesDetalhadas
        .filter(item => item.modelo_id === viewDetailsConfig.modeloId && item.tamanho === viewDetailsConfig.tamanho)
        .filter(item => intencaoPaymentFilter === 'todos'
          || (intencaoPaymentFilter === 'pagos' && item.pago)
          || (intencaoPaymentFilter === 'pendentes' && !item.pago))
        .sort((a, b) => a.encontrista_nome.localeCompare(b.encontrista_nome))
        .map(item => ({
          id: item.id,
          nome: item.encontrista_nome,
          referencia: item.dupla_nome ? `Visitado por ${item.dupla_nome}` : 'Dupla não informada',
          quantidade: item.quantidade,
          pago: item.pago,
          comprovante_url: item.comprovante_url,
          pago_em: item.pago_em
        }));
    }

    return pedidos
      .filter(p => p.modelo_id === viewDetailsConfig.modeloId && p.tamanho === viewDetailsConfig.tamanho)
      .sort((a, b) => a.pessoa_nome.localeCompare(b.pessoa_nome))
      .map(p => ({
        id: p.id,
        nome: p.pessoa_nome,
        referencia: p.dupla_visitante_nome ? `Visitado por ${p.dupla_visitante_nome}` : p.equipe_nome,
        quantidade: p.quantidade,
        pago: undefined,
        comprovante_url: null,
        pago_em: null
      }));
  }, [intencaoPaymentFilter, intencoesDetalhadas, pedidos, viewDetailsConfig]);

  const paidIntentions = useMemo(() => (
    intencoesDetalhadas
      .filter(item => item.pago)
      .sort((a, b) => {
        const nameCompare = a.encontrista_nome.localeCompare(b.encontrista_nome);
        return nameCompare !== 0 ? nameCompare : a.modelo_nome.localeCompare(b.modelo_nome);
      })
  ), [intencoesDetalhadas]);

  const filteredPaidIntentions = useMemo(() => {
    const normalizedSearch = paidIntentionsSearch.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedSearch) return paidIntentions;

    return paidIntentions.filter(item =>
      item.encontrista_nome.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    );
  }, [paidIntentions, paidIntentionsSearch]);

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

  const sanitizeSheetName = (name: string) => {
    const sanitized = name.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    return (sanitized || 'Equipe').slice(0, 31);
  };

  const handleExportTotaisExcel = () => {
    const getSizeOrder = (modeloId: string, tamanho: string) => {
      return tamanhosCamiseta.find(t => t.sigla === tamanho && (t.modelo_id === modeloId || !t.modelo_id))?.ordem ?? 999;
    };

    const makeKey = (modeloId: string, tamanho: string) => `${modeloId}__${tamanho}`;

    const totalsMap = new Map<string, {
      modelo_id: string;
      modelo_nome: string;
      tamanho: string;
      pedidos: number;
      intencoes: number;
    }>();

    pedidos.forEach(p => {
      const tamanho = p.tamanho || 'Não Informado';
      const key = makeKey(p.modelo_id, tamanho);
      if (!totalsMap.has(key)) {
        totalsMap.set(key, {
          modelo_id: p.modelo_id,
          modelo_nome: p.camiseta_modelos?.nome || 'Modelo não identificado',
          tamanho,
          pedidos: 0,
          intencoes: 0
        });
      }
      totalsMap.get(key)!.pedidos += p.quantidade;
    });

    intencoesDetalhadas.forEach(item => {
      const tamanho = item.tamanho || 'Não Informado';
      const key = makeKey(item.modelo_id, tamanho);
      if (!totalsMap.has(key)) {
        totalsMap.set(key, {
          modelo_id: item.modelo_id,
          modelo_nome: item.modelo_nome || 'Modelo não identificado',
          tamanho,
          pedidos: 0,
          intencoes: 0
        });
      }
      totalsMap.get(key)!.intencoes += item.quantidade;
    });

    const sortedTotals = Array.from(totalsMap.values()).sort((a, b) => {
      const modelCompare = a.modelo_nome.localeCompare(b.modelo_nome);
      if (modelCompare !== 0) return modelCompare;
      return getSizeOrder(a.modelo_id, a.tamanho) - getSizeOrder(b.modelo_id, b.tamanho);
    });

    const totalRows = sortedTotals.map(item => ({
      'Modelo': item.modelo_nome,
      'Tamanho': item.tamanho,
      'Equipes': item.pedidos,
      'Intenção encontristas': item.intencoes,
      'Total': item.pedidos + item.intencoes
    }));

    totalRows.push({
      'Modelo': 'TOTAL GERAL',
      'Tamanho': '',
      'Equipes': totalRows.reduce((sum, row) => sum + row.Equipes, 0),
      'Intenção encontristas': totalRows.reduce((sum, row) => sum + row['Intenção encontristas'], 0),
      'Total': totalRows.reduce((sum, row) => sum + row.Total, 0)
    });

    const wb = XLSX.utils.book_new();
    const wsTotais = XLSX.utils.json_to_sheet(totalRows);
    wsTotais['!cols'] = [
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
      { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(wb, wsTotais, 'Total Geral');

    const pedidosPorEquipe = new Map<string, PedidoDetalhado[]>();
    pedidos.forEach(p => {
      const equipeNome = p.equipe_nome || 'Sem Equipe';
      if (!pedidosPorEquipe.has(equipeNome)) pedidosPorEquipe.set(equipeNome, []);
      pedidosPorEquipe.get(equipeNome)!.push(p);
    });

    Array.from(pedidosPorEquipe.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([equipeNome, teamPedidos], index) => {
        const teamMap = new Map<string, {
          modelo_id: string;
          modelo_nome: string;
          tamanho: string;
          quantidade: number;
        }>();

        teamPedidos.forEach(p => {
          const tamanho = p.tamanho || 'Não Informado';
          const key = makeKey(p.modelo_id, tamanho);
          if (!teamMap.has(key)) {
            teamMap.set(key, {
              modelo_id: p.modelo_id,
              modelo_nome: p.camiseta_modelos?.nome || 'Modelo não identificado',
              tamanho,
              quantidade: 0
            });
          }
          teamMap.get(key)!.quantidade += p.quantidade;
        });

        const teamRows = Array.from(teamMap.values())
          .sort((a, b) => {
            const modelCompare = a.modelo_nome.localeCompare(b.modelo_nome);
            if (modelCompare !== 0) return modelCompare;
            return getSizeOrder(a.modelo_id, a.tamanho) - getSizeOrder(b.modelo_id, b.tamanho);
          })
          .map(item => ({
            'Modelo': item.modelo_nome,
            'Tamanho': item.tamanho,
            'Quantidade': item.quantidade
          }));

        teamRows.push({
          'Modelo': 'TOTAL',
          'Tamanho': '',
          'Quantidade': teamRows.reduce((sum, row) => sum + row.Quantidade, 0)
        });

        const sheetName = sanitizeSheetName(equipeNome) || `Equipe ${index + 1}`;
        const uniqueSheetName = wb.SheetNames.includes(sheetName)
          ? sanitizeSheetName(`${sheetName} ${index + 1}`)
          : sheetName;
        const wsEquipe = XLSX.utils.json_to_sheet(teamRows);
        XLSX.utils.book_append_sheet(wb, wsEquipe, uniqueSheetName);
      });

    XLSX.writeFile(wb, `camisetas_total_geral_e_por_equipes_${new Date().getTime()}.xlsx`);
  };

  const handleExportPedidosPorEquipeExcel = () => {
    const sortPedidos = (a: PedidoDetalhado, b: PedidoDetalhado) => {
      const equipeCompare = (a.equipe_nome || 'Sem Equipe').localeCompare(b.equipe_nome || 'Sem Equipe');
      if (equipeCompare !== 0) return equipeCompare;
      const pessoaCompare = (a.pessoa_nome || '').localeCompare(b.pessoa_nome || '');
      if (pessoaCompare !== 0) return pessoaCompare;
      const modeloCompare = (a.camiseta_modelos?.nome || '').localeCompare(b.camiseta_modelos?.nome || '');
      if (modeloCompare !== 0) return modeloCompare;
      return a.tamanho.localeCompare(b.tamanho);
    };

    const data = [...pedidos].sort(sortPedidos).map(p => ({
        'Equipe': p.equipe_nome || 'Sem Equipe',
        'Pessoa': p.pessoa_nome,
        'Modelo': p.camiseta_modelos?.nome || 'Modelo não identificado',
        'Tamanho': p.tamanho,
        'Quantidade': p.quantidade
      }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 24 },
      { wch: 34 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 }
    ];
    if (data.length > 0) {
      ws['!autofilter'] = { ref: `A1:E${data.length + 1}` };
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Todos os pedidos');

    const pedidosPorEquipe = new Map<string, PedidoDetalhado[]>();
    pedidos.forEach(p => {
      const equipeNome = p.equipe_nome || 'Sem Equipe';
      if (!pedidosPorEquipe.has(equipeNome)) pedidosPorEquipe.set(equipeNome, []);
      pedidosPorEquipe.get(equipeNome)!.push(p);
    });

    Array.from(pedidosPorEquipe.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([equipeNome, teamPedidos], index) => {
        const teamRows = [...teamPedidos].sort(sortPedidos).map(p => ({
          'Pessoa': p.pessoa_nome,
          'Modelo': p.camiseta_modelos?.nome || 'Modelo não identificado',
          'Tamanho': p.tamanho,
          'Quantidade': p.quantidade
        }));

        const sheetName = sanitizeSheetName(equipeNome) || `Equipe ${index + 1}`;
        const uniqueSheetName = wb.SheetNames.includes(sheetName)
          ? sanitizeSheetName(`${sheetName} ${index + 1}`)
          : sheetName;
        const wsEquipe = XLSX.utils.json_to_sheet(teamRows);
        wsEquipe['!cols'] = [
          { wch: 34 },
          { wch: 18 },
          { wch: 12 },
          { wch: 12 }
        ];
        if (teamRows.length > 0) {
          wsEquipe['!autofilter'] = { ref: `A1:D${teamRows.length + 1}` };
        }
        XLSX.utils.book_append_sheet(wb, wsEquipe, uniqueSheetName);
      });

    XLSX.writeFile(wb, `camisetas_pedidos_por_equipe_${new Date().getTime()}.xlsx`);
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

  const handleDownloadProof = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download indisponível');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = getProofName(url, index);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadAllProofs = async () => {
    if (!proofGallery) return;

    for (const [index, url] of proofGallery.urls.entries()) {
      await handleDownloadProof(url, index);
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
            <Copy size={16} style={{ marginRight: '0.4rem' }} /> Copiar
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
                    handleExportTotaisExcel();
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
                  Total Geral e Por Equipes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    handleExportPedidosPorEquipeExcel();
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
                  Pedidos por Equipe
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

        {/* Resumo de Pedidos */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{
            border: '1px solid rgba(37, 99, 235, 0.22)',
            borderRadius: '14px',
            backgroundColor: 'rgba(37, 99, 235, 0.04)',
            overflow: 'hidden'
          }}>
          <button
            className="compras-summary-trigger"
            onClick={() => setShowResumo(!showResumo)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              cursor: 'pointer',
              backgroundColor: 'rgba(37, 99, 235, 0.05)',
              border: 'none',
              borderRadius: 0,
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.05)'}
          >
            <div className="compras-summary-trigger__main">
              <div className="compras-summary-trigger__icon" style={{ backgroundColor: 'var(--primary-color)' }}>
                <Shirt size={20} />
              </div>
              <div className="compras-summary-trigger__content">
                <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-color)', fontWeight: 600 }}>
                  Resumo de Pedidos (Equipes)
                </h2>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, marginTop: '2px' }}>
                  {showResumo ? 'Clique para ocultar o quadro de totais' : 'Clique para expandir e ver o total de produção por modelo e tamanho'}
                </p>
              </div>
            </div>
            <div className="compras-summary-trigger__action" style={{ color: 'var(--primary-color)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                {showResumo ? 'Ocultar' : 'Expandir'}
              </span>
              {showResumo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showResumo && (
            <div className="grid-container animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', padding: '1rem', borderTop: '1px solid rgba(37, 99, 235, 0.14)' }}>
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
                          onClick={() => setViewDetailsConfig({ origem: 'pedido', modeloId: m.modelo_id, tamanho: tam, modeloNome: m.modelo_nome })}
                          title="Ver quem fez este pedido formal"
                          style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--surface-1)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                          <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>{tam}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{qtd}</div>
                        </div>
                      ))}
                  </div>
                  <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Valor Unit.: {m.valor_unitario > 0 ? m.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor a confirmar'}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                      Total: {m.valor_total > 0 ? m.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Valor a confirmar'}
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
          </div>
        </section>

        {/* ---- INTENÇÕES DE VISITA ---- */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div style={{
            border: '1px solid rgba(99, 102, 241, 0.24)',
            borderRadius: '14px',
            backgroundColor: 'rgba(99, 102, 241, 0.04)',
            overflow: 'hidden'
          }}>
          <button
            className="compras-summary-trigger"
            onClick={() => setShowIntencoes(!showIntencoes)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              cursor: 'pointer',
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              border: 'none',
              borderRadius: 0,
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.05)'}
          >
            <div className="compras-summary-trigger__main">
              <div className="compras-summary-trigger__icon" style={{ backgroundColor: '#6366f1' }}>
                <Shirt size={20} />
              </div>
              <div className="compras-summary-trigger__content">
                <h2 className="compras-summary-trigger__title-with-badges" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-color)', fontWeight: 600 }}>
                  Intenções de Compra (Encontristas)
                  {resumoIntencoes.length > 0 && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      background: '#6366f1', color: 'white', padding: '2px 8px', borderRadius: '999px'
                    }}>
                      {resumoIntencoes.reduce((s, m) => s + m.total, 0)} un. estimadas
                    </span>
                  )}
                  {intencoesDetalhadas.some(item => item.pago) && (
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      background: 'rgba(22,163,74,0.12)', color: '#16a34a', padding: '2px 8px', borderRadius: '999px'
                    }}>
                      {intencoesDetalhadas.filter(item => item.pago).reduce((sum, item) => sum + item.quantidade, 0)} un. pagas
                    </span>
                  )}
                </h2>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, marginTop: '2px' }}>
                  Estimativa coletada durante as visitas — não são pedidos formais
                </p>
              </div>
            </div>
            <div className="compras-summary-trigger__action" style={{ color: '#6366f1' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                {showIntencoes ? 'Ocultar' : 'Expandir'}
              </span>
              {showIntencoes ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showIntencoes && (
            <div style={{ padding: '1rem', borderTop: '1px solid rgba(99, 102, 241, 0.16)' }}>
              {paidIntentions.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPaidIntentions(true)}
                  style={{
                    border: '1px solid rgba(22,163,74,0.35)',
                    background: 'rgba(22,163,74,0.1)',
                    color: '#16a34a',
                    borderRadius: '8px',
                    padding: '0.55rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <CheckCircle size={16} />
                  Ver todas as pagas ({paidIntentions.length})
                </button>
              </div>
              )}
              {resumoIntencoes.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                  Nenhuma intenção registrada nas visitas deste encontro.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {resumoIntencoes.map(m => (
                    <div key={m.modelo_id} className="card" style={{ padding: '1.25rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Shirt size={16} color="#6366f1" />
                          <h3 style={{ fontSize: '1rem', margin: 0 }}>{m.modelo_nome}</h3>
                        </div>
                        <span style={{
                          fontSize: '0.8rem', fontWeight: 700, padding: '3px 10px',
                          background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '999px'
                        }}>
                          {m.total} estimadas
                        </span>
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
                              onClick={() => setViewDetailsConfig({ origem: 'intencao', modeloId: m.modelo_id, tamanho: tam, modeloNome: m.modelo_nome })}
                              title="Ver quem informou esta intenção"
                              style={{
                              textAlign: 'center', padding: '0.5rem',
                              background: 'rgba(99,102,241,0.06)',
                              border: '1px solid rgba(99,102,241,0.15)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}>
                              <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>{tam}</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#6366f1' }}>{qtd}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </section>

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
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Listagem de Pedidos</h2>

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
          <div className="modal-overlay compras-proof-gallery-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-content animate-fade-in compras-proof-gallery">
              <div className="modal-header compras-proof-gallery__header">
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Comprovantes de camisetas</h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.62 }}>
                    {proofGallery.equipeNome} · {proofGallery.urls.length} comprovante(s)
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {proofGallery.urls.length > 1 && (
                    <button type="button" className="btn-secondary compras-proof-gallery__download-all" onClick={handleDownloadAllProofs}>
                      <Download size={16} /> <span>Baixar todos</span>
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => setProofGallery(null)} style={{ margin: 0, display: 'flex' }}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="modal-body">
                <div className="compras-proof-gallery__grid">
                  {proofGallery.urls.map((url, index) => {
                    const proofType = getProofType(url);
                    const proofName = getProofName(url, index);

                    return (
                      <article key={`${url}-${index}`} className="compras-proof-gallery__item">
                        <div className="compras-proof-gallery__preview">
                          {proofType === 'image' ? (
                            <img src={url} alt={`Prévia do comprovante ${index + 1}`} />
                          ) : proofType === 'pdf' ? (
                            <iframe src={url} title={`Prévia do comprovante ${index + 1}`} />
                          ) : (
                            <div className="compras-proof-gallery__file-placeholder">
                              <FileText size={38} />
                              <span>Prévia indisponível</span>
                            </div>
                          )}
                        </div>
                        <div className="compras-proof-gallery__item-footer">
                          <div title={proofName}>
                            <strong>Comprovante {index + 1}</strong>
                            <span>{proofName}</span>
                          </div>
                          <div className="compras-proof-gallery__actions">
                            <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">
                              <FileText size={15} /> Ver
                            </a>
                            <button type="button" className="btn-secondary" onClick={() => handleDownloadProof(url, index)}>
                              <Download size={15} /> Baixar
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Modal de todas as intenções pagas */}
        {showPaidIntentions && (
          <div className="modal-overlay compras-paid-modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-content animate-fade-in compras-paid-modal">
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Camisetas pagas</h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.62 }}>
                    {paidIntentions.length} intenções pagas.
                  </p>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => {
                    setShowPaidIntentions(false);
                    setPaidIntentionsSearch('');
                  }}
                  style={{ margin: 0, display: 'flex' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <Search
                    size={17}
                    style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.55 }}
                  />
                  <input
                    type="search"
                    className="form-input"
                    value={paidIntentionsSearch}
                    onChange={event => setPaidIntentionsSearch(event.target.value)}
                    placeholder="Buscar por nome"
                    autoFocus
                    style={{ paddingLeft: '2.4rem' }}
                  />
                </div>
                {paidIntentionsSearch.trim() && (
                  <div style={{ fontSize: '0.75rem', opacity: 0.62, marginBottom: '0.75rem' }}>
                    {filteredPaidIntentions.length} resultado(s) encontrado(s)
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredPaidIntentions.length === 0 ? (
                    <div className="compras-paid-modal__empty">
                      Nenhuma camiseta paga encontrada para este nome.
                    </div>
                  ) : filteredPaidIntentions.map(item => (
                    <div
                      key={item.id}
                      className="compras-paid-modal__item"
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{item.encontrista_nome}</div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '0.15rem' }}>
                          {item.modelo_nome} · Tamanho {item.tamanho}
                        </div>
                        {item.comprovante_url && (
                          <a
                            href={item.comprovante_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            <FileText size={14} /> Ver recibo
                          </a>
                        )}
                      </div>
                      <span className="badge badge-primary" style={{ flexShrink: 0 }}>
                        {item.quantidade} un
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Modal de Detalhes do Resumo */}
        {viewDetailsConfig && (
          <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="modal-content animate-fade-in" style={{ maxWidth: '560px', width: '95%' }}>
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
                    {viewDetailsConfig.modeloNome} <span style={{ opacity: 0.6 }}>&ndash;</span> {viewDetailsConfig.tamanho}
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.62 }}>
                    {viewDetailsConfig.origem === 'intencao'
                      ? 'Encontristas que informaram intenção durante a visita'
                      : 'Participantes com pedido formal registrado'}
                  </p>
                </div>
                <button className="btn-icon" onClick={() => setViewDetailsConfig(null)} style={{ margin: 0, display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {viewDetailsConfig.origem === 'intencao' && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {([
                      ['todos', 'Todos'],
                      ['pagos', 'Pagos'],
                      ['pendentes', 'Pendentes']
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setIntencaoPaymentFilter(value)}
                        style={{
                          border: `1px solid ${intencaoPaymentFilter === value ? '#6366f1' : 'var(--border-color)'}`,
                          background: intencaoPaymentFilter === value ? 'rgba(99,102,241,0.12)' : 'var(--card-bg)',
                          color: intencaoPaymentFilter === value ? '#6366f1' : 'var(--text-color)',
                          borderRadius: '8px', padding: '0.45rem 0.75rem',
                          cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detailsItems.length === 0 ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
                      Nenhum registro encontrado para este tamanho.
                    </div>
                  ) : (
                    detailsItems.map(item => (
                      <div key={item.id} className="card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.nome}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{item.referencia}</div>
                          {viewDetailsConfig.origem === 'intencao' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{
                                display: 'flex', alignItems: 'center', gap: '0.25rem',
                                fontSize: '0.72rem', fontWeight: 700,
                                color: item.pago ? '#16a34a' : '#d97706'
                              }}>
                                {item.pago && <CheckCircle size={13} />}
                                {item.pago ? 'Pago' : 'Pagamento pendente'}
                              </span>
                              {item.comprovante_url && (
                                <a
                                  href={item.comprovante_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}
                                >
                                  <FileText size={13} /> Ver comprovante
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="badge badge-primary" style={{ flexShrink: 0 }}>
                          {item.quantidade} un
                        </span>
                      </div>
                    ))
                  )}
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
