import React from 'react';
import {
  Home,
  UserPlus,
  FileText,
  Calendar,
  Users,
  Shield,
  Users2,
  MapPin,
  Car,
  Baby,
  ChevronLeft,
  ChevronRight,
  X,
  Folder,
  ShoppingBag,
  UsersRound
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { NavItem } from './NavItem';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen
}) => {
  const { profile, userParticipacao, hasPermission } = useAuth();

  const navLinks = [
    { to: '/dashboard', label: 'Início', icon: Home },
  ];

  const menuItems = [];

  if (hasPermission('modulo_secretaria') || hasPermission('modulo_admin')) {
    menuItems.push(
      { to: '/inscricao', label: 'Inscrições', icon: UserPlus },
      { to: '/secretaria', label: 'Secretaria', icon: FileText },
      { to: '/cadastros', label: 'Cadastros', icon: Calendar },
    );
  }

  const hasCirculosAccess = 
    hasPermission('modulo_circulos') || 
    hasPermission('modulo_circulos_cadastros') || 
    hasPermission('modulo_circulos_coordenador') || 
    hasPermission('modulo_circulos_mediador') || 
    hasPermission('modulo_admin');
    
  if (hasCirculosAccess) {
    menuItems.push({ to: '/circulos', label: 'Círculos', icon: UsersRound });
  }

  if (hasPermission('modulo_admin')) {
    menuItems.push(
      { to: '/admin/usuarios', label: 'Usuários', icon: Users },
      { to: '/admin/acessos', label: 'Acessos', icon: Shield },
    );
  }

  if (hasPermission('modulo_biblioteca') || hasPermission('modulo_admin')) {
    menuItems.push({ to: '/admin/biblioteca', label: 'Biblioteca', icon: Folder });
  }

  if (hasPermission('modulo_compras') || hasPermission('modulo_admin')) {
    menuItems.push({ to: '/compras', label: 'Compras', icon: ShoppingBag });
  }

  if (hasPermission('modulo_coordenador') || userParticipacao?.coordenador) {
    menuItems.push({ to: '/coordenador/minha-equipe', label: 'Minha Equipe', icon: Users2 });
  }

  const hasVisitacaoAccess = hasPermission('modulo_visitacao_coordenar') || hasPermission('modulo_visitacao_duplas') || hasPermission('modulo_admin');
  if (hasVisitacaoAccess) {
    menuItems.push({ to: '/visitacao', label: 'Visitação', icon: MapPin });
  }

  if (hasPermission('modulo_recepcao') || hasPermission('modulo_admin')) {
    menuItems.push({ to: '/atividades/recepcao', label: 'Recepção', icon: Car });
  }

  if (hasPermission('modulo_recreacao') || hasPermission('modulo_admin')) {
    menuItems.push({ to: '/atividades/recreacao', label: 'Recreação Infantil', icon: Baby });
  }

  // Ordena os itens alfabeticamente
  menuItems.sort((a, b) => a.label.localeCompare(b.label));

  // Adiciona ao menu principal após o Início
  navLinks.push(...menuItems);

  const handleLinkClick = () => {
    if (window.innerWidth <= 1024) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${collapsed && !mobileOpen ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Logo" />
          {(!collapsed || mobileOpen) && <span>EJC <strong>Capelinha</strong></span>}
          {mobileOpen && (
            <button className="mobile-close-btn" onClick={() => setMobileOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-color)' }}>
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((link) => (
            <NavItem
              key={link.to}
              to={link.to}
              icon={link.icon}
              label={link.label}
              collapsed={collapsed && !mobileOpen}
              onClick={handleLinkClick}
            />
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`user-compact ${collapsed && !mobileOpen ? 'user-compact--collapsed' : ''}`}>
            <div className="user-compact-avatar">
              {(profile?.nome_completo?.charAt(0) || profile?.email?.charAt(0))?.toUpperCase()}
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="user-compact-info">
                <span className="user-compact-name">{profile?.nome_completo || profile?.email?.split('@')[0]}</span>
                <span className="user-compact-role">
                  {profile?.grupos && profile.grupos.length > 0 ? profile.grupos[0] : 'Usuário'}
                </span>
              </div>
            )}
          </div>

          <button
            className="nav-item collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              border: 'none',
              background: 'none',
              width: '100%',
              cursor: 'pointer',
              display: mobileOpen ? 'none' : 'flex'
            }}
          >
            <div className="nav-item-icon">
              {collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
            </div>
            {!collapsed && <span className="nav-item-label">Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
