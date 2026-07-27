import { ChevronLeft, Eye, Loader, Receipt } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { useEncontros } from '../../contexts/EncontroContext';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import { encontroService } from '../../services/encontroService';
import type { AlmoxarifadoCompra } from '../../types/almoxarifado';
import './AlmoxarifadoPage.css';

const money = (value: number | null | undefined) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AlmoxarifadoComprasRealizadasPage() {
  const navigate = useNavigate();
  const { encontros } = useEncontros();
  const encontroPadraoId = encontros.find((encontro) => encontro.ativo)?.id || encontros[0]?.id || '';
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const encontroSelecionadoId = selectedEncontroId || encontroPadraoId;
  const [compras, setCompras] = useState<AlmoxarifadoCompra[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompras = useCallback(async () => {
    setLoading(true);
    try {
      setCompras(await almoxarifadoService.listarCompras(encontroSelecionadoId));
    } catch (error) {
      console.error('Erro ao carregar compras realizadas:', error);
      toast.error('Não foi possível carregar as compras realizadas.');
    } finally {
      setLoading(false);
    }
  }, [encontroSelecionadoId]);

  useEffect(() => {
    loadCompras();
  }, [loadCompras]);

  const comprasRealizadas = useMemo(
    () => compras.filter((compra) => compra.status === 'finalizada'),
    [compras],
  );

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras/almoxarifado')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Estoque / Almoxarifado</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Compras Realizadas</h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Histórico para conferência dos itens comprados e comprovantes anexados.
            </p>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <LiveSearchSelect
            value={encontroSelecionadoId}
            onChange={val => setSelectedEncontroId(val)}
            fetchData={async (s, p) => await encontroService.buscarComPaginacao(s, p)}
            getOptionLabel={e => e.nome}
            getOptionValue={e => e.id}
            initialOptions={encontros}
          />
        </div>
      </div>

      {loading ? (
        <div className="card empty-state"><Loader className="animate-spin" /> Carregando compras...</div>
      ) : comprasRealizadas.length === 0 ? (
        <div className="card empty-state">Nenhuma compra realizada para este encontro.</div>
      ) : (
        <section className="card almox-history-card">
          <div className="almox-history-list">
            {comprasRealizadas.map((compra) => (
              <article key={compra.id} className="almox-history-item">
                <div className="almox-history-summary">
                  <div className="almox-history-title">
                    <strong>{new Date(`${compra.data_compra}T00:00:00`).toLocaleDateString('pt-BR')}</strong>
                    <span>{compra.itens?.length || 0} item(ns)</span>
                    <span>{money(compra.valor_total_calculado)}</span>
                    <span><Receipt size={14} /> {compra.comprovantes_urls?.length || 0} comprovante(s)</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => navigate(`/compras/almoxarifado/compras-realizadas/${compra.id}`)}
                >
                  <Eye size={16} /> Ver itens
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
