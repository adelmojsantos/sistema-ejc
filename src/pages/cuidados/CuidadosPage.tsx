import {
  AlertTriangle,
  HeartPulse,
  Loader,
  Mail,
  Pill,
  Search,
  UtensilsCrossed,
  X
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { useDebounce } from '../../hooks/useDebounce';
import { cuidadosService } from '../../services/cuidadosService';
import { encontroService } from '../../services/encontroService';
import type { CuidadosFilter, CuidadosRegistro } from '../../types/cuidados';
import type { Encontro } from '../../types/encontro';
import { formatPhone, normalizeString } from '../../utils/stringUtils';
import './CuidadosPage.css';

const hasValue = (value?: string | null) => Boolean(value?.trim());
const whatsappLink = (phone: string) => `https://wa.me/55${phone.replace(/\D/g, '')}`;

function CuidadoInfo({
  icon,
  label,
  value,
  tone,
  active
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
  tone: 'food' | 'health' | 'warning';
  active: boolean;
}) {
  if (!active) return null;

  return (
    <div className={`cuidados-info cuidados-info--${tone}`}>
      <div className="cuidados-info__icon">{icon}</div>
      <div>
        <span>{label}</span>
        <p>{hasValue(value) ? value : 'Sim, sem descrição informada.'}</p>
      </div>
    </div>
  );
}

function CuidadosCard({ registro }: { registro: CuidadosRegistro }) {
  return (
    <article className="cuidados-card">
      <div className="cuidados-card__top">
        <div>
          <h3>{registro.nome}</h3>
          <p>
            {[registro.circulo, registro.equipe].filter(Boolean).join(' • ') || 'Sem vínculo informado'}
          </p>
        </div>

        <div className="cuidados-card__contact">
          {registro.telefone && (
            <a href={whatsappLink(registro.telefone)} target="_blank" rel="noopener noreferrer">
              {formatPhone(registro.telefone)}
            </a>
          )}
          {registro.email && (
            <span title={registro.email}>
              <Mail size={13} />
              {registro.email}
            </span>
          )}
        </div>
      </div>

      <div className="cuidados-card__body">
        <CuidadoInfo
          icon={<UtensilsCrossed size={18} />}
          label="Restrição alimentar"
          value={registro.restricao_alimentar}
          tone="food"
          active={registro.possui_restricao_alimentar === true}
        />
        <CuidadoInfo
          icon={<AlertTriangle size={18} />}
          label="Alergia"
          value={registro.alergia}
          tone="warning"
          active={registro.possui_alergia === true}
        />
        <CuidadoInfo
          icon={<Pill size={18} />}
          label="Medicamento contínuo"
          value={registro.medicamento_continuo}
          tone="health"
          active={registro.usa_medicamento_continuo === true}
        />
        <CuidadoInfo
          icon={<HeartPulse size={18} />}
          label="Observações de saúde"
          value={registro.observacoes_saude}
          tone="health"
          active={registro.possui_observacao_saude === true}
        />
      </div>
    </article>
  );
}

export function CuidadosPage() {
  const { hasPermission } = useAuth();
  const { encontros, encontroAtivo } = useEncontros();
  const [selectedEncontroId, setSelectedEncontroId] = useState('');
  const [registros, setRegistros] = useState<CuidadosRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<CuidadosFilter>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const canChangeEncontro = hasPermission('modulo_admin');

  useEffect(() => {
    if (!selectedEncontroId) {
      if (encontroAtivo) setSelectedEncontroId(encontroAtivo.id);
      else if (encontros.length > 0) setSelectedEncontroId(encontros[0].id);
    }
  }, [encontroAtivo, encontros, selectedEncontroId]);

  const loadRegistros = useCallback(async () => {
    if (!selectedEncontroId) return;

    setLoading(true);
    try {
      const data = await cuidadosService.listarPorEncontro(selectedEncontroId);
      setRegistros(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar cuidados do encontro.');
    } finally {
      setLoading(false);
    }
  }, [selectedEncontroId]);

  useEffect(() => {
    loadRegistros();
  }, [loadRegistros]);

  const alimentacaoRegistros = useMemo(
    () => registros.filter((registro) => registro.possui_restricao_alimentar === true),
    [registros]
  );

  const alergiasRegistros = useMemo(
    () => registros.filter((registro) => registro.possui_alergia === true),
    [registros]
  );

  const medicamentosRegistros = useMemo(
    () => registros.filter((registro) => registro.usa_medicamento_continuo === true),
    [registros]
  );

  const observacoesRegistros = useMemo(
    () => registros.filter((registro) => registro.possui_observacao_saude === true),
    [registros]
  );

  const saudeRegistros = useMemo(
    () =>
      registros.filter(
        (registro) =>
          registro.possui_alergia === true ||
          registro.usa_medicamento_continuo === true ||
          registro.possui_observacao_saude === true
      ),
    [registros]
  );

  const semDescricaoRegistros = useMemo(
    () =>
      registros.filter(
        (registro) =>
          (registro.possui_restricao_alimentar === true && !hasValue(registro.restricao_alimentar)) ||
          (registro.possui_alergia === true && !hasValue(registro.alergia)) ||
          (registro.usa_medicamento_continuo === true && !hasValue(registro.medicamento_continuo)) ||
          (registro.possui_observacao_saude === true && !hasValue(registro.observacoes_saude))
      ),
    [registros]
  );

  const currentRegistros = useMemo(() => {
    if (activeFilter === 'alimentacao') return alimentacaoRegistros;
    if (activeFilter === 'alergias') return alergiasRegistros;
    if (activeFilter === 'medicamentos') return medicamentosRegistros;
    if (activeFilter === 'observacoes') return observacoesRegistros;
    if (activeFilter === 'sem_descricao') return semDescricaoRegistros;
    return registros;
  }, [
    activeFilter,
    alergiasRegistros,
    alimentacaoRegistros,
    medicamentosRegistros,
    observacoesRegistros,
    registros,
    semDescricaoRegistros
  ]);

  const filteredRegistros = useMemo(() => {
    const term = normalizeString(debouncedSearch.trim());
    if (!term) return currentRegistros;

    return currentRegistros.filter((registro) => {
      const searchable = [
        registro.nome,
        registro.email,
        registro.telefone,
        registro.equipe,
        registro.circulo,
        registro.restricao_alimentar,
        registro.alergia,
        registro.medicamento_continuo,
        registro.observacoes_saude
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeString(searchable).includes(term);
    });
  }, [currentRegistros, debouncedSearch]);

  const filters = (
    <div className="cuidados-tabs" role="tablist" aria-label="Tipos de cuidado">
      <button
        type="button"
        className={`cuidados-tab ${activeFilter === 'todos' ? 'cuidados-tab--active' : ''}`}
        onClick={() => setActiveFilter('todos')}
      >
        <HeartPulse size={18} />
        Todos
        <span>{registros.length}</span>
      </button>
      <button
        type="button"
        className={`cuidados-tab ${activeFilter === 'alimentacao' ? 'cuidados-tab--active' : ''}`}
        onClick={() => setActiveFilter('alimentacao')}
      >
        <UtensilsCrossed size={18} />
        Alimentação
        <span>{alimentacaoRegistros.length}</span>
      </button>
      <button
        type="button"
        className={`cuidados-tab ${activeFilter === 'alergias' ? 'cuidados-tab--active' : ''}`}
        onClick={() => setActiveFilter('alergias')}
      >
        <AlertTriangle size={18} />
        Alergias
        <span>{alergiasRegistros.length}</span>
      </button>
      <button
        type="button"
        className={`cuidados-tab ${activeFilter === 'medicamentos' ? 'cuidados-tab--active' : ''}`}
        onClick={() => setActiveFilter('medicamentos')}
      >
        <Pill size={18} />
        Medicamentos
        <span>{medicamentosRegistros.length}</span>
      </button>
      <button
        type="button"
        className={`cuidados-tab ${activeFilter === 'observacoes' ? 'cuidados-tab--active' : ''}`}
        onClick={() => setActiveFilter('observacoes')}
      >
        <HeartPulse size={18} />
        Observações
        <span>{observacoesRegistros.length}</span>
      </button>
      <button
        type="button"
        className={`cuidados-tab ${activeFilter === 'sem_descricao' ? 'cuidados-tab--active' : ''}`}
        onClick={() => setActiveFilter('sem_descricao')}
      >
        <X size={18} />
        Sem descrição
        <span>{semDescricaoRegistros.length}</span>
      </button>
    </div>
  );

  return (
    <div className="cuidados-page fade-in">
      <PageHeader
        title="Cuidados"
        subtitle="Alimentação e saúde dos encontristas"
        backPath="/dashboard"
        tabs={filters}
      />

      <section className="cuidados-toolbar card">
        <div className="form-group">
          <label className="form-label">Encontro</label>
          <LiveSearchSelect<Encontro>
            value={selectedEncontroId}
            onChange={(value) => setSelectedEncontroId(value)}
            fetchData={(search, page) => encontroService.buscarComPaginacao(search, page)}
            getOptionLabel={(encontro) => `${encontro.nome}${encontro.ativo ? ' (Ativo)' : ''}`}
            getOptionValue={(encontro) => encontro.id}
            placeholder="Selecionar encontro..."
            initialOptions={encontros}
            disabled={!canChangeEncontro}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Buscar</label>
          <div className="form-input-wrapper">
            <div className="form-input-icon">
              <Search size={16} />
            </div>
            <input
              type="text"
              className="form-input form-input--with-icon"
              placeholder="Nome, círculo, equipe ou observação..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="cuidados-clear-search"
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="cuidados-loading card">
          <Loader className="spin" size={22} />
          Carregando cuidados...
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="cuidados-empty card">
          <HeartPulse size={34} />
          <h3>Nenhum cuidado encontrado</h3>
          <p>
            {debouncedSearch
              ? 'Tente ajustar a busca para encontrar outro registro.'
              : 'Não há informações cadastradas para esta visão no encontro selecionado.'}
          </p>
        </div>
      ) : (
        <section className="cuidados-list">
          {filteredRegistros.map((registro) => (
            <CuidadosCard key={registro.participacao_id} registro={registro} />
          ))}
        </section>
      )}
    </div>
  );
}
