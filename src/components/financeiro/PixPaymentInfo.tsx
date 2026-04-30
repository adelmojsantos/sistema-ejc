import { useState } from 'react';
import { Copy, Check, Download, Share2, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PixPaymentInfoProps {
    chave: string | null | undefined;
    tipo: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null | undefined;
    qrCodeUrl: string | null | undefined;
}

export function PixPaymentInfo({ chave, tipo, qrCodeUrl }: PixPaymentInfoProps) {
    const [copied, setCopied] = useState(false);

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
            const fullUrl = qrCodeUrl.startsWith('http') ? qrCodeUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/equipe_confirmacoes/${qrCodeUrl}`;
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
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                        }}>
                            <img
                                src={qrCodeUrl.startsWith('http') ? qrCodeUrl : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/equipe_confirmacoes/${qrCodeUrl}`}
                                alt="QR Code PIX"
                                style={{ width: '160px', height: '160px', objectFit: 'contain' }}
                            />
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
