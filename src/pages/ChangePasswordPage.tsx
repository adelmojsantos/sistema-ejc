import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { PasswordInput } from '../components/ui/PasswordInput';

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
        setError(null);

        try {
            console.log('Iniciando troca de senha...');
            
            // 1. Forçar atualização da sessão com o servidor para garantir JWT novo
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshedSession) {
                console.error('Erro ao renovar sessão:', refreshError);
                throw new Error('Sessão expirada ou inválida. Por favor, faça login novamente.');
            }

            // 2. Validar usuário diretamente no servidor (não apenas no cache local)
            const { data: { user: serverUser }, error: userError } = await supabase.auth.getUser();
            if (userError || !serverUser) {
                console.error('Erro ao validar usuário no servidor:', userError);
                throw new Error('Não foi possível validar sua identidade. Faça login novamente.');
            }

            // 3. Tentar atualizar a senha
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) {
                console.error('Erro ao atualizar usuário:', updateError);
                // Se o erro for o fatídico "session_id not found"
                if (updateError.message.includes('session_id') || updateError.message.includes('not found')) {
                    throw new Error('Detectamos uma inconsistência na sua sessão. Por segurança, você será deslogado para entrar com a nova senha.');
                }
                throw updateError;
            }

            // 4. Limpar a flag temporária
            // Pequeno delay para propagação do novo estado de auth
            await new Promise(r => setTimeout(r, 800));
            
            const { error: rpcError } = await supabase.rpc('clear_temporary_password');
            if (rpcError) {
                console.warn('Aviso: Senha trocada, mas erro ao limpar flag (RPC):', rpcError);
            }

            await refreshProfile();
            toast.success('Senha atualizada com sucesso!');
            
            setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 1000);

        } catch (submitError: any) {
            console.error('Erro crítico na troca de senha:', submitError);
            const message = submitError.message || 'Erro ao processar alteração de senha.';
            setError(message);
            
            // Se for erro de sessão, limpa tudo e manda pro login após 3 segundos
            if (message.includes('Sessão') || message.includes('inconsistência') || message.includes('identidade')) {
                toast.error(message);
                setTimeout(async () => {
                    await supabase.auth.signOut();
                    navigate('/login', { replace: true });
                }, 3000);
            }
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
                        <PasswordInput
                            id="new-password"
                            value={newPassword}
                            onChange={setNewPassword}
                            placeholder="No mínimo 8 caracteres"
                            minLength={8}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="confirm-password">Confirmar nova senha</label>
                        <PasswordInput
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
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

