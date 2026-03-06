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
    description: 'Gestão de documentos e informações gerais do encontro.',
    path: '/secretaria',
    icon: <FileText size={36} />,
    accent: 'primary'
  },
  {
    title: 'Visitação',
    description: 'Controle de visitas às famílias e acompanhamento.',
    path: '/montagem-visitacao',
    icon: <Users size={36} />,
    accent: 'success'
  },
  {
    title: 'Círculos',
    description: 'Divisão dos participantes em grupos de estudo e partilha.',
    path: '/montagem-circulos',
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
    title: 'Inscrições',
    description: 'Inscrições dos participantes para o EJC.',
    path: '/inscricao',
    icon: <UserPlus size={40} />,
    accent: 'primary'
  }
];

export function Home() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const dashboardActions: DashboardAction[] = [
    ...actions,
    ...(profile?.role === 'admin'
      ? [{
        title: 'Usuários',
        description: 'Cadastro de contas, roles e redefinição de senha temporária.',
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
            <p className="text-muted">Acesso rápido aos módulos principais do sistema EJC.</p>
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

