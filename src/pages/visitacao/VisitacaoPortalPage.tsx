import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { HubCard } from '../../components/ui/HubCard';
import { useAuth } from '../../hooks/useAuth';
import {
    Shield, MapPin, UserCheck
} from 'lucide-react';
import { SharedLibraryView } from '../../components/admin/biblioteca/SharedLibraryView';

export function VisitacaoPortalPage() {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();

    const modules: Array<{
        id: string;
        title: string;
        description: string;
        icon: ReactNode;
        path: string;
        permissions: string[];
        color: string;
    }> = [
        {
            id: 'coordenar',
            title: 'Gestão e Montagem de Visitas',
            description: 'Gerencie duplas, vincule encontristas e acompanhe o progresso das visitas.',
            icon: <Shield size={32} />,
            path: '/visitacao/coordenador',
            permissions: ['modulo_visitacao_coordenar'],
            color: 'var(--primary-color)'
        },
        {
            id: 'duplas',
            title: 'Meus Encontristas',
            description: 'Acesse sua lista de encontristas, registre visitas, controle pagamentos e visualize mapas de localização.',
            icon: <MapPin size={32} />,
            path: '/visitacao/meus-participantes',
            permissions: ['modulo_visitacao_duplas'],
            color: '#10b981'
        },
        {
            id: 'presencas',
            title: 'Presença no Encontro',
            description: 'Marque, um a um, quem está presente em cada dia do encontro.',
            icon: <UserCheck size={32} />,
            path: '/visitacao/presencas',
            permissions: ['modulo_visitacao_duplas', 'modulo_visitacao_coordenar'],
            color: '#2563eb'
        }
    ];

    const availableModules = modules.filter(m => m.permissions.some(permission => hasPermission(permission)) || hasPermission('modulo_admin'));

    return (
        <section className="cadastros-hub fade-in">
            <header className="page-header" style={{ textAlign: 'center', justifyContent: 'center' }}>
                <div>
                    <h1 className="page-title">Portal de Visitação</h1>
                    <p className="text-muted" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
                        Bem-vindo ao centro de operações da visitação. Selecione uma opção abaixo para gerenciar ou realizar as visitas deste encontro.
                    </p>
                </div>
            </header>

            <div className="cadastros-hub__grid">
                {availableModules.map(module => (
                    <HubCard
                        key={module.id}
                        label={module.title}
                        description={module.description}
                        icon={module.icon}
                        color={module.color}
                        onClick={() => navigate(module.path)}
                    />
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
        </section>
    );
}
