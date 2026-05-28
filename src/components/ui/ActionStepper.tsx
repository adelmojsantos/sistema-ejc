import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export type ActionStepStatus = 'completed' | 'current' | 'pending';

export interface ActionStep {
    id: string;
    title: string;
    summary?: ReactNode;
    status: ActionStepStatus;
    children?: ReactNode;
    onEdit?: () => void;
    editLabel?: string;
}

export interface ActionStepperProps {
    steps: ActionStep[];
    hidePending?: boolean;
    className?: string;
    orientation?: 'vertical' | 'horizontal';
}

export function ActionStepper({ steps, hidePending = false, className = '', orientation = 'vertical' }: ActionStepperProps) {
    const visibleSteps = hidePending ? steps.filter((step) => step.status !== 'pending') : steps;

    if (orientation === 'horizontal') {
        const currentStep = visibleSteps.find((step) => step.status === 'current');

        return (
            <div className={`action-stepper action-stepper--horizontal ${className}`} style={{ width: '100%' }}>
                <style>{`
                    .action-stepper__card--clickable {
                        cursor: pointer;
                    }
                    .action-stepper__card--clickable:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        border-color: rgba(16, 185, 129, 0.8) !important;
                    }
                `}</style>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '0.75rem',
                        marginBottom: '1.25rem',
                    }}
                >
                    {visibleSteps.map((step, index) => {
                        const isCompleted = step.status === 'completed';
                        const isCurrent = step.status === 'current';
                        const isClickable = isCompleted && !!step.onEdit;

                        let border = 'color-mix(in srgb, var(--muted-text) 38%, var(--border-color))';
                        let background = 'color-mix(in srgb, var(--surface-1) 82%, var(--muted-text) 18%)';
                        let color = 'var(--muted-text)';

                        if (isCompleted) {
                            border = 'rgba(16, 185, 129, 0.55)';
                            background = 'rgba(16, 185, 129, 0.10)';
                            color = '#047857';
                        } else if (isCurrent) {
                            border = 'rgba(37, 99, 235, 0.60)';
                            background = 'rgba(37, 99, 235, 0.10)';
                            color = 'var(--primary-color)';
                        }

                        return (
                            <div
                                key={step.id}
                                onClick={isClickable ? step.onEdit : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.75rem',
                                    padding: '0.85rem',
                                    border: `1px solid ${border}`,
                                    borderRadius: '10px',
                                    background,
                                    boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none',
                                    transition: 'all 0.2s ease',
                                }}
                                className={isClickable ? 'action-stepper__card--clickable' : ''}
                            >
                                <span
                                    className="action-stepper__indicator"
                                    aria-hidden="true"
                                    style={{
                                        width: '1.75rem',
                                        height: '1.75rem',
                                        borderRadius: '999px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        border: `1px solid ${border}`,
                                        background: isCompleted ? '#10b981' : 'transparent',
                                        color: isCompleted ? '#fff' : color,
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                    }}
                                >
                                    {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
                                </span>
                                <div className="action-stepper__content" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                    <strong style={{ display: 'block', fontSize: '0.85rem', color: isCurrent ? 'var(--text-color)' : color }}>
                                        {step.title}
                                    </strong>
                                    {step.summary && (
                                        <div
                                            style={{
                                                margin: '0.25rem 0 0',
                                                fontSize: '0.75rem',
                                                color: 'var(--muted-text)',
                                                lineHeight: 1.35,
                                            }}
                                        >
                                            {step.summary}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {currentStep && currentStep.children && (
                    <div className="action-stepper__horizontal-content" style={{ border: 'none', padding: 0, background: 'transparent' }}>
                        {currentStep.children}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`action-stepper ${className}`}>
            {visibleSteps.map((step, index) => {
                const isCompleted = step.status === 'completed';
                const isCurrent = step.status === 'current';
                const hasNext = index < visibleSteps.length - 1;

                return (
                    <section
                        key={step.id}
                        className={`action-stepper__item action-stepper__item--${step.status}`}
                    >
                        {hasNext && <span className="action-stepper__connector" aria-hidden="true" />}
                        <div className="action-stepper__marker" aria-hidden="true">
                            {isCompleted ? <Check size={15} strokeWidth={3} /> : index + 1}
                        </div>

                        <div className="action-stepper__body">
                            <div className="action-stepper__header">
                                <div>
                                    <h3 className="action-stepper__title">{step.title}</h3>
                                    {step.summary && (
                                        <div className="action-stepper__summary">
                                            {step.summary}
                                        </div>
                                    )}
                                </div>
                                {isCompleted && step.onEdit && (
                                    <button
                                        type="button"
                                        className="btn-secondary action-stepper__edit"
                                        onClick={step.onEdit}
                                    >
                                        {step.editLabel || 'Editar'}
                                    </button>
                                )}
                            </div>

                            {isCurrent && step.children && (
                                <div className="action-stepper__content">
                                    {step.children}
                                </div>
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
