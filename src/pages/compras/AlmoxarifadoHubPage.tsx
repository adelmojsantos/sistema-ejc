import { ChevronLeft, ClipboardList, Package, Receipt, ShoppingCart, Warehouse } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HubCard } from '../../components/ui/HubCard';

export function AlmoxarifadoHubPage() {
  const navigate = useNavigate();

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
        <HubCard
          label="Estoque"
          description="Consulte saldos, validades e registre entradas, saídas ou ajustes."
          icon={<Warehouse size={34} />}
          color="#f59e0b"
          available
          onClick={() => navigate('/compras/almoxarifado/estoque')}
        />
        <HubCard
          label="Itens"
          description="Cadastre, edite, inative e acompanhe o catálogo usado no estoque."
          icon={<Package size={34} />}
          color="#3b82f6"
          available
          onClick={() => navigate('/compras/almoxarifado/itens')}
        />
        <HubCard
          label="Pedidos"
          description="Crie solicitações por equipe e cruze automaticamente com o estoque."
          icon={<ClipboardList size={34} />}
          color="#10b981"
          available
          onClick={() => navigate('/compras/almoxarifado/pedidos')}
        />
        <HubCard
          label="Lista de Compras"
          description="Checklist operacional com status, quantidades e valores por item."
          icon={<ShoppingCart size={34} />}
          color="#ec4899"
          available
          onClick={() => navigate('/compras/almoxarifado/compras')}
        />
        <HubCard
          label="Compras Realizadas"
          description="Confira compras finalizadas, itens comprados e comprovantes anexados."
          icon={<Receipt size={34} />}
          color="#8b5cf6"
          available
          onClick={() => navigate('/compras/almoxarifado/compras-realizadas')}
        />
      </div>
    </section>
  );
}
