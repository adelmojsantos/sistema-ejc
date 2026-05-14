import { X, LayoutGrid } from 'lucide-react';
import { formatBRL } from '../../utils/currencyUtils';

interface ResumoModelo {
  modelo_id: string;
  modelo_nome: string;
  tamanhos: Record<string, number>;
  total: number;
  valor_unitario: number;
  valor_total: number;
}

interface TeamShirtSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  resumo: ResumoModelo[];
  equipeNome: string;
}

export function TeamShirtSummaryModal({ isOpen, onClose, resumo, equipeNome }: TeamShirtSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '10px', 
              backgroundColor: 'rgba(var(--primary-rgb), 0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' 
            }}>
              <LayoutGrid size={22} />
            </div>
            <div>
              <h2 className="modal-title">Resumo de Camisetas</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Totalização por modelo e tamanho - {equipeNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {resumo.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
              Nenhum pedido registrado para sua equipe.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {resumo.map(m => (
                <div key={m.modelo_id} className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>{m.modelo_nome}</h3>
                    <span className="badge badge-primary" style={{ padding: '0.2rem 0.6rem', borderRadius: '6px' }}>{m.total} total</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: '0.75rem' }}>
                    {Object.entries(m.tamanhos)
                      .sort((a, b) => a[0].localeCompare(b[0])) // Simplificado, idealmente usaria ordem do banco
                      .map(([tam, qtd]) => (
                        <div
                          key={`${m.modelo_id}-${tam}`}
                          style={{ 
                            textAlign: 'center', 
                            padding: '0.6rem 0.4rem', 
                            background: 'var(--surface-1)', 
                            borderRadius: '10px', 
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                          }}
                        >
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{tam}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{qtd}</div>
                        </div>
                      ))}
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Unit.: {m.valor_unitario > 0 ? formatBRL(m.valor_unitario) : 'A confirmar'}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                      Subtotal: {m.valor_total > 0 ? formatBRL(m.valor_total) : 'A confirmar'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', fontWeight: 800 }}>Investimento Total</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary-color)' }}>
              {formatBRL(resumo.reduce((acc, curr) => acc + curr.valor_total, 0))}
            </div>
          </div>
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.6rem 2rem' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
