import { Calendar, Check, Copy, Info, LinkIcon, Loader, Tag, X } from 'lucide-react';
import React, { useState } from 'react';
import type { Encontro, EncontroFormData } from '../../types/encontro';
import { FormField } from '../ui/FormField';
import { CurrencyFormField } from '../ui/CurrencyFormField';
import { FormRow } from '../ui/FormRow';
import { FormSection } from '../ui/FormSection';
import toast from 'react-hot-toast';

interface EncontroFormProps {
    title: string;
    initialData?: Encontro;
    onSubmit: (data: EncontroFormData) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

type FormErrors = Partial<Record<keyof EncontroFormData, string>>;

function validate(data: EncontroFormData): FormErrors {
    const errors: FormErrors = {};
    if (!data.nome?.trim()) errors.nome = 'Nome é obrigatório.';
    if (!data.data_inicio) errors.data_inicio = 'Data de início é obrigatória.';
    if (!data.data_fim) errors.data_fim = 'Data de fim é obrigatória.';
    return errors;
}

export function EncontroForm({ title, initialData, onSubmit, onCancel, isLoading = false }: EncontroFormProps) {
    const [form, setForm] = useState<EncontroFormData>({
        nome: initialData?.nome ?? '',
        data_inicio: initialData?.data_inicio ?? '',
        data_fim: initialData?.data_fim ?? '',
        local: initialData?.local ?? '',
        descricao: initialData?.descricao ?? '',
        ativo: initialData?.ativo ?? false,
        formulario_publico_ativo: initialData?.formulario_publico_ativo ?? false,
        edicao: initialData?.edicao ?? null,
        tema: initialData?.tema ?? '',
        musica: initialData?.musica ?? '',
        link_musica: initialData?.link_musica ?? '',
        link_youtube: initialData?.link_youtube ?? '',
        limite_vagas_online: initialData?.limite_vagas_online ?? 0,
        valor_taxa: initialData?.valor_taxa ?? 0,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/formulario?encontro=${initialData?.id}`;
        navigator.clipboard.writeText(url);

        setCopied(true);
        toast.success('Link copiado!');

        setTimeout(() => setCopied(false), 2000);
    };

    const handleChange = (field: keyof EncontroFormData, value: string | number | boolean | null) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const erros = validate(form);
        if (Object.keys(erros).length > 0) {
            setErrors(erros);
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(form);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h2>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    width: '100%',
                    backgroundColor: 'var(--surface-2)',
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                }}>
                    {/* Toggle: Ativo */}
                    <div style={{
                        flex: '1 1 280px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Encontro Ativo</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Status principal do sistema</span>
                        </div>
                        <div className="toggle-sim-nao">
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${form.ativo ? 'active-sim' : ''}`}
                                onClick={() => handleChange('ativo', true)}
                            >
                                Sim
                            </button>
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${!form.ativo ? 'active-nao' : ''}`}
                                onClick={() => handleChange('ativo', false)}
                            >
                                Não
                            </button>
                        </div>
                    </div>

                    {/* Divider Desktop Only */}
                    <div style={{ width: '1px', height: '40px', backgroundColor: 'var(--border-color)', opacity: 0.5 }} className="desktop-only" />

                    {/* Toggle: Form Público */}
                    <div style={{
                        flex: '1 1 280px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Liberar Formulários</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Recepção e Recreação</span>
                            {initialData && initialData.formulario_publico_ativo && (
                                <div className="encontro-detail-item" style={{ marginTop: '0.4rem', gap: '0.5rem' }}>
                                    <LinkIcon size={12} className="icon-dim" />
                                    <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 500 }}>Link Formulários Recepção e Recreação</span>
                                    <div className="musica-actions">
                                        <button
                                            type="button"
                                            className={`mini-link-btn ${copied ? 'copied' : ''}`}
                                            onClick={handleCopy}
                                            title="Copiar Link"
                                            style={{ width: '20px', height: '20px' }}
                                        >
                                            {copied ? <Check size={10} className="icon-check-anim" /> : <Copy size={10} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="toggle-sim-nao">
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${form.formulario_publico_ativo ? 'active-sim' : ''}`}
                                onClick={() => handleChange('formulario_publico_ativo', true)}
                            >
                                Sim
                            </button>
                            <button
                                type="button"
                                className={`toggle-sim-nao-item ${!form.formulario_publico_ativo ? 'active-nao' : ''}`}
                                onClick={() => handleChange('formulario_publico_ativo', false)}
                            >
                                Não
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <FormSection title="Dados Básicos" icon={<Info size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Nome do Encontro"
                        name="nome"
                        value={form.nome}
                        onChange={(e) => handleChange('nome', e.target.value)}
                        error={errors.nome}
                        required
                        colSpan={6}
                        placeholder="Ex: 25º EJC Capelinha"
                    />
                    <FormField
                        label="Edição"
                        name="edicao"
                        type="number"
                        value={form.edicao ?? ''}
                        onChange={(e) => handleChange('edicao', e.target.value ? parseInt(e.target.value) : null)}
                        colSpan={2}
                        placeholder="Ex: 25"
                    />
                    <CurrencyFormField
                        label="Valor da Taxa"
                        name="valor_taxa"
                        value={form.valor_taxa}
                        onChange={(val) => handleChange('valor_taxa', val)}
                        colSpan={2}
                        placeholder="0,00"
                    />
                    <FormField
                        label="Limite Online"
                        name="limite_vagas_online"
                        type="number"
                        value={form.limite_vagas_online}
                        onChange={(e) => handleChange('limite_vagas_online', e.target.value ? parseInt(e.target.value) : 0)}
                        colSpan={2}
                        placeholder="71"
                    />

                </FormRow>
            </FormSection>

            <FormSection title="Datas e Local" icon={<Calendar size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Data Início"
                        name="data_inicio"
                        type="date"
                        value={form.data_inicio}
                        onChange={(e) => handleChange('data_inicio', e.target.value)}
                        error={errors.data_inicio}
                        required
                        colSpan={3}
                    />
                    <FormField
                        label="Data Fim"
                        name="data_fim"
                        type="date"
                        value={form.data_fim}
                        onChange={(e) => handleChange('data_fim', e.target.value)}
                        error={errors.data_fim}
                        required
                        colSpan={3}
                    />
                    <FormField
                        label="Local"
                        name="local"
                        value={form.local ?? ''}
                        onChange={(e) => handleChange('local', e.target.value)}
                        colSpan={6}
                        placeholder="Ex: Centro Pastoral"
                    />
                </FormRow>

            </FormSection>

            <FormSection title="Tema e Inspiração" icon={<Tag size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Tema"
                        name="tema"
                        value={form.tema ?? ''}
                        onChange={(e) => handleChange('tema', e.target.value)}
                        colSpan={6}
                        placeholder="Tema do encontro"
                    />
                    <FormField
                        label="Música Tema"
                        name="musica"
                        value={form.musica ?? ''}
                        onChange={(e) => handleChange('musica', e.target.value)}
                        colSpan={6}
                        placeholder="Título da música"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Link da Música (Stream)"
                        name="link_musica"
                        value={form.link_musica ?? ''}
                        onChange={(e) => handleChange('link_musica', e.target.value)}
                        colSpan={6}
                        placeholder="Link Spotify, Deezer, etc."
                    />
                    <FormField
                        label="Link do YouTube"
                        name="link_youtube"
                        value={form.link_youtube ?? ''}
                        onChange={(e) => handleChange('link_youtube', e.target.value)}
                        colSpan={6}
                        placeholder="Link do vídeo/clipe"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Descrição"
                        name="descricao"
                        as="textarea"
                        value={form.descricao ?? ''}
                        onChange={(e) => handleChange('descricao', e.target.value)}
                        colSpan={12}
                        placeholder="Informações adicionais..."
                    />
                </FormRow>
            </FormSection>



            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-cancel" onClick={onCancel} disabled={isLoading}>
                    <X size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Cancelar
                </button>
                <button type="submit" disabled={isLoading || isSubmitting}>
                    {isLoading || isSubmitting ? (
                        <><Loader size={16} className="animate-spin" style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvando...</>
                    ) : (
                        <><Check size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvar</>
                    )}
                </button>
            </div>
            <style>{`
                .encontro-detail-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; width: 100%; }
                .icon-dim { opacity: 0.5; flex-shrink: 0; }
                .musica-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }
                .mini-link-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; background: var(--secondary-bg); border: 1px solid var(--border-color); color: var(--text-color); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
                .mini-link-btn:hover { background: var(--primary-color) !important; color: white !important; border-color: var(--primary-color); transform: translateY(-1px); }
                .mini-link-btn.copied { background: #10b981 !important; color: white !important; border-color: #10b981; }
                .icon-check-anim { animation: check-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

                @keyframes check-pop {
                    0% { transform: scale(0.5) rotate(-20deg); opacity: 0; }
                    100% { transform: scale(1) rotate(0); opacity: 1; }
                }
            `}</style>
        </form>
    );
}
