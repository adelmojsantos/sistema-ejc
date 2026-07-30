import { ChevronLeft, ClipboardList, Package, Receipt, ShoppingCart, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HubCard } from '../../components/ui/HubCard';
import { useAuth } from '../../hooks/useAuth';
import {
  ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS,
  ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS,
  hasAnyPermission,
} from '../../utils/accessControl';

export function AlmoxarifadoHubPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canViewStock = hasAnyPermission(
    hasPermission,
    ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS
  );
  const canUseOrders = hasAnyPermission(
    hasPermission,
    ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS
  );
  const canOperatePurchases = hasAnyPermission(
    hasPermission,
    ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS
  );
  const canViewPurchaseHistory = hasAnyPermission(
    hasPermission,
    ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS
  );

  return (
    <section className="cadastros-hub fade-in">
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Warehouse size={28} className="text-primary" /> Almoxarifado
            </h1>
            <p className="text-muted">Controle de estoque, catálogo de itens e movimentações.</p>
          </div>
        </div>
      </header>

      <div className="cadastros-hub__grid" style={{ marginTop: '2rem' }}>
        {canViewStock && <HubCard
          label="Estoque"
          description="Consulte saldos, validades e registre entradas, saídas ou ajustes."
          icon={<Warehouse size={34} />}
          color="#f59e0b"
          available
          onClick={() => navigate('/compras/almoxarifado/estoque')}
        />}
        {canViewStock && <HubCard
          label="Itens"
          description="Cadastre, edite, inative e acompanhe o catálogo usado no estoque."
          icon={<Package size={34} />}
          color="#3b82f6"
          available
          onClick={() => navigate('/compras/almoxarifado/itens')}
        />}
        {canUseOrders && <HubCard
          label="Pedidos"
          description="Crie solicitações por equipe e cruze automaticamente com o estoque."
          icon={<ClipboardList size={34} />}
          color="#10b981"
          available
          onClick={() => navigate('/compras/almoxarifado/pedidos')}
        />}
        {canOperatePurchases && <HubCard
          label="Lista de Compras"
          description="Checklist operacional com status, quantidades e valores por item."
          icon={<ShoppingCart size={34} />}
          color="#ec4899"
          available
          onClick={() => navigate('/compras/almoxarifado/compras')}
        />}
        {canViewPurchaseHistory && <HubCard
          label="Compras Realizadas"
          description="Confira compras finalizadas, itens comprados e comprovantes anexados."
          icon={<Receipt size={34} />}
          color="#8b5cf6"
          available
          onClick={() => navigate('/compras/almoxarifado/compras-realizadas')}
        />}
      </div>
    </section>
  );
}
