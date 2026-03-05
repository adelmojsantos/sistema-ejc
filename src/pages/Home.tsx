import { Calendar, CircleDot, FileText, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAuth } from '../hooks/useAuth';

interface DashboardAction {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  accent: 'primary' | 'success' | 'violet' | 'amber';
  featured?: boolean;
}

const actions: DashboardAction[] = [
  {
    title: 'Secretaria',
    description: 'GestÃ£o de documentos e informaÃ§Ãµes gerais do encontro.',
    path: '/secretaria',
    icon: <FileText size={36} />,
    accent: 'primary'
  },
  {
    title: 'VisitaÃ§Ã£o',
    description: 'Controle de visitas Ã s famÃ­lias e acompanhamento.',
    path: '/cadastros/montagem-visitacao',
    icon: <Users size={36} />,
    accent: 'success'
  },
  {
    title: 'CÃ­rculos',
    description: 'DivisÃ£o dos participantes em grupos de estudo e partilha.',
    path: '/cadastros/montagem-circulos',
    icon: <CircleDot size={36} />,
    accent: 'violet'
  },
  {
    title: 'Cadastros',
    description: 'Cadastro de jovens, tios e membros das equipes.',
    path: '/cadastros',
    icon: <Calendar size={36} />,
    accent: 'amber'
  },
  {
    title: 'InscriÃ§Ãµes',
    description: 'InscriÃ§Ãµes dos participantes para o EJC.',
    path: '/inscricao',
    icon: <UserPlus size={40} />,
    accent: 'primary',
    featured: true
  }
];

export function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const dashboardActions = [
    ...actions,
    ...(profile?.role === 'admin'
      ? [{
        title: 'UsuÃ¡rios',
        description: 'Cadastro de contas, roles e redefiniÃ§Ã£o de senha temporÃ¡ria.',
        path: '/admin/usuarios',
        icon: <Users size={36} />,
        accent: 'amber' as const
      }]
      : [])
  ];

  return (
    <div className="app-shell">
      <Header />

      <main className="main-content container">
        <section className="dashboard">
          <header className="dashboard__header">
            <h1 className="page-title">Dashboard</h1>
            <p className="text-muted">Acesso rÃ¡pido aos mÃ³dulos principais do sistema EJC.</p>
          </header>

          <div className="dashboard__grid">
            {dashboardActions.map((action) => (
              <article
                key={action.title}
                className={`dashboard-card card ${action.featured ? 'dashboard-card--featured' : ''}`}
                onClick={() => navigate(action.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(action.path);
                  }
                }}
              >
                <span className={`dashboard-card__icon dashboard-card__icon--${action.accent}`}>{action.icon}</span>
                <h2>{action.title}</h2>
                <p>{action.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

