import type { ReactNode } from 'react';

interface FormSectionProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
    columns?: 0 | 1 | 2;
}

export function FormSection({ title, icon, children, columns = 1 }: FormSectionProps) {
    return (
        <section className="form-section">
            <div className="form-section-header">
                {icon && <span className="form-section-icon">{icon}</span>}
                <h3 className="form-section-title">{title}</h3>
            </div>
            <div
                className="form-section-body"
                style={{
                    display: columns === 0 ? 'block' : 'grid',
                    gridTemplateColumns: columns === 2 ? 'repeat(auto-fit, minmax(220px, 1fr))' : columns === 1 ? '1fr' : 'none',
                    gap: columns === 0 ? '0' : '0 1.5rem',
                }}
            >
                {children}
            </div>
        </section>
    );
}
