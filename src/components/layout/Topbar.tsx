import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Settings,
  LockKeyhole
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationTitle } from '../../config/navigation';
import { ConfirmDialog } from '../ConfirmDialog';
import { useEncontros } from '../../contexts/EncontroContext';

interface TopbarProps {
  onMenuClick: () => void;
  mobileMenuOpen: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, mobileMenuOpen }) => {
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const { encontros, encontroSelecionadoId, selecionarEncontro, selecaoBloqueada, encontroSelecionado, isLoading: encontrosLoading } = useEncontros();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isEncounterMenuOpen, setIsEncounterMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const encounterMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (encounterMenuRef.current && !encounterMenuRef.current.contains(event.target as Node)) {
        setIsEncounterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out', error);
    } finally {
      setIsSigningOut(false);
      setIsSignOutModalOpen(false);
    }
  };

  const getPageTitle = () => {
    const searchParams = new URLSearchParams(location.search);
    const moduleName = searchParams.get('module');

    if (moduleName) return moduleName;
    return getNavigationTitle(location.pathname);
  };

  const pageTitle = getPageTitle();
  const rootTitle = (() => {
    const roots = [
      ['/cadastros', 'Cadastros'],
      ['/circulos', 'Círculos'],
      ['/compras', 'Compras'],
      ['/secretaria', 'Secretaria'],
      ['/visitacao', 'Visitação'],
      ['/coordenador', 'Coordenação'],
      ['/admin', 'Administração'],
      ['/palestras', 'Palestras'],
      ['/recepcao', 'Recepção'],
      ['/recreacao', 'Recreação'],
      ['/cuidados', 'Cuidados'],
      ['/ligacao', 'Ligação'],
    ] as const;
    return roots.find(([prefix]) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`))?.[1] ?? pageTitle;
  })();


  return (
    <>
      <header className="topbar">
        <div className="topbar-heading flex items-center gap-4">
          <button
            className="mobile-menu-btn"
            onClick={onMenuClick}
            aria-label={mobileMenuOpen ? 'Fechar menu principal' : 'Abrir menu principal'}
            aria-expanded={mobileMenuOpen}
            aria-controls="sidebar-navigation"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="topbar-heading-copy">
            <h1 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>{rootTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {encontros.length > 0 && (
            <div className="topbar-encounter-selector" ref={encounterMenuRef}>
              <span className="sr-only">Encontro selecionado</span>
              {selecaoBloqueada ? (
                <span className="topbar-encounter-content topbar-encounter-locked"
                  title="Coordenadores ficam vinculados ao encontro da sua participação"
                  aria-label="Encontro selecionado e bloqueado para coordenadores"
                >
                  <LockKeyhole size={14} aria-hidden="true" />
                  <span>
                    <small>Edição selecionada</small>
                    <strong>{encontroSelecionado?.edicao ? `${encontroSelecionado.edicao}º EJC` : encontroSelecionado?.nome ?? 'Encontro'}</strong>
                    <em className={`topbar-encounter-status ${encontroSelecionado?.ativo ? 'is-active' : 'is-history'}`}>
                      {encontroSelecionado?.ativo ? 'Ativo' : 'Histórico'}
                    </em>
                  </span>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="topbar-encounter-trigger"
                    onClick={() => setIsEncounterMenuOpen((open) => !open)}
                    aria-label="Alterar encontro selecionado"
                    aria-expanded={isEncounterMenuOpen}
                  >
                    <span className="topbar-encounter-content">
                      <small>Edição selecionada</small>
                      <span style={{ display: 'flex', gap: '0.5rem' }}>
                        <strong>
                          {encontroSelecionado?.edicao ? `${encontroSelecionado.edicao}º EJC` : encontroSelecionado?.nome ?? (encontrosLoading ? 'Carregando…' : 'Selecionar')}
                        </strong>
                        <em className={`topbar-encounter-status ${encontroSelecionado?.ativo ? 'is-active' : 'is-history'}`}>
                          {encontroSelecionado?.ativo ? 'Ativo' : 'Histórico'}
                        </em>
                      </span>
                    </span>
                    <ChevronDown size={15} className={isEncounterMenuOpen ? 'is-open' : undefined} aria-hidden="true" />
                  </button>
                  {isEncounterMenuOpen && (
                    <div className="topbar-encounter-menu" role="menu" aria-label="Encontros disponíveis">
                      {encontros.map((encontro) => (
                        <button
                          key={encontro.id}
                          type="button"
                          role="menuitem"
                          className={encontro.id === encontroSelecionadoId ? 'is-selected' : undefined}
                          onClick={() => {
                            selecionarEncontro(encontro.id);
                            setIsEncounterMenuOpen(false);
                          }}
                        >
                          <span>{encontro.edicao ? `${encontro.edicao}º EJC` : encontro.nome}</span>
                          <small>{encontro.ativo ? 'Ativo' : 'Histórico'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="header-divider topbar-group-divider" style={{ height: '32px' }} />
          <button
            className="btn-text btn-icon"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            style={{ padding: '0.5rem', borderRadius: '10px' }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="header-divider" style={{ height: '32px' }} />

          <div className="user-menu-container" ref={userMenuRef}>
            <button
              className={`user-menu-trigger ${isUserMenuOpen ? 'active' : ''}`}
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="Abrir opções da conta"
              aria-expanded={isUserMenuOpen}
            >
              <div className="user-avatar-sm">
                {(profile?.nome_completo?.charAt(0) || profile?.email?.charAt(0))?.toUpperCase()}
              </div>
              <span className="user-name-label desktop-only">
                {profile?.nome_completo || profile?.email?.split('@')[0]}
              </span>
              <ChevronDown size={14} className={`user-menu-chevron ${isUserMenuOpen ? 'open' : ''}`} style={{ marginLeft: '0.25rem' }} />
            </button>

            {isUserMenuOpen && (
              <div className="user-dropdown-menu fade-in" style={{ right: 0, minWidth: '200px' }}>
                <div className="user-dropdown-info">
                  <span className="user-email-label">Logado como:</span>
                  <span className="user-email-value">{profile?.nome_completo || profile?.email}</span>
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => navigate('/alterar-senha')}>
                  <Settings size={18} />
                  <span>Alterar Senha</span>
                </button>
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item danger"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSignOutModalOpen(true);
                  }}
                >
                  <LogOut size={18} />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ConfirmDialog
        isOpen={isSignOutModalOpen}
        title="Sair do sistema"
        message="Tem certeza que deseja encerrar sua sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        onConfirm={handleSignOutConfirm}
        onCancel={() => setIsSignOutModalOpen(false)}
        isLoading={isSigningOut}
        isDestructive={true}
      />
    </>
  );
};
