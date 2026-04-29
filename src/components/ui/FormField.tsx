import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    icon?: React.ReactNode;
    colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    floating?: boolean;
}

interface InputProps extends BaseProps, InputHTMLAttributes<HTMLInputElement> {
    as?: 'input';
}

interface TextareaProps extends BaseProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
    as: 'textarea';
    rows?: number;
}

type FormFieldProps = InputProps | TextareaProps;

export function FormField(props: FormFieldProps) {
    const { label, error, hint, required, colSpan, icon, className, as: Tag = 'input', floating = true, ...rest } = props;
    const id = rest.id ?? (rest.name as string);
    const hasIcon = Boolean(icon);

    return (
        <div className={`form-group ${floating ? 'floating-label-group' : 'standard-label-group'} ${colSpan ? `col-${colSpan}` : ''}`}>
            {!floating && (
                <label className="form-label standard-label" htmlFor={id}>
                    {label}
                    {required && <span className="form-label-required">*</span>}
                </label>
            )}
            <div className="form-input-wrapper">
                <Tag
                    id={id}
                    required={required}
                    placeholder={floating ? (rest.placeholder || " ") : rest.placeholder}
                    className={`form-input ${floating ? 'floating-input' : 'standard-input'} ${hasIcon ? 'form-input--with-icon' : ''} ${className || ''} ${error ? ' input-error' : ''}`}
                    {...(rest as InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>)}
                />
                {icon && (
                    <div className="form-input-icon">
                        {icon}
                    </div>
                )}
                {floating && (
                    <label className={`form-label floating-label ${hasIcon ? 'floating-label--icon' : ''}`} htmlFor={id}>
                        {label}
                        {required && <span className="form-label-required">*</span>}
                    </label>
                )}
            </div>

            {hint && !error && (
                <span className="form-hint">{hint}</span>
            )}
            {error && <span className="error-message">{error}</span>}
        </div>
    );
}
