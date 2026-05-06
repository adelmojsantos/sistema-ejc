import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, Baby, Plus, Trash2, Pencil, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ConfirmDialog';
import { FormField } from '../ui/FormField';
import { recreacaoService } from '../../services/recreacaoService';
import { equipeService } from '../../services/equipeService';
import { inscricaoService } from '../../services/inscricaoService';
import { LiveSearchSelect } from '../ui/LiveSearchSelect';
import type { RecreacaoDados, RecreacaoDadosFormData } from '../../types/recreacao';
import type { Equipe } from '../../types/equipe';
import type { InscricaoEnriched } from '../../types/inscricao';

interface RecreacaoDadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  participacaoId: string;
  participanteNome?: string;
  encontroId: string;
  onSave?: () => void;
  allowParticipantSelection?: boolean;
}

export function RecreacaoDadosModal({
  isOpen,
  onClose,
  participacaoId: initialParticipacaoId,
  participanteNome: initialParticipanteNome,
  encontroId,
  onSave,
  allowParticipantSelection
}: RecreacaoDadosModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [children, setChildren] = useState<RecreacaoDados[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [currentParticipacaoId, setCurrentParticipacaoId] = useState(initialParticipacaoId);
  const [currentParticipant, setCurrentParticipant] = useState<InscricaoEnriched | null>(null);

  const [allEquipes, setAllEquipes] = useState<Equipe[]>([]);
  const [allParticipantes, setAllParticipantes] = useState<InscricaoEnriched[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<RecreacaoDadosFormData>({
    nome_crianca: '',
    idade: 0,
    outro_responsavel_id: '',
    observacoes: ''
  });

  useEffect(() => {
    setCurrentParticipacaoId(initialParticipacaoId);
  }, [initialParticipacaoId]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (currentParticipacaoId) {
        loadChildren();
      } else {
        setChildren([]);
        setShowForm(false);
      }
    } else if (!isOpen) {
      resetForm();
    }
  }, [isOpen, currentParticipacaoId]);

  const loadInitialData = async () => {
    try {
      const [equipes, participantes] = await Promise.all([
        equipeService.listar(),
        inscricaoService.listarPorEncontro(encontroId)
      ]);
      setAllEquipes(equipes);
      setAllParticipantes(participantes);

      if (currentParticipacaoId) {
        const picked = participantes.find(p => p.id === currentParticipacaoId);
        if (picked) setCurrentParticipant(picked);
      }
    } catch (error) {
      console.error('Erro ao carregar dados auxiliares:', error);
    }
  };

  const loadChildren = async () => {
    if (!currentParticipacaoId) return;
    setLoading(true);
    try {
      const data = await recreacaoService.listarPorResponsavel(currentParticipacaoId);
      setChildren(data);
    } catch (error) {
      console.error('Erro ao carregar crianças:', error);
      toast.error('Não foi possível carregar os dados. Verifique sua conexão ou permissões.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectParticipant = (id: string) => {
    setCurrentParticipacaoId(id);
    const picked = allParticipantes.find(p => p.id === id);
    if (picked) setCurrentParticipant(picked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParticipacaoId) return;
    setSaving(true);
    try {
      const cleanedData = {
        ...formData,
        outro_responsavel_id: formData.outro_responsavel_id || null,
        observacoes: formData.observacoes || null
      };
      await recreacaoService.salvar(currentParticipacaoId, cleanedData, editingId || undefined);
      toast.success(editingId ? 'Dados atualizados!' : 'Criança cadastrada com sucesso!');
      await loadChildren();
      if (onSave) onSave();
      resetForm();
    } catch (error) {
      console.error('Erro ao carregar dados da recepção:', error);
      toast.error('Não foi possível salvar os dados. Verifique sua conexão ou permissões.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (child: RecreacaoDados) => {
    setFormData({
      nome_crianca: child.nome_crianca,
      idade: child.idade,
      outro_responsavel_id: child.outro_responsavel_id || '',
      observacoes: child.observacoes || ''
    });

    if (child.outro_responsavel?.equipe_id) {
      setSelectedTeamId(child.outro_responsavel.equipe_id);
    }

    setEditingId(child.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setIdToDelete(id);
  };

  const confirmDelete = async () => {
    if (!idToDelete) return;
    setIsDeleting(true);
    try {
      await recreacaoService.excluir(idToDelete);
      toast.success('Cadastro removido.');
      await loadChildren();
      if (onSave) onSave();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir.');
    } finally {
      setIsDeleting(false);
      setIdToDelete(null);
    }
  };

  const resetForm = () => {
    setFormData({
      nome_crianca: '',
      idade: 0,
      outro_responsavel_id: '',
      observacoes: ''
    });
    setSelectedTeamId('');
    setEditingId(null);
    setShowForm(false);
  };

  const filteredParticipantes = allParticipantes
    .filter(p => !selectedTeamId || p.equipe_id === selectedTeamId)
    .filter(p => p.id !== currentParticipacaoId)
    .sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Recreação Infantil - ${initialParticipanteNome || currentParticipant?.pessoas?.nome_completo || 'Novo Registro'}`} maxWidth="600px">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Loader className="animate-spin" size={32} />
        </div>
      ) : !showForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {allowParticipantSelection && !initialParticipacaoId && (
            <div className="form-group">
              <label className="form-label">Selecionar Responsável Principal</label>
              <LiveSearchSelect<InscricaoEnriched>
                value={currentParticipacaoId}
                onChange={handleSelectParticipant}
                fetchData={async (search) => {
                  return allParticipantes.filter(p =>
                    p.pessoas?.nome_completo?.toLowerCase().includes(search.toLowerCase())
                  );
                }}
                getOptionLabel={(p) => `${p.pessoas?.nome_completo} (${p.equipes?.nome || 'Sem Equipe'})`}
                getOptionValue={(p) => p.id}
                placeholder="Busque pelo nome..."
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', opacity: 0.7 }}>Crianças Cadastradas</h3>
            <button
              onClick={() => setShowForm(true)}
              disabled={!currentParticipacaoId}
              className="btn-primary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {children.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.4, border: '2px dashed var(--border-color)', borderRadius: '12px' }}>
              <Users size={32} style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
              <p style={{ margin: 0 }}>Nenhuma criança cadastrada.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {children.map(child => (
                <div key={child.id} style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{child.nome_crianca} ({child.idade} anos)</div>
                    </div>

                    {child.participacao_id !== currentParticipacaoId && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                        Resp. Primário: <strong>{child.participacoes?.pessoas?.nome_completo}</strong> ({child.participacoes?.equipes?.nome})
                      </div>
                    )}

                    {child.outro_responsavel && child.participacao_id === currentParticipacaoId && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                        2º Resp: {child.outro_responsavel.pessoas?.nome_completo} ({child.outro_responsavel.equipes?.nome})
                      </div>
                    )}
                  </div>

                  {child.participacao_id === currentParticipacaoId && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleEdit(child)} className="icon-btn" title="Editar" style={{ padding: '0.4rem' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(child.id)} className="icon-btn icon-btn-danger" title="Excluir" style={{ padding: '0.4rem' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={onClose} className="btn-secondary">Fechar</button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Baby size={20} color="var(--primary-color)" />
            {editingId ? 'Editar Criança' : 'Nova Criança'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '1rem' }}>
            <FormField
              label="Nome da Criança"
              required
              value={formData.nome_crianca}
              onChange={e => setFormData({ ...formData, nome_crianca: e.target.value })}
            />
            <FormField
              label="Idade"
              type="number"
              required
              min={0}
              max={7}
              onInvalid={e => (e.target as HTMLInputElement).setCustomValidity('A idade máxima é 7 anos e 11 meses')}
              onInput={e => (e.target as HTMLInputElement).setCustomValidity('')}
              onBlur={e => {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (val > 7) {
                  toast.error('Lembrando: a idade máxima para recreação é 7 anos e 11 meses.', {
                    icon: '🧒',
                    duration: 5000
                  });
                }
              }}
              value={formData.idade.toString()}
              onChange={e => setFormData({ ...formData, idade: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'rgba(var(--primary-rgb), 0.03)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5 }}>Outro Responsável (Opcional)</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Equipe</label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                  value={selectedTeamId}
                  onChange={e => {
                    setSelectedTeamId(e.target.value);
                    setFormData(prev => ({ ...prev, outro_responsavel_id: '' }));
                  }}
                >
                  <option value="">Equipe...</option>
                  {allEquipes.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.nome}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Pessoa</label>
                <select
                  className="form-input"
                  style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                  value={formData.outro_responsavel_id || ''}
                  onChange={e => setFormData(prev => ({ ...prev, outro_responsavel_id: e.target.value }))}
                  disabled={!selectedTeamId}
                >
                  <option value="">Selecione...</option>
                  {filteredParticipantes.map(p => (
                    <option key={p.id} value={p.id}>{p.pessoas?.nome_completo}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <FormField
            label="Observações / Alergias"
            value={formData.observacoes || ''}
            onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
            placeholder="Ex: Alergias, cuidados médicos..."
            as="textarea"
            rows={4}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={resetForm} className="btn-secondary">
              Voltar
            </button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ minWidth: '120px' }}>
              {saving ? <Loader className="animate-spin" size={18} /> : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        isOpen={!!idToDelete}
        title="Excluir Cadastro"
        message={
          <>
            Tem certeza que deseja excluir os dados de recreação de <strong>{children.find(c => c.id === idToDelete)?.nome_crianca}</strong>?
            <br />Esta ação não pode ser desfeita.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setIdToDelete(null)}
        isLoading={isDeleting}
        isDestructive={true}
      />
    </Modal>
  );
}
