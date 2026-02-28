import React, { useState } from 'react';
import type { Pessoa, PessoaFormData } from '../../types/pessoa';
import { FormField } from '../ui/FormField';
import { FormSection } from '../ui/FormSection';
import { FormRow } from '../ui/FormRow';
import { User, Phone, UsersRound, X, Check, Loader } from 'lucide-react';

interface PessoaFormProps {
    initialData?: Pessoa;
    onSubmit: (data: PessoaFormData) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

type FormErrors = Partial<Record<keyof PessoaFormData, string>>;

function formatCpf(value: string | null | undefined): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatTelefone(value: string | null | undefined): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function validate(data: PessoaFormData): FormErrors {
    const errors: FormErrors = {};

    if (!data.nome_completo.trim()) errors.nome_completo = 'Nome completo é obrigatório.';
    if (!data.cpf.trim() || data.cpf.replace(/\D/g, '').length !== 11)
        errors.cpf = 'CPF inválido (11 dígitos).';
    if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
        errors.email = 'E-mail inválido.';
    if (!data.telefone.trim() || data.telefone.replace(/\D/g, '').length < 10)
        errors.telefone = 'Telefone inválido.';
    if (!data.data_nascimento) errors.data_nascimento = 'Data de nascimento é obrigatória.';

    return errors;
}

export function PessoaForm({ initialData, onSubmit, onCancel, isLoading = false }: PessoaFormProps) {
    const [form, setForm] = useState<PessoaFormData>({
        nome_completo: initialData?.nome_completo ?? '',
        cpf: initialData?.cpf ? formatCpf(initialData.cpf) : '',
        email: initialData?.email ?? '',
        telefone: initialData?.telefone ? formatTelefone(initialData.telefone) : '',
        comunidade: initialData?.comunidade ?? '',
        data_nascimento: initialData?.data_nascimento ?? '',
        nome_pai: initialData?.nome_pai ?? null,
        nome_mae: initialData?.nome_mae ?? null,
        endereco: initialData?.endereco ?? '',
        numero: initialData?.numero ?? '',
        bairro: initialData?.bairro ?? '',
        cidade: initialData?.cidade ?? '',
    });

    const [errors, setErrors] = useState<FormErrors>({});

    const handleChange = (field: keyof PessoaFormData, value: string) => {
        let formatted = value;
        if (field === 'cpf') formatted = formatCpf(value);
        if (field === 'telefone') formatted = formatTelefone(value);

        setForm((prev) => ({ ...prev, [field]: formatted || null }));
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const erros = validate(form);
        if (Object.keys(erros).length > 0) {
            setErrors(erros);
            return;
        }

        // Strip formatting before sending
        const payload: PessoaFormData = {
            ...form,
            cpf: form.cpf.replace(/\D/g, ''),
            telefone: form.telefone.replace(/\D/g, ''),
        };

        await onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <FormSection title="Dados Pessoais" icon={<User size={18} />} columns={1}>
                <FormRow>
                    <FormField
                        label="Nome Completo"
                        name="nome_completo"
                        value={form.nome_completo}
                        onChange={(e) => handleChange('nome_completo', e.target.value)}
                        error={errors.nome_completo}
                        required
                        colSpan={6}
                        autoComplete="name"
                        placeholder="Ex: João Silva Santos"
                    />
                    <FormField
                        label="E-mail"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        error={errors.email}
                        required
                        colSpan={6}
                        autoComplete="email"
                        placeholder="joao@email.com"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="CPF"
                        name="cpf"
                        value={form.cpf}
                        onChange={(e) => handleChange('cpf', e.target.value)}
                        error={errors.cpf}
                        required
                        colSpan={3}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                    />
                    <FormField
                        label="Data de Nascimento"
                        name="data_nascimento"
                        type="date"
                        value={form.data_nascimento}
                        onChange={(e) => handleChange('data_nascimento', e.target.value)}
                        error={errors.data_nascimento}
                        required
                        colSpan={3}
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Contato & Comunidade" icon={<Phone size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Telefone / WhatsApp"
                        name="telefone"
                        value={form.telefone}
                        onChange={(e) => handleChange('telefone', e.target.value)}
                        error={errors.telefone}
                        required
                        colSpan={6}
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                    />
                    <FormField
                        label="Comunidade / Paróquia"
                        name="comunidade"
                        value={form.comunidade}
                        onChange={(e) => handleChange('comunidade', e.target.value)}
                        error={errors.comunidade}
                        colSpan={6}
                        placeholder="Ex: Paróquia São João"
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Filiação" icon={<UsersRound size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Nome do Pai"
                        name="nome_pai"
                        value={form.nome_pai ?? ''}
                        onChange={(e) => handleChange('nome_pai', e.target.value)}
                        colSpan={6}
                        placeholder="Opcional"
                    />
                    <FormField
                        label="Nome da Mãe"
                        name="nome_mae"
                        value={form.nome_mae ?? ''}
                        onChange={(e) => handleChange('nome_mae', e.target.value)}
                        colSpan={6}
                        placeholder="Opcional"
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Endereço" icon={<Check size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Rua / Logradouro"
                        name="endereco"
                        value={form.endereco ?? ''}
                        onChange={(e) => handleChange('endereco', e.target.value)}
                        colSpan={9}
                        placeholder="Ex: Rua das Flores"
                    />
                    <FormField
                        label="Nº"
                        name="numero"
                        value={form.numero ?? ''}
                        onChange={(e) => handleChange('numero', e.target.value)}
                        colSpan={3}
                        placeholder="123"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Bairro"
                        name="bairro"
                        value={form.bairro ?? ''}
                        onChange={(e) => handleChange('bairro', e.target.value)}
                        colSpan={6}
                        placeholder="Ex: Centro"
                    />
                    <FormField
                        label="Cidade"
                        name="cidade"
                        value={form.cidade ?? ''}
                        onChange={(e) => handleChange('cidade', e.target.value)}
                        colSpan={6}
                        placeholder="Ex: Capelinha"
                    />
                </FormRow>
            </FormSection>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" className="btn-cancel" onClick={onCancel} disabled={isLoading}>
                    <X size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Cancelar
                </button>
                <button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <><Loader size={16} className="animate-spin" style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvando...</>
                    ) : (
                        <><Check size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvar</>
                    )}
                </button>
            </div>
        </form>
    );
}
