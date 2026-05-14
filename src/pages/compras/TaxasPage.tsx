import { ChevronLeft, Loader, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useEncontros } from '../../contexts/EncontroContext';
import { encontroService } from '../../services/encontroService';
import { useTaxas } from '../../hooks/useTaxas';
import { TaxaStatCard } from '../../components/compras/taxas/TaxaStatCard';
import { TaxaParticipanteItem } from '../../components/compras/taxas/TaxaParticipanteItem';
import { TaxaEquipeSummaryCard } from '../../components/compras/taxas/TaxaEquipeSummaryCard';
import { PixPaymentInfo } from '../../components/financeiro/PixPaymentInfo';

export function TaxasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');

  // Sincroniza encontro ativo inicialmente
  useEffect(() => {
    if (encontros.length > 0 && !selectedEncontroId) {
      const active = encontros.find(e => e.ativo);
      setSelectedEncontroId(active?.id || encontros[0].id);
    }
  }, [encontros, selectedEncontroId]);

  const encontroData = encontros.find(e => e.id === selectedEncontroId);
  const valorTaxa = encontroData?.valor_taxa || 0;

  // Nossa Camada de Orquestração (Hook Interactor)
  const {
    participantes,
    equipes,
    relatorioTaxas,
    stats,
    loading,
    updatingId,
    activeTab,
    selectedEquipeId,
    searchTerm,
    actions
  } = useTaxas({ encontroId: selectedEncontroId, valorTaxa });

  return (
    <div className="fade-in">
      {/* Header Section */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Módulo de Compras</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Pagamento de Taxas</h1>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <LiveSearchSelect
            value={selectedEncontroId}
            onChange={val => setSelectedEncontroId(val)}
            fetchData={async (s, p) => await encontroService.buscarComPaginacao(s, p)}
            getOptionLabel={e => e.nome}
            getOptionValue={e => e.id}
            initialOptions={encontros}
          />
        </div>
      </div>

      <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
        <PixPaymentInfo 
          chave={encontroData?.pix_taxa_chave}
          tipo={encontroData?.pix_taxa_tipo as any}
          qrCodeUrl={encontroData?.pix_taxa_qrcode_url}
          variant="compact"
        />
      </div>

      {/* Estatísticas (Domain Insights) */}
      <section className="grid-container" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <TaxaStatCard 
          label="Geral (Total)" 
          pagos={stats.pagos} 
          total={stats.total} 
          valorPago={stats.financeiroGeral.pago}
          valorTotal={stats.financeiroGeral.total}
          color="var(--primary-color)"
        />
        <TaxaStatCard 
          label="Encontristas" 
          pagos={stats.pagosEnc} 
          total={stats.totalEnc} 
          valorPago={stats.financeiroEnc.pago}
          valorTotal={stats.financeiroEnc.total}
          color="var(--accent-color)"
        />
        <TaxaStatCard 
          label="Equipes" 
          pagos={stats.pagosTrab} 
          total={stats.totalTrab} 
          valorPago={stats.financeiroTrab.pago}
          valorTotal={stats.financeiroTrab.total}
          color="var(--success-color)"
        />
      </section>

      {/* Navegação de Abas */}
      <div className="tabs-container" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'encontristas' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
          onClick={() => { actions.setActiveTab('encontristas'); actions.setSelectedEquipeId('all'); }}
        >
          Encontristas
        </button>
        <button
          className={`btn ${activeTab === 'equipes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '20px', padding: '0.5rem 1.5rem' }}
          onClick={() => actions.setActiveTab('equipes')}
        >
          Equipes
        </button>
      </div>

      {/* Resumo de Equipes (Apenas na aba Equipes) */}
      {activeTab === 'equipes' && (
        <section className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            className={`card card--clickable ${selectedEquipeId === 'all' ? 'active-filter' : ''}`}
            style={{
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              backgroundColor: selectedEquipeId === 'all' ? 'rgba(37, 99, 235, 0.05)' : 'var(--card-bg)'
            }}
            onClick={() => actions.setSelectedEquipeId('all')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Todas Equipes</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{stats.pagosTrab}/{stats.totalTrab}</span>
            </div>
          </div>
          {relatorioTaxas.filter(r => r.total_membros > 0).map(r => (
            <TaxaEquipeSummaryCard
              key={r.equipe_id}
              report={r}
              isSelected={selectedEquipeId === r.equipe_id}
              onClick={() => actions.setSelectedEquipeId(r.equipe_id)}
            />
          ))}
        </section>
      )}

      {/* Busca e Filtros */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="form-input-wrapper" style={{ flex: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder={`Buscar ${activeTab}...`}
              value={searchTerm}
              onChange={e => actions.setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'equipes' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
              <select 
                className="form-input" 
                value={selectedEquipeId} 
                onChange={e => actions.setSelectedEquipeId(e.target.value)}
              >
                <option value="all">Todas as Equipes</option>
                {equipes.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Listagem de Participantes */}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1rem', margin: 0, opacity: 0.7, textTransform: 'capitalize' }}>
          {activeTab} ({participantes.length})
        </h2>
      </div>

      <div className="grid-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <Loader className="animate-spin" size={32} style={{ margin: '0 auto', opacity: 0.5 }} />
            <p style={{ marginTop: '1rem', opacity: 0.6 }}>Carregando...</p>
          </div>
        ) : participantes.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
            Nenhum {activeTab === 'encontristas' ? 'encontrista' : 'trabalhador'} encontrado.
          </div>
        ) : (
          participantes.map(p => (
            <TaxaParticipanteItem
              key={p.id}
              participante={p}
              activeTab={activeTab}
              isUpdating={updatingId === p.id}
              onToggle={actions.togglePagamento}
            />
          ))
        )}
      </div>
    </div>
  );
}
