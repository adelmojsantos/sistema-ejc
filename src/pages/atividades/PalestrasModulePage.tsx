import { Camera, Copy, ImagePlus, Loader, Mic2, Minus, Pencil, Plus, SlidersHorizontal, Trash2, Upload, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { useEncontros } from '../../contexts/EncontroContext';
import { PalestraCopiaError, palestraService } from '../../services/palestraService';
import { pessoaService } from '../../services/pessoaService';
import type { Palestra, PalestraFormData } from '../../types/palestra';
import type { Pessoa } from '../../types/pessoa';

const htmlToText = (html?: string | null) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const emptyForm = (encontroId: string, ordem: number): PalestraFormData => ({
  encontro_id: encontroId,
  titulo: '',
  palestrante_nome: '',
  palestrante_foto_url: null,
  resumo: '',
  ordem,
  pessoa_id: null,
});

export function PalestrasModulePage() {
  const { encontros, encontroSelecionadoId: selectedEncontroId, encontroSelecionado } = useEncontros();
  const [palestras, setPalestras] = useState<Palestra[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [isPhotoActionSheetOpen, setIsPhotoActionSheetOpen] = useState(false);
  const [isListPhotoActionSheetOpen, setIsListPhotoActionSheetOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [photoModalPalestra, setPhotoModalPalestra] = useState<Palestra | null>(null);
  const [listPhotoTarget, setListPhotoTarget] = useState<Palestra | null>(null);
  const [tempPhotoPosition, setTempPhotoPosition] = useState(50);
  const [isSavingListPhoto, setIsSavingListPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [editingPalestra, setEditingPalestra] = useState<Palestra | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Palestra | null>(null);
  const [formData, setFormData] = useState<PalestraFormData>(emptyForm('', 1));
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [copyPreview, setCopyPreview] = useState<Palestra[]>([]);
  const [isLoadingCopyPreview, setIsLoadingCopyPreview] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const photoCameraInputRef = useRef<HTMLInputElement>(null);
  const listPhotoFileInputRef = useRef<HTMLInputElement>(null);
  const listPhotoCameraInputRef = useRef<HTMLInputElement>(null);

  const selectedEncontro = encontroSelecionado;
  const canCopyPalestras = !!selectedEncontro?.ativo && !isLoading && palestras.length === 0;

  // Encontros que começaram antes do encontro selecionado, do mais recente ao mais antigo.
  const encontrosAnteriores = useMemo(() => {
    if (!selectedEncontro) return [];
    return encontros
      .filter((encontro) => encontro.id !== selectedEncontro.id
        && !!encontro.data_inicio
        && (!selectedEncontro.data_inicio || encontro.data_inicio < selectedEncontro.data_inicio))
      .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  }, [encontros, selectedEncontro]);

  const loadPalestras = async () => {
    if (!selectedEncontroId) return;

    setIsLoading(true);
    try {
      setPalestras(await palestraService.listarPorEncontro(selectedEncontroId));
    } catch (error) {
      console.error('Erro ao carregar palestras:', error);
      toast.error('Não foi possível carregar as palestras.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPalestras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEncontroId]);

  const openCopyModal = () => {
    setCopySourceId('');
    setCopyPreview([]);
    setIsCopyModalOpen(true);
  };

  const closeCopyModal = () => {
    if (isCopying) return;
    setIsCopyModalOpen(false);
  };

  const handleCopySourceChange = async (encontroId: string) => {
    setCopySourceId(encontroId);
    setCopyPreview([]);
    if (!encontroId) return;

    setIsLoadingCopyPreview(true);
    try {
      const preview = await palestraService.listarPorEncontro(encontroId);
      setCopyPreview(preview);
    } catch (error) {
      console.error('Erro ao carregar palestras do encontro de origem:', error);
      toast.error('Não foi possível carregar as palestras do encontro escolhido.');
    } finally {
      setIsLoadingCopyPreview(false);
    }
  };

  const handleCopyPalestras = async () => {
    if (!selectedEncontroId || !copySourceId || copyPreview.length === 0) return;

    setIsCopying(true);
    try {
      const total = await palestraService.copiarDoEncontro(copySourceId, selectedEncontroId);
      toast.success(`${total} palestra(s) copiada(s). Complete palestrante, resumo e foto.`);
      setIsCopyModalOpen(false);
      await loadPalestras();
    } catch (error) {
      console.error('Erro ao copiar palestras:', error);
      toast.error(error instanceof PalestraCopiaError ? error.message : 'Não foi possível copiar as palestras.');
      await loadPalestras();
    } finally {
      setIsCopying(false);
    }
  };

  const openCreateModal = () => {
    const nextOrder = palestras.length > 0 ? Math.max(...palestras.map((palestra) => palestra.ordem)) + 1 : 1;
    setEditingPalestra(null);
    setFormData(emptyForm(selectedEncontroId, nextOrder));
    setIsFormModalOpen(true);
  };

  const openEditModal = (palestra: Palestra) => {
    setEditingPalestra(palestra);
    setFormData({
      encontro_id: palestra.encontro_id,
      titulo: palestra.titulo,
      palestrante_nome: palestra.palestrante_nome ?? '',
      palestrante_foto_url: palestra.palestrante_foto_url,
      resumo: palestra.resumo ?? '',
      ordem: palestra.ordem,
      pessoa_id: palestra.pessoa_id,
    });
    setIsFormModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsFormModalOpen(false);
    setEditingPalestra(null);
    setFormData(emptyForm(selectedEncontroId, 1));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEncontroId) {
      toast.error('Selecione um encontro.');
      return;
    }
    if (!formData.titulo.trim()) {
      toast.error('Informe o título da palestra.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: PalestraFormData = {
        ...formData,
        encontro_id: selectedEncontroId,
        titulo: formData.titulo.trim(),
        palestrante_nome: formData.palestrante_nome?.trim() || null,
        resumo: formData.resumo?.trim() || null,
        ordem: formData.ordem || 1,
      };

      if (editingPalestra) {
        await palestraService.atualizar(editingPalestra.id, payload);
        toast.success('Palestra atualizada.');
      } else {
        await palestraService.criar(payload);
        toast.success('Palestra criada.');
      }

      closeModal();
      await loadPalestras();
    } catch (error) {
      console.error('Erro ao salvar palestra:', error);
      toast.error('Não foi possível salvar a palestra.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsPhotoActionSheetOpen(false);
    const file = event.target.files?.[0];
    await processPhotoFile(file);
    event.target.value = '';
  };

  const processPhotoFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida.');
      return;
    }

    const toastId = toast.loading('Enviando foto...');
    setIsUploadingPhoto(true);
    try {
      const url = await palestraService.uploadFoto(file);
      setFormData((current) => ({ ...current, palestrante_foto_url: url }));
      toast.success('Foto enviada.', { id: toastId });
    } catch (error) {
      console.error('Erro ao enviar foto do palestrante:', error);
      toast.error('Não foi possível enviar a foto.', { id: toastId });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoAreaClick = () => {
    if (isUploadingPhoto) return;
    if (window.innerWidth <= 768) {
      setIsPhotoActionSheetOpen(true);
    } else {
      photoFileInputRef.current?.click();
    }
  };

  const handlePhotoDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPhoto(false);
    await processPhotoFile(event.dataTransfer.files?.[0]);
  };

  const handlePhotoDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPhoto(true);
  };

  const handlePhotoDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingPhoto(false);
  };

  const updatePalestraState = (id: string, updates: Partial<Palestra>) => {
    setPalestras((current) => current.map((palestra) => (
      palestra.id === id ? { ...palestra, ...updates } : palestra
    )));
    setPhotoModalPalestra((current) => current?.id === id ? { ...current, ...updates } : current);
    setListPhotoTarget((current) => current?.id === id ? { ...current, ...updates } : current);
  };

  const openListPhotoPicker = (palestra: Palestra) => {
    setListPhotoTarget(palestra);
    if (window.innerWidth <= 768) {
      setIsListPhotoActionSheetOpen(true);
    } else {
      listPhotoFileInputRef.current?.click();
    }
  };

  const handleListPhotoClick = (palestra: Palestra) => {
    if (palestra.palestrante_foto_url) {
      setPhotoModalPalestra(palestra);
      setListPhotoTarget(palestra);
      setTempPhotoPosition(palestra.palestrante_foto_posicao_y ?? 50);
      return;
    }
    openListPhotoPicker(palestra);
  };

  const processListPhotoFile = async (file?: File) => {
    if (!file || !listPhotoTarget) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida.');
      return;
    }

    const target = listPhotoTarget;
    const toastId = toast.loading('Enviando foto...');
    setIsSavingListPhoto(true);
    try {
      const url = await palestraService.uploadFoto(file);
      try {
        await palestraService.atualizar(target.id, {
          palestrante_foto_url: url,
          palestrante_foto_posicao_y: 50,
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : String((error as { message?: unknown })?.message ?? '');
        if (!message.includes('palestrante_foto_posicao_y')) throw error;
        await palestraService.atualizar(target.id, { palestrante_foto_url: url });
      }
      const updates = { palestrante_foto_url: url, palestrante_foto_posicao_y: 50 };
      updatePalestraState(target.id, updates);
      setTempPhotoPosition(50);
      toast.success('Foto atualizada.', { id: toastId });
    } catch (error) {
      console.error('Erro ao atualizar foto do palestrante:', error);
      toast.error('Não foi possível atualizar a foto.', { id: toastId });
    } finally {
      setIsSavingListPhoto(false);
    }
  };

  const handleListFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsListPhotoActionSheetOpen(false);
    await processListPhotoFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleSaveListPhotoPosition = async () => {
    if (!photoModalPalestra) return;
    setIsSavingListPhoto(true);
    try {
      await palestraService.atualizar(photoModalPalestra.id, {
        palestrante_foto_posicao_y: tempPhotoPosition,
      });
      updatePalestraState(photoModalPalestra.id, {
        palestrante_foto_posicao_y: tempPhotoPosition,
      });
      toast.success('Enquadramento atualizado.');
    } catch (error) {
      console.error('Erro ao ajustar foto do palestrante:', error);
      toast.error('Não foi possível salvar o enquadramento.');
    } finally {
      setIsSavingListPhoto(false);
    }
  };
  const handleDeletePhoto = async () => {
    if (!photoModalPalestra) return;
    const palestraId = photoModalPalestra.id;
    setIsDeletingPhoto(true);
    try {
      await palestraService.atualizar(palestraId, {
        palestrante_foto_url: null,
      });
      updatePalestraState(palestraId, {
        palestrante_foto_url: null,
        palestrante_foto_posicao_y: 50,
      });
      setPhotoModalPalestra(null);
      setListPhotoTarget(null);
      setTempPhotoPosition(50);
      toast.success('Foto removida.');
    } catch (error) {
      console.error('Erro ao remover foto do palestrante:', error);
      toast.error('Não foi possível remover a foto do palestrante.');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    try {
      await palestraService.excluir(deleteTarget.id);
      toast.success('Palestra removida.');
      setDeleteTarget(null);
      await loadPalestras();
    } catch (error) {
      console.error('Erro ao remover palestra:', error);
      toast.error('Não foi possível remover a palestra.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="container fade-in" style={{ paddingBottom: '3rem' }}>
      <PageHeader
        title="Palestras"
        subtitle="Cadastros"
        backPath="/cadastros"
      />

      <section className="palestras-toolbar">
        <button
          className="btn-primary palestras-new-btn"
          type="button"
          onClick={openCreateModal}
          disabled={!selectedEncontroId}
        >
          <Plus size={18} />
          Nova Palestra
        </button>
      </section>

      <section className="palestras-section">
        <div className="palestras-list-header">
          <div>
            <strong>{selectedEncontro ? `Palestras do ${selectedEncontro.nome}` : 'Selecione um encontro'}</strong>
            <p className="text-muted palestras-list-subtitle">Cronograma e palestrantes do encontro.</p>
          </div>
          <span className="text-muted palestras-count">
            {palestras.length} {palestras.length === 1 ? 'palestra' : 'palestras'}
          </span>
        </div>

        {isLoading ? (
          <div className="text-muted palestras-loading">
            <Loader className="animate-spin" size={18} />
            Carregando...
          </div>
        ) : palestras.length === 0 ? (
          <div className="empty-state palestras-empty">
            <Mic2 size={44} style={{ opacity: 0.28 }} />
            <p>Nenhuma palestra cadastrada para este encontro.</p>
            {canCopyPalestras && (
              <button className="btn btn-secondary palestras-copy-btn" type="button" onClick={openCopyModal}>
                <Copy size={16} />
                Copiar palestras de outro encontro
              </button>
            )}
          </div>
        ) : (
          <div className="pessoa-grid palestras-list">
            {palestras.map((palestra) => (
              <article key={palestra.id} className="pessoa-row palestras-row">
                <div className="pessoa-row-main palestras-row-main">
                  <button
                    type="button"
                    className="pessoa-avatar small palestras-row-avatar"
                    onClick={() => handleListPhotoClick(palestra)}
                    aria-label={palestra.palestrante_foto_url
                      ? `Abrir foto de ${palestra.palestrante_nome || 'palestrante'}`
                      : `Adicionar foto de ${palestra.palestrante_nome || 'palestrante'}`}
                    title={palestra.palestrante_foto_url ? 'Visualizar e ajustar foto' : 'Adicionar foto'}
                  >
                    {palestra.palestrante_foto_url ? (
                      <img
                        src={palestra.palestrante_foto_url}
                        alt={palestra.palestrante_nome ?? ''}
                        loading="lazy"
                        decoding="async"
                        style={{ objectPosition: `center ${palestra.palestrante_foto_posicao_y ?? 50}%` }}
                      />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                  </button>
                  <span className="pessoa-row-info">
                    <span className="pessoa-row-label">Palestra {palestra.ordem}</span>
                    <h3 className="pessoa-row-name">{palestra.titulo}</h3>
                    <span className="pessoa-row-sub">{palestra.palestrante_nome || 'Palestrante não informado'}</span>
                  </span>
                </div>

                <div className="pessoa-row-col palestras-summary-col">
                  <span className="pessoa-row-label">Resumo</span>
                  <span className="pessoa-row-value">{htmlToText(palestra.resumo) || 'Sem resumo'}</span>
                </div>

                <div className="pessoa-row-actions palestras-row-actions">
                  <button className="icon-btn" type="button" onClick={() => openEditModal(palestra)} title="Editar" aria-label="Editar palestra">
                    <Pencil size={16} />
                    <span className="palestras-action-label" aria-hidden="true">Editar</span>
                  </button>
                  <button className="icon-btn icon-btn-danger" type="button" onClick={() => setDeleteTarget(palestra)} title="Excluir" aria-label="Excluir palestra">
                    <Trash2 size={16} />
                    <span className="palestras-action-label" aria-hidden="true">Excluir</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={isFormModalOpen}
        onClose={closeModal}
        title={editingPalestra ? 'Editar Palestra' : 'Nova Palestra'}
        maxWidth="700px"
      >
        <form className="palestras-form" onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Título da Palestra *</label>
            <input
              className="form-input"
              value={formData.titulo}
              onChange={(event) => setFormData((current) => ({ ...current, titulo: event.target.value }))}
              placeholder="Ex: Família, Espiritualidade, Vocação..."
              required
            />
          </div>

          <div className="palestras-form-grid">
            <div className="form-group">
              <label className="form-label">Palestrante (Vincular Pessoa)</label>
              <LiveSearchSelect<Pessoa>
                value={formData.pessoa_id ?? ''}
                onChange={(value, item) => setFormData((current) => ({
                  ...current,
                  pessoa_id: value || null,
                  palestrante_nome: item ? item.nome_completo : current.palestrante_nome,
                }))}
                fetchData={async (search, page) => {
                  const result = await pessoaService.buscarComPaginacao(search, page + 1);
                  return result.data;
                }}
                getOptionLabel={(pessoa) => pessoa.nome_completo}
                getOptionValue={(pessoa) => pessoa.id}
                placeholder="Opcional: vincular a uma pessoa do sistema"
                initialOptions={formData.pessoa_id && formData.palestrante_nome
                  ? [{ id: formData.pessoa_id, nome_completo: formData.palestrante_nome } as Pessoa]
                  : []}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ordem</label>
              <input
                className="form-input"
                type="number"
                min={1}
                value={formData.ordem ?? 1}
                onChange={(event) => setFormData((current) => ({ ...current, ordem: Number(event.target.value) || 1 }))}
              />
            </div>
          </div>

          {!formData.pessoa_id && (
            <div className="form-group">
              <label className="form-label">Nome do Palestrante (Externo)</label>
              <input
                className="form-input"
                value={formData.palestrante_nome ?? ''}
                onChange={(event) => setFormData((current) => ({ ...current, palestrante_nome: event.target.value }))}
                placeholder="Nome de quem irá palestrar"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Foto do Palestrante</label>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                className={`palestras-photo-area ${isDraggingPhoto ? 'dragging' : ''} ${formData.palestrante_foto_url ? 'has-photo' : ''}`}
                onClick={handlePhotoAreaClick}
                onDrop={handlePhotoDrop}
                onDragOver={handlePhotoDragOver}
                onDragLeave={handlePhotoDragLeave}
                role="button"
                tabIndex={0}
                aria-label={formData.palestrante_foto_url ? 'Alterar foto do palestrante' : 'Adicionar foto do palestrante'}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handlePhotoAreaClick();
                  }
                }}
              >
                {formData.palestrante_foto_url ? (
                  <img src={formData.palestrante_foto_url} alt="Foto do palestrante" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="palestras-photo-placeholder">
                    {isDraggingPhoto ? (
                      <>
                        <Upload size={32} />
                        <span>Solte a foto aqui</span>
                      </>
                    ) : (
                      <>
                        <ImagePlus size={32} />
                        <span>Clique ou arraste</span>
                        <span style={{ fontSize: '0.65rem' }}>uma foto aqui</span>
                      </>
                    )}
                  </div>
                )}

                {formData.palestrante_foto_url && !isUploadingPhoto && (
                  <div className="palestras-photo-overlay">
                    <Camera size={20} />
                    <span>Alterar</span>
                  </div>
                )}

                {formData.palestrante_foto_url && !isUploadingPhoto && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((current) => ({ ...current, palestrante_foto_url: null }));
                    }}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                      transition: 'all 0.2s'
                    }}
                    title="Remover Foto"
                  >
                    <Trash2 size={14} color="white" />
                  </button>
                )}

                {isUploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                    <Loader className="animate-spin" color="white" size={24} />
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Arraste e solte uma imagem ou clique no box para selecionar.
                  <br />
                  Formatos suportados: JPG, PNG e WEBP.
                </p>
              </div>
            </div>

            <input
              ref={photoFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={isUploadingPhoto}
            />

            <input
              ref={photoCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={isUploadingPhoto}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Resumo / Descrição da Palestra</label>
            <RichTextEditor
              content={formData.resumo ?? ''}
              onChange={(content) => setFormData((current) => ({ ...current, resumo: content }))}
              placeholder="Descreva os principais pontos que serão abordados..."
              minHeight="250px"
            />
          </div>

          <div className="palestras-form-actions">
            <button className="btn btn-secondary" type="button" onClick={closeModal} disabled={isSaving}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Palestra'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!photoModalPalestra}
        onClose={() => setPhotoModalPalestra(null)}
        title={photoModalPalestra?.palestrante_nome || 'Foto do Palestrante'}
        maxWidth="min(92vw, 760px)"
      >
        {photoModalPalestra && (
          <div className="palestras-list-photo-modal">
            <div className="palestras-list-photo-frame">
              {photoModalPalestra.palestrante_foto_url ? (
                <img
                  src={photoModalPalestra.palestrante_foto_url}
                  alt={photoModalPalestra.palestrante_nome || 'Palestrante'}
                  style={{ objectPosition: `center ${tempPhotoPosition}%` }}
                />
              ) : (
                <div className="palestras-photo-placeholder">
                  <User size={36} />
                  <span>Sem foto cadastrada</span>
                </div>
              )}
              {isSavingListPhoto && (
                <div className="palestras-list-photo-loading">
                  <Loader className="animate-spin" size={28} />
                </div>
              )}
            </div>

            {photoModalPalestra.palestrante_foto_url && (
              <div className="palestras-list-photo-adjust">
                <label>Ajustar enquadramento vertical</label>
                <div className="palestras-list-photo-adjust-control">
                  <button type="button" onClick={() => setTempPhotoPosition((value) => Math.max(0, value - 2))} aria-label="Subir enquadramento">
                    <Minus size={16} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={tempPhotoPosition}
                    onChange={(event) => setTempPhotoPosition(Number(event.target.value))}
                  />
                  <button type="button" onClick={() => setTempPhotoPosition((value) => Math.min(100, value + 2))} aria-label="Descer enquadramento">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            )}

            <div className="palestras-list-photo-actions">
              <button type="button" className="btn-secondary" onClick={() => openListPhotoPicker(photoModalPalestra)} disabled={isSavingListPhoto || isDeletingPhoto}>
                <Camera size={16} />
                Alterar foto
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeletePhoto}
                disabled={isSavingListPhoto || isDeletingPhoto}
              >
                <Trash2 size={16} />
                Remover foto
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveListPhotoPosition}
                disabled={isSavingListPhoto || isDeletingPhoto || !photoModalPalestra.palestrante_foto_url}>
                  <SlidersHorizontal size={16} />
                  Salvar ajuste
                </button>
            </div>
          </div>
        )}
      </Modal>

      <input
        ref={listPhotoFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleListFileUpload}
        disabled={isSavingListPhoto}
      />
      <input
        ref={listPhotoCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleListFileUpload}
        disabled={isSavingListPhoto}
      />

      <Modal
        isOpen={isCopyModalOpen}
        onClose={closeCopyModal}
        title="Copiar palestras"
        maxWidth="560px"
      >
        <div className="palestras-copy">
          <p className="text-muted palestras-copy-intro">
            Copia o título e a ordem das palestras para o {selectedEncontro?.nome ?? 'encontro atual'}.
            Palestrante, resumo e foto ficam em branco para preencher depois.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="palestras-copy-source">Copiar do encontro</label>
            <select
              id="palestras-copy-source"
              className="form-input"
              value={copySourceId}
              onChange={(event) => handleCopySourceChange(event.target.value)}
              disabled={isCopying || encontrosAnteriores.length === 0}
            >
              <option value="">
                {encontrosAnteriores.length === 0 ? 'Nenhum encontro anterior disponível' : 'Selecione um encontro'}
              </option>
              {encontrosAnteriores.map((encontro) => (
                <option key={encontro.id} value={encontro.id}>{encontro.nome}</option>
              ))}
            </select>
          </div>

          {copySourceId && (
            <div className="palestras-copy-preview">
              {isLoadingCopyPreview ? (
                <span className="text-muted palestras-loading">
                  <Loader className="animate-spin" size={16} />
                  Carregando palestras...
                </span>
              ) : copyPreview.length === 0 ? (
                <span className="text-muted">Este encontro não possui palestras cadastradas.</span>
              ) : (
                <ol>
                  {copyPreview.map((palestra) => (
                    <li key={palestra.id}>
                      <span className="palestras-copy-order">{palestra.ordem}</span>
                      <span>{palestra.titulo}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="palestras-form-actions">
            <button className="btn btn-secondary" type="button" onClick={closeCopyModal} disabled={isCopying}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleCopyPalestras}
              disabled={isCopying || isLoadingCopyPreview || copyPreview.length === 0}
            >
              {isCopying
                ? 'Copiando...'
                : copyPreview.length > 0
                  ? `Copiar ${copyPreview.length} ${copyPreview.length === 1 ? 'palestra' : 'palestras'}`
                  : 'Copiar palestras'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Remover Palestra"
        message={`Deseja remover "${deleteTarget?.titulo ?? 'esta palestra'}"?`}
        confirmText="Remover"
        cancelText="Cancelar"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSaving}
        isDestructive
      />

      {isPhotoActionSheetOpen && (
        <div className="photo-actions-modal-overlay" onClick={() => setIsPhotoActionSheetOpen(false)}>
          <div className="photo-actions-modal" onClick={(event) => event.stopPropagation()}>
            <div className="photo-actions-header">
              <h3>Foto do Palestrante</h3>
              <p>Como você deseja inserir a foto?</p>
            </div>
            <div className="photo-actions-buttons">
              <button
                type="button"
                onClick={() => {
                  setIsPhotoActionSheetOpen(false);
                  photoCameraInputRef.current?.click();
                }}
                className="photo-action-btn"
              >
                <Camera size={20} />
                Tirar Foto (Câmera)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPhotoActionSheetOpen(false);
                  photoFileInputRef.current?.click();
                }}
                className="photo-action-btn"
              >
                <ImagePlus size={20} />
                Escolher da Galeria
              </button>
            </div>
            <button type="button" className="photo-actions-cancel" onClick={() => setIsPhotoActionSheetOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isListPhotoActionSheetOpen && (
        <div className="photo-actions-modal-overlay" onClick={() => setIsListPhotoActionSheetOpen(false)}>
          <div className="photo-actions-modal" onClick={(event) => event.stopPropagation()}>
            <div className="photo-actions-header">
              <h3>Foto do Palestrante</h3>
              <p>Como você deseja inserir a foto?</p>
            </div>
            <div className="photo-actions-buttons">
              <button
                type="button"
                onClick={() => {
                  setIsListPhotoActionSheetOpen(false);
                  listPhotoCameraInputRef.current?.click();
                }}
                className="photo-action-btn"
              >
                <Camera size={20} />
                Tirar Foto (Câmera)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsListPhotoActionSheetOpen(false);
                  listPhotoFileInputRef.current?.click();
                }}
                className="photo-action-btn"
              >
                <ImagePlus size={20} />
                Escolher da Galeria
              </button>
            </div>
            <button type="button" className="photo-actions-cancel" onClick={() => setIsListPhotoActionSheetOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`
        .palestras-header-filter {
          min-width: min(360px, 100%);
        }

        .palestras-toolbar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .palestras-new-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .palestras-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 1rem;
        }

        .palestras-list-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .palestras-loading,
        .palestras-empty {
          padding: 2rem;
        }

        .palestras-list-subtitle {
          margin: 0.25rem 0 0;
        }

        .palestras-count {
          white-space: nowrap;
          font-size: 0.85rem;
        }

        .palestras-empty {
          opacity: 1;
        }

        .palestras-empty p {
          margin: 0;
          color: var(--muted-text);
        }

        .palestras-copy-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          max-width: 100%;
          white-space: normal;
          text-align: center;
        }

        .palestras-copy {
          display: grid;
          gap: 1rem;
        }

        .palestras-copy-intro {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .palestras-copy-preview {
          max-height: 260px;
          overflow-y: auto;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--secondary-bg);
        }

        .palestras-copy-preview ol {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.5rem;
        }

        .palestras-copy-preview li {
          display: flex;
          align-items: baseline;
          gap: 0.6rem;
          font-size: 0.9rem;
        }

        .palestras-copy-order {
          flex: none;
          min-width: 1.5rem;
          font-weight: 700;
          color: var(--muted-text);
        }

        .palestras-action-label {
          display: none;
        }

        .palestras-loading {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .palestras-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 0;
          margin-top: 0;
        }

        .palestras-row {
          grid-template-columns: minmax(260px, 1.1fr) minmax(220px, 1fr) auto;
          width: 100%;
        }

        .palestras-row-avatar {
          overflow: hidden;
          background: var(--primary-color);
          color: white;
          border: 1px solid var(--border-color);
          padding: 0;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }

        .palestras-row-avatar:hover {
          border-color: var(--primary-color);
          transform: scale(1.04);
        }

        .palestras-row-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .palestras-list-photo-modal {
          display: grid;
          gap: 1rem;
        }

        .palestras-list-photo-frame {
          position: relative;
          width: 100%;
          height: min(58vh, 520px);
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--secondary-bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .palestras-list-photo-frame img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .palestras-list-photo-loading {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.48);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .palestras-list-photo-adjust {
          display: grid;
          gap: 0.65rem;
        }

        .palestras-list-photo-adjust label {
          font-size: 0.85rem;
          font-weight: 800;
        }

        .palestras-list-photo-adjust-control {
          display: grid;
          grid-template-columns: 38px 1fr 38px;
          align-items: center;
          gap: 0.55rem;
        }

        .palestras-list-photo-adjust-control button {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          color: var(--text-color);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .palestras-list-photo-adjust-control input {
          width: 100%;
          accent-color: var(--primary-color);
        }

        .palestras-list-photo-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .palestras-list-photo-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
        }

        .palestras-summary-col .pessoa-row-value {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          color: var(--muted-text);
          line-height: 1.4;
        }

        .palestras-form {
          display: grid;
          gap: 1rem;
        }

        .palestras-form-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 120px;
          gap: 1rem;
        }

        .palestras-photo-area {
          width: 140px;
          height: 140px;
          min-width: 140px;
          border-radius: 16px;
          background: var(--surface-2);
          border: 2.5px dashed var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.04);
        }

        .palestras-photo-area:hover {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
        }

        .palestras-photo-area.dragging {
          border-color: var(--primary-color);
          background: rgba(var(--primary-rgb), 0.08);
          box-shadow: 0 0 0 6px rgba(var(--primary-rgb), 0.15);
          transform: scale(1.02);
        }

        .palestras-photo-area.has-photo {
          border-style: solid;
          border-color: transparent;
        }

        .palestras-photo-area.has-photo:hover {
          border-color: var(--primary-color);
        }

        .palestras-photo-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          opacity: 0.35;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-color);
          transition: opacity 0.2s;
        }

        .palestras-photo-area:hover .palestras-photo-placeholder {
          opacity: 0.6;
        }

        .palestras-photo-area.dragging .palestras-photo-placeholder {
          opacity: 0.8;
          color: var(--primary-color);
        }

        .palestras-photo-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          color: white;
          font-weight: 700;
          font-size: 0.8rem;
          opacity: 0;
          transition: opacity 0.25s ease;
          border-radius: 14px;
          pointer-events: none;
        }

        .palestras-photo-area:hover .palestras-photo-overlay {
          opacity: 1;
        }

        /* Action Sheet Styles */
        .photo-actions-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: fadeIn 0.2s ease-out;
        }

        @media (min-width: 640px) {
          .photo-actions-modal-overlay {
            align-items: center;
          }
        }

        .photo-actions-modal {
          background: var(--card-bg, #ffffff);
          width: 100%;
          max-width: 500px;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          padding: 1.5rem;
          box-shadow: 0 -10px 25px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @media (min-width: 640px) {
          .photo-actions-modal {
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
            animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
        }

        .photo-actions-header {
          text-align: center;
        }

        .photo-actions-header h3 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-color);
        }

        .photo-actions-header p {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: var(--text-color);
          opacity: 0.7;
        }

        .photo-actions-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .photo-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: var(--secondary-bg, #f8f9fa);
          color: var(--text-color);
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .photo-action-btn:hover {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }

        .photo-actions-cancel {
          padding: 0.75rem;
          border-radius: 12px;
          border: none;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .photo-actions-cancel:hover {
          background: #ef4444;
          color: white;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .palestras-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color);
        }

        @media (max-width: 640px) {
          .palestras-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .palestras-list-header {
            align-items: baseline;
          }

          /* Card: foto à esquerda, textos alinhados numa coluna e ações com texto no rodapé. */
          .pessoa-row.palestras-row {
            grid-template-columns: 48px minmax(0, 1fr);
            grid-template-areas:
              "avatar info"
              "avatar summary"
              "actions actions";
            align-items: start;
            column-gap: 0.85rem;
            row-gap: 0.4rem;
          }

          .palestras-row .palestras-row-main {
            display: contents;
          }

          .pessoa-avatar.small.palestras-row-avatar {
            grid-area: avatar;
            width: 48px;
            height: 48px;
          }

          .palestras-row .pessoa-row-info {
            grid-area: info;
          }

          .palestras-row .pessoa-row-name {
            white-space: normal;
            font-size: 1rem;
            line-height: 1.3;
          }

          .palestras-summary-col {
            grid-area: summary;
            min-width: 0;
          }

          .palestras-summary-col .pessoa-row-label {
            display: none;
          }

          .pessoa-row-actions.palestras-row-actions {
            grid-area: actions;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
            min-width: 0;
            margin-top: 0.4rem;
            padding-top: 0.75rem;
            border-top: 1px solid var(--border-color);
          }

          .palestras-row-actions .icon-btn {
            width: auto;
            height: 40px;
            gap: 0.4rem;
            font-size: 0.875rem;
            font-weight: 600;
          }

          .palestras-row-actions .icon-btn-danger {
            color: var(--danger-text);
            background: var(--danger-bg);
            border-color: color-mix(in srgb, var(--danger-border) 40%, transparent);
          }

          .palestras-action-label {
            display: inline;
          }

          .palestras-empty {
            padding: 2rem 0;
          }

          .palestras-copy-btn {
            width: 100%;
          }

          .palestras-new-btn,
          .palestras-form-actions .btn {
            width: 100%;
            justify-content: center;
          }

          .palestras-row,
          .palestras-form-grid {
            grid-template-columns: 1fr;
          }

          .palestras-photo-area {
            width: 100%;
            height: 180px;
          }

          .palestras-summary-col {
            align-items: flex-start;
          }

          .palestras-list-photo-frame {
            height: min(48vh, 420px);
          }

          .palestras-list-photo-actions button {
            flex: 1;
          }

          .palestras-form-actions {
            flex-direction: column-reverse;
          }
        }
      `}</style>
    </main>
  );
}
