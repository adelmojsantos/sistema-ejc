import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, LogIn, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
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

  const navLinks = [
    { name: 'Início', href: '#' },
    { name: 'Benefícios', href: '#beneficios' },
    { name: 'Como Funciona', href: '#como-funciona' },
    { name: 'Depoimentos', href: '#depoimentos' },
    { name: 'FAQ', href: '#faq' }
  ];

  const handleScrollToTop = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={`landing-header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="container">
        <div className="landing-header__bar">
          <a className="landing-header__brand" href="#" onClick={handleScrollToTop} aria-label="Ir para o topo">
            <span className="landing-header__brand-icon">
              <Heart size={20} fill="currentColor" />
            </span>
            <span className="landing-header__brand-text">
              EJC <strong>Capelinha</strong>
            </span>
          </a>

          <nav className="landing-header__nav" aria-label="Navegação principal">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="landing-header__link">
                {link.name}
              </a>
            ))}
            <Link to="/login" className={`landing-button ${theme === 'dark' ? 'landing-button--dark' : 'landing-button--light'} landing-header__login`}>
              <span>Área Restrita</span>
              <LogIn size={16} />
            </Link>
            <button type="button" className={`landing-theme-toggle ${theme === 'dark' ? 'landing-theme-toggle--dark' : 'landing-theme-toggle--light'}`} onClick={toggleTheme} aria-label="Alternar tema">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </nav>

          <button
            type="button"
            className="landing-header__menu-toggle"
            aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((previous) => !previous)}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="landing-header__mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="landing-header__mobile-panel" onClick={(event) => event.stopPropagation()}>
            <nav className="landing-header__mobile-nav" aria-label="Menu mobile">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="landing-header__mobile-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </a>
              ))}
            </nav>
            <Link
              to="/login"
              className="landing-button landing-button--primary landing-header__mobile-login"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <LogIn size={18} />
              <span>Acessar Sistema</span>
            </Link>
            <button type="button" className="landing-theme-toggle landing-theme-toggle--mobile" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
