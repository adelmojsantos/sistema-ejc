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
            <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">{title}</h3>
                <div className="modal-body">{message}</div>
                <div className="modal-actions">
                    <button
                        className="btn-cancel"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`dialog-confirm ${isDestructive ? 'btn-danger' : ''}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && <Loader2 size={16} className="animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
