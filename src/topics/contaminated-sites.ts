import { tr } from '../i18n/lang';
import { formatLargeNumber } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointsOverlayDef, Text, TopicDefinition } from './types';

/**
 * 土壤與地下水的污染場址（新主題，2026-11-07，製作手冊第二十五批 486，候選 1149；環境的「污染」）：
 * 環境部的污染場址基本資料（EMS_S_07，pipeline/topics/contaminated_sites.py），只有台灣。
 * 時間軸是「那一年還在列管的場址」：公告年以後、解除那一年以前（overlayTime 累積加 endField）
 */
export const SITE_TYPES: Text[] = [
  { zh: '農地', en: 'Farmland' },
  { zh: '工廠', en: 'Factory' },
  { zh: '加油站', en: 'Petrol station' },
  { zh: '儲槽', en: 'Storage tank' },
  { zh: '非法棄置場址', en: 'Illegal dumping site' },
  { zh: '其他', en: 'Other' },
];
export const SITE_STATUS: Text[] = [
  { zh: '整治場址', en: 'Remediation site' },
  { zh: '控制場址', en: 'Control site' },
  { zh: '地下水受污染使用限制地區', en: 'Groundwater use restriction area' },
  { zh: '已解除列管', en: 'Delisted' },
];
const TYPE_COLORS = [MAP_TOKENS.categorical[3], MAP_TOKENS.categorical[5], MAP_TOKENS.categorical[2], MAP_TOKENS.categorical[6], MAP_TOKENS.categorical[1], MAP_TOKENS.categorical[0]];
const TAIWAN: [number, number, number, number] = [119.3, 21.8, 122.1, 25.4];

const SITES: PointsOverlayDef = {
  kind: 'points',
  id: 'contaminated-sites',
  file: 'sites.json',
  label: { zh: '列管中的污染場址', en: 'Listed contaminated sites' },
  indicators: ['sites'],
  timeField: 'y',
  endField: 'e',
  radius: { field: 'a', stops: [[100, 1.8], [1000, 2.4], [10000, 4], [100000, 7]] },
  color: {
    field: 't',
    title: { zh: '場址類型', en: 'Site type' },
    thresholds: [1, 2, 3, 4, 5],
    classes: SITE_TYPES.map((label, i) => ({ color: TYPE_COLORS[i], label })),
  },
  sortField: 'a',
  tooltip: (p) => {
    const t = Number(p.t);
    const k = Number(p.k);
    const area = p.a == null ? null : Number(p.a);
    return {
      title: typeof p.n === 'string' && p.n ? p.n : tr(SITE_TYPES[t]),
      detail: `${tr(SITE_TYPES[t] ?? SITE_TYPES[5])} · ${tr(SITE_STATUS[k] ?? SITE_STATUS[1])}`,
      extra: [
        ...(typeof p.p === 'string' && p.p ? [tr({ zh: `污染物：${p.p}`, en: `Pollutants: ${p.p}` })] : []),
        p.e
          ? tr({ zh: `${p.y} 年公告，${p.e} 年解除`, en: `Listed ${p.y}, delisted ${p.e}` })
          : tr({ zh: `${p.y} 年公告，仍在列管`, en: `Listed ${p.y}, still listed` }),
        ...(area ? [tr({ zh: `面積 ${formatLargeNumber(area)} 平方公尺`, en: `Area ${formatLargeNumber(area)} m²` })] : []),
      ],
    };
  },
};

export const contaminatedSites: TopicDefinition = {
  id: 'contaminated-sites',
  title: { zh: '土壤與地下水的污染場址', en: 'Contaminated land in Taiwan' },
  shortTitle: { zh: '污染場址', en: 'Contaminated sites' },
  defaultIndicator: 'sites',
  defaultYear: 2026,
  focus: TAIWAN,
  sources: [
    {
      name: { zh: '環境部環境管理署：土壤及地下水污染場址基本資料（EMS_S_07）', en: 'Ministry of Environment, Taiwan: Soil and groundwater contaminated sites (EMS_S_07)' },
      url: 'https://data.moenv.gov.tw/dataset/detail/EMS_S_07',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1.0' },
    },
  ],
  note: {
    zh: '依《土壤及地下水污染整治法》，土壤或地下水的污染物超過管制標準的地方，由縣市政府公告為控制場址；嚴重危害健康與環境的，由環境部公告為整治場址；整治到標準以下再公告解除。這裡是環境部 2002 年以來公告的 8,259 處（每日更新的開放資料），點的位置是場址的代表座標，大小是面積。時間軸是那一年還在列管的場址：公告那一年起出現，解除那一年起消失。場址多是因為有去查：彰化縣、桃園市的農地是重金屬普查找出來的，件數多不代表最髒。只有台灣，世界其他國家沒有可以比較的公開資料。',
    en: 'Under Taiwan’s Soil and Groundwater Pollution Remediation Act, land where soil or groundwater pollutants exceed control standards is listed by the local government as a control site; sites that seriously endanger health and the environment are listed by the Ministry of Environment as remediation sites, and sites are delisted once cleaned up below the standards. These are the 8,259 sites listed since 2002 (open data updated daily); each dot is the site’s representative location, sized by area. The time slider shows sites still listed in that year: they appear in the year they were listed and disappear in the year they were delisted. Many sites mean someone looked: the farmland in Changhua and Taoyuan was found by heavy-metal surveys, so high counts do not mean the dirtiest places. Taiwan only; no comparable open data exist for other countries.',
  },
  panelExtra: () => import('./panels/ContaminatedSitesPanel'),
  overlays: [SITES],
  indicators: [
    {
      id: 'sites',
      label: { zh: '列管中的污染場址', en: 'Listed contaminated sites' },
      description: {
        zh: '2002 年以來公告的 8,259 處污染場址，2026 年仍在列管的 362 處（整治場址 88、控制場址 245、地下水受污染使用限制地區 29），其餘 7,897 處已解除。八成九是農地（7,381 處，多在彰化縣與桃園市，污染物多是銅、鎳、鋅、鉻、鎘等重金屬），現在只剩 20 處還在列管；現在仍列管的以工廠 212 處最多。土壤最常見的污染物是銅（5,870 處）、鎳、鋅、鉻、鎘；地下水是苯、三氯乙烯、氯乙烯等有機溶劑與油品。',
        en: '8,259 contaminated sites listed since 2002, of which 362 were still listed in 2026 (88 remediation sites, 245 control sites and 29 groundwater use restriction areas); the other 7,897 have been delisted. 89% are farmland (7,381 sites, mostly in Changhua and Taoyuan, mainly with heavy metals such as copper, nickel, zinc, chromium and cadmium), of which only 20 are still listed; factories (212) make up the largest group still listed. The commonest soil pollutants are copper (5,870 sites), nickel, zinc, chromium and cadmium; in groundwater, benzene, trichloroethylene, vinyl chloride and other solvents and petroleum products.',
      },
      unit: '',
      file: 'sites-ind.json',
      layer: { kind: 'none' },
      focus: TAIWAN,
      overlayTime: 'cumulative',
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，只有台灣的場址', en: 'Countries are not coloured; Taiwan’s sites only' },
    },
  ],
};
