import { Calendar, Check, CreditCard, Home, Loader, Mail, MapPin, Phone, Save, User, UsersRound, X } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import type { PessoaFormData } from '../../types/pessoa';
import { formatCpf, isValidCpf } from '../../utils/cpfUtils';
import { geocodeWithFallback } from '../../utils/geocoding';
import { FormField } from '../ui/FormField';
import { FormRow } from '../ui/FormRow';
import { FormSection } from '../ui/FormSection';
import { RadioGroup } from '../ui/RadioGroup';

interface PessoaFormProps {
    initialData?: Partial<PessoaFormData>;
    onSubmit: (data: PessoaFormData, shouldConfirm: boolean) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
    requireBirthDate?: boolean;
    requireFezEjc?: boolean;
    isConfirmationContext?: boolean;
    hideConfirmAction?: boolean;
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

function validate(data: PessoaFormData, requireBirthDate: boolean = false, requireFezEjc: boolean = false, requireEmail: boolean = false): FormErrors {
    const errors: FormErrors = {};

    if (!data.nome_completo.trim()) errors.nome_completo = 'Nome completo é obrigatório.';
 
    if (requireEmail && !data.email?.trim()) {
        errors.email = 'E-mail é obrigatório.';
    }

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
 
    if (requireBirthDate && !data.data_nascimento) {
        errors.data_nascimento = 'Data de nascimento é obrigatória.';
    }


    if (requireFezEjc && data.fez_ejc_outra_paroquia === null) {
        errors.fez_ejc_outra_paroquia = 'Selecione uma opção.';
    }

    if (data.fez_ejc_outra_paroquia && !data.qual_paroquia_ejc?.trim()) {
        errors.qual_paroquia_ejc = 'Informe qual foi a paróquia / cidade.';
    }

    return errors;
}

export function PessoaForm({ initialData, onSubmit, onCancel, isLoading = false, requireBirthDate = false, requireFezEjc = false, isConfirmationContext = false, hideConfirmAction = false }: PessoaFormProps) {
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
        estado: initialData?.estado ?? '',
        telefone_pai: initialData?.telefone_pai ? formatTelefone(initialData.telefone_pai) : '',
        telefone_mae: initialData?.telefone_mae ? formatTelefone(initialData.telefone_mae) : '',
        outros_contatos: initialData?.outros_contatos ?? '',
        fez_ejc_outra_paroquia: initialData?.fez_ejc_outra_paroquia ?? (requireFezEjc ? null : false),
        qual_paroquia_ejc: initialData?.qual_paroquia_ejc ?? '',
        // Preserve existing geolocation — never overwrite with undefined
        latitude: initialData?.latitude ?? null,
        longitude: initialData?.longitude ?? null,
        cep: initialData?.cep ? formatCep(initialData.cep) : '',
    });

    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const handleChange = (field: keyof PessoaFormData, value: string | boolean | null) => {
        let formatted = value;
        if (typeof value === 'string') {
            if (field === 'cpf') formatted = formatCpf(value);
            if (field === 'cep') formatted = formatCep(value);
            if (field === 'telefone' || field === 'telefone_pai' || field === 'telefone_mae') {
                formatted = formatTelefone(value);
            }
        }

        setForm((prev) => ({ ...prev, [field]: formatted }));
        if (errors[field as keyof PessoaFormData]) setErrors((prev) => ({ ...prev, [field]: undefined }));
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
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setIsSearchingCep(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleSubmit = async (e: React.FormEvent, skipValidation = false) => {
        if (e) e.preventDefault();

        if (!skipValidation) {
            const erros = validate(form, isConfirmationContext || requireBirthDate, requireFezEjc, isConfirmationContext);

            // For confirmation, also validate address
            if (isConfirmationContext && !form.endereco?.trim()) {
                erros.endereco = 'Endereço é obrigatório para confirmação.';
            }

            if (Object.keys(erros).length > 0) {
                setErrors(erros);
                toast.error('Por favor, preencha todos os campos obrigatórios.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload: PessoaFormData = {
                ...form,
                cpf: form.cpf ? form.cpf.replace(/\D/g, '') : null,
                email: form.email ? form.email.trim() : null,
                telefone: form.telefone.replace(/\D/g, ''),
                data_nascimento: form.data_nascimento || null,
                telefone_pai: form.telefone_pai ? form.telefone_pai.replace(/\D/g, '') : null,
                telefone_mae: form.telefone_mae ? form.telefone_mae.replace(/\D/g, '') : null,
                outros_contatos: form.outros_contatos ? form.outros_contatos.trim() : null,
                fez_ejc_outra_paroquia: form.fez_ejc_outra_paroquia,
                qual_paroquia_ejc: form.fez_ejc_outra_paroquia ? form.qual_paroquia_ejc : null,
                latitude: form.latitude || null,
                longitude: form.longitude || null,
                cep: form.cep ? form.cep.replace(/\D/g, '') : null,
            };

            // Silent geocoding before submitting — tries multiple address variants
            if (form.endereco && (!form.latitude || !form.longitude)) {
                const coords = await geocodeWithFallback(form);
                if (coords) {
                    payload.latitude = coords[0];
                    payload.longitude = coords[1];
                }
            }

            await onSubmit(payload, !skipValidation);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={(e) => handleSubmit(e)} onKeyDown={handleKeyDown} noValidate>
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
                        required
                        colSpan={8}
                        autoComplete="email"
                        placeholder="joao@email.com"
                        icon={<Mail size={18} />}
                    />
                    <FormField
                        label="Data de Nascimento"
                        name="data_nascimento"
                        type="date"
                        value={form.data_nascimento || ''}
                        onChange={(e) => handleChange('data_nascimento', e.target.value)}
                        error={errors.data_nascimento}
                        required={requireBirthDate}
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
                            label={`Já fez EJC em outra paróquia? ${requireFezEjc ? '*' : ''}`}
                            value={form.fez_ejc_outra_paroquia}
                            onChange={(val) => handleChange('fez_ejc_outra_paroquia', val)}
                            options={[
                                { label: 'Não Fiz EJC', value: false },
                                { label: 'Sim, já fiz EJC em Outra Paróquia', value: true }
                            ]}
                            error={errors.fez_ejc_outra_paroquia}
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
                        value={form.cep ?? ''}
                        onChange={(e) => handleChange('cep', e.target.value)}
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
                        colSpan={6}
                        placeholder="Ex: Capelinha"
                    />
                    <FormField
                        label="Estado (UF)"
                        name="estado"
                        value={form.estado ?? ''}
                        onChange={(e) => handleChange('estado', e.target.value)}
                        colSpan={2}
                        placeholder="SP"
                        maxLength={2}
                        style={{ textTransform: 'uppercase' }}
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Rua / Logradouro"
                        name="endereco"
                        value={form.endereco ?? ''}
                        onChange={(e) => handleChange('endereco', e.target.value)}
                        error={errors.endereco}
                        required={isConfirmationContext}
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
                <button type="button" className="btn-cancel" onClick={onCancel} disabled={isLoading || isSubmitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <X size={18} />
                    Cancelar
                </button>

                {isConfirmationContext ? (
                    <>
                        <button
                            type="button"
                            className="btn-primary-secondary"
                            onClick={(e) => handleSubmit(e, hideConfirmAction ? false : true)}
                            disabled={isLoading || isSubmitting}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            {isLoading || isSubmitting ? (
                                <><Loader size={18} className="animate-spin" /> Salvando...</>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <Save size={18} />
                                    Salvar
                                </div>
                            )}
                        </button>
                        {!hideConfirmAction && (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={(e) => handleSubmit(e, false)}
                                disabled={isLoading || isSubmitting}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                {isLoading || isSubmitting ? (
                                    <><Loader size={18} className="animate-spin" /> Confirmando...</>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '0.5rem' }}>
                                        <Check size={18} />
                                        Salvar e Confirmar Dados
                                    </div>
                                )}
                            </button>
                        )}
                    </>
                ) : (
                    <button type="submit" disabled={isLoading || isSubmitting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {isLoading || isSubmitting ? (
                            <><Loader size={18} className="animate-spin" /> Salvando...</>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '0.5rem' }}>
                                <Check size={18} />
                                Salvar Alterações
                            </div>
                        )}
                    </button>
                )}
            </div>
        </form>
    );
}
