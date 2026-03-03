
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Users, Calendar, FileText, CircleDot, UserPlus } from 'lucide-react';

export function Home() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col" style={{ minHeight: '100vh' }}>
            <Header />

            <main className="main-content container flex flex-col items-center justify-center text-center">
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                        <div
                            className="card flex flex-col items-center gap-4 text-center"
                            style={{
                                transition: 'transform 0.2s',
                                cursor: 'pointer',
                                gridColumn: '1 / -1',
                                border: '2px solid var(--primary-color)',
                                backgroundColor: 'rgba(0, 0, 254, 0.02)'
                            }}
                            onClick={() => navigate('/inscricao')}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ padding: '1.5rem', backgroundColor: 'rgba(0, 0, 254, 0.1)', borderRadius: '50%' }}>
                                <UserPlus size={48} color="var(--primary-color)" />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--primary-color)' }}>Nova Inscrição</h2>
                                <p style={{ margin: '0.5rem 0 0', opacity: 0.8, fontSize: '1.1rem' }}>
                                    Cadastre novos participantes para o encontro atual.
                                </p>
                            </div>
                        </div>

                        <div
                            className="card flex flex-col items-center gap-4 text-center"
                            style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
                            onClick={() => navigate('/secretaria')}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRadius: '50%' }}>
                                <FileText size={40} color="var(--primary-color)" />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Secretaria</h2>
                            <p style={{ margin: 0, opacity: 0.7 }}>Gestão de documentos e informações gerais do encontro.</p>
                        </div>

                        <div
                            className="card flex flex-col items-center gap-4 text-center"
                            style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
                            onClick={() => navigate('/cadastros/montagem-visitacao')}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%' }}>
                                <Users size={40} color="#10b981" />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Visitação</h2>
                            <p style={{ margin: 0, opacity: 0.7 }}>Controle de visitas às famílias e acompanhamento.</p>
                        </div>

                        <div
                            className="card flex flex-col items-center gap-4 text-center"
                            style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
                            onClick={() => navigate('/cadastros/montagem-circulos')}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%' }}>
                                <CircleDot size={40} color="#8b5cf6" />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Círculos</h2>
                            <p style={{ margin: 0, opacity: 0.7 }}>Divisão dos participantes em grupos de estudo e partilha.</p>
                        </div>

                        <div
                            className="card flex flex-col items-center gap-4 text-center"
                            style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
                            onClick={() => navigate('/cadastros')}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'none'}
                        >
                            <div style={{ padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '50%' }}>
                                <Calendar size={40} color="#f59e0b" />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Cadastros</h2>
                            <p style={{ margin: 0, opacity: 0.7 }}>Cadastro de jovens, tios e membros das equipes.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
