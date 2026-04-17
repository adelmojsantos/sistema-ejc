import { useEffect, useState } from 'react';
import { History, Loader } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { pessoaService } from '../../services/pessoaService';
import type { Pessoa } from '../../types/pessoa';

interface HistoricoModalProps {
    pessoa: Pessoa;
    isOpen: boolean;
    onClose: () => void;
}

export function HistoricoModal({ pessoa, isOpen, onClose }: HistoricoModalProps) {
    const [historico, setHistorico] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        const loadHistory = async () => {
            setIsLoading(true);
            try {
                const data = await pessoaService.buscarHistorico(pessoa.id);
                // Mover os encontros ativos / mais recentes para o topo
                data.sort((a: any, b: any) => {
                    const aAtivo = a.encontros?.ativo || false;
                    const bAtivo = b.encontros?.ativo || false;
                    if (aAtivo && !bAtivo) return -1;
                    if (!aAtivo && bAtivo) return 1;
                    return 0;
                });
                setHistorico(data);
            } catch (err) {
                console.error("Erro ao carregar histórico", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadHistory();
    }, [pessoa.id, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Histórico de Participação`} maxWidth="600px">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(var(--primary-rgb, 0,0,255), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                        <History size={20} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{pessoa.nome_completo}</h2>
                        {pessoa.cpf && <p style={{ margin: 0, opacity: 0.6, fontSize: '0.85rem' }}>{pessoa.cpf ? `CPF: ${pessoa.cpf}` : 'Sem CPF'}</p>}
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>
                        <Loader size={32} className="animate-spin" style={{ margin: '0 auto 1rem auto' }} />
                        <p>Buscando participações...</p>
                    </div>
                ) : historico.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5, border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                        <p style={{ margin: 0 }}>Nenhuma participação registrada em encontros.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '50vh', overflowY: 'auto' }}>
                        {historico.map((part, idx) => {
                            const encontro = part.encontros?.nome || 'Encontro Desconhecido';
                            const tema = part.encontros?.tema || 'Tema não informado';
                            const isAtivo = part.encontros?.ativo;
                            const papel = part.participante ? 'Encontrista' : (part.equipes?.nome || 'Equipe Trabalhando');
                            const coordenador = part.coordenador;

                            return (
                                <div key={idx} style={{
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    border: isAtivo ? '2px solid #10b981' : '1px solid var(--border-color)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                    backgroundColor: isAtivo ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-color)',
                                    boxShadow: isAtivo ? '0 4px 12px rgba(16, 185, 129, 0.1)' : 'none',
                                    margin: isAtivo ? '0.5rem 0' : '0'
                                }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                                            <strong style={{ fontSize: '1.05rem', color: isAtivo ? '#10b981' : 'inherit', wordBreak: 'break-word' }}>
                                                {encontro}
                                            </strong>
                                            <span style={{ fontSize: '0.8rem', color: '#10b981', padding: '0.25rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                                                {tema}
                                            </span>
                                        </div>
                                        {isAtivo && (
                                            <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.6rem', backgroundColor: '#10b981', color: 'white', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem', letterSpacing: '0.5px' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
                                                ATUAL
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', backgroundColor: part.participante ? 'rgba(7, 65, 12, 0.77)' : 'rgba(6, 107, 14, 0.9)', color: part.participante ? '#FFF' : '#FFF', padding: '0.25rem 0.6rem', borderRadius: '8px', fontWeight: 600 }}>
                                            {papel.toUpperCase()}
                                        </span>
                                        {coordenador && (
                                            <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(20, 2, 99, 0.9)', color: '#FFF', padding: '0.25rem 0.6rem', borderRadius: '8px', fontWeight: 600 }}>
                                                COORDENADOR
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                    <button className="btn-secondary" onClick={onClose}>Fechar</button>
                </div>
            </div>
        </Modal>
    );
}
