import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmDialog } from './ConfirmDialog';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();

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

  const navLinks = [
    { to: '/dashboard', label: 'Início' },
    { to: '/inscricao', label: 'Inscrição', featured: true },
    { to: '/secretaria', label: 'Secretaria' },
    { to: '/cadastros/montagem-visitacao', label: 'Visitação' },
    { to: '/cadastros/montagem-circulos', label: 'Círculos' },
    { to: '/cadastros', label: 'Cadastros' }
  ];

  return (
    <header className="header">
      <div className="container header-bar">
        <Link to="/dashboard" className="header-brand">
          <span>EJC - Capelinha</span>
        </Link>

        <nav className="nav-links">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`nav-link ${link.featured ? 'is-featured' : ''}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

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
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
          <button onClick={() => setIsMobileMenuOpen((prev) => !prev)} className="mobile-menu-btn" aria-label="Menu">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav className="mobile-nav mobile-controls-container">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className={`nav-link ${link.featured ? 'is-featured' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
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
