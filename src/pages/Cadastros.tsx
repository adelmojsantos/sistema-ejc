import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { Users, UserPlus, Calendar as CalIcon, Shield, UsersRound } from 'lucide-react';

interface CadastroCategory {
    id: string;
    path: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    available: boolean;
}

const CATEGORIES: CadastroCategory[] = [
    {
        id: 'pessoas',
        path: 'pessoas',
        label: 'Pessoas',
        description: 'Cadastro de jovens, tios e membros das equipes do EJC.',
        icon: <Users size={38} />,
        color: 'var(--primary-color)',
        available: true,
    },
    {
        id: 'encontros',
        path: 'encontros',
        label: 'Encontros',
        description: 'Gerenciamento dos finais de semana do EJC.',
        icon: <CalIcon size={38} />,
        color: '#10b981',
        available: true,
    },
    {
        id: 'equipes',
        path: 'equipes',
        label: 'Equipes',
        description: 'Cadastro das equipes de trabalho (Cozinha, Secretaria, etc).',
        icon: <Shield size={38} />,
        color: '#6366f1',
        available: true,
    },
    {
        id: 'circulos',
        path: 'circulos',
        label: 'Círculos',
        description: 'Cadastro dos círculos de discussão.',
        icon: <UsersRound size={38} />,
        color: '#f59e0b',
        available: true,
    },
    {
        id: 'montagem',
        path: 'montagem',
        label: 'Montagem de equipes',
        description: 'Montar equipes para os encontros.',
        icon: <UserPlus size={38} />,
        color: '#ec4899',
        available: true,
    },
    {
        id: 'montagem-visitacao',
        path: 'montagem-visitacao',
        label: 'Montagem Visitação',
        description: 'Vincular duplas e participantes para visitas.',
        icon: <Users size={38} />,
        color: '#10b981',
        available: true,
    },
    {
        id: 'montagem-circulos',
        path: 'montagem-circulos',
        label: 'Montagem Círculos',
        description: 'Vincular participantes e casais aos círculos.',
        icon: <UsersRound size={38} />,
        color: '#8b5cf6',
        available: true,
    },
];

export function Cadastros() {
    const navigate = useNavigate();
    const location = useLocation();

    // Se estiver exatamente em /cadastros, mostra o Hub
    const isHub = location.pathname === '/cadastros' || location.pathname === '/cadastros/';

    return (
        <div className="flex flex-col" style={{ minHeight: '100vh' }}>
            <Header />

            <main className="main-content container">
                {isHub ? (
                    <div className="fade-in">
                        <div className="page-header">
                            <h1 className="page-title">Módulo de Cadastros</h1>
                        </div>

                        <div className="categories-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '1.5rem',
                            marginTop: '1rem'
                        }}>
                            {CATEGORIES.map((cat) => (
                                <div
                                    key={cat.id}
                                    className={`card category-card ${!cat.available ? 'disabled' : ''}`}
                                    onClick={() => cat.available && navigate(`/cadastros/${cat.path}`)}
                                    style={{
                                        cursor: cat.available ? 'pointer' : 'not-allowed',
                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        opacity: cat.available ? 1 : 0.6
                                    }}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '4px',
                                        height: '100%',
                                        backgroundColor: cat.color
                                    }} />

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '1rem',
                                        padding: '0.5rem'
                                    }}>
                                        <div style={{
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            backgroundColor: `${cat.color}15`,
                                            color: cat.color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {cat.icon}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text-color)' }}>
                                                {cat.label}
                                            </h3>
                                            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7, lineHeight: '1.4' }}>
                                                {cat.description}
                                            </p>
                                        </div>
                                    </div>

                                    {!cat.available && (
                                        <div style={{
                                            marginTop: '1rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: '#64748b'
                                        }}>
                                            Em Breve
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <Outlet />
                )}
            </main>

            <style>{`
                .category-card:hover:not(.disabled) {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                }
                .category-card:active:not(.disabled) {
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
}
