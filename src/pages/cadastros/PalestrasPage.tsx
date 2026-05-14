import {
  ChevronLeft,
  Image as ImageIcon,
  Loader,
  Mic,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { useEncontros } from '../../contexts/EncontroContext';
import { encontroService } from '../../services/encontroService';
import { palestraService } from '../../services/palestraService';
import { pessoaService } from '../../services/pessoaService';

import type { Encontro } from '../../types/encontro';
import type { Palestra, PalestraFormData } from '../../types/palestra';
import type { Pessoa } from '../../types/pessoa';

export function PalestrasPage() {
  const navigate = useNavigate();
  const { encontros, encontroAtivo } = useEncontros();

  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
  const [palestras, setPalestras] = useState<Palestra[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPalestra, setEditingPalestra] = useState<Palestra | null>(null);

  // Deletar
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [palestraToDelete, setPalestraToDelete] = useState<Palestra | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<PalestraFormData>({
    encontro_id: '',
    titulo: '',
    palestrante_nome: '',
    palestrante_foto_url: null,
    resumo: '',
    ordem: 0,
    pessoa_id: null
  });

  // ── Seleciona encontro ativo por padrão ───────────────────────────
  useEffect(() => {
    if (encontroAtivo && !selectedEncontroId) {
      setSelectedEncontroId(encontroAtivo.id);
    } else if (encontros.length > 0 && !selectedEncontroId) {
      setSelectedEncontroId(encontros[encontros.length - 1].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const loadPalestras = useCallback(async () => {
    if (!selectedEncontroId) return;
    setIsLoading(true);
    try {
      const data = await palestraService.listarPorEncontro(selectedEncontroId);
      setPalestras(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar palestras.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadPalestras();
  }, [loadPalestras]);

  const handleOpenModal = (palestra?: Palestra) => {
    if (palestra) {
      setEditingPalestra(palestra);
      setFormData({
        encontro_id: palestra.encontro_id,
        titulo: palestra.titulo,
        palestrante_nome: palestra.palestrante_nome ?? '',
        palestrante_foto_url: palestra.palestrante_foto_url,
        resumo: palestra.resumo ?? '',
        ordem: palestra.ordem,
        pessoa_id: palestra.pessoa_id
      });
    } else {
      setEditingPalestra(null);
      setFormData({
        encontro_id: selectedEncontroId,
        titulo: '',
        palestrante_nome: '',
        palestrante_foto_url: null,
        resumo: '',
        ordem: palestras.length > 0 ? Math.max(...palestras.map(p => p.ordem)) + 1 : 1,
        pessoa_id: null
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.encontro_id || !formData.titulo) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingPalestra) {
        await palestraService.atualizar(editingPalestra.id, formData);
        toast.success('Palestra atualizada!');
      } else {
        await palestraService.criar(formData);
        toast.success('Palestra criada!');
      }
      setIsModalOpen(false);
      loadPalestras();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar palestra.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (palestra: Palestra) => {
    setPalestraToDelete(palestra);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!palestraToDelete) return;
    
    setIsDeleting(true);
    try {
      await palestraService.excluir(palestraToDelete.id);
      toast.success('Palestra excluída!');
      loadPalestras();
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir palestra.');
    } finally {
      setIsDeleting(false);
      setPalestraToDelete(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('Enviando foto...');
    try {
      const url = await palestraService.uploadFoto(file);
      setFormData(prev => ({ ...prev, palestrante_foto_url: url }));
      toast.success('Foto enviada!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar foto.', { id: toastId });
    }
  };

  return (
    <main className="main-content container fade-in" style={{ paddingBottom: '4rem' }}>
      <header className="page-header" style={{
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/cadastros')} className="icon-btn">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Palestras</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted-text)' }}>
              Cronograma e palestrantes do encontro
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '250px' }}>
            <LiveSearchSelect<Encontro>
              value={selectedEncontroId}
              onChange={(val) => setSelectedEncontroId(val)}
              fetchData={async (search, page) => encontroService.buscarComPaginacao(search, page)}
              getOptionLabel={(e) => `${e.nome}${e.ativo ? ' (Ativo)' : ''}`}
              getOptionValue={(e) => String(e.id)}
              placeholder="Selecione o Encontro"
              initialOptions={encontros}
            />
          </div>
          <button className="btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nova Palestra
          </button>
        </div>
      </header>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader className="animate-spin text-primary" size={40} />
        </div>
      ) : palestras.length === 0 ? (
        <div className="card text-center" style={{ padding: '4rem' }}>
          <Mic size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p style={{ color: 'var(--muted-text)' }}>Nenhuma palestra cadastrada para este encontro.</p>
          <button className="btn-text" onClick={() => handleOpenModal()}>Começar agora</button>
        </div>
      ) : (
        <div className="card-grid">
          {palestras.map((palestra) => (
            <article key={palestra.id} className="card fade-in" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '2px solid var(--border-color)'
                  }}>
                    {palestra.palestrante_foto_url ? (
                      <img src={palestra.palestrante_foto_url} alt={palestra.palestrante_nome || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Mic size={20} style={{ opacity: 0.3 }} />
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Palestra {palestra.ordem}
                    </span>
                    <h3 style={{ margin: '0.1rem 0', fontSize: '1.1rem' }}>{palestra.titulo}</h3>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button className="icon-btn" onClick={() => handleOpenModal(palestra)} title="Editar"><Pencil size={16} /></button>
                  <button className="icon-btn text-danger" onClick={() => handleDeleteClick(palestra)} title="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Palestrante:</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted-text)' }}>{palestra.palestrante_nome || '—'}</p>
              </div>

              {palestra.resumo && (
                <p style={{
                  margin: 0,
                  fontSize: '0.85rem',
                  color: 'var(--muted-text)',
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {palestra.resumo}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* ── Modal de Cadastro ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingPalestra ? 'Editar Palestra' : 'Nova Palestra'}
        maxWidth="700px"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Título da Palestra *</label>
            <input
              className="form-input"
              value={formData.titulo}
              onChange={e => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Ex: Espiritualidade, Família, etc."
              required
            />
          </div>

          <div className="form-row">
            <div className="col-8">
              <div className="form-group">
                <label className="form-label">Palestrante (Vincular Pessoa)</label>
                <LiveSearchSelect<Pessoa>
                  value={formData.pessoa_id ?? ''}
                  onChange={(val, item) => setFormData(prev => ({
                    ...prev,
                    pessoa_id: val || null,
                    palestrante_nome: item ? item.nome_completo : prev.palestrante_nome
                  }))}
                  fetchData={async (busca, pag) => {
                    const res = await pessoaService.buscarComPaginacao(busca, pag + 1);
                    return res.data;
                  }}
                  getOptionLabel={p => p.nome_completo}
                  getOptionValue={p => p.id}
                  placeholder="Opcional: vincular a uma pessoa do sistema"
                  initialOptions={formData.pessoa_id && formData.palestrante_nome ? [{ id: formData.pessoa_id, nome_completo: formData.palestrante_nome } as Pessoa] : []}
                />
              </div>
            </div>
            <div className="col-4">
              <div className="form-group">
                <label className="form-label">Ordem</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.ordem}
                  onChange={e => setFormData(prev => ({ ...prev, ordem: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>

          {!formData.pessoa_id && (
            <div className="form-group">
              <label className="form-label">Nome do Palestrante (Externo)</label>
              <input
                className="form-input"
                value={formData.palestrante_nome ?? ''}
                onChange={e => setFormData(prev => ({ ...prev, palestrante_nome: e.target.value }))}
                placeholder="Nome de quem irá palestrar"
              />
            </div>
          )}

          <div className="form-group" style={{ backgroundColor: 'var(--surface-2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <label className="form-label" style={{ marginBottom: '1rem', display: 'block', fontWeight: 600 }}>Foto do Palestrante</label>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '16px',
                backgroundColor: 'var(--surface-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: '2px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0
              }}>
                {formData.palestrante_foto_url ? (
                  <img src={formData.palestrante_foto_url} alt="Palestrante" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', opacity: 0.3 }}>
                    <ImageIcon size={40} />
                    <p style={{ fontSize: '0.7rem', margin: '0.25rem 0 0' }}>Sem foto</p>
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-text)', marginBottom: '1rem' }}>
                  Selecione uma foto profissional para o palestrante. Formatos suportados: JPG, PNG.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="file"
                    id="palestrante-foto"
                    hidden
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="palestrante-foto" className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={16} /> {formData.palestrante_foto_url ? 'Alterar Foto' : 'Adicionar Foto'}
                  </label>
                  {formData.palestrante_foto_url && (
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, palestrante_foto_url: null }))} className="btn-ghost text-danger" style={{ fontSize: '0.85rem' }}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Resumo / Descrição da Palestra</label>
            <RichTextEditor
              content={formData.resumo ?? ''}
              onChange={content => setFormData(prev => ({ ...prev, resumo: content }))}
              placeholder="Descreva os principais pontos que serão abordados..."
              minHeight="250px"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost" disabled={isSaving}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSaving} style={{ minWidth: '140px' }}>
              {isSaving ? <Loader className="animate-spin" size={18} /> : (editingPalestra ? 'Atualizar Palestra' : 'Criar Palestra')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Excluir Palestra"
        message={
          <>
            Deseja realmente excluir a palestra <strong>{palestraToDelete?.titulo}</strong>?
            <br />Esta ação não pode ser desfeita.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          setIsDeleteDialogOpen(false);
          setPalestraToDelete(null);
        }}
        isLoading={isDeleting}
        isDestructive={true}
      />
    </main>
  );
}
