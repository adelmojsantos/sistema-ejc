import { Edit2, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { GroupedDropdown, type GroupedDropdownItem } from '../ui/GroupedDropdown';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import type { FinanceiroCategoria, FinanceiroCategoriaTipo } from '../../types/financeiro';

export interface FinanceiroCategoriaFormState {
  id: string | null;
  nome: string;
  tipo: FinanceiroCategoriaTipo;
  cor: string;
  ativo: boolean;
}

interface FinanceiroCategoriaModalProps {
  isOpen: boolean;
  categorias: FinanceiroCategoria[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: FinanceiroCategoriaFormState) => Promise<void>;
  onToggle: (categoria: FinanceiroCategoria) => Promise<void>;
}

const initialForm: FinanceiroCategoriaFormState = {
  id: null,
  nome: '',
  tipo: 'despesa',
  cor: '#3b82f6',
  ativo: true,
};

const tipoOptions: GroupedDropdownItem<FinanceiroCategoriaTipo>[] = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'ajuste', label: 'Ajuste' },
  { value: 'ambos', label: 'Todos os tipos' },
];

const tipoLabel = (tipo: FinanceiroCategoriaTipo) => {
  if (tipo === 'receita') return 'Receita';
  if (tipo === 'despesa') return 'Despesa';
  if (tipo === 'ajuste') return 'Ajuste';
  return 'Todos os tipos';
};

export function FinanceiroCategoriaModal({
  isOpen,
  categorias,
  saving,
  onClose,
  onSave,
  onToggle,
}: FinanceiroCategoriaModalProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FinanceiroCategoriaFormState>(initialForm);

  const sortedCategorias = useMemo(
    () => [...categorias].sort((a, b) => Number(a.ativo === false) - Number(b.ativo === false) || a.nome.localeCompare(b.nome)),
    [categorias],
  );

  const resetForm = () => {
    setForm(initialForm);
    setFormOpen(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave(form);
    resetForm();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Categorias financeiras" maxWidth="720px">
      <div className="almox-category-header">
        <div>
          <strong>Classifique os lançamentos do financeiro</strong>
          <p className="text-muted">Use categorias para separar receitas, despesas e ajustes no livro-caixa.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setForm(initialForm);
            setFormOpen(true);
          }}
        >
          <Plus size={17} /> Adicionar categoria
        </button>
      </div>

      {formOpen && (
        <form className="almox-category-form" onSubmit={handleSubmit}>
          <div className="almox-category-form-grid">
            <FormField
              label="Nome da categoria"
              name="financeiro_categoria_nome"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              required
            />

            <div className="form-group floating-label-group financeiro-floating-dropdown">
              <div className="form-input-wrapper">
                <GroupedDropdown
                  value={form.tipo}
                  onChange={(value) => setForm({ ...form, tipo: value })}
                  items={tipoOptions}
                  ariaLabel="Tipo da categoria"
                />
                <label className="form-label floating-label">
                  Tipo<span className="form-label-required">*</span>
                </label>
              </div>
            </div>

            <div className="form-group floating-label-group financeiro-color-group">
              <div className="form-input-wrapper">
                <span className="almox-color-preview" style={{ backgroundColor: form.cor || '#3b82f6' }} />
                <input
                  aria-label="Selecionar cor da categoria"
                  className="almox-color-picker"
                  type="color"
                  value={form.cor}
                  onChange={(event) => setForm({ ...form, cor: event.target.value })}
                />
                <input
                  aria-label="Código hexadecimal da cor"
                  className="form-input floating-input almox-color-text"
                  value={form.cor}
                  onChange={(event) => setForm({ ...form, cor: event.target.value })}
                  maxLength={7}
                  placeholder=" "
                />
                <label className="form-label floating-label">Cor</label>
              </div>
            </div>
          </div>

          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : form.id ? 'Atualizar categoria' : 'Salvar categoria'}
            </button>
          </div>
        </form>
      )}

      <div className="almox-category-list">
        {sortedCategorias.length === 0 ? (
          <div className="empty-state">Nenhuma categoria financeira cadastrada.</div>
        ) : sortedCategorias.map((categoria) => (
          <div key={categoria.id} className={`almox-category-row ${!categoria.ativo ? 'is-inactive' : ''}`}>
            <div>
              <span className="almox-category-dot" style={{ backgroundColor: categoria.cor || '#3b82f6' }} />
              <strong>{categoria.nome}</strong>
              <small>{tipoLabel(categoria.tipo)}</small>
              {!categoria.ativo && <small>Inativa</small>}
            </div>
            <div className="almox-actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setForm({
                    id: categoria.id,
                    nome: categoria.nome,
                    tipo: categoria.tipo,
                    cor: categoria.cor || '#3b82f6',
                    ativo: categoria.ativo,
                  });
                  setFormOpen(true);
                }}
              >
                <Edit2 size={14} /> Editar
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => onToggle(categoria)} disabled={saving}>
                {categoria.ativo ? 'Inativar' : 'Reativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
