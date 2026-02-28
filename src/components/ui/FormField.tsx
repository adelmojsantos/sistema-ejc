import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

interface InputProps extends BaseProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
    as?: 'input';
}

interface TextareaProps extends BaseProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
    as: 'textarea';
    rows?: number;
}

type FormFieldProps = InputProps | TextareaProps;

export function FormField(props: FormFieldProps) {
    const { label, error, hint, required, colSpan, as: Tag = 'input', ...rest } = props;
    const id = rest.id ?? (rest.name as string);

    return (
        <div className={`form-group ${colSpan ? `col-${colSpan}` : ''}`}>
            <label className="form-label" htmlFor={id}>
                {label}
                {required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
            </label>

            {Tag === 'textarea' ? (
                <textarea
                    id={id}
                    className={`form-input${error ? ' input-error' : ''}`}
                    {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
                />
            ) : (
                <input
                    id={id}
                    className={`form-input${error ? ' input-error' : ''}`}
                    {...(rest as InputHTMLAttributes<HTMLInputElement>)}
                />
            )}

            {hint && !error && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-color)', opacity: 0.6 }}>{hint}</span>
            )}
            {error && <span className="error-message" style={{ textAlign: 'left' }}>{error}</span>}
        </div>
    );
}
