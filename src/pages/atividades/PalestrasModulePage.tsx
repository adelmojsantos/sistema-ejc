import { 
    Mic2, 
    ChevronRight, 
    Settings, 
    FileText,
    Calendar
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { encontroService } from '../../services/encontroService';
import type { Encontro } from '../../types/encontro';

export function PalestrasModulePage() {
    const navigate = useNavigate();
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEncontros();
    }, []);

    const loadEncontros = async () => {
        try {
            const data = await encontroService.listarTodos();
            // Ordenar por data (mais recentes primeiro)
            const sorted = data.sort((a, b) => {
                const dateA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
                const dateB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
                return dateB - dateA;
            });
            setEncontros(sorted);
        } catch (error) {
            console.error('Erro ao carregar encontros:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Carregando encontros...</div>;

    return (
        <div className="container">
            <PageHeader
                title="Módulo de Palestras"
                subtitle="Selecione um encontro para gerenciar o conteúdo programático."
            />

            <div className="encontros-selection-grid" style={{ marginTop: '2rem' }}>
                {encontros.length === 0 ? (
                    <div className="card text-center p-12">
                        <Calendar size={48} className="opacity-20 mb-4" />
                        <h3>Nenhum encontro encontrado</h3>
                        <p className="opacity-60">Cadastre um encontro primeiro para gerenciar suas palestras.</p>
                    </div>
                ) : (
                    encontros.map((enc) => (
                        <div key={enc.id} className="encontro-module-card">
                            <div className="enc-card-header">
                                <div className="enc-badge">
                                    <Calendar size={20} />
                                </div>
                                <div className="enc-title">
                                    <h3>{enc.nome}</h3>
                                    <span>{enc.tema || 'Sem tema definido'}</span>
                                </div>
                            </div>

                            <div className="enc-card-actions">
                                <button 
                                    className="module-action-btn primary"
                                    onClick={() => navigate(`/cadastros/encontros/${enc.id}/palestras`)}
                                >
                                    <div className="btn-icon"><Settings size={20} /></div>
                                    <div className="btn-text">
                                        <strong>Gestão Master</strong>
                                        <span>Cadastro e Fotos</span>
                                    </div>
                                    <ChevronRight size={18} />
                                </button>

                                <button 
                                    className="module-action-btn secondary"
                                    onClick={() => navigate(`/cadastros/encontros/${enc.id}/palestras-resumo`)}
                                >
                                    <div className="btn-icon"><FileText size={20} /></div>
                                    <div className="btn-text">
                                        <strong>Revisor de Resumos</strong>
                                        <span>Edição de Textos</span>
                                    </div>
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .encontros-selection-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 1.5rem;
                }

                .encontro-module-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    transition: all 0.3s ease;
                }

                .encontro-module-card:hover {
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    border-color: var(--primary-color)30;
                }

                .enc-card-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .enc-badge {
                    width: 44px;
                    height: 44px;
                    background: var(--primary-color)10;
                    color: var(--primary-color);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .enc-title h3 { margin: 0; font-size: 1.1rem; }
                .enc-title span { font-size: 0.85rem; opacity: 0.6; }

                .enc-card-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .module-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.02);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                    color: var(--text-color);
                }

                .module-action-btn:hover {
                    background: var(--primary-color)08;
                    border-color: var(--primary-color)50;
                    transform: translateX(4px);
                }

                .btn-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--bg-color);
                }

                .module-action-btn.primary .btn-icon { color: var(--primary-color); }
                .module-action-btn.secondary .btn-icon { color: #8b5cf6; }

                .btn-text { flex: 1; display: flex; flex-direction: column; }
                .btn-text strong { font-size: 0.95rem; }
                .btn-text span { font-size: 0.75rem; opacity: 0.5; }
            `}</style>
        </div>
    );
}

