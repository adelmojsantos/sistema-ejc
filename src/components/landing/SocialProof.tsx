import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    text: 'O EJC foi um divisor de águas na minha vida. Conheci pessoas incríveis e hoje vejo a fé de uma maneira muito mais viva.',
    author: 'João Silva',
    role: 'Participante 2023'
  },
  {
    text: 'Uma experiência que todo jovem deveria viver. A alegria e o acolhimento que recebemos lá dentro não tem explicação.',
    author: 'Maria Oliveira',
    role: 'Participante 2022'
  },
  {
    text: 'Aprendi muito sobre mim e sobre o próximo. Voltei do encontro com as energias renovadas e um propósito maior.',
    author: 'Douglas Santos',
    role: 'Participante 2023'
  }
];

const stats = [
  { value: '+10', label: 'Anos de História' },
  { value: '30+', label: 'Edições' },
  { value: '800+', label: 'Jovens' },
  { value: '100%', label: 'Fé e Alegria' }
];

export function SocialProof() {
  return (
    <div className="social-proof" id="depoimentos">
      <div className="landing-grid social-proof__layout">
        <div className="social-proof__intro">
          <header className="section-heading section-heading--left">
            <h2>
              Impactando corações e transformando <span className="text-gradient">realidades</span>
            </h2>
            <p>
              O EJC Capelinha tem uma longa história de evangelização e acolhimento. Veja os números que refletem nossa
              missão.
            </p>
          </header>

          <ul className="social-proof__stats" aria-label="Indicadores do EJC">
            {stats.map((stat) => (
              <li key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="social-proof__testimonials">
          {testimonials.map((item) => (
            <article key={item.author} className="social-proof__card">
              <div className="social-proof__rating" aria-label="Avaliação máxima">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} size={16} fill="currentColor" />
                ))}
              </div>

              <p>
                <Quote size={22} aria-hidden="true" />
                {item.text}
              </p>

              <footer>
                <span>{item.author.charAt(0)}</span>
                <div>
                  <strong>{item.author}</strong>
                  <small>{item.role}</small>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
