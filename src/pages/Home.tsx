import type { Variants } from 'framer-motion';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { getNavigationModules } from '../config/navigation';
import { useAuth } from '../hooks/useAuth';

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
  const {
    hasPermission,
    hasExactPermission,
    userParticipacao,
  } = useAuth();
  const dashboardActions = getNavigationModules('dashboard', {
    hasPermission,
    hasExactPermission,
    isCoordinator: Boolean(userParticipacao?.coordenador),
    teamName: userParticipacao?.equipes?.nome,
  }).sort((a, b) => a.label.localeCompare(b.label));

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
        {dashboardActions.map((action) => {
          const Icon = action.icon;
          return (
            <motion.article
              key={action.id}
              variants={itemVariants}
              className="dashboard-card"
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
                <Icon size={36} />
              </div>
              <h2>{action.label}</h2>
              <p>{action.description}</p>
            </motion.article>
          );
        })}
      </motion.div>
    </div>
  );
}

