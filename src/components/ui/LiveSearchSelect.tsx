import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { debounce } from 'lodash';

export interface LiveSearchSelectProps<T> {
    value: string;
    onChange: (value: string, item: T | null) => void;
    fetchData: (search: string, page: number) => Promise<T[]>;
    getOptionLabel: (item: T) => string;
    getOptionValue: (item: T) => string;
    renderOption?: (item: T) => React.ReactNode;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    pageSize?: number;
    initialOptions?: T[]; // Useful for passing previously loaded data or the currently selected item
}

export function LiveSearchSelect<T>({
    value,
    onChange,
    fetchData,
    getOptionLabel,
    getOptionValue,
    renderOption,
    placeholder = 'Selecione...',
    disabled = false,
    className = '',
    pageSize = 5,
    initialOptions = []
}: LiveSearchSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [options, setOptions] = useState<T[]>(initialOptions);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const observer = useRef<IntersectionObserver | null>(null);
    const lastOptionElementRef = useCallback((node: HTMLDivElement | null) => {
        if (observer.current) observer.current.disconnect();
        if (loading) return;

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    const loadOptions = async (query: string, pageNum: number, isNewSearch: boolean) => {
        try {
            setLoading(true);
            const data = await fetchData(query, pageNum);

            if (isNewSearch) {
                setOptions(data);
            } else {
                setOptions(prev => [...prev, ...data]);
            }

            setHasMore(data.length === pageSize);
        } catch (error) {
            console.error('Error fetching options:', error);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    const debouncedLoadOptions = useCallback(
        debounce((query: string) => {
            setPage(0);
            loadOptions(query, 0, true);
        }, 300),
        [fetchData] // React hook dependency
    );

    useEffect(() => {
        if (isOpen) {
            if (page === 0 && options.length === 0 && !searchTerm) {
                // initial load when opened if empty
                loadOptions('', 0, true);
            } else if (page > 0) {
                // load more on pagination
                loadOptions(searchTerm, page, false);
            }
        }
    }, [isOpen, page]); // Intentionally omitting others to avoid loops

    useEffect(() => {
        if (isOpen) {
            debouncedLoadOptions(searchTerm);
        }
        return () => debouncedLoadOptions.cancel();
    }, [searchTerm, debouncedLoadOptions, isOpen]);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            debouncedLoadOptions.cancel();
        };
    }, [debouncedLoadOptions]);

    const selectedItem = options.find(opt => getOptionValue(opt) === value) || initialOptions.find(opt => getOptionValue(opt) === value);
    const displayValue = selectedItem ? getOptionLabel(selectedItem) : '';

    return (
        <div className="live-search-select" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            {/* Input field masquerading as select */}
            <div
                className={`form-input ${className}`}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: disabled ? 'var(--secondary-bg)' : 'var(--input-bg)',
                    padding: '0.5rem 0.75rem',
                    minHeight: '40px'
                }}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: displayValue ? 'var(--text-color)' : 'var(--muted-text)' }}>
                    {displayValue || placeholder}
                </div>
                <ChevronDown size={16} color="var(--muted-text)" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    maxHeight: '260px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-1)' }}>
                        <div className="form-input-wrapper" style={{ margin: 0 }}>
                            <div className="form-input-icon">
                                <Search size={14} />
                            </div>
                            <input
                                type="text"
                                className="form-input form-input--with-icon"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value);
                                }}
                                onClick={e => e.stopPropagation()}
                                autoFocus
                                style={{ padding: '0.4rem 0.4rem 0.4rem 2rem', fontSize: '0.9rem', width: '100%' }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0' }}>
                        {options.map((option, index) => {
                            const optValue = getOptionValue(option);
                            const isSelected = optValue === value;
                            const isLast = index === options.length - 1;

                            return (
                                <div
                                    key={`${optValue}-${index}`}
                                    ref={isLast ? lastOptionElementRef : null}
                                    onClick={() => {
                                        onChange(optValue, option);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className="live-search-option"
                                    style={{
                                        padding: '0.6rem 1rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{ flex: 1, minWidth: 0, color: isSelected ? 'var(--primary-color)' : 'var(--text-color)', fontWeight: isSelected ? 600 : 'normal' }}>
                                        {renderOption ? renderOption(option) : getOptionLabel(option)}
                                    </div>
                                    {isSelected && <Check size={16} color="var(--primary-color)" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />}
                                </div>
                            );
                        })}

                        {loading && (
                            <div style={{ padding: '0.75rem 1rem', color: 'var(--muted-text)', fontSize: '0.85rem', textAlign: 'center' }}>
                                Carregando...
                            </div>
                        )}

                        {!loading && options.length === 0 && (
                            <div style={{ padding: '0.75rem 1rem', color: 'var(--muted-text)', fontSize: '0.85rem', textAlign: 'center' }}>
                                Nenhuma opção encontrada.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
