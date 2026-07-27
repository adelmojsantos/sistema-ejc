import type { FormEvent, ReactNode } from 'react';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import type { AlmoxarifadoCategoria, AlmoxarifadoItemFormData, AlmoxarifadoUnidade } from '../../types/almoxarifado';
import type { Equipe } from '../../types/equipe';

interface AlmoxarifadoItemModalProps {
  isOpen: boolean;
  title: string;
  form: AlmoxarifadoItemFormData;
  categorias: AlmoxarifadoCategoria[];
  unidades: AlmoxarifadoUnidade[];
  equipes: Equipe[];
  saving: boolean;
  submitLabel: string;
  onChange: (form: AlmoxarifadoItemFormData) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  footerExtra?: ReactNode;
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
  children: ReactNode;
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

export function AlmoxarifadoItemModal({
  isOpen,
  title,
  form,
  categorias,
  unidades,
  equipes,
  saving,
  submitLabel,
  onChange,
  onClose,
  onSubmit,
  footerExtra,
}: AlmoxarifadoItemModalProps) {
  const categoriasAtivas = categorias.filter((categoria) => categoria.ativo);
  const unidadesAtivas = unidades.filter((unidade) => unidade.ativo);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="720px">
      <form onSubmit={onSubmit}>
        <div className="almox-form-grid">
          <div className="span-2">
            <FormField label="Nome do item" name="nome" value={form.nome} onChange={(event) => onChange({ ...form, nome: event.target.value })} floating={false} required />
          </div>
          <SelectField label="Categoria" value={form.categoria_id} onChange={(value) => onChange({ ...form, categoria_id: value })}>
            <option value="">Sem categoria</option>
            {categoriasAtivas.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>)}
          </SelectField>
          <SelectField label="Unidade" value={form.unidade_id} onChange={(value) => onChange({ ...form, unidade_id: value })}>
            <option value="">Sem unidade</option>
            {unidadesAtivas.map((unidade) => <option key={unidade.id} value={unidade.id}>{unidade.nome} ({unidade.sigla})</option>)}
          </SelectField>
          <SelectField label="Equipe padrão" value={form.equipe_padrao_id} onChange={(value) => onChange({ ...form, equipe_padrao_id: value })}>
            <option value="">Uso geral</option>
            {equipes.map((equipe) => <option key={equipe.id} value={equipe.id}>{equipe.nome}</option>)}
          </SelectField>
          <FormField label="Marca preferida" name="marca_preferida" value={form.marca_preferida} onChange={(event) => onChange({ ...form, marca_preferida: event.target.value })} floating={false} />
          <div className="span-2">
            <FormField label="Fornecedor padrão" name="fornecedor_padrao" value={form.fornecedor_padrao} onChange={(event) => onChange({ ...form, fornecedor_padrao: event.target.value })} floating={false} />
          </div>
        </div>
        <div className="almox-modal-actions almox-modal-actions--split">
          <div>{footerExtra}</div>
          <div className="almox-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : submitLabel}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
