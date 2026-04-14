import React, { useState, useEffect, useRef } from 'react';
import { exportConfigService, type ExportConfig } from '../../services/exportConfigService';
import { encontroService } from '../../services/encontroService';
import type { Encontro } from '../../types/encontro';
import { Save, Image as ImageIcon } from 'lucide-react';
import { Header } from '../../components/Header';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import toast from 'react-hot-toast';

export function ConfiguracoesExportacaoPage() {
    const [config, setConfig] = useState<ExportConfig>({
        id: '',
        encontro_id: null,
        titulo: '51º E J C',
        subtitulo: 'DATA: 26, 27, 28 DE JUNHO DE 2026',
        tema: 'TEMA: MEU CORAÇÃO EM TUA PRESENÇA',
        imagem_esq_base64: null,
        imagem_dir_base64: null,
        observacoes: '',
        config_telas: {}
    });
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [existingConfigs, setExistingConfigs] = useState<(ExportConfig & { encontros: { nome: string, tema: string } | null })[]>([]);
    const [selectedEncontroId, setSelectedEncontroId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [loadingConfig, setLoadingConfig] = useState(false);

    const fileInputEsq = useRef<HTMLInputElement>(null);
    const fileInputDir = useRef<HTMLInputElement>(null);

    const TELAS_DISPONIVEIS = [
        { id: 'CoordenadorMinhaEquipe', nome: 'Página do Coordenador (Minha Equipe)' },
        { id: 'EncontroParticipantes', nome: 'Lista de Todos os Participantes do Encontro' }
    ];

    useEffect(() => {
        carregarIniciais();
    }, []);

    useEffect(() => {
        if (selectedEncontroId) {
            carregarConfig(selectedEncontroId);
        }
    }, [selectedEncontroId]);

    async function carregarIniciais() {
        try {
            const [encontrosData, configsData] = await Promise.all([
                encontroService.listar(),
                exportConfigService.listarTodas()
            ]);
            setEncontros(encontrosData);
            setExistingConfigs(configsData);
            
            const ativo = encontrosData.find(e => e.ativo);
            if (ativo) setSelectedEncontroId(ativo.id);
            else if (encontrosData.length > 0) setSelectedEncontroId(encontrosData[0].id);
        } catch (error) {
            console.error('Erro ao carregar dados iniciais', error);
            toast.error('Erro ao carregar dados iniciais');
        } finally {
            setLoading(false);
        }
    }

    async function carregarConfig(encontroId: string) {
        setLoadingConfig(true);
        try {
            const data = await exportConfigService.obter(encontroId);
            if (data) {
                setConfig({
                    ...data,
                    config_telas: data.config_telas || {}
                });
            } else {
                setConfig({
                    id: '',
                    encontro_id: encontroId,
                    titulo: '',
                    subtitulo: '',
                    tema: '',
                    imagem_esq_base64: null,
                    imagem_dir_base64: null,
                    observacoes: '',
                    config_telas: {}
                });
            }
        } catch (error) {
            console.error('Erro ao carregar configurações', error);
            toast.error('Erro ao carregar configurações');
        } finally {
            setLoadingConfig(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedEncontroId) {
            toast.error('Selecione um encontro primeiro');
            return;
        }

        try {
            await exportConfigService.salvar({
                titulo: config.titulo,
                subtitulo: config.subtitulo,
                tema: config.tema,
                imagem_esq_base64: config.imagem_esq_base64,
                imagem_dir_base64: config.imagem_dir_base64,
                observacoes: config.observacoes,
                config_telas: config.config_telas
            }, selectedEncontroId);
            toast.success('Configurações salvas com sucesso!');
            const updatedConfigs = await exportConfigService.listarTodas();
            setExistingConfigs(updatedConfigs);
        } catch (error) {
            console.error('Erro ao salvar', error);
            toast.error('Erro ao salvar configurações');
        }
    }

    const handleImageUpload = (side: 'esq' | 'dir', file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecione apenas imagens.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setConfig(prev => ({
                ...prev,
                [side === 'esq' ? 'imagem_esq_base64' : 'imagem_dir_base64']: result
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleToggleTela = (telaId: string) => {
        setConfig(prev => ({
            ...prev,
            config_telas: {
                ...prev.config_telas,
                [telaId]: !prev.config_telas[telaId]
            }
        }));
    };

    if (loading) return <div className="p-8 text-center">Carregando...</div>;

    return (
        <div className="app-shell">
            <Header />
            <main className="main-content container">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.8rem', color: 'var(--primary-color)' }}>Configurações de Exportação (PDF/Excel)</h1>
                </div>

                <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                    <label className="form-label">Selecione o Encontro para Configurar</label>
                    <LiveSearchSelect<Encontro>
                        value={selectedEncontroId}
                        onChange={(val) => setSelectedEncontroId(val)}
                        fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                        getOptionLabel={(e) => `${e.nome}${e.tema ? ` (${e.tema})` : ''} ${e.ativo ? '(Ativo)' : ''}`}
                        getOptionValue={(e) => String(e.id)}
                        placeholder="Selecione um Encontro..."
                        initialOptions={encontros}
                    />
                </div>

                {loadingConfig ? (
                    <div className="text-center p-8">Carregando configurações...</div>
                ) : (
                    <>
                        <div className="card" style={{ padding: '2rem', marginBottom: '2rem', background: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '4px' }}>
                            <h2 style={{ fontSize: '1rem', color: '#666', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Pré-visualização do Cabeçalho (PDF)</h2>
                            
                            <div style={{ 
                                border: '1px solid #000', 
                                padding: '10mm', 
                                minHeight: '40mm', 
                                position: 'relative', 
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'Helvetica, Arial, sans-serif'
                            }}>
                                {config.imagem_esq_base64 && (
                                    <img src={config.imagem_esq_base64} alt="Left Logo" style={{ position: 'absolute', left: '10mm', top: '10mm', height: '25mm', width: '25mm', objectFit: 'contain' }} />
                                )}
                                
                                <div style={{ textAlign: 'center', width: '100%', padding: '0 30mm' }}>
                                    <h1 style={{ margin: '0 0 2px 0', fontSize: '18pt', fontWeight: 'bold' }}>{config.titulo || 'MANTENHA VAZIO PARA USAR PADRÃO'}</h1>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '12pt' }}>{config.subtitulo || 'Subtítulo / Data'}</p>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '12pt' }}>{config.tema || 'Tema do Encontro'}</p>
                                    {config.observacoes && (
                                        <p style={{ margin: '4px 0 0 0', fontSize: '10pt', fontStyle: 'italic', opacity: 0.8 }}>{config.observacoes}</p>
                                    )}
                                </div>

                                {config.imagem_dir_base64 && (
                                    <img src={config.imagem_dir_base64} alt="Right Logo" style={{ position: 'absolute', right: '10mm', top: '10mm', height: '25mm', width: '25mm', objectFit: 'contain' }} />
                                )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem', textAlign: 'center' }}>
                                * Representação aproximada do layout no PDF. Configuração específica para: <strong>{encontros.find(e => e.id === selectedEncontroId)?.nome}</strong>
                            </p>
                        </div>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="card" style={{ padding: '2rem' }}>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Textos do Cabeçalho</h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

                            <div className="card" style={{ padding: '2rem' }}>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Imagens do Cabeçalho (PDF)</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', opacity: 0.7, marginBottom: '1rem' }}>
                                    Essas imagens serão usadas exclusivamente na geração do PDF para este encontro.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                                    <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Logo Esquerda</h3>
                                        {config.imagem_esq_base64 ? (
                                            <div style={{ marginBottom: '1rem' }}>
                                                <img src={config.imagem_esq_base64} alt="Left" style={{ height: '80px', objectFit: 'contain' }} />
                                                <br />
                                                <button type="button" className="btn-text" style={{ color: '#ef4444', marginTop: '0.5rem' }} onClick={() => setConfig({ ...config, imagem_esq_base64: null })}>Remover Imagem</button>
                                            </div>
                                        ) : (
                                            <div>
                                                <input type="file" ref={fileInputEsq} onChange={e => e.target.files && handleImageUpload('esq', e.target.files[0])} style={{ display: 'none' }} accept="image/*" />
                                                <button type="button" className="btn-outline" onClick={() => fileInputEsq.current?.click()}>
                                                    <ImageIcon size={18} /> Escolher Imagem
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Logo Direita</h3>
                                        {config.imagem_dir_base64 ? (
                                            <div style={{ marginBottom: '1rem' }}>
                                                <img src={config.imagem_dir_base64} alt="Right" style={{ height: '80px', objectFit: 'contain' }} />
                                                <br />
                                                <button type="button" className="btn-text" style={{ color: '#ef4444', marginTop: '0.5rem' }} onClick={() => setConfig({ ...config, imagem_dir_base64: null })}>Remover Imagem</button>
                                            </div>
                                        ) : (
                                            <div>
                                                <input type="file" ref={fileInputDir} onChange={e => e.target.files && handleImageUpload('dir', e.target.files[0])} style={{ display: 'none' }} accept="image/*" />
                                                <button type="button" className="btn-outline" onClick={() => fileInputDir.current?.click()}>
                                                    <ImageIcon size={18} /> Escolher Imagem
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="card" style={{ padding: '2rem' }}>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Configuração por Tela</h2>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-color)', opacity: 0.7, marginBottom: '1rem' }}>
                                    Ative as telas em que deseja que este cabeçalho seja injetado.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {TELAS_DISPONIVEIS.map(t => (
                                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', padding: '0.5rem', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={!!config.config_telas[t.id]} 
                                                onChange={() => handleToggleTela(t.id)} 
                                                style={{ width: '18px', height: '18px' }}
                                            />
                                            <span>{t.nome}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem' }}>
                                    <Save size={20} />
                                    Salvar Configurações
                                </button>
                            </div>
                        </form>
                    </>
                )}

                <div className="card" style={{ marginTop: '3rem', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Cabeçalhos Cadastrados</h2>
                    {existingConfigs.length === 0 ? (
                        <p style={{ opacity: 0.5, textAlign: 'center', padding: '1rem' }}>Nenhum cabeçalho configurado ainda.</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.75rem', fontSize: '0.85rem' }}>EJC / Encontro</th>
                                        <th style={{ padding: '0.75rem', fontSize: '0.85rem' }}>Título no Relatório</th>
                                        <th style={{ padding: '0.75rem', fontSize: '0.85rem' }}>Logos</th>
                                        <th style={{ padding: '0.75rem', fontSize: '0.85rem' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {existingConfigs.map((c) => (
                                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <strong>{c.encontros?.nome}</strong>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{c.encontros?.tema}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{c.titulo}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {c.imagem_esq_base64 && <div title="Logo Esquerda" style={{ width: '20px', height: '20px', backgroundColor: '#eee', borderRadius: '4px' }} />}
                                                    {c.imagem_dir_base64 && <div title="Logo Direita" style={{ width: '20px', height: '20px', backgroundColor: '#eee', borderRadius: '4px' }} />}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedEncontroId(c.encontro_id || '');
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="btn-text"
                                                    style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}
                                                >
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
