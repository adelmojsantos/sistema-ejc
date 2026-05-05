import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UsersRound, ListTree, Layers, BookOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const TABS = [
  {
    id: 'cadastros',
    path: '/circulos/cadastros',
    label: 'Cadastros',
    description: 'Criar, renomear e remover os círculos globais do EJC.',
    icon: <ListTree size={34} />,
    color: '#f59e0b',
    permission: 'modulo_circulos_cadastros',
  },
  {
    id: 'montagem',
    path: '/circulos/montagem',
    label: 'Montagem',
    description: 'Vincular mediadores e encontristas aos círculos por encontro.',
    icon: <Layers size={34} />,
    color: '#8b5cf6',
    permission: 'modulo_circulos_coordenador',
  },
  {
    id: 'resumo-palestras',
    path: '/circulos/resumo-palestras',
    label: 'Resumo das Palestras',
    description: 'Visualizar os temas e conteúdos das palestras do encontro.',
    icon: <BookOpen size={34} />,
    color: '#10b981',
    permission: 'modulo_circulos_coordenador',
  },
] as const;

export function CirculosPortalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const isHub =
    location.pathname === '/circulos' || location.pathname === '/circulos/';

  if (!isHub) return <Outlet />;

  const allowedTabs = TABS.filter(tab => hasPermission(tab.permission));

  return (
    <section className="cadastros-hub fade-in">
      <header className="page-header">
        <div>
          <h1
            className="page-title"
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <UsersRound size={28} style={{ color: '#f59e0b' }} />
            Módulo — Círculos
          </h1>
          <p className="text-muted">
            Gerencie os círculos de discussão e monte as turmas por encontro.
          </p>
        </div>
      </header>

      <div className="cadastros-hub__grid" style={{ marginTop: '2rem' }}>
        {allowedTabs.map(tab => (
          <article
            key={tab.id}
            className="cadastros-hub__card card"
            onClick={() => navigate(tab.path)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(tab.path);
              }
            }}
          >
            <div className="cadastros-hub__content">
              <span
                className="cadastros-hub__icon"
                style={{ backgroundColor: `${tab.color}15`, color: tab.color }}
              >
                {tab.icon}
              </span>
              <div>
                <h3>{tab.label}</h3>
                <p>{tab.description}</p>
              </div>
            </div>
          </article>
        ))}

        {allowedTabs.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <p>Você não tem permissão para acessar nenhuma funcionalidade deste módulo.</p>
          </div>
        )}
      </div>
    </section>
  );
}
