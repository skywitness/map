import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ListPanelDef, ListRow, PointsOverlayDef } from './types';

/**
 * 航運與港口的擴充（2026-11-07，製作手冊第二十七批 579、580）：
 * - 579 每個港口進出幾艘船、裝卸幾噸：IMF PortWatch 的 2,065 個港口與每天的靠港、進出口（pipeline/topics/port_calls.py）
 * - 580 港口裝的是什麼：Eurostat mar_mg_am_cwhc 的貨型比例（pipeline/topics/port_cargo_types.py）
 */
export const PORT_ACTIVITY_IDS = ['port-calls', 'port-cargo'];
export const PORT_CARGO_TYPE_IDS = ['port-cargo-type'];

export const CARGO_TYPES = [
  { id: 'liquid-bulk', label: { zh: '液體散貨', en: 'Liquid bulk' } },
  { id: 'dry-bulk', label: { zh: '乾散貨', en: 'Dry bulk' } },
  { id: 'containers', label: { zh: '貨櫃', en: 'Containers' } },
  { id: 'roro-self', label: { zh: '滾裝（自走）', en: 'Ro-Ro, self-propelled' } },
  { id: 'roro-other', label: { zh: '滾裝（非自走）', en: 'Ro-Ro, non-self-propelled' } },
  { id: 'other', label: { zh: '其他', en: 'Other' } },
];

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const tonnes = (v: number) => tr({ zh: `${formatLargeNumber(v)} 公噸`, en: `${formatLargeNumber(v)} t` });

const PORTWATCH_PORTS: PointsOverlayDef = {
  kind: 'points',
  id: 'portwatch-ports',
  file: 'portwatch-ports.json',
  label: { zh: '港口的靠港次數（IMF PortWatch）', en: 'Port calls by port (IMF PortWatch)' },
  indicators: PORT_ACTIVITY_IDS,
  radius: { field: 'c', stops: [[100, 2], [2000, 4], [10000, 7], [45000, 12]] },
  color: MAP_TOKENS.hues.aqua,
  sortField: 'c',
  sizeLegend: { title: { zh: '2025 年的靠港艘次', en: 'Port calls in 2025' }, values: [1000, 10000, 40000], format: formatLargeTick },
  tooltip: (p, { countryName }) => ({
    title: String(p.n ?? ''),
    properNoun: str(p.n) ?? undefined,
    detail: [typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null,
      tr({ zh: `2025 年靠港 ${fixed(num(p.c), 0)} 艘次`, en: `${fixed(num(p.c), 0)} port calls in 2025` })].filter(Boolean).join(' · '),
    extra: [
      tr({ zh: `進口 ${tonnes(num(p.im))}、出口 ${tonnes(num(p.ex))}`, en: `Imports ${tonnes(num(p.im))}, exports ${tonnes(num(p.ex))}` }),
      typeof p.si === 'number' ? tr({ zh: `占全國海運進口 ${fixed(p.si, 1)}%`, en: `${fixed(p.si, 1)}% of the country’s seaborne imports` }) : null,
      [p.i1, p.i2, p.i3].some(str) ? tr({ zh: `主要產業：${[p.i1, p.i2, p.i3].filter(str).join(', ')}`, en: `Main industries: ${[p.i1, p.i2, p.i3].filter(str).join(', ')}` }) : null,
    ].filter((x): x is string => Boolean(x)),
  }),
};

const PORT_LIST: ListPanelDef = {
  label: { zh: '港口（依 2025 年靠港艘次）', en: 'Ports (by port calls in 2025)' },
  indicators: PORT_ACTIVITY_IDS,
  file: 'portwatch-ports.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) =>
    [...points]
      .sort((a, b) => num(b.c) - num(a.c))
      .slice(0, country ? undefined : 100)
      .map((p, i): ListRow => ({
        key: `pw-${i}`,
        title: String(p.n ?? ''),
        lines: [
          [typeof p.iso3 === 'string' && p.iso3 ? countryName(p.iso3) : null, tr({ zh: `${fixed(num(p.c), 0)} 艘次`, en: `${fixed(num(p.c), 0)} calls` })].filter(Boolean).join(' · '),
          tr({ zh: `進口 ${tonnes(num(p.im))}、出口 ${tonnes(num(p.ex))}`, en: `Imports ${tonnes(num(p.im))}, exports ${tonnes(num(p.ex))}` }),
        ],
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
      })),
  empty: { zh: 'PortWatch 沒有這個國家的港口', en: 'No PortWatch ports in this country' },
};

const PORTWATCH_NOTE = {
  zh: 'IMF PortWatch 用船舶自動識別系統（AIS）推算每個港口每天的靠港與裝卸量，只算貨船（貨櫃、乾散貨、雜貨、滾裝、油輪）；資料依 IMF 條款註明來源使用，商業再利用要另外申請。',
  en: 'IMF PortWatch estimates daily port calls and cargo for each port from ship tracking (AIS), counting cargo ships only (container, dry bulk, general cargo, Ro-Ro, tanker); used with attribution under the IMF terms, and commercial reuse needs separate permission.',
};

export const portCallsPart: TopicPart = {
  name: { zh: '每個港口的靠港與裝卸', en: 'Port calls and cargo by port' },
  sources: [
    {
      name: { zh: 'IMF PortWatch：港口資料庫與每天的港口資料（PortWatch_ports_database、Daily_Ports_Data）', en: 'IMF PortWatch: ports database and daily port data (PortWatch_ports_database, Daily_Ports_Data)' },
      url: 'https://portwatch.imf.org/',
      license: { zh: 'IMF 條款（註明來源）', en: 'IMF terms (attribution)' },
    },
  ],
  note: PORTWATCH_NOTE,
  overlays: [PORTWATCH_PORTS],
  listPanel: [PORT_LIST],
  panelExtra: () => import('./panels/PortActivityPanel'),
  indicators: [
    {
      id: 'port-calls',
      label: { zh: '港口的靠港艘次', en: 'Port calls' },
      description: {
        zh: `一年裡貨船在這國各港口靠港幾艘次（IMF PortWatch，2019 年起，各港每天加總），圓是國家的合計，點是 2,065 個港口。2025 年中國 279,565 艘次、日本 275,124（國內線的小港多），印尼 75,489、美國 70,666、南韓 60,201、荷蘭 54,704、新加坡 51,811；台灣 24,071。港口以新加坡 46,210 艘次最多，上海 43,566、鹿特丹 30,164、安特衛普 21,218、寧波 20,921、釜山 19,466。台灣 10 個港：高雄 11,372、臺中 4,998、基隆 3,371、臺北 2,205、麥寮 1,143；占全國海運進口高雄 48.22%、臺中 23.6%、麥寮 10.88%、基隆 6.76%（PortWatch 港口資料庫）。UNCTAD 的港口停靠統計只有約 70 國、沒有台灣，所以先前沒有放，PortWatch 兩個問題都解決了。${PORTWATCH_NOTE.zh}`,
        en: `Port calls by cargo ships at the country’s ports in a year (IMF PortWatch, from 2019, summed from each port’s daily data); circles show country totals and points the 2,065 ports. In 2025 China had 279,565 calls, Japan 275,124 (many small domestic ports), Indonesia 75,489, the US 70,666, South Korea 60,201, the Netherlands 54,704 and Singapore 51,811; Taiwan 24,071. Singapore is the busiest port with 46,210 calls, then Shanghai 43,566, Rotterdam 30,164, Antwerp 21,218, Ningbo 20,921 and Busan 19,466. Of Taiwan’s 10 ports, Kaohsiung had 11,372, Taichung 4,998, Keelung 3,371, Taipei 2,205 and Mailiao 1,143; Kaohsiung handles 48.22% of the country’s seaborne imports, Taichung 23.6%, Mailiao 10.88% and Keelung 6.76% (PortWatch ports database). UNCTAD’s port call statistics cover only about 70 countries and not Taiwan, which is why they were left out before; PortWatch solves both problems. ${PORTWATCH_NOTE.en}`,
      },
      unit: { zh: '艘次', en: 'port calls' },
      file: 'port-calls.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 艘次`, en: formatLargeNumber(v) }),
      formatTick: formatLargeTick,
      integer: true,
      defaultYear: 2025,
    },
    {
      id: 'port-cargo',
      label: { zh: '港口的進出口貨量', en: 'Seaborne cargo through ports' },
      description: {
        zh: `一年裡這國各港口進口加出口的貨物（百萬公噸，IMF PortWatch 用 AIS 推算，2019 年起）。2025 年中國 6,649.5 百萬公噸最多，美國 1,590.1、澳洲 1,541.1、巴西 1,163.9、日本 914.0、新加坡 900.2、印尼 685.7、印度 682.0、南韓 609.1；台灣 310.0。${PORTWATCH_NOTE.zh}`,
        en: `Imports plus exports through the country’s ports in a year (million tonnes, estimated from AIS by IMF PortWatch, from 2019). In 2025 China had the most, 6,649.5 million tonnes, then the US 1,590.1, Australia 1,541.1, Brazil 1,163.9, Japan 914.0, Singapore 900.2, Indonesia 685.7, India 682.0 and South Korea 609.1; Taiwan 310.0. ${PORTWATCH_NOTE.en}`,
      },
      unit: { zh: '百萬公噸', en: 'million tonnes' },
      file: 'port-cargo.json',
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${fixed(v, 1)} 百萬公噸`, en: `${fixed(v, 1)} million t` }),
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2025,
    },
  ],
};

export const portCargoTypesPart: TopicPart = {
  name: { zh: '港口的貨型', en: 'Cargo types at ports' },
  sources: [
    {
      name: { zh: 'Eurostat：主要港口的海運貨物依貨型（mar_mg_am_cwhc）', en: 'Eurostat: seaborne goods in main ports by type of cargo (mar_mg_am_cwhc)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/mar_mg_am_cwhc/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '臺灣港務公司「國際商港貨物裝卸量」（政府資料開放平臺 8367）', en: 'Taiwan International Ports Corporation, cargo handled at international commercial ports (data.gov.tw 8367)' },
      url: 'https://data.gov.tw/dataset/8367',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  panelExtra: () => import('./panels/PortActivityPanel'),
  indicators: [
    {
      id: 'port-cargo-type',
      // 卡片與圖例的標題是子項目接指標名稱：「液體散貨占港口貨量的比例」
      label: { zh: '占港口貨量的比例', en: 'share of port cargo' },
      description: {
        zh: '主要港口裝卸的貨物（公噸）裡這一種貨型占幾 %（Eurostat，1997–2024 年，只有歐洲；英國照網站的規則不畫）。歐盟 27 國 2024 年共 3,320,783 千公噸：液體散貨 1,233,906（37.2%）、貨櫃 816,833（24.6%）、乾散貨 679,514（20.5%）、自走滾裝 234,267、非自走滾裝 169,830、其他 165,595。液體散貨（原油、油品、液化氣）的比例法國 49.5%、克羅埃西亞 48.5%、挪威 47.6%、荷蘭 47.3%、波蘭 44.6% 最高。貨櫃是貨櫃裡的貨重，不是 TEU，不跟貨櫃吞吐量混用。台灣的港務公司只分貨櫃貨、散雜貨、管道貨三類，對不起來，列在側欄。',
        en: 'Share of this cargo type in the tonnage handled by main ports (Eurostat, 1997–2024, Europe only; the UK is not shown by the site’s rule). The EU-27 handled 3,320,783 thousand tonnes in 2024: liquid bulk 1,233,906 (37.2%), containers 816,833 (24.6%), dry bulk 679,514 (20.5%), self-propelled Ro-Ro 234,267, other Ro-Ro 169,830 and other cargo 165,595. Liquid bulk (crude oil, oil products, liquefied gas) is highest in France (49.5%), Croatia (48.5%), Norway (47.6%), the Netherlands (47.3%) and Poland (44.6%). Containers here are the weight of goods in containers, not TEU, so do not mix them with container throughput. Taiwan’s port statistics use only three classes (containers, bulk and general, pipeline cargo), which do not match, so they are in the side panel.',
      },
      unit: '%',
      file: 'port-cargo-type/{item}.json',
      dimension: { label: { zh: '貨型', en: 'Cargo type' }, options: CARGO_TYPES, defaultOption: 'liquid-bulk' },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 40, 50] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2024,
    },
  ],
};
