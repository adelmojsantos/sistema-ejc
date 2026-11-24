import { useRef, useState } from 'react';
import { Camera, Loader, Minus, Plus, Trash2, Upload, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../ui/Modal';
import { inscricaoService } from '../../services/inscricaoService';
import { userFacingError } from '../../utils/userFacingError';
import './EncontreiroFotoModal.css';

export interface EncontreiroFotoTarget {
  id: string;
  nome: string;
  foto_url: string | null;
  foto_posicao_y: number | null;
}

interface EncontreiroFotoModalProps {
  target: EncontreiroFotoTarget | null;
  onClose: () => void;
  onChange: (participacaoId: string, foto: { foto_url: string | null; foto_posicao_y: number }) => void;
}

const clampPosition = (value: number) => Math.min(100, Math.max(0, value));

export function EncontreiroFotoModal({ target, onClose, onChange }: EncontreiroFotoModalProps) {
  if (!target) return null;

  // A chave reinicia o estado interno ao trocar de integrante ou de foto.
  return (
    <EncontreiroFotoModalContent
      key={`${target.id}:${target.foto_url ?? ''}`}
      target={target}
      onClose={onClose}
      onChange={onChange}
    />
  );
}

function EncontreiroFotoModalContent({
  target,
  onClose,
  onChange,
}: EncontreiroFotoModalProps & { target: EncontreiroFotoTarget }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const savedPosition = target.foto_posicao_y ?? 50;
  const [position, setPosition] = useState(savedPosition);
  const [busy, setBusy] = useState<'upload' | 'position' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasPhoto = Boolean(target.foto_url);
  const positionChanged = position !== savedPosition;

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }

    setBusy('upload');
    const loadingToast = toast.loading('Enviando foto...');
    try {
      const fotoUrl = await inscricaoService.uploadFotoEncontreiro(target.id, file);
      await inscricaoService.definirFotoEncontreiro(target.id, fotoUrl, 50);
      onChange(target.id, { foto_url: fotoUrl, foto_posicao_y: 50 });
      toast.success('Foto atualizada!', { id: loadingToast });
    } catch (error) {
      console.error('Erro ao enviar foto do encontreiro:', error);
      toast.error(userFacingError(error, 'Não foi possível enviar a foto.'), { id: loadingToast });
    } finally {
      setBusy(null);
    }
  };

  const handleSavePosition = async () => {
    if (!target.foto_url) return;
    setBusy('position');
    try {
      await inscricaoService.definirFotoEncontreiro(target.id, target.foto_url, position);
      onChange(target.id, { foto_url: target.foto_url, foto_posicao_y: position });
      toast.success('Enquadramento salvo!');
    } catch (error) {
      console.error('Erro ao salvar enquadramento:', error);
      toast.error(userFacingError(error, 'Não foi possível salvar o enquadramento.'));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    setBusy('remove');
    try {
      await inscricaoService.definirFotoEncontreiro(target.id, null);
      onChange(target.id, { foto_url: null, foto_posicao_y: 50 });
      toast.success('Foto removida.');
    } catch (error) {
      console.error('Erro ao remover foto do encontreiro:', error);
      toast.error(userFacingError(error, 'Não foi possível remover a foto.'));
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  return (
    <Modal isOpen onClose={busy ? () => undefined : onClose} title={target.nome} maxWidth="460px">
      <div className="encontreiro-foto-modal">
        <div className="encontreiro-foto-previews">
          <div className="encontreiro-foto-frame">
            {target.foto_url ? (
              <img
                src={target.foto_url}
                alt={`Foto de ${target.nome}`}
                style={{ objectPosition: `center ${position}%` }}
              />
            ) : (
              <div className="encontreiro-foto-empty">
                <User size={34} />
                <span>Sem foto</span>
              </div>
            )}
            {busy === 'upload' && (
              <div className="encontreiro-foto-loading">
                <Loader size={24} className="animate-spin" />
              </div>
            )}
          </div>
          {target.foto_url && (
            <div className="encontreiro-foto-avatar-preview" aria-hidden="true">
              <img src={target.foto_url} alt="" style={{ objectPosition: `center ${position}%` }} />
              <span>No Quadrante</span>
            </div>
          )}
        </div>

        {hasPhoto && (
          <div className="encontreiro-foto-adjust">
            <label htmlFor={`encontreiro-foto-pos-${target.id}`}>Enquadramento</label>
            <div className="encontreiro-foto-adjust-control">
              <button
                type="button"
                onClick={() => setPosition((current) => clampPosition(current - 2))}
                aria-label="Subir enquadramento"
                disabled={!!busy}
              >
                <Minus size={15} />
              </button>
              <input
                id={`encontreiro-foto-pos-${target.id}`}
                type="range"
                min="0"
                max="100"
                value={position}
                disabled={!!busy}
                onChange={(event) => setPosition(Number(event.target.value))}
              />
              <button
                type="button"
                onClick={() => setPosition((current) => clampPosition(current + 2))}
                aria-label="Descer enquadramento"
                disabled={!!busy}
              >
                <Plus size={15} />
              </button>
            </div>
            {positionChanged && (
              <div className="encontreiro-foto-adjust-actions">
                <button type="button" className="btn-secondary" onClick={() => setPosition(savedPosition)} disabled={!!busy}>
                  Desfazer
                </button>
                <button type="button" className="btn-primary" onClick={() => void handleSavePosition()} disabled={!!busy}>
                  {busy === 'position' ? 'Salvando...' : 'Salvar enquadramento'}
                </button>
              </div>
            )}
          </div>
        )}

        {confirmRemove ? (
          <div className="encontreiro-foto-confirm">
            <span>Remover a foto de {target.nome}?</span>
            <div className="encontreiro-foto-adjust-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirmRemove(false)} disabled={!!busy}>
                Cancelar
              </button>
              <button type="button" className="btn-danger" onClick={() => void handleRemove()} disabled={!!busy}>
                {busy === 'remove' ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        ) : (
          <div className="encontreiro-foto-actions">
            {hasPhoto && (
              <button
                type="button"
                className="encontreiro-foto-action danger"
                onClick={() => setConfirmRemove(true)}
                disabled={!!busy}
              >
                <Trash2 size={17} /> Remover
              </button>
            )}
            <button
              type="button"
              className="encontreiro-foto-action primary"
              onClick={() => inputRef.current?.click()}
              disabled={!!busy}
            >
              {hasPhoto ? <Camera size={17} /> : <Upload size={17} />}
              {hasPhoto ? 'Trocar foto' : 'Adicionar foto'}
            </button>
          </div>
        )}

        <p className="encontreiro-foto-hint">
          A foto aparece ao lado do nome no Quadrante do encontro. Prefira fotos de rosto, com boa iluminação.
        </p>

        <input
          ref={inputRef}
          data-testid="encontreiro-foto-input"
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
            event.target.value = '';
          }}
        />
      </div>
    </Modal>
  );
}
