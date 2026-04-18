import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FormField } from '../ui/FormField';
import { RadioGroup } from '../ui/RadioGroup';
import { recepcaoService } from '../../services/recepcaoService';
import type { RecepcaoDadosFormData } from '../../types/recepcao';

interface RecepcaoDadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  participacaoId: string;
  participanteNome: string;
  equipeNome: string;
}

export function RecepcaoDadosModal({ isOpen, onClose, participacaoId, participanteNome, equipeNome }: RecepcaoDadosModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<RecepcaoDadosFormData>({
    veiculo_tipo: 'carro',
    veiculo_modelo: '',
    veiculo_cor: '',
    veiculo_placa: '',
  });

  useEffect(() => {
    if (isOpen && participacaoId) {
      loadDados();
    }
  }, [isOpen, participacaoId]);

  const loadDados = async () => {
    setLoading(true);
    try {
      const dados = await recepcaoService.obterPorParticipacao(participacaoId);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await recepcaoService.salvar(participacaoId, formData);
      toast.success('Dados da recepção salvos com sucesso!');
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
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <FormField
            label="Nome do proprietário"
            value={participanteNome}
            disabled
          />

          <FormField
            label="Equipe que estará trabalhando"
            value={equipeNome}
            disabled
          />

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
            value={formData.veiculo_placa}
            onChange={e => setFormData({ ...formData, veiculo_placa: e.target.value })}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary" style={{ minWidth: '120px' }}>
              {saving ? <Loader className="animate-spin" size={18} /> : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
