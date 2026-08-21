import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, LocateFixed, MapPinned, Route, Save, TriangleAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { visitacaoService } from '../../services/visitacaoService';
import type { VisitaParticipacaoEnriched } from '../../types/visitacao';
import { getPlanningCoordinate, hasRegionalReference, isRouteReadyLocation } from '../../types/geolocation';
import {
  buildGoogleMapsRouteUrl,
  buildGoogleMapsStopUrl,
  buildWazeStopUrl,
  suggestVisitRoute,
} from '../../utils/visitRoutePlanning';

interface VisitRoutePlannerProps {
  grupoId: string;
  visits: VisitaParticipacaoEnriched[];
  onSaved?: () => void | Promise<void>;
  compact?: boolean;
}

function initialOrder(visits: VisitaParticipacaoEnriched[]) {
  return [...visits].sort((a, b) => {
    const orderA = a.ordem_roteiro ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.ordem_roteiro ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
}

export function VisitRoutePlanner({ grupoId, visits, onSaved, compact = false }: VisitRoutePlannerProps) {
  const [ordered, setOrdered] = useState(() => initialOrder(visits));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => setOrdered(initialOrder(visits)), [visits]);

  const planningCount = ordered.filter(visit => visit.participacoes?.pessoas && getPlanningCoordinate(visit.participacoes.pessoas)).length;
  const googleRouteUrl = useMemo(() => buildGoogleMapsRouteUrl(
    ordered.flatMap(visit => visit.participacoes?.pessoas
      ? [{ ...visit.participacoes.pessoas, id: visit.id }]
      : []),
  ), [ordered]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    setOrdered(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const suggest = () => {
    const applySuggestion = (start?: { latitude: number; longitude: number }) => {
      setOrdered(current => suggestVisitRoute(
        current.map(visit => ({
          ...visit,
          ...visit.participacoes?.pessoas,
        })),
        start,
      ));
    };

    if (!navigator.geolocation) {
      applySuggestion();
      toast('Ordem sugerida a partir do primeiro ponto; GPS não disponível.', { icon: 'ℹ️' });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        applySuggestion({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
        toast.success('Ordem sugerida a partir da sua localização atual.');
      },
      () => {
        applySuggestion();
        setLocating(false);
        toast('Ordem sugerida a partir da primeira referência disponível.', { icon: 'ℹ️' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await visitacaoService.salvarOrdemRoteiro(grupoId, ordered.map(visit => visit.id));
      toast.success('Roteiro compartilhado com a dupla e a coordenação.');
      await onSaved?.();
    } catch (error) {
      console.error('Erro ao salvar roteiro:', error);
      toast.error('Não foi possível salvar o roteiro. Atualize a lista e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" style={{ padding: compact ? '1rem' : '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '1rem' }}>
            <Route size={19} /> Roteiro da dupla
          </h3>
          <p style={{ margin: '0.35rem 0 0', opacity: 0.7, fontSize: '0.8rem' }}>
            {planningCount} de {ordered.length} parada(s) com referência para planejamento.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={suggest} disabled={locating || ordered.length < 2}>
            <LocateFixed size={16} /> {locating ? 'Obtendo GPS...' : 'Sugerir ordem'}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving || ordered.length === 0}>
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar roteiro'}
          </button>
          {googleRouteUrl && (
            <a className="btn-secondary" href={googleRouteUrl} target="_blank" rel="noopener noreferrer">
              <MapPinned size={16} /> Abrir rota
            </a>
          )}
        </div>
      </div>

      {ordered.length > 4 && googleRouteUrl && (
        <p style={{ color: '#b45309', fontSize: '0.78rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <TriangleAlert size={15} /> Para funcionar também no celular, o link externo abre as 4 primeiras paradas com endereço; a ordem completa continua salva no sistema.
        </p>
      )}

      <ol style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'grid', gap: '0.55rem' }}>
        {ordered.map((visit, index) => {
          const person = visit.participacoes?.pessoas;
          const exact = Boolean(person && isRouteReadyLocation(person));
          const regional = Boolean(person && hasRegionalReference(person));
          const routeStop = person ? { ...person, id: visit.id } : null;
          const mapsUrl = routeStop ? buildGoogleMapsStopUrl(routeStop) : null;
          const wazeUrl = routeStop ? buildWazeStopUrl(routeStop) : null;
          return (
            <li key={visit.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem', opacity: person ? 1 : 0.72 }}>
              <strong style={{ minWidth: '1.6rem', textAlign: 'center' }}>{index + 1}</strong>
              <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person?.nome_completo || 'Encontrista'}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.72 }}>
                  {person?.endereco ? `${person.endereco}, ${person.numero || 's/n'} — ${person.bairro || ''}` : 'Endereço incompleto — navegação indisponível'}
                  {(exact || regional) && <span style={{ marginLeft: '0.4rem', color: exact ? '#059669' : '#b45309' }}>• {exact ? 'ponto exato' : 'Localização aproximada'}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" title="Abrir no Google Maps"><ExternalLink size={14} /> Maps</a>}
                {wazeUrl && <a href={wazeUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" title="Abrir no Waze"><ExternalLink size={14} /> Waze</a>}
                <button type="button" className="btn-secondary" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Mover ${person?.nome_completo || 'parada'} para cima`}><ArrowUp size={15} /></button>
                <button type="button" className="btn-secondary" onClick={() => move(index, 1)} disabled={index === ordered.length - 1} aria-label={`Mover ${person?.nome_completo || 'parada'} para baixo`}><ArrowDown size={15} /></button>
              </div>
            </li>
          );
        })}
      </ol>

      <p style={{ margin: '0.8rem 0 0', fontSize: '0.72rem', opacity: 0.62 }}>
        A sugestão usa distância em linha reta e referências aproximadas, portanto é apenas um ponto de partida. Maps e Waze recebem coordenadas somente para pontos exatos; nos demais casos recebem o endereço escrito.
      </p>
    </section>
  );
}
