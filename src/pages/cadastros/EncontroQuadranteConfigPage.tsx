import {
    Check,
    Copy,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    FileText,
    QrCode,
    RefreshCw,
    Shield
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { supabase } from '../../lib/supabase';
import { encontroService } from '../../services/encontroService';
import { quadrantePdfService } from '../../services/quadrantePdfService';
import { quadranteService } from '../../services/quadranteService';
import type { Encontro } from '../../types/encontro';

export function EncontroQuadranteConfigPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [encontro, setEncontro] = useState<Encontro | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    // Form states
    const [ativo, setAtivo] = useState(false);
    const [pin, setPin] = useState('');

    useEffect(() => {
        async function loadEncontro() {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('encontros')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (data) {
                    setEncontro(data);
                    setAtivo(data.quadrante_ativo || false);
                    setPin(data.quadrante_pin || '');
                }
            } catch (error) {
                console.error('Erro ao buscar encontro:', error);
                toast.error('Não foi possível carregar os dados do encontro.');
            } finally {
                setLoading(false);
            }
        }

        loadEncontro();
    }, [id]);

    const handleSave = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await encontroService.configurarQuadrante(id, {
                ativo,
                pin: pin || null
            });
            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar configurações.');
        } finally {
            setSaving(false);
        }
    };

    const handleRotateToken = async () => {
        if (!id || !window.confirm('Tem certeza que deseja rotacionar o token? O QR Code anterior deixará de funcionar imediatamente.')) return;

        try {
            const novoToken = await encontroService.rotacionarTokenQuadrante(id);
            if (encontro) {
                setEncontro({ ...encontro, quadrante_token: novoToken });
            }
            toast.success('Token rotacionado com sucesso!');
        } catch (error) {
            console.error('Erro ao rotacionar:', error);
            toast.error('Erro ao rotacionar token.');
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExportPDF = async () => {
        if (!encontro?.quadrante_token) return;
        setExporting(true);
        const loadingToast = toast.loading('Gerando quadrante PDF...');

        try {
            // Obter os dados completos do quadrante via service
            const data = await quadranteService.obterDados(encontro.quadrante_token);

            await quadrantePdfService.generateYearbook(
                { id: id!, nome: encontro.nome, tema: encontro.tema },
                data
            );
            toast.success('Quadrante PDF gerado com sucesso!', { id: loadingToast });
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast.error('Erro ao gerar o PDF. Verifique se o quadrante está ativo.', { id: loadingToast });
        } finally {
            setExporting(false);
        }
    };

    const handleCopyLink = () => {
        if (!encontro?.quadrante_token) return;
        const url = `${window.location.origin}/q/${encontro.quadrante_token}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success('Link copiado para a área de transferência!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQRCode = () => {
        if (!qrRef.current) return;
        const canvas = qrRef.current.querySelector('canvas');
        if (!canvas) return;
        
        // Criar um canvas temporário maior para adicionar margens brancas
        const margin = 40; // Tamanho da margem em pixels
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        tempCanvas.width = canvas.width + (margin * 2);
        tempCanvas.height = canvas.height + (margin * 2);

        // Preencher fundo com branco
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Desenhar o QR code no centro
        tempCtx.drawImage(canvas, margin, margin);
        
        const url = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qrcode-quadrante-${encontro?.nome}.png`;
        link.href = url;
        link.click();
        toast.success('Download do QR Code iniciado com margens!');
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;
    if (!encontro) return <div className="p-8 text-center">Encontro não encontrado.</div>;

    const publicUrl = `${window.location.origin}/q/${encontro.quadrante_token}`;

    return (
        <div className="container" style={{ paddingBottom: '3rem' }}>
            <PageHeader
                title="Configuração do Quadrante"
                subtitle={`Encontro: ${encontro.nome}`}
                onBack={() => navigate('/cadastros/encontros')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Left: General Config */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'var(--primary-color)20', color: 'var(--primary-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Shield size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0 }}>Controle de Segurança</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>Proteja o acesso ao anuário e gerencie a visibilidade pública.</p>
                            </div>
                        </div>

                        <div className="access-config-grid">
                            {/* Toggle Ativo */}
                            <div className="config-item">
                                <div className="config-label-area">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <h4 style={{ margin: 0 }}>Quadrante Ativo</h4>
                                        <div className="sim-nao-toggle">
                                            <button
                                                className={`toggle-btn ${!ativo ? 'active-nao' : ''}`}
                                                onClick={() => setAtivo(false)}
                                            >
                                                Não
                                            </button>
                                            <button
                                                className={`toggle-btn ${ativo ? 'active-sim' : ''}`}
                                                onClick={() => setAtivo(true)}
                                            >
                                                Sim
                                            </button>
                                        </div>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>
                                        Exibir dados publicamente para os participantes?
                                    </p>
                                </div>
                            </div>

                            {/* PIN Section */}
                            <div className="config-item">
                                <div className="config-label-area">
                                    <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Código PIN de Acesso</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.75rem' }}>
                                        Deixe em branco para permitir acesso livre via link.
                                    </p>
                                </div>
                                <div className="pin-input-wrapper">
                                    <input
                                        type={showPin ? "text" : "password"}
                                        className="form-input"
                                        placeholder="Digite um PIN de 4 dígitos (opcional)"
                                        value={pin}
                                        onChange={e => setPin(e.target.value)}
                                        style={{
                                            letterSpacing: (showPin || !pin) ? 'normal' : '0.4em',
                                            paddingRight: '2.5rem',
                                            margin: 0,
                                            height: '42px',
                                            fontWeight: (showPin || !pin) ? 'normal' : 'bold',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPin(!showPin)}
                                        style={{
                                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5,
                                            display: 'flex', alignItems: 'center'
                                        }}
                                    >
                                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', marginTop: '1.5rem' }}>
                            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 2.5rem' }}>
                                {saving ? 'Salvando...' : <><SaveIcon size={18} /> Salvar Configurações</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Sharing / QR Code */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <QrCode size={18} /> Compartilhamento
                        </h4>

                        <div style={{ textAlign: 'center', padding: '1.5rem', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <div ref={qrRef} style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)10' }}>
                                <QRCodeCanvas 
                                    value={publicUrl}
                                    size={200}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                            <button 
                                className="action-btn" 
                                onClick={handleDownloadQRCode}
                                style={{
                                    fontSize: '0.75rem', 
                                    color: '#fff', 
                                    background: 'var(--primary-color)',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.4rem',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginTop: '0.5rem',
                                    transition: '0.2s'
                                }}
                            >
                                <Download size={14} /> Baixar QR Code
                            </button>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.75rem' }}>Token de Segurança</label>
                            <div style={{
                                padding: '0.75rem', background: 'var(--secondary-bg)', borderRadius: '8px',
                                fontSize: '0.7rem', fontFamily: 'monospace', wordBreak: 'break-all',
                                color: 'var(--primary-color)', border: '1px solid var(--border-color)'
                            }}>
                                {encontro.quadrante_token}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button className="btn-outline" onClick={handleCopyLink} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'Copiado!' : 'Copiar Link Público'}
                            </button>

                            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                                <ExternalLink size={16} /> Visualizar quadrante
                            </a>

                            <button
                                className="btn-outline"
                                onClick={handleExportPDF}
                                disabled={exporting}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    borderColor: 'var(--primary-color)', color: 'var(--primary-color)', background: 'var(--primary-color)05'
                                }}
                            >
                                <FileText size={16} /> {exporting ? 'Gerando...' : 'Exportar Quadrante (PDF)'}
                            </button>

                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                <button className="btn-danger-outline" onClick={handleRotateToken} style={{ width: '100%', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                    <RefreshCw size={14} /> Rotacionar Token de Segurança
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .access-config-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                    background: var(--secondary-bg);
                    padding: 1.5rem;
                    border-radius: 16px;
                    border: 1px solid var(--border-color);
                }

                .config-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .pin-input-wrapper {
                    position: relative;
                    width: 50%;
                }

                @media (max-width: 900px) {
                    .pin-input-wrapper {
                        width: 100%;
                    }
                }

                .sim-nao-toggle {
                    display: flex;
                    background: rgba(0,0,0,0.1);
                    padding: 3px;
                    border-radius: 8px;
                    width: fit-content;
                    border: 1px solid var(--border-color);
                    margin-left: auto;
                }

                @media (min-width: 600px) {
                    .sim-nao-toggle {
                        margin-left: 0;
                    }
                }

                .toggle-btn {
                    padding: 0.35rem 1rem;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: transparent;
                    color: var(--text-color);
                    opacity: 0.5;
                }

                .toggle-btn.active-sim {
                    background: var(--primary-color);
                    color: white;
                    opacity: 1;
                    box-shadow: 0 4px 12px var(--primary-color)40;
                }

                .toggle-btn.active-nao {
                    background: #ef4444;
                    color: white;
                    opacity: 1;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }

                .toggle-btn:hover:not(.active-sim):not(.active-nao) {
                    opacity: 0.8;
                    background: rgba(255,255,255,0.05);
                }

                .switch { position: relative; display: inline-block; width: 50px; height: 26px; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; }
                .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
                input:checked + .slider { background-color: var(--primary-color); }
                input:focus + .slider { box-shadow: 0 0 1px var(--primary-color); }
                input:checked + .slider:before { transform: translateX(24px); }
                .slider.round { border-radius: 34px; }
                .slider.round:before { border-radius: 50%; }

                .btn-danger-outline {
                    background: transparent;
                    color: #ef4444;
                    border: 1px solid #ef4444;
                    padding: 0.6rem 1rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-danger-outline:hover {
                    background: #fef2f2;
                    transform: translateY(-1px);
                }
            `}</style>
        </div>
    );
}

function SaveIcon({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
    );
}
