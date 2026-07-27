import { ChevronLeft, CircleDollarSign, FileText, Loader, PackagePlus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { StorageLink } from '../../components/storage/StorageLink';
import { MobileFileUploadButton } from '../../components/ui/MobileFileUploadButton';
import { almoxarifadoService } from '../../services/almoxarifadoService';
import type { AlmoxarifadoCompra } from '../../types/almoxarifado';
import './AlmoxarifadoPage.css';

const money = (value: number | null | undefined) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatQuantity = (value: number, sigla?: string | null) => {
  const formatted = value.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  });
  return `${formatted}${sigla ? ` ${sigla}` : ''}`;
};

export function AlmoxarifadoCompraDetalhePage() {
  const navigate = useNavigate();
  const { compraId } = useParams();
  const [compra, setCompra] = useState<AlmoxarifadoCompra | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [launchingStock, setLaunchingStock] = useState(false);
  const [launchingFinance, setLaunchingFinance] = useState(false);
  const [removingProof, setRemovingProof] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadCompra = useCallback(async () => {
    if (!compraId) return;

    setLoading(true);
    try {
      const compras = await almoxarifadoService.listarCompras();
      setCompra(compras.find((item) => item.id === compraId) || null);
    } catch (error) {
      console.error('Erro ao carregar compra:', error);
      toast.error('Não foi possível carregar a compra.');
    } finally {
      setLoading(false);
    }
  }, [compraId]);

  useEffect(() => {
    loadCompra();
  }, [loadCompra]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const itens = compra?.itens || [];
    if (!term) return itens;

    return itens.filter((item) =>
      item.item?.nome?.toLowerCase().includes(term)
      || item.marca?.toLowerCase().includes(term)
      || item.mercado_fornecedor?.toLowerCase().includes(term)
      || item.item?.marca_preferida?.toLowerCase().includes(term),
    );
  }, [compra, search]);

  const handleUploadProofs = async (selectedFiles: File[]) => {
    if (!compra || !selectedFiles.length || uploading) return;

    setUploading(true);
    try {
      const updatedCompra = await almoxarifadoService.anexarComprovantesCompra(compra, selectedFiles);
      setCompra(updatedCompra);
      toast.success('Comprovante(s) anexado(s).');
    } catch (error) {
      console.error('Erro ao anexar comprovantes:', error);
      toast.error('Não foi possível anexar os comprovantes.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveProof = async (reference: string) => {
    if (!compra || removingProof) return;

    setRemovingProof(reference);
    try {
      const updatedCompra = await almoxarifadoService.removerComprovanteAnexadoCompra(compra, reference);
      setCompra(updatedCompra);
      toast.success('Comprovante removido.');
    } catch (error) {
      console.error('Erro ao remover comprovante:', error);
      toast.error('Não foi possível remover o comprovante.');
    } finally {
      setRemovingProof(null);
    }
  };

  const handleLaunchStock = async () => {
    if (!compra || launchingStock) return;

    setLaunchingStock(true);
    try {
      const updatedCompra = await almoxarifadoService.finalizarCompra(
        compra.id,
        (compra.itens || []).map((item) => ({
          id: item.id,
          status: item.status,
          quantidade_comprada: item.quantidade_comprada,
          valor_unitario: item.valor_unitario,
          mercado_fornecedor: item.mercado_fornecedor || '',
          observacoes: item.observacoes || '',
        })),
        compra.comprovantes_urls || [],
      );
      setCompra(updatedCompra);
      toast.success('Estoque e financeiro atualizados.');
    } catch (error) {
      console.error('Erro ao lançar estoque da compra:', error);
      toast.error('Não foi possível lançar os itens no estoque.');
    } finally {
      setLaunchingStock(false);
    }
  };

  const handleLaunchFinance = async () => {
    if (!compra || launchingFinance) return;

    setLaunchingFinance(true);
    try {
      const updatedCompra = await almoxarifadoService.lancarFinanceiroCompra(compra.id);
      setCompra(updatedCompra);
      toast.success('Financeiro lançado.');
    } catch (error) {
      console.error('Erro ao lançar financeiro da compra:', error);
      toast.error('Não foi possível lançar a compra no financeiro.');
    } finally {
      setLaunchingFinance(false);
    }
  };

  if (loading) {
    return <section className="almox-page fade-in"><div className="card empty-state"><Loader className="animate-spin" /> Carregando compra...</div></section>;
  }

  if (!compra) {
    return <section className="almox-page fade-in"><div className="card empty-state">Compra não encontrada.</div></section>;
  }

  const comprovantes = compra.comprovantes_urls || [];

  return (
    <section className="almox-page fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate('/compras/almoxarifado/compras-realizadas')} className="icon-btn">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55 }}>Compras Realizadas</p>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
              Compra de {new Date(`${compra.data_compra}T00:00:00`).toLocaleDateString('pt-BR')}
            </h1>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              {compra.itens?.length || 0} item(ns) · {money(compra.valor_total_calculado)}
            </p>
            <div className="almox-status-row">
              <span className={compra.estoque_lancado_em ? 'almox-status-pill success' : 'almox-status-pill warning'}>
                Estoque {compra.estoque_lancado_em ? 'lançado' : 'pendente'}
              </span>
              <span className={compra.financeiro_lancado_em ? 'almox-status-pill success' : 'almox-status-pill warning'}>
                Financeiro {compra.financeiro_lancado_em ? 'lançado' : 'pendente'}
              </span>
            </div>
          </div>
        </div>

      </div>

      <section className="card almox-history-card">
        <div className="almox-section-header">
          <div>
            <h3>Comprovantes</h3>
            <p className="text-muted">{comprovantes.length} arquivo(s) anexado(s).</p>
          </div>
          <div className="almox-actions">
            {!compra.estoque_lancado_em && (
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={launchingStock}
                onClick={handleLaunchStock}
              >
                {launchingStock ? <Loader className="animate-spin" size={16} /> : <PackagePlus size={16} />}
                Lançar estoque
              </button>
            )}
            {compra.estoque_lancado_em && !compra.financeiro_lancado_em && (
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={launchingFinance}
                onClick={handleLaunchFinance}
              >
                {launchingFinance ? <Loader className="animate-spin" size={16} /> : <CircleDollarSign size={16} />}
                Lançar financeiro
              </button>
            )}
            <MobileFileUploadButton
              label={uploading ? 'Anexando...' : 'Anexar comprovantes'}
              disabled={uploading}
              onFiles={handleUploadProofs}
            />
          </div>
        </div>
        <div className="almox-history-proof-list">
          {comprovantes.length === 0 ? (
            <span className="text-muted">Nenhum comprovante anexado.</span>
          ) : comprovantes.map((reference, index) => (
            <span key={`${reference}-${index}`} className="almox-proof-pill">
              <StorageLink reference={reference} target="_blank" rel="noreferrer" className="almox-proof-link">
                <FileText size={15} /> Comprovante {index + 1}
              </StorageLink>
              <button
                type="button"
                onClick={() => handleRemoveProof(reference)}
                disabled={removingProof === reference}
                aria-label={`Remover comprovante ${index + 1}`}
                title="Remover comprovante"
              >
                {removingProof === reference ? <Loader className="animate-spin" size={14} /> : <Trash2 size={14} />}
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="card almox-history-card">
        <div className="almox-section-header">
          <div>
            <h3>Itens comprados</h3>
            <p className="text-muted">Use a busca para conferir listas grandes rapidamente.</p>
          </div>
          <input
            className="form-input standard-input almox-history-search"
            placeholder="Buscar item, marca ou local..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="almox-history-items">
          {filteredItems.map((item) => (
            <div key={item.id} className="almox-history-detail-row">
              <div className="almox-history-item-info">
                <strong>{item.item?.nome || 'Item'}</strong>
                <span>{item.marca || item.item?.marca_preferida || 'Marca livre'} · {item.mercado_fornecedor || 'Local não informado'}</span>
              </div>
              <div><span>Qtd.</span><strong>{formatQuantity(item.quantidade_comprada, item.item?.unidade?.sigla)}</strong></div>
              <div><span>Unitário</span><strong>{money(item.valor_unitario)}</strong></div>
              <div><span>Total</span><strong>{money(item.valor_total)}</strong></div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
