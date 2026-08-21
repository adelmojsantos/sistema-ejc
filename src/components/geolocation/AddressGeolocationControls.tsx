import { CheckCircle2, Loader, MapPin, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { geolocationService } from '../../services/geolocationService';
import type { AddressInput, PersonGeolocationMetadata } from '../../types/geolocation';
import { hasRegionalAddress, hasRegionalReference, isRouteReadyLocation } from '../../types/geolocation';

export type GeolocationFormValue = PersonGeolocationMetadata & {
  latitude?: number | null;
  longitude?: number | null;
};

interface AddressGeolocationControlsProps {
  address: AddressInput;
  value: GeolocationFormValue;
  onChange: (value: GeolocationFormValue) => void;
  disabled?: boolean;
}

function statusText(value: GeolocationFormValue): { label: string; detail: string; color: string } {
  if (isRouteReadyLocation(value)) {
    return {
      label: 'Localização exata confirmada',
      detail: 'Este ponto foi confirmado e pode ser usado para navegação.',
      color: '#059669',
    };
  }
  if (hasRegionalReference(value)) {
    return {
      label: 'Localização aproximada',
      detail: `Localização aproximada pelo ${value.geo_reference_precision === 'cep' ? 'CEP' : 'logradouro'}, usada somente para visualizar a região.`,
      color: '#d97706',
    };
  }
  return {
    label: 'Localização aproximada indisponível',
    detail: 'O endereço continua disponível em texto. Tente novamente após revisar rua, cidade e estado.',
    color: '#64748b',
  };
}

export function AddressGeolocationControls({ address, value, onChange, disabled = false }: AddressGeolocationControlsProps) {
  const [loading, setLoading] = useState(false);
  const status = statusText(value);
  const completeAddress = hasRegionalAddress(address);

  const updateRegionalReference = async () => {
    if (!completeAddress) {
      toast.error('Informe rua, cidade e estado antes de buscar a localização aproximada.');
      return;
    }
    setLoading(true);
    try {
      const { result, update } = await geolocationService.resolveRegionalReferenceForPersistence(address, true);
      onChange({ ...value, ...update });
      if (result.candidate || update.geo_reference_latitude != null) {
        toast.success('Localização aproximada atualizada. Ela não será usada como destino de navegação.');
      } else {
        toast.error('Não foi possível obter a localização aproximada. Revise o endereço e tente novamente.');
      }
    } catch {
      toast.error('O serviço de localização aproximada está indisponível. O endereço pode ser salvo normalmente.');
    } finally {
      setLoading(false);
    }
  };

  const ready = isRouteReadyLocation(value);
  return (
    <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border-color)', borderRadius: 12, padding: '0.9rem', background: 'var(--secondary-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
        {ready ? <CheckCircle2 size={19} color={status.color} /> : hasRegionalReference(value)
          ? <MapPin size={19} color={status.color} />
          : <TriangleAlert size={19} color={status.color} />}
        <div style={{ flex: 1 }}>
          <strong style={{ color: status.color, fontSize: '0.86rem' }}>{status.label}</strong>
          <div style={{ fontSize: '0.75rem', opacity: 0.72, marginTop: 2 }}>{status.detail}</div>
        </div>
      </div>
      <div style={{ marginTop: '0.8rem' }}>
        <button type="button" className="btn-secondary" disabled={disabled || loading || !completeAddress} onClick={() => void updateRegionalReference()}>
          {loading ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />} Tentar novamente
        </button>
      </div>
    </div>
  );
}
