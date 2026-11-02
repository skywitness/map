import { describe, expect, it } from 'vitest';
import {
  datasetJsonLd,
  datasetProblems,
  jsonLdScript,
  licenseUrl,
  temporalCoverage,
  type DatasetEntry,
} from './structuredData';

const SITE = 'https://skywitness.github.io/map/';
const URL = `${SITE}t/cities/`;

const entry = (licenses: DatasetEntry['sources'][number]['license'][]): DatasetEntry => ({
  name: { zh: '城市', en: 'Cities' },
  about: '全球的城市（連續的市區，不是行政區），圓的面積與人口成正比；拖動時間軸看 1950 年到 2100 年的變化。',
  indicators: ['城市地圖', '都市化率'],
  files: ['topics/cities/urban.json'],
  sources: licenses.map((license, i) => ({ name: `來源 ${i + 1}`, url: `https://example.org/${i + 1}`, license })),
});

const page = { url: URL, site: SITE, description: '城市：城市地圖、都市化率。', temporalCoverage: '1950/2100' };

describe('licenseUrl', () => {
  it('認得常見的授權，大小寫與空白不拘', () => {
    expect(licenseUrl('CC BY 4.0')).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(licenseUrl('cc  by 3.0 igo')).toBe('https://creativecommons.org/licenses/by/3.0/igo/');
    expect(licenseUrl('CC0 1.0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(licenseUrl({ zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' })).toBe(
      'https://data.gov.tw/license',
    );
  });

  it('括號只說明資料檔也用同一個授權的，看括號前面', () => {
    expect(
      licenseUrl({ zh: 'ODbL 1.0（© OpenStreetMap 貢獻者；資料檔也是）', en: 'ODbL 1.0 (© OpenStreetMap contributors; so are the data files)' }),
    ).toBe('https://opendatacommons.org/licenses/odbl/1-0/');
  });

  it('括號裡有附加條款或只引用事實的，認不得', () => {
    expect(licenseUrl({ zh: 'CC BY 4.0（另有 WHO 的附加條款）', en: 'CC BY 4.0 (with WHO’s additional terms)' })).toBeNull();
    expect(licenseUrl({ zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' })).toBeNull();
    expect(licenseUrl({ zh: '公有領域', en: 'public domain' })).toBeNull();
  });
});

describe('temporalCoverage', () => {
  it('最早到最晚的一年，只有一年時寫那一年', () => {
    expect(temporalCoverage([2000, 1950, 2100])).toBe('1950/2100');
    expect(temporalCoverage([2026])).toBe('2026');
  });

  it('西元 1000 年以前補成四位數，不是整數的不算', () => {
    expect(temporalCoverage([578, 1699, 2000.5])).toBe('0578/1699');
  });

  it('沒有年份或有西元前的年份時不寫', () => {
    expect(temporalCoverage([])).toBeNull();
    expect(temporalCoverage([-3400, 2024])).toBeNull();
  });
});

describe('datasetJsonLd', () => {
  it('來源的授權都一樣時寫在 license', () => {
    const data = datasetJsonLd(entry(['CC BY 4.0', 'CC BY 4.0']), page);
    expect(data.license).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect((data.isBasedOn as { license?: unknown }[]).every((s) => s.license === undefined)).toBe(true);
    expect(data.temporalCoverage).toBe('1950/2100');
  });

  it('授權不一樣時不寫 license，每個來源寫自己的；認不得的寫名稱', () => {
    const data = datasetJsonLd(entry(['CC BY 4.0', { zh: '公有領域', en: 'public domain' }]), page);
    expect(data.license).toBeUndefined();
    expect((data.isBasedOn as { license?: unknown }[]).map((s) => s.license)).toEqual([
      'https://creativecommons.org/licenses/by/4.0/',
      { '@type': 'CreativeWork', name: '公有領域' },
    ]);
  });

  it('說明是頁面的說明加預設指標的說明', () => {
    const data = datasetJsonLd(entry(['CC BY 4.0']), { ...page, temporalCoverage: null });
    expect(data.description).toBe(`${page.description}${entry([]).about}`);
    expect(data.temporalCoverage).toBeUndefined();
  });
});

describe('datasetProblems', () => {
  const html = (data: unknown) => `<head>${jsonLdScript(data)}</head>`;

  it('完整的沒有問題', () => {
    expect(datasetProblems(html(datasetJsonLd(entry(['CC BY 4.0']), page)), URL)).toEqual([]);
  });

  it('說明太短、網址不對、沒有授權都報出來', () => {
    const data = { ...datasetJsonLd(entry([]), page), description: '太短', url: SITE };
    const problems = datasetProblems(html(data), URL);
    expect(problems.some((p) => p.includes('description'))).toBe(true);
    expect(problems.some((p) => p.includes('url'))).toBe(true);
    expect(problems.some((p) => p.includes('license'))).toBe(true);
  });

  it('內容裡的 </script> 不會截斷 JSON-LD', () => {
    const data = datasetJsonLd({ ...entry(['CC BY 4.0']), about: `${entry([]).about}</script><b>` }, page);
    expect(datasetProblems(html(data), URL)).toEqual([]);
  });

  it('不能解析或沒有 JSON-LD 時報錯', () => {
    expect(datasetProblems('<script type="application/ld+json">{</script>', URL)[0]).toContain('不能解析');
    expect(datasetProblems('<head></head>', URL)[0]).toContain('0 段');
  });
});
