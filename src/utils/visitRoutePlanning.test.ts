import { describe, expect, it } from 'vitest';
import {
  buildGoogleMapsRouteUrl,
  buildGoogleMapsStopUrl,
  buildWazeStopUrl,
  haversineDistanceKm,
  suggestVisitRoute,
  type VisitRouteStop,
} from './visitRoutePlanning';

const stop = (id: string, latitude: number | null, longitude: number | null): VisitRouteStop => ({
  id,
  latitude,
  longitude,
  geo_status: latitude == null ? 'failed' : 'verified',
});

const approximateStop = (id: string, latitude: number, longitude: number): VisitRouteStop => ({
  id,
  latitude: null,
  longitude: null,
  geo_status: 'pending',
  geo_reference_latitude: latitude,
  geo_reference_longitude: longitude,
  geo_reference_source: 'nominatim',
  geo_reference_precision: 'street',
  endereco: 'Rua das Flores',
  numero: '123',
  bairro: 'Centro',
  cidade: 'Franca',
  estado: 'SP',
  cep: '14400000',
});

describe('visitRoutePlanning', () => {
  it('calcula distância geodésica sem serviço pago', () => {
    expect(haversineDistanceKm(
      { latitude: -20.538, longitude: -47.401 },
      { latitude: -20.548, longitude: -47.401 },
    )).toBeCloseTo(1.11, 1);
  });

  it('sugere o vizinho mais próximo e mantém pontos não verificados no final', () => {
    const result = suggestVisitRoute([
      stop('distante', -20.60, -47.40),
      stop('sem-ponto', null, null),
      stop('perto', -20.54, -47.40),
    ], { latitude: -20.53, longitude: -47.40 });
    expect(result.map(item => item.id)).toEqual(['perto', 'distante', 'sem-ponto']);
  });

  it('usa referências regionais apenas para sugerir a ordem', () => {
    const result = suggestVisitRoute([
      approximateStop('distante', -20.60, -47.40),
      approximateStop('perto', -20.54, -47.40),
    ], { latitude: -20.53, longitude: -47.40 });
    expect(result.map(item => item.id)).toEqual(['perto', 'distante']);
  });

  it('não cria navegação para localização não verificada', () => {
    expect(buildGoogleMapsStopUrl(stop('x', null, null))).toBeNull();
    expect(buildWazeStopUrl(stop('x', null, null))).toBeNull();
  });

  it('navega pelo endereço textual e nunca pela referência aproximada', () => {
    const visit = approximateStop('aproximado', -20.999999, -47.999999);
    const maps = buildGoogleMapsStopUrl(visit)!;
    const waze = buildWazeStopUrl(visit)!;
    expect(new URL(maps).searchParams.get('query')).toContain('Rua das Flores, 123');
    expect(new URL(waze).searchParams.get('q')).toContain('Rua das Flores, 123');
    expect(`${maps}${waze}`).not.toContain('-20.999999');
    expect(new URL(waze).searchParams.get('ll')).toBeNull();
  });

  it('usa endereços textuais em rota com referências aproximadas', () => {
    const url = buildGoogleMapsRouteUrl([
      approximateStop('a', -20.51, -47.41),
      approximateStop('b', -20.52, -47.42),
    ])!;
    expect(new URL(url).searchParams.get('destination')).toContain('Rua das Flores, 123');
    expect(url).not.toContain('-20.52');
  });

  it('gera links gratuitos por coordenada, sem enviar endereço', () => {
    const visits = [stop('a', -20.53, -47.40), stop('b', -20.54, -47.41)];
    expect(buildGoogleMapsRouteUrl(visits)).toContain('destination=-20.54%2C-47.41');
    expect(buildGoogleMapsStopUrl(visits[0])).toContain('query=-20.53%2C-47.4');
    expect(buildWazeStopUrl(visits[0])).toContain('navigate=yes');
  });

  it('limita a rota externa ao total portátil de quatro paradas', () => {
    const visits = Array.from({ length: 6 }, (_, index) => stop(String(index), -20.5 - index / 100, -47.4));
    const url = buildGoogleMapsRouteUrl(visits)!;
    const waypoints = new URL(url).searchParams.get('waypoints')?.split('|') || [];
    expect(waypoints).toHaveLength(3);
    expect(url).not.toContain('-20.55');
  });
});
