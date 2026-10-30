import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, TopicDefinition } from './types';

/**
 * 填海造陸（pipeline/topics/reclamation.py）：Sengupta et al. 2023 人口百萬以上的 135 個沿海城市 2000–2020 年的填海面積。
 * 使用者 2026-10-30 決定：照候選清單畫城市的比例圓，台中、新加坡的國家欄修正（香港也一起）。
 */

const locale = () => (getLang() === 'zh' ? 'zh-TW' : 'en-US');
const n0 = (v: number) => Math.round(v).toLocaleString(locale());

/** 公頃：1 萬公頃以上加寫平方公里 */
export function hectares(v: number): string {
  const ha = v < 10 ? fixed(v, 1) : n0(v);
  const km2 = v >= 1000 ? tr({ zh: `（${n0(v / 100)} 平方公里）`, en: ` (${n0(v / 100)} km²)` }) : '';
  return tr({ zh: `${ha} 公頃${km2}`, en: `${ha} ha${km2}` });
}

export function cityName(p: PointRecord): string {
  if (getLang() === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.name ?? '');
}

/** 「34,978 公頃（±3.67）」；可忽略、沒有資料另外寫 */
export function cityArea(p: PointRecord): string {
  if (p.n === 1) return tr({ zh: '填海可忽略', en: 'Negligible reclamation' });
  if (typeof p.a !== 'number') return tr({ zh: '沒有資料', en: 'No data' });
  const err = typeof p.e === 'number' ? ` (±${fixed(p.e, p.e < 10 ? 2 : 1)})` : '';
  return `${hectares(p.a)}${err}`;
}

export const reclamation: TopicDefinition = {
  id: 'reclamation',
  title: { zh: '填海造陸', en: 'Coastal land reclamation' },
  shortTitle: { zh: '填海造陸', en: 'Reclamation' },
  defaultIndicator: 'map',
  defaultYear: 2020,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Sengupta et al. 2023，Mapping 21st Century global coastal land reclamation（Earth’s Future 11(2)；Zenodo 資料）',
        en: 'Sengupta et al. 2023, Mapping 21st Century global coastal land reclamation (Earth’s Future 11(2); data on Zenodo)',
      },
      url: 'https://doi.org/10.5281/zenodo.7528236',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      '資料是 Sengupta 等人 2023 年發表在 Earth’s Future 的研究：用 Landsat 衛星影像比對 2000 與 2020 年，算出人口百萬以上的 135 個沿海城市在這 20 年間填海多出來的陸地（公頃，括號是誤差），合計 253,734 公頃（約 2,537 平方公里），其中 106 個城市有填海，前 10 名都在中國大陸。只算人口百萬以上的城市，小城市、港口與工業區（例如台灣的彰濱、雲林離島工業區）不在裡面；2000 年以前的填海（例如香港、新加坡、東京灣大部分的填海地）也不算。作者說之後會公布填海範圍的圖層，目前只有城市的點。原始檔有幾處修正：台中那一列的國家欄寫「China」（城市欄是「Taichung . Taiwan」）、新加坡的國家欄空白、香港寫「China SAR」，這裡分別改成台灣、新加坡、香港；Kochi、Thiruvananthapuram、Port-au-Prince 的經緯度寫反了，對調；填海可忽略的城市沒有座標，用 Natural Earth 的城市位置。另一個附檔（填海地上的土地用途）是從 OpenStreetMap 取的點，沒有用。',
    en:
      'The data come from Sengupta et al. (2023) in Earth’s Future, who compared Landsat images from 2000 and 2020 to measure the land reclaimed from the sea over those 20 years in 135 coastal cities of over a million people (hectares, with the error in brackets): 253,734 ha in all (about 2,537 km²), in 106 of the cities, with the top 10 all in mainland China. Only cities of a million or more are covered, so smaller cities, ports and industrial zones (such as Taiwan’s Changhua and Yunlin offshore industrial parks) are not included, nor is reclamation before 2000 (most of the reclaimed land in Hong Kong, Singapore and Tokyo Bay). The authors plan to publish the reclaimed areas as a map layer; for now there are only city points. A few fixes were made to the original file: the Taichung row lists “China” as its country (with “Taichung . Taiwan” as the city), Singapore has no country and Hong Kong is “China SAR”, changed here to Taiwan, Singapore and Hong Kong; the latitude and longitude of Kochi, Thiruvananthapuram and Port-au-Prince were swapped and are corrected; cities with negligible reclamation have no coordinates and are placed with Natural Earth city locations. A second file (land use on reclaimed land) consists of points taken from OpenStreetMap and is not used.',
  },
  panelExtra: () => import('./panels/ReclamationPanel'),
  overlays: [
    {
      kind: 'points',
      id: 'cities',
      file: 'cities.json',
      label: { zh: '沿海城市（2000–2020 年的填海）', en: 'Coastal cities (reclamation 2000–2020)' },
      // 面積與填海面積成正比（半徑依平方根）；可忽略的是小點
      radius: { field: 'a', stops: [[0, 1.8], [100, 3], [1000, 6], [5000, 11], [35000, 26]] },
      color: {
        field: 'a',
        title: { zh: '填海面積', en: 'Area reclaimed' },
        thresholds: [1, 1000],
        classes: [
          { color: MAP_TOKENS.inkMuted, label: { zh: '可忽略', en: 'Negligible' } },
          { color: MAP_TOKENS.categorical[2], label: { zh: '1,000 公頃以下', en: 'Under 1,000 ha' } },
          { color: MAP_TOKENS.categorical[5], label: { zh: '1,000 公頃以上', en: '1,000 ha or more' } },
        ],
      },
      sortField: 'a',
      // 國家的比例圓（填海面積、城市數）跟城市的點重疊，只在城市地圖畫
      indicators: ['map'],
      sizeLegend: { title: { zh: '填海面積', en: 'Area reclaimed' }, values: [100, 1000, 10000], format: (v) => tr({ zh: `${n0(v)} 公頃`, en: `${n0(v)} ha` }) },
      tooltip: (p, ctx) => {
        const name = cityName(p);
        return {
          title: name,
          detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, cityArea(p)].filter(Boolean).join(' · '),
          properNoun: getLang() === 'zh' && typeof p.name === 'string' && p.name !== name ? p.name : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '填海的城市', en: 'Reclaiming cities' },
      description: {
        zh: '2000 到 2020 年，人口百萬以上的 135 個沿海城市填海多出來的陸地（Landsat 衛星影像）：圓的面積與填海面積成正比，灰色小點是填海可忽略的城市。上海、天津、寧波、唐山各填了將近 3 萬公頃（300 平方公里以上），前 10 名都在中國大陸；台灣的高雄 498、台北 343、台中 294 公頃。國家不上色，滑到國家上看它的城市合計。',
        en: 'Land reclaimed from the sea between 2000 and 2020 by 135 coastal cities of over a million people (from Landsat imagery): circle area is proportional to the land reclaimed, and small grey dots had negligible reclamation. Shanghai, Tianjin, Ningbo and Tangshan each added close to 30,000 ha (over 300 km²), and the top 10 are all in mainland China; in Taiwan, Kaohsiung added 498 ha, Taipei 343 and Taichung 294. Countries are not coloured; hover over one for its cities’ total.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'area.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `城市合計 ${hectares(v)}`, en: `Cities’ total: ${hectares(v)}` }),
      missing: { zh: '沒有百萬人口以上的沿海城市在研究裡', en: 'No coastal city of over a million people in the study' },
    },
    {
      id: 'area',
      label: { zh: '填海面積（2000–2020）', en: 'Land reclaimed (2000–2020)' },
      description: {
        zh: '2000 到 2020 年，這個國家人口百萬以上的沿海城市填海多出來的陸地合計（公頃，比例圓；100 公頃是 1 平方公里）。只算 135 個百萬人口以上的沿海城市，看各城市換到「填海的城市」。',
        en: 'Total land reclaimed from the sea between 2000 and 2020 by the country’s coastal cities of over a million people (hectares, proportional circles; 100 ha is 1 km²). Only 135 coastal cities of a million or more are covered; see “Reclaiming cities” for the individual cities.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'area.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 100000] },
      format: hectares,
      formatTick: n0,
      shareOfWorld: true,
    },
    {
      id: 'cities-count',
      label: { zh: '有填海的城市數', en: 'Cities with reclamation' },
      description: {
        zh: '這個國家人口百萬以上的沿海城市裡，2000–2020 年有填海的城市數（研究涵蓋的 135 個城市）。',
        en: 'How many of the country’s coastal cities of over a million people reclaimed land in 2000–2020 (of the 135 cities studied).',
      },
      unit: { zh: '個', en: 'cities' },
      file: 'cities-count.json',
      layer: { kind: 'bubble', legendValues: [1, 5, 20] },
      integer: true,
      format: (v) => tr({ zh: `${n0(v)} 個城市`, en: `${n0(v)} ${Math.round(v) === 1 ? 'city' : 'cities'}` }),
      formatTick: n0,
    },
  ],
};
