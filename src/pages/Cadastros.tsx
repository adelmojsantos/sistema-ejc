import { Calendar as CalIcon, Shield, UserPlus, Users, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';

interface CadastroCategory {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: ReactNode;
  color: string;
  available: boolean;
}

const CATEGORIES: CadastroCategory[] = [
  {
    id: 'pessoas',
    path: 'pessoas',
    label: 'Pessoas',
    description: 'Cadastro de jovens, tios e membros das equipes do EJC.',
    icon: <Users size={34} />,
    color: 'var(--primary-color)',
    available: true
  },
  {
    id: 'encontros',
    path: 'encontros',
    label: 'Encontros',
    description: 'Gerenciamento dos finais de semana do EJC.',
    icon: <CalIcon size={34} />,
    color: '#10b981',
    available: true
  },
  {
    id: 'equipes',
    path: 'equipes',
    label: 'Equipes',
    description: 'Cadastro das equipes de trabalho (Cozinha, Secretaria, etc).',
    icon: <Shield size={34} />,
    color: '#6366f1',
    available: true
  },
  {
    id: 'circulos',
    path: 'circulos',
    label: 'Círculos',
    description: 'Cadastro dos círculos de discussão.',
    icon: <UsersRound size={34} />,
    color: '#f59e0b',
    available: true
  },
  {
    id: 'montagem',
    path: 'montagem',
    label: 'Montagem de equipes',
    description: 'Montar equipes para os encontros.',
    icon: <UserPlus size={34} />,
    color: '#ec4899',
    available: true
  },
  {
    id: 'montagem-visitacao',
    path: 'montagem-visitacao',
    label: 'Montagem Visitação',
    description: 'Vincular duplas e participantes para visitas.',
    icon: <Users size={34} />,
    color: '#10b981',
    available: true
  },
  {
    id: 'montagem-circulos',
    path: 'montagem-circulos',
    label: 'Montagem Círculos',
    description: 'Vincular participantes e casais aos círculos.',
    icon: <UsersRound size={34} />,
    color: '#8b5cf6',
    available: true
  }
];

export function Cadastros() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHub = location.pathname === '/cadastros' || location.pathname === '/cadastros/';

  return (
    <div className="app-shell">
      <Header />

      <main className="main-content container">
        {isHub ? (
          <section className="cadastros-hub fade-in">
            <header className="page-header">
              <h1 className="page-title">Módulo de Cadastros</h1>
            </header>

            <div className="cadastros-hub__grid">
              {CATEGORIES.map((category) => (
                <article
                  key={category.id}
                  className={`cadastros-hub__card card ${!category.available ? 'is-disabled' : ''}`}
                  onClick={() => category.available && navigate(`/cadastros/${category.path}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (!category.available) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/cadastros/${category.path}`);
                    }
                  }}
                >
                  <span className="cadastros-hub__bar" style={{ backgroundColor: category.color }} />
                  <div className="cadastros-hub__content">
                    <span className="cadastros-hub__icon" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
                      {category.icon}
                    </span>
                    <div>
                      <h3>{category.label}</h3>
                      <p>{category.description}</p>
                    </div>
                  </div>
                  {!category.available && <span className="cadastros-hub__tag">Em Breve</span>}
                </article>
              ))}
            </div>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
