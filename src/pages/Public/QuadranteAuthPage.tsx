import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Lock, 
    ChevronRight, 
    LayoutGrid,
    ShieldCheck
} from 'lucide-react';
import { quadranteService } from '../../services/quadranteService';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

export function QuadranteAuthPage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);
    const [encontroNome, setEncontroNome] = useState('');

    useEffect(() => {
        async function checkToken() {
            if (!token) return;
            try {
                const { data, error } = await supabase
                    .from('encontros')
                    .select('nome, quadrante_ativo, quadrante_pin')
                    .eq('quadrante_token', token)
                    .single();

                if (error || !data || !data.quadrante_ativo) {
                    toast.error('Este link é inválido ou foi desativado.');
                    navigate('/');
                    return;
                }

                setEncontroNome(data.nome);
                
                // Se não houver PIN definido, podemos pular a autenticação
                if (!data.quadrante_pin) {
                    navigate(`/quadrante/${token}`, { state: { authorized: true } });
                }
            } catch (error) {
                console.error('Erro ao verificar token:', error);
                navigate('/');
            } finally {
                setValidating(false);
            }
        }

        checkToken();
    }, [token, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !pin) return;

        setLoading(true);
        try {
            const isValid = await quadranteService.validarAcesso(token, pin);
            if (isValid) {
                // Navegar para o quadrante com o PIN na state ou apenas autorizar
                // Usamos o PIN para buscar os dados de forma segura no próximo passo
                sessionStorage.setItem(`q_auth_${token}`, pin);
                navigate(`/quadrante/${token}`);
            } else {
                toast.error('Código de acesso incorreto.');
                setPin('');
            }
        } catch (error) {
            console.error('Erro ao validar PIN:', error);
            toast.error('Erro ao processar sua solicitação.');
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <div className="auth-container">
                <div className="auth-card loading">
                    <RefreshIcon className="animate-spin" />
                    <p>Verificando link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-page-wrapper">
            <div className="auth-card-premium">
                <div className="auth-header">
                    <div className="logo-badge">
                        <LayoutGrid size={32} />
                    </div>
                    <h1>Acesso ao Quadrante</h1>
                    <p className="encontro-label">{encontroNome}</p>
                </div>

                <div className="auth-body">
                    <div className="info-box">
                        <Lock size={18} />
                        <span>Este conteúdo é restrito aos participantes do encontro.</span>
                    </div>

                    <form onSubmit={handleSubmit} className="pin-form">
                        <label>Digite o Código de Acesso:</label>
                        <input 
                            type="text" 
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]*"
                            placeholder="••••"
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            disabled={loading}
                        />
                        <button type="submit" className="login-btn" disabled={loading || !pin}>
                            {loading ? <RefreshIcon className="animate-spin" /> : <>Acessar Quadrante <ChevronRight size={18} /></>}
                        </button>
                    </form>
                </div>

                <div className="auth-footer">
                    <ShieldCheck size={14} />
                    <span>Conexão Segura EJC</span>
                </div>
            </div>

            <style>{`
                .auth-page-wrapper {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                    padding: 2rem;
                    color: white;
                }

                .auth-card-premium {
                    width: 100%;
                    max-width: 400px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 2.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .auth-header {
                    text-align: center;
                }

                .logo-badge {
                    width: 64px;
                    height: 64px;
                    background: var(--primary-color);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1.5rem;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
                }

                .auth-header h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 0;
                    background: linear-gradient(to right, #fff, #94a3b8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .encontro-label {
                    font-size: 0.9rem;
                    opacity: 0.7;
                    margin: 0.5rem 0 0;
                    font-weight: 500;
                }

                .info-box {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.8rem;
                    color: #10b981;
                    margin-bottom: 2rem;
                }

                .pin-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .pin-form label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    opacity: 0.8;
                }

                .pin-form input {
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 1rem;
                    color: white;
                    text-align: center;
                    font-size: 1.5rem;
                    transition: all 0.2s;
                }

                .pin-form input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 4px var(--primary-color)20;
                }

                .login-btn {
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    margin-top: 0.5rem;
                }

                .login-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(var(--primary-color-rgb), 0.4);
                }

                .login-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .auth-footer {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    opacity: 0.4;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

function RefreshIcon({ className }: { className?: string }) {
    return (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path><polyline points="22 4 22 10 16 10"></polyline></svg>
    );
}
