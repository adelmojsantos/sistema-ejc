import type { KeyboardEvent, ReactNode } from 'react';

interface HubCardProps {
  label: string;
  description?: string;
  icon: ReactNode;
  color: string;
  available?: boolean;
  soonLabel?: string;
  className?: string;
  onClick: () => void;
}

export function HubCard({
  label,
  description,
  icon,
  color,
  available = true,
  soonLabel = 'Em Breve',
  className = '',
  onClick
}: HubCardProps) {
  const handleClick = () => {
    if (!available) return;
    onClick();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!available) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      className={`cadastros-hub__card card ${!available ? 'is-disabled' : ''} ${className}`.trim()}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-disabled={!available}
    >
      <div className="cadastros-hub__content">
        <span
          className="cadastros-hub__icon"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </span>
        <div>
          <h3>{label}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>

      {!available && <span className="cadastros-hub__tag">{soonLabel}</span>}
    </article>
  );
}
