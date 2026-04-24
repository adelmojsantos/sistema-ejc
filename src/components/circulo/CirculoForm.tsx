import React, { useState } from 'react';
import type { Circulo, CirculoFormData } from '../../types/circulo';
import { FormField } from '../ui/FormField';
import { FormRow } from '../ui/FormRow';
import { FormSection } from '../ui/FormSection';
import { Check, X, Loader, UsersRound } from 'lucide-react';

interface CirculoFormProps {
    initialData?: Circulo;
    onSubmit: (data: CirculoFormData) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function CirculoForm({ initialData, onSubmit, onCancel, isLoading = false }: CirculoFormProps) {
    const [nome, setNome] = useState(initialData?.nome ?? '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome.trim()) {
            setError('Nome do círculo é obrigatório.');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await onSubmit({ nome });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
            <FormSection title="Informações do Círculo" icon={<UsersRound size={18} />} columns={0}>
                <FormRow>
                    <FormField
                        label="Nome do Círculo"
                        name="nome_circulo"
                        value={nome}
                        onChange={(e) => { setNome(e.target.value); setError(null); }}
                        error={error ?? undefined}
                        required
                        colSpan={12}
                        placeholder="Ex: Círculo Azul, Círculo Verde..."
                    />
                </FormRow>
            </FormSection>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
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
