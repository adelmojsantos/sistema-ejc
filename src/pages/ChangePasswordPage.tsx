import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export function ChangePasswordPage() {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { user, mustChangePassword, refreshProfile } = useAuth();

    useEffect(() => {
        if (!mustChangePassword) {
            navigate('/dashboard', { replace: true });
        }
    }, [mustChangePassword, navigate]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (newPassword.length < 8) {
            setError('A nova senha deve ter no mínimo 8 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não conferem.');
            return;
        }

        if (!user) {
            setError('Sessão inválida. Faça login novamente.');
            return;
        }

        setLoading(true);

        try {
            await authService.updatePassword(newPassword);
            await authService.clearTemporaryPassword();
            await refreshProfile();

            toast.success('Senha atualizada com sucesso.');
            navigate('/dashboard', { replace: true });
        } catch (submitError: unknown) {
            const message = submitError instanceof Error ? submitError.message : 'Erro ao atualizar senha.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card card fade-in">
                <div className="auth-brand">
                    <div>
                        <h1 className="auth-title">Troca obrigatória de senha</h1>
                        <p className="auth-subtitle">Defina uma nova senha para liberar o acesso ao sistema.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="new-password">Nova senha</label>
                        <input
                            id="new-password"
                            type="password"
                            className="form-input"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="No mínimo 8 caracteres"
                            minLength={8}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label>
                        <input
                            id="confirm-password"
                            type="password"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Repita a senha"
                            minLength={8}
                            required
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={async () => {
                                if (mustChangePassword) {
                                    await supabase.auth.signOut();
                                    navigate('/login', { replace: true });
                                } else {
                                    navigate('/dashboard', { replace: true });
                                }
                            }}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar nova senha'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

