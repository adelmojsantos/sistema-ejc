import { ChevronLeft, Edit2, Loader, Package, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AlmoxarifadoCategoriaModal, type CategoriaFormState } from '../../components/almoxarifado/AlmoxarifadoCategoriaModal';
import { AlmoxarifadoItemModal } from '../../components/almoxarifado/AlmoxarifadoItemModal';
import { AlmoxarifadoUnidadeModal, type UnidadeFormState } from '../../components/almoxarifado/AlmoxarifadoUnidadeModal';
import { FormField } from '../../components/ui/FormField';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import { equipeService } from '../../services/equipeService';
import type {
  AlmoxarifadoCategoria,
  AlmoxarifadoItem,
  AlmoxarifadoItemFormData,
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

function itemToForm(item: AlmoxarifadoItem): AlmoxarifadoItemFormData {
  return {
    nome: item.nome,
    categoria_id: item.categoria_id || '',
    unidade_id: item.unidade_id || '',
    equipe_padrao_id: item.equipe_padrao_id || '',
    marca_preferida: item.marca_preferida || '',
    fornecedor_padrao: item.fornecedor_padrao || '',
  };
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

export function AlmoxarifadoItensPage() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<AlmoxarifadoCategoria[]>([]);
  const [unidades, setUnidades] = useState<AlmoxarifadoUnidade[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [itens, setItens] = useState<AlmoxarifadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [modalOpen, setModalOpen] = useState(false);
  const [categoriaModalOpen, setCategoriaModalOpen] = useState(false);
  const [unidadeModalOpen, setUnidadeModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AlmoxarifadoItem | null>(null);
  const [itemForm, setItemForm] = useState(itemFormInicial);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [categoriasData, unidadesData, equipesData, itensData] = await Promise.all([
        almoxarifadoService.listarTodasCategorias(),
        almoxarifadoService.listarTodasUnidades(),
        equipeService.listar(),
        almoxarifadoService.listarTodosItens(busca),
      ]);
      setCategorias(categoriasData);
      setUnidades(unidadesData);
      setEquipes(equipesData);
      setItens(itensData);
    } catch (error) {
      console.error('Erro ao carregar itens do almoxarifado:', error);
      toast.error('Não foi possível carregar os itens.');
    } finally {
      setLoading(false);
    }
  }, [busca]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoriasAtivas = categorias.filter((categoria) => categoria.ativo);

  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      const matchesCategoria = !categoriaFiltro || item.categoria_id === categoriaFiltro;
      const matchesStatus =
        statusFiltro === 'todos'
        || (statusFiltro === 'ativos' && item.ativo)
        || (statusFiltro === 'inativos' && !item.ativo);
      return matchesCategoria && matchesStatus;
    });
  }, [categoriaFiltro, itens, statusFiltro]);

  const openCreate = () => {
    setEditingItem(null);
    setItemForm(itemFormInicial);
    setModalOpen(true);
  };

  const openEdit = (item: AlmoxarifadoItem) => {
    setEditingItem(item);
    setItemForm(itemToForm(item));
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.nome.trim()) {
      toast.error('Informe o nome do item.');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await almoxarifadoService.atualizarItem(editingItem.id, itemForm);
        toast.success('Item atualizado.');
      } else {
        await almoxarifadoService.criarItem(itemForm);
        toast.success('Item cadastrado.');
      }
      setModalOpen(false);
      setEditingItem(null);
      setItemForm(itemFormInicial);
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      toast.error('Não foi possível salvar o item.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItem = async (item: AlmoxarifadoItem) => {
    setSaving(true);
    try {
      await almoxarifadoService.atualizarItem(item.id, { ativo: !item.ativo });
      toast.success(item.ativo ? 'Item inativado.' : 'Item reativado.');
      await loadData();
    } catch (error) {
      console.error('Erro ao alterar item:', error);
      toast.error('Não foi possível alterar o item.');
    } finally {
      setSaving(false);
    }
  };

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
      await loadData();
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
      await loadData();
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
      await loadData();
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
      await loadData();
    } catch (error) {
      console.error('Erro ao alterar unidade:', error);
      toast.error('Não foi possível alterar a unidade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras/almoxarifado')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Estoque / Almoxarifado</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Itens do Catálogo</h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Cadastre, acompanhe e inative os itens usados no estoque.
            </p>
          </div>
        </div>
      </div>

      <section className="almox-summary-grid">
        <article className="almox-stat-card">
          <span className="almox-stat-card__icon"><Package size={22} /></span>
          <div><span>Total de itens</span><strong>{itens.length}</strong></div>
        </article>
        <article className="almox-stat-card">
          <span className="almox-stat-card__icon"><SlidersHorizontal size={22} /></span>
          <div><span>Ativos</span><strong>{itens.filter((item) => item.ativo).length}</strong></div>
        </article>
        <article className="almox-stat-card">
          <span className="almox-stat-card__icon"><Package size={22} /></span>
          <div><span>Inativos</span><strong>{itens.filter((item) => !item.ativo).length}</strong></div>
        </article>
      </section>

      <section className="card almox-toolbar">
        <div className="almox-filters">
          <FormField
            label="Buscar item"
            name="busca_itens"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            icon={<Search size={18} />}
            floating={false}
          />
          <SelectField label="Categoria" value={categoriaFiltro} onChange={setCategoriaFiltro}>
            <option value="">Todas</option>
            {categoriasAtivas.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
          </SelectField>
          <SelectField label="Status" value={statusFiltro} onChange={(value) => setStatusFiltro(value as typeof statusFiltro)}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </SelectField>
        </div>
        <div className="almox-actions">
          <button type="button" className="btn-secondary" onClick={loadData} disabled={loading}>
            {loading ? <Loader className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Atualizar
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCategoriaModalOpen(true)}>
            <SlidersHorizontal size={17} /> Categorias
          </button>
          <button type="button" className="btn-secondary" onClick={() => setUnidadeModalOpen(true)}>
            <SlidersHorizontal size={17} /> Unidades
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={17} /> Novo item
          </button>
        </div>
      </section>

      {loading ? (
        <div className="card empty-state">
          <Loader className="animate-spin" />
          Carregando itens...
        </div>
      ) : itensFiltrados.length === 0 ? (
        <div className="card empty-state">Nenhum item encontrado para os filtros atuais.</div>
      ) : (
        <>
          <section className="almox-table-card">
            <div className="almox-table-wrap">
              <table className="almox-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Categoria</th>
                    <th>Unidade</th>
                    <th>Equipe padrão</th>
                    <th>Marca</th>
                    <th>Fornecedor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.nome}</strong></td>
                      <td>{item.categoria?.nome || <span className="almox-muted">Sem categoria</span>}</td>
                      <td>{item.unidade ? `${item.unidade.nome} (${item.unidade.sigla})` : <span className="almox-muted">Sem unidade</span>}</td>
                      <td>{item.equipe_padrao?.nome || <span className="almox-muted">Uso geral</span>}</td>
                      <td>{item.marca_preferida || <span className="almox-muted">Livre</span>}</td>
                      <td>{item.fornecedor_padrao || <span className="almox-muted">Não informado</span>}</td>
                      <td><span className={`almox-badge ${!item.ativo ? 'almox-badge--danger' : ''}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td>
                        <div className="almox-actions">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(item)}>
                            <Edit2 size={14} /> Editar
                          </button>
                          <button type="button" className="btn-secondary btn-sm" onClick={() => handleToggleItem(item)} disabled={saving}>
                            {item.ativo ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="almox-mobile-list">
            {itensFiltrados.map((item) => (
              <article key={item.id} className={`almox-mobile-card ${!item.ativo ? 'is-inactive' : ''}`}>
                <header>
                  <div>
                    <h3>{item.nome}</h3>
                    <span className="almox-muted">{item.categoria?.nome || 'Sem categoria'}</span>
                  </div>
                  <span className={`almox-badge ${!item.ativo ? 'almox-badge--danger' : ''}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span>
                </header>
                <div className="almox-mobile-grid">
                  <div><span>Unidade</span><strong>{item.unidade?.sigla || 'Sem unidade'}</strong></div>
                  <div><span>Equipe</span><strong>{item.equipe_padrao?.nome || 'Uso geral'}</strong></div>
                  <div><span>Marca</span><strong>{item.marca_preferida || 'Livre'}</strong></div>
                  <div><span>Fornecedor</span><strong>{item.fornecedor_padrao || 'Não informado'}</strong></div>
                </div>
                <div className="almox-actions">
                  <button type="button" className="btn-secondary btn-sm" onClick={() => openEdit(item)}>
                    <Edit2 size={14} /> Editar
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => handleToggleItem(item)} disabled={saving}>
                    {item.ativo ? 'Inativar' : 'Reativar'}
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      <AlmoxarifadoItemModal
        isOpen={modalOpen}
        title={editingItem ? 'Editar item do catálogo' : 'Novo item do catálogo'}
        form={itemForm}
        categorias={categorias}
        unidades={unidades}
        equipes={equipes}
        saving={saving}
        submitLabel={editingItem ? 'Atualizar item' : 'Salvar item'}
        onChange={setItemForm}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSave}
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
    </section>
  );
}
