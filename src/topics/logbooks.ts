import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, LinesOverlayDef, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 大航海時代的航海日誌（pipeline/topics/logbooks.py，資料是 CLIWOC 2.1）。
 * 地圖上是那一年每艘船的航線（每天正午的船位連成線），依國籍上色；國家不上色，
 * 滑到國家上看那一年有幾艘這國的船留下航海日誌，側欄列出本國的船與經過附近的船。
 */

const n0 = (v: number) => fixed(v, 0);

/** 國籍代碼：pipeline/topics/logbooks.py 的 NATIONS（tracks.json 的 n、panel.json 的國籍） */
/** 中英文都有的名稱（拿來組成指標的名稱與說明） */
type Bilingual = { zh: string; en: string };

export const NATIONS: { code: string; iso3: string; name: Bilingual }[] = [
  { code: 'UK', iso3: 'GBR', name: { zh: '英國', en: 'British' } },
  { code: 'NL', iso3: 'NLD', name: { zh: '荷蘭', en: 'Dutch' } },
  { code: 'ES', iso3: 'ESP', name: { zh: '西班牙', en: 'Spanish' } },
  { code: 'FR', iso3: 'FRA', name: { zh: '法國', en: 'French' } },
  { code: 'SE', iso3: 'SWE', name: { zh: '瑞典', en: 'Swedish' } },
  { code: 'US', iso3: 'USA', name: { zh: '美國', en: 'American' } },
  { code: 'DE', iso3: 'DEU', name: { zh: '漢堡', en: 'Hamburg' } },
  { code: 'DK', iso3: 'DNK', name: { zh: '丹麥', en: 'Danish' } },
];
/** tracks.json 的 types：英、荷、西、法各一類，其他國家併成 OTHER */
const OTHER = 4;

/**
 * 航線的顏色（線的類別色，dataviz 的驗證程式 2026-10-29 跑過）：淺色底圖（藍色的海）四色都通過色盲與一般視覺的區分，
 * 對海的對比不到 3:1，所以線下面墊一條細邊（casing）；深色底圖另一組，琥珀色比建議的亮度上限高一點（0.72），
 * 再暗就跟橘色分不開（紅綠色盲）。其他國家是灰色。
 */
const NATION_COLORS = [
  { light: '#e7298a', dark: '#f0479b' },
  { light: '#d95923', dark: '#e35a2b' },
  { light: '#eda100', dark: '#c4a200' },
  { light: '#7b3294', dark: '#9b6be0' },
];

export function nationColor(code: number, dark = false): string {
  const c = NATION_COLORS[Math.min(code, OTHER)];
  return c ? (dark ? c.dark : c.light) : MAP_TOKENS.inkMuted;
}

export function nationName(code: number | string | null): string {
  return typeof code === 'number' && NATIONS[code] ? tr(NATIONS[code].name) : '';
}

/** 公司或海軍：pipeline 的 COMPANY_CODES 換成的代碼；其他的是原文（鹿特丹的船公司等） */
const COMPANIES: Record<string, Text> = {
  VOC: { zh: '荷蘭東印度公司', en: 'Dutch East India Company' },
  WIC: { zh: '荷蘭西印度公司', en: 'Dutch West India Company' },
  MCC: { zh: '米德爾堡商業公司', en: 'Middelburg Commercial Company' },
  NLN: { zh: '荷蘭海軍', en: 'Dutch navy' },
  EIC: { zh: '英國東印度公司', en: 'East India Company' },
  RN: { zh: '英國皇家海軍', en: 'Royal Navy' },
  HBC: { zh: '哈德遜灣公司', en: "Hudson's Bay Company" },
  SOIC: { zh: '瑞典東印度公司', en: 'Swedish East India Company' },
  DAC: { zh: '丹麥亞洲公司', en: 'Danish Asiatic Company' },
  WHA: { zh: '捕鯨船', en: 'whaler' },
  MER: { zh: '商船', en: 'merchant ship' },
};

export function companyName(code: string | number | null): string {
  if (typeof code !== 'string' || !code) return '';
  return COMPANIES[code] ? tr(COMPANIES[code]) : code;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** YYYYMMDD →「1767/4/27」或「27 Apr 1767」 */
export function dateText(ymd: number): string {
  const y = Math.floor(ymd / 10000);
  const m = Math.floor(ymd / 100) % 100;
  const d = ymd % 100;
  return getLang() === 'en' ? `${d} ${MONTHS[m - 1]} ${y}` : `${y}/${m}/${d}`;
}

export function dateRange(a: number, b: number): string {
  return a === b ? dateText(a) : `${dateText(a)} – ${dateText(b)}`;
}

export function shipName(name: string | number | null): string {
  return typeof name === 'string' && name ? name : tr({ zh: '船名不明', en: 'Unnamed ship' });
}

/** 出發地 → 目的地（日誌上的原文，可能是荷、英、西、法文） */
export function routeText(from: string | number | null, to: string | number | null): string {
  const f = typeof from === 'string' && from ? from : '?';
  const t = typeof to === 'string' && to ? to : '?';
  return `${f} → ${t}`;
}

function trackTooltip(p: PointRecord) {
  const nation = nationName(p.n);
  const company = companyName(p.c);
  const extra = [routeText(p.f, p.t)];
  if (typeof p.a === 'number' && typeof p.b === 'number') {
    extra.push(tr({ zh: `航程 ${dateRange(p.a, p.b)}`, en: `Voyage ${dateRange(p.a, p.b)}` }));
  }
  if (typeof p.k === 'string' && p.k) extra.push(tr({ zh: `船長 ${p.k}`, en: `Captain ${p.k}` }));
  return {
    title: shipName(p.s),
    detail: company ? `${nation} · ${company}` : nation,
    extra,
  };
}

const SHIPS_UNIT = { zh: '艘', en: 'ships' };
const ships = (v: number) => tr({ zh: `${n0(v)} 艘船`, en: `${n0(v)} ${Math.round(v) === 1 ? 'ship' : 'ships'}` });

/**
 * 指標＝要看哪些船的航線（2026-10-31 使用者要求：全部，或只看某一國的船）。types 是 tracks.json 的分類代碼
 * （英、荷、西、法、其他），null 是全部；每個指標一個只畫那幾類的線圖層（overlays，同一個檔只下載一次），
 * 側欄的航程清單也只列那幾類（LogbooksPanel）。國家的值是那一年各國有航海日誌的船數：全部是 ships.json，
 * 某一國的是 ships-<代碼>.json（pipeline 的 SHIP_VIEWS，只有那一國，滑到別的國家寫「這個指標只看…的船」）
 */
export const SHIP_VIEWS: { id: string; overlay: string; types: number[] | null; label: Text; nations: Bilingual }[] = [
  { id: 'ships', overlay: 'voyages', types: null, label: { zh: '全部的船', en: 'All ships' }, nations: { zh: '', en: '' } },
  ...NATIONS.slice(0, OTHER).map((n, i) => ({
    id: `ships-${n.code.toLowerCase()}`,
    overlay: `voyages-${n.code.toLowerCase()}`,
    types: [i],
    label: { zh: `${n.name.zh}的船`, en: `${n.name.en} ships` },
    nations: n.name,
  })),
  {
    id: 'ships-other',
    overlay: 'voyages-other',
    types: [OTHER],
    label: { zh: '其他國家的船', en: 'Other ships' },
    nations: { zh: '瑞典、美國、漢堡、丹麥', en: 'Swedish, American, Hamburg and Danish' },
  },
];

/** 這個指標畫哪一個線圖層（側欄標出航程用） */
export function voyagesOverlay(indicatorId: string): string {
  return SHIP_VIEWS.find((v) => v.id === indicatorId)?.overlay ?? 'voyages';
}

/** 這個指標看的分類代碼（null 是全部）；國籍代碼 n 的分類是 min(n, 其他) */
export function viewTypes(indicatorId: string): number[] | null {
  return SHIP_VIEWS.find((v) => v.id === indicatorId)?.types ?? null;
}

export function nationType(nation: number): number {
  return Math.min(nation, OTHER);
}

const ALL_DESCRIPTION: Text = {
  zh: '時間軸那一年每艘船的航線：航海日誌每天記下的正午船位連成線，顏色是船的國籍；滑到線上看船名、公司、航程與船長。國家不上色，滑到英國、荷蘭、西班牙、法國等國上看那一年有幾艘這國的船留下航海日誌；點國家看本國的船與經過附近的船。要只看某一國的船，選上面的指標。',
  en: "Each ship's track in the selected year: the noon positions recorded in its logbook, joined into a line and coloured by the ship's nationality. Hover over a track for the ship, company, voyage and captain. Countries are not coloured; hover over Britain, the Netherlands, Spain, France and others for the number of their ships with logbooks that year, or click a country for its own ships and the ships that passed nearby. Pick an indicator above to show one nationality only.",
};

const indicators: IndicatorDef[] = SHIP_VIEWS.map((view): IndicatorDef => {
  const only = view.types !== null;
  const iso3s = only ? NATIONS.filter((_, i) => view.types!.includes(nationType(i))).map((n) => n.iso3) : NATIONS.map((n) => n.iso3);
  return {
    id: view.id,
    label: view.label,
    description: only
      ? {
          zh: `時間軸那一年${view.nations.zh}的船的航線（航海日誌每天記下的正午船位連成線），其他國家的船不畫；滑到線上看船名、公司、航程與船長。點國家看經過附近的${view.nations.zh}的船。`,
          en: `Tracks of ${view.nations.en} ships in the selected year (the noon positions recorded in their logbooks, joined into lines); other ships are hidden. Hover over a track for the ship, company, voyage and captain, or click a country for the ${view.nations.en} ships that passed nearby.`,
        }
      : ALL_DESCRIPTION,
    unit: SHIPS_UNIT,
    file: only ? `${view.id}.json` : 'ships.json',
    layer: { kind: 'none' },
    overlayTime: 'year',
    unranked: true,
    rankingBars: false,
    format: ships,
    formatTick: n0,
    coverage: {
      countries: iso3s,
      reason: only
        ? { zh: `這個指標只看${view.nations.zh}的船`, en: `This view shows ${view.nations.en} ships only` }
        : {
            zh: '不是這些船的國籍（CLIWOC 收英國、荷蘭、西班牙、法國檔案館的航海日誌，另有少數瑞典、美國、漢堡、丹麥的船）',
            en: 'Not a nationality of these ships (CLIWOC covers logbooks in British, Dutch, Spanish and French archives, plus a few Swedish, American, Hamburg and Danish ships)',
          },
    },
    missing: { zh: '這一年沒有這國的船的航海日誌', en: 'No logbooks from this country’s ships this year' },
  };
});

/** 航線圖層（每個指標一份，只差 id、indicators 與 onlyTypes） */
const VOYAGES: LinesOverlayDef = {
  kind: 'lines',
  id: 'voyages',
  file: 'tracks.json',
  label: { zh: '航線', en: 'Voyages' },
  width: 1.3,
  color: {
    title: { zh: '船的國籍', en: 'Nationality' },
    classes: [
      ...NATION_COLORS.map((c, i) => ({ value: i, color: c.light, dark: c.dark, label: NATIONS[i].name })),
      {
        value: OTHER,
        color: MAP_TOKENS.inkMuted,
        label: { zh: '其他（瑞典、美國、漢堡、丹麥）', en: 'Other (Swedish, American, Hamburg, Danish)' },
      },
    ],
  },
  timeField: 'y',
  groupField: 'v',
  casing: true,
  tooltip: trackTooltip,
};

/**
 * 航程清單（第十二批 207）：每個指標一份（只列那個指標看的船），讀線（tracks.json 依 v 分組，一趟航程一組）；
 * 時間軸那一年在海上的航程（出發到抵達跨過那一年），依出發日期；每列：船名、國籍與公司、出發地 → 目的地、日期。
 * 點了框住整趟航線並標出來
 */
function voyageList(view: (typeof SHIP_VIEWS)[number]): ListPanelDef {
  return {
    label: { zh: '這一年的航程', en: 'Voyages this year' },
    indicators: [view.id],
    file: 'tracks.json',
    lines: { groupField: 'v' },
    empty: { zh: '這一年沒有這些船的航海日誌', en: 'No logbooks for these ships this year' },
    rows: (points, { year }) =>
      points
        .filter((p) => {
          if (view.types && !view.types.includes(nationType(Number(p.n)))) return false;
          const a = typeof p.a === 'number' ? Math.floor(p.a / 10000) : Number(p.y);
          const b = typeof p.b === 'number' ? Math.floor(p.b / 10000) : Number(p.y);
          return a <= year && year <= b;
        })
        .sort((a, b) => Number(a.a ?? 0) - Number(b.a ?? 0) || Number(a.v) - Number(b.v))
        .map((p): ListRow => {
          const company = companyName(p.c);
          return {
            key: String(p.v),
            title: shipName(p.s),
            titleProper: typeof p.s === 'string' && p.s !== '',
            lines: [
              company ? `${nationName(p.n)} · ${company}` : nationName(p.n),
              routeText(p.f, p.t),
              typeof p.a === 'number' && typeof p.b === 'number' ? dateRange(p.a, p.b) : '',
            ].filter(Boolean),
            target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
            line: { overlay: view.overlay, group: Number(p.v) },
          };
        }),
  };
}

export const logbooks: TopicDefinition = {
  id: 'logbooks',
  title: { zh: '大航海時代的航海日誌', en: "Ships' logbooks of the age of sail" },
  shortTitle: { zh: '航海日誌', en: 'Logbooks' },
  defaultIndicator: 'ships',
  defaultYear: 1778,
  sources: [
    {
      name: {
        zh: 'CLIWOC 2.1（Climatological Database for the World’s Oceans 1750–1854；García-Herrera 等 2007，PANGAEA）',
        en: 'CLIWOC 2.1 (Climatological Database for the World’s Oceans 1750–1854; García-Herrera et al. 2007, PANGAEA)',
      },
      url: 'https://doi.org/10.1594/PANGAEA.743343',
      license: { zh: 'CC BY 3.0', en: 'CC BY 3.0' },
    },
    {
      name: {
        zh: 'Marine Regions：IHO Sea Areas v3（判斷航線有沒有穿過陸地）',
        en: 'Marine Regions: IHO Sea Areas v3 (to check whether tracks cross land)',
      },
      url: 'https://doi.org/10.14284/323',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '資料是 CLIWOC（1750–1854 年世界海洋的氣候資料庫）2.1 版：歐盟資助的計畫（2003 年完成）從英國、荷蘭、西班牙、法國的檔案館抄錄 1,700 多本航海日誌、約 28 萬筆紀錄，另有少數瑞典、美國、漢堡、丹麥的船（1662–1855 年，大部分在 1750–1854 年）。航線是每天正午的船位（推算或天文觀測，經度換算成格林威治起算）連成的直線，不是實際的航跡；相鄰兩筆船位相隔超過 10 天、或距離超過一天 550 公里能走的距離時斷開，離前後兩筆都太遠的單獨一點（抄錯、東西經寫反）拿掉，兩筆船位之間的直線深入陸地超過 30 公里也斷開（陸地與海依 Marine Regions 的 IHO 海域），仍可能有少數錯誤的位置。同一本日誌、同一艘船，出發地或目的地改變就是另一個航程。日期是 CLIWOC 換算的世界標準時間，可能跟日誌上的差一天。地名、船名、船長照日誌的原文（荷、英、西、法文）。國家的值是那一年有航海日誌的船數（國籍對到今天的國家，漢堡算在德國）；這只是留存並被抄錄的日誌，不是當時各國航行的船的總數。經過附近是航線（每 10 公里內插一點）在國界內或離國界 100 公里以內（Natural Earth 1:50m 國界）。',
    en: 'The data come from CLIWOC (Climatological Database for the World’s Oceans 1750–1854), release 2.1: an EU-funded project (completed in 2003) transcribed more than 1,700 logbooks from British, Dutch, Spanish and French archives, about 287,000 records, plus a few Swedish, American, Hamburg and Danish ships (1662–1855, mostly 1750–1854). Tracks join each day’s noon position (dead reckoning or astronomical fixes, longitudes converted to Greenwich) with straight lines, so they are not the actual course. A track is broken where consecutive positions are more than 10 days apart or farther apart than a ship could sail at 550 km a day; isolated positions far from both neighbours (copying errors, east and west swapped) are removed, as are straight lines between positions that run more than 30 km inland (land and sea from the Marine Regions IHO sea areas); a few wrong positions may remain. A new voyage starts when the departure or destination port changes within a logbook. Dates are UTC as converted by CLIWOC and may differ by a day from the logbook. Place names, ship names and captains are as written in the logbooks (Dutch, English, Spanish or French). Country values are the number of ships with logbooks that year (nationality mapped to today’s countries, Hamburg to Germany); they reflect the logbooks that survived and were transcribed, not the number of ships each country sailed. Passing nearby means the track (interpolated every 10 km) entered the country or came within 100 km of it (Natural Earth 1:50m borders).',
  },
  panelExtra: () => import('./panels/LogbooksPanel'),
  listPanel: SHIP_VIEWS.map(voyageList),
  overlays: SHIP_VIEWS.map((view) => ({ ...VOYAGES, id: view.overlay, indicators: [view.id], onlyTypes: view.types ?? undefined })),
  indicators,
};
