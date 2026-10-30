import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 品牌的發源地（pipeline/topics/brands.py）：Wikidata 的時尚品牌與汽車品牌，只收沒有停業日期、有維基百科條目的。
 * 使用者 2026-10-30 決定：時尚與汽車合併成一個主題（子項目），國籍以創立地為準。
 */

export function brandName(zh: unknown, en: unknown): string {
  return String((getLang() === 'zh' && typeof zh === 'string' && zh ? zh : null) ?? en);
}

/** 創立年份的顏色：y 是 0 時年份不詳 */
const ERA: ColorClasses = {
  field: 'y',
  title: { zh: '創立年份', en: 'Founded' },
  thresholds: [1, 1900, 1950, 2000],
  classes: [
    { color: MAP_TOKENS.categoricalOther, label: { zh: '不詳', en: 'Unknown' } },
    { color: MAP_TOKENS.categorical[6], label: { zh: '1900 年以前', en: 'Before 1900' } },
    { color: MAP_TOKENS.categorical[7], label: { zh: '1900–1949 年', en: '1900–1949' } },
    { color: MAP_TOKENS.categorical[2], label: { zh: '1950–1999 年', en: '1950–1999' } },
    { color: MAP_TOKENS.categorical[0], label: { zh: '2000 年以後', en: '2000 and later' } },
  ],
};

const POINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'brands',
  file: 'points/{item}.json',
  label: { zh: '品牌（創立地或總部）', en: 'Brands (place of founding or headquarters)' },
  // 大小依維基百科的語言數（有名的程度）：1 種 1.6 px、100 種以上 7 px
  radius: { field: 'w', stops: [[1, 1.6], [10, 2.6], [40, 4.5], [100, 7]] },
  color: ERA,
  sortField: 'w',
  sizeLegend: {
    title: { zh: '維基百科的語言數', en: 'Wikipedia language editions' },
    values: [10, 40, 100],
    format: (v) => fixed(v, 0),
  },
  tooltip: (p: PointRecord, ctx) => {
    const name = brandName(p.zh, p.en);
    return {
      title: name,
      detail: [
        typeof p.y === 'number' && p.y > 0 ? tr({ zh: `${p.y} 年創立`, en: `founded ${p.y}` }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
        typeof p.w === 'number' ? tr({ zh: `${p.w} 種語言的維基百科`, en: `${p.w} Wikipedia editions` }) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: name !== p.en ? String(p.en) : undefined,
    };
  },
};

export const brands: TopicDefinition = {
  id: 'brands',
  title: { zh: '品牌的發源地（時尚、汽車）', en: 'Where brands come from (fashion, cars)' },
  shortTitle: { zh: '品牌的發源地', en: 'Brand origins' },
  defaultIndicator: 'brands',
  defaultYear: 2026,
  timeless: true,
  sources: [{ name: 'Wikidata', url: 'https://www.wikidata.org/', license: 'CC0' }],
  note: {
    zh:
      '品牌是 Wikidata 裡的時尚品牌（fashion label、fashion house、clothing brand，或產業是時尚、成衣、高級訂製服的公司）與汽車品牌（汽車製造商、汽車品牌），只收沒有停業日期、至少一種語言的維基百科有條目的。' +
      'Wikidata 常常沒有填停業日期，早年的小車廠（美國、英國 1900 年代的很多）會被當成還在；也收了子公司與副牌。收錄偏歐美，各國的數字只能大概比較。' +
      '國家以創立地為準：創立地有座標的用座標所在的國家，沒有的用原產國、所屬國家或總部的位置；點畫在創立地，沒有的畫在總部（Burberry 的創立地是 Basingstoke，不是倫敦）。',
    en:
      'Brands are Wikidata items for fashion brands (fashion labels, fashion houses, clothing brands, or companies in the fashion, clothing or haute couture industries) and car brands (automobile manufacturers and brands) with no dissolution date and an article in at least one Wikipedia. ' +
      'Wikidata often lacks dissolution dates, so many early small car makers (especially American and British ones from the 1900s) are counted as current, and subsidiaries and sub-brands are included. Coverage leans towards Europe and North America, so country counts are only roughly comparable. ' +
      'Countries follow the place of founding: its coordinates where available, otherwise the country of origin, the country or the headquarters. Dots mark the place of founding, or the headquarters when that is missing (Burberry was founded in Basingstoke, not London).',
  },
  dimension: {
    label: { zh: '品牌', en: 'Brands' },
    options: [
      { id: 'fashion', label: { zh: '時尚品牌', en: 'Fashion brands' } },
      { id: 'cars', label: { zh: '汽車品牌', en: 'Car brands' } },
    ],
    defaultOption: 'fashion',
  },
  panelExtra: () => import('./panels/BrandsPanel'),
  overlays: [POINTS],
  indicators: [
    {
      id: 'brands',
      label: { zh: '數量', en: 'Count' },
      description: {
        zh: '在這個國家創立、還沒有停業的品牌有幾個（有維基百科條目的），圓的面積與它成正比；點是每個品牌的創立地，大小依維基百科有幾種語言的條目，顏色是創立年份。時尚品牌美國、義大利、英國、法國最多（Gucci 創立於佛羅倫斯、Louis Vuitton 巴黎、Prada 米蘭），台灣有夏姿、StayReal；汽車品牌美國、英國、巴西、德國、中國最多，台灣有裕隆、納智捷、鴻華先進、福特六和。點國家看它的品牌。',
        en: 'Brands founded in the country with no recorded closure and a Wikipedia article; circle area is proportional to the count. Dots mark where each brand was founded, sized by how many Wikipedia language editions cover it and coloured by founding year. For fashion, the US, Italy, the UK and France lead (Gucci was founded in Florence, Louis Vuitton in Paris, Prada in Milan), and Taiwan has Shiatzy Chen and StayReal; for cars, the US, the UK, Brazil, Germany and China lead, and Taiwan has Yulon, Luxgen, Foxtron and Ford Lio Ho. Select a country to see its brands.',
      },
      unit: { zh: '個', en: 'brands' },
      file: 'count/{item}.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} ${v === 1 ? 'brand' : 'brands'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
};
