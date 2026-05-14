import React from 'react';
import { FileText } from 'lucide-react';
import type { TaxaReport } from '../../../services/comprasService';

interface TaxaEquipeSummaryCardProps {
  report: TaxaReport;
  isSelected: boolean;
  onClick: () => void;
}

export const TaxaEquipeSummaryCard: React.FC<TaxaEquipeSummaryCardProps> = ({
  report,
  isSelected,
  onClick
}) => {
  return (
    <div
      className={`card card--clickable ${isSelected ? 'active-filter' : ''}`}
      style={{
        padding: '0.75rem 1rem',
        borderLeft: `4px solid ${report.pendentes === 0 ? 'var(--success-color)' : 'var(--warning-color)'}`,
        cursor: 'pointer',
        backgroundColor: isSelected
          ? 'rgba(37, 99, 235, 0.1)'
          : report.comprovante_taxas_url
            ? 'var(--success-bg)'
            : 'var(--card-bg)'
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>
            {report.equipe_nome}
          </span>
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {report.pagos}/{report.total_membros}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {report.comprovante_taxas_url && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(report.comprovante_taxas_url!, '_blank');
              }}
              className="btn-icon"
              title="Ver Comprovante Taxas"
              style={{
                padding: '0.4rem',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary-color)',
                borderRadius: '8px'
              }}
            >
              <FileText size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
