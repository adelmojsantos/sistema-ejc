import { ChevronLeft, Loader, Plus, Receipt, RefreshCw, ShoppingCart } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useEncontros } from '../../contexts/EncontroContext';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import { encontroService } from '../../services/encontroService';
import type { AlmoxarifadoCompra, AlmoxarifadoCompraItem, AlmoxarifadoCompraItemStatus } from '../../types/almoxarifado';
import { formatFinancialWithSymbol, parseCurrency, parseToDigits, toCentString } from '../../utils/currencyUtils';
import './AlmoxarifadoPage.css';

const money = (value: number | null | undefined) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatQuantity = (value: number, sigla?: string | null) => {
  const formatted = value.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
  return `${formatted}${sigla ? ` ${sigla}` : ''}`;
};

const statusLabels: Record<AlmoxarifadoCompraItemStatus, string> = {
  pendente: 'Pendente',
  comprou: 'Comprou',
  nao_comprou: 'Não comprou',
};

interface CompraItemDraft {
  quantidade_comprada: string;
  valor_unitario: string;
  mercado_fornecedor: string;
  observacoes: string;
}

export function AlmoxarifadoComprasOperacionalPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const encontroPadraoId = encontros.find((encontro) => encontro.ativo)?.id || encontros[0]?.id || '';
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const encontroSelecionadoId = selectedEncontroId || encontroPadraoId;
  const [compras, setCompras] = useState<AlmoxarifadoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, CompraItemDraft>>({});

  const loadCompras = useCallback(async () => {
    setLoading(true);
    try {
      setCompras(await almoxarifadoService.listarCompras(encontroSelecionadoId));
    } catch (error) {
      console.error('Erro ao carregar compras:', error);
      toast.error('Não foi possível carregar a lista de compras.');
    } finally {
      setLoading(false);
    }
  }, [encontroSelecionadoId]);

  useEffect(() => {
    loadCompras();
  }, [loadCompras]);

  const resumo = useMemo(() => {
    const aberta = compras.find((compra) => compra.status === 'aberta') || compras[0] || null;
    const itens = aberta?.itens || [];
    return {
      compraAberta: aberta,
      pendentes: itens.filter((item) => item.status === 'pendente').length,
      comprados: itens.filter((item) => item.status === 'comprou').length,
      total: aberta?.valor_total_calculado || 0,
    };
  }, [compras]);

  const handleCreateCompra = async () => {
    if (!encontroSelecionadoId) {
      toast.error('Selecione um encontro.');
      return;
    }

    setSaving(true);
    try {
      const compra = await almoxarifadoService.criarCompraDePedidos(encontroSelecionadoId);
      if (!compra.itens?.length) {
        toast('Nenhum item a comprar encontrado nos pedidos enviados.');
      } else {
        toast.success('Lista de compras criada.');
      }
      await loadCompras();
    } catch (error) {
      console.error('Erro ao criar lista de compras:', error);
      toast.error('Não foi possível criar a lista de compras.');
    } finally {
      setSaving(false);
    }
  };

  const getDraft = (item: AlmoxarifadoCompraItem): CompraItemDraft => {
    return itemDrafts[item.id] || {
      quantidade_comprada: String(item.quantidade_comprada || item.quantidade_a_comprar || 0),
      valor_unitario: formatFinancialWithSymbol(toCentString(item.valor_unitario || 0)),
      mercado_fornecedor: item.mercado_fornecedor || '',
      observacoes: item.observacoes || '',
    };
  };

  const updateDraft = (item: AlmoxarifadoCompraItem, patch: Partial<CompraItemDraft>) => {
    setItemDrafts((current) => ({
      ...current,
      [item.id]: {
        ...getDraft(item),
        ...patch,
      },
    }));
  };

  const saveInlineItem = async (
    item: AlmoxarifadoCompraItem,
    patch: Partial<{
      status: AlmoxarifadoCompraItemStatus;
      quantidade_comprada: number;
      valor_unitario: number;
      mercado_fornecedor: string;
      observacoes: string;
    }> = {},
  ) => {
    if (busyItemId) return;

    const draft = getDraft(item);
    const nextQuantidade = patch.quantidade_comprada ?? Number(draft.quantidade_comprada || 0);
    const nextValor = patch.valor_unitario ?? parseCurrency(draft.valor_unitario);
    const shouldAutoMarkAsBought =
      patch.status === undefined
      && (patch.quantidade_comprada !== undefined || patch.valor_unitario !== undefined)
      && nextQuantidade > 0
      && nextValor > 0;
    const nextStatus = patch.status ?? (shouldAutoMarkAsBought ? 'comprou' : item.status);

    setBusyItemId(item.id);
    setSaving(true);
    try {
      await almoxarifadoService.atualizarCompraItem(item.id, {
        status: nextStatus,
        quantidade_comprada: nextStatus === 'comprou' ? nextQuantidade : 0,
        valor_unitario: nextStatus === 'comprou' ? nextValor : 0,
        mercado_fornecedor: patch.mercado_fornecedor ?? draft.mercado_fornecedor,
        observacoes: patch.observacoes ?? draft.observacoes,
      });
      toast.success('Item atualizado.');
      await loadCompras();
    } catch (error) {
      console.error('Erro ao atualizar item da compra:', error);
      toast.error('Não foi possível atualizar o item.');
    } finally {
      setSaving(false);
      setBusyItemId(null);
    }
  };

  const compraAtual = resumo.compraAberta;
  const diferencaNota = compraAtual?.valor_total_informado
    ? compraAtual.valor_total_informado - compraAtual.valor_total_calculado
    : null;

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras/almoxarifado')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Estoque / Almoxarifado</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Lista de Compras</h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Checklist operacional com valor por item e total da compra.
            </p>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <LiveSearchSelect
            value={encontroSelecionadoId}
            onChange={val => setSelectedEncontroId(val)}
            fetchData={async (s, p) => await encontroService.buscarComPaginacao(s, p)}
            getOptionLabel={e => e.nome}
            getOptionValue={e => e.id}
            initialOptions={encontros}
          />
        </div>
      </div>

      <section className="almox-summary-grid">
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><ShoppingCart size={22} /></span><div><span>Comprados</span><strong>{resumo.comprados}</strong></div></article>
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><Receipt size={22} /></span><div><span>Pendentes</span><strong>{resumo.pendentes}</strong></div></article>
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><Receipt size={22} /></span><div><span>Total calculado</span><strong>{money(resumo.total)}</strong></div></article>
      </section>

      <section className="card almox-toolbar">
        <div>
          <strong>{compraAtual ? `Compra ${compraAtual.status}` : 'Nenhuma lista aberta'}</strong>
          <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
            {compraAtual ? `${compraAtual.itens?.length || 0} item(ns) nesta lista` : 'Crie uma lista a partir dos pedidos enviados.'}
          </p>
        </div>
        <div className="almox-actions">
          <button type="button" className="btn-secondary" onClick={loadCompras} disabled={loading}>
            {loading ? <Loader className="animate-spin" size={17} /> : <RefreshCw size={17} />} Atualizar
          </button>
          <button type="button" className="btn-primary" onClick={handleCreateCompra} disabled={saving}>
            <Plus size={17} /> Gerar lista
          </button>
        </div>
      </section>

      {loading ? (
        <div className="card empty-state"><Loader className="animate-spin" /> Carregando lista...</div>
      ) : !compraAtual ? (
        <div className="card empty-state">Nenhuma lista de compras criada para este encontro.</div>
      ) : (
        <section className="almox-order-list">
          {compraAtual.itens?.map((item) => (
            <article key={item.id} className="card almox-order-item almox-purchase-item">
              <div>
                <strong>{item.item?.nome || 'Item'}</strong>
                <small>{item.marca || item.item?.marca_preferida || 'Marca livre'} · {statusLabels[item.status]}</small>
              </div>
              <div><span>A comprar</span><strong>{formatQuantity(item.quantidade_a_comprar, item.item?.unidade?.sigla)}</strong></div>
              <label className="almox-check-option">
                <input
                  type="checkbox"
                  checked={item.status === 'comprou'}
                  disabled={saving || !!busyItemId}
                  onChange={(event) => saveInlineItem(item, { status: event.target.checked ? 'comprou' : 'pendente' })}
                />
                Comprou
              </label>
              <label className="almox-check-option">
                <input
                  type="checkbox"
                  checked={item.status === 'nao_comprou'}
                  disabled={saving || !!busyItemId}
                  onChange={(event) => saveInlineItem(item, { status: event.target.checked ? 'nao_comprou' : 'pendente' })}
                />
                Não comprou
              </label>
              <div className="almox-inline-field">
                <span>Qtd.</span>
                <input
                  className="form-input standard-input"
                  type="number"
                  min="0"
                  step="0.001"
                  value={getDraft(item).quantidade_comprada}
                  disabled={saving || !!busyItemId}
                  onChange={(event) => updateDraft(item, { quantidade_comprada: event.target.value })}
                  onBlur={() => saveInlineItem(item, { quantidade_comprada: Number(getDraft(item).quantidade_comprada || 0) })}
                />
              </div>
              <div className="almox-inline-field">
                <span>Unitário</span>
                <input
                  className="form-input standard-input"
                  type="tel"
                  value={getDraft(item).valor_unitario}
                  disabled={saving || !!busyItemId}
                  onChange={(event) => {
                    const digits = parseToDigits(event.target.value);
                    if (digits.length > 12) return;
                    updateDraft(item, { valor_unitario: formatFinancialWithSymbol(digits) });
                  }}
                  onBlur={() => saveInlineItem(item, { valor_unitario: parseCurrency(getDraft(item).valor_unitario) })}
                />
              </div>
              <div className="almox-inline-field">
                <span>Mercado</span>
                <input
                  className="form-input standard-input"
                  value={getDraft(item).mercado_fornecedor}
                  disabled={saving || !!busyItemId}
                  onChange={(event) => updateDraft(item, { mercado_fornecedor: event.target.value })}
                  onBlur={() => saveInlineItem(item, { mercado_fornecedor: getDraft(item).mercado_fornecedor })}
                />
              </div>
              <div><span>Total</span><strong>{money(item.valor_total)}</strong></div>
              {busyItemId === item.id && <Loader className="animate-spin" size={18} />}
            </article>
          ))}
        </section>
      )}

      {compraAtual && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Conferência</h3>
          <p className="text-muted">Total calculado: <strong>{money(compraAtual.valor_total_calculado)}</strong></p>
          {compraAtual.valor_total_informado !== null && (
            <p className="text-muted">Diferença para nota: <strong>{money(diferencaNota)}</strong></p>
          )}
        </div>
      )}

    </section>
  );
}
