import { CheckSquare, ChevronLeft, FileText, Loader, Plus, Receipt, RefreshCw, ShoppingCart, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { CurrencyFormField } from '../../components/ui/CurrencyFormField';
import { FormField } from '../../components/ui/FormField';
import { MobileFileUploadButton } from '../../components/ui/MobileFileUploadButton';
import { useEncontros } from '../../contexts/EncontroContext';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import type { AlmoxarifadoCompra, AlmoxarifadoCompraItem, AlmoxarifadoCompraItemStatus } from '../../types/almoxarifado';
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
  status: AlmoxarifadoCompraItemStatus;
  quantidade_comprada: string;
  valor_unitario: number;
  mercado_fornecedor: string;
  observacoes: string;
}

const parseQuantity = (value: string) => Number(value.replace(',', '.') || 0);

export function AlmoxarifadoComprasOperacionalPage() {
  const navigate = useNavigate();
  const { encontroSelecionadoId } = useEncontros();
  const [compras, setCompras] = useState<AlmoxarifadoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, CompraItemDraft>>({});
  const [proofFiles, setProofFiles] = useState<File[]>([]);

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
    const aberta = compras.find((compra) => compra.status === 'aberta') || null;
    const itens = aberta?.itens || [];
    const total = itens.reduce((sum, item) => {
      const draft = itemDrafts[item.id];
      const quantidadeComprada = draft ? parseQuantity(draft.quantidade_comprada) : item.quantidade_comprada;
      const valorUnitario = draft ? draft.valor_unitario : item.valor_unitario;
      const status = draft ? draft.status : item.status;
      const shouldCount = status === 'comprou';

      return shouldCount ? sum + quantidadeComprada * valorUnitario : sum;
    }, 0);

    return {
      compraAberta: aberta,
      pendentes: itens.filter((item) => (itemDrafts[item.id]?.status || item.status) === 'pendente').length,
      comprados: itens.filter((item) => (itemDrafts[item.id]?.status || item.status) === 'comprou').length,
      total,
    };
  }, [compras, itemDrafts]);

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
      status: item.status,
      quantidade_comprada: String(item.quantidade_comprada || item.quantidade_a_comprar || 0),
      valor_unitario: item.valor_unitario || 0,
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

  const updatePurchaseDraft = (item: AlmoxarifadoCompraItem, patch: Partial<CompraItemDraft>) => {
    const nextDraft = {
      ...getDraft(item),
      ...patch,
    };
    const canKeepBought = parseQuantity(nextDraft.quantidade_comprada) > 0 && nextDraft.valor_unitario > 0;

    updateDraft(item, {
      ...patch,
      status: canKeepBought ? nextDraft.status : 'pendente',
    });
  };

  const handleFinalizeCompra = async () => {
    if (!compraAtual) return;
    if (saving) return;

    setSaving(true);
    setBusyItemId('finalizar');
    const uploadedProofReferences: string[] = [];

    try {
      for (const proofFile of proofFiles) {
        uploadedProofReferences.push(await almoxarifadoService.uploadComprovanteCompra(compraAtual.id, proofFile));
      }

      await almoxarifadoService.finalizarCompra(
        compraAtual.id,
        (compraAtual.itens || []).map((item) => {
          const draft = getDraft(item);
          const quantidadeComprada = parseQuantity(draft.quantidade_comprada);

          return {
            id: item.id,
            status: draft.status,
            quantidade_comprada: draft.status === 'comprou' ? quantidadeComprada : 0,
            valor_unitario: draft.status === 'comprou' ? draft.valor_unitario : 0,
            mercado_fornecedor: draft.mercado_fornecedor,
            observacoes: draft.observacoes,
          };
        }),
        uploadedProofReferences,
      );
      setItemDrafts({});
      setProofFiles([]);
      toast.success('Compra finalizada e lançada no financeiro.');
      await loadCompras();
    } catch (error) {
      await Promise.all(uploadedProofReferences.map((reference) =>
        almoxarifadoService.removerComprovanteCompra(reference).catch((storageError) => {
          console.error('Erro ao desfazer upload do comprovante:', storageError);
        }),
      ));
      console.error('Erro ao finalizar compra:', error);
      toast.error('Não foi possível finalizar a compra.');
    } finally {
      setSaving(false);
      setBusyItemId(null);
    }
  };

  const compraAtual = resumo.compraAberta;
  const diferencaNota = compraAtual?.valor_total_informado
    ? compraAtual.valor_total_informado - resumo.total
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

      </div>

      <section className="almox-summary-grid">
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><ShoppingCart size={22} /></span><div><span>Comprados</span><strong>{resumo.comprados}</strong></div></article>
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><Receipt size={22} /></span><div><span>Pendentes</span><strong>{resumo.pendentes}</strong></div></article>
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><Receipt size={22} /></span><div><span>Total calculado</span><strong>{money(resumo.total)}</strong></div></article>
      </section>

      <section className="card almox-toolbar almox-purchase-toolbar">
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
          {compraAtual && (
            <MobileFileUploadButton
              label="Comprovantes"
              className="btn-secondary almox-proof-button"
              disabled={saving}
              onFiles={(files) => setProofFiles((current) => [...current, ...files])}
            />
          )}
          <button type="button" className="btn-primary" onClick={handleCreateCompra} disabled={saving || Boolean(compraAtual)}>
            <Plus size={17} /> Gerar lista
          </button>
          {compraAtual && (
            <button type="button" className="btn-primary" onClick={handleFinalizeCompra} disabled={saving}>
              {saving ? <Loader className="animate-spin" size={17} /> : <CheckSquare size={17} />} Finalizar compra
            </button>
          )}
        </div>
      </section>

      {proofFiles.length > 0 && (
        <div className="almox-proof-chip">
          <FileText size={16} />
          <span>{proofFiles.length} comprovante(s) selecionado(s)</span>
          {proofFiles.some((file) => file.type.startsWith('image/')) && <small>Imagens serão otimizadas ao finalizar</small>}
          <button type="button" onClick={() => setProofFiles([])} disabled={saving} aria-label="Remover comprovantes selecionados">
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="card empty-state"><Loader className="animate-spin" /> Carregando lista...</div>
      ) : !compraAtual ? (
        <div className="card empty-state">Nenhuma lista de compras criada para este encontro.</div>
      ) : (
        <section className="almox-order-list">
          {compraAtual.itens?.map((item) => {
            const draft = getDraft(item);
            const itemTotal = parseQuantity(draft.quantidade_comprada) * draft.valor_unitario;
            const canMarkBought = parseQuantity(draft.quantidade_comprada) > 0 && draft.valor_unitario > 0;

            return (
              <article key={item.id} className="card almox-order-item almox-purchase-item">
                <label
                  className={`almox-row-checkbox ${saving || !!busyItemId || !canMarkBought ? 'almox-row-checkbox--disabled' : ''}`}
                  aria-label={item.status === 'comprou' ? 'Marcar como pendente' : 'Marcar como comprado'}
                  title={canMarkBought ? (item.status === 'comprou' ? 'Comprado' : 'Marcar como comprado') : 'Informe quantidade e valor unitário'}
                >
                  <input
                    type="checkbox"
                    checked={draft.status === 'comprou'}
                    disabled={saving || !!busyItemId || !canMarkBought}
                    onChange={(event) => updateDraft(item, { status: event.target.checked ? 'comprou' : 'pendente' })}
                  />
                  <span className="card-checkbox-indicator">
                    {draft.status === 'comprou' ? <CheckSquare size={22} /> : <Square size={22} />}
                  </span>
                </label>
                <div>
                  <strong>{item.item?.nome || 'Item'}</strong>
                  <small>{item.marca || item.item?.marca_preferida || 'Marca livre'} · {statusLabels[draft.status]}</small>
                </div>
                <div><span>A comprar</span><strong>{formatQuantity(item.quantidade_a_comprar, item.item?.unidade?.sigla)}</strong></div>
                <div className="almox-inline-field">
                  <FormField
                    label="Qtd."
                    name={`quantidade-comprada-${item.id}`}
                    type="number"
                    min="0"
                    step="0.001"
                    value={draft.quantidade_comprada}
                    disabled={saving || !!busyItemId}
                    onChange={(event) => updatePurchaseDraft(item, { quantidade_comprada: event.target.value })}
                  />
                </div>
                <div className="almox-inline-field">
                  <CurrencyFormField
                    label="Unitário"
                    name={`valor-unitario-${item.id}`}
                    value={draft.valor_unitario}
                    className="almox-inline-currency"
                    disabled={saving || !!busyItemId}
                    onChange={(value) => updatePurchaseDraft(item, { valor_unitario: value })}
                  />
                </div>
                <div className="almox-inline-field">
                  <FormField
                    label="Local da compra"
                    name={`mercado-fornecedor-${item.id}`}
                    value={draft.mercado_fornecedor}
                    disabled={saving || !!busyItemId}
                    onChange={(event) => updateDraft(item, { mercado_fornecedor: event.target.value })}
                  />
                </div>
                <div><span>Total</span><strong>{money(itemTotal)}</strong></div>
                {busyItemId === item.id && <Loader className="animate-spin" size={18} />}
              </article>
            );
          })}
        </section>
      )}

      {compraAtual && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Conferência</h3>
          <p className="text-muted">Total calculado: <strong>{money(resumo.total)}</strong></p>
          {compraAtual.valor_total_informado !== null && (
            <p className="text-muted">Diferença para nota: <strong>{money(diferencaNota)}</strong></p>
          )}
        </div>
      )}

    </section>
  );
}
