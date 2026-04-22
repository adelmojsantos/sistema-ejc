interface RadioOption {
    label: string;
    value: string | boolean;
}

interface RadioGroupProps {
    label?: string;
    options: RadioOption[];
    value: string | boolean | null;
    onChange: (value: string | boolean) => void;
    name?: string;
    error?: string;
}

export function RadioGroup({ label, options, value, onChange, error }: RadioGroupProps) {
    return (
        <div className="radio-group-container">
            {label && <label className="radio-group-label">{label}</label>}
            
            <div className="radio-group-options">
                {options.map((option) => {
                    const isSelected = option.value === value;
                    return (
                        <div
                            key={String(option.value)}
                            className={`radio-option ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => onChange(option.value)}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onChange(option.value);
                                }
                            }}
                        >
                            <div className="radio-indicator">
                                <div className="radio-indicator-dot" />
                            </div>
                            <span className="radio-option-label">{option.label}</span>
                        </div>
                    );
                })}
            </div>
            
            {error && <span className="error-message">{error}</span>}
        </div>
    );
}
