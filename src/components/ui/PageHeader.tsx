import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backPath?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
}

export function PageHeader({ 
  title, 
  subtitle, 
  onBack, 
  backPath, 
  actions, 
  tabs 
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="page-header-standard">
      <div className="page-header-top">
        <div className="page-header-left">
          <button 
            onClick={handleBack} 
            className="page-header-back-btn"
            aria-label="Voltar"
            title="Voltar"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="page-header-titles">
            {subtitle && <span className="page-header-subtitle">{subtitle}</span>}
            <h1 className="page-header-title">{title}</h1>
          </div>
        </div>

        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>

      {tabs && (
        <div className="page-header-tabs-bar">
          {tabs}
        </div>
      )}
    </div>
  );
}
