import { Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import logoEjc from '../../assets/logo-ejc.svg';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { recepcaoService } from '../../services/recepcaoService';
import type { RecepcaoDados } from '../../types/recepcao';
import './IdentificacaoCarrosPage.css';

const normalizeTeamName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const defaultPriorityTeamKeys = ['compras', 'visitacao'];

const sanitizeFileName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

export function IdentificacaoCarrosPage() {
  const { encontros, encontroAtivo, isLoading: isLoadingEncontros } = useEncontros();
  const [encontroId, setEncontroId] = useState('');
  const [registros, setRegistros] = useState<RecepcaoDados[]>([]);
  const [selectedPriorityTeamKeys, setSelectedPriorityTeamKeys] = useState<string[]>(defaultPriorityTeamKeys);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!encontroId) {
      if (encontroAtivo) setEncontroId(encontroAtivo.id);
      else if (encontros.length > 0) setEncontroId(encontros[0].id);
    }
  }, [encontroAtivo, encontroId, encontros]);

  useEffect(() => {
    let isMounted = true;

    if (!encontroId) return;

    const loadRegistros = async () => {
      setIsLoading(true);
      try {
        const data = await recepcaoService.listarTodosPorEncontro(encontroId);
        if (!isMounted) return;
        setRegistros(data);
      } catch (error) {
        console.error('Erro ao carregar veículos para identificação de carros:', error);
        toast.error('Não foi possível carregar os veículos.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadRegistros();

    return () => {
      isMounted = false;
    };
  }, [encontroId]);

  const selectedEncontro = useMemo(
    () => encontros.find(encontro => encontro.id === encontroId) ?? encontroAtivo,
    [encontroAtivo, encontroId, encontros]
  );

  const equipeOptions = useMemo(() => {
    const map = new Map<string, string>();

    registros.forEach(registro => {
      if (registro.participacoes?.participante) return;

      const nome = registro.participacoes?.equipes?.nome?.trim();
      if (!nome) return;

      map.set(normalizeTeamName(nome), nome);
    });

    return Array.from(map, ([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
  }, [registros]);

  useEffect(() => {
    const availableDefaultKeys = equipeOptions
      .filter(equipe => defaultPriorityTeamKeys.some(defaultKey => equipe.key.includes(defaultKey)))
      .map(equipe => equipe.key);

    setSelectedPriorityTeamKeys(availableDefaultKeys);
  }, [encontroId, equipeOptions]);

  const cards = useMemo(() => {
    const usedPriorityIds = new Set<string>();

    const priorityCards = selectedPriorityTeamKeys.flatMap(teamKey => {
      const teamLabel = equipeOptions.find(equipe => equipe.key === teamKey)?.label || teamKey;
      const teamRegistros = registros.filter(registro => {
        if (registro.participacoes?.participante) return false;
        const equipe = normalizeTeamName(registro.participacoes?.equipes?.nome || '');
        const matches = equipe === teamKey;
        if (matches) usedPriorityIds.add(registro.id);
        return matches;
      });

      return teamRegistros.map((registro, index) => ({
        id: `${teamKey}-${registro.id}`,
        badgeLabel: teamLabel,
        isPriority: true,
        isEncontrista: false,
        secondaryLabel: '',
        sort: index,
      }));
    });

    const regularCards = registros
      .filter(registro => !usedPriorityIds.has(registro.id))
      .map((registro, index) => ({
        id: `geral-${registro.id}`,
        badgeLabel: registro.participacoes?.participante
          ? 'Encontrista'
          : registro.participacoes?.equipes?.nome?.trim() || 'Geral',
        isPriority: false,
        isEncontrista: !!registro.participacoes?.participante,
        secondaryLabel: registro.participacoes?.participante
          ? registro.visita_participacao?.visita_grupos?.nome?.trim() || ''
          : '',
        sort: index,
      }));

    return [...priorityCards, ...regularCards].sort((a, b) => {
      const groupDiff = a.badgeLabel.localeCompare(b.badgeLabel, 'pt-BR', { sensitivity: 'base' });
      if (groupDiff !== 0) return groupDiff;
      return a.sort - b.sort;
    });
  }, [equipeOptions, registros, selectedPriorityTeamKeys]);

  const cardSummary = useMemo(() => {
    const prioritarias = cards.filter(card => card.isPriority).length;
    const encontristas = cards.filter(card => card.isEncontrista).length;
    const demais = cards.filter(card => !card.isPriority && !card.isEncontrista).length;
    return { prioritarias, encontristas, demais, total: cards.length };
  }, [cards]);

  const handlePriorityTeamToggle = (teamKey: string) => {
    setSelectedPriorityTeamKeys(current =>
      current.includes(teamKey)
        ? current.filter(key => key !== teamKey)
        : [...current, teamKey]
    );
  };

  const handleSelectAllPriorityTeams = () => {
    setSelectedPriorityTeamKeys(equipeOptions.map(equipe => equipe.key));
  };

  const handleClearPriorityTeams = () => {
    setSelectedPriorityTeamKeys([]);
  };

  const handlePrint = () => {
    if (cards.length === 0) {
      toast.error('Não há registros para imprimir.');
      return;
    }

    const previousTitle = document.title;
    const encontroName = sanitizeFileName(selectedEncontro?.nome || 'Encontro');
    const cleanupPrintTitle = () => {
      document.title = previousTitle;
      document.body.classList.remove('carros-printing');
    };

    document.title = `Placas Recepção - ${encontroName}`;
    document.body.classList.add('carros-printing');
    window.addEventListener('afterprint', cleanupPrintTitle, { once: true });
    window.print();
  };

  return (
    <section className="carros-page fade-in">
      <PageHeader
        title="Identificação de carros"
        subtitle="Secretaria / Impressos"
        backPath="/secretaria/impressos"
      />

      <div className="card carros-toolbar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="carros-encontro">Encontro</label>
          <select
            id="carros-encontro"
            className="form-input"
            value={encontroId}
            onChange={event => setEncontroId(event.target.value)}
            disabled={isLoadingEncontros || encontros.length === 0}
          >
            {encontros.map(encontro => (
              <option key={encontro.id} value={encontro.id}>
                {encontro.edicao ? `${encontro.edicao}º EJC - ` : ''}{encontro.nome}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-primary common-button"
          onClick={handlePrint}
          disabled={isLoading || cards.length === 0}
        >
          <Printer size={18} />
          Imprimir PDF
        </button>
      </div>

      {!isLoading && equipeOptions.length > 0 && (
        <div className="card carros-priority-filter">
          <div className="carros-priority-filter__header">
            <div>
              <strong>Equipes prioritárias</strong>
              <span>{selectedPriorityTeamKeys.length} de {equipeOptions.length} selecionada(s)</span>
            </div>
            <div>
              <button type="button" className="btn-secondary" onClick={handleSelectAllPriorityTeams}>
                Selecionar todas
              </button>
              <button type="button" className="btn-secondary" onClick={handleClearPriorityTeams} disabled={selectedPriorityTeamKeys.length === 0}>
                Limpar
              </button>
            </div>
          </div>

          <div className="carros-priority-filter__grid">
            {equipeOptions.map(equipe => (
              <label className="carros-priority-option" key={equipe.key}>
                <input
                  type="checkbox"
                  checked={selectedPriorityTeamKeys.includes(equipe.key)}
                  onChange={() => handlePriorityTeamToggle(equipe.key)}
                />
                <span>{equipe.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {!isLoading && cards.length > 0 && (
        <div className="carros-summary">
          <span><strong>{cardSummary.total}</strong> placa(s) no total</span>
          <span><strong>{cardSummary.prioritarias}</strong> prioritária(s)</span>
          <span><strong>{cardSummary.encontristas}</strong> encontrista(s)</span>
          <span><strong>{cardSummary.demais}</strong> demais equipe(s)</span>
        </div>
      )}

      {isLoading ? (
        <div className="card text-muted">Carregando veículos...</div>
      ) : cards.length === 0 ? (
        <div className="card text-muted">Nenhum registro cadastrado para gerar identificações.</div>
      ) : (
        <>
          <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>
          <div className="carros-print-area">
            {cards.map(card => (
              <article
                className={`carro-card ${card.isPriority ? 'carro-card--priority' : ''} ${card.isEncontrista ? 'carro-card--encontrista' : ''}`}
                key={card.id}
              >
                <img className="carro-card__watermark" src={logoEjc} alt="" aria-hidden="true" />
                <header className="carro-card__top">
                  {selectedEncontro?.logo_url ? (
                    <img src={selectedEncontro.logo_url} alt={`Logo ${selectedEncontro.nome}`} />
                  ) : (
                    <span className="carro-card__logo-placeholder">Logo encontro</span>
                  )}
                  <strong>{selectedEncontro?.edicao ? `${selectedEncontro.edicao}º EJC` : selectedEncontro?.nome || 'EJC'}</strong>
                  <span>{selectedEncontro?.tema ? `"${selectedEncontro.tema}"` : 'Identificação do encontro'}</span>
                </header>

                <div className="carro-card__body">
                  <em className="carro-card__team-badge">{card.badgeLabel}</em>
                  <strong className="carro-card__parking">Estacionamento</strong>
                  {card.secondaryLabel && (
                    <span className="carro-card__secondary">{card.secondaryLabel}</span>
                  )}
                  {card.isPriority && <strong className="carro-card__priority">Acesso prioritário</strong>}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
