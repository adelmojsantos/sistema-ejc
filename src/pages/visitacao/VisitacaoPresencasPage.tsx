import { AlertCircle, CalendarDays, Camera, CheckCircle2, ImagePlus, Loader, RefreshCw, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { encontroPresencaService } from '../../services/encontroPresencaService';
import { visitacaoService } from '../../services/visitacaoService';
import type { EncontroPresencaParticipante, EncontroPresencaResumo } from '../../types/encontroPresenca';
import type { VisitaGrupo } from '../../types/visitacao';
import './VisitacaoPresencasPage.css';

const emptyResumo: EncontroPresencaResumo = {
  total: 0,
  presentes: 0,
  ausentes: 0,
  pendentes: 0,
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const enumerateDays = (start?: string, end?: string) => {
  if (!start || !end) return [toDateInputValue(new Date())];

  const days: string[] = [];
  const cursor = parseDate(start);
  const last = parseDate(end);

  while (cursor <= last) {
    days.push(toDateInputValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days.length > 0 ? days : [toDateInputValue(new Date())];
};

const formatDayLabel = (date: string) => parseDate(date).toLocaleDateString('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

export function VisitacaoPresencasPage() {
  const { userParticipacao, hasPermission } = useAuth();
  const { encontroAtivo, encontros } = useEncontros();
  const canManageAll = hasPermission('modulo_admin') || hasPermission('modulo_visitacao_coordenar');
  const selectedEncontro = encontroAtivo ?? encontros[0] ?? null;
  const encontroId = selectedEncontro?.id ?? userParticipacao?.encontro_id ?? '';

  const dias = useMemo(() => enumerateDays(selectedEncontro?.data_inicio, selectedEncontro?.data_fim), [selectedEncontro?.data_fim, selectedEncontro?.data_inicio]);
  const today = toDateInputValue(new Date());
  const initialDay = dias.includes(today) ? today : dias[0];

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [grupoNome, setGrupoNome] = useState('');
  const [participantes, setParticipantes] = useState<EncontroPresencaParticipante[]>([]);
  const [geralStats, setGeralStats] = useState<EncontroPresencaResumo>(emptyResumo);
  const [loading, setLoading] = useState(true);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [photoParticipant, setPhotoParticipant] = useState<EncontroPresencaParticipante | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isPhotoActionSheetOpen, setIsPhotoActionSheetOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedDay((current) => dias.includes(current) ? current : initialDay);
  }, [dias, initialDay]);

  useEffect(() => {
    async function loadInitialGroup() {
      if (!encontroId) return;

      try {
        if (canManageAll) {
          const data = await visitacaoService.listarGrupos(encontroId);
          setGrupos(data);
          setSelectedGrupoId((current) => current || sessionStorage.getItem('presenca_visitacao_grupo_id') || data[0]?.id || '');
          return;
        }

        if (!userParticipacao?.id) return;
        const grupo = await encontroPresencaService.obterGrupoDoVisitante(userParticipacao.id);
        setSelectedGrupoId(grupo?.id || '');
        setGrupoNome(grupo?.nome || '');
      } catch (error) {
        console.error('Erro ao carregar dupla para presença:', error);
        toast.error('Não foi possível identificar a dupla da visitação.');
      }
    }

    loadInitialGroup();
  }, [canManageAll, encontroId, userParticipacao?.id]);

  useEffect(() => {
    if (selectedGrupoId || canManageAll) sessionStorage.setItem('presenca_visitacao_grupo_id', selectedGrupoId);
  }, [selectedGrupoId]);

  useEffect(() => {
    if (!canManageAll) return;
    const grupo = grupos.find((item) => item.id === selectedGrupoId);
    setGrupoNome(selectedGrupoId ? grupo?.nome || '' : 'Todas as duplas');
  }, [canManageAll, grupos, selectedGrupoId]);

  const loadParticipantes = useCallback(async () => {
    if (!encontroId || !selectedDay || (!selectedGrupoId && !canManageAll)) {
      setParticipantes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setParticipantes(await encontroPresencaService.listarParticipantes(encontroId, selectedDay, selectedGrupoId || undefined));
    } catch (error) {
      console.error('Erro ao carregar presenças:', error);
      toast.error('Não foi possível carregar os encontristas.');
    } finally {
      setLoading(false);
    }
  }, [canManageAll, encontroId, selectedDay, selectedGrupoId]);

  useEffect(() => {
    loadParticipantes();
  }, [loadParticipantes]);

  const loadResumoGeral = useCallback(async () => {
    if (!canManageAll || !encontroId || !selectedDay) {
      setGeralStats(emptyResumo);
      return;
    }

    setLoadingResumo(true);
    try {
      setGeralStats(await encontroPresencaService.obterResumoGeral(encontroId, selectedDay));
    } catch (error) {
      console.error('Erro ao carregar resumo geral de presenças:', error);
      toast.error('Não foi possível carregar o resumo geral.');
    } finally {
      setLoadingResumo(false);
    }
  }, [canManageAll, encontroId, selectedDay]);

  useEffect(() => {
    loadResumoGeral();
  }, [loadResumoGeral]);

  const stats = useMemo<EncontroPresencaResumo>(() => {
    const presentes = participantes.filter((item) => item.presenca?.presente).length;
    const ausentes = participantes.filter((item) => item.presenca && !item.presenca.presente).length;
    return {
      total: participantes.length,
      presentes,
      ausentes,
      pendentes: participantes.length - presentes - ausentes,
    };
  }, [participantes]);

  const atualizarDados = () => {
    loadParticipantes();
    loadResumoGeral();
  };

  const salvarPresenca = async (participante: EncontroPresencaParticipante, presente: boolean) => {
    setSavingId(participante.participacao_id);
    try {
      if (participante.presenca?.presente === presente) {
        await encontroPresencaService.desmarcarPresenca(encontroId, participante.participacao_id, selectedDay);
        setParticipantes((current) => current.map((item) => (
          item.participacao_id === participante.participacao_id ? { ...item, presenca: null } : item
        )));
        loadResumoGeral();
        toast.success(presente ? 'Presença desmarcada.' : 'Ausência desmarcada.');
        return;
      }

      const presenca = await encontroPresencaService.salvarPresenca({
        encontroId,
        participacaoId: participante.participacao_id,
        grupoId: participante.grupo_id,
        data: selectedDay,
        presente,
        observacao: participante.presenca?.observacao ?? null,
      });

      setParticipantes((current) => current.map((item) => (
        item.participacao_id === participante.participacao_id ? { ...item, presenca } : item
      )));
      loadResumoGeral();
      toast.success(presente ? 'Presença confirmada.' : 'Ausência marcada.');
    } catch (error) {
      console.error('Erro ao salvar presença:', error);
      toast.error('Não foi possível salvar a presença.');
    } finally {
      setSavingId(null);
    }
  };

  const substituirFoto = async (file?: File) => {
    if (!file || !photoParticipant) return;

    setUploadingPhoto(true);
    try {
      const fotoUrl = await visitacaoService.uploadFoto(photoParticipant.participacao_id, file);
      await visitacaoService.atualizarParticipacao(photoParticipant.participacao_id, { foto_url: fotoUrl });

      setParticipantes((current) => current.map((item) => (
        item.participacao_id === photoParticipant.participacao_id ? { ...item, foto_url: fotoUrl } : item
      )));
      setPhotoParticipant((current) => current ? { ...current, foto_url: fotoUrl } : current);
      toast.success('Foto atualizada.');
    } catch (error) {
      console.error('Erro ao substituir foto:', error);
      toast.error('Não foi possível substituir a foto.');
    } finally {
      setUploadingPhoto(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const abrirSeletorFoto = () => {
    if (uploadingPhoto) return;
    if (window.innerWidth <= 768) {
      setIsPhotoActionSheetOpen(true);
      return;
    }
    galleryInputRef.current?.click();
  };

  return (
    <div className="visitacao-presencas-page fade-in">
      <PageHeader
        title="Presença no Encontro"
        subtitle={grupoNome ? `Visitação / ${grupoNome}` : 'Visitação'}
        backPath="/visitacao"
        actions={(
          <button type="button" className="btn-secondary" onClick={atualizarDados} disabled={loading || loadingResumo}>
            <RefreshCw size={16} className={loading || loadingResumo ? 'animate-spin' : undefined} />
            Atualizar
          </button>
        )}
      />

      <section className="visitacao-presencas-controls">
        {canManageAll && (
          <label className="standard-label-group">
            <span className="form-label standard-label">Dupla</span>
            <select className="form-input" value={selectedGrupoId} onChange={(event) => setSelectedGrupoId(event.target.value)}>
              <option value="">Todas as duplas</option>
              {grupos.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome || 'Dupla sem nome'}</option>)}
            </select>
          </label>
        )}

        <div className="visitacao-presencas-days" role="tablist" aria-label="Dias do encontro">
          {dias.map((dia) => (
            <button
              key={dia}
              type="button"
              className={selectedDay === dia ? 'is-active' : ''}
              onClick={() => setSelectedDay(dia)}
            >
              <CalendarDays size={15} />
              {formatDayLabel(dia)}
            </button>
          ))}
        </div>
      </section>

      {canManageAll ? (
        <section className={`visitacao-presencas-dashboard ${!selectedGrupoId ? 'is-single' : ''}`}>
          <ResumoCard title="Geral do dia" resumo={geralStats} loading={loadingResumo} />
          {selectedGrupoId && <ResumoCard title={`Dupla ${grupoNome}`} resumo={stats} loading={loading} />}
        </section>
      ) : (
        <section className="visitacao-presencas-summary">
          <div><strong>{stats.total}</strong><span>Encontristas</span></div>
          <div className="is-present"><strong>{stats.presentes}</strong><span>Presentes</span></div>
          <div className="is-absent"><strong>{stats.ausentes}</strong><span>Ausentes</span></div>
          <div><strong>{stats.pendentes}</strong><span>Não marcados</span></div>
        </section>
      )}

      {!selectedGrupoId && !canManageAll ? (
        <div className="visitacao-presencas-state">
          <AlertCircle size={34} />
          <h3>Selecione uma dupla</h3>
          <p>Escolha a dupla da visitação para marcar a presença dos encontristas.</p>
        </div>
      ) : loading ? (
        <div className="visitacao-presencas-state">
          <Loader className="animate-spin" size={28} />
          <p>Carregando encontristas...</p>
        </div>
      ) : participantes.length === 0 ? (
        <div className="visitacao-presencas-state">
          <AlertCircle size={34} />
          <h3>Nenhum encontrista encontrado</h3>
          <p>Confira a montagem das duplas na coordenação da visitação.</p>
        </div>
      ) : (
        <section className="visitacao-presencas-grid">
          {participantes.map((participante) => {
            const isSaving = savingId === participante.participacao_id;
            const presente = participante.presenca?.presente === true;
            const ausente = participante.presenca?.presente === false;

            return (
              <article
                key={participante.participacao_id}
                className={`visitacao-presenca-card ${presente ? 'is-present' : ''} ${ausente ? 'is-absent' : ''}`}
              >
                <div className="visitacao-presenca-card__body">
                  <button
                    type="button"
                    className="visitacao-presenca-avatar"
                    onClick={() => setPhotoParticipant(participante)}
                    title={participante.foto_url ? 'Visualizar ou substituir foto' : 'Adicionar foto'}
                  >
                    {participante.foto_url
                      ? <img src={participante.foto_url} alt={participante.nome} />
                      : participante.nome.charAt(0).toUpperCase()}
                  </button>
                  <div>
                    <h3>{participante.nome}</h3>
                    <p>{participante.circulo || 'Sem círculo'}{participante.comunidade ? ` • ${participante.comunidade}` : ''}</p>
                  </div>
                </div>

                <div className="visitacao-presenca-card__status">
                  {presente ? <><CheckCircle2 size={15} /> Presente</> : ausente ? <><UserX size={15} /> Ausente</> : 'Ainda não marcado'}
                </div>

                <div className="visitacao-presenca-card__actions">
                  <button
                    type="button"
                    className="btn-presenca-confirmar"
                    onClick={() => salvarPresenca(participante, true)}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader className="animate-spin" size={15} /> : <UserCheck size={15} />}
                    {presente ? 'Desmarcar presença' : 'Confirmar presença'}
                  </button>
                  <button
                    type="button"
                    className="btn-presenca-ausente"
                    onClick={() => salvarPresenca(participante, false)}
                    disabled={isSaving}
                  >
                    <UserX size={15} />
                    {ausente ? 'Desmarcar ausência' : 'Marcar ausência'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Modal
        isOpen={!!photoParticipant}
        onClose={() => setPhotoParticipant(null)}
        title={photoParticipant?.nome || 'Foto do encontrista'}
        maxWidth="520px"
      >
        {photoParticipant && (
          <div className="visitacao-presenca-photo-modal">
            <div className="visitacao-presenca-photo-preview">
              {photoParticipant.foto_url
                ? <img src={photoParticipant.foto_url} alt={photoParticipant.nome} />
                : <span>{photoParticipant.nome.charAt(0).toUpperCase()}</span>}
            </div>
            <p>{photoParticipant.foto_url ? 'Visualize a foto atual ou substitua por uma nova.' : 'Este encontrista ainda não possui foto. Adicione uma imagem.'}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={abrirSeletorFoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? <Loader className="animate-spin" size={16} /> : <ImagePlus size={16} />}
              {uploadingPhoto ? 'Enviando...' : photoParticipant.foto_url ? 'Substituir foto' : 'Adicionar foto'}
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => substituirFoto(event.target.files?.[0])}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => substituirFoto(event.target.files?.[0])}
            />
          </div>
        )}
      </Modal>

      {isPhotoActionSheetOpen && (
        <div className="photo-actions-modal-overlay" onClick={() => setIsPhotoActionSheetOpen(false)}>
          <div className="photo-actions-modal" onClick={(event) => event.stopPropagation()}>
            <div className="photo-actions-header">
              <h3>{photoParticipant?.foto_url ? 'Substituir Foto' : 'Adicionar Foto'}</h3>
              <p>Como você deseja inserir a foto?</p>
            </div>
            <div className="photo-actions-buttons">
              <button
                type="button"
                className="photo-action-btn"
                onClick={() => {
                  setIsPhotoActionSheetOpen(false);
                  cameraInputRef.current?.click();
                }}
              >
                <Camera size={20} />
                Tirar Foto (Câmera)
              </button>
              <button
                type="button"
                className="photo-action-btn"
                onClick={() => {
                  setIsPhotoActionSheetOpen(false);
                  galleryInputRef.current?.click();
                }}
              >
                <ImagePlus size={20} />
                Escolher da Galeria
              </button>
            </div>
            <button type="button" className="photo-actions-cancel" onClick={() => setIsPhotoActionSheetOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumoCard({ title, resumo, loading }: { title: string; resumo: EncontroPresencaResumo; loading: boolean }) {
  return (
    <article className="visitacao-presencas-dashboard-card">
      <header>
        <span>{title}</span>
        {loading && <Loader className="animate-spin" size={16} />}
      </header>
      <div className="visitacao-presencas-dashboard-card__main">
        <strong>{resumo.total}</strong>
        <span>Total</span>
      </div>
      <div className="visitacao-presencas-dashboard-card__metrics">
        <div className="is-present"><strong>{resumo.presentes}</strong><span>Presentes</span></div>
        <div className="is-absent"><strong>{resumo.ausentes}</strong><span>Ausentes</span></div>
        <div><strong>{resumo.pendentes}</strong><span>Não marcados</span></div>
      </div>
    </article>
  );
}
