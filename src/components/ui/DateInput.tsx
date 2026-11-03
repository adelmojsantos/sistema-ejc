import { useState } from 'react';
import { formatDateMask, isoDateToMasked, maskedDateToIso } from '../../utils/dateUtils';
import { FormField } from './FormField';

interface DateInputProps {
    label: string;
    name: string;
    /** Data no formato YYYY-MM-DD, ou vazio enquanto a digitação estiver incompleta/inválida. */
    value: string;
    onChange: (isoValue: string) => void;
    error?: string;
    required?: boolean;
    className?: string;
    autoFocus?: boolean;
}

/**
 * Campo de data por digitação (dd/mm/aaaa) com máscara automática.
 * Evita o seletor nativo `type="date"`, que no iOS Safari abre com uma data pré-selecionada.
 */
export function DateInput({ label, name, value, onChange, error, required, className, autoFocus }: DateInputProps) {
    const [text, setText] = useState(() => isoDateToMasked(value));

    // Sincroniza quando o valor é alterado externamente (ex.: limpo ou pré-preenchido pelo pai).
    if (value !== maskedDateToIso(text)) {
        const external = isoDateToMasked(value);
        if (external !== text) setText(external);
    }

    const digitsComplete = text.length === 10;
    const localError = error ?? (digitsComplete && !value ? 'Data inválida' : undefined);

    return (
        <FormField
            label={label}
            name={name}
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="dd/mm/aaaa"
            maxLength={10}
            value={text}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const next = formatDateMask(event.target.value);
                setText(next);
                onChange(maskedDateToIso(next));
            }}
            error={localError}
            required={required}
            className={className}
            autoFocus={autoFocus}
        />
    );
}
