interface SkeletonLibraryProps {
    viewMode: 'grid' | 'list';
}

export function SkeletonLibrary({ viewMode }: SkeletonLibraryProps) {
    if (viewMode === 'list') {
        return (
            <div className="skeleton-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', padding: '1rem',
                        borderBottom: '1px solid var(--border-color)', gap: '1rem'
                    }}>
                        <div className="skeleton pulse" style={{ width: '20px', height: '20px', borderRadius: '4px' }}></div>
                        <div className="skeleton pulse" style={{ width: '32px', height: '32px', borderRadius: '8px' }}></div>
                        <div className="skeleton pulse" style={{ flex: 1, height: '20px', borderRadius: '4px' }}></div>
                        <div className="skeleton pulse" style={{ width: '100px', height: '20px', borderRadius: '4px' }}></div>
                        <div className="skeleton pulse" style={{ width: '120px', height: '20px', borderRadius: '4px' }}></div>
                        <div className="skeleton pulse" style={{ width: '30px', height: '20px', borderRadius: '4px' }}></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="skeleton-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {[1, 2, 3, 4].map(i => (
                <div key={`folder-${i}`} style={{
                    padding: '1.25rem', border: '1px solid var(--border-color)',
                    borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem',
                    backgroundColor: 'var(--surface-1)'
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div className="skeleton pulse" style={{ width: '40px', height: '40px', borderRadius: '8px' }}></div>
                        <div style={{ flex: 1 }}>
                            <div className="skeleton pulse" style={{ width: '80%', height: '18px', borderRadius: '4px', marginBottom: '8px' }}></div>
                            <div className="skeleton pulse" style={{ width: '50%', height: '14px', borderRadius: '4px' }}></div>
                        </div>
                    </div>
                </div>
            ))}
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={`file-${i}`} style={{
                    padding: '1.25rem', border: '1px solid var(--border-color)',
                    borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '1rem',
                    backgroundColor: 'var(--surface-1)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className="skeleton pulse" style={{ width: '48px', height: '48px', borderRadius: '12px' }}></div>
                        <div className="skeleton pulse" style={{ width: '24px', height: '24px', borderRadius: '50%' }}></div>
                    </div>
                    <div>
                        <div className="skeleton pulse" style={{ width: '90%', height: '16px', borderRadius: '4px', marginBottom: '8px' }}></div>
                        <div className="skeleton pulse" style={{ width: '60%', height: '12px', borderRadius: '4px' }}></div>
                    </div>
                </div>
            ))}
            <style>{`
                .skeleton {
                    background: linear-gradient(90deg, var(--surface-2) 25%, var(--border-color) 50%, var(--surface-2) 75%);
                    background-size: 200% 100%;
                }
                .pulse {
                    animation: skeleton-loading 1.5s infinite ease-in-out;
                }
                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
}
