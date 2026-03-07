import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authService } from '../services/authService';
import { ChevronLeft, Mail, CheckCircle2 } from 'lucide-react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authService.resetPassword(email);
      setSubmitted(true);
      toast.success('E-mail de recuperação enviado!');
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : 'Erro ao solicitar recuperação.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-page">
        <div className="auth-card card fade-in" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', backgroundColor: 'var(--success-bg)', borderRadius: '50%', color: 'var(--success-color)' }}>
              <CheckCircle2 size={48} />
            </div>
          </div>
          <h1 className="auth-title">Senha Redefinida</h1>
          <p className="auth-subtitle" style={{ marginBottom: '2rem' }}>
            Sua senha foi redefinida com sucesso para o seu próprio <strong>e-mail</strong>.
            Você já pode realizar o login utilizando seu e-mail como senha.
          </p>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card card fade-in">
        <div className="auth-brand">
          <Link to="/login" className="icon-btn" style={{ marginBottom: '1rem', display: 'flex' }}>
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="auth-title">Recuperar senha</h1>
            <p className="auth-subtitle">Informe seu e-mail para receber um link de redefinição.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">Seu e-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                id="email"
                type="email"
                className="form-input"
                style={{ paddingLeft: '3rem' }}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="exemplo@email.com"
                required
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-primary auth-submit" disabled={loading || !email}>
            {loading ? 'Enviando...' : 'Redefinir senha'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/login" className="auth-link" style={{ fontSize: '0.875rem' }}>
              Lembrei minha senha
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
