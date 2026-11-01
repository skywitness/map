import { describe, expect, it, vi } from 'vitest';
import type { Map as MaplibreMap } from 'maplibre-gl';

vi.mock('./pmtiles', () => ({
  loadTilesIndex: () =>
    Promise.resolve({
      'countries-10m': { file: 'countries-10m-1a2b3c4d.pmtiles', layer: 'countries', minzoom: 5, maxzoom: 8, bytes: 1, generatedAt: '' },
    }),
  pmtilesSource: () => ({ type: 'vector', url: 'pmtiles://x', promoteId: 'iso3' }),
}));

const { installFineBorders, setFineNoData, FINE_SOURCE, FINE_ZOOM } = await import('./fineBorders');

type Layer = { id: string; type: string; source: string; minzoom?: number; maxzoom?: number; filter?: unknown; paint: Record<string, unknown> };

/** 只有用到的方法的假地圖 */
function fakeMap() {
  const layers: Layer[] = ['data-fill', 'data-nodata', 'data-hover', 'data-border', 'data-halo', 'data-highlight', 'rail'].map((id) => ({
    id,
    type: id.includes('border') || id.includes('halo') || id.includes('highlight') || id === 'rail' ? 'line' : 'fill',
    source: id === 'data-nodata' ? 'nodata' : id === 'rail' ? 'railways' : 'countries',
    paint: {},
  }));
  const sources = new Set(['countries', 'nodata', 'railways']);
  const states = new Map<string, Record<string, unknown>>();
  const handlers = new Map<string, Set<(e: unknown) => void>>();
  const view = { zoom: 2, loaded: false };
  const find = (id: string) => layers.find((l) => l.id === id);
  const map = {
    getStyle: () => ({ layers: layers.map((l) => ({ ...l, paint: { ...l.paint } })) }),
    getLayer: (id: string) => find(id),
    getSource: (id: string) => (sources.has(id) ? { id } : undefined),
    addSource: (id: string) => sources.add(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: (layer: Layer, before?: string) => {
      const i = before ? layers.findIndex((l) => l.id === before) : layers.length;
      layers.splice(i < 0 ? layers.length : i, 0, layer);
    },
    removeLayer: (id: string) => layers.splice(layers.findIndex((l) => l.id === id), 1),
    setFeatureState: (f: { source: string; sourceLayer?: string; id: string }, s: Record<string, unknown>) => {
      const key = `${f.source}/${f.sourceLayer ?? ''}/${f.id}`;
      states.set(key, { ...states.get(key), ...s });
    },
    setPaintProperty: (id: string, name: string, value: unknown) => {
      find(id)!.paint[name] = value;
    },
    setLayoutProperty: () => {},
    setFilter: (id: string, filter: unknown) => {
      find(id)!.filter = filter;
    },
    setLayerZoomRange: (id: string, min: number, max: number) => Object.assign(find(id)!, { minzoom: min, maxzoom: max }),
    getZoom: () => view.zoom,
    isSourceLoaded: () => view.loaded,
    on: (type: string, fn: (e: unknown) => void) => (handlers.get(type) ?? handlers.set(type, new Set()).get(type)!).add(fn),
    off: (type: string, fn: (e: unknown) => void) => handlers.get(type)?.delete(fn),
  };
  const fire = (type: string, e: unknown = {}) => handlers.get(type)?.forEach((fn) => fn(e));
  return { map: map as unknown as MaplibreMap, layers, states, view, fire, find };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('放大後的國界（1:10m 雙胞胎圖層）', () => {
  it('加上之前設的 feature-state 補到 1:10m，之後的跟著走；圖磚到齊才換手', async () => {
    const { map, layers, states, view, fire, find } = fakeMap();
    installFineBorders(map);
    map.setFeatureState({ source: 'countries', id: 'TWN' }, { fill: '#123456' });
    await flush();
    // 雙胞胎排在原本那層的正後面，先不畫
    expect(layers.map((l) => l.id)).toEqual([
      'data-fill',
      'data-fill-fine',
      'data-nodata',
      'data-nodata-fine',
      'data-hover',
      'data-hover-fine',
      'data-border',
      'data-border-fine',
      'data-halo',
      'data-halo-fine',
      'data-highlight',
      'data-highlight-fine',
      'rail',
    ]);
    expect(find('data-fill-fine')).toMatchObject({ source: FINE_SOURCE, minzoom: FINE_ZOOM, filter: ['==', ['literal', 1], 0] });
    expect(states.get(`${FINE_SOURCE}/countries/TWN`)).toEqual({ fill: '#123456' });
    map.setFeatureState({ source: 'countries', id: 'TWN' }, { selected: true });
    expect(states.get(`${FINE_SOURCE}/countries/TWN`)).toEqual({ fill: '#123456', selected: true });
    map.setPaintProperty('data-border', 'line-color', '#fff');
    expect(find('data-border-fine')!.paint['line-color']).toBe('#fff');
    // 其他 source、圖層不受影響
    map.setFeatureState({ source: 'bubbles', id: 'TWN' }, { hover: true });
    expect(states.get(`${FINE_SOURCE}/countries/TWN`)?.hover).toBeUndefined();

    setFineNoData(map, ['ESH']);
    view.zoom = 6;
    fire('sourcedata');
    // 還沒到齊：雙胞胎不畫，1:50m 照舊畫在所有縮放
    expect(find('data-fill-fine')!.filter).toEqual(['==', ['literal', 1], 0]);
    expect(find('data-fill')!.maxzoom).toBeUndefined();
    view.loaded = true;
    fire('sourcedata');
    expect(find('data-fill-fine')!.filter).toBeNull();
    expect(find('data-nodata-fine')!.filter).toEqual(['in', ['get', 'iso3'], ['literal', ['ESH']]]);
    expect(find('data-fill')).toMatchObject({ minzoom: 0, maxzoom: FINE_ZOOM });
    setFineNoData(map, ['ESH', 'GRL']);
    expect(find('data-nodata-fine')!.filter).toEqual(['in', ['get', 'iso3'], ['literal', ['ESH', 'GRL']]]);
  });

  it('1:10m 的圖磚出錯就拿掉，換回 1:50m 畫到所有縮放；取消的請求不算', async () => {
    const { map, layers, view, fire, find } = fakeMap();
    installFineBorders(map);
    await flush();
    view.zoom = 6;
    view.loaded = true;
    fire('sourcedata');
    fire('error', { sourceId: FINE_SOURCE, error: { name: 'AbortError' } });
    expect(find('data-fill-fine')).toBeDefined();
    fire('error', { sourceId: FINE_SOURCE, error: { name: 'Error' } });
    expect(layers.some((l) => l.id.endsWith('-fine'))).toBe(false);
    expect(map.getSource(FINE_SOURCE)).toBeUndefined();
    expect(find('data-fill')!.maxzoom).toBe(24);
  });
});
