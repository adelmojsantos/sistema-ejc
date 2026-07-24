import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, CreditCard, Shirt, Settings, Warehouse } from 'lucide-react';
import type { ReactNode } from 'react';
import { HubCard } from '../../components/ui/HubCard';
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
  permissions: string[];
}

const CATEGORIES: ComprasCategory[] = [
  {
    id: 'almoxarifado',
    path: '/compras/almoxarifado',
    label: 'Estoque / Almoxarifado',
    description: 'Controle contínuo de itens, destinos, validade e movimentações.',
    icon: <Warehouse size={34} />,
    color: '#f59e0b',
    available: true,
    permissions: ['modulo_compras', 'modulo_almoxarifado', 'almoxarifado_consultar', 'almoxarifado_gerenciar', 'almoxarifado_movimentar', 'modulo_coordenador']
  },
  {
    id: 'taxas',
    path: '/compras/taxas',
    label: 'Pagamento de Taxas',
    description: 'Gestão de pagamentos das taxas de inscrição por equipe.',
    icon: <CreditCard size={34} />,
    color: '#10b981',
    available: true,
    permissions: ['modulo_compras']
  },
  {
    id: 'camisetas',
    path: '/compras/camisetas',
    label: 'Pedidos de Camisetas',
    description: 'Listagem geral, por equipe e resumo consolidado.',
    icon: <Shirt size={34} />,
    color: '#3b82f6',
    available: true,
    permissions: ['modulo_compras']
  },
  {
    id: 'configuracao',
    path: '/compras/configuracao',
    label: 'Modelos e Tamanhos',
    description: 'Cadastrar modelos de camisetas e tamanhos disponíveis.',
    icon: <Settings size={34} />,
    color: '#6366f1',
    available: true,
    permissions: ['modulo_compras']
  }
];

export function ComprasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const isHub = location.pathname === '/compras' || location.pathname === '/compras/';
  const canAccessCompras = hasPermission('modulo_compras') || hasPermission('modulo_admin');
  const canAccessAlmoxarifado =
    hasPermission('modulo_almoxarifado') ||
    hasPermission('almoxarifado_consultar') ||
    hasPermission('almoxarifado_gerenciar') ||
    hasPermission('almoxarifado_movimentar') ||
    hasPermission('modulo_coordenador');
  const visibleCategories = CATEGORIES.filter((category) =>
    category.permissions.some((permission) => hasPermission(permission))
  );
  const isAlmoxarifadoRoute = location.pathname.startsWith('/compras/almoxarifado');

  // Proteção interna
  if (!canAccessCompras && !canAccessAlmoxarifado) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!isHub && !isAlmoxarifadoRoute && !canAccessCompras) {
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
        {visibleCategories.map((category) => (
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
  );
}
