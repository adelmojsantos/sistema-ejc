import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';

export type StepperStepStatus = 'pending' | 'current' | 'completed';

export interface StepperStep {
    id: string;
    label: string;
    description?: string;
    completed?: boolean;
    status?: StepperStepStatus;
}

export interface StepperProps {
    steps: StepperStep[];
    className?: string;
    style?: CSSProperties;
    variant?: 'cards' | 'trail';
}

function getStepState(step: StepperStep) {
    const isCompleted = step.completed || step.status === 'completed';
    const isCurrent = step.status === 'current';

    if (isCompleted) {
        return {
            isCompleted,
            isCurrent,
            border: 'rgba(16, 185, 129, 0.55)',
            background: 'rgba(16, 185, 129, 0.10)',
            color: '#047857',
            label: 'Executado',
        };
    }

    if (isCurrent) {
        return {
            isCompleted,
            isCurrent,
            border: 'rgba(37, 99, 235, 0.60)',
            background: 'rgba(37, 99, 235, 0.10)',
            color: 'var(--primary-color)',
            label: 'Em execução',
        };
    }

    return {
        isCompleted,
        isCurrent,
        border: 'color-mix(in srgb, var(--muted-text) 38%, var(--border-color))',
        background: 'color-mix(in srgb, var(--surface-1) 82%, var(--muted-text) 18%)',
        color: 'var(--muted-text)',
        label: 'A executar',
    };
}

export function Stepper({ steps, className = '', style, variant = 'cards' }: StepperProps) {
    if (variant === 'trail') {
        return (
            <div
                className={`stepper stepper--trail ${className}`}
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '0.75rem',
                    ...style,
                }}
            >
                {steps.map((step, index) => {
                    const state = getStepState(step);
                    const hasNext = index < steps.length - 1;

                    return (
                        <div
                            key={step.id}
                            className="stepper__trail-item"
                            style={{
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '0.5rem',
                                minWidth: 0,
                                padding: '0 0.5rem 0.25rem 0',
                            }}
                        >
                            {hasNext && (
                                <span
                                    className="stepper__trail-connector"
                                    aria-hidden="true"
                                    style={{
                                        position: 'absolute',
                                        top: '1.125rem',
                                        left: '2.25rem',
                                        right: '-0.75rem',
                                        height: 2,
                                        background: state.isCompleted ? 'rgba(16, 185, 129, 0.65)' : 'var(--border-color)',
                                    }}
                                />
                            )}
                            <span
                                className="stepper__indicator"
                                aria-hidden="true"
                                style={{
                                    position: 'relative',
                                    zIndex: 1,
                                    width: '2.25rem',
                                    height: '2.25rem',
                                    borderRadius: '999px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    border: `2px solid ${state.border}`,
                                    background: state.isCompleted ? '#10b981' : state.background,
                                    color: state.isCompleted ? '#fff' : state.color,
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    boxShadow: state.isCurrent ? '0 0 0 4px rgba(37, 99, 235, 0.10)' : 'none',
                                }}
                            >
                                {state.isCompleted ? <Check size={15} strokeWidth={3} /> : index + 1}
                            </span>
                            <div className="stepper__content" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                <strong style={{ display: 'block', fontSize: '0.85rem' }}>{step.label}</strong>
                                {step.description && (
                                    <p
                                        style={{
                                            margin: '0.25rem 0 0',
                                            fontSize: '0.75rem',
                                            color: 'var(--muted-text)',
                                            lineHeight: 1.35,
                                        }}
                                    >
                                        {step.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            className={`stepper stepper--cards ${className}`}
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                ...style,
            }}
        >
            {steps.map((step, index) => {
                const state = getStepState(step);

                return (
                    <div
                        key={step.id}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                            padding: '0.85rem',
                            border: `1px solid ${state.border}`,
                            borderRadius: '10px',
                            background: state.background,
                            boxShadow: state.isCurrent ? 'var(--shadow-sm)' : 'none',
                        }}
                    >
                        <span
                            className="stepper__indicator"
                            aria-hidden="true"
                            style={{
                                width: '1.75rem',
                                height: '1.75rem',
                                borderRadius: '999px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1px solid ${state.border}`,
                                background: state.isCompleted ? '#10b981' : 'transparent',
                                color: state.isCompleted ? '#fff' : state.color,
                                fontSize: '0.78rem',
                                fontWeight: 800,
                            }}
                        >
                            {state.isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
                        </span>
                        <div className="stepper__content" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                            <strong style={{ display: 'block', fontSize: '0.85rem' }}>{step.label}</strong>
                            {step.description && (
                                <p
                                    style={{
                                        margin: '0.25rem 0 0',
                                        fontSize: '0.75rem',
                                        color: 'var(--muted-text)',
                                        lineHeight: 1.35,
                                    }}
                                >
                                    {step.description}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
