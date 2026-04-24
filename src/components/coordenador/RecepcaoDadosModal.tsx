import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader } from 'lucide-react';
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
        setFormData({
          veiculo_tipo: dados.veiculo_tipo,
          veiculo_modelo: dados.veiculo_modelo,
          veiculo_cor: dados.veiculo_cor,
          veiculo_placa: dados.veiculo_placa,
        });
      } else {
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
      toast.error('Erro ao carregar dados.');
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

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParticipacaoId) {
      toast.error('Selecione um participante primeiro.');
      return;
    }
    setSaving(true);
    try {
      const cleanedData = {
        ...formData,
        veiculo_placa: cleanPlate(formData.veiculo_placa)
      };
      await recepcaoService.salvar(currentParticipacaoId, cleanedData);
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving || (!currentParticipacaoId && allowParticipantSelection)} className="btn-primary" style={{ minWidth: '120px' }}>
              {saving ? <Loader className="animate-spin" size={18} /> : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
