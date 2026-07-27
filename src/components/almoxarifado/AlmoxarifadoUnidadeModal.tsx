import { Edit2, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import type { AlmoxarifadoUnidade } from '../../types/almoxarifado';

export interface UnidadeFormState {
  id: string | null;
  nome: string;
  sigla: string;
  ativo: boolean;
}

interface AlmoxarifadoUnidadeModalProps {
  isOpen: boolean;
  unidades: AlmoxarifadoUnidade[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: UnidadeFormState) => Promise<void>;
  onToggle: (unidade: AlmoxarifadoUnidade) => Promise<void>;
}

const initialForm: UnidadeFormState = {
  id: null,
  nome: '',
  sigla: '',
  ativo: true,
};

export function AlmoxarifadoUnidadeModal({
  isOpen,
  unidades,
  saving,
  onClose,
  onSave,
  onToggle,
}: AlmoxarifadoUnidadeModalProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UnidadeFormState>(initialForm);

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
    <Modal isOpen={isOpen} onClose={handleClose} title="Unidades" maxWidth="680px">
      <div className="almox-category-header">
        <div>
          <strong>Gerencie as unidades de medida</strong>
          <p className="text-muted">Padronize como as quantidades aparecem no estoque e nos pedidos.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setForm(initialForm);
            setFormOpen(true);
          }}
        >
          <Plus size={17} /> Adicionar unidade
        </button>
      </div>

      {formOpen && (
        <form className="almox-category-form" onSubmit={handleSubmit}>
          <div className="almox-form-grid">
            <FormField
              label="Nome da unidade"
              name="unidade_nome"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              floating={false}
              required
            />
            <FormField
              label="Sigla"
              name="unidade_sigla"
              value={form.sigla}
              onChange={(event) => setForm({ ...form, sigla: event.target.value })}
              floating={false}
              required
            />
          </div>
          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : form.id ? 'Atualizar unidade' : 'Salvar unidade'}
            </button>
          </div>
        </form>
      )}

      <div className="almox-category-list">
        {unidades.length === 0 ? (
          <div className="empty-state">Nenhuma unidade cadastrada.</div>
        ) : unidades.map((unidade) => (
          <div key={unidade.id} className={`almox-category-row ${!unidade.ativo ? 'is-inactive' : ''}`}>
            <div>
              <span className="almox-unit-pill">{unidade.sigla}</span>
              <strong>{unidade.nome}</strong>
              {!unidade.ativo && <small>Inativa</small>}
            </div>
            <div className="almox-actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setForm({
                    id: unidade.id,
                    nome: unidade.nome,
                    sigla: unidade.sigla,
                    ativo: unidade.ativo,
                  });
                  setFormOpen(true);
                }}
              >
                <Edit2 size={14} /> Editar
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => onToggle(unidade)} disabled={saving}>
                {unidade.ativo ? 'Inativar' : 'Reativar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

