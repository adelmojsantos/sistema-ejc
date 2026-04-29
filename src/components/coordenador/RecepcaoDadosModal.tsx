import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { RadioGroup } from '../ui/RadioGroup';
import { recepcaoService } from '../../services/recepcaoService';
import { inscricaoService } from '../../services/inscricaoService';
import { LiveSearchSelect } from '../ui/LiveSearchSelect';
import type { RecepcaoDadosFormData } from '../../types/recepcao';
import type { InscricaoEnriched } from '../../types/inscricao';
import { cleanPlate, formatPlate } from '../../utils/plateUtils';

interface RecepcaoDadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  participacaoId: string;
  participanteNome?: string;
  equipeNome?: string;
  onSave?: () => void;
  allowParticipantSelection?: boolean;
  encontroId?: string;
}

export function RecepcaoDadosModal({ 
  isOpen, 
  onClose, 
  participacaoId: initialParticipacaoId, 
  participanteNome: initialParticipanteNome, 
  equipeNome: initialEquipeNome,
  onSave,
  allowParticipantSelection,
  encontroId
}: RecepcaoDadosModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [currentParticipacaoId, setCurrentParticipacaoId] = useState(initialParticipacaoId);
  const [currentParticipant, setCurrentParticipant] = useState<InscricaoEnriched | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<RecepcaoDadosFormData>({
    veiculo_tipo: 'carro',
    veiculo_modelo: '',
    veiculo_cor: '',
    veiculo_placa: '',
  });

  useEffect(() => {
    setCurrentParticipacaoId(initialParticipacaoId);
  }, [initialParticipacaoId]);

  useEffect(() => {
    if (isOpen && currentParticipacaoId) {
      loadDados();
    } else if (isOpen && !currentParticipacaoId) {
      // Clear for new entry
      setRecordId(null);
      setFormData({
        veiculo_tipo: 'carro',
        veiculo_modelo: '',
        veiculo_cor: '',
        veiculo_placa: '',
      });
    }
  }, [isOpen, currentParticipacaoId]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const dados = await recepcaoService.obterPorParticipacao(currentParticipacaoId);
      if (dados) {
        setRecordId(dados.id);
        setFormData({
          veiculo_tipo: dados.veiculo_tipo,
          veiculo_modelo: dados.veiculo_modelo,
          veiculo_cor: dados.veiculo_cor,
          veiculo_placa: formatPlate(dados.veiculo_placa),
        });
      } else {
        setRecordId(null);
        // Default values for new registrations
        setFormData({
          veiculo_tipo: 'carro',
          veiculo_modelo: '',
          veiculo_cor: '',
          veiculo_placa: '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados da recepção:', error);
      toast.error('Não foi possível carregar os dados do veículo. Verifique sua conexão ou permissões.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectParticipant = async (id: string) => {
    setCurrentParticipacaoId(id);
    // Fetch details to show info
    try {
      const all = await inscricaoService.listarPorEncontro(encontroId || '');
      const picked = all.find(i => i.id === id);
      if (picked) setCurrentParticipant(picked);
    } catch (e) {
      console.error(e);
    }
  };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    };

    const handleDelete = async () => {
      if (!recordId) return;
      if (!window.confirm('Deseja realmente remover os dados do veículo deste participante?')) return;

      setIsDeleting(true);
      try {
        await recepcaoService.excluir(recordId);
        toast.success('Veículo removido com sucesso!');
        setRecordId(null);
        setFormData({
          veiculo_tipo: 'carro',
          veiculo_modelo: '',
          veiculo_cor: '',
          veiculo_placa: '',
        });
        if (onSave) onSave();
        onClose();
      } catch (error) {
        console.error('Erro ao excluir dados da recepção:', error);
        toast.error('Erro ao excluir dados.');
      } finally {
        setIsDeleting(false);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParticipacaoId) {
      toast.error('Selecione um participante primeiro.');
      return;
    }

    if (!formData.veiculo_modelo.trim()) {
      toast.error('O modelo do veículo é obrigatório.');
      return;
    }
    if (!formData.veiculo_cor.trim()) {
      toast.error('A cor do veículo é obrigatória.');
      return;
    }
    if (!formData.veiculo_placa.trim()) {
      toast.error('A placa do veículo é obrigatória.');
      return;
    }

    setSaving(true);
    try {
      const cleanedData = {
        ...formData,
        veiculo_placa: cleanPlate(formData.veiculo_placa)
      };
      const result = await recepcaoService.salvar(currentParticipacaoId, cleanedData);
      setRecordId(result.id);
      toast.success('Dados da recepção salvos com sucesso!');
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar dados da recepção:', error);
      toast.error('Erro ao salvar dados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dados Recepção" maxWidth="600px">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Loader className="animate-spin" size={32} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {allowParticipantSelection && !initialParticipacaoId ? (
            <div className="form-group">
              <label className="form-label">Selecionar Participante</label>
              <LiveSearchSelect<InscricaoEnriched>
                value={currentParticipacaoId}
                onChange={handleSelectParticipant}
                fetchData={async (search) => {
                  const all = await inscricaoService.listarPorEncontro(encontroId || '');
                  return all.filter(i => 
                    i.pessoas?.nome_completo?.toLowerCase().includes(search.toLowerCase())
                  );
                }}
                getOptionLabel={(i) => `${i.pessoas?.nome_completo} (${i.equipes?.nome || 'Sem Equipe'})`}
                getOptionValue={(i) => i.id}
                placeholder="Busque pelo nome..."
              />
            </div>
          ) : (
            <>
              <FormField
                label="Nome do proprietário"
                value={initialParticipanteNome || currentParticipant?.pessoas?.nome_completo || ''}
                disabled
              />

              <FormField
                label="Equipe que estará trabalhando"
                value={initialEquipeNome || currentParticipant?.equipes?.nome || ''}
                disabled
              />
            </>
          )}

          <RadioGroup
            label="Tipo de veículo"
            options={[
              { label: 'Carro', value: 'carro' },
              { label: 'Moto', value: 'moto' },
            ]}
            value={formData.veiculo_tipo}
            onChange={val => setFormData({ ...formData, veiculo_tipo: val as 'moto' | 'carro' })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <FormField
              label="Modelo do veículo"
              required
              value={formData.veiculo_modelo}
              onChange={e => setFormData({ ...formData, veiculo_modelo: e.target.value })}
            />
            <FormField
              label="Cor do veículo"
              required
              value={formData.veiculo_cor}
              onChange={e => setFormData({ ...formData, veiculo_cor: e.target.value })}
            />
          </div>

          <FormField
            label="Placa do veículo"
            required
            placeholder="ABC-1234"
            value={formData.veiculo_placa}
            onChange={e => setFormData({ ...formData, veiculo_placa: formatPlate(e.target.value) })}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem' }}>
            <div>
              {recordId && (
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  className="btn-danger-outline" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  disabled={isDeleting || saving}
                >
                  {isDeleting ? <Loader className="animate-spin" size={18} /> : <Trash2 size={18} />}
                  Remover Veículo
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={saving || isDeleting || (!currentParticipacaoId && allowParticipantSelection)} className="btn-primary" style={{ minWidth: '120px' }}>
                {saving ? <Loader className="animate-spin" size={18} /> : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
