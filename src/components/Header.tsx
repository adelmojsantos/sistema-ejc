import { ChevronDown, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { ConfirmDialog } from './ConfirmDialog';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { signOut, profile, userParticipacao, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const headerRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setIsScrolled(scrollPos > 2);
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Failed to sign out', error);
    } finally {
      setIsSigningOut(false);
      setIsSignOutModalOpen(false);
    }
  };

  const navLinks = [
    { to: '/dashboard', label: 'Início' },
  ];

  if (hasPermission('modulo_secretaria') || hasPermission('modulo_admin')) {
    navLinks.push(
      { to: '/inscricao', label: 'Inscrições' },
      { to: '/secretaria', label: 'Secretaria' },
      { to: '/cadastros', label: 'Cadastros' },
    );
  }

  if (hasPermission('modulo_admin')) {
    navLinks.push({ to: '/admin/usuarios', label: 'Usuários' });
  }

  if (hasPermission('modulo_coordenador') || userParticipacao?.coordenador) {
    if (!navLinks.some(link => link.to === '/coordenador/minha-equipe')) {
      navLinks.push({ to: '/coordenador/minha-equipe', label: 'Minha Equipe' });
    }
  }

  const hasVisitacaoAccess = hasPermission('modulo_visitacao_coordenar') || hasPermission('modulo_visitacao_duplas') || hasPermission('modulo_admin');
  if (hasVisitacaoAccess) {
    navLinks.push({ to: '/visitacao', label: 'Visitação' });
  }

  if (hasPermission('modulo_inscricao') && !hasPermission('modulo_secretaria') && !hasPermission('modulo_admin')) {
    if (!navLinks.some(link => link.to === '/inscricao')) {
      navLinks.push({ to: '/inscricao', label: 'Inscrições' });
    }
  }

  return (
    <header ref={headerRef} className={`header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-bar">
        <Link to="/dashboard" className="header-brand">
          <span className="header-brand-icon has-image">
            <img src="/logo.png" alt="Logo" />
          </span>
          <span className="header-brand-text">
            EJC <strong>Capelinha</strong>
          </span>
        </Link>

        <nav className="nav-links">
          {navLinks.map((link) => {
            const isActive =
              location.pathname === link.to ||
              (link.to !== '/dashboard' && location.pathname.startsWith(link.to + '/'));

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="header-divider" />

          <div className="user-menu-container" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`user-menu-trigger ${isUserMenuOpen ? 'active' : ''}`}
            >
              <div className="user-avatar-sm">
                {profile?.email?.charAt(0).toUpperCase()}
              </div>
              <ChevronDown
                size={16}
                className={`user-menu-chevron ${isUserMenuOpen ? 'open' : ''}`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="user-dropdown-menu fade-in">
                <div className="user-dropdown-info">
                  <span className="user-email-label">Logado como:</span>
                  <span className="user-email-value">{profile?.email}</span>
                </div>
                <div className="dropdown-item-header">
                  <div className="dropdown-item-label">
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    <span>{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
                  </div>
                  <label className="theme-toggle">
                    <input
                      type="checkbox"
                      checked={theme === 'dark'}
                      onChange={toggleTheme}
                    />
                    <span className="theme-toggle-slider"></span>
                  </label>
                </div>
                <div className="dropdown-divider" />
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSignOutModalOpen(true);
                  }}
                  className="dropdown-item danger"
                >
                  <LogOut size={18} />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        <div className="mobile-controls-container">
          <button
            onClick={toggleTheme}
            className="mobile-menu-btn"
            aria-label="Alternar Tema"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="mobile-menu-btn"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav className="mobile-nav">
          <div className="mobile-user-profile">
            <div className="user-avatar">
              {profile?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-email">{profile?.email}</span>
              <span className="user-role">{profile?.grupos?.join(', ')}</span>
            </div>
          </div>
          <button onClick={toggleTheme} className="nav-link">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
          </button>
          <div className="mobile-nav-divider" />
          {navLinks.map((link) => {
            const isActive =
              location.pathname === link.to ||
              (link.to !== '/dashboard' && location.pathname.startsWith(link.to + '/'));

            return (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mobile-nav-divider" />
          <button onClick={() => setIsSignOutModalOpen(true)} className="nav-link nav-link-danger">
            <LogOut size={20} /> Sair
          </button>
        </nav>
      )}

      <ConfirmDialog
        isOpen={isSignOutModalOpen}
        title="Sair do sistema"
        message="Tem certeza que quer desconectar sua conta?"
        confirmText="Sair"
        cancelText="Cancelar"
        onConfirm={handleSignOutConfirm}
        onCancel={() => setIsSignOutModalOpen(false)}
        isLoading={isSigningOut}
        isDestructive={true}
      />
    </header>
  );
}
