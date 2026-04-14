import React, { useState } from 'react';
import { Calendar, Info, Loader, Check, Tag, X, Users } from 'lucide-react';
import type { Encontro, EncontroFormData } from '../../types/encontro';
import { FormField } from '../ui/FormField';
import { FormSection } from '../ui/FormSection';
import { FormRow } from '../ui/FormRow';

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
        edicao: initialData?.edicao ?? null,
        tema: initialData?.tema ?? '',
        musica: initialData?.musica ?? '',
        link_musica: initialData?.link_musica ?? '',
        link_youtube: initialData?.link_youtube ?? '',
        limite_vagas_online: initialData?.limite_vagas_online ?? 0,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const handleChange = (field: keyof EncontroFormData, value: string | number | boolean | null) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
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
        <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{title}</h2>
                <label className="switch">
                    <input
                        type="checkbox"
                        className="switch-input"
                        checked={form.ativo}
                        onChange={(e) => handleChange('ativo', e.target.checked)}
                    />
                    <span className="switch-slider"></span>
                    <span className="switch-label">{form.ativo ? 'Encontro Ativo' : 'Encontro Inativo'}</span>
                </label>
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
                        colSpan={8}
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
        </form>
    );
}
