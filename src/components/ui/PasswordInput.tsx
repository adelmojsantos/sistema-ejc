import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  className?: string;
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  minLength,
  required,
  className = 'form-input',
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        style={{ paddingRight: '3rem' }}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
