import { type MouseEvent, type ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
    suspended?: boolean;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = '500px', suspended = false }: ModalProps) {
    const overlayMouseDownRef = useRef(false);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen && !suspended) {
            window.addEventListener('keydown', handleEsc);
        }
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, suspended]);

    if (!isOpen) return null;

    const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        overlayMouseDownRef.current = event.target === event.currentTarget;
    };

    const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
        if (overlayMouseDownRef.current && event.target === event.currentTarget) {
            onClose();
        }
        overlayMouseDownRef.current = false;
    };

    return (
        <div
            className={`modal-overlay ${suspended ? 'modal-overlay--suspended' : ''}`}
            onMouseDown={handleOverlayMouseDown}
            onClick={handleOverlayClick}
            aria-hidden={suspended || undefined}
        >
            <div 
                className="modal-content" 
                style={{ maxWidth }}
            >
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button onClick={onClose} className="icon-btn" aria-label="Fechar">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
}
