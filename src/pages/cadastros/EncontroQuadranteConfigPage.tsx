import {
    Check,
    Copy,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    FileText,
    Image as ImageIcon,
    QrCode,
    RefreshCw,
    Shield,
    Type,
    Upload,
    X
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { encontroService } from '../../services/encontroService';
import { palestraService } from '../../services/palestraService';
import { quadrantePdfService } from '../../services/quadrantePdfService';
import { quadranteService } from '../../services/quadranteService';
import { quadranteVisibilityDefault, type Encontro, type QuadranteVisibilityConfig } from '../../types/encontro';

const visibilityOptions: { key: keyof QuadranteVisibilityConfig; label: string; description: string }[] = [
    { key: 'simbologia', label: 'Simbologia', description: 'Texto institucional e símbolo do EJC.' },
    { key: 'tematica', label: 'Temática', description: 'Logo e referências do tema do encontro.' },
    { key: 'musica', label: 'Música Tema', description: 'Letra e links de música/vídeo.' },
    { key: 'encontristas', label: 'Encontristas', description: 'Cards dos participantes por círculo.' },
    { key: 'encontreiros', label: 'Encontreiros', description: 'Composição das equipes de trabalho.' },
    { key: 'palestras', label: 'Palestras', description: 'Lista de palestras e resumos.' },
];

export function EncontroQuadranteConfigPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [encontro, setEncontro] = useState<Encontro | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [activeTab, setActiveTab] = useState<'acesso' | 'conteudo'>('acesso');
    const qrRef = useRef<HTMLDivElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Form states - Acesso
    const [ativo, setAtivo] = useState(false);
    const [pin, setPin] = useState('');

    // Form states - Editorial
    const [logoUrl, setLogoUrl] = useState('');
    const [simbologiaTexto, setSimbologiaTexto] = useState('');
    const [tematicaTexto, setTematicaTexto] = useState('');
    const [musicaLetra, setMusicaLetra] = useState('');
    const [visibilityConfig, setVisibilityConfig] = useState<QuadranteVisibilityConfig>(quadranteVisibilityDefault);
    const [uploadingLogo, setUploadingLogo] = useState(false);


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
                    setLogoUrl(data.logo_url || '');
                    setSimbologiaTexto(data.simbologia_texto || '');
                    setTematicaTexto(data.tematica_texto || '');
                    setMusicaLetra(data.musica_letra || '');
                    setVisibilityConfig({
                        ...quadranteVisibilityDefault,
                        ...(data.quadrante_visibilidade || {})
                    });
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

    const handleSaveAcesso = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await encontroService.configurarQuadrante(id, {
                ativo,
                pin: pin || null
            });
            toast.success('Configurações de acesso salvas!');
        } catch (error) {
            console.error('Erro ao salvar acesso:', error);
            toast.error('Erro ao salvar configurações de acesso.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEditorial = async () => {
        if (!id) return;
        setSaving(true);
        try {
            await encontroService.salvarDadosEditoriais(id, {
                logo_url: logoUrl || null,
                simbologia_texto: simbologiaTexto || null,
                tematica_texto: tematicaTexto || null,
                musica_letra: musicaLetra || null,
                quadrante_visibilidade: visibilityConfig
            });
            setEncontro(prev => prev ? {
                ...prev,
                logo_url: logoUrl || null,
                simbologia_texto: simbologiaTexto || null,
                tematica_texto: tematicaTexto || null,
                musica_letra: musicaLetra || null,
                quadrante_visibilidade: visibilityConfig
            } : prev);
            toast.success('Conteúdo do Quadrante atualizado!');
        } catch (error) {
            console.error('Erro ao salvar editorial:', error);
            toast.error('Erro ao salvar conteúdo editorial.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (file?: File) => {
        if (!id || !file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Selecione um arquivo de imagem.');
            return;
        }

        setUploadingLogo(true);
        try {
            const url = await encontroService.uploadLogoQuadrante(id, file);
            setLogoUrl(url);
            toast.success('Logo enviada com sucesso.');
        } catch (error) {
            console.error('Erro ao enviar logo:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao enviar a logo.');
        } finally {
            setUploadingLogo(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const updateVisibility = (key: keyof QuadranteVisibilityConfig, value: boolean) => {
        setVisibilityConfig(prev => ({ ...prev, [key]: value }));
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
            // ignorarAtivo=true pois admin pode gerar PDF mesmo antes de publicar
            const [data, palestras] = await Promise.all([
                quadranteService.obterDados(encontro.quadrante_token, true),
                palestraService.listarPorEncontro(id!)
            ]);

            await quadrantePdfService.generateYearbook(
                {
                    id: id!,
                    nome: encontro.nome,
                    tema: encontro.tema,
                    logo_url: logoUrl || null,
                    simbologia_texto: simbologiaTexto || null,
                    tematica_texto: tematicaTexto || null,
                    musica_letra: musicaLetra || null,
                    quadrante_visibilidade: visibilityConfig
                },
                data,
                palestras
            );
            toast.success('Quadrante PDF gerado com sucesso!', { id: loadingToast });
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast.error('Erro ao gerar o PDF do Quadrante.', { id: loadingToast });
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

        // Desenhar the QR code no centro
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
                actions={
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        letterSpacing: '0.05em',
                        background: ativo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: ativo ? '#10b981' : '#ef4444',
                        border: `1px solid ${ativo ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block', boxShadow: ativo ? '0 0 6px currentColor' : 'none' }} />
                        {ativo ? 'PUBLICADO' : 'NÃO PUBLICADO'}
                    </span>
                }
            />

            {/* Abas de Navegação */}
            <div className="tabs-container">
                <button
                    className={`tab-link ${activeTab === 'acesso' ? 'active' : ''}`}
                    onClick={() => setActiveTab('acesso')}
                >
                    <Shield size={18} /> 1. Acesso & Segurança
                </button>
                <button
                    className={`tab-link ${activeTab === 'conteudo' ? 'active' : ''}`}
                    onClick={() => setActiveTab('conteudo')}
                >
                    <Type size={18} /> 2. Conteúdo Visual
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* Coluna Principal: Conteúdo das Abas */}
                <div className="lg:col-span-2 flex flex-col gap-6">

                    {/* ABA 1: ACESSO & SEGURANÇA */}
                    {activeTab === 'acesso' && (
                        <div className="card" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                <div className="icon-badge">
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>Controle de Segurança</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>Gerencie quem pode visualizar os dados do Quadrante.</p>
                                </div>
                            </div>

                            <div className="config-inner-card">
                                <div className="config-item">
                                    <div className="config-label-area">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                            <h4 style={{ margin: 0 }}>Status do Quadrante</h4>
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
                                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                                            Exibir dados publicamente para os participantes?
                                        </p>
                                    </div>
                                </div>

                                <div className="config-item config-item-pin">
                                    <div>
                                        <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Código PIN de Acesso</h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>
                                            Deixe em branco para acesso livre. Se preenchido, será solicitado no primeiro acesso.
                                        </p>
                                    </div>
                                    <div className="pin-input-wrapper">
                                        <input
                                            type={showPin ? "text" : "password"}
                                            className="form-input pin-input"
                                            placeholder="1234"
                                            value={pin}
                                            onChange={e => setPin(e.target.value)}
                                            maxLength={6}
                                            inputMode="numeric"
                                            style={{ letterSpacing: (showPin || !pin) ? 'normal' : '0.35em' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPin(!showPin)}
                                            className="pin-toggle-btn"
                                            title={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                                        >
                                            {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="card-footer-actions">
                                <button className="btn-primary" onClick={handleSaveAcesso} disabled={saving}>
                                    {saving ? 'Salvando...' : <><RefreshCw size={18} /> Atualizar Acesso</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ABA 2: CONTEÚDO VISUAL */}
                    {activeTab === 'conteudo' && (
                        <div className="quadrante-config-stack">
                            <section className="card config-section-card">
                                <div className="section-title-row">
                                    <div className="icon-badge pink">
                                        <ImageIcon size={24} />
                                    </div>
                                    <div>
                                        <h3>Identidade visual</h3>
                                        <p>Configure a marca usada na capa, na temática e na exportação em PDF.</p>
                                    </div>
                                </div>

                                <div className="logo-upload-panel">
                                    <div className="logo-preview-large">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt="Logo do encontro" />
                                        ) : (
                                            <div className="logo-empty-state">
                                                <ImageIcon size={34} />
                                                <span>Sem logo</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="logo-upload-actions">
                                        <input
                                            ref={logoInputRef}
                                            type="file"
                                            accept="image/*"
                                            hidden
                                            onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                                        />
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => logoInputRef.current?.click()}
                                            disabled={uploadingLogo}
                                        >
                                            <Upload size={16} /> {uploadingLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
                                        </button>
                                        {logoUrl && (
                                            <button
                                                type="button"
                                                className="btn-outline compact-danger"
                                                onClick={() => setLogoUrl('')}
                                            >
                                                <X size={16} /> Remover
                                            </button>
                                        )}
                                        <p className="field-hint">Use uma imagem quadrada ou com fundo transparente para melhor resultado.</p>
                                    </div>
                                </div>
                            </section>

                            <section className="card config-section-card">
                                <div className="section-title-row">
                                    <div className="icon-badge secondary">
                                        <Eye size={24} />
                                    </div>
                                    <div>
                                        <h3>Seções exibidas</h3>
                                        <p>Escolha quais partes entram no Quadrante público e na exportação em PDF.</p>
                                    </div>
                                </div>

                                <div className="visibility-grid">
                                    {visibilityOptions.map(option => (
                                        <div key={option.key} className="visibility-option">
                                            <div>
                                                <strong>{option.label}</strong>
                                                <span>{option.description}</span>
                                            </div>
                                            <div className="sim-nao-toggle visibility-toggle">
                                                <button
                                                    type="button"
                                                    className={`toggle-btn ${!visibilityConfig[option.key] ? 'active-nao' : ''}`}
                                                    onClick={() => updateVisibility(option.key, false)}
                                                >
                                                    Não
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`toggle-btn ${visibilityConfig[option.key] ? 'active-sim' : ''}`}
                                                    onClick={() => updateVisibility(option.key, true)}
                                                >
                                                    Sim
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="card config-section-card">
                                <div className="section-title-row">
                                    <div className="icon-badge">
                                        <Type size={24} />
                                    </div>
                                    <div>
                                        <h3>Textos editoriais</h3>
                                        <p>Use o mesmo padrão de caixa de texto do resumo das palestras.</p>
                                    </div>
                                </div>

                                <div className="editorial-fields">
                                    <div className="form-group">
                                        <label>Simbologia</label>
                                        <RichTextEditor
                                            content={simbologiaTexto}
                                            onChange={setSimbologiaTexto}
                                            disabled={saving}
                                            minHeight="180px"
                                        />
                                        <p className="field-hint">Explicação sobre a logo e os símbolos do movimento.</p>
                                    </div>

                                    <div className="form-group">
                                        <label>Temática do Encontro</label>
                                        <RichTextEditor
                                            content={tematicaTexto}
                                            onChange={setTematicaTexto}
                                            disabled={saving}
                                            minHeight="180px"
                                        />
                                        <p className="field-hint">Referências e inspirações do tema escolhido para este encontro.</p>
                                    </div>

                                    <div className="form-group">
                                        <label>Música Tema</label>
                                        <RichTextEditor
                                            content={musicaLetra}
                                            onChange={setMusicaLetra}
                                            disabled={saving}
                                            minHeight="220px"
                                        />
                                        <p className="field-hint">Links de vídeo/áudio são pegos do cadastro geral do encontro.</p>
                                    </div>
                                </div>

                                <div className="card-footer-actions">
                                    <button className="btn-primary" onClick={handleSaveEditorial} disabled={saving || uploadingLogo}>
                                        {saving ? 'Salvando...' : <><Check size={18} /> Salvar conteúdo e seções</>}
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Coluna Lateral: Compartilhamento (Visível em todas as abas) */}
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
                /* Tabs Style - Pill Pattern (Image 1) */
                .tabs-container {
                    display: inline-flex;
                    gap: 6px;
                    padding: 6px;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 14px;
                    margin-bottom: 2.5rem;
                }

                .tab-link {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 10px 24px;
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    border-radius: 10px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 0.5;
                    white-space: nowrap;
                }

                .tab-link:hover {
                    opacity: 0.8;
                    background: rgba(255, 255, 255, 0.05);
                }

                .tab-link.active {
                    background: #3b82f6;
                    color: white;
                    opacity: 1;
                    box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
                }

                .tab-link svg {
                    opacity: 0.7;
                }

                .tab-link.active svg {
                    opacity: 1;
                }

                .icon-badge {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: var(--primary-color)20;
                    color: var(--primary-color);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-badge.secondary {
                    background: #8b5cf620;
                    color: #8b5cf6;
                }

                .icon-badge.pink {
                    background: #ec489920;
                    color: #ec4899;
                }

                .quadrante-config-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .config-section-card {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .section-title-row {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .section-title-row h3 {
                    margin: 0;
                }

                .section-title-row p {
                    margin: 0.25rem 0 0;
                    font-size: 0.85rem;
                    color: var(--muted-text);
                }

                .config-item-pin {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 1.25rem;
                    margin-top: 1.5rem;
                }

                .pin-input-wrapper {
                    position: relative;
                    width: 180px;
                    flex-shrink: 0;
                }

                .pin-input {
                    height: 44px;
                    width: 100%;
                    padding-right: 44px;
                    font-weight: 700;
                    font-size: 1rem;
                    text-align: center;
                }

                .pin-toggle-btn {
                    position: absolute;
                    top: 50%;
                    right: 6px;
                    transform: translateY(-50%);
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    border: 1px solid transparent;
                    background: transparent;
                    color: var(--muted-text);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .pin-toggle-btn:hover {
                    color: var(--primary-color);
                    background: var(--surface-2);
                    border-color: var(--border-color);
                }

                .logo-upload-panel {
                    display: grid;
                    grid-template-columns: 180px minmax(0, 1fr);
                    gap: 1.25rem;
                    align-items: center;
                    padding: 1rem;
                    border: 1px dashed var(--border-color);
                    border-radius: 14px;
                    background: var(--surface-1);
                }

                .logo-preview-large {
                    width: 180px;
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 16px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-color);
                    overflow: hidden;
                }

                .logo-preview-large img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    padding: 1rem;
                }

                .logo-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--muted-text);
                    font-size: 0.85rem;
                    font-weight: 700;
                }

                .logo-upload-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .logo-upload-actions .field-hint {
                    flex-basis: 100%;
                    margin: 0.25rem 0 0;
                }

                .compact-danger {
                    color: #ef4444;
                    border-color: rgba(239, 68, 68, 0.45);
                    background: transparent;
                }

                .visibility-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 0.9rem;
                }

                .visibility-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    background: var(--surface-1);
                }

                .visibility-option strong {
                    display: block;
                    font-size: 0.9rem;
                }

                .visibility-option span {
                    display: block;
                    margin-top: 0.2rem;
                    font-size: 0.75rem;
                    color: var(--muted-text);
                    line-height: 1.35;
                }

                .visibility-toggle {
                    margin-left: 0;
                    flex-shrink: 0;
                }

                .editorial-fields {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .arrow-icon { opacity: 0.3; transition: all 0.3s; }
                .option-entry-card:hover .arrow-icon { opacity: 1; color: var(--primary-color); }

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

                @media (max-width: 760px) {
                    .config-section-card {
                        padding: 1.25rem;
                    }

                    .section-title-row {
                        align-items: flex-start;
                    }

                    .config-item-pin,
                    .logo-upload-panel,
                    .visibility-grid {
                        grid-template-columns: 1fr;
                    }

                    .pin-input-wrapper,
                    .logo-preview-large {
                        width: 100%;
                        max-width: none;
                    }

                    .visibility-option {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .visibility-toggle {
                        width: 100%;
                    }

                    .visibility-toggle .toggle-btn {
                        flex: 1;
                    }
                }
            `}</style>
        </div>
    );
}

