import { useEffect, useMemo, useState } from 'react';
import { Eye, FileText, Save, Trash2, Upload } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { useEncontros } from '../../contexts/EncontroContext';
import { posEncontroService } from '../../services/posEncontroService';
import type { PosEncontroFormData } from '../../types/posEncontro';
import { posEncontroFormDataVazio } from '../../types/posEncontro';

interface LocationState {
  encontroId?: string;
}

const formatFileSize = (size?: number | null) => {
  if (!size) return '';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

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
    .trim();
};

const buildTituloFromOrdem = (ordem: number) => `${ordem || 1}º Pós-Encontro`;

const acceptedFileTypes = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*';

export function PosEncontroFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const { encontros, encontroAtivo } = useEncontros();
  const isNew = !id || id === 'novo';
  const [formData, setFormData] = useState<PosEncontroFormData>(posEncontroFormDataVazio());
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shouldRemoveFile, setShouldRemoveFile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const selectedEncontro = useMemo(
    () => encontros.find((encontro) => encontro.id === formData.encontro_id) ?? null,
    [encontros, formData.encontro_id]
  );

  useEffect(() => {
    if (!isNew || formData.encontro_id || encontros.length === 0) return;

    const encontroId = state?.encontroId ?? encontroAtivo?.id ?? encontros[encontros.length - 1]?.id ?? '';
    setFormData((current) => ({
      ...current,
      encontro_id: encontroId,
    }));
  }, [encontroAtivo, encontros, formData.encontro_id, isNew, state?.encontroId]);

  useEffect(() => {
    if (!isNew || !formData.encontro_id || formData.ordem !== 1) return;

    async function loadNextOrder() {
      try {
        const items = await posEncontroService.listarPorEncontro(formData.encontro_id);
        setFormData((current) => ({ ...current, ordem: items.length + 1 }));
      } catch {
        // A ordem padrão ainda permite salvar; a listagem mostra o erro se houver problema maior.
      }
    }

    loadNextOrder();
  }, [formData.encontro_id, formData.ordem, isNew]);

  useEffect(() => {
    if (isNew || !id) return;
    const posEncontroId = id;

    async function loadItem() {
      setIsLoading(true);
      try {
        const item = await posEncontroService.obterPorId(posEncontroId);
        if (!item) {
          toast.error('Pós-encontro não encontrado.');
          navigate('/cadastros/pos-encontros');
          return;
        }

        setFormData({
          encontro_id: item.encontro_id,
          ordem: item.ordem,
          titulo: item.titulo,
          tema: item.tema ?? '',
          conteudo: item.conteudo ?? '',
          arquivo_path: item.arquivo_path,
          arquivo_nome: item.arquivo_nome,
          arquivo_tipo: item.arquivo_tipo,
          arquivo_tamanho: item.arquivo_tamanho,
          ativo: item.ativo,
        });
      } catch (error) {
        console.error('Erro ao carregar pós-encontro:', error);
        toast.error('Não foi possível carregar o pós-encontro.');
      } finally {
        setIsLoading(false);
      }
    }

    loadItem();
  }, [id, isNew, navigate]);

  const handleSave = async () => {
    if (!formData.encontro_id || !formData.tema?.trim()) {
      toast.error('Informe o encontro e o tema do pós-encontro.');
      return;
    }

    const hasConteudoDigitado = !!htmlToText(formData.conteudo);
    const hasArquivo = !!selectedFile || (!!formData.arquivo_path && !shouldRemoveFile);

    if (!hasConteudoDigitado && !hasArquivo) {
      toast.error('Digite o conteúdo do roteiro ou anexe um arquivo.');
      return;
    }

    setIsSaving(true);
    try {
      let arquivoPayload = {
        arquivo_path: formData.arquivo_path ?? null,
        arquivo_nome: formData.arquivo_nome ?? null,
        arquivo_tipo: formData.arquivo_tipo ?? null,
        arquivo_tamanho: formData.arquivo_tamanho ?? null,
      };

      if (shouldRemoveFile || selectedFile) {
        await posEncontroService.removerArquivoRoteiro(formData.arquivo_path);
        arquivoPayload = {
          arquivo_path: null,
          arquivo_nome: null,
          arquivo_tipo: null,
          arquivo_tamanho: null,
        };
      }

      if (selectedFile) {
        arquivoPayload = await posEncontroService.uploadArquivoRoteiro(formData.encontro_id, selectedFile);
      }

      const payload = {
        ...formData,
        ...arquivoPayload,
        titulo: buildTituloFromOrdem(formData.ordem),
        tema: formData.tema.trim(),
        conteudo: formData.conteudo?.trim() || null,
      };

      if (isNew) {
        await posEncontroService.criar(payload);
        toast.success('Pós-encontro cadastrado.');
      } else if (id) {
        await posEncontroService.atualizar(id, payload);
        toast.success('Pós-encontro atualizado.');
      }

      navigate('/cadastros/pos-encontros');
    } catch (error) {
      console.error('Erro ao salvar pós-encontro:', error);
      toast.error('Não foi possível salvar o pós-encontro.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasCurrentFile = !!formData.arquivo_path && !shouldRemoveFile && !selectedFile;
  const hasFilePreview = hasCurrentFile || !!selectedFile;

  const handleFileSelection = (file: File | null) => {
    setSelectedFile(file);
    if (file) setShouldRemoveFile(false);
  };

  const handleOpenSelectedFile = () => {
    if (!selectedFile) return;
    const url = URL.createObjectURL(selectedFile);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="container fade-in pos-form-page" style={{ paddingBottom: '3rem' }}>
      <PageHeader
        title={isNew ? 'Novo Pós-Encontro' : 'Editar Pós-Encontro'}
        subtitle={selectedEncontro?.nome ?? 'Cadastros'}
        backPath="/cadastros/pos-encontros"
      />

      {isLoading ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <section className="card pos-form-card">
          <div className="pos-form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="pos-form-encontro">Encontro</label>
              <select
                id="pos-form-encontro"
                className="form-input"
                value={formData.encontro_id}
                onChange={(event) => setFormData((current) => ({ ...current, encontro_id: event.target.value }))}
              >
                {encontros.map((encontro) => (
                  <option key={encontro.id} value={encontro.id}>
                    {encontro.edicao ? `${encontro.edicao}º EJC - ` : ''}{encontro.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pos-form-ordem">Ordem</label>
              <input
                id="pos-form-ordem"
                className="form-input"
                type="number"
                min={1}
                value={formData.ordem}
                onChange={(event) => setFormData((current) => ({ ...current, ordem: Number(event.target.value) || 1 }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pos-form-tema">Tema</label>
            <input
              id="pos-form-tema"
              className="form-input"
              value={formData.tema ?? ''}
              onChange={(event) => setFormData((current) => ({ ...current, tema: event.target.value }))}
              placeholder="Ex: Permanecer em Cristo"
              required
            />
          </div>

          <section className="pos-form-roteiro-card">
            <div className="pos-form-section-heading">
              <strong>Conteúdo do Pós-Encontro</strong>
              <p className="text-muted">
                Digite o roteiro abaixo ou anexe um arquivo pronto. Os círculos verão o texto formatado e também poderão abrir o anexo quando existir.
              </p>
            </div>
            <RichTextEditor
              content={formData.conteudo ?? ''}
              onChange={(content) => setFormData((current) => ({ ...current, conteudo: content }))}
              disabled={isSaving}
              minHeight="320px"
              placeholder="Perguntas, dinâmicas, frases bíblicas e orientações para os círculos..."
            />

            <div className="pos-form-upload-area">
              <div className="pos-form-upload-copy">
                <strong>Arquivo do roteiro</strong>
                <p className="text-muted">
                  PDF, Word, imagem ou texto. Arraste o arquivo para cá ou selecione pelo botão.
                </p>
              </div>

              {hasCurrentFile && (
                <div className="pos-form-file-current">
                  <FileText size={18} />
                  <div>
                    <strong>{formData.arquivo_nome}</strong>
                    <p className="text-muted" style={{ margin: '0.15rem 0 0' }}>{formatFileSize(formData.arquivo_tamanho)}</p>
                  </div>
                  <button
                    className="btn-secondary pos-form-file-action"
                    type="button"
                    onClick={() => formData.arquivo_path && posEncontroService.abrirArquivoRoteiro({ arquivo_path: formData.arquivo_path })}
                  >
                    <Eye size={16} />
                    Ver
                  </button>
                  <button
                    className="btn-secondary pos-form-file-action"
                    type="button"
                    onClick={() => document.getElementById('pos-form-file-input')?.click()}
                  >
                    <Upload size={16} />
                    Trocar
                  </button>
                  <button
                    className="btn-secondary pos-form-file-action pos-form-file-action-danger"
                    type="button"
                    onClick={() => setShouldRemoveFile(true)}
                  >
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}

              {selectedFile && (
                <div className="pos-form-file-current">
                  <FileText size={18} />
                  <div>
                    <strong>{selectedFile.name}</strong>
                    <p className="text-muted" style={{ margin: '0.15rem 0 0' }}>{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button className="btn-secondary pos-form-file-action" type="button" onClick={handleOpenSelectedFile}>
                    <Eye size={16} />
                    Ver
                  </button>
                  <button
                    className="btn-secondary pos-form-file-action"
                    type="button"
                    onClick={() => document.getElementById('pos-form-file-input')?.click()}
                  >
                    <Upload size={16} />
                    Trocar
                  </button>
                  <button className="btn-secondary pos-form-file-action pos-form-file-action-danger" type="button" onClick={() => setSelectedFile(null)}>
                    <Trash2 size={16} />
                    Excluir
                  </button>
                </div>
              )}

              {shouldRemoveFile && !selectedFile && (
                <div className="text-muted">O arquivo atual será removido ao salvar.</div>
              )}

              {!hasFilePreview && (
                <label
                  className={`pos-form-dropzone ${isDraggingFile ? 'dragging' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(false);
                    handleFileSelection(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <span className="pos-form-dropzone-icon">
                    <Upload size={24} />
                  </span>
                  <span className="pos-form-dropzone-text">
                    <strong>Anexar roteiro pronto</strong>
                    <small>Arraste e solte aqui ou clique para selecionar</small>
                  </span>
                </label>
              )}

              <input
                id="pos-form-file-input"
                type="file"
                accept={acceptedFileTypes}
                onChange={(event) => {
                  handleFileSelection(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
                hidden
              />
            </div>
          </section>


          <div className="pos-form-toggle-card">
            <div>
              <strong>Ativo</strong>
              <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Disponível para os círculos usarem no encontro.</p>
            </div>
            <div className="pos-form-toggle" role="group" aria-label="Status do pós-encontro">
              <button
                type="button"
                className={`pos-form-toggle-btn ${formData.ativo ? 'active-sim' : ''}`}
                onClick={() => setFormData((current) => ({ ...current, ativo: true }))}
              >
                Sim
              </button>
              <button
                type="button"
                className={`pos-form-toggle-btn ${!formData.ativo ? 'active-nao' : ''}`}
                onClick={() => setFormData((current) => ({ ...current, ativo: false }))}
              >
                Não
              </button>
            </div>
          </div>

          <div className="pos-form-actions">
            <button className="btn-secondary" type="button" onClick={() => navigate('/cadastros/pos-encontros')}>
              Cancelar
            </button>
            <button className="btn-primary" type="button" onClick={handleSave} disabled={isSaving}>
              <Save size={18} />
              {isSaving ? 'Salvando...' : 'Salvar pós-encontro'}
            </button>
          </div>
        </section>
      )}

      <style>{`
        .pos-form-page {
          max-width: 1180px;
        }

        .pos-form-card {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          max-width: 1040px;
          padding: 2rem;
        }

        .pos-form-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(140px, 180px);
          gap: 1rem;
        }

        .pos-form-toggle-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface-1);
        }

        .pos-form-roteiro-card {
          display: grid;
          gap: 1.25rem;
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--surface-1);
        }

        .pos-form-section-heading {
          display: grid;
          gap: 0.25rem;
        }

        .pos-form-section-heading strong {
          font-size: 1rem;
        }

        .pos-form-section-heading p {
          margin: 0;
          line-height: 1.45;
        }

        .pos-form-file-current {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto auto auto;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          background: var(--card-bg);
        }

        .pos-form-file-current strong {
          word-break: break-word;
        }

        .pos-form-file-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 42px;
          padding-inline: 0.85rem;
          white-space: nowrap;
        }

        .pos-form-file-action-danger {
          border-color: color-mix(in srgb, #ef4444 40%, var(--border-color));
          color: #ef4444;
        }

        .pos-form-file-action-danger:hover {
          background: color-mix(in srgb, #ef4444 12%, var(--card-bg));
        }

        .pos-form-upload-area {
          display: grid;
          gap: 0.85rem;
          padding: 1rem;
          border: 1px solid var(--border-color);
          border-radius: 14px;
        }

        .pos-form-upload-copy {
          display: grid;
          gap: 0.25rem;
        }

        .pos-form-upload-copy p {
          margin: 0;
        }

        .pos-form-dropzone {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.9rem;
          min-height: 108px;
          padding: 1rem;
          border: 1px solid color-mix(in srgb, #22c55e 40%, var(--border-color));
          border-radius: 12px;
          background: linear-gradient(135deg, color-mix(in srgb, #22c55e 14%, var(--card-bg)), color-mix(in srgb, #38bdf8 10%, var(--card-bg)));
          color: var(--text-primary);
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }

        .pos-form-dropzone:hover,
        .pos-form-dropzone.dragging {
          border-color: #22c55e;
          background: linear-gradient(135deg, color-mix(in srgb, #22c55e 20%, var(--card-bg)), color-mix(in srgb, #38bdf8 14%, var(--card-bg)));
          box-shadow: 0 14px 30px color-mix(in srgb, #22c55e 16%, transparent);
          transform: translateY(-1px);
        }

        .pos-form-dropzone-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: var(--primary);
          color: white;
          box-shadow: 0 10px 22px color-mix(in srgb, var(--primary) 28%, transparent);
        }

        .pos-form-dropzone-text {
          display: grid;
          gap: 0.2rem;
          text-align: left;
        }

        .pos-form-dropzone-text strong {
          font-size: 0.98rem;
        }

        .pos-form-dropzone-text small {
          color: var(--muted-text);
          font-weight: 700;
        }

        .pos-form-toggle {
          display: inline-flex;
          gap: 0.35rem;
          padding: 0.25rem;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--card-bg);
        }

        .pos-form-toggle-btn {
          min-width: 72px;
          border: 0;
          border-radius: 999px;
          padding: 0.55rem 0.9rem;
          background: transparent;
          color: var(--muted-text);
          font-weight: 800;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
        }

        .pos-form-toggle-btn.active-sim {
          background: var(--success-bg);
          color: var(--success-text);
          box-shadow: var(--shadow-sm);
        }

        .pos-form-toggle-btn.active-nao {
          background: color-mix(in srgb, #ef4444 12%, transparent);
          color: #ef4444;
          box-shadow: var(--shadow-sm);
        }

        .pos-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          flex-wrap: wrap;
          padding-top: 0.5rem;
        }

        .pos-form-actions .btn-primary,
        .pos-form-actions .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        @media (max-width: 640px) {
          .pos-form-card {
            max-width: none;
            padding: 1rem;
          }

          .pos-form-grid {
            grid-template-columns: 1fr;
          }

          .pos-form-toggle-card {
            align-items: stretch;
            flex-direction: column;
          }

          .pos-form-file-current {
            grid-template-columns: auto minmax(0, 1fr);
          }

          .pos-form-file-action {
            width: 100%;
          }

          .pos-form-file-current .pos-form-file-action:first-of-type {
            grid-column: 1 / -1;
          }

          .pos-form-file-current .pos-form-file-action:not(:first-of-type) {
            grid-column: span 1;
          }

          .pos-form-dropzone {
            align-items: stretch;
            flex-direction: column;
            min-height: 128px;
            text-align: center;
          }

          .pos-form-dropzone-icon {
            margin: 0 auto;
          }

          .pos-form-dropzone-text {
            text-align: center;
          }

          .pos-form-toggle {
            width: 100%;
          }

          .pos-form-toggle-btn {
            flex: 1;
          }

          .pos-form-actions {
            flex-direction: column-reverse;
          }

          .pos-form-actions .btn-primary,
          .pos-form-actions .btn-secondary {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
