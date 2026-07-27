import React from 'react';
import { FormField } from './FormField';
import { formatFinancialWithSymbol, parseToDigits, toCentString } from '../../utils/currencyUtils';

interface CurrencyFormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'name'> {
    label: string;
    value: number;
    onChange: (value: number) => void;
    error?: string;
    hint?: string;
    required?: boolean;
    colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    placeholder?: string;
    name: string;
}

export function CurrencyFormField({
    label,
    value,
    onChange,
    error,
    hint,
    required,
    colSpan,
    placeholder = 'R$ 0,00',
    name,
    ...inputProps
}: CurrencyFormFieldProps) {
    const displayValue = formatFinancialWithSymbol(toCentString(value));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = parseToDigits(e.target.value);

        if (digits.length > 12) return;

        const numericValue = parseInt(digits || '0', 10) / 100;
        onChange(numericValue);
    };

    return (
        <FormField
            label={label}
            name={name}
            type="tel"
            value={displayValue}
            onChange={handleChange}
            error={error}
            hint={hint}
            required={required}
            colSpan={colSpan}
            placeholder={placeholder}
            autoComplete="off"
            floating={true}
            {...inputProps}
        />
    );
}
