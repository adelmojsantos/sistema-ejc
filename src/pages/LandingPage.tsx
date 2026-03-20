import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Calendar, CheckCircle2, Phone, Send, ShieldCheck, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { FormField } from '../components/ui/FormField';
import { Benefits } from '../components/landing/Benefits';
import { FAQ } from '../components/landing/FAQ';
import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingHeader } from '../components/landing/LandingHeader';
import { SEO } from '../components/landing/SEO';
import { Section } from '../components/landing/Section';
import { SocialProof } from '../components/landing/SocialProof';
import { preCadastroService } from '../services/preCadastroService';
import type { PreCadastroFormData } from '../types/preCadastro';
import './LandingPage.css';

export default function LandingPage() {
  const [form, setForm] = useState<PreCadastroFormData>({
    nome_completo: '',
    email: '',
    telefone: '',
    data_nascimento: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof PreCadastroFormData | 'consent', string>>>({});
  const [scrollProgress, setScrollProgress] = useState(0);
  // LGPD A1 — consentimento explícito obrigatório antes do envio
  const [consent, setConsent] = useState(false);
  // LGPD B3 — cooldown anti-spam: impede reenvios rápidos
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = windowHeight > 0 ? totalScroll / windowHeight : 0;
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange = (field: keyof PreCadastroFormData, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PreCadastroFormData | 'consent', string>> = {};
    if (!form.nome_completo.trim()) newErrors.nome_completo = 'Nome é obrigatório';
    if (!form.telefone.trim()) newErrors.telefone = 'Telefone é obrigatório';
    // LGPD A1 — consentimento explícito
    if (!consent) newErrors.consent = 'Você precisa aceitar a Política de Privacidade para prosseguir.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isCoolingDown = cooldownUntil !== null && Date.now() < cooldownUntil;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCoolingDown) return;
    if (!validate()) return;

    setIsLoading(true);
    try {
      await preCadastroService.join(form);
      setIsSubmitted(true);
      // LGPD B3 — cooldown de 30 s após envio bem-sucedido
      setCooldownUntil(Date.now() + 30_000);
      toast.success('Pré-cadastro realizado com sucesso!');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Erro ao realizar pré-cadastro');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="landing-page" id="top">
      <SEO />
      <div className="landing-progress" style={{ width: `${scrollProgress * 100}%` }} />

      <LandingHeader />

      <main>
        <Section noPadding className="landing-hero-section">
          <Hero />
        </Section>

        <Section id="beneficios" background="secondary">
          <Benefits />
        </Section>

        <Section id="depoimentos">
          <SocialProof />
        </Section>

        <Section background="accent" noPadding className="landing-cta-band">
          <div className="landing-cta-band__content">
            <p className="landing-cta-band__eyebrow">Sua hora chegou</p>
            <h2>Pronto para dar o primeiro passo nessa jornada?</h2>
            <p>
              As vagas são limitadas e o próximo encontro pode mudar a sua vida. Não adie sua renovação.
            </p>
            <a href="#cadastro" className="landing-button landing-button--light">
              Ir para o pré-cadastro
            </a>
          </div>
        </Section>

        <Section id="como-funciona" background="secondary">
          <HowItWorks />
        </Section>

        <Section id="cadastro" background="gradient">
          <div className="landing-grid landing-form-layout">
            <aside className="landing-form-layout__intro">
              <header className="section-heading section-heading--left">
                <h2>Pré-Cadastro</h2>
                <p>
                  Preencha seus dados reais para garantir sua pré-inscrição para o próximo encontro.
                </p>
                <p>
                  Depois vá no dia das inscrições e efetive sua inscrição.
                </p>
              </header>

              <ul className="landing-trust-list" aria-label="Informações de confiança">
                <li>
                  <ShieldCheck size={18} />
                  <span>Seus dados são usados apenas para contato referente ao evento.</span>
                </li>
                <li>
                  <BadgeCheck size={18} />
                  <span>Confirmação e orientações enviadas pela equipe organizadora.</span>
                </li>
              </ul>
            </aside>

            <div className="landing-form-card">
              {isSubmitted ? (
                <div className="landing-success" aria-live="polite">
                  <span className="landing-success__icon">
                    <CheckCircle2 size={36} />
                  </span>
                  <h3>Tudo certo!</h3>
                  <p>
                    Seu pré-cadastro foi realizado com sucesso.
                    <br />
                    Entraremos em contato em breve com todas as instruções.
                  </p>
                  <button type="button" className="landing-button landing-button--secondary" onClick={() => setIsSubmitted(false)}>
                    Fazer outro cadastro
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="landing-form">
                  <FormField
                    label="Nome Completo"
                    name="nome_completo"
                    value={form.nome_completo}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('nome_completo', event.target.value)}
                    error={errors.nome_completo}
                    icon={<User size={18} />}
                    required
                    placeholder="Seu nome completo"
                    className="landing-form__input"
                  />

                  <FormField
                    label="WhatsApp / Telefone"
                    name="telefone"
                    value={form.telefone}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('telefone', event.target.value)}
                    error={errors.telefone}
                    icon={<Phone size={18} />}
                    required
                    placeholder="(33) 99999-9999"
                    className="landing-form__input"
                  />

                  <FormField
                    label="E-mail (Opcional)"
                    name="email"
                    type="email"
                    value={form.email || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('email', event.target.value)}
                    error={errors.email}
                    placeholder="seu@email.com"
                    className="landing-form__input"
                  />

                  <FormField
                    label="Data de Nascimento"
                    name="data_nascimento"
                    type="date"
                    value={form.data_nascimento || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('data_nascimento', event.target.value)}
                    icon={<Calendar size={18} />}
                    className="landing-form__input"
                  />

                  {/* LGPD A1 — Checkbox de consentimento obrigatório */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: '0.4rem',
                    padding: '0.875rem 1rem',
                    background: 'rgba(255,255,255,0.07)',
                    border: `1px solid ${errors.consent ? '#f87171' : 'rgba(255,255,255,0.18)'}`,
                    borderRadius: '8px',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => {
                          setConsent(e.target.checked);
                          if (e.target.checked) setErrors(prev => ({ ...prev, consent: undefined }));
                        }}
                        style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                        required
                        aria-describedby={errors.consent ? 'consent-error' : undefined}
                      />
                      <span>
                        Li e concordo com a{' '}
                        <Link
                          to="/privacidade"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#93c5fd', textDecoration: 'underline', fontWeight: 600 }}
                        >
                          Política de Privacidade
                        </Link>.
                        Meus dados serão usados exclusivamente para contato e organização do evento.
                      </span>
                    </label>
                    {errors.consent && (
                      <span id="consent-error" style={{ color: '#f87171', fontSize: '0.78rem', marginLeft: '1.6rem' }}>
                        {errors.consent}
                      </span>
                    )}
                  </div>

                  <button type="submit" className="landing-button landing-button--primary landing-form__submit" disabled={isLoading || isCoolingDown}>
                    {isLoading ? (
                      <>
                        <span className="landing-spinner" />
                        Enviando dados...
                      </>
                    ) : (
                      <>
                        Realizar pré-cadastro
                        <Send size={18} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </Section>

        <Section id="faq">
          <FAQ />
        </Section>
      </main>

      <LandingFooter />
    </div>
  );
}
