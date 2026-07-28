import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

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
    isConfirmDisabled?: boolean;
    maxWidth?: string;
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
    isDestructive = false,
    isConfirmDisabled = false,
    maxWidth = '440px'
}: ConfirmDialogProps) {
    const overlayMouseDownRef = useRef(false);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!isOpen) return;

        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        const focusTimer = window.setTimeout(() => confirmButtonRef.current?.focus(), 0);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isLoading) {
                event.preventDefault();
                onCancel();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocusedRef.current?.focus();
        };
    }, [isLoading, isOpen, onCancel]);

    if (!isOpen) return null;

    const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        overlayMouseDownRef.current = event.target === event.currentTarget;
    };

    const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
        if (overlayMouseDownRef.current && event.target === event.currentTarget) {
            onCancel();
        }
        overlayMouseDownRef.current = false;
    };

    return (
        <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
            <div
                className="modal-content card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                style={{
                    maxWidth,
                    width: 'calc(100% - 2rem)',
                    padding: '1.5rem',
                    display: 'block', // Garantir que não seja flex se o CSS global interferir
                    position: 'relative'
                }}
            >
                {/* Usando um wrapper interno para contornar o padding: 0 !important do global */}
                <div style={{ padding: '0.5rem' }}>
                    <h3 id={titleId} style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        color: 'var(--text-color)',
                        letterSpacing: '-0.02em'
                    }}>
                        {title}
                    </h3>

                    <div id={descriptionId} style={{
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
                            ref={confirmButtonRef}
                            className={isDestructive ? 'btn-danger-solid' : 'btn-primary'}
                            onClick={onConfirm}
                            disabled={isLoading || isConfirmDisabled}
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

                @media (max-width: 640px) {
                    .modal-overlay .modal-content.card {
                        width: calc(100vw - 1rem) !important;
                        max-width: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
