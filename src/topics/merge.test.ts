import { describe, expect, it } from 'vitest';
import { absorb, hostOnly, rebaseFile, topicPart } from './merge';
import { indicatorPath, topicFile, type TopicDefinition } from './types';

const small: TopicDefinition = {
  id: 'small',
  title: { zh: '小主題', en: 'Small' },
  shortTitle: { zh: '小主題', en: 'Small' },
  defaultIndicator: 'map',
  defaultYear: 2020,
  timeless: true,
  focus: [100, -10, 120, 10],
  sources: [],
  indicators: [
    { id: 'map', label: 'Map', description: '', unit: '', file: 'map.json', layer: { kind: 'none' } },
    { id: 'count', label: 'Count', description: '', unit: '', file: 'count/{item}.json', layer: { kind: 'choropleth' } },
  ] as TopicDefinition['indicators'],
  dimension: { label: 'Kind', options: [{ id: 'a', label: 'A' }], defaultOption: 'a' },
  overlays: [{ kind: 'points', id: 'dots', file: 'dots.json', label: 'Dots', radius: 3, color: '#000' }] as TopicDefinition['overlays'],
  listPanel: { label: 'List', file: 'list.json', rows: () => [] },
  tooltipLines: (_iso3, { indicator }) => [indicator],
};

describe('absorb', () => {
  it('讀原本的資料夾、主題層級的設定搬到指標上', () => {
    const { indicators, overlays, listPanel } = absorb(small, { rename: { map: 'small-map' } });
    expect(indicators.map((i) => i.id)).toEqual(['small-map', 'count']);
    expect(indicators[0].file).toBe('../small/map.json');
    expect(indicators[0].timeless).toBe(true);
    expect(indicators[0].focus).toEqual([100, -10, 120, 10]);
    // 只有用 {item} 的指標拿到主題的子項目
    expect(indicators[0].dimension).toBeUndefined();
    expect(indicators[1].dimension?.defaultOption).toBe('a');
    // 原本整個主題都顯示的圖層與清單，改成只在拼進來的指標顯示
    expect(overlays[0]).toMatchObject({ id: 'dots', topic: 'small', indicators: ['small-map', 'count'] });
    expect(listPanel[0]).toMatchObject({ file: '../small/list.json', indicators: ['small-map', 'count'] });
  });

  it('只拿幾個指標時，只帶那幾個指標的圖層', () => {
    const def = { ...small, overlays: [{ ...small.overlays![0], indicators: ['count'] }] } as TopicDefinition;
    expect(absorb(def, { only: ['map'] }).overlays).toEqual([]);
    expect(absorb(def, { only: ['count'], overlayPrefix: 's-' }).overlays.map((o) => o.id)).toEqual(['s-dots']);
    expect(() => absorb(def, { only: ['nope'] })).toThrow();
  });

  it('拼進大主題以後路徑照樣解析到原本的資料夾', () => {
    const big = { id: 'big' };
    const [map, count] = absorb(small).indicators;
    const path = (i: typeof map, item: string | null) => indicatorPath(big, i as unknown as Parameters<typeof indicatorPath>[1], item);
    expect(path(map, null)).toBe('topics/small/map.json');
    expect(path(count, 'a')).toBe('topics/small/count/a.json');
    expect(topicFile(big, 'own.json')).toBe('topics/big/own.json');
    expect(rebaseFile('small', '../other/x.json')).toBe('../other/x.json');
  });

  it('tooltip 多寫的幾行拿到原本的指標 id', () => {
    const part = topicPart(small, { rename: { map: 'small-map' } });
    const ctx = { indicator: 'small-map' } as Parameters<NonNullable<TopicDefinition['tooltipLines']>>[1];
    expect(part.tooltipLines?.('TWN', ctx)).toEqual(['map']);
    expect(part.name).toEqual({ zh: '小主題', en: 'Small' });
  });
});

describe('hostOnly', () => {
  it('大主題沒寫 indicators 的圖層與清單只在自己的指標顯示', () => {
    const host = hostOnly(small);
    expect(host.overlays?.[0].indicators).toEqual(['map', 'count']);
    expect([host.listPanel].flat()[0]?.indicators).toEqual(['map', 'count']);
  });
});
