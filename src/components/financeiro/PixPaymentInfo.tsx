import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Check, Download, Share2, QrCode, FileText, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PixPaymentInfoProps {
    chave: string | null | undefined;
    tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null | undefined;
    qrCodeUrl: string | null | undefined;
    variant?: 'default' | 'compact';
}

export function PixPaymentInfo({ chave, tipo, qrCodeUrl, variant = 'default' }: PixPaymentInfoProps) {
    const [copied, setCopied] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);

    if (!chave) return null;

    const maskChave = (val: string, type: string | null | undefined) => {
        if (!val) return '';
        switch (type) {
            case 'cpf':
                return val.replace(/(\d{3})\d{6}(\d{2})/, '$1.***.***-$2');
            case 'cnpj':
                return val.replace(/(\d{2})\d{8}(\d{4})/, '$1.***.***/$2-**');
            case 'email':
                const [user, domain] = val.split('@');
                return `${user[0]}***@${domain}`;
            case 'telefone':
                return val.replace(/(\d{2})(\d{2})\d{5}(\d{2})/, '+$1 ($2) *****-**$3');
            default:
                return val.slice(0, 8) + '...';
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(chave);
        setCopied(true);
        toast.success('Chave PIX copiada!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQr = async () => {
        if (!qrCodeUrl) return;
        try {
            const fullUrl = qrCodeUrl.startsWith('http') ? qrCodeUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${qrCodeUrl}`;
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pix_qrcode_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            toast.error('Erro ao baixar QR Code');
        }
    };

    const handleCopyLink = () => {
        if (!qrCodeUrl) return;
        const fullUrl = qrCodeUrl.startsWith('http') ? qrCodeUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${qrCodeUrl}`;
        navigator.clipboard.writeText(fullUrl);
        toast.success('Link do arquivo copiado!');
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Chave PIX para Pagamento',
                    text: `Chave PIX: ${chave}`,
                    url: window.location.href
                });
            } catch (err) {
                // Share cancelled or failed
            }
        } else {
            handleCopy();
        }
    };

    if (variant === 'compact') {
        const fullQrUrl = qrCodeUrl?.startsWith('http') ? qrCodeUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${qrCodeUrl}`;

        return (
            <div style={{
                backgroundColor: 'var(--surface-3)',
                borderRadius: '12px',
                padding: '0.6rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                border: '1px solid var(--border-color)',
                width: '100%'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--primary-color)', flexShrink: 0, position: 'relative' }} title="Dados para Pagamento PIX">
                        <QrCode size={18} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1, letterSpacing: '0.02em' }}>
                                PAGAMENTO {tipo || 'PIX'}
                            </span>
                            <div title="Clique nos ícones ao lado para copiar a chave ou abrir o QR Code/PDF" style={{ display: 'flex', opacity: 0.4 }}>
                                <Info size={10} />
                            </div>
                        </div>
                        <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {maskChave(chave, tipo)}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                        onClick={handleCopy}
                        className="mini-link-btn"
                        style={{ width: '28px', height: '28px', color: copied ? '#10b981' : 'inherit' }}
                        title="Copiar Chave"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>

                    {qrCodeUrl && (
                        <button
                            onClick={() => setShowQrModal(true)}
                            className="mini-link-btn"
                            style={{ width: '28px', height: '28px' }}
                            title="Ver QR Code"
                        >
                            <QrCode size={14} />
                        </button>
                    )}
                </div>

                {/* Modal Simplificado de QR Code */}
                {showQrModal && createPortal(
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1rem', backdropFilter: 'blur(4px)'
                    }} onClick={() => setShowQrModal(false)}>
                        <div style={{
                            backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
                            maxWidth: '95vw', width: '340px', position: 'relative',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }} onClick={e => e.stopPropagation()}>
                            {qrCodeUrl?.toLowerCase().endsWith('.pdf') ? (
                                <div style={{
                                    width: '240px', height: '240px', background: '#f8fafc',
                                    borderRadius: '12px', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: '1rem'
                                }}>
                                    <FileText size={80} color="#ef4444" />
                                    <span style={{ fontWeight: 700, color: '#475569' }}>Documento PDF</span>
                                </div>
                            ) : (
                                <img src={fullQrUrl} alt="QR Code" style={{ width: '240px', height: '240px', objectFit: 'contain' }} />
                            )}
                            <div style={{ display: 'flex', gap: '0.4rem', width: '100%' }}>
                                <button onClick={handleDownloadQr} className="btn-primary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.6rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Download size={14} style={{ marginRight: '0.2rem' }} /> Baixar
                                </button>
                                <button onClick={handleCopyLink} className="btn-secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.6rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Copy size={14} style={{ marginRight: '0.2rem' }} /> Link
                                </button>
                                <button onClick={() => setShowQrModal(false)} className="btn-secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.6rem 0.4rem', background: '#334155', color: 'white', border: 'none' }}>
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: 'var(--surface-2)',
            borderRadius: '16px',
            border: '1px solid var(--primary-color)',
            padding: '1.5rem',
            marginTop: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    backgroundColor: 'var(--primary-color)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <QrCode size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Pagamento via PIX</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: window.innerWidth < 640 ? 'column' : 'row', gap: '1.5rem' }}>
                {qrCodeUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            width: '160px', height: '160px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {qrCodeUrl.toLowerCase().endsWith('.pdf') ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={48} color="#ef4444" />
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>PDF</span>
                                </div>
                            ) : (
                                <img
                                    src={qrCodeUrl.startsWith('http') ? qrCodeUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/financeiro/${qrCodeUrl}`}
                                    alt="QR Code PIX"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={handleDownloadQr} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                                <Download size={14} style={{ marginRight: '0.4rem' }} /> Baixar
                            </button>
                            <button onClick={handleShare} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                                <Share2 size={14} style={{ marginRight: '0.4rem' }} /> Compartilhar
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 600, textTransform: 'uppercase' }}>
                            Chave PIX ({tipo?.toUpperCase() || 'CHAVE'})
                        </span>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: 'var(--surface-1)',
                            padding: '0.75rem 1rem',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            fontFamily: 'monospace',
                            fontSize: '1rem'
                        }}>
                            <span style={{ fontWeight: 600 }}>{maskChave(chave, tipo)}</span>
                            <button
                                onClick={handleCopy}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: copied ? '#10b981' : 'var(--primary-color)',
                                    display: 'flex', alignItems: 'center'
                                }}
                                title="Copiar Chave Completa"
                            >
                                {copied ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>
                        Realize o pagamento e anexe o comprovante abaixo para validação da coordenação.
                    </p>
                </div>
            </div>
        </div>
    );
}

const styles = `
    .mini-link-btn { 
        display: flex !important; 
        align-items: center !important; 
        justify-content: center !important; 
        border-radius: 8px; 
        background: rgba(255,255,255,0.05); 
        border: 1px solid rgba(255,255,255,0.1); 
        cursor: pointer; 
        transition: all 0.2s; 
        padding: 0 !important;
        margin: 0;
        flex-shrink: 0;
    }
    .mini-link-btn:hover {
        background: rgba(255,255,255,0.1);
        transform: translateY(-1px);
    }
`;

// Injetar estilos se não existirem
if (typeof document !== 'undefined' && !document.getElementById('pix-payment-info-styles')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'pix-payment-info-styles';
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}
