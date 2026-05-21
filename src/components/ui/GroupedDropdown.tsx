import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export type GroupedDropdownOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

export type GroupedDropdownGroup<TValue extends string = string> = {
  label: string;
  defaultOpen?: boolean;
  options: GroupedDropdownOption<TValue>[];
};

export type GroupedDropdownItem<TValue extends string = string> =
  | GroupedDropdownOption<TValue>
  | GroupedDropdownGroup<TValue>;

interface GroupedDropdownProps<TValue extends string = string> {
  value: TValue;
  onChange: (value: TValue) => void;
  items: GroupedDropdownItem<TValue>[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

function isGroup<TValue extends string>(item: GroupedDropdownItem<TValue>): item is GroupedDropdownGroup<TValue> {
  return 'options' in item;
}

export function GroupedDropdown<TValue extends string = string>({
  value,
  onChange,
  items,
  placeholder = 'Selecionar...',
  disabled = false,
  ariaLabel,
  className
}: GroupedDropdownProps<TValue>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    items.forEach(item => {
      if (isGroup(item)) initial[item.label] = item.defaultOpen ?? true;
    });
    return initial;
  });

  const flatOptions = useMemo(() => {
    return items.flatMap(item => isGroup(item) ? item.options : [item]);
  }, [items]);

  const selectedOption = flatOptions.find(option => option.value === value);

  const updateMenuPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    const availableHeight = Math.max(160, window.innerHeight - rect.bottom - 12);
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(320, availableHeight)
    });
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleSelect = (option: GroupedDropdownOption<TValue>) => {
    if (option.disabled) return;

    onChange(option.value);
    setIsOpen(false);
  };

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !(prev[label] ?? true) }));
  };

  return (
    <div ref={rootRef} className={`grouped-dropdown ${className || ''}`}>
      <button
        type="button"
        className="form-input grouped-dropdown-trigger"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={16} className={isOpen ? 'grouped-dropdown-chevron open' : 'grouped-dropdown-chevron'} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          id={`${id}-listbox`}
          className="grouped-dropdown-menu"
          role="listbox"
          style={menuStyle}
        >
          {items.map(item => {
            if (!isGroup(item)) {
              const isSelected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`grouped-dropdown-option${isSelected ? ' selected' : ''}`}
                  onClick={() => handleSelect(item)}
                  disabled={item.disabled}
                >
                  <span>{item.label}</span>
                  {isSelected && <Check size={15} />}
                </button>
              );
            }

            const isGroupOpen = openGroups[item.label] ?? true;
            return (
              <div key={item.label} className="grouped-dropdown-group">
                <button
                  type="button"
                  className="grouped-dropdown-group-toggle"
                  onClick={() => toggleGroup(item.label)}
                  aria-expanded={isGroupOpen}
                >
                  {isGroupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{item.label}</span>
                </button>

                {isGroupOpen && (
                  <div className="grouped-dropdown-group-options">
                    {item.options.map(option => {
                      const isSelected = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`grouped-dropdown-option grouped-dropdown-option-nested${isSelected ? ' selected' : ''}`}
                          onClick={() => handleSelect(option)}
                          disabled={option.disabled}
                        >
                          <span>{option.label}</span>
                          {isSelected && <Check size={15} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>,
        document.body
      )}

      <style>{`
        .grouped-dropdown {
          position: relative;
          width: 100%;
        }
        .grouped-dropdown-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          text-align: left;
          cursor: pointer;
        }
        .grouped-dropdown-trigger:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }
        .grouped-dropdown-trigger span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .grouped-dropdown-chevron {
          flex-shrink: 0;
          transition: transform 0.18s ease;
        }
        .grouped-dropdown-chevron.open {
          transform: rotate(180deg);
        }
        .grouped-dropdown-menu {
          z-index: 4000;
          overflow: auto;
          padding: 0.35rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--card-bg);
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.16);
        }
        .grouped-dropdown-option,
        .grouped-dropdown-group-toggle {
          width: 100%;
          border: none;
          background: transparent;
          color: var(--text-color);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
        }
        .grouped-dropdown-option {
          justify-content: space-between;
          padding: 0.55rem 0.65rem;
          font-size: 0.86rem;
          font-weight: 650;
        }
        .grouped-dropdown-option-nested {
          padding-left: 1.6rem;
          font-weight: 600;
        }
        .grouped-dropdown-option:hover,
        .grouped-dropdown-group-toggle:hover {
          background: var(--secondary-bg);
        }
        .grouped-dropdown-option.selected {
          background: rgba(var(--primary-rgb), 0.1);
          color: var(--primary-color);
        }
        .grouped-dropdown-option:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .grouped-dropdown-group {
          display: flex;
          flex-direction: column;
        }
        .grouped-dropdown-group-toggle {
          padding: 0.5rem 0.55rem;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          opacity: 0.65;
        }
        .grouped-dropdown-group-options {
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </div>
  );
}
