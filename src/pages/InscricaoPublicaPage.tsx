import { Calendar, Check, CheckCircle2, Heart, Loader, MapPin, Send, ShieldCheck, User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLoading } from '../contexts/LoadingContext';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { formatTelefone } from '../utils/cpfUtils';

import { LandingFooter } from '../components/landing/LandingFooter';
import { LandingHeader } from '../components/landing/LandingHeader';
import { SEO } from '../components/landing/SEO';
import { Section } from '../components/landing/Section';
import { FormField } from '../components/ui/FormField';

import { encontroService } from '../services/encontroService';
import { listaEsperaService } from '../services/listaEsperaService';
import type { Encontro } from '../types/encontro';
import { type ListaEsperaFormData, listaEsperaFormDataVazia } from '../types/listaEspera';

import './LandingPage.css';

export default function InscricaoPublicaPage() {
    const { setIsLoading: setGlobalLoading } = useLoading();
    const [form, setForm] = useState<ListaEsperaFormData>(listaEsperaFormDataVazia());

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof ListaEsperaFormData | 'consent', string>>>({});
    const [consent, setConsent] = useState(false);
    const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

    const [encontro, setEncontro] = useState<Encontro | null>(null);
    const [vagasStatus, setVagasStatus] = useState<'open' | 'closed' | 'full'>('open');

    useEffect(() => {
        setGlobalLoading(isLoading);
    }, [isLoading, setGlobalLoading]);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const encontros = await encontroService.listar();
                const active = encontros.find(e => e.ativo);

                if (!active) {
                    setVagasStatus('closed');
                    setIsLoading(false);
                    return;
                }

                setEncontro(active);

                if (!active.limite_vagas_online || active.limite_vagas_online <= 0) {
                    setVagasStatus('closed');
                    setIsLoading(false);
                    return;
                }

                const count = await listaEsperaService.getOnlineRegistrationsCount(active.id);
                if (count >= active.limite_vagas_online) {
                    setVagasStatus('full');
                } else {
                    setVagasStatus('open');
                }
            } catch (err) {
                console.error("Erro ao carregar evento ativ", err);
                setVagasStatus('closed');
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, []);

    const handleChange = (field: keyof ListaEsperaFormData, value: string | boolean) => {
        let val = value;
        if (typeof value === 'string') {
            if (field === 'cep') {
                val = value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2');
            } else if (field === 'telefone' || field === 'telefone_pai' || field === 'telefone_mae') {
                val = formatTelefone(value);
            }
        }
        setForm((prev) => ({ ...prev, [field]: val }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleCepBlur = async () => {
        const cleanCep = form.cep ? String(form.cep).replace(/\D/g, '') : '';
        if (cleanCep.length !== 8) return;

        setIsSearchingCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setForm(prev => ({
                    ...prev,
                    endereco: data.logradouro || prev.endereco,
                    bairro: data.bairro || prev.bairro,
                    cidade: data.localidade || prev.cidade,
                    estado: data.uf || prev.estado
                }));
                setErrors(prev => ({ ...prev, endereco: undefined, bairro: undefined, cidade: undefined, estado: undefined }));
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setIsSearchingCep(false);
        }
    };

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof ListaEsperaFormData | 'consent', string>> = {};

        if (!form.nome_completo.trim()) newErrors.nome_completo = 'Obrigatório';
        if (!form.telefone.trim()) newErrors.telefone = 'Obrigatório';
        if (!form.email?.trim()) newErrors.email = 'E-mail é obrigatório para evitar duplicidade';
        if (!form.data_nascimento?.trim()) newErrors.data_nascimento = 'Obrigatório';
        if (!form.endereco?.trim()) newErrors.endereco = 'Obrigatório';
        if (!form.bairro?.trim()) newErrors.bairro = 'Obrigatório';
        if (!form.cidade?.trim()) newErrors.cidade = 'Obrigatório';
        if (!form.estado?.trim()) newErrors.estado = 'Obrigatório';
        if (form.fez_ejc_outra_paroquia === null) newErrors.fez_ejc_outra_paroquia = 'Selecione uma opção';
        if (form.fez_ejc_outra_paroquia && !form.qual_paroquia_ejc?.trim()) {
            newErrors.qual_paroquia_ejc = 'Informe qual foi a paróquia / cidade';
        }

        if (!consent) newErrors.consent = 'Você precisa aceitar a Política de Privacidade para prosseguir.';

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            toast.error('Preencha todos os campos obrigatórios corretamente.');
        }

        return Object.keys(newErrors).length === 0;
    };

    const isCoolingDown = cooldownUntil !== null && Date.now() < cooldownUntil;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (isCoolingDown) return;
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await listaEsperaService.join(form);
            setIsSubmitted(true);
            setCooldownUntil(Date.now() + 30_000);
            toast.success('Inscrição realizada com sucesso!');
        } catch (error) {
            const err = error as Error;
            toast.error(err.message || 'Erro ao realizar inscrição. As vagas podem ter esgotado.');
            // Revalidate count on error quietly
            if (encontro) {
                const count = await listaEsperaService.getOnlineRegistrationsCount(encontro.id);
                if (encontro.limite_vagas_online && count >= encontro.limite_vagas_online) {
                    setVagasStatus('full');
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return null;
    }

    return (
        <div className="landing-page" id="top">
            <SEO />
            <LandingHeader minimal />

            <main>
                <Section noPadding className="landing-hero-section" style={{ minHeight: 'auto', paddingBottom: '4rem' }}>
                    <div className="landing-container" style={{ paddingTop: '8rem', textAlign: 'center' }}>
                        {encontro && <p className="landing-hero__eyebrow" style={{ justifyContent: 'center', fontSize: '1.5rem', fontWeight: 600, opacity: 0.9 }}>{encontro.nome}</p>}
                        <h1 className="landing-hero__title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginTop: '0.5rem' }}>
                            {vagasStatus === 'open' ? (
                                <>Inscrições Abertas <br /><span className="text-gradient">Garanta sua Vaga</span></>
                            ) : vagasStatus === 'full' ? (
                                <>Vagas Esgotadas <br /><span className="text-gradient" style={{ filter: 'grayscale(1)' }}>Fila de Espera Cheia</span></>
                            ) : (
                                <>Inscrições Encerradas <br /><span className="text-gradient" style={{ filter: 'grayscale(1)' }}>Aguarde Próxima Edição</span></>
                            )}
                        </h1>
                    </div>
                </Section>

                <Section id="cadastro" background="gradient">
                    <div className="landing-grid landing-form-layout" style={{ maxWidth: '1150px', margin: '0 auto', gap: 'clamp(1.5rem, 4vw, 3rem)' }}>

                        <aside className="landing-form-layout__intro" style={{ alignSelf: 'flex-start', position: 'sticky', top: '100px' }}>
                            <header className="section-heading section-heading--left">
                                <h2>Ficha Cadastral</h2>
                                <p>
                                    Preencha todos os seus dados requisitados abaixo com atenção.
                                </p>
                            </header>

                            <ul className="landing-trust-list" aria-label="Informações de confiança">
                                <li>
                                    <ShieldCheck size={24} className="text-gradient" />
                                    <span>Seus dados são confidenciais e protegidos pela equipe do EJC.</span>
                                </li>
                                {vagasStatus === 'open' && (
                                    <li>
                                        <CheckCircle2 size={24} className="text-gradient" />
                                        <span>Últimas vagas disponíveis para o próximo encontro!</span>
                                    </li>
                                )}
                            </ul>
                        </aside>

                        <div className="landing-form-card">
                            {vagasStatus === 'closed' ? (
                                <div className="landing-success" style={{ padding: '3rem 2rem' }}>
                                    <span className="landing-success__icon" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}>
                                        <Calendar size={36} />
                                    </span>
                                    <h3>Inscrições Indisponíveis</h3>
                                    <p>
                                        As inscrições online para o próximo encontro ainda não foram abertas ou já foram finalizadas.
                                        Fique atento às nossas redes sociais para mais avisos.
                                    </p>
                                    <Link to="/" className="landing-button landing-button--secondary" style={{ marginTop: '1.5rem' }}>
                                        Voltar à Página Inicial
                                    </Link>
                                </div>
                            ) : vagasStatus === 'full' ? (
                                <div className="landing-success" style={{ padding: '3rem 2rem' }}>
                                    <span className="landing-success__icon">
                                        <Users size={36} />
                                    </span>
                                    <h3>Vagas Esgotadas!</h3>
                                    <p>
                                        Infelizmente todas as vagas online para este evento já foram preenchidas.
                                    </p>
                                    <Link to="/" className="landing-button landing-button--secondary" style={{ marginTop: '1.5rem' }}>
                                        Voltar à Página Inicial
                                    </Link>
                                </div>
                            ) : isSubmitted ? (
                                <div className="landing-success" aria-live="polite">
                                    <span className="landing-success__icon">
                                        <CheckCircle2 size={36} />
                                    </span>
                                    <h3>Tudo certo!</h3>
                                    <p>
                                        Parabéns! Sua vaga na lista principal já está garantida.
                                        <br />
                                        Nossa equipe entrará em contato em breve para oficilizar tudo. <br /> Aguarde!
                                    </p>
                                    <Link to="/" className="landing-button landing-button--secondary" style={{ marginTop: '1.5rem' }}>
                                        Voltar à Página Inicial
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="landing-form">
                                    <h4 style={{ color: 'var(--text-color)', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                        <User size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                        Dados Pessoais
                                    </h4>

                                    <FormField
                                        label="Nome Completo *"
                                        name="nome_completo"
                                        value={form.nome_completo}
                                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('nome_completo', event.target.value)}
                                        error={errors.nome_completo}
                                        required
                                        placeholder="Seu nome completo"
                                        className="landing-form__input"
                                    />

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1rem' }}>
                                        <FormField
                                            label="CPF (Opcional)"
                                            name="cpf"
                                            value={form.cpf || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('cpf', event.target.value)}
                                            error={errors.cpf}
                                            placeholder="xxx.xxx.xxx-xx"
                                            className="landing-form__input"
                                        />
                                        <FormField
                                            label="Nascimento *"
                                            name="data_nascimento"
                                            type="date"
                                            value={form.data_nascimento || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('data_nascimento', event.target.value)}
                                            error={errors.data_nascimento}
                                            required
                                            className="landing-form__input"
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1rem' }}>
                                        <FormField
                                            label="WhatsApp / Telefone *"
                                            name="telefone"
                                            value={form.telefone}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('telefone', event.target.value)}
                                            error={errors.telefone}
                                            required
                                            placeholder="(33) 99999-9999"
                                            className="landing-form__input"
                                        />
                                        <FormField
                                            label="E-mail *"
                                            name="email"
                                            type="email"
                                            value={form.email || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('email', event.target.value)}
                                            error={errors.email}
                                            required
                                            placeholder="seu@email.com"
                                            className="landing-form__input"
                                        />
                                    </div>

                                    <h4 style={{ color: 'var(--text-color)', margin: '2rem 0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                        <MapPin size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                        Endereço
                                    </h4>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div style={{ flex: '1 1 120px' }}>
                                            <FormField
                                                label="CEP"
                                                name="cep"
                                                value={form.cep || ''}
                                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('cep', event.target.value)}
                                                onBlur={handleCepBlur}
                                                className="landing-form__input"
                                                placeholder="00000-000"
                                                icon={isSearchingCep ? <Loader size={18} className="animate-spin" /> : <MapPin size={18} />}
                                            />
                                        </div>
                                        <div style={{ flex: '3 1 200px' }}>
                                            <FormField
                                                label="Endereço (Rua/Avenida) *"
                                                name="endereco"
                                                value={form.endereco || ''}
                                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('endereco', event.target.value)}
                                                error={errors.endereco}
                                                required
                                                placeholder="Sua rua"
                                                className="landing-form__input"
                                            />
                                        </div>
                                        <div style={{ flex: '1 1 80px' }}>
                                            <FormField
                                                label="Nº"
                                                name="numero"
                                                value={form.numero || ''}
                                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('numero', event.target.value)}
                                                className="landing-form__input"
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1rem' }}>
                                        <FormField
                                            label="Bairro *"
                                            name="bairro"
                                            value={form.bairro || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('bairro', event.target.value)}
                                            error={errors.bairro}
                                            required
                                            className="landing-form__input"
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)', gap: '1rem' }}>
                                            <FormField
                                                label="Cidade *"
                                                name="cidade"
                                                value={form.cidade || ''}
                                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('cidade', event.target.value)}
                                                error={errors.cidade}
                                                required
                                                className="landing-form__input"
                                            />
                                            <FormField
                                                label="Estado *"
                                                name="estado"
                                                value={form.estado || ''}
                                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('estado', event.target.value)}
                                                error={errors.estado}
                                                required
                                                placeholder="SP"
                                                maxLength={2}
                                                style={{ textTransform: 'uppercase' }}
                                                className="landing-form__input"
                                            />
                                        </div>
                                    </div>

                                    <h4 style={{ color: 'var(--text-color)', margin: '2rem 0 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                        <Heart size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                                        Família & Religião
                                    </h4>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1rem' }}>
                                        <FormField
                                            label="Nome do Pai"
                                            name="nome_pai"
                                            value={form.nome_pai || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('nome_pai', event.target.value)}
                                            className="landing-form__input"
                                        />
                                        <FormField
                                            label="Telefone do Pai"
                                            name="telefone_pai"
                                            value={form.telefone_pai || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('telefone_pai', event.target.value)}
                                            className="landing-form__input"
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1rem' }}>
                                        <FormField
                                            label="Nome da Mãe"
                                            name="nome_mae"
                                            value={form.nome_mae || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('nome_mae', event.target.value)}
                                            className="landing-form__input"
                                        />
                                        <FormField
                                            label="Telefone da Mãe"
                                            name="telefone_mae"
                                            value={form.telefone_mae || ''}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('telefone_mae', event.target.value)}
                                            className="landing-form__input"
                                        />
                                    </div>

                                    <FormField
                                        label="Comunidade Católica que participa"
                                        name="comunidade"
                                        value={form.comunidade || ''}
                                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleChange('comunidade', event.target.value)}
                                        placeholder="Ex: Matriz, Capela São José..."
                                        className="landing-form__input"
                                    />

                                    {/* Pergunta de EJC */}
                                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <label style={{ color: 'var(--text-color)', fontWeight: 600, fontSize: '0.95rem' }}>Já fez EJC em outra paróquia? *</label>
                                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: '8px', border: form.fez_ejc_outra_paroquia === false ? '1px solid var(--primary-color)' : '1px solid var(--landing-surface-soft)', transition: 'all 0.2s ease' }}>
                                                <input
                                                    type="radio"
                                                    name="fez_ejc"
                                                    onChange={() => handleChange('fez_ejc_outra_paroquia', false)}
                                                    checked={form.fez_ejc_outra_paroquia === false}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                                                />
                                                <span>Não fiz EJC</span>
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1rem', borderRadius: '8px', border: form.fez_ejc_outra_paroquia === true ? '1px solid var(--primary-color)' : '1px solid var(--landing-surface-soft)', transition: 'all 0.2s ease' }}>
                                                <input
                                                    type="radio"
                                                    name="fez_ejc"
                                                    onChange={() => handleChange('fez_ejc_outra_paroquia', true)}
                                                    checked={form.fez_ejc_outra_paroquia === true}
                                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                                                />
                                                <span>Sim, já fiz EJC</span>
                                            </label>
                                        </div>
                                        {errors.fez_ejc_outra_paroquia && <span style={{ color: '#f87171', fontSize: '0.8rem' }}>{errors.fez_ejc_outra_paroquia}</span>}

                                        {form.fez_ejc_outra_paroquia === true && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <FormField
                                                    label="Em qual paróquia/cidade?"
                                                    name="qual_paroquia_ejc"
                                                    value={form.qual_paroquia_ejc || ''}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('qual_paroquia_ejc', e.target.value)}
                                                    error={errors.qual_paroquia_ejc}
                                                    required
                                                    className="landing-form__input"
                                                    placeholder="Ex: Paróquia São Geraldo - Ipatinga"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Consentimento LGPD */}
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', gap: '0.4rem',
                                        padding: '0.875rem 1rem', marginTop: '0.5rem',
                                        background: 'rgba(255,255,255,0.07)',
                                        border: `1px solid ${errors.consent ? '#f87171' : 'rgba(131, 16, 16, 0.18)'}`,
                                        borderRadius: '8px',
                                    }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                            <div style={{
                                                width: '20px', height: '20px', flexShrink: 0,
                                                borderRadius: '4px', border: `2px solid ${consent ? 'var(--primary-color)' : 'rgba(161, 145, 145, 0.3)'}`,
                                                background: consent ? 'var(--primary-color)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}>
                                                {consent && <Check size={14} color="white" strokeWidth={3} />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={consent}
                                                onChange={(e) => {
                                                    setConsent(e.target.checked);
                                                    if (e.target.checked) setErrors(prev => ({ ...prev, consent: undefined }));
                                                }}
                                                style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
                                            />
                                            <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                                                Li e concordo com a{' '}
                                                <Link to="/privacidade" target="_blank" style={{ color: '#93c5fd', textDecoration: 'underline' }}>
                                                    Política de Privacidade
                                                </Link>.
                                                Meus dados serão salvos para o Encontro.
                                            </span>
                                        </label>
                                        {errors.consent && (
                                            <span style={{ color: '#f87171', fontSize: '0.78rem', marginLeft: '1.6rem' }}>
                                                {errors.consent}
                                            </span>
                                        )}
                                    </div>

                                    <button type="submit" className="landing-button landing-button--primary landing-form__submit" disabled={isSubmitting || isCoolingDown} style={{ marginTop: '2rem' }}>
                                        {isSubmitting ? (
                                            <>
                                                <span className="landing-spinner" />
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                Finalizar Inscrição
                                                <Send size={18} />
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </Section>

            </main>

            <LandingFooter />
        </div>
    );
}
