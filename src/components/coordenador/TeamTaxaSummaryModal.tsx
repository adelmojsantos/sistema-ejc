import { X, DollarSign, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import { formatBRL } from '../../utils/currencyUtils';

export interface MemberTaxaStatus {
  id: string;
  nome: string;
  pago: boolean;
  telefone?: string;
}

interface TeamTaxaSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberTaxaStatus[];
  equipeNome: string;
  valorTaxa: number;
}

export function TeamTaxaSummaryModal({ isOpen, onClose, members, equipeNome, valorTaxa }: TeamTaxaSummaryModalProps) {
  if (!isOpen) return null;

  const pagos = members.filter(m => m.pago);
  const pendentes = members.filter(m => !m.pago);

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  const createWhatsAppLink = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleaned}`;
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '40px', height: '40px', borderRadius: '10px', 
              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' 
            }}>
              <DollarSign size={22} />
            </div>
            <div>
              <h2 className="modal-title">Resumo de Taxas</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Situação dos pagamentos - {equipeNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={14} /> Pagos
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{pagos.length}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{formatBRL(pagos.length * valorTaxa)}</div>
            </div>
            <div className="card" style={{ padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={14} /> Pendentes
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{pendentes.length}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>{formatBRL(pendentes.length * valorTaxa)}</div>
            </div>
          </div>

          {pendentes.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={16} /> Pendentes ({pendentes.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pendentes.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--surface-1)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.nome}</span>
                    {m.telefone && (
                      <a href={createWhatsAppLink(m.telefone)} target="_blank" rel="noopener noreferrer" className="btn-text" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981' }}>
                        <Phone size={12} />
                        {formatPhone(m.telefone)}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pagos.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle size={16} /> Pagos ({pagos.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pagos.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--surface-1)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.nome}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>{formatBRL(valorTaxa)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--surface-2)' }}>
          <button onClick={onClose} className="btn-primary" style={{ padding: '0.6rem 2rem' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
