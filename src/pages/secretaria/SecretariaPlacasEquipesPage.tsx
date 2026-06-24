import type { LucideIcon } from 'lucide-react';
import {
  BrushCleaning,
  ChefHat,
  Church,
  ClipboardList,
  Coffee,
  Crown,
  Footprints,
  GlassWaterIcon,
  HandHeart,
  MicVocalIcon,
  Music2,
  Phone,
  Printer,
  Puzzle,
  ShoppingCart,
  Sparkles,
  Store,
  UsersRound,
  Volume2
} from 'lucide-react';
import { Circle } from 'phosphor-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import cantoIcon from '../../assets/cantando.png';
import circulosIcon from '../../assets/circulo.png';
import boaVontadeIcon from '../../assets/garrafa-de-agua.png';
import logoEjc from '../../assets/logo-ejc.svg';
import monstranceIcon from '../../assets/monstrance-blessed-sacrament.png';
import ligacaoIcon from '../../assets/ligacao.png';
import ordemIcon from '../../assets/cleaning-products.png';
import secretariaIcon from '../../assets/dossie.png';
import somIluminacaoIcon from '../../assets/som-e-iluminacao.png';
import visitacaoIcon from '../../assets/localizador-de-mapa.png';
import recreacaoInfantilIcon from '../../assets/playtime.png';
import recepcaoIcon from '../../assets/manobrista.png';
import comprasIcon from '../../assets/compras.png';
import cozinhaIcon from '../../assets/kitchen.png';
import dinamicaIcon from '../../assets/theater-masks.png';
import apresentadoresIcon from '../../assets/apresentadores.png';
import miniMercadoIcon from '../../assets/mini-mercado.png';
import liturgiaIcon from '../../assets/liturgia.png';
import cafeIcon from '../../assets/cafe.png';
import { encontroService } from '../../services/encontroService';
import { equipeService } from '../../services/equipeService';
import { visitacaoService } from '../../services/visitacaoService';
import { PageHeader } from '../../components/ui/PageHeader';
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';
import type { VisitaGrupo, VisitaParticipacaoEnriched } from '../../types/visitacao';

import './SecretariaPlacasEquipesPage.css'

interface PlacaEquipe {
  id: string;
  nome: string;
  Icon?: LucideIcon;
  imageSrc?: string;
  colors: string;
  subtitle?: string;
  isPhoto?: boolean;
}

const iconBackgrounds = [
  'linear-gradient(135deg, #e0f2fe, #eff6ff)',
  'linear-gradient(135deg, #ffe4e6, #fdf2f8)',
  'linear-gradient(135deg, #fef3c7, #fff7ed)',
  'linear-gradient(135deg, #ede9fe, #faf5ff)',
  'linear-gradient(135deg, #cffafe, #f0fdfa)',
  'linear-gradient(135deg, #ecfccb, #f0fdf4)',
  'linear-gradient(135deg, #ffedd5, #fef2f2)',
  'linear-gradient(135deg, #fae8ff, #fdf2f8)',
  'linear-gradient(135deg, #fef9c3, #fffbeb)',
  'linear-gradient(135deg, #e0e7ff, #eff6ff)',
  'linear-gradient(135deg, #f5f5f4, #fafafa)',
  'linear-gradient(135deg, #d1fae5, #f0fdf4)',
  'linear-gradient(135deg, #f1f5f9, #f9fafb)',
  'linear-gradient(135deg, #fee2e2, #fff1f2)',
  'linear-gradient(135deg, #f3e8ff, #ede9fe)',
  'linear-gradient(135deg, #dbeafe, #f0f9ff)',
  'linear-gradient(135deg, #f4f4f5, #f8fafc)',
  'linear-gradient(135deg, #ccfbf1, #ecfeff)',
  'linear-gradient(135deg, #fef3c7, #f5f5f4)'
];

const normalizeTeamName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const teamIcons: Record<string, LucideIcon> = {
  apresentadores: MicVocalIcon,
  'boa vontade': GlassWaterIcon,
  cafe: Coffee,
  canto: Music2,
  circulos: Circle,
  compras: ShoppingCart,
  cozinha: ChefHat,
  dinamica: Sparkles,
  dirigentes: Crown,
  ligacao: Phone,
  liturgia: Church,
  'mini mercado': Store,
  ordem: BrushCleaning,
  recepcao: HandHeart,
  'recreacao inf.': Puzzle,
  'recreacao infantil': Puzzle,
  secretaria: ClipboardList,
  'som e iluminacao': Volume2,
  visitacao: Footprints
};

interface SecretariaPlacasEquipesPageProps {
  mode?: 'salas' | 'duplas';
}

export function SecretariaPlacasEquipesPage({ mode }: SecretariaPlacasEquipesPageProps) {
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [encontroId, setEncontroId] = useState('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [grupos, setGrupos] = useState<VisitaGrupo[]>([]);
  const [vinculos, setVinculos] = useState<VisitaParticipacaoEnriched[]>([]);
  const [activeTab, setActiveTab] = useState<'salas' | 'duplas'>(mode ?? 'salas');
  const [paperSize, setPaperSize] = useState<'a4' | 'a5'>('a4');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDuplas, setIsLoadingDuplas] = useState(false);

  useEffect(() => {
    if (mode) setActiveTab(mode);
  }, [mode]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [encontrosData, equipesData] = await Promise.all([
          encontroService.listar(),
          equipeService.listar()
        ]);

        if (!isMounted) return;

        const orderedEncontros = [...encontrosData].sort((a, b) => (b.edicao ?? 0) - (a.edicao ?? 0));
        const selected = orderedEncontros.find((encontro) => encontro.ativo) ?? orderedEncontros[0];

        setEncontros(orderedEncontros);
        setEncontroId(selected?.id ?? '');
        setEquipes(equipesData);
      } catch (error) {
        console.error('Erro ao carregar dados para placas das equipes:', error);
        toast.error('Não foi possível carregar os dados das placas.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!encontroId) {
      setGrupos([]);
      setVinculos([]);
      return;
    }

    let isMounted = true;
    const loadDuplas = async () => {
      setIsLoadingDuplas(true);
      try {
        const [gruposData, vinculosData] = await Promise.all([
          visitacaoService.listarGrupos(encontroId),
          visitacaoService.listarParticipacaoPorEncontro(encontroId)
        ]);
        if (!isMounted) return;
        setGrupos(gruposData);
        setVinculos(vinculosData);
      } catch (error) {
        console.error('Erro ao carregar duplas para placas:', error);
        toast.error('Não foi possível carregar as placas das duplas.');
      } finally {
        if (isMounted) setIsLoadingDuplas(false);
      }
    };

    loadDuplas();
    return () => {
      isMounted = false;
    };
  }, [encontroId]);

  const selectedEncontro = useMemo(
    () => encontros.find((encontro) => encontro.id === encontroId) ?? null,
    [encontroId, encontros]
  );

  const placas = useMemo<PlacaEquipe[]>(() => {
    const source = equipes
      .map((equipe) => ({
        id: equipe.id,
        nome: equipe.nome?.trim() || 'Equipe sem nome'
      }))
      .filter((equipe) => equipe.nome);

    const hasCapela = source.some((equipe) => normalizeTeamName(equipe.nome) === 'capela');
    const withCapela = hasCapela ? source : [...source, { id: 'capela-avulsa', nome: 'Capela' }];

    return withCapela.map((equipe, index) => {
      const normalizedName = normalizeTeamName(equipe.nome);
      const isCapela = normalizedName === 'capela';
      const isBoaVontade = normalizedName === 'boa vontade';
      const isCanto = normalizedName === 'canto';
      const isCirculos = normalizedName === 'circulos';
      const isDinamica = normalizedName === 'dinamica';
      const isLigacao = normalizedName === 'ligacao';
      const isOrdem = normalizedName === 'ordem';
      const isSecretaria = normalizedName === 'secretaria';
      const isSomIluminacao = normalizedName === 'som e iluminacao';
      const isVisitacao = normalizedName === 'visitacao';
      const isRecreacaoInfantil = normalizedName === 'recreacao inf.' || normalizedName === 'recreacao infantil';
      const isRecepcao = normalizedName === 'recepcao';
      const isCompras = normalizedName === 'compras';
      const isCozinha = normalizedName === 'cozinha';
      const isApresentadores = normalizedName === 'apresentadores';
      const isMiniMercado = normalizedName === 'mini mercado';
      const isLiturgia = normalizedName === 'liturgia';
      const isCafe = normalizedName === 'cafe';
      return {
        ...equipe,
        Icon: isCapela || isBoaVontade || isCanto || isCirculos || isDinamica || isLigacao || isOrdem || isSecretaria || isSomIluminacao || isVisitacao || isRecreacaoInfantil || isRecepcao || isCompras || isCozinha || isApresentadores || isMiniMercado || isLiturgia || isCafe ? undefined : teamIcons[normalizedName] ?? UsersRound,
        imageSrc: isCapela
          ? monstranceIcon
          : isApresentadores
            ? apresentadoresIcon
            : isBoaVontade
              ? boaVontadeIcon
              : isCanto
                ? cantoIcon
                : isCirculos
                  ? circulosIcon
                  : isDinamica
                    ? dinamicaIcon
                    : isLigacao
                      ? ligacaoIcon
                      : isOrdem
                        ? ordemIcon
                        : isSecretaria
                          ? secretariaIcon
                          : isSomIluminacao
                            ? somIluminacaoIcon
                            : isVisitacao
                              ? visitacaoIcon
                              : isRecreacaoInfantil
                                ? recreacaoInfantilIcon
                                : isRecepcao
                                  ? recepcaoIcon
                                  : isCompras
                                    ? comprasIcon
                                    : isCozinha
                                      ? cozinhaIcon
                                      : isMiniMercado
                                        ? miniMercadoIcon
                                        : isLiturgia
                                          ? liturgiaIcon
                                          : isCafe
                                            ? cafeIcon
                                            : undefined,
        colors: iconBackgrounds[index % iconBackgrounds.length]
      };
    });
  }, [equipes]);

  const placasDuplas = useMemo<PlacaEquipe[]>(() => {
    return grupos.map((grupo, index) => {
      const visitados = vinculos.filter(vinculo =>
        vinculo.grupo_id === grupo.id &&
        !vinculo.visitante &&
        vinculo.status === 'realizada'
      ).length;

      return {
        id: grupo.id,
        nome: grupo.nome?.trim() || 'Dupla sem nome',
        imageSrc: grupo.foto_url || undefined,
        Icon: grupo.foto_url ? undefined : UsersRound,
        colors: iconBackgrounds[index % iconBackgrounds.length],
        subtitle: `${visitados} ${visitados === 1 ? 'encontrista' : 'encontristas'}`,
        isPhoto: !!grupo.foto_url
      };
    });
  }, [grupos, vinculos]);

  const placasAtivas = activeTab === 'salas' ? placas : placasDuplas;
  const loadingAtivo = isLoading || (activeTab === 'duplas' && isLoadingDuplas);

  const handlePrint = () => {
    const cleanupPrintClass = () => {
      document.body.classList.remove('placas-equipes-printing');
    };

    document.body.classList.add('placas-equipes-printing');
    window.addEventListener('afterprint', cleanupPrintClass, { once: true });
    window.print();
  };

  return (
    <section className="secretaria-placas-page fade-in">
      <div className="placas-controls">
        <PageHeader
          title={activeTab === 'salas' ? 'Placa das Salas' : 'Placa de duplas'}
          subtitle="Secretaria / Impressos"
          backPath="/secretaria/impressos"
          tabs={!mode ? (
            <div className="tabs-modern-container placas-tabs" role="tablist" aria-label="Tipo de placa">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'salas'}
                className={`tab-btn-modern ${activeTab === 'salas' ? 'active' : ''}`}
                onClick={() => setActiveTab('salas')}
              >
                Salas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'duplas'}
                className={`tab-btn-modern ${activeTab === 'duplas' ? 'active' : ''}`}
                onClick={() => setActiveTab('duplas')}
              >
                Duplas
              </button>
            </div>
          ) : undefined}
        />

        <div className="card placas-toolbar">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="encontro-placas">Encontro</label>
            <select
              id="encontro-placas"
              className="form-input"
              value={encontroId}
              onChange={(event) => setEncontroId(event.target.value)}
              disabled={isLoading || encontros.length === 0}
            >
              {encontros.map((encontro) => (
                <option key={encontro.id} value={encontro.id}>
                  {encontro.edicao ? `${encontro.edicao}º EJC - ` : ''}{encontro.nome}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'duplas' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="paper-size">Tamanho do papel</label>
              <select
                id="paper-size"
                className="form-input"
                value={paperSize}
                onChange={(event) => setPaperSize(event.target.value as 'a4' | 'a5')}
              >
                <option value="a4">A4 retrato — 4 placas</option>
                <option value="a5">A5 retrato — 4 placas</option>
              </select>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary common-button"
            onClick={handlePrint}
            disabled={loadingAtivo || placasAtivas.length === 0}
          >
            <Printer size={18} />
            Imprimir PDF
          </button>
        </div>

      </div>

      {loadingAtivo ? (
        <div className="card text-muted">Carregando placas...</div>
      ) : placasAtivas.length === 0 ? (
        <div className="card text-muted">
          {activeTab === 'salas' ? 'Nenhuma equipe cadastrada para gerar placas.' : 'Nenhuma dupla cadastrada para gerar placas.'}
        </div>
      ) : (
        <>
          <style>{`@media print { @page { size: ${activeTab === 'duplas' ? `${paperSize.toUpperCase()} portrait` : 'A4 landscape'}; margin: 0; } }`}</style>
          <div className={`placas-print-area placas-print-area--${activeTab} ${activeTab === 'duplas' ? `placas-print-area--${paperSize}` : ''}`}>
            {placasAtivas.map(({ id, nome, Icon, imageSrc, subtitle, isPhoto }) => {
              return (
                <div className="placa-preview-item" key={id}>
                  <article className={`placa-page ${subtitle ? 'placa-page--duo' : ''}`}>
                    <div className="placa-page__logos">
                      <div className="placa-page__logo">
                        <img src={logoEjc} alt="Logo EJC" />
                      </div>

                      <div className="placa-page__event-name">
                        {selectedEncontro?.nome ?? 'EJC Capelinha'}
                        <p>{selectedEncontro?.tema ?? ''}</p>
                      </div>

                      <div className="placa-page__logo placa-page__logo--encontro">
                        {selectedEncontro?.logo_url ? (
                          <img src={selectedEncontro.logo_url} alt={`Logo ${selectedEncontro.nome}`} />
                        ) : (
                          <span className="placa-page__logo-placeholder">Logo do encontro</span>
                        )}
                      </div>
                    </div>

                    <div className="placa-page__body">
                      <div className={`placa-page__icon ${isPhoto ? 'placa-page__icon--photo' : ''}`}>
                        {imageSrc ? (
                          <img
                            className="placa-page__icon-image"
                            src={imageSrc}
                            alt=""
                          />
                        ) : Icon ? (
                          <Icon strokeWidth={1.7} />
                        ) : null}
                      </div>
                      <h3 className={`placa-page__team ${subtitle ? 'placa-page__team--duo' : ''}`}>{nome}</h3>
                      {subtitle && <p className="placa-page__subtitle">{subtitle}</p>}
                    </div>

                    {/* <div className="placa-page__footer">
                {selectedEncontro?.nome ?? 'EJC Capelinha'}
              </div> */}
                  </article>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
