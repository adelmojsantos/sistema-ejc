import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    Shield, ArrowRight, MapPin
} from 'lucide-react';
import { SharedLibraryView } from '../../components/admin/biblioteca/SharedLibraryView';

export function VisitacaoPortalPage() {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();

    const modules = [
        {
            id: 'coordenar',
            title: 'Gestão e Montagem de Visitas',
            description: 'Gerencie duplas, vincule encontristas, organize rotas e acompanhe o progresso das visitas em tempo real.',
            icon: <Shield size={32} />,
            path: '/visitacao/coordenador',
            permission: 'modulo_visitacao_coordenar',
            color: 'var(--primary-color)'
        },
        {
            id: 'duplas',
            title: 'Meus Encontristas',
            description: 'Acesse sua lista de encontristas, registre visitas, controle pagamentos e visualize mapas de localização.',
            icon: <MapPin size={32} />,
            path: '/visitacao/meus-participantes',
            permission: 'modulo_visitacao_duplas',
            color: '#10b981'
        }
    ];

    const availableModules = modules.filter(m => hasPermission(m.permission) || hasPermission('modulo_admin'));

    return (
        <div style={{ padding: '0 1rem' }}>
            <div style={{ marginBottom: '3rem', textAlign: 'center', marginTop: '2rem' }}>
                <h1 style={{ marginBottom: '1rem', fontSize: '2.5rem' }}>Portal de Visitação</h1>
                <p style={{ fontSize: '1.1rem', opacity: 0.7, maxWidth: '700px', margin: '0 auto' }}>
                    Bem-vindo ao centro de operações da visitação. Selecione uma opção abaixo para gerenciar ou realizar as visitas deste encontro.
                </p>
            </div>

            <div className="portal-grid">
                {availableModules.map(module => (
                    <div
                        key={module.id}
                        onClick={() => navigate(module.path)}
                        className="portal-card"
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="portal-card__icon" style={{
                            background: `${module.color}15`,
                            color: module.color
                        }}>
                            {module.icon}
                        </div>
                        <h2 className="portal-card__title">{module.title}</h2>
                        <p className="portal-card__description">{module.description}</p>

                        <div style={{
                            marginTop: 'auto',
                            paddingTop: '2rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 700,
                            color: module.color
                        }}>
                            Acessar Módulo <ArrowRight size={18} />
                        </div>
                    </div>
                ))}

                {/* Card de Documentos Integrado na Grid */}
                <SharedLibraryView
                    title="Documentos e Arquivos"
                    description="Acesse arquivos compartilhados com a equipe de visitação."
                    moduleContext="Visitação"
                />
            </div>

            {availableModules.length === 0 && (
                <div className="empty-state" style={{ marginTop: '4rem' }}>
                    <Shield size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>Você não possui acesso aos módulos de visitação.</p>
                    <button onClick={() => navigate('/dashboard')} className="btn-outline" style={{ marginTop: '1rem' }}>Voltar ao Início</button>
                </div>
            )}
        </div>
    );
}
