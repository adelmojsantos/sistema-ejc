import { Users, Calendar, Shield, UsersRound, UserPlus, Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface CadastroCategory {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: ReactNode;
  color: string;
  available: boolean;
  permission?: string[];
}

const CATEGORIES: CadastroCategory[] = [
  {
    id: 'pessoas',
    path: '/cadastros/pessoas',
    label: 'Pessoas',
    description: 'Cadastro de jovens, tios e membros das equipes do EJC.',
    icon: <Users size={34} />,
    color: 'var(--primary-color)',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'encontros',
    path: '/cadastros/encontros',
    label: 'Encontros',
    description: 'Gerenciamento dos finais de semana do EJC.',
    icon: <Calendar size={34} />,
    color: '#10b981',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'equipes',
    path: '/cadastros/equipes',
    label: 'Equipes',
    description: 'Cadastro das equipes de trabalho (Cozinha, Secretaria, etc).',
    icon: <Shield size={34} />,
    color: '#6366f1',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'circulos',
    path: '/circulos',
    label: 'Círculos',
    description: 'Cadastros de círculos e montagem por encontro.',
    icon: <UsersRound size={34} />,
    color: '#f59e0b',
    available: true,
    permission: ['modulo_circulos', 'modulo_circulos_cadastros', 'modulo_circulos_coordenador', 'modulo_admin']
  },
  {
    id: 'montagem',
    path: '/cadastros/montagem',
    label: 'Montagem de equipes',
    description: 'Montar equipes para os encontros.',
    icon: <UserPlus size={34} />,
    color: '#ec4899',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'montagem-visitacao',
    path: '/visitacao',
    label: 'Visitação',
    description: 'Vincular duplas e participantes para visitas.',
    icon: <Users size={34} />,
    color: '#10b981',
    available: true,
    permission: ['modulo_visitacao', 'modulo_admin']
  },
  {
    id: 'palestras',
    path: '/cadastros/palestras',
    label: 'Palestras',
    description: 'Cadastro do cronograma de palestras e palestrantes do encontro.',
    icon: <Mic size={34} />,
    color: '#8b5cf6',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
];

export function Cadastros() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  
  const isHub = location.pathname === '/cadastros' || location.pathname === '/cadastros/';

  const allowedCategories = CATEGORIES.filter(cat => 
    !cat.permission || cat.permission.some(p => hasPermission(p))
  );

  return isHub ? (
    <section className="cadastros-hub fade-in">
      <header className="page-header">
        <h2 className="page-title">Módulo de Cadastros</h2>
      </header>

      <div className="cadastros-hub__grid">
        {allowedCategories.map((category) => (
          <article
            key={category.id}
            className={`cadastros-hub__card card ${!category.available ? 'is-disabled' : ''}`}
            onClick={() => category.available && navigate(category.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (!category.available) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(category.path);
              }
            }}
          >
            <div className="cadastros-hub__content">
              <span className="cadastros-hub__icon" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                {category.icon}
              </span>
              <div>
                <h3>{category.label}</h3>
                <p>{category.description}</p>
              </div>
            </div>
            {!category.available && <span className="cadastros-hub__tag" style={{ position: 'absolute', bottom: '1.25rem' }}>Em Breve</span>}
          </article>
        ))}
      </div>
    </section>
  ) : (
    <Outlet />
  );
}
