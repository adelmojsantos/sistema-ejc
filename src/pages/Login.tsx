import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PasswordInput } from '../components/ui/PasswordInput';
import { motion } from 'framer-motion';
import logoEjc from '../assets/logo-ejc.svg';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, mustChangePassword } = useAuth();

  useEffect(() => {
    if (user) {
      navigate(mustChangePassword ? '/alterar-senha' : '/dashboard', { replace: true });
    }
  }, [mustChangePassword, user, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="auth-split">
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="auth-sidebar-logo">
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <img
                  src={logoEjc}
                  alt="Logo EJC"
                  width="220"
                  height="60"
                  className="auth-logo-sidebar"
                />
              </motion.div>
            </div>
            <h1 className="auth-sidebar-title">
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>EJC Capelinha</span>
            </h1>
            <p className="auth-sidebar-text">
              Cada detalhe cuidado com amor para que o essencial aconteça: viver, partilhar e anunciar a fé.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-container">
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="auth-header">
              <div className="auth-header-logo">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <img
                    src={logoEjc}
                    alt="Logo EJC"
                    width="140"
                    height="40"
                    className="auth-logo-header"
                  />
                </motion.div>
              </div>
              <h2>Bem-vindo de volta</h2>
              <p>Insira suas credenciais para acessar o sistema</p>
            </div>

            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.1rem' }}>
                  <label className="form-label" htmlFor="password" style={{ marginBottom: 0 }}>Senha</label>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => navigate('/esqueci-senha')}
                    style={{ fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  required
                />
              </div>

              {error && (
                <motion.div
                  className="error-message"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    marginBottom: '1.5rem',
                    background: 'var(--danger-bg)',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--danger-border)',
                    color: 'var(--danger-text)',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  {error}
                </motion.div>
              )}

              <button type="submit" className="btn-primary auth-submit" disabled={loading} style={{ width: '100%', height: '48px', fontSize: '1rem' }}>
                {loading ? 'Validando acesso...' : 'Entrar no Sistema'}
              </button>
            </form>

            <footer style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--muted-text)', fontSize: '0.75rem' }}>
              &copy; {new Date().getFullYear()} EJC Capelinha. Todos os direitos reservados.
            </footer>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
