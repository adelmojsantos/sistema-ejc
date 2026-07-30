import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Sun, 
  Moon, 
  LogOut, 
  ChevronDown,
  Settings
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationTitle } from '../../config/navigation';
import { ConfirmDialog } from '../ConfirmDialog';

interface TopbarProps {
  onMenuClick: () => void;
  mobileMenuOpen: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, mobileMenuOpen }) => {
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
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

  return (
    <>
      <header className="topbar">
        <div className="flex items-center gap-4">
          <button 
            className="mobile-menu-btn" 
            onClick={onMenuClick}
            aria-label={mobileMenuOpen ? 'Fechar menu principal' : 'Abrir menu principal'}
            aria-expanded={mobileMenuOpen}
            aria-controls="sidebar-navigation"
          >
            <Menu size={24} />
          </button>
          <h1 className="page-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {getPageTitle()}
          </h1>
        </div>

        <div className="flex items-center gap-3">
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
