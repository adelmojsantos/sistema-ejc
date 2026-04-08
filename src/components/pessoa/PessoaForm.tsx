import React, { useState } from 'react';
import type { PessoaFormData } from '../../types/pessoa';
import { FormField } from '../ui/FormField';
import { FormSection } from '../ui/FormSection';
import { FormRow } from '../ui/FormRow';
import { RadioGroup } from '../ui/RadioGroup';
import { User, Phone, UsersRound, X, Check, Loader, MapPin, Mail, CreditCard, Calendar, Home } from 'lucide-react';
import { formatCpf, isValidCpf } from '../../utils/cpfUtils';

interface PessoaFormProps {
    initialData?: Partial<PessoaFormData>;
    onSubmit: (data: PessoaFormData) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

type FormErrors = Partial<Record<keyof PessoaFormData | 'cep', string>>;

function formatTelefone(value: string | null | undefined): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
        return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function formatCep(value: string): string {
    return value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{0,3})/, '$1-$2');
}

function validate(data: PessoaFormData): FormErrors {
    const errors: FormErrors = {};

    if (!data.nome_completo.trim()) errors.nome_completo = 'Nome completo é obrigatório.';

    if (data.cpf && data.cpf.trim().length > 0) {
        if (!isValidCpf(data.cpf)) {
            errors.cpf = 'CPF inválido.';
        }
    }

    if (data.email && data.email.trim().length > 0) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.email = 'E-mail inválido.';
        }
    }

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
        telefone_pai: initialData?.telefone_pai ? formatTelefone(initialData.telefone_pai) : '',
        telefone_mae: initialData?.telefone_mae ? formatTelefone(initialData.telefone_mae) : '',
        outros_contatos: initialData?.outros_contatos ?? '',
        fez_ejc_outra_paroquia: initialData?.fez_ejc_outra_paroquia ?? false,
        qual_paroquia_ejc: initialData?.qual_paroquia_ejc ?? '',
    });

    const [cep, setCep] = useState('');
    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const handleChange = (field: keyof PessoaFormData, value: string | boolean) => {
        let formatted = value;
        if (typeof value === 'string') {
            if (field === 'cpf') formatted = formatCpf(value);
            if (field === 'telefone' || field === 'telefone_pai' || field === 'telefone_mae') {
                formatted = formatTelefone(value);
            }
        }

        setForm((prev) => ({ ...prev, [field]: formatted }));
        if (errors[field as keyof PessoaFormData]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleCepBlur = async () => {
        const cleanCep = cep.replace(/\D/g, '');
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
                    cidade: data.localidade || prev.cidade
                }));
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setIsSearchingCep(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const erros = validate(form);
        if (Object.keys(erros).length > 0) {
            setErrors(erros);
            return;
        }

        const payload: PessoaFormData = {
            ...form,
            cpf: form.cpf ? form.cpf.replace(/\D/g, '') : null,
            email: form.email ? form.email.trim() : null,
            telefone: form.telefone.replace(/\D/g, ''),
            telefone_pai: form.telefone_pai ? form.telefone_pai.replace(/\D/g, '') : null,
            telefone_mae: form.telefone_mae ? form.telefone_mae.replace(/\D/g, '') : null,
            outros_contatos: form.outros_contatos ? form.outros_contatos.trim() : null,
            qual_paroquia_ejc: form.fez_ejc_outra_paroquia ? form.qual_paroquia_ejc : null,
        };

        await onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <FormSection title="Dados Pessoais" icon={<User size={18} />}>
                <FormRow>
                    <FormField
                        label="Nome Completo"
                        name="nome_completo"
                        value={form.nome_completo}
                        onChange={(e) => handleChange('nome_completo', e.target.value)}
                        error={errors.nome_completo}
                        required
                        colSpan={8}
                        autoComplete="name"
                        placeholder="Ex: João Silva Santos"
                        icon={<User size={18} />}
                    />
                    <FormField
                        label="CPF"
                        name="cpf"
                        value={form.cpf || ''}
                        onChange={(e) => handleChange('cpf', e.target.value)}
                        error={errors.cpf}
                        colSpan={4}
                        inputMode="numeric"
                        placeholder="000.000.000-00 (Opcional)"
                        icon={<CreditCard size={18} />}
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="E-mail"
                        name="email"
                        type="email"
                        value={form.email || ''}
                        onChange={(e) => handleChange('email', e.target.value)}
                        error={errors.email}
                        colSpan={8}
                        autoComplete="email"
                        placeholder="joao@email.com (Opcional)"
                        icon={<Mail size={18} />}
                    />
                    <FormField
                        label="Data de Nascimento"
                        name="data_nascimento"
                        type="date"
                        value={form.data_nascimento}
                        onChange={(e) => handleChange('data_nascimento', e.target.value)}
                        error={errors.data_nascimento}
                        required
                        colSpan={4}
                        icon={<Calendar size={18} />}
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Contato & Comunidade" icon={<Phone size={18} />}>
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
                        icon={<Phone size={18} />}
                    />
                    <FormField
                        label="Comunidade / Paróquia"
                        name="comunidade"
                        value={form.comunidade}
                        onChange={(e) => handleChange('comunidade', e.target.value)}
                        error={errors.comunidade}
                        colSpan={6}
                        placeholder="Ex: Paróquia São João"
                        icon={<Home size={18} />}
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Filiação" icon={<UsersRound size={18} />}>
                <FormRow>
                    <FormField
                        label="Nome do Pai"
                        name="nome_pai"
                        value={form.nome_pai ?? ''}
                        onChange={(e) => handleChange('nome_pai', e.target.value)}
                        colSpan={8}
                        placeholder="Opcional"
                    />
                    <FormField
                        label="Telefone do Pai"
                        name="telefone_pai"
                        value={form.telefone_pai ?? ''}
                        onChange={(e) => handleChange('telefone_pai', e.target.value)}
                        colSpan={4}
                        inputMode="tel"
                        placeholder="(00) 00000-0000"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Nome da Mãe"
                        name="nome_mae"
                        value={form.nome_mae ?? ''}
                        onChange={(e) => handleChange('nome_mae', e.target.value)}
                        colSpan={8}
                        placeholder="Opcional"
                    />
                    <FormField
                        label="Telefone da Mãe"
                        name="telefone_mae"
                        value={form.telefone_mae ?? ''}
                        onChange={(e) => handleChange('telefone_mae', e.target.value)}
                        colSpan={4}
                        inputMode="tel"
                        placeholder="(00) 00000-0000"
                    />
                </FormRow>
            </FormSection>

            <FormSection title="Outros Contatos & EJC" icon={<Phone size={18} />}>
                <FormRow>
                    <FormField
                        label="Outros Contatos / Observações"
                        name="outros_contatos"
                        value={form.outros_contatos ?? ''}
                        onChange={(e) => handleChange('outros_contatos', e.target.value)}
                        colSpan={12}
                        placeholder="Ex: Contato de emergência, alergias, etc."
                    />
                </FormRow>
                <FormRow>
                    <div className="col-12">
                        <RadioGroup
                            label="Já fez EJC em outra paróquia?"
                            value={form.fez_ejc_outra_paroquia}
                            onChange={(val) => handleChange('fez_ejc_outra_paroquia', val)}
                            options={[
                                { label: 'Sim', value: true },
                                { label: 'Não', value: false }
                            ]}
                        />
                    </div>
                </FormRow>
                {form.fez_ejc_outra_paroquia && (
                    <FormRow>
                        <FormField
                            label="Em qual paróquia?"
                            name="qual_paroquia_ejc"
                            value={form.qual_paroquia_ejc ?? ''}
                            onChange={(e) => handleChange('qual_paroquia_ejc', e.target.value)}
                            colSpan={12}
                            placeholder="Nome da paróquia e cidade"
                            required
                        />
                    </FormRow>
                )}
            </FormSection>

            <FormSection title="Endereço" icon={<MapPin size={18} />}>
                <FormRow>
                    <FormField
                        label="CEP"
                        name="cep"
                        value={cep}
                        onChange={(e) => setCep(formatCep(e.target.value))}
                        onBlur={handleCepBlur}
                        colSpan={4}
                        inputMode="numeric"
                        placeholder="00000-000"
                        icon={isSearchingCep ? <Loader size={18} className="animate-spin" /> : <MapPin size={18} />}
                        hint="Preencha o CEP para auto-completar"
                    />
                    <FormField
                        label="Cidade"
                        name="cidade"
                        value={form.cidade ?? ''}
                        onChange={(e) => handleChange('cidade', e.target.value)}
                        colSpan={8}
                        placeholder="Ex: Capelinha"
                    />
                </FormRow>
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
                        colSpan={12}
                        placeholder="Ex: Centro"
                    />
                </FormRow>
            </FormSection>

            <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={onCancel} disabled={isLoading}>
                    <X size={16} />
                    Cancelar
                </button>
                <button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <><Loader size={16} className="animate-spin" /> Salvando...</>
                    ) : (
                        <><Check size={16} /> Salvar Alterações</>
                    )}
                </button>
            </div>
        </form>
    );
}
