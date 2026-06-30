import { Download, ExternalLink, FileText, Loader, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { resolveStorageReference } from '../../services/privateStorageService';

interface PaymentProofGalleryModalProps {
  title: string;
  entityName: string;
  urls: string[];
  onClose: () => void;
  onDelete?: (url: string) => Promise<void>;
}

const getProofType = (url: string) => {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|avif)$/.test(cleanUrl)) return 'image';
  if (cleanUrl.endsWith('.pdf')) return 'pdf';
  return 'file';
};

const getProofName = (url: string, index: number) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return name || `Comprovante ${index + 1}`;
  } catch {
    return `Comprovante ${index + 1}`;
  }
};

const downloadProof = async (url: string, index: number) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download indisponível');

    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = getProofName(url, index);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export function PaymentProofGalleryModal({
  title,
  entityName,
  urls,
  onClose,
  onDelete
}: PaymentProofGalleryModalProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [resolvedProofs, setResolvedProofs] = useState<Array<{
    source: string;
    url: string;
    error: boolean;
  }>>([]);
  const [loadingProofs, setLoadingProofs] = useState(true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingProofs(true);

    Promise.all(urls.map(async (source) => {
      try {
        return {
          source,
          url: await resolveStorageReference(source),
          error: false,
        };
      } catch (error) {
        console.error('Erro ao gerar acesso temporário ao comprovante:', error);
        return { source, url: '', error: true };
      }
    })).then((proofs) => {
      if (active) {
        setResolvedProofs(proofs);
        setLoadingProofs(false);
      }
    });

    return () => {
      active = false;
    };
  }, [urls]);

  const handleDownloadAll = async () => {
    for (const [index, proof] of resolvedProofs.entries()) {
      if (proof.url) await downloadProof(proof.url, index);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !onDelete) return;

    setDeletingUrl(deleteTarget);
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } finally {
      setDeletingUrl(null);
    }
  };

  return (
    <div
      className="modal-overlay compras-proof-gallery-overlay"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content animate-fade-in compras-proof-gallery"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header compras-proof-gallery__header">
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{title}</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.62 }}>
              {entityName} · {urls.length} comprovante(s)
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {urls.length > 1 && (
              <button type="button" className="btn-secondary compras-proof-gallery__download-all" onClick={handleDownloadAll}>
                <Download size={16} /> <span>Baixar todos</span>
              </button>
            )}
            <button type="button" className="btn-icon" onClick={onClose} style={{ margin: 0, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
        </div>
        <div className={`modal-body compras-proof-gallery__body ${urls.length === 1 ? 'compras-proof-gallery__body--single' : ''}`}>
          {loadingProofs && (
            <div className="compras-proof-gallery__file-placeholder">
              <Loader className="animate-spin" size={32} />
              <span>Gerando acesso seguro aos comprovantes...</span>
            </div>
          )}
          <div className={`compras-proof-gallery__grid ${urls.length === 1 ? 'compras-proof-gallery__grid--single' : ''}`}>
            {!loadingProofs && resolvedProofs.map((proof, index) => {
              const proofType = getProofType(proof.source);
              const proofName = getProofName(proof.source, index);

              return (
                <article key={`${proof.source}-${index}`} className="compras-proof-gallery__item">
                  <div className="compras-proof-gallery__preview">
                    {proof.error ? (
                      <div className="compras-proof-gallery__file-placeholder">
                        <FileText size={38} />
                        <span>Não foi possível liberar o acesso a este comprovante</span>
                      </div>
                    ) : proofType === 'image' ? (
                      <img src={proof.url} alt={`Prévia do comprovante ${index + 1}`} />
                    ) : proofType === 'pdf' ? (
                      <a href={proof.url} target="_blank" rel="noreferrer" className="compras-proof-gallery__file-placeholder">
                        <FileText size={38} />
                        <span>PDF disponível para abrir em nova aba</span>
                        <strong><ExternalLink size={14} /> Abrir PDF</strong>
                      </a>
                    ) : (
                      <div className="compras-proof-gallery__file-placeholder">
                        <FileText size={38} />
                        <span>Prévia indisponível</span>
                      </div>
                    )}
                  </div>
                  <div className="compras-proof-gallery__item-footer">
                    <div title={proofName}>
                      <strong>Comprovante {index + 1}</strong>
                      <span>{proofName}</span>
                    </div>
                    <div className="compras-proof-gallery__actions">
                      <a href={proof.url || undefined} target="_blank" rel="noreferrer" className="btn-secondary" aria-disabled={!proof.url}>
                        <FileText size={15} /> Ver
                      </a>
                      <button type="button" className="btn-secondary" onClick={() => downloadProof(proof.url, index)} disabled={!proof.url}>
                        <Download size={15} /> Baixar
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          className="btn-secondary compras-proof-gallery__delete"
                          onClick={() => setDeleteTarget(proof.source)}
                          disabled={deletingUrl === proof.source}
                        >
                          {deletingUrl === proof.source ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Excluir comprovante"
        message="Deseja realmente excluir este comprovante? Esta ação não poderá ser desfeita."
        confirmText="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={!!deletingUrl}
        isDestructive
      />
    </div>
  );
}
