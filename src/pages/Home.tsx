import { Calendar, CircleDot, FileText, UserPlus, Users, Users2Icon, Shield, ListChecks, MapPin, Folder, ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

interface DashboardAction {
  title: string;
  description: string;
  path: string;
  icon: ReactNode;
  accent: 'primary' | 'success' | 'violet' | 'amber';
  featured?: boolean;
}



const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export function Home() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const dashboardActions: DashboardAction[] = [];

  if (hasPermission('modulo_secretaria')) {
    dashboardActions.push({
      title: 'Secretaria',
      description: 'Gestão de documentos e informações gerais do encontro.',
      path: '/secretaria',
      icon: <FileText size={36} />,
      accent: 'primary'
    });
    dashboardActions.push({
      title: 'Inscrições Online',
      description: 'Gestão de pré-inscrições recebidas pelo site.',
      path: '/secretaria/lista-espera',
      icon: <ListChecks size={36} />,
      accent: 'violet'
    });
  }

  if (hasPermission('modulo_visitacao') || hasPermission('modulo_admin')) {
    dashboardActions.push({
      title: 'Visitação',
      description: 'Controle de visitas às famílias e acompanhamento.',
      path: '/visitacao',
      icon: <MapPin size={36} />,
      accent: 'success'
    });
  }

  if (hasPermission('modulo_cadastros') || hasPermission('modulo_admin')) {
    dashboardActions.push({
      title: 'Círculos',
      description: 'Divisão dos participantes em grupos de estudo e partilha.',
      path: '/montagem-circulos',
      icon: <CircleDot size={36} />,
      accent: 'violet'
    });
    dashboardActions.push({
      title: 'Cadastros',
      description: 'Cadastro de jovens, tios e membros das equipes.',
      path: '/cadastros',
      icon: <Calendar size={36} />,
      accent: 'amber'
    });
  }

  if (hasPermission('modulo_inscricao')) {
    dashboardActions.push({
      title: 'Inscrições',
      description: 'Inscrições dos participantes para o EJC.',
      path: '/inscricao',
      icon: <UserPlus size={40} />,
      accent: 'primary'
    });
  }

  if (hasPermission('modulo_coordenador') || hasPermission('modulo_admin')) {
    dashboardActions.push({
      title: 'Minha Equipe',
      description: 'Informações da sua equipe.',
      path: '/coordenador/minha-equipe',
      icon: <Users2Icon size={40} />,
      accent: 'primary'
    });
  }

  if (hasPermission('modulo_admin')) {
    dashboardActions.push({
      title: 'Usuários',
      description: 'Gestão de contas, redefinição de senha e permissões do sistema.',
      path: '/admin/usuarios',
      icon: <Users size={36} />,
      accent: 'amber' as const
    });
    dashboardActions.push({
      title: 'Acessos e Grupos',
      description: 'Configure que módulos e telas cada perfil pode acessar.',
      path: '/admin/acessos',
      icon: <Shield size={36} />,
      accent: 'success'
    });
  }

  if (hasPermission('modulo_biblioteca') || hasPermission('modulo_admin')) {
    dashboardActions.push({
      title: 'Biblioteca',
      description: 'Documentos, manuais e arquivos globais do EJC.',
      path: '/admin/biblioteca',
      icon: <Folder size={36} />,
      accent: 'violet' as const
    });
  }

  if (hasPermission('modulo_compras') || hasPermission('modulo_admin')) {
    dashboardActions.push({
      title: 'Compras',
      description: 'Gestão de taxas e pedidos de camisetas.',
      path: '/gestao-compras',
      icon: <ShoppingBag size={36} />,
      accent: 'primary'
    });
  }

  return (
    <div className="dashboard animate-fade-in">
      <header className="dashboard__header">
        <h1 className="page-title text-gradient">Dashboard</h1>
        <p className="text-muted">Acesso rápido aos módulos principais do sistema EJC.</p>
      </header>

      <motion.div
        className="dashboard__grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {dashboardActions.map((action) => (
          <motion.article
            key={action.title}
            variants={itemVariants}
            className={`dashboard-card ${action.featured ? 'dashboard-card--featured' : ''}`}
            onClick={() => navigate(action.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(action.path);
              }
            }}
          >
            <div className={`dashboard-card__icon dashboard-card__icon--${action.accent}`}>
              {action.icon}
            </div>
            <h2>{action.title}</h2>
            <p>{action.description}</p>
          </motion.article>
        ))}
      </motion.div>
    </div>
  );
}

