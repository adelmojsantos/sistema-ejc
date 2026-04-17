import React, { useState, useEffect } from 'react';
import { FormField } from './FormField';
import { formatFinancialWithSymbol, parseToDigits, toCentString } from '../../utils/currencyUtils';

interface CurrencyFormFieldProps {
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
    name
}: CurrencyFormFieldProps) {
    // Local state for the display string (including R$)
    const [displayValue, setDisplayValue] = useState(formatFinancialWithSymbol(toCentString(value)));

    // Synchronize local state with prop value (e.g. when loading data)
    useEffect(() => {
        const propDigits = toCentString(value);
        const currentDigits = parseToDigits(displayValue);
        if (propDigits !== currentDigits) {
            setDisplayValue(formatFinancialWithSymbol(propDigits));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = parseToDigits(e.target.value);

        // Prevent extremely large numbers if desired (optional)
        if (digits.length > 12) return;

        const formatted = formatFinancialWithSymbol(digits);
        setDisplayValue(formatted);

        const numericValue = parseInt(digits || '0', 10) / 100;
        onChange(numericValue);
    };

    return (
        <FormField
            label={label}
            name={name}
            type="tel" // Use tel for numeric keypad on mobile
            value={displayValue}
            onChange={handleChange}
            error={error}
            hint={hint}
            required={required}
            colSpan={colSpan}
            placeholder={placeholder}
            autoComplete="off"
            floating={true}
        />
    );
}
