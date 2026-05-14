import { useEffect, useState } from 'react';
import { Files } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bibliotecaService } from '../../../services/bibliotecaService';
import { useAuth } from '../../../hooks/useAuth';

interface SharedLibraryViewProps {
    grupoId?: string;
    equipeId?: string;
    title?: string;
    description?: string;
    moduleContext?: string;
}

export function SharedLibraryView({ 
    grupoId, 
    equipeId,
    title = 'Documentos e Arquivos',
    description = 'Acesse manuais, orientações e documentos compartilhados.',
    moduleContext
}: SharedLibraryViewProps) {
    const navigate = useNavigate();
    const { profile, userParticipacao } = useAuth();
    const [loading, setLoading] = useState(true);
    const [hasContent, setHasContent] = useState(false);

    useEffect(() => {
        if (profile) {
            checkSharedContent();
        }
    }, [profile, grupoId, equipeId, userParticipacao]);

    const checkSharedContent = async () => {
        try {
            const targetGrupoIds = grupoId ? [grupoId] : (profile?.grupoIds || []);
            const targetEquipeId = equipeId || userParticipacao?.equipe_id || undefined;
            const isAdmin = profile?.permissions.includes('modulo_admin');

            const data = await bibliotecaService.listarItensCompartilhados({ 
                grupoIds: targetGrupoIds, 
                equipeId: targetEquipeId,
                isAdmin
            });
            
            setHasContent(data.pastas.length > 0 || data.arquivos.length > 0);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !hasContent) return null;

    return (
        <div 
            className="module-card" 
            onClick={() => navigate(`/biblioteca/compartilhada?module=${encodeURIComponent(moduleContext || title.split(' ')[0])}`)}
            style={{ 
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '2rem 1.5rem',
                backgroundColor: 'var(--surface-1)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                transition: 'all 0.3s ease',
                gap: '1.25rem',
                minHeight: '220px',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Ícone Estilizado (Box Colorido) */}
            <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '16px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: 'rgba(37, 99, 235, 0.1)', // Azul sutil
                color: 'var(--primary-color)',
                marginBottom: '0.5rem'
            }}>
                <Files size={32} />
            </div>

            {/* Conteúdo Textual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.25rem', 
                    fontWeight: 700, 
                    color: 'var(--text-color)',
                    lineHeight: 1.2
                }}>
                    {title}
                </h3>
                <p style={{ 
                    margin: 0, 
                    fontSize: '0.9rem', 
                    opacity: 0.6,
                    lineHeight: 1.5,
                    maxWidth: '220px'
                }}>
                    {description}
                </p>
            </div>

            <style>{`
                .module-card:hover {
                    transform: translateY(-8px);
                    border-color: var(--primary-color);
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
                    background-color: var(--surface-2);
                }
                .module-card:hover div:first-child {
                    transform: scale(1.1);
                    background-color: var(--primary-color);
                    color: white;
                }
            `}</style>
        </div>
    );
}
