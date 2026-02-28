
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Users, Calendar, FileText } from 'lucide-react';

export function Home() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col" style={{ minHeight: '100vh' }}>
            <Header />

            <main className="main-content container flex flex-col items-center justify-center text-center">
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 0' }}>
                    <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--primary-color)' }}>
                        EJC Capelinha
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-color)', opacity: 0.8, marginBottom: '4rem' }}>
                        Sistema de gestão para o Encontro de Jovens com Cristo.
                        Acesse as áreas abaixo para gerenciar as atividades.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
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
                            onClick={() => navigate('/visitacao')}
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
