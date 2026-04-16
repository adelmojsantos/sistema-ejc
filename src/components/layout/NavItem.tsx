import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  collapsed?: boolean;
}

export const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, onClick, collapsed }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => 
        `nav-item ${isActive ? 'nav-item--active' : ''}`
      }
      title={collapsed ? label : undefined}
    >
      <div className="nav-item-icon">
        <Icon size={22} />
      </div>
      <span className="nav-item-label">{label}</span>
    </NavLink>
  );
};
