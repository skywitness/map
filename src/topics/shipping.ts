import { getLang, tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { ferriesExtra } from './ferries';
import type { PointRecord, PointsOverlayDef, Text, TopicDefinition } from './types';

/**
 * 航運與港口（pipeline/topics/shipping.py）：UNCTAD 的貨櫃吞吐量、班輪航運連結指數、商船隊（船旗國、實質船東）、造船，
 * NGA World Port Index 的港口，世界銀行／IMF 的航運密度網格（部署時產生，pipeline/topics/shipping_density_tiles.py）；
 * 渡輪航線在 ferries.ts（pipeline/topics/ferry_routes.py）。
 */

const TEU = 'TEU';
const DWT = { zh: '載重噸', en: 'dwt' };
const GT = { zh: '總噸', en: 'GT' };

const teu = (v: number) => `${formatLargeNumber(v)} ${TEU}`;
const dwt = (v: number) => `${formatLargeNumber(v)} ${tr(DWT)}`;
const gt = (v: number) => `${formatLargeNumber(v)} ${tr(GT)}`;

/** World Port Index 的港口大小（pipeline/sources/wpi.py 的 SIZES）：1 很小、2 小、3 中、4 大，0 不明 */
export const PORT_SIZES: Record<number, Text> = {
  0: { zh: '大小不明', en: 'size unknown' },
  1: { zh: '很小的港口', en: 'very small port' },
  2: { zh: '小型港口', en: 'small port' },
  3: { zh: '中型港口', en: 'medium port' },
  4: { zh: '大型港口', en: 'large port' },
};
/** 港口大小的短名稱（圖例、側欄的表格） */
export const PORT_SIZE_SHORT: Record<number, Text> = {
  0: { zh: '不明', en: 'Unknown' },
  1: { zh: '很小', en: 'Very small' },
  2: { zh: '小', en: 'Small' },
  3: { zh: '中', en: 'Medium' },
  4: { zh: '大', en: 'Large' },
};

/** 港口類型（pipeline/sources/wpi.py 的 TYPES），依類別排在一起，地圖依代碼的範圍上色 */
export const PORT_TYPES: Record<number, Text> = {
  1: { zh: '海岸（天然）', en: 'coastal (natural)' },
  2: { zh: '海岸（防波堤）', en: 'coastal (breakwater)' },
  3: { zh: '海岸（潮閘）', en: 'coastal (tide gates)' },
  4: { zh: '避風港', en: 'typhoon harbour' },
  5: { zh: '河港（天然）', en: 'river (natural)' },
  6: { zh: '河港（港池）', en: 'river (basins)' },
  7: { zh: '河港（潮閘）', en: 'river (tide gates)' },
  8: { zh: '運河或湖泊', en: 'canal or lake' },
  9: { zh: '開放錨地', en: 'open roadstead' },
  10: { zh: '類型不明', en: 'type unknown' },
};

/** 港口的名稱：有中文（主要港口、台灣的港口）就用中文，英文介面用整理過的英文名，其他照 World Port Index 的原文 */
export function portName(p: PointRecord, lang: 'zh' | 'en'): string {
  const own = lang === 'zh' ? p.zh : p.en;
  return typeof own === 'string' ? own : String(p.name ?? '');
}

/** 港口、運河與海峽、航運咽喉畫在這些指標（渡輪航線不畫：點的顏色跟渡輪的線混在一起） */
const POINT_INDICATORS = ['container', 'lsci', 'fleet-flag', 'fleet-owner', 'shipbuilding', 'traffic'];

const quarterText = (q: string) => {
  const [y, n] = [q.slice(0, 4), Number(q.slice(5))];
  return tr({ zh: `${y} 年第 ${n} 季`, en: `Q${n} ${y}` });
};
/** PLSCI 的那一季（ports.json 的 plsciQuarter）；tooltip 只寫指數與名次，季別寫在圖層說明與側欄 */
export const PLSCI_QUARTER = '2026Q03';

const PORTS: PointsOverlayDef = {
  kind: 'points',
  id: 'ports',
  indicators: POINT_INDICATORS,
  file: 'ports.json',
  label: { zh: '港口（World Port Index）', en: 'Ports (World Port Index)' },
  radius: { field: 'size', stops: [[1, 1.6], [2, 2.3], [3, 3.2], [4, 4.6]] },
  color: {
    field: 'type',
    title: { zh: '港口類型', en: 'Harbour type' },
    thresholds: [1.5, 4.5, 8.5, 9.5],
    classes: [
      { color: MAP_TOKENS.categorical[0], label: { zh: '海岸（天然）', en: 'Coastal (natural)' } },
      { color: MAP_TOKENS.categorical[3], label: { zh: '海岸（防波堤、潮閘、避風港）', en: 'Coastal (breakwater, tide gates)' } },
      { color: MAP_TOKENS.categorical[7], label: { zh: '河港、運河與湖泊', en: 'River, canal or lake' } },
      { color: MAP_TOKENS.categorical[2], label: { zh: '開放錨地', en: 'Open roadstead' } },
      { color: MAP_TOKENS.context, label: { zh: '不明', en: 'Unknown' } },
    ],
  },
  sortField: 'size',
  // 世界全圖只畫中、大型港口，放大到 3 級加上小港口，5 級以上全部（含大小不明的）
  minValue: { field: 'size', stops: [[0, 3], [3, 2], [5, 0]] },
  sizeLegend: {
    title: { zh: '港口大小（World Port Index）', en: 'Harbour size (World Port Index)' },
    values: [1, 2, 3, 4],
    format: (v) => tr(PORT_SIZE_SHORT[v] ?? ''),
  },
  tooltip: (p, { countryName }) => {
    const lang = getLang();
    const title = portName(p, lang);
    const size = tr(PORT_SIZES[Number(p.size)] ?? PORT_SIZES[0]);
    const type = tr(PORT_TYPES[Number(p.type)] ?? PORT_TYPES[10]);
    const extra: string[] = [];
    if (typeof p.plsci === 'number') {
      extra.push(
        tr({
          zh: `港口班輪航運連結指數 ${fixed(p.plsci, 0)}（${quarterText(PLSCI_QUARTER)}，第 ${p.prank} 名）`,
          en: `Port liner shipping connectivity ${fixed(p.plsci, 0)} (${quarterText(PLSCI_QUARTER)}, #${p.prank})`,
        }),
      );
    }
    if (typeof p.teu === 'number') {
      const scope = lang === 'zh' ? p.scope : p.scopeEn;
      extra.push(
        tr({
          zh: `${p.teuYear} 年貨櫃吞吐量 ${teu(p.teu)}（港口公布${typeof scope === 'string' ? `，${scope}` : ''}）`,
          en: `Container throughput ${p.teuYear}: ${teu(p.teu)} (port’s own figure${typeof scope === 'string' ? `; ${scope}` : ''})`,
        }),
      );
    }
    return {
      title,
      detail: `${countryName(String(p.iso3))} · ${size} · ${type}${p.box === 1 ? tr({ zh: ' · 有貨櫃碼頭', en: ' · container terminal' }) : ''}`,
      extra,
      properNoun: title !== p.name ? String(p.name) : undefined,
    };
  },
};

const count = (v: number) => (getLang() === 'zh' ? formatLargeNumber(v) : fixed(v, 0));

/** IMF PortWatch 的 28 個航運咽喉（pipeline/topics/waterways.py）：大小是最近一整年通過的貨船數 */
const CHOKEPOINTS: PointsOverlayDef = {
  kind: 'points',
  id: 'chokepoints',
  indicators: POINT_INDICATORS,
  file: 'chokepoints.json',
  label: { zh: '航運咽喉（IMF PortWatch，一年通過的貨船）', en: 'Shipping chokepoints (IMF PortWatch, cargo ships a year)' },
  radius: { field: 'n', stops: [[1000, 4], [10000, 6.5], [30000, 9.5], [90000, 14]] },
  color: MAP_TOKENS.categorical[4],
  sortField: 'n',
  sizeLegend: {
    title: { zh: '一年通過的貨船（艘次）', en: 'Cargo ship transits a year' },
    values: [5000, 30000, 90000],
    format: (v) => count(v),
  },
  tooltip: (p) => {
    const lang = getLang();
    const title = String((lang === 'zh' ? p.zh : p.en) ?? p.en);
    const extra: string[] = [];
    if (typeof p.n === 'number') {
      extra.push(
        tr({
          zh: `${p.yr} 年通過 ${count(p.n)} 艘次貨船（每天約 ${fixed(p.n / 365, 0)} 艘）`,
          en: `${fixed(p.n, 0)} cargo ship transits in ${p.yr} (about ${fixed(p.n / 365, 0)} a day)`,
        }),
      );
      const types: [string, { zh: string; en: string }][] = [
        ['t', { zh: '油輪', en: 'tankers' }],
        ['c', { zh: '貨櫃船', en: 'container ships' }],
        ['b', { zh: '乾散貨船', en: 'dry bulk carriers' }],
        ['g', { zh: '雜貨船', en: 'general cargo ships' }],
        ['r', { zh: '滾裝船', en: 'ro-ro ships' }],
      ];
      extra.push(
        types
          .filter(([k]) => typeof p[k] === 'number' && (p[k] as number) > 0)
          .map(([k, label]) => tr({ zh: `${label.zh} ${count(p[k] as number)}`, en: `${fixed(p[k] as number, 0)} ${label.en}` }))
          .join(tr({ zh: '、', en: ', ' })),
      );
    }
    if (typeof p.n0 === 'number') {
      extra.push(tr({ zh: `${p.y0} 年 ${count(p.n0)} 艘次`, en: `${fixed(p.n0, 0)} in ${p.y0}` }));
    }
    return {
      title,
      detail: tr({ zh: '航運咽喉（IMF PortWatch）', en: 'Shipping chokepoint (IMF PortWatch)' }),
      extra,
      properNoun: lang === 'zh' ? String(p.en) : undefined,
    };
  },
};

/** Wikidata 有英文維基條目的運河與海峽（pipeline/topics/waterways.py）：世界全圖只畫條目多的，放大才全部畫 */
const WATERWAYS: PointsOverlayDef = {
  kind: 'points',
  id: 'waterways',
  indicators: POINT_INDICATORS,
  file: 'waterways.json',
  label: { zh: '運河與海峽（Wikidata）', en: 'Canals and straits (Wikidata)' },
  radius: { field: 'sl', stops: [[0, 2], [20, 2.8], [60, 3.8], [150, 5]] },
  color: {
    field: 'k',
    title: { zh: '種類', en: 'Type' },
    thresholds: [1.5],
    classes: [
      { color: MAP_TOKENS.categorical[1], label: { zh: '運河', en: 'Canal' } },
      { color: MAP_TOKENS.categorical[6], label: { zh: '海峽', en: 'Strait' } },
    ],
  },
  sortField: 'sl',
  // 世界全圖只畫維基百科條目 30 個語言以上的，放大到 3 級 10 個以上，5 級以上全部
  minValue: { field: 'sl', stops: [[0, 30], [3, 10], [5, 0]] },
  tooltip: (p, { countryName }) => {
    const lang = getLang();
    const title = String((lang === 'zh' ? p.zh : null) ?? p.en);
    const kind = p.k === 1 ? tr({ zh: '運河', en: 'Canal' }) : tr({ zh: '海峽', en: 'Strait' });
    const facts: string[] = [];
    if (typeof p.y === 'number') facts.push(tr({ zh: `${p.y} 年啟用`, en: `opened ${p.y}` }));
    if (typeof p.l === 'number') facts.push(tr({ zh: `長 ${p.l >= 1000 ? `${fixed(p.l / 1000, 1)} 公里` : `${p.l} 公尺`}`, en: `length ${p.l >= 1000 ? `${fixed(p.l / 1000, 1)} km` : `${p.l} m`}` }));
    if (typeof p.w === 'number') facts.push(tr({ zh: `寬 ${p.w >= 1000 ? `${fixed(p.w / 1000, 1)} 公里` : `${p.w} 公尺`}`, en: `width ${p.w >= 1000 ? `${fixed(p.w / 1000, 1)} km` : `${p.w} m`}` }));
    return {
      title,
      detail: [kind, typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      extra: facts.length ? [facts.join(' · ')] : [],
      properNoun: lang === 'zh' && title !== p.en ? String(p.en) : undefined,
    };
  },
};

/**
 * 航運密度網格的分級（每個約 500 m 格子的平均 AIS 船位數，對數）：平均不到 TRAFFIC_MIN 的不上色。
 * 跟 pipeline/topics/shipping_density_tiles.py 一樣（產生圖磚時會檢查；部署的快取鍵也含這兩行）
 */
export const TRAFFIC_THRESHOLDS = [1e5, 3e5, 1e6, 3e6, 1e7, 3e7];
const TRAFFIC_MIN = 3e4;
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 10 的次方：10⁴、3×10⁵ */
const power = (v: number) => {
  const e = Math.floor(Math.log10(v) + 1e-9);
  const m = Math.round(v / 10 ** e);
  const exp = [...String(e)].map((d) => SUPERSCRIPTS[Number(d)]).join('');
  return `${m === 1 ? '' : `${m}×`}10${exp}`;
};
const TRAFFIC_TEXT = {
  zh: '世界銀行與 IMF 用 2015 年 1 月到 2021 年 2 月每小時的 AIS 船位（船舶自動識別系統回報的位置）算出的航運密度：顏色越深，經過、停泊的船越多（對數分級，數值是每個約 500 m 格子的平均船位數，只能看相對的多寡）。放大後航道與港口更清楚；點是港口。滑過國家看貨櫃吞吐量。',
  en: 'Shipping traffic density from hourly AIS vessel positions (the Automatic Identification System) between January 2015 and February 2021, compiled by the World Bank and IMF: darker means more ships passing or at anchor (log scale; values are average positions per cell of about 500 m and are only meaningful relative to each other). Zoom in to see shipping lanes and ports; dots are ports. Hover over a country for its container throughput.',
};

const UNCTAD_NOTE = {
  zh: 'UNCTAD 的「China, Taiwan Province of」就是台灣，地圖上寫台灣；UNCTAD 的中國不含香港、澳門與台灣。',
  en: 'UNCTAD’s “China, Taiwan Province of” is shown as Taiwan; UNCTAD’s China excludes Hong Kong, Macao and Taiwan.',
};

export const shipping: TopicDefinition = {
  id: 'shipping',
  title: { zh: '航運與港口', en: 'Shipping and ports' },
  shortTitle: { zh: '航運', en: 'Shipping' },
  defaultIndicator: 'container',
  defaultYear: 2025,
  sources: [
    {
      name: {
        zh: 'UNCTAD Data Hub（貨櫃吞吐量、班輪航運連結指數、商船隊、造船）',
        en: 'UNCTAD Data Hub (container throughput, liner shipping connectivity, merchant fleet, shipbuilding)',
      },
      url: 'https://unctadstat.unctad.org/datacentre/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: { zh: '世界銀行／IMF Global Shipping Traffic Density（航運密度）', en: 'World Bank / IMF, Global Shipping Traffic Density' },
      url: 'https://datacatalog.worldbank.org/search/dataset/0037580',
      license: 'CC BY 4.0',
    },
    {
      name: 'NGA World Port Index (Pub. 150)',
      url: 'https://msi.nga.mil/Publications/WPI',
      license: { zh: '公有領域', en: 'public domain' },
    },
    {
      name: { zh: '各港口公布的 2025 年貨櫃吞吐量（出處見側欄）', en: 'Ports’ own 2025 container throughput (sources in the side panel)' },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/sources/port_teu.py',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
    {
      name: { zh: '臺灣港務公司（國際商港貨櫃裝卸量）', en: 'Taiwan International Ports Corporation (container throughput)' },
      url: 'https://data.gov.tw/dataset/8368',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
    {
      name: { zh: 'IMF PortWatch（航運咽喉與每天的通過數）', en: 'IMF PortWatch (shipping chokepoints and daily transits)' },
      url: 'https://portwatch.imf.org/',
      license: { zh: 'IMF 條款（註明來源）', en: 'IMF terms (with attribution)' },
    },
    { name: { zh: 'Wikidata（運河與海峽）', en: 'Wikidata (canals and straits)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    ...ferriesExtra.sources,
  ],
  note: {
    zh: `資料來源：United Nations Trade and Development Data Hub（UNCTADstat）。${UNCTAD_NOTE.zh}港口的點是美國國家地理空間情報局（NGA）的 World Port Index，大小與類型照它的分類；點上的港口班輪航運連結指數（PLSCI）也來自 UNCTAD（依 UN/LOCODE 與港名對到 World Port Index，900 多個貨櫃港對到約 780 個）。主要貨櫃港的 2025 年吞吐量是各港自己公布的數字（港務局、港口公司或政府統計，引用事實並註明出處），沒有用 Lloyd's List、Alphaliner 等有版權的排名。航運咽喉是 IMF PortWatch 的 28 個運河與海峽，用 AIS 船位推算每天通過的貨船（貨櫃船、乾散貨船、雜貨船、滾裝船、油輪；同一艘船 48 小時內不重複算、沒有依船的大小加權），這裡加總成一整年：2025 年台灣海峽 8.7 萬艘次最多，其次麻六甲海峽、朝鮮海峽；蘇伊士運河從 2023 年的 2.7 萬掉到 1.4 萬（紅海危機後改繞好望角，好望角從 1.8 萬增加到 3.3 萬）。運河與海峽的點是 Wikidata 直接標成運河、海峽、有英文維基百科條目的（世界全圖只畫條目多的，放大才全部畫）；Wikidata 只有一個點，運河畫不出整條線，標成運河的也有不少是灌溉渠。渡輪航線是 OpenStreetMap 的 route=ferry，只留定期客運（排除觀光船與河上的擺渡），台灣附航港局國內固定航班的班次；渡輪的資料檔是 OSM 的衍生資料庫，以 ODbL 提供。各國之間的貿易流向見「國際貿易流向」主題，鐵路與機場見「各國交通」主題，專屬經濟海域與漁業見「海洋與漁業」主題。`,
    en: `Source: United Nations Trade and Development Data Hub (UNCTADstat). ${UNCTAD_NOTE.en} Port points are the US National Geospatial-Intelligence Agency’s World Port Index, with its size and type classes; the port liner shipping connectivity index (PLSCI) on the points is also UNCTAD’s (matched to the World Port Index by UN/LOCODE and name: about 780 of 900-odd container ports). The 2025 throughput of major container ports is each port’s own published figure (port authority, port company or government statistics, cited as facts); no proprietary rankings such as Lloyd’s List or Alphaliner are used. Shipping chokepoints are IMF PortWatch’s 28 canals and straits, with daily cargo ship transits (container ships, dry bulk carriers, general cargo ships, ro-ro ships and tankers) estimated from AIS positions (a ship is not counted twice within 48 hours, and transits are not weighted by ship size), summed here over a full year: in 2025 the Taiwan Strait led with 87,000, followed by the Strait of Malacca and the Korea Strait; the Suez Canal fell from 27,000 in 2023 to 14,000 (ships rerouted round the Cape of Good Hope after the Red Sea crisis, which rose from 18,000 to 33,000). Canal and strait dots are Wikidata items classed directly as canals or straits that have an English Wikipedia article (the world view shows only those with many articles; zoom in for all); Wikidata has a single point for each, so canals cannot be drawn as lines, and some items classed as canals are irrigation channels. Ferry routes are OpenStreetMap’s route=ferry, keeping only scheduled passenger services (no sightseeing boats or river ferries), with sailings from Taiwan’s Maritime and Port Bureau timetable for Taiwan; the ferry data files are a derived database of OSM, available under the ODbL. For trade flows between countries see the International trade flows topic; for railways and airports, Transport by country; for exclusive economic zones and fisheries, Oceans and fisheries.`,
  },
  panelExtra: () => import('./panels/ShippingPanel'),
  overlays: [PORTS, WATERWAYS, CHOKEPOINTS, ...ferriesExtra.overlays],
  listPanel: ferriesExtra.listPanel,
  indicators: [
    {
      id: 'container',
      label: { zh: '貨櫃吞吐量', en: 'Container throughput' },
      description: {
        zh: '各國港口一年裝卸的貨櫃（TEU，20 呎櫃的數量；40 呎櫃算 2 個）。轉運櫃在中轉港卸下、裝上各算一次，所以新加坡這類轉運港特別大。圓的面積與 TEU 成正比；點是港口，滑過看港口的連結指數與主要港口公布的吞吐量。',
        en: 'Containers handled by each country’s ports in a year, in TEU (twenty-foot equivalent units; a 40-foot box counts as 2). Transhipped boxes are counted when unloaded and again when reloaded, so hubs such as Singapore stand out. Circle area is proportional to TEU; dots are ports — hover for their connectivity and, for major ports, their own published throughput.',
      },
      unit: TEU,
      file: 'container.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: teu,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2024,
    },
    {
      id: 'lsci',
      label: { zh: '航運連結指數', en: 'Shipping connectivity' },
      description: {
        zh: 'UNCTAD 的班輪航運連結指數（LSCI）：依每週靠港的貨櫃船班次、運能、航線數、船公司數、最大船型與直航的國家數計算，2023 年第 1 季各國平均 = 100，越高代表跟全球貨櫃航線網連得越好。每年是各季的平均，2026 年只有第 1–3 季。',
        en: 'UNCTAD’s Liner Shipping Connectivity Index (LSCI), built from weekly container-ship calls, deployed capacity, number of services, number of carriers, largest ship size and number of countries served directly; the average across countries in Q1 2023 = 100. Higher means better connected to the global container shipping network. Each year is the average of its quarters; 2026 covers Q1–Q3 only.',
      },
      unit: { zh: '指數', en: 'index' },
      file: 'lsci.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 100, 200, 400] } },
      format: (v) => tr({ zh: `指數 ${fixed(v, 0)}`, en: `Index ${fixed(v, 0)}` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2025,
    },
    {
      id: 'fleet-flag',
      label: { zh: '商船隊（船旗國）', en: 'Fleet by flag' },
      description: {
        zh: '在這個國家登記、掛它的國旗的商船（100 總噸以上），以載重噸（能載多少噸貨）計，每年 1 月 1 日。巴拿馬、賴比瑞亞、馬紹爾群島這類「權宜船籍」國登記了世界上最多的船，船東大多在別的國家（見「商船隊（船東國）」）。',
        en: 'Merchant ships (100 GT and above) registered in, and flying the flag of, each country, by deadweight tonnage (how many tonnes of cargo they can carry), as of 1 January. Open registries such as Panama, Liberia and the Marshall Islands register the most ships, mostly owned from elsewhere (see Fleet by owner).',
      },
      unit: DWT,
      file: 'fleet-flag.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: dwt,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2026,
    },
    {
      id: 'fleet-owner',
      label: { zh: '商船隊（船東國）', en: 'Fleet by owner' },
      description: {
        zh: '實質船東（負責營運的公司）在這個國家的商船（1,000 總噸以上），不論掛哪一國的旗，以載重噸計，每年 1 月 1 日。希臘、中國、日本的船東擁有最多的船；側欄列出這些船掛哪些國家的旗。',
        en: 'Merchant ships (1,000 GT and above) whose beneficial owner — the company with commercial responsibility — is based in each country, whatever flag they fly, by deadweight tonnage, as of 1 January. Greek, Chinese and Japanese owners control the most tonnage; the side panel shows which flags their ships fly.',
      },
      unit: DWT,
      file: 'fleet-owner.json',
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: dwt,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2026,
    },
    {
      id: 'shipbuilding',
      label: { zh: '造船量', en: 'Shipbuilding' },
      description: {
        zh: '當年在這個國家的船廠完工交船的商船，以總噸（GT，船的容積）計。中國、南韓、日本造了世界上九成以上的船。',
        en: 'Merchant ships completed and delivered by each country’s shipyards in the year, in gross tonnage (GT, a measure of a ship’s volume). China, South Korea and Japan build over nine-tenths of the world’s ships.',
      },
      unit: GT,
      file: 'shipbuilding.json',
      layer: { kind: 'bubble', legendValues: [1e5, 1e6, 1e7] },
      format: gt,
      formatTick: formatLargeTick,
      shareOfWorld: true,
      defaultYear: 2025,
    },
    ...ferriesExtra.indicators,
    {
      id: 'traffic',
      label: { zh: '航運密度', en: 'Ship traffic' },
      description: TRAFFIC_TEXT,
      unit: TEU,
      // 網格沒有國家的值：tooltip 與排名表用貨櫃吞吐量（跟交通主題的「路網地圖」用鐵路長度一樣）
      file: 'container.json',
      layer: { kind: 'none' },
      format: (v) => tr({ zh: `貨櫃吞吐量 ${teu(v)}`, en: `Container throughput: ${teu(v)}` }),
      formatTick: power,
      defaultYear: 2024,
      grid: {
        dir: 'ship-density',
        only: true,
        defaultOn: true,
        label: { zh: '約 5 km 網格', en: '~5 km grid' },
        unit: { zh: '平均 AIS 船位', en: 'mean AIS positions' },
        subtitle: TRAFFIC_TEXT,
        epochNote: () =>
          tr({
            zh: '2015 年 1 月–2021 年 2 月的 AIS 船位 · 縮小時為範圍內平均',
            en: 'AIS positions Jan 2015 – Feb 2021 · averaged when zoomed out',
          }),
        empty: { zh: `平均不到 ${power(TRAFFIC_MIN)} 個船位（不上色）`, en: `Under ${power(TRAFFIC_MIN)} positions (not coloured)` },
      },
    },
  ],
};
