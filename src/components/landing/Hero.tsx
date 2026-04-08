import { Send, Sparkles } from 'lucide-react';

export function Hero() {
  return (
    <div className="hero">
      <div className="landing-grid hero__grid">
        <div className="hero__content">
          <p className="hero__badge">
            <span />
            Vagas Abertas para o Próximo Encontro
          </p>

          <h1>
            Uma jornada de <span className="text-gradient">renovação</span> e novas amizades.
            <Sparkles size={22} aria-hidden="true" />
          </h1>

          <p className="hero__description">
            Descubra o Encontro de Jovens com Cristo. Uma experiência única que vai transformar sua perspectiva e
            fortalecer seus laços.
          </p>

          <div className="hero__actions btn-group-responsive">
            <a href="#cadastro" className="landing-button landing-button--primary">
              <span>Quero Participar</span>
              <Send size={18} />
            </a>
            <a href="#como-funciona" className="landing-button landing-button--secondary">
              Saber mais
            </a>
          </div>

          <p className="hero__location">Paróquia Nossa Senhora Aparecida (Capelinha)</p>
        </div>

        <figure className="hero__media">
          <img
            src="/51-tema.png"
            alt="Jovens do EJC"
            className="animate-float"
            width={960}
            height={1200}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          {/* <figcaption>
            <span>
              <Users size={18} />
            </span>
            <div>
              <strong>+500 Jovens</strong>
              <small>Vidas transformadas</small>
            </div>
          </figcaption> */}
        </figure>
      </div>
    </div>
  );
}
