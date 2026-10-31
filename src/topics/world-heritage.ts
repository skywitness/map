import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { heritageExtra } from './heritage-extra';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 世界遺產（pipeline/topics/world_heritage.py）：UNESCO 世界遺產名錄，各國的遺產數（依登錄年份累計）、瀕危數，
 * 每個遺產一個點（依類型上色，瀕危的另一色）。跨國遺產每個締約國都算一次。
 * 預備名單、世界地質公園、拉姆薩濕地在 heritage-extra.ts（2026-10-31，第十批 181）。
 */

/** 遺產的類型（點的 type 欄位，跟 pipeline 的 CULTURAL、NATURAL、MIXED 一致） */
export const SITE_TYPES: Record<number, Text> = {
  1: { zh: '文化遺產', en: 'Cultural' },
  2: { zh: '自然遺產', en: 'Natural' },
  3: { zh: '複合遺產', en: 'Mixed' },
};

/**
 * 點的顏色（cls 欄位：1 文化、2 自然、3 複合、4 瀕危），取自 MAP_TOKENS：
 * 文化琥珀、自然綠、複合紫、瀕危紅；都有白框，跟藍色的海、比例圓的紫色分得開（比例圓是半透明的大圓）。
 */
const SITE_COLORS: ColorClasses = {
  field: 'cls',
  title: { zh: '類型', en: 'Type' },
  thresholds: [1.5, 2.5, 3.5],
  classes: [
    { color: MAP_TOKENS.hues.yellow, label: SITE_TYPES[1] },
    { color: MAP_TOKENS.categorical[3], label: SITE_TYPES[2] },
    { color: MAP_TOKENS.categorical[6], label: SITE_TYPES[3] },
    { color: MAP_TOKENS.hues.red, label: { zh: '瀕危（列入瀕危世界遺產名錄）', en: 'In danger (List of World Heritage in Danger)' } },
  ],
};

const sitesText = (v: number) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'site' : 'sites'}` });

/** 遺產的名稱：中文介面用 Wikidata 的中文名稱（沒有時用英文），英文介面用 UNESCO 的英文名稱 */
export function siteName(p: PointRecord): string {
  const zh = typeof p.zh === 'string' ? p.zh : null;
  return getLang() === 'zh' && zh ? zh : String(p.name ?? '');
}

/** 生物圈保護區的點（pipeline/topics/biosphere.py）：名稱與所在國家 */
function biosphereTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const states = [p.iso3, ...(typeof p.more === 'string' ? p.more.split(',') : [])].filter((s): s is string => typeof s === 'string');
  const zhName = getLang() === 'zh' && typeof p.zh === 'string';
  const parts = [tr({ zh: '生物圈保護區', en: 'Biosphere reserve' })];
  if (states.length) parts.push(states.map(ctx.countryName).join(tr({ zh: '、', en: ', ' })));
  return {
    title: zhName ? String(p.zh) : String(p.name ?? ''),
    detail: parts.join(' · '),
    properNoun: zhName ? String(p.name ?? '') : undefined,
  };
}

function siteTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const states = [p.iso3, ...(typeof p.more === 'string' ? p.more.split(',') : [])].filter((s): s is string => typeof s === 'string');
  const parts = [
    tr(SITE_TYPES[p.type as number] ?? ''),
    tr({ zh: `${p.year} 年登錄`, en: `inscribed ${p.year}` }),
  ];
  if (typeof p.danger === 'number') parts.push(tr({ zh: `${p.danger} 年起列為瀕危`, en: `in danger since ${p.danger}` }));
  if (states.length) parts.push(states.map(ctx.countryName).join(tr({ zh: '、', en: ', ' })));
  const zhName = getLang() === 'zh' && typeof p.zh === 'string';
  return {
    title: zhName ? String(p.zh) : String(p.name ?? ''),
    detail: parts.join(' · '),
    // 中文介面另外寫英文原名
    properNoun: zhName ? String(p.name ?? '') : undefined,
  };
}

/**
 * 瀕危的世界遺產（第十二批 204）：「瀕危的世界遺產」指標，時間軸那一年已經列為瀕危的，依列入瀕危的年份（新的在上面）；
 * 每列：名稱、國家、類型與登錄、列入瀕危的年份。點了移過去並標出那一點
 */
const DANGER_LIST: ListPanelDef = {
  label: { zh: '瀕危的世界遺產', en: 'World Heritage in Danger' },
  indicators: ['danger'],
  file: 'sites.json',
  countryField: 'iso3',
  empty: { zh: '這一年還沒有列為瀕危的遺產', en: 'No sites in danger by this year' },
  rows: (points, { countryName, year }) =>
    points
      .filter((p) => typeof p.danger === 'number' && p.danger <= year)
      .sort((a, b) => Number(b.danger) - Number(a.danger) || Number(a.year) - Number(b.year))
      .map((p): ListRow => {
        const zhName = getLang() === 'zh' && typeof p.zh === 'string';
        const states = [p.iso3, ...(typeof p.more === 'string' ? p.more.split(',') : [])].filter((s): s is string => typeof s === 'string' && s !== '');
        return {
          key: String(p.id),
          title: siteName(p),
          properNoun: zhName ? String(p.name ?? '') : undefined,
          lines: [
            states.map(countryName).join(tr({ zh: '、', en: ', ' })),
            [tr(SITE_TYPES[p.type as number] ?? ''), tr({ zh: `${p.year} 年登錄`, en: `inscribed ${p.year}` }), tr({ zh: `${p.danger} 年起列為瀕危`, en: `in danger since ${p.danger}` })].join(' · '),
          ].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        };
      }),
};

export const worldHeritage: TopicDefinition = {
  id: 'world-heritage',
  title: { zh: '世界遺產', en: 'World Heritage' },
  shortTitle: { zh: '世界遺產', en: 'Heritage' },
  defaultIndicator: 'sites',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'UNESCO DataHub：World Heritage List', en: 'UNESCO DataHub: World Heritage List' },
      url: 'https://data.unesco.org/explore/dataset/whc001/',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'UNESCO 世界遺產中心：締約國清單', en: 'UNESCO World Heritage Centre: States Parties' },
      url: 'https://whc.unesco.org/en/statesparties/',
      license: { zh: '只用是否為締約國的事實', en: 'membership facts only' },
    },
    { name: { zh: 'Wikidata（遺產的中文名稱、生物圈保護區）', en: 'Wikidata (Chinese names of sites; biosphere reserves)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
 
    ...heritageExtra.sources,
  ],
  note: {
    zh: '世界遺產依 UNESCO 的名錄（含 2026 年世界遺產委員會新登錄的）。跨國遺產每個締約國都算一次，所以各國加起來比世界的總數多；「耶路撒冷舊城及其城牆」由約旦提名、名錄上沒有締約國，只算進世界的總數。瀕危世界遺產只有目前的名單。台灣不是《世界遺產公約》的締約國，不能提名，所以沒有世界遺產。中文名稱來自 Wikidata，沒有的用英文名稱。UNESCO DataHub 的世界遺產名錄是 CC BY-SA 4.0 授權，這個主題的衍生資料檔、匯出的地圖圖片與 CSV 也依 CC BY-SA 4.0 分享。預備名單與世界地質公園用 Wikidata 與英文維基百科（UNESCO 的網站條款不准大量擷取），拉姆薩濕地用 Ramsar Sites Information Service（CC BY 4.0）。',
    en: 'World Heritage sites follow the UNESCO list, including sites inscribed by the World Heritage Committee in 2026. Transboundary sites count once for each State Party, so country totals add up to more than the world total; the Old City of Jerusalem and its Walls, proposed by Jordan, has no State Party on the list and counts only in the world total. The List of World Heritage in Danger is current only. Taiwan is not a State Party to the World Heritage Convention and cannot nominate sites, so it has none. Chinese names come from Wikidata, with English names where none exist. The UNESCO DataHub World Heritage List is licensed under CC BY-SA 4.0, and the derived data files, map images and CSV files of this topic are shared under CC BY-SA 4.0 too. Tentative Lists and Global Geoparks come from Wikidata and English Wikipedia (UNESCO’s website terms forbid bulk extraction); Ramsar sites come from the Ramsar Sites Information Service (CC BY 4.0).',
  },
  noValue: {
    TWN: { zh: '台灣不是《世界遺產公約》的締約國，不能提名世界遺產', en: 'Taiwan is not a State Party to the World Heritage Convention and cannot nominate sites' },
  },
  dimension: {
    label: { zh: '類型', en: 'Type' },
    options: [
      { id: 'all', label: { zh: '全部', en: 'All' } },
      { id: 'cultural', label: SITE_TYPES[1] },
      { id: 'natural', label: SITE_TYPES[2] },
      { id: 'mixed', label: SITE_TYPES[3] },
    ],
    defaultOption: 'all',
  },
  panelExtra: () => import('./panels/WorldHeritagePanel'),
  listPanel: [DANGER_LIST, ...heritageExtra.listPanel],
  overlays: [
    {
      kind: 'points',
      id: 'sites',
      file: 'sites.json',
      label: { zh: '世界遺產', en: 'World Heritage sites' },
      radius: 2.6,
      color: SITE_COLORS,
      sortField: 'cls',
      timeField: 'year',
      tooltip: siteTooltip,
      indicators: ['sites', 'danger'],
    },
    {
      kind: 'points',
      id: 'biosphere',
      file: 'biosphere-points.json',
      label: { zh: '生物圈保護區', en: 'Biosphere reserves' },
      radius: 2.6,
      color: MAP_TOKENS.categorical[3],
      tooltip: biosphereTooltip,
      indicators: ['biosphere'],
    },
    ...heritageExtra.overlays,
  ],
  indicators: [
    {
      id: 'sites',
      label: { zh: '世界遺產數', en: 'World Heritage sites' },
      description: {
        zh: '到這一年為止登錄的世界遺產數（文化、自然、複合，可在子項目選類型）。跨國遺產每個締約國都算一次。拖動時間軸看 1978 年第一批登錄以來的增加；點是每個遺產的位置，紅色是瀕危。',
        en: 'World Heritage sites inscribed up to the selected year (cultural, natural or mixed; choose a type above). Transboundary sites count once for each State Party. Drag the time slider to see the list grow since the first inscriptions in 1978; dots mark each site, red ones are in danger.',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'sites/{item}.json',
      layer: { kind: 'bubble', legendValues: [5, 20, 50] },
      overlayTime: 'cumulative',
      format: sitesText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'danger',
      label: { zh: '瀕危世界遺產數', en: 'Sites in danger' },
      description: {
        zh: '目前列在「瀕危世界遺產名錄」上的世界遺產數：受到戰爭、開發、盜獵、氣候等嚴重威脅，世界遺產委員會列入名錄以爭取保護資源。只有目前的名單，沒有歷年。',
        en: 'Sites currently on the List of World Heritage in Danger, threatened by conflict, development, poaching, climate or other serious dangers, and listed by the World Heritage Committee to mobilise support. Only the current list is available.',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'danger.json',
      layer: { kind: 'bubble', legendValues: [1, 3, 6] },
      overlayTime: 'cumulative',
      format: sitesText,
      formatTick: (v) => fixed(v, 0),
      shareOfWorld: true,
    },
    {
      id: 'biosphere',
      label: { zh: '生物圈保護區', en: 'Biosphere reserves' },
      description: {
        zh: 'UNESCO「人與生物圈計畫」的生物圈保護區：核心區保護生態、外圍讓人居住與利用，試著兼顧兩者。點是 Wikidata 收錄、有座標的 679 處（UNESCO 公布 797 處，Wikidata 不完整，也有已除名沒標的），所以不算各國的處數。台灣不是 UNESCO 會員，沒有。',
        en: 'Biosphere reserves of UNESCO’s Man and the Biosphere Programme, which pair a protected core with surrounding zones where people live and work. Dots show the 679 reserves with coordinates in Wikidata (UNESCO lists 797; Wikidata is incomplete and includes some withdrawn reserves), so countries are not counted. Taiwan, not a UNESCO member, has none.',
      },
      unit: '',
      file: 'biosphere.json',
      layer: { kind: 'none' },
      unranked: true,
      rankingBars: false,
      panelChart: false,
      format: () => '',
      missing: { zh: '國家不上色，看地圖上的點', en: 'Countries are not coloured; see the dots on the map' },
    },
    ...heritageExtra.indicators,
  ],
};
