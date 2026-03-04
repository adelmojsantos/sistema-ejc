import { Anchor, Heart, MessageCircle, Shield, Sparkles, Users } from 'lucide-react';

const benefits = [
  {
    icon: Heart,
    title: 'Encontro com Deus',
    description: 'Momentos profundos de espiritualidade e reflexão para fortalecer sua fé.'
  },
  {
    icon: Users,
    title: 'Novas Amizades',
    description: 'Construa laços verdadeiros com jovens que compartilham dos mesmos valores.'
  },
  {
    icon: Sparkles,
    title: 'Renovação',
    description: 'Uma oportunidade para recomeçar e ver a vida com novos olhos e esperança.'
  },
  {
    icon: MessageCircle,
    title: 'Apoio e Diálogo',
    description: 'Espaço seguro para compartilhar experiências e crescer em comunidade.'
  },
  {
    icon: Shield,
    title: 'Tradição EJC',
    description: 'Faça parte de um movimento com décadas de história transformando vidas.'
  },
  {
    icon: Anchor,
    title: 'Compromisso',
    description: 'Desenvolva sua liderança e compromisso com o próximo e a igreja.'
  }
];

export function Benefits() {
  return (
    <div className="benefits" id="beneficios">
      <header className="section-heading">
        <h2>
          Por que participar do <span className="text-gradient">EJC Capelinha</span>?
        </h2>
        <p>
          O encontro é muito mais do que um final de semana. É o início de uma nova jornada recheada de benefícios
          para sua vida pessoal e espiritual.
        </p>
      </header>

      <div className="landing-grid benefits__grid">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <article key={benefit.title} className="benefits__card">
              <span className="benefits__icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
