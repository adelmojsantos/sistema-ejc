import { useState, useEffect, useRef } from 'react';
import { Header } from '../../components/Header';
import { exportConfigService } from '../../services/exportConfigService';
import type { ExportConfig } from '../../services/exportConfigService';
import { encontroService } from '../../services/encontroService';
import type { Encontro } from '../../types/encontro';
import { toast } from 'react-hot-toast';
import { Save, ChevronLeft, Image as ImageIcon, Loader } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';

export function ExportConfigFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    
    const [config, setConfig] = useState<Partial<ExportConfig>>({
        titulo: '',
        subtitulo: '',
        tema: '',
        imagem_esq_base64: null,
        imagem_dir_base64: null,
        observacoes: '',
        config_telas: {}
    });

    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');

    const fileInputEsq = useRef<HTMLInputElement>(null);
    const fileInputDir = useRef<HTMLInputElement>(null);

    const TELAS_DISPONIVEIS = [
        { id: 'CoordenadorMinhaEquipe', nome: 'Página do Coordenador (Minha Equipe)' },
        { id: 'EncontroParticipantes', nome: 'Lista de Todos os Participantes do Encontro' }
    ];

    useEffect(() => {
        carregarConfiguracoes();
    }, [id]);

    async function carregarConfiguracoes() {
        try {
            const encontrosData = await encontroService.listar();
            setEncontros(encontrosData);

            if (id) {
                const data = await exportConfigService.obterPorId(id);
                if (data) {
                    setConfig(data);
                    setSelectedEncontroId(data.encontro_id || '');
                } else {
                    toast.error('Configuração não encontrada');
                    navigate('/admin/configuracoes-exportacao');
                }
            }
        } catch (error) {
            console.error('Erro ao carregar dados', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }

    const handleImageUpload = async (side: 'esq' | 'dir', file: File) => {
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Imagem muito grande. Limite de 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            if (side === 'esq') setConfig({ ...config, imagem_esq_base64: base64 });
            else setConfig({ ...config, imagem_dir_base64: base64 });
        };
        reader.readAsDataURL(file);
    };

    const handleToggleTela = (telaId: string) => {
        const novasTelas = { ...(config.config_telas || {}) };
        if (novasTelas[telaId]) delete novasTelas[telaId];
        else novasTelas[telaId] = true;
        setConfig({ ...config, config_telas: novasTelas });
    };

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedEncontroId) {
            toast.error('Selecione um encontro');
            return;
        }

        setSaving(true);
        try {
            await exportConfigService.salvar(config, selectedEncontroId);
            toast.success('Configurações salvas com sucesso!');
            navigate('/admin/configuracoes-exportacao');
        } catch (error) {
            console.error('Erro ao salvar', error);
            toast.error('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    }

    const fetchEncontros = async (search: string, page: number) => {
        return encontroService.buscarComPaginacao(search, page, 5);
    };

    if (loading) {
        return (
            <div className="app-shell">
                <Header />
                <main className="main-content container text-center" style={{ padding: '4rem' }}>
                    <Loader className="animate-spin" size={32} color="var(--primary-color)" />
                </main>
            </div>
        );
    }

    return (
        <div className="app-shell">
            <Header />
            <main className="main-content container">
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => navigate('/admin/configuracoes-exportacao')} className="icon-btn" aria-label="Voltar">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {id ? 'Editar Cabeçalho' : 'Novo Cabeçalho'}
                            </p>
                            <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.75rem' }}>
                                Configuração de Exportação
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Form Section */}
                    <div>
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Dados Gerais</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <label className="form-label">Encontro</label>
                                        <LiveSearchSelect<Encontro>
                                            value={selectedEncontroId}
                                            onChange={(val) => setSelectedEncontroId(val || '')}
                                            fetchData={fetchEncontros}
                                            getOptionLabel={(e) => e.nome}
                                            getOptionValue={(e) => e.id}
                                            placeholder="Selecione o encontro..."
                                            disabled={!!id}
                                            initialOptions={encontros}
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Título Principal</label>
                                        <input type="text" className="form-input" value={config.titulo || ''} onChange={e => setConfig({ ...config, titulo: e.target.value })} placeholder="Ex: 51º E J C" />
                                    </div>
                                    <div>
                                        <label className="form-label">Data / Subtítulo</label>
                                        <input type="text" className="form-input" value={config.subtitulo || ''} onChange={e => setConfig({ ...config, subtitulo: e.target.value })} placeholder="Ex: DATA: 26, 27, 28 DE JUNHO DE 2026" />
                                    </div>
                                    <div>
                                        <label className="form-label">Tema</label>
                                        <input type="text" className="form-input" value={config.tema || ''} onChange={e => setConfig({ ...config, tema: e.target.value })} placeholder="Ex: TEMA: MEU CORAÇÃO EM TUA PRESENÇA" />
                                    </div>
                                    <div>
                                        <label className="form-label">Observações Extras (Opcional)</label>
                                        <input type="text" className="form-input" value={config.observacoes || ''} onChange={e => setConfig({ ...config, observacoes: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Logos (PDF)</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Logo Esquerda</p>
                                        {config.imagem_esq_base64 ? (
                                            <div>
                                                <img src={config.imagem_esq_base64} alt="Esq" style={{ height: '60px', objectFit: 'contain', marginBottom: '0.5rem' }} />
                                                <button type="button" className="btn-text" style={{ color: '#ef4444', fontSize: '0.75rem' }} onClick={() => setConfig({ ...config, imagem_esq_base64: null })}>Remover</button>
                                            </div>
                                        ) : (
                                            <>
                                                <input type="file" ref={fileInputEsq} onChange={e => e.target.files && handleImageUpload('esq', e.target.files[0])} style={{ display: 'none' }} accept="image/*" />
                                                <button type="button" className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.5rem' }} onClick={() => fileInputEsq.current?.click()}>
                                                    <ImageIcon size={14} /> Upload
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Logo Direita</p>
                                        {config.imagem_dir_base64 ? (
                                            <div>
                                                <img src={config.imagem_dir_base64} alt="Dir" style={{ height: '60px', objectFit: 'contain', marginBottom: '0.5rem' }} />
                                                <button type="button" className="btn-text" style={{ color: '#ef4444', fontSize: '0.75rem' }} onClick={() => setConfig({ ...config, imagem_dir_base64: null })}>Remover</button>
                                            </div>
                                        ) : (
                                            <>
                                                <input type="file" ref={fileInputDir} onChange={e => e.target.files && handleImageUpload('dir', e.target.files[0])} style={{ display: 'none' }} accept="image/*" />
                                                <button type="button" className="btn-outline" style={{ fontSize: '0.8rem', padding: '0.5rem' }} onClick={() => fileInputDir.current?.click()}>
                                                    <ImageIcon size={14} /> Upload
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="card shadow-sm" style={{ padding: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Telas Ativas</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {TELAS_DISPONIVEIS.map(t => (
                                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.5rem', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={!!config.config_telas?.[t.id]} 
                                                onChange={() => handleToggleTela(t.id)} 
                                                style={{ width: '16px', height: '16px' }}
                                            />
                                            <span>{t.nome}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="btn-primary" 
                                disabled={saving}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}
                            >
                                {saving ? <Loader className="animate-spin" size={20} /> : <Save size={20} />}
                                <span>Salvar Configuração</span>
                            </button>
                        </form>
                    </div>

                    {/* Preview Section */}
                    <div className="sticky-top" style={{ top: '2rem' }}>
                        <div className="card shadow-sm" style={{ padding: '1.5rem', background: '#fff', color: '#000' }}>
                            <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Pré-visualização (PDF)</h2>
                            
                            <div style={{ 
                                border: '1px solid #000', 
                                padding: '8mm', 
                                minHeight: '35mm', 
                                position: 'relative', 
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'Helvetica, Arial, sans-serif'
                            }}>
                                {config.imagem_esq_base64 && (
                                    <img src={config.imagem_esq_base64} alt="Left" style={{ position: 'absolute', left: '8mm', top: '8mm', height: '20mm', width: '20mm', objectFit: 'contain' }} />
                                )}
                                
                                <div style={{ textAlign: 'center', width: '100%', padding: '0 25mm' }}>
                                    <h1 style={{ margin: '0 0 2px 0', fontSize: '16pt', fontWeight: 'bold' }}>{config.titulo || 'MANTENHA VAZIO PARA USAR PADRÃO'}</h1>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '10pt' }}>{config.subtitulo || 'Subtítulo / Data'}</p>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '10pt' }}>{config.tema || 'Tema do Encontro'}</p>
                                    {config.observacoes && (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '8pt', fontStyle: 'italic', opacity: 0.8 }}>{config.observacoes}</p>
                                    )}
                                </div>

                                {config.imagem_dir_base64 && (
                                    <img src={config.imagem_dir_base64} alt="Right" style={{ position: 'absolute', right: '8mm', top: '8mm', height: '20mm', width: '20mm', objectFit: 'contain' }} />
                                )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', textAlign: 'center' }}>
                                * Representação aproximada do layout no PDF.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
