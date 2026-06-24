import React from 'react';
import { FileText } from 'lucide-react';
import type { TaxaReport } from '../../../services/comprasService';

interface TaxaEquipeSummaryCardProps {
  report: TaxaReport;
  isSelected: boolean;
  onClick: () => void;
  onOpenProofs: (equipeNome: string, urls: string[]) => void;
}

export const TaxaEquipeSummaryCard: React.FC<TaxaEquipeSummaryCardProps> = ({
  report,
  isSelected,
  onClick,
  onOpenProofs
}) => {
  const comprovantes = report.comprovantes_taxas_urls?.length
    ? report.comprovantes_taxas_urls
    : report.comprovante_taxas_url
      ? [report.comprovante_taxas_url]
      : [];
  const hasPending = report.pendentes > 0;
  const hasProof = comprovantes.length > 0;
  const statusStyle = hasPending
    ? {
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
    }
    : hasProof
      ? {
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
      }
      : {
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
      };
  const selectedBackground = 'rgba(245, 158, 11, 0.24)';

  return (
    <div
      className="card card--clickable"
      style={{
        padding: '0.75rem 1rem',
        borderLeft: `4px solid ${statusStyle.borderColor}`,
        cursor: 'pointer',
        backgroundColor: isSelected ? selectedBackground : statusStyle.backgroundColor,
        boxShadow: undefined
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
        {comprovantes.length > 0 && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              onOpenProofs(report.equipe_nome, comprovantes);
            }}
            className="btn-icon"
            title={`Ver ${comprovantes.length} comprovante(s) de taxas`}
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
  );
};
