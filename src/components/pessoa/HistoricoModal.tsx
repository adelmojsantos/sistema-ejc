import { useEffect, useState } from 'react';
import { Clock3, History, Loader } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { pessoaService, type PessoaHistoricoParticipacao } from '../../services/pessoaService';
import type { Pessoa } from '../../types/pessoa';

interface HistoricoModalProps {
    pessoa: Pessoa;
    isOpen: boolean;
    onClose: () => void;
}

export function HistoricoModal({ pessoa, isOpen, onClose }: HistoricoModalProps) {
    const [historico, setHistorico] = useState<PessoaHistoricoParticipacao[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        const loadHistory = async () => {
            setIsLoading(true);
            try {
                const data = await pessoaService.buscarHistorico(pessoa.id);
                // Mover os encontros ativos / mais recentes para o topo
                data.sort((a, b) => {
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
            <div className="historico-participacao">
                <div className="historico-participacao__pessoa">
                    <div className="historico-participacao__pessoa-icon">
                        <History size={20} />
                    </div>
                    <div className="historico-participacao__pessoa-info">
                        <h2>{pessoa.nome_completo}</h2>
                        {pessoa.cpf && <p>CPF: {pessoa.cpf}</p>}
                    </div>
                </div>

                {isLoading ? (
                    <div className="historico-participacao__state">
                        <Loader size={32} className="animate-spin" />
                        <p>Buscando participações...</p>
                    </div>
                ) : historico.length === 0 ? (
                    <div className="historico-participacao__state historico-participacao__state--empty">
                        <p>Nenhuma participação registrada em encontros.</p>
                    </div>
                ) : (
                    <div className="historico-participacao__lista">
                        {historico.map((part, idx) => {
                            const encontro = part.encontros?.nome || 'Encontro Desconhecido';
                            const tema = part.encontros?.tema || 'Tema não informado';
                            const isAtivo = part.encontros?.ativo;
                            const papel = part.participante ? 'Encontrista' : (part.equipes?.nome || 'Encontreiro');
                            const coordenador = part.coordenador;

                            return (
                                <div
                                    key={idx}
                                    className={`historico-participacao__card${isAtivo ? ' historico-participacao__card--ativo' : ''}`}
                                >
                                    <div className="historico-participacao__card-header">
                                        <div className="historico-participacao__card-heading">
                                            <strong className="historico-participacao__encontro">
                                                {encontro}
                                            </strong>
                                            <span className="historico-participacao__tema">
                                                {tema}
                                            </span>
                                        </div>
                                        {isAtivo && (
                                            <span className="historico-participacao__atual">
                                                <Clock3 size={12} className="historico-participacao__atual__icon"/>
                                                ATUAL
                                            </span>
                                        )}
                                    </div>
                                    <div className="historico-participacao__papeis">
                                        <span className={`historico-participacao__papel${part.participante ? ' historico-participacao__papel--participante' : ''}`}>
                                            {papel.toUpperCase()}
                                        </span>
                                        {coordenador && (
                                            <span className="historico-participacao__papel historico-participacao__papel--coordenador">
                                                COORDENADOR
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="historico-participacao__footer">
                    <button className="btn-secondary" onClick={onClose}>Fechar</button>
                </div>
            </div>
        </Modal>
    );
}
