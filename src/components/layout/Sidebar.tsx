import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { getNavigationModules, getSidebarNavigationGroups } from '../../config/navigation';
import { NavItem } from './NavItem';
import ejcLogo from '../../assets/brand-experiments/ejc-logo.png';

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
  const { profile, userParticipacao, hasPermission, hasExactPermission } = useAuth();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const equipeNome = userParticipacao?.equipes?.nome ?? '';
  const navigationContext = {
    hasPermission,
    hasExactPermission,
    isCoordinator: Boolean(userParticipacao?.coordenador),
    teamName: equipeNome,
  };
  const homeLink = getNavigationModules('sidebar', navigationContext)
    .find((module) => module.id === 'inicio');
  const navigationGroups = getSidebarNavigationGroups(navigationContext);

  const handleLinkClick = () => {
    if (window.innerWidth <= 1180) {
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mobileOpen, setMobileOpen]);

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Fechar menu principal"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="sidebar-navigation"
        className={`sidebar ${collapsed && !mobileOpen ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--open' : ''}`}
        aria-label="Menu principal"
      >
        <div className="sidebar-logo">
          <img src={ejcLogo} alt="Símbolo EJC"  />
          {(!collapsed || mobileOpen) && <span>EJC <strong>Capelinha</strong></span>}
          {mobileOpen && (
            <button
              ref={closeButtonRef}
              type="button"
              className="mobile-close-btn"
              aria-label="Fechar menu principal"
              onClick={() => setMobileOpen(false)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-color)' }}
            >
              <X size={24} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Módulos do sistema">
          {homeLink && (
            <NavItem
              to={homeLink.path}
              icon={homeLink.icon}
              label={homeLink.label}
              collapsed={collapsed && !mobileOpen}
              onClick={handleLinkClick}
            />
          )}

          {navigationGroups.map((group) => (
            <section
              key={group.id}
              className="sidebar-nav-group"
              aria-label={group.label}
            >
              <div className="sidebar-nav-group__label" aria-hidden="true">
                {group.label}
              </div>
              {group.modules.map((link) => (
                <NavItem
                  key={link.path}
                  to={link.path}
                  icon={link.icon}
                  label={link.label}
                  collapsed={collapsed && !mobileOpen}
                  onClick={handleLinkClick}
                />
              ))}
            </section>
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
              </div>
            )}
          </div>

          <button
            type="button"
            className="nav-item collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expandir menu principal' : 'Recolher menu principal'}
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
