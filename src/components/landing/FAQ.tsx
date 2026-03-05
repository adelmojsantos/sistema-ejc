import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: 'O que é o EJC?',
    answer:
      'O EJC (Encontro de Jovens com Cristo) é um movimento católico que visa proporcionar aos jovens um encontro pessoal com Jesus e com a comunidade, através de reflexões, palestras e dinâmicas.'
  },
  {
    question: 'Quem pode participar?',
    answer:
      'Jovens entre 16 e 25 anos (faixa etária padrão, podendo variar conforme a paróquia) que buscam uma experiência de amadurecimento na fé e na vida.'
  },
  {
    question: 'Quanto custa para participar?',
    answer:
      'O valor é simbólico e serve para cobrir as despesas de alimentação e materiais durante o final de semana. Entre em contato para saber o valor exato da próxima edição.'
  },
  {
    question: 'Onde acontece o encontro?',
    answer:
      'Os encontros são realizados em espaços cedidos pela paróquia ou escolas conveniadas em Capelinha. O local exato é informado no momento da confirmação da inscrição.'
  },
  {
    question: 'Preciso ser católico?',
    answer:
      'Embora seja um movimento católico, o EJC é aberto a todos os jovens que buscam uma experiência de Deus e de fraternidade, respeitando a caminhada de cada um.'
  }
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="faq" id="faq">
      <header className="section-heading">
        <p className="faq__tag">
          <HelpCircle size={16} />
          Dúvidas Frequentes
        </p>
        <h2>Perguntas comuns</h2>
      </header>

      <div className="faq__list">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          const panelId = `faq-panel-${index}`;

          return (
            <article key={faq.question} className={`faq__item ${isOpen ? 'is-open' : ''}`}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  <span>{faq.question}</span>
                  <ChevronDown size={18} />
                </button>
              </h3>
              <div id={panelId} className="faq__panel" role="region">
                <p>{faq.answer}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
