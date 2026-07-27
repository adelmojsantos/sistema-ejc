import { ChevronLeft, ClipboardList, Loader, Package, Plus, RefreshCw, Search, SlidersHorizontal, Warehouse } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AlmoxarifadoCategoriaModal, type CategoriaFormState } from '../../components/almoxarifado/AlmoxarifadoCategoriaModal';
import { AlmoxarifadoItemModal } from '../../components/almoxarifado/AlmoxarifadoItemModal';
import { AlmoxarifadoUnidadeModal, type UnidadeFormState } from '../../components/almoxarifado/AlmoxarifadoUnidadeModal';
import { FormField } from '../../components/ui/FormField';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import type {
  AlmoxarifadoCategoria,
  AlmoxarifadoItem,
  AlmoxarifadoItemFormData,
  AlmoxarifadoMovimentacaoTipo,
  AlmoxarifadoSaldo,
  AlmoxarifadoSaldoFormData,
  AlmoxarifadoUnidade,
} from '../../types/almoxarifado';
import type { Equipe } from '../../types/equipe';
import './AlmoxarifadoPage.css';

const itemFormInicial: AlmoxarifadoItemFormData = {
  nome: '',
  categoria_id: '',
  unidade_id: '',
  equipe_padrao_id: '',
  marca_preferida: '',
  fornecedor_padrao: '',
};

const saldoFormInicial: AlmoxarifadoSaldoFormData = {
  encontro_id: '',
  item_id: '',
  equipe_id: '',
  marca: '',
  fornecedor: '',
  quantidade: 0,
  data_validade: '',
  observacoes: '',
};

const movimentoInicial = {
  saldo_id: '',
  tipo: 'entrada' as AlmoxarifadoMovimentacaoTipo,
  quantidade: 1,
  motivo: '',
};

const formatQuantity = (value: number, sigla?: string | null) => {
  const formatted = value.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
  return `${formatted}${sigla ? ` ${sigla}` : ''}`;
};

const formatDate = (date?: string | null) => {
  if (!date) return 'Sem validade';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
};

const daysUntil = (date?: string | null) => {
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(year, month - 1, day).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
};

function validityBadge(date?: string | null) {
  const days = daysUntil(date);
  if (days === null) return <span className="almox-muted">Sem validade</span>;
  if (days < 0) return <span className="almox-badge almox-badge--danger">Vencido</span>;
  if (days <= 30) return <span className="almox-badge almox-badge--warn">Vence em {days} dia(s)</span>;
  return <span className="almox-badge">{formatDate(date)}</span>;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <article className="almox-stat-card">
      <span className="almox-stat-card__icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

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

export function AlmoxarifadoPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('modulo_admin') || hasPermission('modulo_compras') || hasPermission('almoxarifado_gerenciar');
  const canMove = canManage || hasPermission('almoxarifado_movimentar');
  const encontroPadraoId = encontros.find((encontro) => encontro.ativo)?.id || encontros[0]?.id || '';
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const encontroSelecionadoId = selectedEncontroId || encontroPadraoId;
  const [categorias, setCategorias] = useState<AlmoxarifadoCategoria[]>([]);
  const [unidades, setUnidades] = useState<AlmoxarifadoUnidade[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [itens, setItens] = useState<AlmoxarifadoItem[]>([]);
  const [saldos, setSaldos] = useState<AlmoxarifadoSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [equipeFiltro, setEquipeFiltro] = useState('');
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [categoriaModalOpen, setCategoriaModalOpen] = useState(false);
  const [unidadeModalOpen, setUnidadeModalOpen] = useState(false);
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);
  const [movimentoModalOpen, setMovimentoModalOpen] = useState(false);
  const [itemForm, setItemForm] = useState(itemFormInicial);
  const [saldoForm, setSaldoForm] = useState(saldoFormInicial);
  const [movimentoForm, setMovimentoForm] = useState(movimentoInicial);

  const loadBaseData = useCallback(async () => {
    try {
      const [categoriasData, unidadesData, equipesData, itensData] = await Promise.all([
        almoxarifadoService.listarTodasCategorias(),
        almoxarifadoService.listarTodasUnidades(),
        equipeService.listar(),
        almoxarifadoService.listarItens(),
      ]);
      setCategorias(categoriasData);
      setUnidades(unidadesData);
      setEquipes(equipesData);
      setItens(itensData);
    } catch (error) {
      console.error('Erro ao carregar cadastros do almoxarifado:', error);
      toast.error('Não foi possível carregar os cadastros do almoxarifado.');
    }
  }, []);

  const loadSaldos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await almoxarifadoService.listarSaldos(encontroSelecionadoId, {
        busca,
        categoriaId: categoriaFiltro,
        equipeId: equipeFiltro,
      });
      setSaldos(data);
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
      toast.error('Não foi possível carregar o estoque.');
    } finally {
      setLoading(false);
    }
  }, [busca, categoriaFiltro, encontroSelecionadoId, equipeFiltro]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    loadSaldos();
  }, [loadSaldos]);

  const resumo = useMemo(() => {
    const totalQuantidade = saldos.reduce((sum, saldo) => sum + saldo.quantidade, 0);
    const vencendo = saldos.filter((saldo) => {
      const days = daysUntil(saldo.data_validade);
      return days !== null && days >= 0 && days <= 30;
    }).length;

    return {
      lotes: saldos.length,
      itens: new Set(saldos.map((saldo) => saldo.item_id)).size,
      totalQuantidade,
      vencendo,
    };
  }, [saldos]);

  const openMovimento = (saldo: AlmoxarifadoSaldo, tipo: AlmoxarifadoMovimentacaoTipo) => {
    setMovimentoForm({
      saldo_id: saldo.id,
      tipo,
      quantidade: tipo === 'ajuste' ? saldo.quantidade : 1,
      motivo: '',
    });
    setMovimentoModalOpen(true);
  };

  const handleCreateItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.nome.trim()) {
      toast.error('Informe o nome do item.');
      return;
    }

    setSaving(true);
    try {
      await almoxarifadoService.criarItem(itemForm);
      toast.success('Item cadastrado.');
      setItemForm(itemFormInicial);
      setItemModalOpen(false);
      await loadBaseData();
    } catch (error) {
      console.error('Erro ao cadastrar item:', error);
      toast.error('Não foi possível cadastrar o item.');
    } finally {
      setSaving(false);
    }
  };

  const categoriasAtivas = categorias.filter((categoria) => categoria.ativo);

  const handleSaveCategoria = async (form: CategoriaFormState) => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await almoxarifadoService.atualizarCategoria(form.id, {
          nome: form.nome.trim(),
          cor: form.cor || null,
          ativo: form.ativo,
        });
        toast.success('Categoria atualizada.');
      } else {
        await almoxarifadoService.criarCategoria(form.nome, form.cor || null);
        toast.success('Categoria cadastrada.');
      }
      await loadBaseData();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      toast.error('Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategoria = async (categoria: AlmoxarifadoCategoria) => {
    setSaving(true);
    try {
      await almoxarifadoService.atualizarCategoria(categoria.id, { ativo: !categoria.ativo });
      toast.success(categoria.ativo ? 'Categoria inativada.' : 'Categoria reativada.');
      await loadBaseData();
      if (categoriaFiltro === categoria.id && categoria.ativo) {
        setCategoriaFiltro('');
      }
    } catch (error) {
      console.error('Erro ao alterar categoria:', error);
      toast.error('Não foi possível alterar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUnidade = async (form: UnidadeFormState) => {
    if (!form.nome.trim() || !form.sigla.trim()) {
      toast.error('Informe o nome e a sigla da unidade.');
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await almoxarifadoService.atualizarUnidade(form.id, {
          nome: form.nome.trim(),
          sigla: form.sigla.trim(),
          ativo: form.ativo,
        });
        toast.success('Unidade atualizada.');
      } else {
        await almoxarifadoService.criarUnidade(form.nome, form.sigla);
        toast.success('Unidade cadastrada.');
      }
      await loadBaseData();
    } catch (error) {
      console.error('Erro ao salvar unidade:', error);
      toast.error('Não foi possível salvar a unidade.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUnidade = async (unidade: AlmoxarifadoUnidade) => {
    setSaving(true);
    try {
      await almoxarifadoService.atualizarUnidade(unidade.id, { ativo: !unidade.ativo });
      toast.success(unidade.ativo ? 'Unidade inativada.' : 'Unidade reativada.');
      await loadBaseData();
    } catch (error) {
      console.error('Erro ao alterar unidade:', error);
      toast.error('Não foi possível alterar a unidade.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSaldo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!saldoForm.item_id || saldoForm.quantidade < 0) {
      toast.error('Informe o item e uma quantidade válida.');
      return;
    }

    setSaving(true);
    try {
      await almoxarifadoService.criarSaldo({
        ...saldoForm,
        encontro_id: encontroSelecionadoId,
      });
      toast.success('Saldo cadastrado.');
      setSaldoForm(saldoFormInicial);
      setSaldoModalOpen(false);
      await loadSaldos();
    } catch (error) {
      console.error('Erro ao cadastrar saldo:', error);
      toast.error('Não foi possível cadastrar o saldo.');
    } finally {
      setSaving(false);
    }
  };

  const handleMovimento = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!movimentoForm.saldo_id || movimentoForm.quantidade <= 0) {
      toast.error('Informe uma quantidade maior que zero.');
      return;
    }

    setSaving(true);
    try {
      await almoxarifadoService.registrarMovimentacao(movimentoForm);
      toast.success('Movimentação registrada.');
      setMovimentoForm(movimentoInicial);
      setMovimentoModalOpen(false);
      await loadSaldos();
    } catch (error) {
      console.error('Erro ao registrar movimentação:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a movimentação.');
    } finally {
      setSaving(false);
    }
  };

  const selectedSaldo = saldos.find((saldo) => saldo.id === movimentoForm.saldo_id);

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras/almoxarifado')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Estoque / Almoxarifado</h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Controle contínuo de sobras, entradas, saídas e validade dos itens.
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
        <StatCard icon={<Warehouse size={22} />} label="Lotes no estoque" value={resumo.lotes} />
        <StatCard icon={<Package size={22} />} label="Itens distintos" value={resumo.itens} />
        <StatCard icon={<ClipboardList size={22} />} label="Quantidade total" value={formatQuantity(resumo.totalQuantidade)} />
        <StatCard icon={<SlidersHorizontal size={22} />} label="Vencendo em 30 dias" value={resumo.vencendo} />
      </section>

      <section className="card almox-toolbar">
        <div className="almox-filters">
          <FormField
            label="Buscar item, marca ou fornecedor"
            name="busca"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            icon={<Search size={18} />}
            floating={false}
          />

          <SelectField label="Categoria" value={categoriaFiltro} onChange={setCategoriaFiltro}>
            <option value="">Todas</option>
            {categoriasAtivas.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
            ))}
          </SelectField>

          <SelectField label="Equipe/Destino" value={equipeFiltro} onChange={setEquipeFiltro}>
            <option value="">Todas</option>
            {equipes.map((equipe) => (
              <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>
            ))}
          </SelectField>
        </div>

        <div className="almox-actions">
          <button type="button" className="btn-secondary" onClick={loadSaldos} disabled={loading}>
            {loading ? <Loader className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Atualizar
          </button>
          {canManage && (
            <>
              <button type="button" className="btn-secondary" onClick={() => setCategoriaModalOpen(true)}>
                <SlidersHorizontal size={17} /> Categorias
              </button>
              <button type="button" className="btn-secondary" onClick={() => setUnidadeModalOpen(true)}>
                <SlidersHorizontal size={17} /> Unidades
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate('/compras/almoxarifado/itens')}>
                <Package size={17} /> Itens
              </button>
              <button type="button" className="btn-secondary" onClick={() => setItemModalOpen(true)}>
                <Plus size={17} /> Novo item
              </button>
            </>
          )}
          {canMove && (
            <button type="button" className="btn-primary" onClick={() => setSaldoModalOpen(true)}>
              <Plus size={17} /> Novo saldo
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <div className="card empty-state">
          <Loader className="animate-spin" />
          Carregando estoque...
        </div>
      ) : saldos.length === 0 ? (
        <div className="card empty-state">
          <Warehouse size={34} />
          Nenhum saldo encontrado para os filtros atuais.
        </div>
      ) : (
        <>
          <section className="almox-table-card">
            <div className="almox-table-wrap">
              <table className="almox-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Categoria</th>
                    <th>Equipe/Destino</th>
                    <th>Marca</th>
                    <th>Fornecedor</th>
                    <th>Validade</th>
                    <th>Quantidade</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((saldo) => (
                    <tr key={saldo.id}>
                      <td>
                        <div className="almox-item-cell">
                          <strong>{saldo.item?.nome || 'Item sem nome'}</strong>
                          <small>{saldo.observacoes || 'Sem observações'}</small>
                        </div>
                      </td>
                      <td>
                        {saldo.item?.categoria?.nome ? (
                          <span className="almox-badge" style={saldo.item.categoria.cor ? { color: saldo.item.categoria.cor } : undefined}>
                            {saldo.item.categoria.nome}
                          </span>
                        ) : <span className="almox-muted">Sem categoria</span>}
                      </td>
                      <td>{saldo.equipe?.nome || saldo.item?.equipe_padrao?.nome || <span className="almox-muted">Uso geral</span>}</td>
                      <td>{saldo.marca || saldo.item?.marca_preferida || <span className="almox-muted">Livre</span>}</td>
                      <td>{saldo.fornecedor || saldo.item?.fornecedor_padrao || <span className="almox-muted">Não informado</span>}</td>
                      <td>{validityBadge(saldo.data_validade)}</td>
                      <td><strong>{formatQuantity(saldo.quantidade, saldo.item?.unidade?.sigla)}</strong></td>
                      <td>
                        {canMove ? (
                          <div className="almox-actions">
                            <button type="button" className="btn-secondary btn-sm" onClick={() => openMovimento(saldo, 'entrada')}>Entrada</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => openMovimento(saldo, 'saida')}>Saída</button>
                            <button type="button" className="btn-secondary btn-sm" onClick={() => openMovimento(saldo, 'ajuste')}>Ajuste</button>
                          </div>
                        ) : <span className="almox-muted">Consulta</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="almox-mobile-list">
            {saldos.map((saldo) => (
              <article key={saldo.id} className="almox-mobile-card">
                <header>
                  <div>
                    <h3>{saldo.item?.nome || 'Item sem nome'}</h3>
                    <span className="almox-muted">{saldo.item?.categoria?.nome || 'Sem categoria'}</span>
                  </div>
                  <strong>{formatQuantity(saldo.quantidade, saldo.item?.unidade?.sigla)}</strong>
                </header>

                <div className="almox-mobile-grid">
                  <div><span>Equipe</span><strong>{saldo.equipe?.nome || saldo.item?.equipe_padrao?.nome || 'Uso geral'}</strong></div>
                  <div><span>Marca</span><strong>{saldo.marca || saldo.item?.marca_preferida || 'Livre'}</strong></div>
                  <div><span>Fornecedor</span><strong>{saldo.fornecedor || saldo.item?.fornecedor_padrao || 'Não informado'}</strong></div>
                  <div><span>Validade</span><strong>{formatDate(saldo.data_validade)}</strong></div>
                </div>

                {validityBadge(saldo.data_validade)}

                {canMove && (
                  <div className="almox-actions">
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openMovimento(saldo, 'entrada')}>Entrada</button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openMovimento(saldo, 'saida')}>Saída</button>
                    <button type="button" className="btn-secondary btn-sm" onClick={() => openMovimento(saldo, 'ajuste')}>Ajuste</button>
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}

      <AlmoxarifadoItemModal
        isOpen={itemModalOpen}
        title="Novo item do catálogo"
        form={itemForm}
        categorias={categorias}
        unidades={unidades}
        equipes={equipes}
        saving={saving}
        submitLabel="Salvar item"
        onChange={setItemForm}
        onClose={() => setItemModalOpen(false)}
        onSubmit={handleCreateItem}
        footerExtra={(
          <button type="button" className="btn-secondary" onClick={() => navigate('/compras/almoxarifado/itens')}>
            Gerenciar itens
          </button>
        )}
      />

      <AlmoxarifadoCategoriaModal
        isOpen={categoriaModalOpen}
        categorias={categorias}
        saving={saving}
        onClose={() => setCategoriaModalOpen(false)}
        onSave={handleSaveCategoria}
        onToggle={handleToggleCategoria}
      />

      <AlmoxarifadoUnidadeModal
        isOpen={unidadeModalOpen}
        unidades={unidades}
        saving={saving}
        onClose={() => setUnidadeModalOpen(false)}
        onSave={handleSaveUnidade}
        onToggle={handleToggleUnidade}
      />

      <Modal isOpen={saldoModalOpen} onClose={() => setSaldoModalOpen(false)} title="Novo saldo no estoque" maxWidth="760px">
        <form onSubmit={handleCreateSaldo}>
          <div className="almox-form-grid">
            <div className="span-2">
              <SelectField label="Item" value={saldoForm.item_id} onChange={(value) => {
                const item = itens.find((current) => current.id === value);
                setSaldoForm({
                  ...saldoForm,
                  item_id: value,
                  equipe_id: item?.equipe_padrao_id || saldoForm.equipe_id,
                  marca: item?.marca_preferida || saldoForm.marca,
                  fornecedor: item?.fornecedor_padrao || saldoForm.fornecedor,
                });
              }}>
                <option value="">Selecione um item</option>
                {itens.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </SelectField>
            </div>
            <SelectField label="Equipe/Destino" value={saldoForm.equipe_id} onChange={(value) => setSaldoForm({ ...saldoForm, equipe_id: value })}>
              <option value="">Uso geral</option>
              {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
            </SelectField>
            <FormField label="Quantidade inicial" name="quantidade" type="number" step="0.001" min="0" value={saldoForm.quantidade} onChange={(event) => setSaldoForm({ ...saldoForm, quantidade: Number(event.target.value) })} floating={false} required />
            <FormField label="Marca" name="marca" value={saldoForm.marca} onChange={(event) => setSaldoForm({ ...saldoForm, marca: event.target.value })} floating={false} />
            <FormField label="Fornecedor" name="fornecedor" value={saldoForm.fornecedor} onChange={(event) => setSaldoForm({ ...saldoForm, fornecedor: event.target.value })} floating={false} />
            <FormField label="Data de validade" name="data_validade" type="date" value={saldoForm.data_validade} onChange={(event) => setSaldoForm({ ...saldoForm, data_validade: event.target.value })} floating={false} />
            <div className="span-2">
              <FormField label="Observações" name="observacoes" as="textarea" rows={3} value={saldoForm.observacoes} onChange={(event) => setSaldoForm({ ...saldoForm, observacoes: event.target.value })} floating={false} />
            </div>
          </div>
          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setSaldoModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar saldo'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={movimentoModalOpen} onClose={() => setMovimentoModalOpen(false)} title="Movimentar estoque" maxWidth="560px">
        <form onSubmit={handleMovimento}>
          {selectedSaldo && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <strong>{selectedSaldo.item?.nome}</strong>
              <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
                Saldo atual: {formatQuantity(selectedSaldo.quantidade, selectedSaldo.item?.unidade?.sigla)}
              </p>
            </div>
          )}
          <div className="almox-form-grid">
            <SelectField label="Tipo" value={movimentoForm.tipo} onChange={(value) => setMovimentoForm({ ...movimentoForm, tipo: value as AlmoxarifadoMovimentacaoTipo })}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste de saldo</option>
            </SelectField>
            <FormField
              label={movimentoForm.tipo === 'ajuste' ? 'Novo saldo' : 'Quantidade'}
              name="quantidade_movimento"
              type="number"
              step="0.001"
              min="0.001"
              value={movimentoForm.quantidade}
              onChange={(event) => setMovimentoForm({ ...movimentoForm, quantidade: Number(event.target.value) })}
              floating={false}
              required
            />
            <div className="span-2">
              <FormField label="Motivo" name="motivo" as="textarea" rows={3} value={movimentoForm.motivo} onChange={(event) => setMovimentoForm({ ...movimentoForm, motivo: event.target.value })} floating={false} />
            </div>
          </div>
          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setMovimentoModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Registrando...' : 'Registrar'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
