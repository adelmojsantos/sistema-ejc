import { ChevronLeft, Loader, PackagePlus, Plus, RefreshCw, Search, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormField } from '../../components/ui/FormField';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import type {
  AlmoxarifadoItem,
  AlmoxarifadoPedido,
  AlmoxarifadoPedidoFormData,
  AlmoxarifadoPedidoItemFormData,
  AlmoxarifadoPedidoPrioridade,
  AlmoxarifadoPedidoStatus,
} from '../../types/almoxarifado';
import type { Equipe } from '../../types/equipe';
import './AlmoxarifadoPage.css';

const pedidoFormInicial: AlmoxarifadoPedidoFormData = {
  encontro_id: '',
  solicitante_equipe_id: '',
  titulo: '',
  observacoes: '',
  observacao_origem: '',
};

const itemFormInicial: AlmoxarifadoPedidoItemFormData = {
  pedido_id: '',
  item_id: '',
  marca_preferida: '',
  quantidade_necessaria: 1,
  prioridade: 'normal',
  observacoes: '',
};

const statusLabels: Record<AlmoxarifadoPedidoStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  em_compra: 'Em compra',
  parcial: 'Parcial',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

const prioridadeLabels: Record<AlmoxarifadoPedidoPrioridade, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
};

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group standard-label-group">
      <label className="form-label standard-label">{label}</label>
      <select className="form-input standard-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  );
}

const formatQuantity = (value: number, sigla?: string | null) => {
  const formatted = value.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
  return `${formatted}${sigla ? ` ${sigla}` : ''}`;
};

const buildDefaultTitle = (equipeNome?: string | null) => {
  const date = new Date().toLocaleDateString('pt-BR');
  return `Pedido ${equipeNome || 'geral'} - ${date}`;
};

export function AlmoxarifadoPedidosPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { hasPermission } = useAuth();
  const canCreateForOthers =
    hasPermission('modulo_admin') ||
    hasPermission('modulo_compras') ||
    hasPermission('almoxarifado_pedidos_gerenciar');
  const encontroPadraoId = encontros.find((encontro) => encontro.ativo)?.id || encontros[0]?.id || '';
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const encontroSelecionadoId = selectedEncontroId || encontroPadraoId;
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [itens, setItens] = useState<AlmoxarifadoItem[]>([]);
  const [pedidos, setPedidos] = useState<AlmoxarifadoPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [equipeFiltro, setEquipeFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [pedidoCancelamento, setPedidoCancelamento] = useState<AlmoxarifadoPedido | null>(null);
  const [pedidoForm, setPedidoForm] = useState(pedidoFormInicial);
  const [itemForm, setItemForm] = useState(itemFormInicial);

  const loadBaseData = useCallback(async () => {
    try {
      const [equipesData, itensData] = await Promise.all([
        equipeService.listar(),
        almoxarifadoService.listarItens(),
      ]);
      setEquipes(equipesData);
      setItens(itensData);
    } catch (error) {
      console.error('Erro ao carregar cadastros de pedidos:', error);
      toast.error('Não foi possível carregar equipes e itens.');
    }
  }, []);

  const loadPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await almoxarifadoService.listarPedidos(encontroSelecionadoId, {
        busca,
        equipeId: equipeFiltro,
        status: statusFiltro,
      });
      setPedidos(statusFiltro ? data : data.filter((pedido) => pedido.status !== 'cancelado'));
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      toast.error('Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, [busca, encontroSelecionadoId, equipeFiltro, statusFiltro]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const resumo = useMemo(() => ({
    total: pedidos.length,
    enviados: pedidos.filter((pedido) => pedido.status === 'enviado' || pedido.status === 'em_compra').length,
    itensComprar: pedidos.reduce((sum, pedido) => sum + (pedido.itens || []).filter((item) => item.quantidade_a_comprar > 0).length, 0),
  }), [pedidos]);

  const openCreatePedido = () => {
    setPedidoForm({ ...pedidoFormInicial, encontro_id: encontroSelecionadoId });
    setPedidoModalOpen(true);
  };

  const handleCreatePedido = async (event: React.FormEvent) => {
    event.preventDefault();
    const equipe = equipes.find((current) => current.id === pedidoForm.solicitante_equipe_id);
    const titulo = pedidoForm.titulo.trim() || buildDefaultTitle(equipe?.nome);
    const observacaoOrigem = canCreateForOthers ? pedidoForm.observacao_origem : '';

    setSaving(true);
    try {
      await almoxarifadoService.criarPedido({
        ...pedidoForm,
        encontro_id: encontroSelecionadoId,
        titulo,
        observacao_origem: observacaoOrigem,
      });
      toast.success('Pedido criado.');
      setPedidoModalOpen(false);
      setPedidoForm(pedidoFormInicial);
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toast.error('Não foi possível criar o pedido.');
    } finally {
      setSaving(false);
    }
  };

  const openAddItem = (pedido: AlmoxarifadoPedido) => {
    setItemForm({ ...itemFormInicial, pedido_id: pedido.id });
    setItemModalOpen(true);
  };

  const handleAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.item_id || itemForm.quantidade_necessaria <= 0) {
      toast.error('Informe o item e a quantidade necessária.');
      return;
    }

    setSaving(true);
    try {
      await almoxarifadoService.adicionarItemPedido(itemForm);
      toast.success('Item adicionado e cruzado com o estoque.');
      setItemModalOpen(false);
      setItemForm(itemFormInicial);
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      toast.error('Não foi possível adicionar o item.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendPedido = async (pedido: AlmoxarifadoPedido) => {
    const actionKey = `send:${pedido.id}`;
    if (busyAction) return;
    setBusyAction(actionKey);
    setSaving(true);
    try {
      await almoxarifadoService.atualizarPedido(pedido.id, { status: 'enviado' });
      toast.success('Pedido enviado para compras.');
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast.error('Não foi possível enviar o pedido.');
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  };

  const handleRemoveItem = async (itemPedidoId: string) => {
    const actionKey = `remove-item:${itemPedidoId}`;
    if (busyAction) return;
    const itemPedido = pedidos.flatMap((pedido) => pedido.itens || []).find((item) => item.id === itemPedidoId);
    const relatedItem = itemPedido
      ? pedidos
        .filter((pedido) => ['rascunho', 'enviado', 'em_compra', 'parcial'].includes(pedido.status))
        .flatMap((pedido) => pedido.itens || [])
        .find((item) => item.id !== itemPedidoId && item.item_id === itemPedido.item_id)
      : null;

    setBusyAction(actionKey);
    setSaving(true);
    try {
      await almoxarifadoService.removerItemPedido(itemPedidoId);
      if (relatedItem) {
        await almoxarifadoService.recalcularPedidosRelacionados(relatedItem.id);
      }
      toast.success('Item removido do pedido.');
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao remover item:', error);
      toast.error('Não foi possível remover o item.');
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  };

  const handleCancelPedido = async () => {
    if (!pedidoCancelamento) return;
    const actionKey = `cancel:${pedidoCancelamento.id}`;
    if (busyAction) return;
    setBusyAction(actionKey);

    setSaving(true);
    try {
      const relatedItemIds = pedidoCancelamento.itens?.map((item) => item.id) || [];
      await almoxarifadoService.atualizarPedido(pedidoCancelamento.id, { status: 'cancelado' });
      await Promise.all(relatedItemIds.map((itemId) => almoxarifadoService.recalcularPedidosRelacionados(itemId)));
      toast.success('Pedido cancelado.');
      setPedidoCancelamento(null);
      await loadPedidos();
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      toast.error('Não foi possível cancelar o pedido.');
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  };

  const selectedItem = itens.find((item) => item.id === itemForm.item_id);

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras/almoxarifado')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Estoque / Almoxarifado</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Pedidos</h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Solicitações por equipe com cálculo automático do que já existe no estoque.
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
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><PackagePlus size={22} /></span><div><span>Pedidos</span><strong>{resumo.total}</strong></div></article>
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><Send size={22} /></span><div><span>Em andamento</span><strong>{resumo.enviados}</strong></div></article>
        <article className="almox-stat-card"><span className="almox-stat-card__icon"><PackagePlus size={22} /></span><div><span>Itens a comprar</span><strong>{resumo.itensComprar}</strong></div></article>
      </section>

      <section className="card almox-toolbar">
        <div className="almox-filters">
          <FormField label="Buscar pedido, equipe ou item" name="busca_pedidos" value={busca} onChange={(event) => setBusca(event.target.value)} icon={<Search size={18} />} floating={false} />
          <SelectField label="Equipe" value={equipeFiltro} onChange={setEquipeFiltro}>
            <option value="">Todas</option>
            {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
          </SelectField>
          <SelectField label="Status" value={statusFiltro} onChange={setStatusFiltro}>
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </SelectField>
        </div>
        <div className="almox-actions">
          <button type="button" className="btn-secondary" onClick={loadPedidos} disabled={loading}>
            {loading ? <Loader className="animate-spin" size={17} /> : <RefreshCw size={17} />} Atualizar
          </button>
          <button type="button" className="btn-primary" onClick={openCreatePedido}>
            <Plus size={17} /> Novo pedido
          </button>
        </div>
      </section>

      {loading ? (
        <div className="card empty-state"><Loader className="animate-spin" /> Carregando pedidos...</div>
      ) : pedidos.length === 0 ? (
        <div className="card empty-state">Nenhum pedido encontrado.</div>
      ) : (
        <section className="almox-order-list">
          {pedidos.map((pedido) => (
            <article key={pedido.id} className="card almox-order-card">
              <header>
                <div>
                  <span className="almox-badge">{statusLabels[pedido.status]}</span>
                  <h2>{pedido.titulo}</h2>
                  <p className="text-muted">{pedido.equipe?.nome || 'Uso geral'} · {(pedido.itens || []).length} item(ns)</p>
                </div>
                <div className="almox-actions">
                  <button type="button" className="btn-secondary" onClick={() => openAddItem(pedido)}>
                    <Plus size={16} /> Item
                  </button>
                  {pedido.status === 'rascunho' && (
                    <button type="button" className="btn-primary" onClick={() => handleSendPedido(pedido)} disabled={saving || !!busyAction}>
                      {busyAction === `send:${pedido.id}` ? <Loader className="animate-spin" size={16} /> : <Send size={16} />} Enviar
                    </button>
                  )}
                  {(pedido.status === 'rascunho' || pedido.status === 'enviado') && (
                    <button type="button" className="btn-secondary" onClick={() => setPedidoCancelamento(pedido)} disabled={saving || !!busyAction}>
                      Cancelar
                    </button>
                  )}
                </div>
              </header>

              {pedido.observacoes && <p className="text-muted">{pedido.observacoes}</p>}

              <div className="almox-order-items">
                {(pedido.itens || []).length === 0 ? (
                  <div className="empty-state">Adicione itens para calcular o que precisa comprar.</div>
                ) : (pedido.itens || []).map((item) => (
                  <div key={item.id} className="almox-order-item">
                    <div>
                      <strong>{item.item?.nome || 'Item'}</strong>
                      <small>{item.marca_preferida || item.item?.marca_preferida || 'Marca livre'} · Prioridade {prioridadeLabels[item.prioridade]}</small>
                    </div>
                    <div><span>Necessário</span><strong>{formatQuantity(item.quantidade_necessaria, item.item?.unidade?.sigla)}</strong></div>
                    <div><span>Disponível líquido</span><strong>{formatQuantity(item.quantidade_disponivel, item.item?.unidade?.sigla)}</strong></div>
                    <div><span>A comprar</span><strong>{formatQuantity(item.quantidade_a_comprar, item.item?.unidade?.sigla)}</strong></div>
                    <button type="button" className="icon-btn" onClick={() => handleRemoveItem(item.id)} disabled={saving || !!busyAction} aria-label="Remover item">
                      {busyAction === `remove-item:${item.id}` ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      <Modal isOpen={pedidoModalOpen} onClose={() => setPedidoModalOpen(false)} title="Novo pedido" maxWidth="680px">
        <form onSubmit={handleCreatePedido}>
          <div className="almox-form-grid">
            <SelectField label="Equipe solicitante" value={pedidoForm.solicitante_equipe_id} onChange={(value) => setPedidoForm({ ...pedidoForm, solicitante_equipe_id: value })}>
              <option value="">Uso geral</option>
              {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
            </SelectField>
            <FormField label="Nome do pedido (opcional)" name="pedido_titulo" value={pedidoForm.titulo} onChange={(event) => setPedidoForm({ ...pedidoForm, titulo: event.target.value })} floating={false} hint="Se deixar em branco, o sistema gera automaticamente." />
            {canCreateForOthers && (
              <div className="span-2">
                <FormField label="Origem/observação" name="observacao_origem" value={pedidoForm.observacao_origem} onChange={(event) => setPedidoForm({ ...pedidoForm, observacao_origem: event.target.value })} floating={false} hint="Use quando Compras/Admin lançar por outra equipe." />
              </div>
            )}
            <div className="span-2">
              <FormField label="Observações" name="pedido_observacoes" as="textarea" rows={3} value={pedidoForm.observacoes} onChange={(event) => setPedidoForm({ ...pedidoForm, observacoes: event.target.value })} floating={false} />
            </div>
          </div>
          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setPedidoModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Criar pedido'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={itemModalOpen} onClose={() => setItemModalOpen(false)} title="Adicionar item ao pedido" maxWidth="720px">
        <form onSubmit={handleAddItem}>
          <div className="almox-form-grid">
            <div className="span-2">
              <SelectField label="Item" value={itemForm.item_id} onChange={(value) => {
                const item = itens.find((current) => current.id === value);
                setItemForm({
                  ...itemForm,
                  item_id: value,
                  marca_preferida: item?.marca_preferida || itemForm.marca_preferida,
                });
              }}>
                <option value="">Selecione um item</option>
                {itens.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </SelectField>
            </div>
            <FormField label="Quantidade necessária" name="quantidade_necessaria" type="number" min="0.001" step="0.001" value={itemForm.quantidade_necessaria} onChange={(event) => setItemForm({ ...itemForm, quantidade_necessaria: Number(event.target.value) })} floating={false} required />
            <SelectField label="Prioridade" value={itemForm.prioridade} onChange={(value) => setItemForm({ ...itemForm, prioridade: value as AlmoxarifadoPedidoPrioridade })}>
              {Object.entries(prioridadeLabels).map(([prioridade, label]) => <option key={prioridade} value={prioridade}>{label}</option>)}
            </SelectField>
            <FormField label="Marca preferida" name="marca_preferida" value={itemForm.marca_preferida} onChange={(event) => setItemForm({ ...itemForm, marca_preferida: event.target.value })} floating={false} hint={selectedItem?.marca_preferida ? `Padrão: ${selectedItem.marca_preferida}` : undefined} />
            <div className="span-2">
              <FormField label="Observações" name="item_observacoes" as="textarea" rows={3} value={itemForm.observacoes} onChange={(event) => setItemForm({ ...itemForm, observacoes: event.target.value })} floating={false} />
            </div>
          </div>
          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setItemModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Calculando...' : 'Adicionar e calcular'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!pedidoCancelamento}
        title="Cancelar pedido"
        message={`Deseja cancelar o pedido "${pedidoCancelamento?.titulo || ''}"? Ele ficará no histórico e não seguirá para compras.`}
        confirmText="Cancelar pedido"
        cancelText="Voltar"
        onConfirm={handleCancelPedido}
        onCancel={() => setPedidoCancelamento(null)}
        isLoading={busyAction === `cancel:${pedidoCancelamento?.id}`}
        isConfirmDisabled={!!busyAction && busyAction !== `cancel:${pedidoCancelamento?.id}`}
        isDestructive
      />
    </section>
  );
}
