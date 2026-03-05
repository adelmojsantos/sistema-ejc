import type { ReactNode } from 'react';

interface FormSectionProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
    columns?: 0 | 1 | 2;
}

export function FormSection({ title, icon, children, columns = 1 }: FormSectionProps) {
    const layoutClass = columns === 0 ? 'form-section-body--stack' : columns === 2 ? 'form-section-body--two' : 'form-section-body--one';

    return (
        <section className="form-section">
            <div className="form-section-header">
                {icon && <span className="form-section-icon">{icon}</span>}
                <h3 className="form-section-title">{title}</h3>
            </div>
            <div className={`form-section-body ${layoutClass}`}>
                {children}
            </div>
        </section>
    );
}
