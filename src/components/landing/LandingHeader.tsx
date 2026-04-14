import { LogIn, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

interface LandingHeaderProps {
  minimal?: boolean;
}

export function LandingHeader({ minimal = false }: LandingHeaderProps) {
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

  const fullNavLinks = [
    { name: 'Início', href: '#' },
    { name: 'Benefícios', href: '#beneficios' },
    { name: 'Como Funciona', href: '#como-funciona' },
    { name: 'Depoimentos', href: '#depoimentos' },
    { name: 'FAQ', href: '#faq' },
    { name: 'Inscrição Online', href: '/inscricao-online' }
  ];

  const minimalNavLinks = [
    { name: 'Início', href: '/' }
  ];

  const navLinks = minimal ? minimalNavLinks : fullNavLinks;

  const handleScrollToTop = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={`landing-header ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="container">
        <div className="landing-header__bar">
          {minimal ? (
            <Link className="landing-header__brand" to="/" aria-label="Ir para a página inicial">
              <span className="landing-header__brand-icon has-image">
                <img src="/logo.png" alt="Logo" />
              </span>
              <span className="landing-header__brand-text">
                EJC <strong>Capelinha</strong>
              </span>
            </Link>
          ) : (
            <a className="landing-header__brand" href="#" onClick={handleScrollToTop} aria-label="Ir para o topo">
              <span className="landing-header__brand-icon has-image">
                <img src="/logo.png" alt="Logo" />
              </span>
              <span className="landing-header__brand-text">
                EJC <strong>Capelinha</strong>
              </span>
            </a>
          )}

          <nav className="landing-header__nav" aria-label="Navegação principal">
            {navLinks.map((link) => (
              link.href.startsWith('#') ? (
                <a key={link.name} href={link.href} className="landing-header__link">
                  {link.name}
                </a>
              ) : (
                <Link key={link.name} to={link.href} className="landing-header__link">
                  {link.name}
                </Link>
              )
            ))}
            {!minimal && (
              <Link to="/login" className={`landing-button ${theme === 'dark' ? 'landing-button--dark' : 'landing-button--light'} landing-header__login`}>
                <span>Área Restrita</span>
                <LogIn size={20} />
              </Link>
            )}
            <button type="button" className={`landing-theme-toggle ${theme === 'dark' ? 'landing-theme-toggle--dark' : 'landing-theme-toggle--light'}`} onClick={toggleTheme} aria-label="Alternar tema">
              {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </nav>

          <button type="button" className="landing-theme-toggle hide-desktop" onClick={toggleTheme} aria-label="Alternar tema" style={{ marginRight: '0.5rem' }}>
            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
          </button>
          <button
            type="button"
            className="landing-header__menu-toggle"
            aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((previous) => !previous)}
          >
            {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="landing-header__mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="landing-header__mobile-panel" onClick={(event) => event.stopPropagation()}>
            <nav className="landing-header__mobile-nav" aria-label="Menu mobile">
              {navLinks.map((link) => (
                link.href.startsWith('#') ? (
                  <a
                    key={link.name}
                    href={link.href}
                    className="landing-header__mobile-link"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="landing-header__mobile-link"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                )
              ))}
            </nav>
            {!minimal && (
              <Link
                to="/login"
                className="landing-button landing-button--primary landing-header__mobile-login"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <LogIn size={24} />
                <span>Acessar Sistema</span>
              </Link>
            )}
            <button type="button" className="landing-theme-toggle landing-theme-toggle--mobile" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
              <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
