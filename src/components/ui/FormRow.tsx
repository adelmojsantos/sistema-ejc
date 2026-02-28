import type { ReactNode } from 'react';

interface FormRowProps {
    children: ReactNode;
    className?: string;
}

export function FormRow({ children, className = '' }: FormRowProps) {
    return (
        <div className={`form-row ${className}`}>
            {children}
        </div>
    );
}
