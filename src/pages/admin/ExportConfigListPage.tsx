import { useState, useEffect } from 'react';
import { Header } from '../../components/Header';
import { exportConfigService } from '../../services/exportConfigService';
import type { ExportConfig } from '../../services/exportConfigService';
import { Plus, Pencil, Trash2, FileText, ChevronLeft, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

export function ExportConfigListPage() {
    const [configs, setConfigs] = useState<(ExportConfig & { encontros: { nome: string, tema: string } | null })[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        carregarConfigs();
    }, []);

    async function carregarConfigs() {
        try {
            const data = await exportConfigService.listarTodas();
            setConfigs(data);
        } catch (error) {
            console.error('Erro ao buscar configurações', error);
            toast.error('Erro ao carregar lista de cabeçalhos');
        } finally {
            setLoading(false);
        }
    }

    async function handleExcluir(id: string) {
        if (!confirm('Deseja realmente excluir esta configuração de cabeçalho?')) return;
        
        try {
            await exportConfigService.deletar(id);
            toast.success('Configuração excluída com sucesso!');
            carregarConfigs();
        } catch (error) {
            console.error('Erro ao excluir', error);
            toast.error('Erro ao excluir configuração');
        }
    }

    return (
        <div className="app-shell">
            <Header />
            <main className="main-content container">
                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button onClick={() => navigate('/secretaria')} className="icon-btn" aria-label="Voltar">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Administração
                            </p>
                            <h1 className="page-title text-gradient" style={{ margin: 0, fontSize: '1.75rem' }}>
                                Cabeçalhos de Relatórios
                            </h1>
                        </div>
                    </div>

                    <button 
                        onClick={() => navigate('novo')}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>Novo Cabeçalho</span>
                    </button>
                </div>

                <div className="card shadow-sm animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                            <Loader className="animate-spin" size={32} color="var(--primary-color)" />
                        </div>
                    ) : configs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                            <FileText size={48} style={{ marginBottom: '1rem' }} />
                            <p>Nenhum cabeçalho configurado ainda.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Encontro</th>
                                        <th>Título do Relatório</th>
                                        <th>Logos</th>
                                        <th style={{ textAlign: 'right' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {configs.map((c) => (
                                        <tr key={c.id}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 600 }}>{c.encontros?.nome}</div>
                                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{c.encontros?.tema}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ fontSize: '0.9rem' }}>{c.titulo || '—'}</span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {c.imagem_esq_base64 && (
                                                        <div title="Logo Esquerda" style={{ width: '28px', height: '28px', backgroundColor: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                                                            <img src={c.imagem_esq_base64} alt="Esq" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                        </div>
                                                    )}
                                                    {c.imagem_dir_base64 && (
                                                        <div title="Logo Direita" style={{ width: '28px', height: '28px', backgroundColor: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                                                            <img src={c.imagem_dir_base64} alt="Dir" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                    <button 
                                                        onClick={() => navigate(`${c.id}`)}
                                                        className="icon-btn edit" 
                                                        title="Editar"
                                                        style={{ color: 'var(--primary-color)' }}
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleExcluir(c.id)}
                                                        className="icon-btn delete" 
                                                        title="Excluir"
                                                        style={{ color: '#ef4444' }}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
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
