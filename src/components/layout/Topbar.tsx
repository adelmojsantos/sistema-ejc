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
import { ConfirmDialog } from '../ConfirmDialog';

interface TopbarProps {
  onMenuClick: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
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

  // Simple breadcrumb/title logic based on path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path.startsWith('/admin/usuarios')) return 'Gerenciar Usuários';
    if (path.startsWith('/admin/acessos')) return 'Controle de Acessos';
    if (path.startsWith('/admin/importar')) return 'Importar Dados';
    if (path.startsWith('/admin/configuracoes-exportacao')) return 'Configurações de Exportação';
    if (path.startsWith('/secretaria/participantes')) return 'Participantes';
    if (path.startsWith('/secretaria/encontreiros')) return 'Encontreiros';
    if (path.startsWith('/secretaria/lista-espera')) return 'Lista de Espera';
    if (path.startsWith('/secretaria/confirmacoes')) return 'Relatório de Confirmações';
    if (path.startsWith('/secretaria')) return 'Secretaria';
    if (path.startsWith('/visitacao')) return 'Visitação';
    if (path.startsWith('/cadastros/pessoas')) return 'Pessoas';
    if (path.startsWith('/cadastros/encontros')) return 'Encontros';
    if (path.startsWith('/cadastros/equipes')) return 'Equipes';
    if (path.startsWith('/cadastros/circulos')) return 'Círculos';
    if (path.startsWith('/cadastros')) return 'Cadastros';
    if (path.startsWith('/inscricao')) return 'Inscrições';
    if (path.startsWith('/coordenador/minha-equipe')) return 'Minha Equipe';
    return 'EJC Capelinha';
  };

  return (
    <>
      <header className="topbar">
        <div className="flex items-center gap-4">
          <button 
            className="mobile-menu-btn" 
            onClick={onMenuClick}
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
            style={{ padding: '0.5rem', borderRadius: '10px' }}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="header-divider" style={{ height: '32px' }} />

          <div className="user-menu-container" ref={userMenuRef}>
            <button 
              className={`user-menu-trigger ${isUserMenuOpen ? 'active' : ''}`}
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
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
