import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LogoImage } from '../components/utils/Image';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Redirect if already logged in
    if (user) {
        navigate('/', { replace: true });
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="login-page">
            <div className="card login-card">
                <div className="flex flex-col items-center gap-4 text-center mb-8" style={{ marginBottom: '2rem' }}>
                    <LogoImage height='100rem' width='auto' />
                    <div>
                        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>EJC Capelinha</h1>
                        <p style={{ color: 'var(--text-color)', opacity: 0.6, margin: 0 }}>Faça login para continuar</p>
                    </div>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Senha</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                        style={{ marginTop: '1.5rem', padding: '0.875rem', fontSize: '1.1rem' }}
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
