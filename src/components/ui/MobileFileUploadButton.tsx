import { Camera, FolderOpen, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface MobileFileUploadButtonProps {
  label: string;
  disabled?: boolean;
  multiple?: boolean;
  accept?: string;
  className?: string;
  onFiles: (files: File[]) => void;
}

const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 768;

export function MobileFileUploadButton({
  label,
  disabled = false,
  multiple = true,
  accept = 'image/*,.pdf',
  className = 'btn-secondary btn-sm almox-proof-button',
  onFiles,
}: MobileFileUploadButtonProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length > 0) {
      onFiles(selectedFiles);
    }
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleOpen = () => {
    if (disabled) return;

    if (isMobileViewport()) {
      setActionSheetOpen(true);
      return;
    }

    galleryInputRef.current?.click();
  };

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={handleOpen}>
        <Upload size={16} />
        {label}
      </button>

      <input
        ref={galleryInputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
        style={{ display: 'none' }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
        style={{ display: 'none' }}
      />

      {actionSheetOpen && (
        <div className="mobile-file-sheet-overlay" onClick={() => setActionSheetOpen(false)}>
          <div className="mobile-file-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-file-sheet__header">
              <div>
                <h3>{label}</h3>
                <p>Escolha como deseja anexar o comprovante.</p>
              </div>
              <button type="button" className="mobile-file-sheet__close" onClick={() => setActionSheetOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="mobile-file-sheet__actions">
              <button
                type="button"
                onClick={() => {
                  setActionSheetOpen(false);
                  cameraInputRef.current?.click();
                }}
              >
                <Camera size={20} />
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionSheetOpen(false);
                  galleryInputRef.current?.click();
                }}
              >
                <FolderOpen size={20} />
                Galeria ou arquivo
              </button>
            </div>

            <button type="button" className="mobile-file-sheet__cancel" onClick={() => setActionSheetOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <style>{`
        .mobile-file-sheet-overlay {
          position: fixed;
          inset: 0;
          z-index: 10002;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 1rem;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
        }

        .mobile-file-sheet {
          width: 100%;
          max-width: 420px;
          border: 1px solid var(--border-color);
          border-radius: 22px 22px 18px 18px;
          background: var(--card-bg);
          box-shadow: var(--shadow-float);
          padding: 1rem;
        }

        .mobile-file-sheet__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.25rem 0.25rem 1rem;
        }

        .mobile-file-sheet__header h3,
        .mobile-file-sheet__header p {
          margin: 0;
        }

        .mobile-file-sheet__header h3 {
          color: var(--text-color);
          font-size: 1.05rem;
          font-weight: 800;
        }

        .mobile-file-sheet__header p {
          color: var(--muted-text);
          font-size: 0.9rem;
          margin-top: 0.25rem;
        }

        .mobile-file-sheet__close {
          align-items: center;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: var(--text-color);
          cursor: pointer;
          display: inline-flex;
          height: 38px;
          justify-content: center;
          width: 38px;
        }

        .mobile-file-sheet__actions {
          display: grid;
          gap: 0.75rem;
        }

        .mobile-file-sheet__actions button,
        .mobile-file-sheet__cancel {
          align-items: center;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          color: var(--text-color);
          cursor: pointer;
          display: flex;
          font-weight: 800;
          gap: 0.75rem;
          justify-content: center;
          padding: 0.9rem 1rem;
          width: 100%;
        }

        .mobile-file-sheet__actions button {
          justify-content: flex-start;
        }

        .mobile-file-sheet__cancel {
          margin-top: 0.75rem;
        }
      `}</style>
    </>
  );
}
