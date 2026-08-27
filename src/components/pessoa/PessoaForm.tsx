import { Calendar, Check, CreditCard, Home, Loader, Mail, MapPin, Phone, Save, User, UsersRound, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { PessoaFormData } from '../../types/pessoa';
import { formatCpf, isValidCpf } from '../../utils/cpfUtils';
import { findCEPsByAddress, getAddressByCEP, type CepAddress } from '../../services/cepService';
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
    draftStorageKey?: string;
}

type FormErrors = Partial<Record<keyof PessoaFormData | 'cep', string>>;

const ADDRESS_FIELDS = new Set<keyof PessoaFormData>([
    'endereco', 'numero', 'complemento', 'cep', 'bairro', 'cidade', 'estado',
]);

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

function normalizeAddressPart(value: string | null | undefined): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function validate(data: PessoaFormData, requireBirthDate: boolean = false, requireFezEjc: boolean = false): FormErrors {
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

function readDraft(storageKey: string): Partial<PessoaFormData> | undefined {
    try {
        const value = sessionStorage.getItem(storageKey);
        if (!value) return undefined;
        const parsed: unknown = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed as Partial<PessoaFormData> : undefined;
    } catch {
        return undefined;
    }
}

export function PessoaForm({ initialData, onSubmit, onCancel, isLoading = false, requireBirthDate = false, requireFezEjc = false, isConfirmationContext = false, hideConfirmAction = false, draftStorageKey }: PessoaFormProps) {
    const [form, setForm] = useState<PessoaFormData>(() => {
        const source = initialData ?? (draftStorageKey ? readDraft(draftStorageKey) : undefined);
        return {
        nome_completo: source?.nome_completo ?? '',
        cpf: source?.cpf ? formatCpf(source.cpf) : '',
        email: source?.email ?? '',
        telefone: source?.telefone ? formatTelefone(source.telefone) : '',
        comunidade: source?.comunidade ?? '',
        data_nascimento: source?.data_nascimento ?? '',
        nome_pai: source?.nome_pai ?? null,
        nome_mae: source?.nome_mae ?? null,
        endereco: source?.endereco ?? '',
        numero: source?.numero ?? '',
        bairro: source?.bairro ?? '',
        cidade: source?.cidade ?? '',
        estado: source?.estado ?? '',
        telefone_pai: source?.telefone_pai ? formatTelefone(source.telefone_pai) : '',
        telefone_mae: source?.telefone_mae ? formatTelefone(source.telefone_mae) : '',
        outros_contatos: source?.outros_contatos ?? '',
        fez_ejc_outra_paroquia: source?.fez_ejc_outra_paroquia ?? (requireFezEjc ? null : false),
        qual_paroquia_ejc: source?.qual_paroquia_ejc ?? '',
        // Preserve existing geolocation — never overwrite with undefined
        latitude: source?.latitude ?? null,
        longitude: source?.longitude ?? null,
        cep: source?.cep ? formatCep(source.cep) : '',
        complemento: source?.complemento ?? '',
        geo_status: source?.geo_status ?? (source?.latitude != null && source?.longitude != null ? 'legacy_review' : 'pending'),
        geo_source: source?.geo_source ?? (source?.latitude != null && source?.longitude != null ? 'legacy' : null),
        geo_precision: source?.geo_precision ?? (source?.latitude != null && source?.longitude != null ? 'unknown' : null),
        geo_accuracy_m: source?.geo_accuracy_m ?? null,
        geo_address_fingerprint: source?.geo_address_fingerprint ?? null,
        geo_checked_at: source?.geo_checked_at ?? null,
        geo_verified_at: source?.geo_verified_at ?? null,
        geo_verified_by: source?.geo_verified_by ?? null,
        geo_failure_code: source?.geo_failure_code ?? null,
        geo_retry_count: source?.geo_retry_count ?? 0,
        geo_next_retry_at: source?.geo_next_retry_at ?? null,
        geo_reference_latitude: source?.geo_reference_latitude ?? null,
        geo_reference_longitude: source?.geo_reference_longitude ?? null,
        geo_reference_source: source?.geo_reference_source ?? null,
        geo_reference_precision: source?.geo_reference_precision ?? null,
        geo_reference_address_fingerprint: source?.geo_reference_address_fingerprint ?? null,
        geo_reference_checked_at: source?.geo_reference_checked_at ?? null,
        };
    });

    const [isSearchingCep, setIsSearchingCep] = useState(false);
    const [cepCandidates, setCepCandidates] = useState<CepAddress[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        if (!draftStorageKey) return;
        const persistDraft = () => {
            try {
                const draft: Partial<PessoaFormData> = {
                    nome_completo: form.nome_completo,
                    cpf: form.cpf,
                    email: form.email,
                    telefone: form.telefone,
                    comunidade: form.comunidade,
                    data_nascimento: form.data_nascimento,
                    nome_pai: form.nome_pai,
                    nome_mae: form.nome_mae,
                    endereco: form.endereco,
                    numero: form.numero,
                    complemento: form.complemento,
                    cep: form.cep,
                    bairro: form.bairro,
                    cidade: form.cidade,
                    estado: form.estado,
                    telefone_pai: form.telefone_pai,
                    telefone_mae: form.telefone_mae,
                    outros_contatos: form.outros_contatos,
                    fez_ejc_outra_paroquia: form.fez_ejc_outra_paroquia,
                    qual_paroquia_ejc: form.qual_paroquia_ejc,
                };
                sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
            } catch {
                // O formulário continua funcional quando o navegador bloqueia o storage.
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') persistDraft();
        };
        const timer = window.setTimeout(persistDraft, 250);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', persistDraft);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', persistDraft);
        };
    }, [draftStorageKey, form]);

    const handleChange = (field: keyof PessoaFormData, value: string | boolean | null) => {
        let formatted = value;
        if (typeof value === 'string') {
            if (field === 'cpf') formatted = formatCpf(value);
            if (field === 'cep') formatted = formatCep(value);
            if (field === 'telefone' || field === 'telefone_pai' || field === 'telefone_mae') {
                formatted = formatTelefone(value);
            }
        }

        setForm((prev) => {
            const next = { ...prev, [field]: formatted };
            if (ADDRESS_FIELDS.has(field) && prev[field] !== formatted) {
                return {
                    ...next,
                    latitude: null,
                    longitude: null,
                    geo_status: 'pending',
                    geo_source: null,
                    geo_precision: null,
                    geo_accuracy_m: null,
                    geo_checked_at: null,
                    geo_verified_at: null,
                    geo_verified_by: null,
                    geo_failure_code: 'address_changed',
                    geo_retry_count: 0,
                    geo_next_retry_at: null,
                    geo_reference_latitude: null,
                    geo_reference_longitude: null,
                    geo_reference_source: null,
                    geo_reference_precision: null,
                    geo_reference_address_fingerprint: null,
                    geo_reference_checked_at: null,
                };
            }
            return next;
        });
        if (errors[field as keyof PessoaFormData]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleCepBlur = async () => {
        const cleanCep = form.cep ? String(form.cep).replace(/\D/g, '') : '';
        if (cleanCep.length !== 8) return;

        setIsSearchingCep(true);
        try {
            const data = await getAddressByCEP(cleanCep);
            if (data) {
                setForm(prev => {
                    const addressChanged = (data.endereco && data.endereco !== prev.endereco)
                        || (data.bairro && data.bairro !== prev.bairro)
                        || (data.cidade && data.cidade !== prev.cidade)
                        || (data.estado && data.estado !== prev.estado);
                    return {
                        ...prev,
                        endereco: data.endereco || prev.endereco,
                        bairro: data.bairro || prev.bairro,
                        cidade: data.cidade || prev.cidade,
                        estado: data.estado || prev.estado,
                        ...(addressChanged ? {
                            latitude: null,
                            longitude: null,
                            geo_status: 'pending' as const,
                            geo_source: null,
                            geo_precision: null,
                            geo_accuracy_m: null,
                            geo_checked_at: null,
                            geo_verified_at: null,
                            geo_verified_by: null,
                            geo_failure_code: 'address_changed',
                            geo_retry_count: 0,
                            geo_next_retry_at: null,
                            geo_reference_latitude: null,
                            geo_reference_longitude: null,
                            geo_reference_source: null,
                            geo_reference_precision: null,
                            geo_reference_address_fingerprint: null,
                            geo_reference_checked_at: null,
                        } : {}),
                    };
                });
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            setIsSearchingCep(false);
        }
    };

    const applyCepCandidate = (candidate: CepAddress) => {
        if (!candidate.cep) return;
        setForm(prev => ({
            ...prev,
            cep: formatCep(candidate.cep || ''),
            endereco: candidate.endereco || prev.endereco,
            bairro: candidate.bairro || prev.bairro,
            cidade: candidate.cidade || prev.cidade,
            estado: candidate.estado || prev.estado,
            latitude: null,
            longitude: null,
            geo_status: 'pending',
            geo_source: null,
            geo_precision: null,
            geo_accuracy_m: null,
            geo_checked_at: null,
            geo_verified_at: null,
            geo_verified_by: null,
            geo_failure_code: 'address_changed',
            geo_retry_count: 0,
            geo_next_retry_at: null,
            geo_reference_latitude: null,
            geo_reference_longitude: null,
            geo_reference_source: null,
            geo_reference_precision: null,
            geo_reference_address_fingerprint: null,
            geo_reference_checked_at: null,
        }));
        setCepCandidates([]);
        toast.success(`CEP ${formatCep(candidate.cep)} associado ao endereço.`);
    };

    const handleFindCepByAddress = async () => {
        const state = form.estado?.trim() || '';
        const city = form.cidade?.trim() || '';
        const street = form.endereco?.trim() || '';
        if (!/^[A-Za-z]{2}$/.test(state) || city.length < 3 || street.length < 3) {
            toast.error('Informe UF, cidade e logradouro para procurar o CEP.');
            return;
        }

        setIsSearchingCep(true);
        try {
            const results = await findCEPsByAddress(state, city, street);
            const exactStreet = results.filter((item) =>
                normalizeAddressPart(item.endereco) === normalizeAddressPart(street));
            const streetMatches = exactStreet.length > 0 ? exactStreet : results;
            const neighborhoodMatches = form.bairro?.trim()
                ? streetMatches.filter((item) =>
                    normalizeAddressPart(item.bairro) === normalizeAddressPart(form.bairro))
                : [];
            const preferred = neighborhoodMatches.length > 0 ? neighborhoodMatches : streetMatches;

            if (preferred.length === 1) {
                applyCepCandidate(preferred[0]);
                return;
            }
            setCepCandidates(preferred);
            if (preferred.length === 0) {
                toast.error('Nenhum CEP compatível foi encontrado. O campo permanecerá vazio.');
            } else {
                toast.success('Encontramos mais de um CEP. Selecione o bairro ou trecho correto.');
            }
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
            const erros = validate(form, isConfirmationContext || requireBirthDate, requireFezEjc);

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
                complemento: form.complemento || null,
            };

            const completeAddress = Boolean(form.endereco?.trim() && form.numero?.trim() && form.cidade?.trim() && form.estado?.trim());
            if (!completeAddress) {
                Object.assign(payload, {
                    latitude: null,
                    longitude: null,
                    geo_status: 'pending',
                    geo_source: null,
                    geo_precision: null,
                    geo_accuracy_m: null,
                    geo_failure_code: 'incomplete_address',
                });
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
                        label="Rua / Logradouro"
                        name="endereco"
                        value={form.endereco ?? ''}
                        onChange={(e) => handleChange('endereco', e.target.value)}
                        error={errors.endereco}
                        required={isConfirmationContext}
                        colSpan={6}
                        placeholder="Ex: Rua das Flores"
                    />
                    <FormField
                        label="Nº"
                        name="numero"
                        value={form.numero ?? ''}
                        onChange={(e) => handleChange('numero', e.target.value)}
                        colSpan={2}
                        placeholder="123"
                    />
                </FormRow>
                <FormRow>
                    <FormField
                        label="Complemento"
                        name="complemento"
                        value={form.complemento ?? ''}
                        onChange={(e) => handleChange('complemento', e.target.value)}
                        colSpan={3}
                        placeholder="Ex: Ap 12, Bloco B, Chácara..."
                    />
                    <FormField
                        label="Bairro"
                        name="bairro"
                        value={form.bairro ?? ''}
                        onChange={(e) => handleChange('bairro', e.target.value)}
                        colSpan={3}
                        placeholder="Ex: Centro"
                    />
                    <FormField
                        label="Cidade"
                        name="cidade"
                        value={form.cidade ?? ''}
                        onChange={(e) => handleChange('cidade', e.target.value)}
                        colSpan={4}
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
                {!String(form.cep ?? '').replace(/\D/g, '') && (
                    <FormRow>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void handleFindCepByAddress()}
                                disabled={isSearchingCep || !form.estado?.trim() || !form.cidade?.trim() || !form.endereco?.trim()}
                            >
                                {isSearchingCep ? <Loader size={16} className="animate-spin" /> : <MapPin size={16} />}
                                Buscar CEP pelo endereço
                            </button>
                            <span className="form-hint">A busca usa UF, cidade e rua; o número da residência não é enviado.</span>
                        </div>
                    </FormRow>
                )}
                {cepCandidates.length > 1 && (
                    <FormRow>
                        <div className="form-group col-12 standard-label-group">
                            <label className="form-label standard-label" htmlFor="cep-candidate">Selecione o CEP correto</label>
                            <select
                                id="cep-candidate"
                                className="form-input standard-input"
                                defaultValue=""
                                onChange={(event) => {
                                    const selected = cepCandidates.find((item) => item.cep === event.target.value);
                                    if (selected) applyCepCandidate(selected);
                                }}
                            >
                                <option value="" disabled>Escolha pelo bairro ou trecho</option>
                                {cepCandidates.map((item) => (
                                    <option key={item.cep} value={item.cep}>
                                        {formatCep(item.cep || '')} — {item.endereco}{item.bairro ? ` — ${item.bairro}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </FormRow>
                )}
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
                            onClick={(e) => handleSubmit(e, true)}
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
