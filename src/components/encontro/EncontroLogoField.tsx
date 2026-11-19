import { Download, ExternalLink, Eye, Image as ImageIcon, Info, Pencil, Upload, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { encontroService } from '../../services/encontroService';
import { userFacingError } from '../../utils/userFacingError';
import { Modal } from '../ui/Modal';
import './EncontroLogoField.css';

interface EncontroLogoFieldProps {
    logoUrl: string | null;
    encontroNome?: string;
    /** Id do encontro; ausente na criação. */
    encontroId?: string;
    /** Quando informado (e sem `readOnlyMessage`), permite enviar, trocar e remover o logo. */
    onChange?: (url: string | null) => void;
    onUploadingChange?: (uploading: boolean) => void;
    /** Mensagem exibida quando o logo não pode ser alterado (ex.: encontro encerrado). */
    readOnlyMessage?: string;
    /** Rota onde o logo é alterado, exibida com dica quando o campo é apenas consulta. */
    editPath?: string;
}

const formatLabels: Record<string, string> = {
    webp: 'WebP',
    png: 'PNG',
    jpg: 'JPG',
    jpeg: 'JPG',
    svg: 'SVG',
    gif: 'GIF',
};

const mimeExtensions: Record<string, string> = {
    'image/webp': 'webp',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
    'image/gif': 'gif',
};

function urlExtension(url: string): string {
    try {
        const path = new URL(url, window.location.origin).pathname;
        return path.split('.').pop()?.toLowerCase() ?? '';
    } catch {
        return '';
    }
}

const sanitizeFileName = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '');

export function EncontroLogoField({
    logoUrl,
    encontroNome,
    encontroId,
    onChange,
    onUploadingChange,
    readOnlyMessage,
    editPath,
}: EncontroLogoFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const tooltipId = useId();
    const [uploading, setUploading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [dimensions, setDimensions] = useState<{ url: string; width: number; height: number } | null>(null);
    const editable = Boolean(onChange) && !readOnlyMessage;
    const currentDimensions = dimensions && dimensions.url === logoUrl ? dimensions : null;
    const format = logoUrl ? formatLabels[urlExtension(logoUrl)] : undefined;

    const setUploadingState = (value: boolean) => {
        setUploading(value);
        onUploadingChange?.(value);
    };

    const handleFile = async (file?: File) => {
        if (!file || !onChange) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Selecione um arquivo de imagem.');
            return;
        }

        setUploadingState(true);
        try {
            const url = await encontroService.uploadLogoEncontro(file, encontroId);
            onChange(url);
            toast.success('Logo enviado. Salve o encontro para confirmar.');
        } catch (error) {
            console.error('Erro ao enviar logo:', error);
            toast.error(userFacingError(error, 'Não foi possível enviar o logo. Tente novamente.'));
        } finally {
            setUploadingState(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleDownload = async () => {
        if (!logoUrl) return;
        try {
            const response = await fetch(logoUrl);
            if (!response.ok) throw new Error('Erro ao baixar logo.');
            const blob = await response.blob();
            const extension = mimeExtensions[blob.type] || urlExtension(logoUrl) || 'png';
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `logo-${sanitizeFileName(encontroNome || 'encontro') || 'encontro'}.${extension}`;
            link.click();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('Erro ao baixar logo:', error);
            toast.error('Não foi possível baixar o logo.');
        }
    };

    return (
        <div className="encontro-logo-field">
            <div className="encontro-logo-field__panel">
                <button
                    type="button"
                    className="encontro-logo-field__preview"
                    onClick={() => logoUrl && setViewerOpen(true)}
                    disabled={!logoUrl}
                    aria-label={logoUrl ? 'Visualizar logo em tamanho maior' : 'Nenhum logo cadastrado'}
                >
                    {logoUrl ? (
                        <img src={logoUrl} alt={`Logo ${encontroNome || 'do encontro'}`} />
                    ) : (
                        <span className="encontro-logo-field__empty">
                            <ImageIcon size={30} aria-hidden="true" />
                            <span>Sem logo</span>
                        </span>
                    )}
                </button>

                <div className="encontro-logo-field__body">
                    <div className="encontro-logo-field__actions">
                        {editable && (
                            <>
                                <input
                                    ref={inputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    data-testid="encontro-logo-input"
                                    onChange={(event) => handleFile(event.target.files?.[0])}
                                />
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => inputRef.current?.click()}
                                    disabled={uploading}
                                >
                                    <Upload size={16} aria-hidden="true" />
                                    {uploading ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
                                </button>
                            </>
                        )}
                        {logoUrl && (
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setViewerOpen(true)}>
                                    <Eye size={16} aria-hidden="true" /> Visualizar
                                </button>
                                <button type="button" className="btn-secondary" onClick={handleDownload}>
                                    <Download size={16} aria-hidden="true" /> Baixar
                                </button>
                                {editable && (
                                    <button
                                        type="button"
                                        className="btn-secondary encontro-logo-field__remove"
                                        onClick={() => onChange?.(null)}
                                        disabled={uploading}
                                    >
                                        <X size={16} aria-hidden="true" /> Remover
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {editable && (
                        <p className="encontro-logo-field__hint">
                            Opcional. Usado nos crachás, crachás de mesa, placas, identificação de carros e Quadrante.
                            Prefira imagem quadrada ou com fundo transparente; ela é convertida para WebP automaticamente.
                        </p>
                    )}

                    {readOnlyMessage && (
                        <p className="encontro-logo-field__hint" role="status">{readOnlyMessage}</p>
                    )}

                    {editPath && (
                        <div className="encontro-logo-field__managed">
                            <span className="encontro-logo-field__tooltip">
                                <button
                                    type="button"
                                    className="encontro-logo-field__tooltip-trigger"
                                    aria-label="Onde alterar o logo"
                                    aria-describedby={tooltipId}
                                >
                                    <Info size={16} aria-hidden="true" />
                                </button>
                                <span role="tooltip" id={tooltipId} className="encontro-logo-field__tooltip-bubble">
                                    O logo é cadastrado e atualizado no cadastro do encontro. A troca vale para
                                    crachás, impressos e Quadrante.
                                </span>
                            </span>
                            <Link to={editPath} className="encontro-logo-field__edit-link">
                                <Pencil size={14} aria-hidden="true" /> Alterar no cadastro do encontro
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={viewerOpen && Boolean(logoUrl)}
                onClose={() => setViewerOpen(false)}
                title={`Logo ${encontroNome || 'do encontro'}`}
                maxWidth="920px"
            >
                {logoUrl && (
                    <div className="encontro-logo-viewer">
                        <div className="encontro-logo-viewer__stage">
                            <img
                                src={logoUrl}
                                alt={`Logo ${encontroNome || 'do encontro'} em tamanho ampliado`}
                                onLoad={(event) => setDimensions({
                                    url: logoUrl,
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight,
                                })}
                            />
                        </div>
                        <div className="encontro-logo-viewer__footer">
                            <span className="encontro-logo-viewer__meta">
                                {[
                                    currentDimensions ? `${currentDimensions.width} × ${currentDimensions.height} px` : null,
                                    format,
                                ].filter(Boolean).join(' · ')}
                                <small>O fundo xadrez indica as áreas transparentes.</small>
                            </span>
                            <div className="encontro-logo-viewer__actions">
                                <a className="btn-secondary" href={logoUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink size={16} aria-hidden="true" /> Abrir em nova aba
                                </a>
                                <button type="button" className="btn-secondary" onClick={handleDownload}>
                                    <Download size={16} aria-hidden="true" /> Baixar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
