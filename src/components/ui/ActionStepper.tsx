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
}

export function ActionStepper({ steps, hidePending = false, className = '' }: ActionStepperProps) {
    const visibleSteps = hidePending ? steps.filter((step) => step.status !== 'pending') : steps;

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
