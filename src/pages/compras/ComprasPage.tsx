import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, CreditCard, Shirt, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface ComprasCategory {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: ReactNode;
  color: string;
  available: boolean;
}

const CATEGORIES: ComprasCategory[] = [
  {
    id: 'taxas',
    path: '/compras/taxas',
    label: 'Pagamento de Taxas',
    description: 'Gestão de pagamentos das taxas de inscrição por equipe.',
    icon: <CreditCard size={34} />,
    color: '#10b981',
    available: true
  },
  {
    id: 'camisetas',
    path: '/compras/camisetas',
    label: 'Pedidos de Camisetas',
    description: 'Listagem geral, por equipe e resumo consolidado.',
    icon: <Shirt size={34} />,
    color: '#3b82f6',
    available: true
  },
  {
    id: 'configuracao',
    path: '/compras/configuracao',
    label: 'Modelos e Tamanhos',
    description: 'Cadastrar modelos de camisetas e tamanhos disponíveis.',
    icon: <Settings size={34} />,
    color: '#6366f1',
    available: true
  }
];

export function ComprasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const isHub = location.pathname === '/compras' || location.pathname === '/compras/';

  // Proteção interna
  if (!hasPermission('modulo_compras') && !hasPermission('modulo_admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  return !isHub ? (
    <Outlet />
  ) : (
    <section className="cadastros-hub fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingBag size={28} className="text-primary" /> Módulo de Compras
          </h1>
          <p className="text-muted">Gestão financeira e logística de materiais do encontro.</p>
        </div>
      </header>

      <div className="cadastros-hub__grid" style={{ marginTop: '2rem' }}>
        {CATEGORIES.map((category) => (
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
            {!category.available && <span className="cadastros-hub__tag">Em Breve</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
