import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeLines, decodePoints } from '../map/overlayData';
import type { FlowFile, IndicatorData, LinesData, PointsData } from '../topics/types';
import { _convert, autoThresholds, monthIndex, parseCsv, validateAbout } from './localData';
import type { LocalAbout, LocalSourceMeta } from './localRegistry';

/** 本機匯入的轉換（製作手冊第十三批 209）：src/personal/__fixtures__/ 的假資料（10A） */
const FIX = 'src/personal/__fixtures__';
const read = (path: string) => readFileSync(`${FIX}/${path}`, 'utf8');
const about = (dir: string) => validateAbout(JSON.parse(read(`${dir}/about.json`)));
const COUNTRIES = Object.fromEntries(['JPN', 'FRA', 'TWN', 'USA', 'ARG', 'KOR'].map((c) => [c, {}]));

describe('parseCsv', () => {
  it('引號裡的逗號、雙引號、換行，CRLF 與 BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"line\nbreak",2\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['line\nbreak', '2'],
    ]);
  });
});

describe('validateAbout', () => {
  it('topic 與 newTopic 要剛好一個', () => {
    const base = { format: 1, title: 'x', source: { name: 's' }, tables: [{ file: 'a.csv', label: 'a' }] };
    expect(() => validateAbout(base)).toThrow(/exactly one/);
    expect(() => validateAbout({ ...base, topic: 't', newTopic: { id: 'n', title: 'n' } })).toThrow(/exactly one/);
    expect(validateAbout({ ...base, topic: 't' }).topic).toBe('t');
  });

  it('同一個 id 不能用兩次', () => {
    expect(() =>
      validateAbout({ format: 1, title: 'x', source: { name: 's' }, topic: 't', tables: [{ file: 'a.csv', label: 'a' }, { file: 'a.csv', label: 'b' }] }),
    ).toThrow(/twice/);
  });
});

describe('表格', () => {
  const a = about('f01-fake-table');
  const warnings: string[] = [];
  const values = _convert.table('f01', a.tables![0], read('f01-fake-table/values.csv'), COUNTRIES, (w) => warnings.push(w));
  const data = values.payloads[0][1] as IndicatorData & { labels: Record<string, (string | null)[]> };

  it('轉成指標檔，地圖上沒有的代碼略過並記下', () => {
    expect(values.payloads[0][0]).toBe('f01/values');
    expect(data.years).toEqual([2020, 2021]);
    expect(data.values).toEqual({ JPN: [10.5, 12], FRA: [3.25, null], TWN: [null, 7.5] });
    expect(warnings).toEqual(['values.csv: XXX (1)']);
    expect(values.derived).toMatchObject({ kind: 'table', monthly: false, taiwan: true, countries: 3, labels: true });
  });

  it('label 欄跟年份對齊', () => {
    expect(data.labels.JPN).toEqual(['Alpha', 'Beta, the second']);
  });

  it('月的資料與文字的值變成類別：about 列的先，資料裡多的接在後面', () => {
    const regime = _convert.table('f01', a.tables![1], read('f01-fake-table/regime.csv'), COUNTRIES, () => {});
    const d = regime.payloads[0][1] as IndicatorData;
    expect(regime.derived).toMatchObject({ kind: 'table', monthly: true, categories: ['Fixed', 'Float', 'Crawl'], taiwan: false });
    expect(d.years).toEqual([monthIndex(2024, 1), monthIndex(2024, 2)]);
    expect(d.values).toEqual({ USA: [2, 2], ARG: [1, 3] });
  });

  it('同一國同一年兩列是錯誤', () => {
    expect(() => _convert.table('x', { file: 'd.csv', label: 'd' }, 'iso3,year,value\nJPN,2020,1\nJPN,2020,2\n', COUNTRIES, () => {})).toThrow(/twice/);
  });
});

describe('autoThresholds', () => {
  it('循序：遞增、2 位有效數字', () => {
    const t = autoThresholds(Array.from({ length: 100 }, (_, i) => i * 1.234));
    expect(t.length).toBeGreaterThan(3);
    expect([...t].sort((x, y) => x - y)).toEqual(t);
  });

  it('發散：對稱', () => {
    const t = autoThresholds([-30, -5, 0, 4, 12, 40], true);
    expect(t.map((x) => -x).reverse()).toEqual(t);
  });
});

describe('點與序列', () => {
  const a = about('f02-fake-points');
  const pts = _convert.points('f02', a.points![0], read('f02-fake-points/stations.csv'), read('f02-fake-points/series.csv'), 'stations.csv');
  const records = decodePoints(pts.payloads[0][1] as PointsData);

  it('沒有座標的略過；數值、字串欄位照原樣還原', () => {
    expect(records.map((r) => r.name)).toEqual(['Alpha', 'Beta']);
    expect(records[0]).toMatchObject({ lat: 25.15, lon: 121.75, trend: 1.25, people: 10, iso3: 'TWN', opened: 1950 });
    expect(records[1].people).toBeNull();
  });

  it('序列併成 _s；時間範圍、大小的最大值', () => {
    expect(records[0]._s).toBe('2000:7001;2001:7010');
    expect(pts.derived).toMatchObject({ kind: 'points', count: 2, years: [1950, 1990], sizeMax: 10, thresholds: [0, 2] });
  });
});

describe('線面', () => {
  const a = about('f02-fake-points');
  const shapes = _convert.shapes('f02', a.shapes![0], read('f02-fake-points/areas.geojson'), 'areas.geojson');
  const data = shapes.payloads[0][1] as LinesData;
  const lines = decodeLines(data);

  it('面的每個環一條線，洞標 _hole；同一個 feature 同一組', () => {
    expect(lines.lines).toHaveLength(3);
    expect(lines.records!.map((r) => [r._f, r._poly, r._hole])).toEqual([
      [0, 1, 0],
      [0, 1, 1],
      [1, null, null],
    ]);
    expect(lines.lines[0][2]).toEqual([1, 1]);
    expect(shapes.derived).toMatchObject({ kind: 'shapes', count: 2, polygons: true, categories: ['a', 'b', 'c'] });
  });

  it('顏色的代碼放在 types', () => {
    expect(data.types).toEqual([0, 0, 2]);
  });
});

describe('流向', () => {
  const a = about('f03-fake-flows');
  const flow = _convert.flow('f03', a.flows![0], read('f03-fake-flows/links.csv'), COUNTRIES, () => {});
  const byKey = new Map(flow.payloads);

  it('每年一個流向檔，兩個方向都有，type 寫成附註', () => {
    const y1990 = byKey.get('f03/links/1990') as FlowFile;
    expect(y1990.export.USA).toEqual([2, [['JPN', 1], ['KOR', 1]]]);
    expect(y1990.import.USA).toEqual([1, [['JPN', 1]]]);
    expect(y1990.notes?.['USA>JPN']).toEqual(['防禦', 'Defence']);
    expect(byKey.has('f03/links/1991')).toBe(true);
  });

  it('各國的指標是起點的國家數', () => {
    const totals = byKey.get('f03/links#totals') as IndicatorData;
    expect(totals.years).toEqual([1990, 1991]);
    expect(totals.values.USA).toEqual([2, 1]);
    expect(flow.derived).toMatchObject({ kind: 'flow', taiwan: false, rows: 4 });
  });
});

describe('localTopics：來源變成主題的零件', async () => {
  const { _partsOf } = await import('../topics/localTopics');
  const meta = (dir: string, id: string, derived: LocalSourceMeta['derived']): LocalSourceMeta => ({
    id,
    importedAt: 0,
    about: about(dir) as LocalAbout,
    derived,
    files: [],
    warnings: [],
  });

  it('表格是指標：id 有 local- 前綴、名稱標「本機」、沒有台灣時寫原因、月的時間軸', () => {
    const a = about('f01-fake-table');
    const v = _convert.table('f01', a.tables![0], read('f01-fake-table/values.csv'), COUNTRIES, () => {});
    const r = _convert.table('f01', a.tables![1], read('f01-fake-table/regime.csv'), COUNTRIES, () => {});
    const parts = _partsOf(meta('f01-fake-table', 'f01', { values: v.derived, regime: r.derived }));
    expect(parts.indicators.map((i) => i.id)).toEqual(['local-f01-values', 'local-f01-regime']);
    expect(parts.indicators[0].label).toEqual({ zh: '假的數值（本機）', en: 'Fake values (local)' });
    expect(parts.indicators[0].file).toBe('local:f01/values');
    expect(parts.indicators[0].noValue).toBeUndefined();
    expect(parts.indicators[1].noValue?.TWN).toBeTruthy();
    expect(parts.indicators[1].layer.kind).toBe('categorical');
    expect(parts.indicators[1].timeAxis?.tick?.(monthIndex(2024, 2))).toBe('2024/2');
    expect(parts.indicators[1].format(3)).toBe('Crawl');
    expect(parts.labelled).toEqual(['local-f01-values']);
  });

  it('點、線面是圖層，點有清單', () => {
    const a = about('f02-fake-points');
    const p = _convert.points('f02', a.points![0], read('f02-fake-points/stations.csv'), read('f02-fake-points/series.csv'), 'stations.csv');
    const s = _convert.shapes('f02', a.shapes![0], read('f02-fake-points/areas.geojson'), 'areas.geojson');
    const parts = _partsOf(meta('f02-fake-points', 'f02', { stations: p.derived, areas: s.derived }));
    expect(parts.overlays.map((o) => o.kind)).toEqual(['points', 'lines']);
    expect(parts.lists).toHaveLength(1);
    const rows = parts.lists[0].rows(decodePoints(p.payloads[0][1] as PointsData), {
      countryName: (c) => c,
      year: 2000,
      item: null,
      country: null,
      sort: null,
    });
    // 累積到 2000 年：兩站都在；依國家分組
    expect(rows.map((r) => [r.group, r.title])).toEqual([
      ['JPN', 'Beta'],
      ['TWN', 'Alpha'],
    ]);
    expect(rows[1].bars?.values).toHaveLength(2);
  });
});
