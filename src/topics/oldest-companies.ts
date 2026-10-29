import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { FIELDS_ZH } from './oldest-companies-fields';
import type { PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 最古老的公司（pipeline/topics/oldest_companies.py）：英文維基百科「List of oldest companies」的 1700 年以前成立、
 * 還在營業的公司，Wikidata 補座標。使用者 2026-10-29 決定：資料檔用 CC BY-SA 4.0，台灣的老店放附註。
 */

const LICENSE = { zh: 'CC BY-SA 4.0（這個主題的資料檔同樣用 CC BY-SA 4.0 分享）', en: 'CC BY-SA 4.0 (this topic’s data files are shared under the same licence)' };

export const fieldName = (f: unknown) => (typeof f === 'string' ? (getLang() === 'zh' ? (FIELDS_ZH[f] ?? f) : f) : '');

export function companyName(p: PointRecord): string {
  return String((getLang() === 'zh' ? p.zh : null) ?? p.en);
}

const YEAR_AXIS = {
  label: { zh: '成立年份', en: 'Founded' } as Text,
  year: (y: number) => tr({ zh: `${y} 年以前成立`, en: `founded by ${y}` }),
};

const POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'companies',
  file: 'points.json',
  label: { zh: '公司（有 Wikidata 座標的）', en: 'Companies (with Wikidata locations)' },
  radius: 3,
  color: MAP_TOKENS.categorical[2],
  timeField: 'y',
  tooltip: (p, ctx) => {
    const name = companyName(p);
    return {
      title: name,
      detail: [tr({ zh: `${p.y} 年成立`, en: `founded ${p.y}` }), fieldName(p.f), typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null]
        .filter(Boolean)
        .join(' · '),
      properNoun: name !== p.en ? String(p.en) : undefined,
    };
  },
};

export const oldestCompanies: TopicDefinition = {
  id: 'oldest-companies',
  title: { zh: '最古老的公司', en: 'Oldest companies' },
  shortTitle: { zh: '最古老的公司', en: 'Oldest companies' },
  defaultIndicator: 'companies',
  defaultYear: 1699,
  sources: [
    {
      name: { zh: '英文維基百科「List of oldest companies」（2026-10-15 的版本）', en: 'English Wikipedia, “List of oldest companies” (revision of 15 October 2026)' },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1380332977',
      license: LICENSE,
    },
    { name: { zh: 'Wikidata（公司的位置與中文名稱）', en: 'Wikidata (locations and Chinese names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh:
      '公司是英文維基百科「List of oldest companies」裡 1700 年以前成立、到現在還在營業的 1,022 家（2026 年 10 月 15 日的版本）；「還在營業」與「同一家公司」照條目的認定，經過合併、改組的也算。國家照表格的所在地。' +
      '點是表格連到的公司在 Wikidata 有位置的（公司本身、總部或所在行政區的座標），約四分之一；沒有位置的只算在國家的家數裡。條目引用韓國銀行 2008 年的統計：41 國有 5,586 家超過 200 年的公司，3,146 家在日本。' +
      '條目是 CC BY-SA 4.0（姓名標示、相同方式分享），這個主題的資料檔也用 CC BY-SA 4.0。',
    en:
      'Companies are the 1,022 entries founded before 1700 and still in business in English Wikipedia’s “List of oldest companies” (revision of 15 October 2026); what counts as still in business and as the same company follows the article, so merged and reorganised firms are included. Countries follow the table’s location. ' +
      'Dots are companies whose linked article has a location in Wikidata (the company itself, its headquarters or its administrative area), about a quarter; the rest count only towards their country. The article cites a 2008 Bank of Korea study: 5,586 companies older than 200 years in 41 countries, 3,146 of them in Japan. ' +
      'The article is licensed CC BY-SA 4.0 (attribution, share-alike), and this topic’s data files are shared under CC BY-SA 4.0 as well.',
  },
  noValue: { TWN: { zh: '沒有（見附註）', en: 'None (see note)' } },
  panelExtra: () => import('./panels/OldestCompaniesPanel'),
  overlays: [POINTS],
  indicators: [
    {
      id: 'companies',
      label: { zh: '1700 年以前成立的公司', en: 'Companies founded before 1700' },
      description: {
        zh: '到現在還在營業、這一年以前成立的公司有幾家，圓的面積與它成正比。日本 531 家最多（清酒 87、糕餅 71、旅館 65 家），其次德國 187（啤酒廠 68、餐廳 35 家）、奧地利 47、英國 44、瑞士 40、義大利 33 家。最老的是 578 年的金剛組（大阪的寺院建築），其次 705 年的西山溫泉慶雲館、717 年的古まん。拖動時間軸從 578 年看起；點國家列出它的公司。',
        en: 'Companies still in business that were founded by the year; circle area is proportional to the count. Japan leads with 531 (87 sake brewers, 71 confectioners, 65 inns), followed by Germany 187 (68 breweries, 35 restaurants), Austria 47, the UK 44, Switzerland 40 and Italy 33. The oldest is Kongō Gumi (578), builders of Buddhist temples in Osaka, followed by Nishiyama Onsen Keiunkan (705) and Koman (717). Drag the timeline from 578; select a country for its companies.',
      },
      unit: { zh: '家', en: 'companies' },
      file: 'companies.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      overlayTime: 'cumulative',
      timeAxis: YEAR_AXIS,
      format: (v) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${v === 1 ? 'company' : 'companies'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
};
