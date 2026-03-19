import { Car, Check, ClipboardList, PartyPopper } from 'lucide-react';

const steps = [
  {
    icon: ClipboardList,
    title: 'Pré-cadastro',
    description: 'Preencha o formulário nesta página informando seu interesse em participar do próximo encontro.'
  },
  {
    icon: Check,
    title: 'Inscrição',
    description: 'Vá na data de inscrição e efetive sua inscrição.'
  },
  {
    icon: Car,
    title: 'Preparação',
    description: 'Aguarde o contato EJC para receber as orientações sobre o encontro.'
  },
  {
    icon: PartyPopper,
    title: 'O Encontro',
    description: 'Viva três dias intensos de alegria, reflexão e experiências que ficarão guardadas para sempre.'
  }
];

export function HowItWorks() {
  return (
    <div className="how-it-works" id="como-funciona">
      <header className="section-heading">
        <h2>O percurso até o encontro</h2>
        <p>Simples, direto e preparado com todo carinho para você.</p>
      </header>

      <div className="landing-grid how-it-works__grid">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <article key={step.title} className="how-it-works__card">
              <div className="how-it-works__icon">
                <Icon size={24} />
                <span>{index + 1}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
