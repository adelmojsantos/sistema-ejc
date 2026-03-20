import { ArrowUp, Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

export function LandingFooter() {
  const { theme } = useTheme();
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="landing-footer">
      <div className="container">
        <div className="landing-footer__grid">
          <section className="landing-footer__brand" aria-labelledby="footer-brand">
            <h3 id="footer-brand" className="landing-footer__title landing-footer__brand-title">
              <span className="landing-footer__brand-icon has-image">
                <img src="/logo.png" alt="Logo" />
              </span>
              EJC Capelinha
            </h3>
            <p className="landing-footer__text">
              O Encontro de Jovens com Cristo busca semear o amor de Deus no coração da juventude, proporcionando uma
              experiência de fé, fraternidade e renovação espiritual.
            </p>
            <div className="landing-footer__socials" aria-label="Redes sociais">
              <a href="#" aria-label="Instagram" className="landing-footer__social-link">
                <Instagram size={18} />
              </a>
              <a href="#" aria-label="Facebook" className="landing-footer__social-link">
                <Facebook size={18} />
              </a>
              <a href="mailto:contato@ejccapelinha.com.br" aria-label="E-mail" className="landing-footer__social-link">
                <Mail size={18} />
              </a>
            </div>
          </section>

          <section className="landing-footer__column" aria-labelledby="footer-nav">
            <h4 id="footer-nav" className="landing-footer__title">
              Navegação
            </h4>
            <nav className="landing-footer__links">
              <a href="#">Início</a>
              <a href="#beneficios">Benefícios</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#depoimentos">Depoimentos</a>
              <a href="#faq">Dúvidas Frequentes</a>
              <a href="#cadastro">Pré-cadastro</a>
            </nav>
          </section>

          <section className="landing-footer__column" aria-labelledby="footer-contact">
            <h4 id="footer-contact" className="landing-footer__title">
              Contato
            </h4>
            <ul className="landing-footer__contact-list">
              <li>
                <MapPin size={16} />
                <span>
                  Franca - SP
                  <br />
                  Paróquia Nossa Senhora Aparecida (Capelinha)
                </span>
              </li>
              <li>
                <Phone size={16} />
                <span>(33) 99999-9999</span>
              </li>
              <li>
                <Mail size={16} />
                <span>contato@ejccapelinha.com.br</span>
              </li>
            </ul>
          </section>
        </div>

        <div className="landing-footer__bottom">
          <p>© {new Date().getFullYear()} EJC Capelinha. Desenvolvido com carinho para a juventude.</p>
          <div className="landing-footer__legal">
            <Link to="/privacidade">Privacidade</Link>
            <a href="mailto:contato@ejccapelinha.com.br">Contato</a>
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Voltar para o topo"
              className={`landing-theme-toggle ${theme === 'dark' ? 'landing-theme-toggle--dark' : 'landing-theme-toggle--light'}`}
            >
              <ArrowUp size={16} color={theme === 'dark' ? 'white' : 'black'} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
