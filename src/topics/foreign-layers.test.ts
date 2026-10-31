import { describe, expect, it } from 'vitest';
import { foreignKey, foreignLayerId, foreignTopic, isForeignKey, loadForeignLayer, shareableOverlays } from './foreign-layers';
import { loadSharedLayer, sharedSourceTopic } from './shared-layers';
import type { OverlayDef, TopicDefinition } from './types';

const point = (id: string, extra: Record<string, unknown> = {}) =>
  ({ kind: 'points', id, file: `${id}.json`, label: { zh: id, en: id }, radius: 3, color: '#000', tooltip: () => ({ title: '' }), ...extra }) as OverlayDef;

describe('shareableOverlays', () => {
  it('只收這個主題自己的點、線圖層，排除即時資料、匯入的線、依子項目或年份換檔、借來的與標了不分享的', () => {
    const topic = {
      id: 'demo',
      overlays: [
        point('ok'),
        { kind: 'lines', id: 'line', file: 'l.json', label: { zh: '線', en: 'Line' } },
        point('live', { fromLive: () => null }),
        { kind: 'lines', id: 'mine', file: '', label: { zh: '我的', en: 'Mine' }, local: true },
        point('brand', { file: 'points/{item}.json' }),
        point('drift', { file: 'drift/{year}.json' }),
        point('borrowed', { topic: 'other' }),
        point('own-folder', { topic: 'demo' }),
        point('variant', { shareable: false }),
        point('months', { shareable: 'untimed' }),
        { kind: 'night', id: 'night', label: { zh: '夜', en: 'Night' } },
      ],
    } as unknown as TopicDefinition;
    expect(shareableOverlays(topic).map((l) => `${l.id}:${l.kind}`)).toEqual(['ok:points', 'line:lines', 'own-folder:points', 'months:points']);
  });
});

describe('別的主題的圖層的 key', () => {
  it('`<主題>/<圖層>`，共用疊加圖層的 id 沒有斜線', () => {
    expect(foreignKey('earthquakes', 'landslides')).toBe('earthquakes/landslides');
    expect(isForeignKey('earthquakes/landslides')).toBe(true);
    expect(isForeignKey('quakes')).toBe(false);
    expect(foreignTopic('earthquakes/landslides')).toBe('earthquakes');
    expect(foreignLayerId('earthquakes/landslides')).toBe('x-earthquakes-landslides');
    expect(sharedSourceTopic('earthquakes/landslides')).toBe('earthquakes');
    expect(sharedSourceTopic('wind-1')).toBe('wind');
  });
});

describe('loadForeignLayer', () => {
  it('所有指標都畫、預設打開，名稱加上主題名稱，跟時間軸的方式用原本的指標，超出資料年份時畫最接近的一年', async () => {
    const [def] = await loadForeignLayer('earthquakes/landslides');
    expect(def).toMatchObject({ kind: 'points', id: 'x-earthquakes-landslides', topic: 'earthquakes', overlayTime: 'year', timeRange: 'data' });
    expect(def.indicators).toBeUndefined();
    expect('hidden' in def && def.hidden).toBeFalsy();
    expect('label' in def && typeof def.label === 'object' && def.label.zh).toBe('地震與火山：山崩事件（NASA 全球山崩目錄）');
  });

  it('累積的圖層不夾年份（時間軸在資料之前時沒有點）', async () => {
    const [def] = await loadForeignLayer('world-heritage/sites');
    expect(def).toMatchObject({ overlayTime: 'cumulative' });
    expect('timeRange' in def ? def.timeRange : undefined).toBeUndefined();
  });

  it('年份欄位不是西元年的（節慶的月份）不跟時間軸', async () => {
    const [def] = await loadForeignLayer('festivals/festivals');
    expect(def.kind === 'points' && def.timeField).toBeFalsy();
  });

  it('沒有的主題或圖層是空的', async () => {
    expect(await loadForeignLayer('no-such-topic/x')).toEqual([]);
    expect(await loadForeignLayer('earthquakes/no-such-layer')).toEqual([]);
  });

  it('從圖層選單加上的都標上 added（圖層開關的分級說明預設收起）', async () => {
    const [def] = await loadSharedLayer('earthquakes/landslides');
    expect('added' in def && def.added).toBe(true);
    const [wind] = await loadSharedLayer('wind-7');
    expect(wind).toMatchObject({ kind: 'wind', topic: 'wind', added: true });
    expect(wind.kind === 'wind' && wind.file(1990, null)).toBe('field/7.json');
  });
});
