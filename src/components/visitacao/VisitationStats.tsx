import React from 'react';
import { Users, TrendingUp, DollarSign, CheckCircle } from 'lucide-react';

interface VisitationStatsProps {
  total: number;
  realizadas: number;
  pendentesPagamento: number;
  layout?: 'dashboard' | 'compact';
}

export const VisitationStats: React.FC<VisitationStatsProps> = ({
  total,
  realizadas,
  pendentesPagamento,
  layout = 'dashboard'
}) => {
  const percent = total > 0 ? (realizadas / total) * 100 : 0;

  if (layout === 'compact') {
    return (
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={16} color="var(--muted-text)" />
          <span style={{ fontWeight: 600 }}>{total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} color="#10b981" />
          <span style={{ fontWeight: 600 }}>{realizadas}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DollarSign size={16} color={pendentesPagamento > 0 ? '#ef4444' : '#10b981'} />
          <span style={{ fontWeight: 600 }}>{pendentesPagamento}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="visita-dashboard-grid" style={{ marginBottom: '2.5rem' }}>
      <div className="visita-dashboard-card visita-card-indigo">
        <div className="visita-card-icon-container">
          <Users size={20} />
        </div>
        <div className="visita-card-content">
          <p className="visita-card-label">Total de Visitas</p>
          <h2 className="visita-card-value">{total}</h2>
        </div>
      </div>

      <div className="visita-dashboard-card visita-card-emerald">
        <div className="visita-card-icon-container">
          <TrendingUp size={20} />
        </div>
        <div className="visita-card-content">
          <p className="visita-card-label">Realizadas</p>
          <h2 className="visita-card-value">{realizadas}</h2>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.2rem' }}>
            {percent.toFixed(0)}% concluído
          </div>
        </div>
      </div>

      <div className="visita-dashboard-card visita-card-rose" style={{
        background: pendentesPagamento > 0 ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
      }}>
        <div className="visita-card-icon-container">
          <DollarSign size={20} />
        </div>
        <div className="visita-card-content">
          <p className="visita-card-label">Pendentes de Taxa</p>
          <h2 className="visita-card-value">{pendentesPagamento}</h2>
        </div>
      </div>
    </div>
  );
};
