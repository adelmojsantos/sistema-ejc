import React, { useState, useEffect } from 'react';
import type { Inscricao, InscricaoFormData } from '../../types/inscricao';
import type { Pessoa } from '../../types/pessoa';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import { pessoaService } from '../../services/pessoaService';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { Save, Loader, User, Calendar, Shield, X } from 'lucide-react';
import { FormSection } from '../ui/FormSection';
import { FormRow } from '../ui/FormRow';
import { LiveSearchSelect } from '../ui/LiveSearchSelect';

interface InscricaoFormProps {
    initialData?: Inscricao;
    onSubmit: (data: InscricaoFormData) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
}

export function InscricaoForm({ initialData, onSubmit, onCancel, isLoading = false }: InscricaoFormProps) {
    const [form, setForm] = useState<InscricaoFormData>({
        pessoa_id: initialData?.pessoa_id ?? '',
        encontro_id: initialData?.encontro_id ?? '',
        participante: initialData?.participante ?? true,
        equipe_id: initialData?.equipe_id ?? null,
        coordenador: initialData?.coordenador ?? false,
        dados_confirmados: initialData?.dados_confirmados ?? false,
        confirmado_em: initialData?.confirmado_em ?? null,
        pago_taxa: initialData?.pago_taxa ?? false,
    });

    const [pessoas, setPessoas] = useState<Pessoa[]>([]);
    const [encontros, setEncontros] = useState<Encontro[]>([]);
    const [equipes, setEquipes] = useState<Equipe[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const [ps, es, eqs] = await Promise.all([
                    pessoaService.listar(),
                    encontroService.listar(),
                    equipeService.listar(),
                ]);
                setPessoas(ps);
                setEncontros(es);
                setEquipes(eqs);
            } finally {
                setIsDataLoading(false);
            }
        }
        loadData();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.pessoa_id || !form.encontro_id) return;
        
        setIsSubmitting(true);
        try {
            await onSubmit(form);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isDataLoading) return <div className="empty-state">Carregando opções...</div>;

    return (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
            <FormSection title="Dados do Vínculo" icon={<Shield size={18} />} columns={0}>
                <FormRow>
                    <div className="form-group col-6">
                        <label className="form-label">Pessoa <User size={12} /></label>
                        <select
                            className="form-input"
                            value={form.pessoa_id}
                            onChange={e => setForm({ ...form, pessoa_id: e.target.value })}
                            required
                        >
                            <option value="">Selecione uma pessoa...</option>
                            {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome_completo} ({p.cpf})</option>)}
                        </select>
                    </div>

                    <div className="form-group col-6">
                        <label className="form-label">Encontro <Calendar size={12} /></label>
                        <LiveSearchSelect<Encontro>
                            value={form.encontro_id}
                            onChange={(val) => setForm({ ...form, encontro_id: val })}
                            fetchData={async (search, page) => await encontroService.buscarComPaginacao(search, page)}
                            getOptionLabel={(e) => `${e.nome}${e.tema ? ` (${e.tema})` : ''} ${e.ativo ? '(Ativo)' : ''}`}
                            getOptionValue={(e) => String(e.id)}
                            placeholder="Selecione um Encontro..."
                            initialOptions={encontros}
                        />
                    </div>
                </FormRow>

                <FormRow>
                    <div className="col-12" style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', padding: '1rem', background: 'var(--secondary-bg)', borderRadius: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="is_participante"
                                checked={form.participante ?? false}
                                onChange={e => setForm({ ...form, participante: e.target.checked })}
                                style={{ width: '1.2rem', height: '1.2rem' }}
                            />
                            <label htmlFor="is_participante" style={{ margin: 0, fontWeight: 500 }}>É Participante?</label>
                        </div>

                        {!form.participante && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="is_coordenador"
                                    checked={form.coordenador ?? false}
                                    onChange={e => setForm({ ...form, coordenador: e.target.checked })}
                                    style={{ width: '1.2rem', height: '1.2rem' }}
                                />
                                <label htmlFor="is_coordenador" style={{ margin: 0, fontWeight: 500 }}>É Coordenador?</label>
                            </div>
                        )}
                    </div>
                </FormRow>

                {!form.participante && (
                    <FormRow>
                        <div className="form-group col-12">
                            <label className="form-label">Equipe de Trabalho <Shield size={12} /></label>
                            <LiveSearchSelect<Equipe>
                                value={form.equipe_id ?? ''}
                                onChange={(val) => setForm({ ...form, equipe_id: val || null })}
                                fetchData={async (search, page) => await equipeService.buscarComPaginacao(search, page)}
                                getOptionLabel={(e) => String(e.nome)}
                                getOptionValue={(e) => String(e.id)}
                                placeholder="Nenhuma equipe selecionada"
                                initialOptions={equipes}
                            />
                        </div>
                    </FormRow>
                )}
            </FormSection>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn-cancel" onClick={onCancel}>
                    <X size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                    Cancelar
                </button>
                <button type="submit" disabled={isLoading || isSubmitting}>
                    {isLoading || isSubmitting ? (
                        <><Loader size={16} className="animate-spin" style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvando...</>
                    ) : (
                        <><Save size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Salvar Vínculo</>
                    )}
                </button>
            </div>
        </form>
    );
}
