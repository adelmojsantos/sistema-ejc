import { Copy, Download, MessageCircle } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'react-hot-toast';
import { QRCodeCanvas } from 'qrcode.react';

import { Modal } from '../ui/Modal';

interface PesquisaSatisfacaoShareModalProps {
  isOpen: boolean;
  link: string;
  encounterName?: string | null;
  description?: string;
  downloadFilename?: string;
  whatsappMessage?: string;
  onClose: () => void;
}

export function PesquisaSatisfacaoShareModal({
  isOpen,
  link,
  encounterName,
  description = 'A pessoa escolhe primeiro sua equipe e depois seleciona o próprio nome.',
  downloadFilename = 'pesquisa-satisfacao-link.png',
  whatsappMessage,
  onClose,
}: PesquisaSatisfacaoShareModalProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success('Link da pesquisa copiado.');
  };

  const downloadQrCode = () => {
    if (!qrCanvasRef.current) return;
    const anchor = document.createElement('a');
    anchor.download = downloadFilename;
    anchor.href = qrCanvasRef.current.toDataURL('image/png');
    anchor.click();
    toast.success('QR Code baixado.');
  };

  const shareOnWhatsApp = () => {
    if (!link) return;
    const encounterLabel = encounterName?.trim() ? ` do ${encounterName.trim()}` : '';
    const message = whatsappMessage
      || `A pesquisa de satisfação${encounterLabel} está disponível. Escolha sua equipe para acessar: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen && Boolean(link)}
      onClose={onClose}
      title="Link público da pesquisa"
      maxWidth="680px"
    >
      <div className="pesquisa-share-modal">
        <div className="pesquisa-share-preview">
          <div className="pesquisa-share-qr">
            <QRCodeCanvas
              ref={qrCanvasRef}
              value={link}
              size={512}
              level="M"
              marginSize={2}
            />
          </div>
          <div className="pesquisa-share-link">
            <strong>Link da pesquisa</strong>
            <p>{description}</p>
            <code>{link}</code>
            <div className="pesquisa-share-link-actions">
              <button type="button" className="btn-secondary" onClick={copyLink}>
                <Copy size={16} />
                Copiar link
              </button>
              <button type="button" className="btn-secondary" onClick={downloadQrCode}>
                <Download size={16} />
                Baixar QR Code
              </button>
            </div>
          </div>
        </div>

        <div className="pesquisa-modal-actions pesquisa-share-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Fechar</button>
          <button type="button" className="btn-primary" onClick={shareOnWhatsApp}>
            <MessageCircle size={16} />
            Compartilhar no WhatsApp
          </button>
        </div>
      </div>

      <style>{`
        .pesquisa-share-modal {
          display: grid;
          gap: 1rem;
        }

        .pesquisa-share-preview {
          align-items: center;
          display: grid;
          gap: 1rem;
          grid-template-columns: 180px minmax(0, 1fr);
        }

        .pesquisa-share-qr {
          align-items: center;
          background: #fff;
          border-radius: 10px;
          display: flex;
          height: 180px;
          justify-content: center;
          overflow: hidden;
          width: 180px;
        }

        .pesquisa-share-qr canvas {
          height: 180px !important;
          width: 180px !important;
        }

        .pesquisa-share-link {
          min-width: 0;
        }

        .pesquisa-share-link > strong {
          color: var(--text-color);
          display: block;
          font-size: 1.05rem;
        }

        .pesquisa-share-link p {
          color: var(--muted-text);
          line-height: 1.45;
          margin: 0.4rem 0 0.75rem;
        }

        .pesquisa-share-link code {
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--muted-text);
          display: block;
          font-size: 0.78rem;
          margin-bottom: 0.75rem;
          overflow-wrap: anywhere;
          padding: 0.65rem;
        }

        .pesquisa-share-link-actions,
        .pesquisa-share-modal-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .pesquisa-share-modal-actions {
          border-top: 1px solid var(--border-color);
          padding-top: 1rem;
        }

        @media (max-width: 640px) {
          .pesquisa-share-preview {
            grid-template-columns: 1fr;
          }

          .pesquisa-share-qr {
            justify-self: center;
          }

          .pesquisa-share-link-actions,
          .pesquisa-share-modal-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .pesquisa-share-link-actions button,
          .pesquisa-share-modal-actions button {
            width: 100%;
          }
        }
      `}</style>
    </Modal>
  );
}
