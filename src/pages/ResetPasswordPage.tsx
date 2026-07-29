import { type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PasswordInput } from '../components/ui/PasswordInput';
import { supabase } from '../lib/supabase';

type RecoveryState = 'loading' | 'ready' | 'invalid' | 'success';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecoveryState>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [samePassword, setSamePassword] = useState(false);
  const [successNotice, setSuccessNotice] = useState(
    'Entre novamente usando a senha que você acabou de cadastrar.'
  );

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
    setSamePassword(false);

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
      if (updateError) {
        if (updateError.code === 'same_password') {
          setSamePassword(true);
          setError(
            'Essa senha já está cadastrada e pode ser usada normalmente. Você pode escolher outra ou seguir para o login.'
          );
          return;
        }
        throw updateError;
      }

      let { error: profileError } = await supabase.rpc('clear_temporary_password');
      if (profileError) {
        console.error('Erro ao concluir o primeiro acesso; tentando novamente:', profileError);
        await supabase.auth.refreshSession();
        ({ error: profileError } = await supabase.rpc('clear_temporary_password'));
      }

      if (profileError) {
        console.error('Senha salva, mas a pendência do primeiro acesso não foi limpa:', profileError);
        setSuccessNotice(
          'Sua senha foi salva. Se o sistema solicitar uma nova definição no próximo acesso, procure um administrador.'
        );
      }

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
      if (signOutError) {
        console.error('Senha salva, mas não foi possível encerrar todas as sessões:', signOutError);
      }
      setState('success');
    } catch (submitError) {
      console.error('Erro ao redefinir senha:', submitError);
      setError('Não foi possível salvar a senha. Verifique os dados e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginWithCurrentPassword = async () => {
    setSubmitting(true);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) {
      console.error('Não foi possível encerrar a sessão temporária:', signOutError);
      setError('Não foi possível voltar ao login agora. Atualize a página e tente novamente.');
      setSubmitting(false);
      return;
    }

    navigate('/login', { replace: true });
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
        <div className="auth-card auth-status-card card">
          <div className="auth-status-card__icon" aria-hidden="true">
            <KeyRound size={42} />
          </div>
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
        <div className="auth-card auth-status-card auth-status-card--success card">
          <div className="auth-status-card__icon" aria-hidden="true">
            <CheckCircle2 size={48} />
          </div>
          <h1 className="auth-title">Senha salva com sucesso</h1>
          <p className="auth-subtitle">
            {successNotice}
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
            <h1 className="auth-title">Cadastrar ou alterar senha</h1>
            <p className="auth-subtitle">
              No primeiro acesso, cadastre sua senha. Em uma recuperação, escolha uma senha diferente da atual.
            </p>
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

          {samePassword && (
            <button
              type="button"
              className="btn-secondary auth-submit"
              disabled={submitting}
              onClick={handleLoginWithCurrentPassword}
            >
              Entrar com essa senha
            </button>
          )}

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
