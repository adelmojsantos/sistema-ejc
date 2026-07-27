import { Ban, ChevronLeft, CircleDollarSign, Edit2, FileText, Loader, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FinanceiroCategoriaModal, type FinanceiroCategoriaFormState } from '../../components/financeiro/FinanceiroCategoriaModal';
import { StorageLink } from '../../components/storage/StorageLink';
import { CurrencyFormField } from '../../components/ui/CurrencyFormField';
import { FormField } from '../../components/ui/FormField';
import { GroupedDropdown, type GroupedDropdownItem } from '../../components/ui/GroupedDropdown';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { MobileFileUploadButton } from '../../components/ui/MobileFileUploadButton';
import { Modal } from '../../components/ui/Modal';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { encontroService } from '../../services/encontroService';
import { financeiroService } from '../../services/financeiroService';
import type { FinanceiroCategoria, FinanceiroLancamento, FinanceiroLancamentoManualFormData, FinanceiroTipo } from '../../types/financeiro';
import './AlmoxarifadoPage.css';

const hoje = () => new Date().toISOString().slice(0, 10);

const lancamentoFormInicial: FinanceiroLancamentoManualFormData = {
  encontro_id: '',
  categoria_id: '',
  tipo: 'despesa',
  descricao: '',
  valor: 0,
  data_lancamento: hoje(),
  observacoes: '',
};

const money = (value: number | null | undefined) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const origemLabel = (origem: string) => {
  const labels: Record<string, string> = {
    manual: 'Manual',
    taxa: 'Taxa',
    camiseta: 'Camiseta',
    almoxarifado_compra: 'Almoxarifado',
    minimercado: 'Minimercado',
  };
  return labels[origem] || origem;
};

const tipoLancamentoOptions: GroupedDropdownItem<FinanceiroTipo>[] = [
  { value: 'receita', label: 'Entrada' },
  { value: 'despesa', label: 'Saída' },
];

interface DropdownFormFieldProps<TValue extends string> {
  id: string;
  label: string;
  value: TValue;
  onChange: (value: TValue) => void;
  items: GroupedDropdownItem<TValue>[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

function DropdownFormField<TValue extends string>({
  id,
  label,
  value,
  onChange,
  items,
  placeholder,
  required,
  disabled,
}: DropdownFormFieldProps<TValue>) {
  return (
    <div className="form-group floating-label-group financeiro-floating-dropdown">
      <div className="form-input-wrapper">
        <GroupedDropdown
          value={value}
          onChange={onChange}
          items={items}
          placeholder={placeholder}
          disabled={disabled}
          ariaLabel={label}
        />
        <label className="form-label floating-label" htmlFor={id} id={`${id}-label`}>
          {label}
          {required && <span className="form-label-required">*</span>}
        </label>
      </div>
    </div>
  );
}

export function FinanceiroPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { encontros } = useEncontros();
  const encontroPadraoId = encontros.find((encontro) => encontro.ativo)?.id || encontros[0]?.id || '';
  const canManageFinanceiro = hasPermission('modulo_admin') || hasPermission('financeiro_gerenciar');
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const encontroSelecionadoId = selectedEncontroId || encontroPadraoId;
  const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[]>([]);
  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lancamentoModalOpen, setLancamentoModalOpen] = useState(false);
  const [categoriaModalOpen, setCategoriaModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<FinanceiroLancamento | null>(null);
  const [editTarget, setEditTarget] = useState<FinanceiroLancamento | null>(null);
  const [lancamentoForm, setLancamentoForm] = useState<FinanceiroLancamentoManualFormData>(lancamentoFormInicial);
  const [comprovanteFiles, setComprovanteFiles] = useState<File[]>([]);

  const loadLancamentos = useCallback(async () => {
    if (!encontroSelecionadoId) return;

    setLoading(true);
    try {
      const [lancamentosData, categoriasData] = await Promise.all([
        financeiroService.listarLancamentos(encontroSelecionadoId),
        financeiroService.listarCategorias(encontroSelecionadoId, true),
      ]);
      setLancamentos(lancamentosData);
      setCategorias(categoriasData);
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
      toast.error('Não foi possível carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }, [encontroSelecionadoId]);

  useEffect(() => {
    loadLancamentos();
  }, [loadLancamentos]);

  const resumo = useMemo(() => financeiroService.calcularResumo(lancamentos), [lancamentos]);

  const categoriasDisponiveis = useMemo(
    () => categorias.filter((categoria) => categoria.ativo && (categoria.tipo === 'ambos' || categoria.tipo === lancamentoForm.tipo)),
    [categorias, lancamentoForm.tipo],
  );

  const categoriaOptions = useMemo<GroupedDropdownItem<string>[]>(
    () => [
      { value: '', label: 'Sem categoria' },
      ...categoriasDisponiveis.map((categoria) => ({ value: categoria.id, label: categoria.nome })),
    ],
    [categoriasDisponiveis],
  );

  const openNovoLancamento = () => {
    setLancamentoForm({
      ...lancamentoFormInicial,
      encontro_id: encontroSelecionadoId,
      data_lancamento: hoje(),
    });
    setEditTarget(null);
    setComprovanteFiles([]);
    setLancamentoModalOpen(true);
  };

  const openEditarLancamento = (lancamento: FinanceiroLancamento) => {
    if (lancamento.origem !== 'manual') {
      toast.error('Lançamentos automáticos devem ser alterados no módulo de origem.');
      return;
    }

    setEditTarget(lancamento);
    setLancamentoForm({
      encontro_id: lancamento.encontro_id,
      categoria_id: lancamento.categoria_id || '',
      tipo: lancamento.tipo,
      descricao: lancamento.descricao,
      valor: lancamento.valor,
      data_lancamento: lancamento.data_lancamento,
      observacoes: lancamento.observacoes || '',
    });
    setComprovanteFiles([]);
    setLancamentoModalOpen(true);
  };

  const closeLancamentoModal = () => {
    setLancamentoModalOpen(false);
    setEditTarget(null);
    setComprovanteFiles([]);
  };

  const handleSalvarLancamento = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!lancamentoForm.descricao.trim()) {
      toast.error('Informe a descrição do lançamento.');
      return;
    }

    if (lancamentoForm.valor <= 0) {
      toast.error('Informe um valor maior que zero.');
      return;
    }

    setSaving(true);
    try {
      const formData = {
        ...lancamentoForm,
        encontro_id: encontroSelecionadoId,
        valor: lancamentoForm.valor,
      };
      const lancamento = editTarget
        ? await financeiroService.atualizarLancamentoManual(editTarget.id, formData)
        : await financeiroService.criarLancamentoManual(formData);
      if (comprovanteFiles.length > 0) {
        await financeiroService.anexarComprovantesLancamento(lancamento, comprovanteFiles);
      }
      toast.success(editTarget ? 'Lançamento atualizado.' : 'Lançamento criado.');
      setLancamentoModalOpen(false);
      setLancamentoForm(lancamentoFormInicial);
      setEditTarget(null);
      setComprovanteFiles([]);
      await loadLancamentos();
    } catch (error) {
      console.error('Erro ao criar lançamento financeiro:', error);
      toast.error('Não foi possível criar o lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelarLancamento = async () => {
    if (!cancelTarget) return;

    setSaving(true);
    try {
      await financeiroService.cancelarLancamentoManual(cancelTarget.id);
      toast.success('Lançamento cancelado.');
      setCancelTarget(null);
      await loadLancamentos();
    } catch (error) {
      console.error('Erro ao cancelar lançamento financeiro:', error);
      toast.error('Não foi possível cancelar o lançamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategoria = async (form: FinanceiroCategoriaFormState) => {
    if (!form.nome.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await financeiroService.atualizarCategoria(form.id, {
          nome: form.nome.trim(),
          tipo: form.tipo,
          cor: form.cor || null,
          ativo: form.ativo,
        });
        toast.success('Categoria atualizada.');
      } else {
        await financeiroService.criarCategoria({
          encontro_id: encontroSelecionadoId,
          nome: form.nome.trim(),
          tipo: form.tipo,
          cor: form.cor || null,
        });
        toast.success('Categoria cadastrada.');
      }
      await loadLancamentos();
    } catch (error) {
      console.error('Erro ao salvar categoria financeira:', error);
      toast.error('Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategoria = async (categoria: FinanceiroCategoria) => {
    setSaving(true);
    try {
      await financeiroService.atualizarCategoria(categoria.id, { ativo: !categoria.ativo });
      toast.success(categoria.ativo ? 'Categoria inativada.' : 'Categoria reativada.');
      if (lancamentoForm.categoria_id === categoria.id && categoria.ativo) {
        setLancamentoForm({ ...lancamentoForm, categoria_id: '' });
      }
      await loadLancamentos();
    } catch (error) {
      console.error('Erro ao alterar categoria financeira:', error);
      toast.error('Não foi possível alterar a categoria.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Financeiro</h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Livro-caixa consolidado de entradas e saídas do encontro.
            </p>
          </div>
        </div>

        <div className="almox-actions">
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
          {canManageFinanceiro && (
            <button type="button" className="btn-secondary" onClick={() => setCategoriaModalOpen(true)}>
              Categorias
            </button>
          )}
          <button type="button" className="btn-primary" onClick={openNovoLancamento}>
            <Plus size={17} /> Novo lançamento
          </button>
        </div>
      </div>

      <section className="almox-summary-grid">
        <div className="almox-stat-card">
          <span className="almox-stat-card__icon"><TrendingUp size={22} /></span>
          <div><span>Entradas</span><strong>{money(resumo.receitas)}</strong></div>
        </div>
        <div className="almox-stat-card">
          <span className="almox-stat-card__icon"><TrendingDown size={22} /></span>
          <div><span>Saídas</span><strong>{money(resumo.despesas)}</strong></div>
        </div>
        <div className="almox-stat-card">
          <span className="almox-stat-card__icon"><CircleDollarSign size={22} /></span>
          <div><span>Saldo</span><strong>{money(resumo.saldo)}</strong></div>
        </div>
      </section>

      {loading ? (
        <div className="card empty-state"><Loader className="animate-spin" /> Carregando lançamentos...</div>
      ) : lancamentos.length === 0 ? (
        <div className="card empty-state">Nenhum lançamento financeiro para este encontro.</div>
      ) : (
        <section className="almox-table-card">
          <div className="almox-table-wrap">
            <table className="almox-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Origem</th>
                  <th>Comprovantes</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((lancamento) => (
                  <tr key={lancamento.id}>
                    <td>{new Date(`${lancamento.data_lancamento}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <span className={lancamento.tipo === 'receita' ? 'almox-status-pill success' : 'almox-status-pill warning'}>
                        {lancamento.tipo === 'receita' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td>
                      <div className="almox-item-cell">
                        <strong>{lancamento.descricao}</strong>
                        <small>{lancamento.observacoes || 'Sem observações'}</small>
                      </div>
                    </td>
                    <td>{lancamento.categoria?.nome || 'Sem categoria'}</td>
                    <td>{origemLabel(lancamento.origem)}</td>
                    <td>
                      {lancamento.comprovantes_urls.length > 0 ? (
                        <StorageLink reference={lancamento.comprovantes_urls[0]} target="_blank" rel="noreferrer" className="almox-proof-link">
                          <FileText size={15} /> {lancamento.comprovantes_urls.length} arquivo(s)
                        </StorageLink>
                      ) : <span className="almox-muted">Nenhum</span>}
                    </td>
                    <td><strong>{money(lancamento.valor)}</strong></td>
                    <td>
                      {lancamento.origem === 'manual' ? (
                        <div className="almox-actions">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => openEditarLancamento(lancamento)}
                          >
                            <Edit2 size={15} /> Editar
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => setCancelTarget(lancamento)}
                          >
                            <Ban size={15} /> Cancelar
                          </button>
                        </div>
                      ) : <span className="almox-muted">Automático</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal isOpen={lancamentoModalOpen} onClose={closeLancamentoModal} title={editTarget ? 'Editar lançamento financeiro' : 'Novo lançamento financeiro'} maxWidth="720px">
        <form onSubmit={handleSalvarLancamento} className="almox-form">
          <div className="almox-form-grid two">
            <DropdownFormField<FinanceiroTipo>
              id="financeiro_tipo"
              label="Tipo"
              value={lancamentoForm.tipo}
              onChange={(value) => setLancamentoForm({
                  ...lancamentoForm,
                  tipo: value as FinanceiroTipo,
                  categoria_id: '',
                })}
              items={tipoLancamentoOptions}
              required
            />

            <DropdownFormField
              id="financeiro_categoria"
              label="Categoria"
              value={lancamentoForm.categoria_id}
              onChange={(value) => setLancamentoForm({ ...lancamentoForm, categoria_id: value })}
              items={categoriaOptions}
              placeholder="Sem categoria"
            />

            <FormField
              label="Descrição"
              name="descricao"
              value={lancamentoForm.descricao}
              onChange={(event) => setLancamentoForm({ ...lancamentoForm, descricao: event.target.value })}
              required
            />

            <CurrencyFormField
              label="Valor"
              name="valor"
              value={lancamentoForm.valor}
              onChange={(value) => setLancamentoForm({ ...lancamentoForm, valor: value })}
              required
            />

            <FormField
              label="Data"
              name="data_lancamento"
              type="date"
              value={lancamentoForm.data_lancamento}
              onChange={(event) => setLancamentoForm({ ...lancamentoForm, data_lancamento: event.target.value })}
              required
            />

            <div />

            <div className="almox-form-full">
              <FormField
                label="Observações"
                name="observacoes"
                as="textarea"
                rows={3}
                value={lancamentoForm.observacoes}
                onChange={(event) => setLancamentoForm({ ...lancamentoForm, observacoes: event.target.value })}
              />
            </div>

            <div className="almox-form-full almox-attachment-row">
              <MobileFileUploadButton
                label="Anexar comprovantes"
                disabled={saving}
                onFiles={(files) => setComprovanteFiles((current) => [...current, ...files])}
              />
              <p className="text-muted" style={{ margin: '0.45rem 0 0' }}>
                {comprovanteFiles.length > 0
                  ? `${comprovanteFiles.length} arquivo(s) selecionado(s). Imagens serão otimizadas ao salvar.`
                  : 'Opcional. Imagens serão otimizadas antes do envio.'}
              </p>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => {
              closeLancamentoModal();
            }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : editTarget ? 'Atualizar lançamento' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelarLancamento}
        title="Cancelar lançamento"
        message={`Deseja cancelar "${cancelTarget?.descricao || 'este lançamento'}"? Ele sairá do saldo ativo.`}
        confirmText="Cancelar lançamento"
        isDestructive
        isLoading={saving}
      />

      <FinanceiroCategoriaModal
        isOpen={categoriaModalOpen}
        categorias={categorias}
        saving={saving}
        onClose={() => setCategoriaModalOpen(false)}
        onSave={handleSaveCategoria}
        onToggle={handleToggleCategoria}
      />
    </section>
  );
}
