import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string | ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    isDestructive?: boolean;
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel,
    isLoading = false,
    isDestructive = false
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                className="modal-content card"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '440px',
                    padding: '1.5rem',
                    display: 'block', // Garantir que não seja flex se o CSS global interferir
                    position: 'relative'
                }}
            >
                {/* Usando um wrapper interno para contornar o padding: 0 !important do global */}
                <div style={{ padding: '0.5rem' }}>
                    <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: 'var(--text-color)',
                        letterSpacing: '-0.02em'
                    }}>
                        {title}
                    </h3>

                    <div style={{
                        marginBottom: '2.5rem',
                        color: 'var(--text-color)',
                        opacity: 0.9,
                        lineHeight: '1.6',
                        fontSize: '1.05rem'
                    }}>
                        {message}
                    </div>

                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem',
                        marginTop: 'auto'
                    }}>
                        <button
                            className="btn-secondary"
                            onClick={onCancel}
                            disabled={isLoading}
                            style={{
                                minWidth: '110px',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px'
                            }}
                        >
                            {cancelText}
                        </button>
                        <button
                            className={isDestructive ? 'btn-danger-solid' : 'btn-primary'}
                            onClick={onConfirm}
                            disabled={isLoading}
                            style={{
                                minWidth: '120px',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.6rem'
                            }}
                        >
                            {isLoading && <Loader2 size={18} className="animate-spin" />}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                /* Sobrescrever o padding: 0 !important do global para este caso específico */
                .modal-overlay .modal-content.card {
                    padding: 1.5rem !important;
                    overflow: visible !important;
                }
                
                .btn-danger-solid {
                    background-color: #ef4444; /* Vermelho vivo */
                    color: white;
                    border: none;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .btn-danger-solid:hover:not(:disabled) {
                    background-color: #dc2626;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px -4px rgba(220, 38, 38, 0.4);
                }
                
                .btn-danger-solid:active:not(:disabled) {
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
}
