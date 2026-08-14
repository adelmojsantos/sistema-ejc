import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { getNavigationModules, getSidebarNavigationGroups } from '../../config/navigation';
import { NavItem } from './NavItem';
import { GlobalSearchDialog } from './GlobalSearchDialog';
import { PessoaContextDrawer } from '../secretaria/PessoaContextDrawer';
import { useEncontros } from '../../contexts/EncontroContext';
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
  const { encontroSelecionadoId } = useEncontros();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [contextParticipacaoId, setContextParticipacaoId] = useState<string | null>(null);
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
  const isCompact = collapsed && !mobileOpen;

  const searchShortcutLabel = useMemo(() => navigator.platform.toLowerCase().includes('mac') ? '⌘ K' : 'Ctrl K', []);

  const openGlobalSearch = useCallback(() => {
    if (window.innerWidth <= 1180) setMobileOpen(false);
    setSearchOpen(true);
  }, [setMobileOpen]);

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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openGlobalSearch();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openGlobalSearch]);

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
          {!mobileOpen && (
            <button
              type="button"
              className="sidebar-collapse-control"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expandir menu principal' : 'Recolher menu principal'}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </button>
          )}
        </div>

        <div className="sidebar-primary-actions">
          <button
            type="button"
            className="nav-item sidebar-search-trigger"
            onClick={openGlobalSearch}
            title={isCompact ? 'Buscar no sistema' : undefined}
          >
            <span className="nav-item-icon"><Search size={22} /></span>
            <span className="nav-item-label">Buscar</span>
            {!isCompact && <kbd>{searchShortcutLabel}</kbd>}
          </button>
          {homeLink && (
            <NavItem
              to={homeLink.path}
              icon={homeLink.icon}
              label={homeLink.label}
              collapsed={isCompact}
              onClick={handleLinkClick}
            />
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Módulos do sistema">
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
                  collapsed={isCompact}
                  onClick={handleLinkClick}
                />
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`user-compact ${isCompact ? 'user-compact--collapsed' : ''}`}>
            <div className="user-compact-avatar">
              {(profile?.nome_completo?.charAt(0) || profile?.email?.charAt(0))?.toUpperCase()}
            </div>
            {!isCompact && (
              <div className="user-compact-info">
                <span className="user-compact-name">{profile?.nome_completo || profile?.email?.split('@')[0]}</span>
              </div>
            )}
          </div>

        </div>
      </aside>

      <GlobalSearchDialog
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        suspended={Boolean(contextParticipacaoId)}
        onSelectPerson={(participacaoId) => {
          setMobileOpen(false);
          setContextParticipacaoId(participacaoId);
        }}
      />
      <PessoaContextDrawer
        participacaoId={contextParticipacaoId}
        encontroId={encontroSelecionadoId || null}
        stacked
        onClose={() => setContextParticipacaoId(null)}
        onNavigate={() => {
          setContextParticipacaoId(null);
          setSearchOpen(false);
        }}
      />
    </>
  );
};
