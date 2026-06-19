import { BookOpen, Calendar, CalendarClock, Car, ClipboardCheck, Mic, Shield, UserPlus, Users, UsersRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HubCard } from '../../components/ui/HubCard';
import { useAuth } from '../../hooks/useAuth';

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
    id: 'visitacao',
    path: '/visitacao',
    label: 'Visitação',
    description: 'Vincular duplas e participantes para visitas.',
    icon: <Car size={34} />,
    color: '#10b981',
    available: true,
    permission: ['modulo_visitacao', 'modulo_admin']
  },
  {
    id: 'palestras',
    path: '/palestras',
    label: 'Palestras',
    description: 'Cadastro das palestras e palestrantes do encontro.',
    icon: <Mic size={34} />,
    color: '#8b5cf6',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'avaliacao',
    path: '/cadastros/avaliacao',
    label: 'Avaliação',
    description: 'Perguntas para as equipes responderem ao final do encontro.',
    icon: <ClipboardCheck size={34} />,
    color: '#0ea5e9',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'cronograma',
    path: '/cadastros/cronograma',
    label: 'Cronograma',
    description: 'Organize os horários e atividades de cada dia do encontro.',
    icon: <CalendarClock size={34} />,
    color: '#0ea5e9',
    available: true,
    permission: ['modulo_cadastros', 'modulo_admin']
  },
  {
    id: 'pos-encontros',
    path: '/cadastros/pos-encontros',
    label: 'Pós-Encontro',
    description: 'Cadastro dos roteiros oficiais usados pelos círculos.',
    icon: <BookOpen size={34} />,
    color: '#14b8a6',
    available: true,
    permission: ['modulo_cadastros', 'modulo_secretaria', 'modulo_admin']
  },
];

export function Cadastros() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  
  const isHub = location.pathname === '/cadastros' || location.pathname === '/cadastros/';

  const allowedCategories = CATEGORIES.sort((a, b) =>
    a.id.localeCompare(b.id)
  ).filter(cat =>
    !cat.permission || cat.permission.some(p => hasPermission(p))
  );

  return isHub ? (
    <section className="cadastros-hub fade-in">
      <header className="page-header">
        <h2 className="page-title">Módulo de Cadastros</h2>
      </header>

      <div className="cadastros-hub__grid">
        {allowedCategories.map((category) => (
          <HubCard
            key={category.id}
            label={category.label}
            description={category.description}
            icon={category.icon}
            color={category.color}
            available={category.available}
            onClick={() => navigate(category.path)}
          />
        ))}
      </div>
    </section>
  ) : (
    <Outlet />
  );
}
