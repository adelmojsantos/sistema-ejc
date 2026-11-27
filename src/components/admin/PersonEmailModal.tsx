import { useState, type FormEvent } from 'react';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { adminUserService } from '../../services/adminUserService';
import { userFacingError } from '../../utils/userFacingError';

export interface PersonEmailTarget {
    pessoaId: string;
    nome: string;
    detalhe?: string | null;
    email?: string | null;
}

interface PersonEmailModalProps {
    target: PersonEmailTarget | null;
    onClose: () => void;
    onSaved: (email: string) => void | Promise<void>;
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Cadastra o e-mail da pessoa. Salvar o e-mail não cria conta nem envia convite. */
export function PersonEmailModal({ target, onClose, onSaved }: PersonEmailModalProps) {
    return (
        <Modal isOpen={!!target} onClose={onClose} title="Cadastrar e-mail">
            {target && <PersonEmailForm key={target.pessoaId} target={target} onClose={onClose} onSaved={onSaved} />}
        </Modal>
    );
}

function PersonEmailForm({ target, onClose, onSaved }: { target: PersonEmailTarget; onClose: () => void; onSaved: PersonEmailModalProps['onSaved'] }) {
    const [email, setEmail] = useState(target.email || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const normalized = email.trim().toLowerCase();
        if (!isValidEmail(normalized)) {
            toast.error('Informe um e-mail válido.');
            return;
        }

        setSaving(true);
        try {
            await adminUserService.updatePersonEmail(target.pessoaId, normalized);
            toast.success('E-mail cadastrado.');
            await onSaved(normalized);
            onClose();
        } catch (error: unknown) {
            toast.error(userFacingError(error, 'Não foi possível salvar o e-mail. Tente novamente.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="users-admin-email-form">
            <div>
                <strong>{target.nome}</strong>
                {target.detalhe && <small className="text-muted">{target.detalhe}</small>}
            </div>
            <div className="form-group">
                <label className="form-label" htmlFor="person-email-input">E-mail</label>
                <input
                    id="person-email-input"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="nome@exemplo.com"
                    autoComplete="email"
                    autoFocus
                    required
                    disabled={saving}
                />
                <small className="text-muted">Salvar o e-mail não envia convite. Depois, libere o acesso normalmente.</small>
            </div>
            <div className="users-admin-email-form__actions">
                <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving || !email.trim()}>
                    {saving ? 'Salvando...' : 'Salvar e-mail'}
                </button>
            </div>
        </form>
    );
}
