import React from 'react';

interface TaxaStatCardProps {
  label: string;
  pagos: number;
  total: number;
  valorPago: number;
  valorTotal: number;
  color: string;
}

export const TaxaStatCard: React.FC<TaxaStatCardProps> = ({
  label,
  pagos,
  total,
  valorPago,
  valorTotal,
  color
}) => {
  const percentual = (pagos / (total || 1)) * 100;

  return (
    <div className="card" style={{ padding: '1.25rem 1rem', borderLeft: `4px solid ${color}` }}>
      <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.5, textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{pagos}</span>
          <span style={{ opacity: 0.4, fontSize: '0.9rem' }}>/ {total}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color }}>
            {valorPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            <span style={{ opacity: 0.6, fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-color)' }}>
              {' '} / {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>
      <div className="progress-bar" style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${percentual}%`,
            background: color,
            transition: 'width 0.3s'
          }}
        />
      </div>
    </div>
  );
};
