import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PasswordInput } from '../components/ui/PasswordInput';
import { supabase } from '../lib/supabase';

type RecoveryState = 'loading' | 'ready' | 'invalid' | 'success';

export function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const removeSensitiveUrlData = () => {
      window.history.replaceState({}, document.title, '/redefinir-senha');
    };

    const validateSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError || !data.session) {
        setState('invalid');
        return;
      }

      removeSensitiveUrlData();
      setState('ready');
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return;
      removeSensitiveUrlData();
      setState('ready');
    });

    void validateSession();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      const { error: profileError } = await supabase.rpc('clear_temporary_password');
      if (profileError) throw profileError;

      await supabase.auth.signOut({ scope: 'global' });
      setState('success');
    } catch (submitError) {
      console.error('Erro ao redefinir senha:', submitError);
      setError('Não foi possível salvar a nova senha. Solicite um novo link e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card card" role="status" aria-live="polite">
          <p className="auth-subtitle" style={{ margin: 0 }}>Validando link seguro…</p>
        </div>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <KeyRound size={42} style={{ color: 'var(--warning-color)', marginBottom: '1rem' }} />
          <h1 className="auth-title">Link inválido ou expirado</h1>
          <p className="auth-subtitle">
            Solicite um novo e-mail de recuperação para continuar.
          </p>
          <Link to="/esqueci-senha" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-card card" style={{ textAlign: 'center' }}>
          <CheckCircle2 size={48} style={{ color: 'var(--success-color)', marginBottom: '1rem' }} />
          <h1 className="auth-title">Senha definida com sucesso</h1>
          <p className="auth-subtitle">
            Entre novamente usando sua nova senha.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'flex', justifyContent: 'center', textDecoration: 'none' }}>
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <div>
            <h1 className="auth-title">Definir nova senha</h1>
            <p className="auth-subtitle">Escolha uma senha com pelo menos 8 caracteres.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="recovery-new-password">Nova senha</label>
            <PasswordInput
              id="recovery-new-password"
              value={newPassword}
              onChange={setNewPassword}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="recovery-confirm-password">Confirmar nova senha</label>
            <PasswordInput
              id="recovery-confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}

          <button
            type="submit"
            className="btn-primary auth-submit"
            disabled={submitting || !newPassword || !confirmPassword}
          >
            {submitting ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
