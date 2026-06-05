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
import type { Encontro } from '../../types/encontro';
import type { Equipe } from '../../types/equipe';

import './SecretariaPlacasEquipesPage.css'

interface PlacaEquipe {
  id: string;
  nome: string;
  Icon?: LucideIcon;
  imageSrc?: string;
  colors: string;
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

export function SecretariaPlacasEquipesPage() {
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [encontroId, setEncontroId] = useState('');
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="secretaria-placas-page fade-in">
      <div className="placas-controls">
        <header className="page-header">
          <div>
            <h2 className="page-title">Placas das Salas</h2>
            <p className="text-muted">Gere uma placa em A4 paisagem para cada equipe.</p>
          </div>
        </header>

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

          <button
            type="button"
            className="btn btn-primary common-button"
            onClick={handlePrint}
            disabled={isLoading || placas.length === 0}
          >
            <Printer size={18} />
            Imprimir PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-muted">Carregando placas...</div>
      ) : placas.length === 0 ? (
        <div className="card text-muted">Nenhuma equipe cadastrada para gerar placas.</div>
      ) : (
        <div className="placas-print-area">
          {placas.map(({ id, nome, Icon, imageSrc }) => (
            <article className="placa-page" key={id}>
              <div className="placa-page__logos">
                <div className="placa-page__logo">
                  <img src={logoEjc} alt="Logo EJC" />
                </div>

                <div className="placa-page__event-name">
                  {selectedEncontro?.nome ?? 'EJC Capelinha'}
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
                <div className="placa-page__icon" /* style={{ background: colors }} */>
                  {imageSrc ? (
                    <img className="placa-page__icon-image" src={imageSrc} alt="" />
                  ) : Icon ? (
                    <Icon strokeWidth={1.7} />
                  ) : null}
                </div>
                <h3 className="placa-page__team">{nome}</h3>
              </div>

              {/* <div className="placa-page__footer">
                {selectedEncontro?.nome ?? 'EJC Capelinha'}
              </div> */}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
