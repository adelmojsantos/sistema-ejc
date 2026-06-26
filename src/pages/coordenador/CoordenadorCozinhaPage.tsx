import { ChefHat, ChevronDown, Loader, RefreshCw, Shield, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/ui/PageHeader';
import { useEncontros } from '../../contexts/EncontroContext';
import { useAuth } from '../../hooks/useAuth';
import { cozinhaService, type CozinhaEquipeResumo, type CozinhaMapaResumo } from '../../services/cozinhaService';
import type { Encontro } from '../../types/encontro';
import './CoordenadorCozinhaPage.css';

const emptyResumo: CozinhaMapaResumo = {
  encontristasTotal: 0,
  encontristasPresentes: 0,
  criancasTotal: 0,
  equipesRefeicao: [],
  equipesEscondidas: [],
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

const normalizeName = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isCozinhaTeam = (value: string | null | undefined) => normalizeName(value).includes('cozinha');

const sumEquipes = (items: CozinhaEquipeResumo[]) => items.reduce((total, item) => total + item.total, 0);

function EquipesAccordion({ equipes, title }: { equipes: CozinhaEquipeResumo[]; title: string }) {
  const total = sumEquipes(equipes);

  return (
    <details className="cozinha-accordion">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{equipes.length} equipe(s)</small>
        </span>
        <span className="cozinha-accordion__total">{total}</span>
        <ChevronDown size={18} />
      </summary>

      <div className="cozinha-team-list">
        {equipes.length === 0 ? (
          <p className="cozinha-empty">Nenhuma equipe encontrada.</p>
        ) : equipes.map((equipe) => (
          <div className="cozinha-team-row" key={equipe.id}>
            <span>{equipe.nome}</span>
            <strong>{equipe.total}</strong>
          </div>
        ))}
      </div>
    </details>
  );
}

function QuantityCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail?: string }) {
  return (
    <article className="cozinha-quantity-card">
      <span className="cozinha-quantity-card__icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}

function getSelectedEncontro(encontros: Encontro[], encontroAtivo: Encontro | null | undefined, userEncontroId?: string | null) {
  return encontroAtivo
    ?? encontros.find((encontro) => encontro.id === userEncontroId)
    ?? encontros[0]
    ?? null;
}

export function CoordenadorCozinhaPage() {
  const { userParticipacao, hasPermission } = useAuth();
  const { encontroAtivo, encontros } = useEncontros();
  const isAdmin = hasPermission('modulo_admin');
  const canAccess = isAdmin || Boolean(userParticipacao?.coordenador && isCozinhaTeam(userParticipacao.equipes?.nome));
  const selectedEncontro = getSelectedEncontro(encontros, encontroAtivo, userParticipacao?.encontro_id);
  const dias = useMemo(() => enumerateDays(selectedEncontro?.data_inicio, selectedEncontro?.data_fim), [selectedEncontro?.data_fim, selectedEncontro?.data_inicio]);
  const today = toDateInputValue(new Date());
  const initialDay = dias.includes(today) ? today : dias[0];
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [resumo, setResumo] = useState<CozinhaMapaResumo>(emptyResumo);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedDay((current) => dias.includes(current) ? current : initialDay);
  }, [dias, initialDay]);

  const loadResumo = useCallback(async () => {
    if (!selectedEncontro?.id || !selectedDay || !canAccess) {
      setResumo(emptyResumo);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setResumo(await cozinhaService.obterMapa(selectedEncontro.id, selectedDay));
    } catch (error) {
      console.error('Erro ao carregar mapa da cozinha:', error);
      toast.error('Não foi possível carregar o mapa da cozinha.');
    } finally {
      setLoading(false);
    }
  }, [canAccess, selectedDay, selectedEncontro?.id]);

  useEffect(() => {
    loadResumo();
  }, [loadResumo]);

  const equipesRefeicaoTotal = sumEquipes(resumo.equipesRefeicao);
  const equipesEscondidasTotal = sumEquipes(resumo.equipesEscondidas);
  const refeicaoEncontristasTotal = resumo.encontristasPresentes + equipesRefeicaoTotal + resumo.criancasTotal;
  const totalGeral = refeicaoEncontristasTotal + equipesEscondidasTotal;

  if (!canAccess) {
    return (
      <section className="cozinha-page fade-in">
        <PageHeader title="Mapa da Cozinha" subtitle="Coordenador" backPath="/coordenador/minha-equipe" />
        <div className="cozinha-access-card card">
          <Shield size={28} />
          <div>
            <h2>Acesso restrito à equipe Cozinha</h2>
            <p>Este painel fica disponível para o coordenador da Cozinha e para administradores.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cozinha-page fade-in">
      <PageHeader
        title="Mapa da Cozinha"
        subtitle={selectedEncontro?.nome || 'Coordenador'}
        backPath="/coordenador/minha-equipe"
        actions={(
          <button type="button" className="btn-secondary" onClick={loadResumo} disabled={loading}>
            {loading ? <Loader className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Atualizar
          </button>
        )}
      />

      <section className="cozinha-days" aria-label="Dias do encontro">
        {dias.map((dia) => (
          <button
            type="button"
            key={dia}
            className={selectedDay === dia ? 'is-active' : ''}
            onClick={() => setSelectedDay(dia)}
          >
            {formatDayLabel(dia)}
          </button>
        ))}
      </section>

      <div className="cozinha-summary-grid">
        <QuantityCard icon={<ChefHat size={22} />} label="Refeição com os encontristas" value={refeicaoEncontristasTotal} detail="Presentes + equipes + crianças" />
        <QuantityCard icon={<Users size={22} />} label="Refeição equipes escondidas" value={equipesEscondidasTotal} detail="Equipes vermelhas" />
        <QuantityCard icon={<ChefHat size={22} />} label="Total do dia" value={totalGeral} />
      </div>

      {loading ? (
        <div className="cozinha-loading card">
          <Loader className="animate-spin" />
          Carregando quantidades...
        </div>
      ) : (
        <div className="cozinha-meals-grid">
          <article className="cozinha-meal-card">
            <header>
              <div>
                <span>Refeição</span>
                <h2>Encontristas</h2>
              </div>
              <strong>{refeicaoEncontristasTotal}</strong>
            </header>

            <div className="cozinha-breakdown">
              <div className="cozinha-breakdown-row cozinha-breakdown-row--featured">
                <span>Encontristas</span>
                <strong>Total {resumo.encontristasTotal} - Presentes {resumo.encontristasPresentes}</strong>
              </div>

              <EquipesAccordion title="Equipes" equipes={resumo.equipesRefeicao} />

              <div className="cozinha-breakdown-row">
                <span>Crianças</span>
                <strong>{resumo.criancasTotal}</strong>
              </div>
            </div>
          </article>

          <article className="cozinha-meal-card cozinha-meal-card--hidden">
            <header>
              <div>
                <span>Refeição</span>
                <h2>Equipes escondidas</h2>
              </div>
              <strong>{equipesEscondidasTotal}</strong>
            </header>

            <div className="cozinha-breakdown">
              <EquipesAccordion title="Equipes" equipes={resumo.equipesEscondidas} />
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
