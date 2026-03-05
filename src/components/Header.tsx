import { Cloud, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmDialog } from './ConfirmDialog';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
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
    { to: '/dashboard', label: 'Inicio' },
    { to: '/inscricao', label: 'Inscricao' },
    { to: '/secretaria', label: 'Secretaria' },
    { to: '/cadastros/montagem-visitacao', label: 'Visitacao' },
    { to: '/cadastros/montagem-circulos', label: 'Circulos' },
    { to: '/cadastros', label: 'Cadastros' },
    ...(profile?.role === 'admin' ? [{ to: '/admin/usuarios', label: 'Usuarios' }] : [])
  ];

  return (
    <header className={`header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-bar">
        <Link to="/dashboard" className="header-brand">
          <span className="header-brand-icon">
            <Cloud size={20} fill="currentColor" />
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

          <button
            onClick={toggleTheme}
            className="mobile-menu-btn"
            aria-label="Alternar tema"
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={() => setIsSignOutModalOpen(true)}
            className="mobile-menu-btn header-logout-btn"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </nav>

        <div className="mobile-controls-container">
          <button
            onClick={toggleTheme}
            className="mobile-menu-btn"
            aria-label="Alternar tema"
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="mobile-menu-btn"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav className="mobile-nav">
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


