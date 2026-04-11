import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 3000, padding: '1rem'
        }}>
            <div className="modal-content card" onClick={(e) => e.stopPropagation()} style={{
                maxWidth: '500px', width: '100%', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column', padding: 0,
                overflow: 'hidden', border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-float)'
            }}>
                <div className="modal-header" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)',
                    background: 'var(--surface-2)'
                }}>
                    <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h3>
                    <button onClick={onClose} className="icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: '0.25rem' }}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>
    );
}
