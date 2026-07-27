import { Edit2, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import type { AlmoxarifadoCategoria } from '../../types/almoxarifado';

export interface CategoriaFormState {
  id: string | null;
  nome: string;
  cor: string;
  ativo: boolean;
}

interface AlmoxarifadoCategoriaModalProps {
  isOpen: boolean;
  categorias: AlmoxarifadoCategoria[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: CategoriaFormState) => Promise<void>;
  onToggle: (categoria: AlmoxarifadoCategoria) => Promise<void>;
}

const initialForm: CategoriaFormState = {
  id: null,
  nome: '',
  cor: '#f59e0b',
  ativo: true,
};

export function AlmoxarifadoCategoriaModal({
  isOpen,
  categorias,
  saving,
  onClose,
  onSave,
  onToggle,
}: AlmoxarifadoCategoriaModalProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CategoriaFormState>(initialForm);

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Categorias" maxWidth="680px">
      <div className="almox-category-header">
        <div>
          <strong>Gerencie as categorias do estoque</strong>
          <p className="text-muted">A cor ajuda a identificar rapidamente o tipo do item na tabela.</p>
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
              name="categoria_nome"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              floating={false}
              required
            />
            <div className="form-group standard-label-group">
              <label className="form-label standard-label" htmlFor="categoria_cor">Cor</label>
              <div className="almox-color-field">
                <span className="almox-color-preview" style={{ backgroundColor: form.cor || '#f59e0b' }} />
                <input
                  id="categoria_cor"
                  aria-label="Selecionar cor da categoria"
                  className="almox-color-picker"
                  type="color"
                  value={form.cor}
                  onChange={(event) => setForm({ ...form, cor: event.target.value })}
                />
                <input
                  aria-label="Código hexadecimal da cor"
                  className="form-input standard-input almox-color-text"
                  value={form.cor}
                  onChange={(event) => setForm({ ...form, cor: event.target.value })}
                  maxLength={7}
                  placeholder="#f59e0b"
                />
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
        {categorias.length === 0 ? (
          <div className="empty-state">Nenhuma categoria cadastrada.</div>
        ) : categorias.map((categoria) => (
          <div key={categoria.id} className={`almox-category-row ${!categoria.ativo ? 'is-inactive' : ''}`}>
            <div>
              <span className="almox-category-dot" style={{ backgroundColor: categoria.cor || '#f59e0b' }} />
              <strong>{categoria.nome}</strong>
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
                    cor: categoria.cor || '#f59e0b',
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
