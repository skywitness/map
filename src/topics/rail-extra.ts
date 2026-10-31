import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 交通的擴充（2026-10-31，製作手冊第十批 176；pipeline/topics/rail_extra.py，資料在 transport 的資料夾）：
 * 高鐵路網與最高時速放「高鐵」，地鐵系統、磁浮與單軌放「地鐵與城市軌道」，跨國鐵路、鐵路與公路的貨運量放「鐵路」。
 */

const kmText = (v: number) => tr({ zh: `${fixed(v, v < 100 ? 1 : 0)} 公里`, en: `${fixed(v, v < 100 ? 1 : 0)} km` });
const tkm = (v: number) => tr({ zh: `${formatLargeNumber(v)} 百萬延噸公里`, en: `${formatLargeNumber(v)} million tonne-km` });
const WIKI = (title: string, rev: number) => `https://en.wikipedia.org/w/index.php?title=${title}&oldid=${rev}`;

// ── 高鐵 ──────────────────────────────────────────────────────

const SPEEDS: CategoryDef[] = [
  { value: 200, max: 249, label: { zh: '200–249 km/h', en: '200–249 km/h' } },
  { value: 250, max: 299, label: { zh: '250–299 km/h', en: '250–299 km/h' } },
  { value: 300, max: 319, label: { zh: '300–319 km/h', en: '300–319 km/h' } },
  { value: 320, max: 400, label: { zh: '320 km/h 以上', en: '320 km/h or more' } },
];

/** 左邊的清單（使用者決定：各國高鐵依最高時速）：點了移到首都 */
const HSR_LIST: ListPanelDef = {
  label: { zh: '各國高鐵', en: 'High-speed rail by country' },
  indicators: ['hsr-speed', 'hsr-length'],
  file: 'hsr-list.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (b.v as number) - (a.v as number) || (b.km as number) - (a.km as number))
      .map(
        (p): ListRow => ({
          key: String(p.iso3),
          title: countryName(String(p.iso3)),
          lines: [
            tr({ zh: `最高時速 ${p.v} km/h · ${kmText(p.km as number)}`, en: `Top speed ${p.v} km/h · ${kmText(p.km as number)}` }),
            typeof p.y === 'number' ? tr({ zh: `${p.y} 年通車`, en: `Opened ${p.y}` }) : '',
          ].filter(Boolean),
          target: { lon: p.lon as number, lat: p.lat as number, zoom: 4 },
        }),
      ),
};

export const hsrExtra: { sources: SourceDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: {
        zh: '英文維基百科「List of high-speed railway lines」的各國總表（revid 1382444993；表寫依 UIC 的數字）',
        en: 'English Wikipedia, “List of high-speed railway lines”, table of operational networks (revision 1382444993; based on UIC figures)',
      },
      url: WIKI('List_of_high-speed_railway_lines', 1382444993),
      license: 'CC BY-SA 4.0',
    },
  ],
  listPanel: HSR_LIST,
  indicators: [
    {
      id: 'hsr-length',
      label: { zh: '高鐵路網長度', en: 'High-speed network length' },
      description: {
        zh: '營運中的高速鐵路長度（英文維基的各國總表，30 個國家或地區），圓的面積與長度成正比。中國 50,400 公里遠多於其他國家，其次是西班牙 3,973、法國 3,516、日本 3,067、德國 2,683；台灣 351 公里（2007 年通車）。各國的定義不同：瑞典 1,711 公里多是時速 200 公里的升級線，中國的長度是官方約數。',
        en: 'Length of high-speed lines in operation (English Wikipedia’s table of 30 countries or territories); circle area is proportional to length. China’s 50,400 km dwarfs the rest, followed by Spain (3,973), France (3,516), Japan (3,067) and Germany (2,683); Taiwan has 351 km (opened 2007). Definitions differ: Sweden’s 1,711 km are mostly upgraded 200 km/h lines, and China’s figure is an official round number.',
      },
      unit: { zh: '公里', en: 'km' },
      file: 'hsr-length.json',
      layer: { kind: 'bubble', legendValues: [500, 3000, 50000] },
      timeless: true,
      format: kmText,
      formatTick: formatLargeTick,
      missing: { zh: '沒有高鐵（總表沒有）', en: 'No high-speed rail (not in the table)' },
    },
    {
      id: 'hsr-speed',
      label: { zh: '高鐵的最高營運時速', en: 'High-speed rail top speed' },
      description: {
        zh: '各國高鐵的最高營運時速（總表的 Top speed 欄）。中國、印尼 350 km/h 最快，法國、日本、摩洛哥 320，南韓 305，西班牙、德國、英國、義大利、台灣等 300；瑞典、波蘭等 200 km/h 左右的多是升級線。左邊的清單依時速排。',
        en: 'Each country’s top operating speed on high-speed lines (the table’s top-speed column). China and Indonesia are fastest at 350 km/h, followed by France, Japan and Morocco (320), South Korea (305), and Spain, Germany, the UK, Italy, Taiwan and others (300); Sweden, Poland and others at around 200 km/h mostly run upgraded lines. The list on the left is sorted by speed.',
      },
      unit: 'km/h',
      file: 'hsr-speed.json',
      layer: { kind: 'categorical', categories: SPEEDS, ordinal: true },
      timeless: true,
      format: (v) => `${fixed(v, 0)} km/h`,
      missing: { zh: '沒有高鐵（總表沒有）', en: 'No high-speed rail (not in the table)' },
    },
  ],
};

// ── 地鐵系統、磁浮與單軌 ───────────────────────────────────────

const ridership = (v: number) => tr({ zh: `一年 ${fixed(v, v < 10 ? 1 : 0)} 百萬人次`, en: `${fixed(v, v < 10 ? 1 : 0)} million rides a year` });

function systemLines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  return [
    [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, String(p.city ?? '')].filter(Boolean).join(' · '),
    [
      typeof p.open === 'number' ? tr({ zh: `${p.open} 年通車`, en: `opened ${p.open}` }) : null,
      typeof p.km === 'number' ? kmText(p.km) : null,
      typeof p.st === 'number' ? tr({ zh: `${p.st} 站`, en: `${p.st} stations` }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    typeof p.rid === 'number' ? `${ridership(p.rid)}${typeof p.ry === 'number' ? tr({ zh: `（${p.ry}）`, en: ` (${p.ry})` }) : ''}` : '',
  ].filter(Boolean);
}

const SYSTEMS: PointsOverlayDef = {
  kind: 'points',
  id: 'metro-systems',
  file: 'metro-systems.json',
  label: { zh: '地鐵系統（大小是一年的運量）', en: 'Metro systems (size by annual ridership)' },
  indicators: ['metro-length', 'metro-ridership'],
  radius: { field: 'rid', stops: [[10, 2.5], [300, 6], [1500, 11], [3800, 16]] },
  color: MAP_TOKENS.hues.violet,
  sortField: 'rid',
  sizeLegend: { title: { zh: '一年的運量', en: 'Annual ridership' }, values: [100, 1000, 3000], format: (v) => tr({ zh: `${fixed(v, 0)} 百萬人次`, en: `${fixed(v, 0)} million` }) },
  tooltip: (p, ctx) => ({ title: String(p.name ?? ''), detail: systemLines(p, ctx.countryName)[0], extra: systemLines(p, ctx.countryName).slice(1), properNoun: String(p.name ?? '') }),
};

const MONORAIL_KIND: CategoryDef[] = [
  { value: 0, label: { zh: '單軌', en: 'Monorail' } },
  { value: 1, label: { zh: '磁浮', en: 'Maglev' } },
];

const MONORAILS: PointsOverlayDef = {
  kind: 'points',
  id: 'monorails',
  file: 'monorails.json',
  label: { zh: '磁浮與單軌（依通車年份）', en: 'Maglev and monorail (by opening year)' },
  indicators: ['monorails'],
  radius: 5,
  color: {
    field: 'mg',
    title: { zh: '種類', en: 'Type' },
    thresholds: [0.5],
    classes: [
      { color: MAP_TOKENS.hues.aqua, label: MONORAIL_KIND[0].label },
      { color: MAP_TOKENS.hues.orange, label: MONORAIL_KIND[1].label },
    ],
  },
  timeField: 'y',
  tooltip: (p, ctx) => ({
    title: String(p.name ?? ''),
    detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, String(p.city ?? '')].filter(Boolean).join(' · '),
    extra: [
      [p.mg === 1 ? tr({ zh: '磁浮', en: 'Maglev' }) : tr({ zh: '單軌', en: 'Monorail' }), tr({ zh: `${p.y} 年通車`, en: `opened ${p.y}` }),
        typeof p.km === 'number' ? kmText(p.km) : null].filter(Boolean).join(' · '),
    ],
    properNoun: String(p.name ?? ''),
  }),
};

/** 左邊的清單（使用者決定：各地鐵系統依一年的運量） */
const METRO_LIST: ListPanelDef = {
  label: { zh: '地鐵系統', en: 'Metro systems' },
  indicators: ['metro-length', 'metro-ridership'],
  file: 'metro-systems.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => ((b.rid as number) ?? -1) - ((a.rid as number) ?? -1))
      .map((p, i): ListRow => ({
        key: `${p.name}-${i}`,
        title: String(p.name ?? ''),
        titleProper: true,
        lines: systemLines(p, countryName),
        target: { lon: p.lon as number, lat: p.lat as number, zoom: 10 },
      })),
};

export const metroExtra: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: { zh: '英文維基百科「List of metro systems」（revid 1382778845）', en: 'English Wikipedia, “List of metro systems” (revision 1382778845)' },
      url: WIKI('List_of_metro_systems', 1382778845),
      license: 'CC BY-SA 4.0',
    },
    {
      name: {
        zh: '英文維基百科「List of monorail systems」（revid 1381856722）、「Maglev」（revid 1380628600）',
        en: 'English Wikipedia, “List of monorail systems” (revision 1381856722) and “Maglev” (revision 1380628600)',
      },
      url: WIKI('List_of_monorail_systems', 1381856722),
      license: 'CC BY-SA 4.0',
    },
  ],
  overlays: [SYSTEMS, MONORAILS],
  listPanel: METRO_LIST,
  indicators: [
    {
      id: 'metro-length',
      label: { zh: '地鐵路網長度', en: 'Metro network length' },
      description: {
        zh: '英文維基地鐵系統清單的各國系統長度合計（約 200 個系統），點是各個系統、大小是一年的運量。中國最長，北京 909 公里；台灣 5 個系統約 284 公里（台北捷運 154.3 公里、120 站）。各國對「地鐵」的定義不同，清單另列輕軌、通勤鐵路的不算。',
        en: 'Total length of each country’s metro systems in English Wikipedia’s list (about 200 systems); points are systems, sized by annual ridership. China has the most, with Beijing at 909 km; Taiwan’s 5 systems total about 284 km (Taipei Metro 154.3 km with 120 stations). Definitions of “metro” differ; light metro and commuter rail listed separately are excluded.',
      },
      unit: { zh: '公里', en: 'km' },
      file: 'metro-length.json',
      layer: { kind: 'bubble', legendValues: [50, 500, 5000] },
      timeless: true,
      format: kmText,
      formatTick: formatLargeTick,
      missing: { zh: '清單裡沒有地鐵', en: 'No metro in the list' },
    },
    {
      id: 'metro-ridership',
      label: { zh: '地鐵一年的運量', en: 'Metro ridership' },
      description: {
        zh: '各國地鐵系統一年運量的合計（百萬人次，各系統最新的一年，多半是 2024 或 2025 年）。最繁忙的系統是上海（37.7 億）、北京（36.2 億）、廣州（32.6 億）；台北捷運 2025 年 7.67 億人次。運量的算法（進站、含不含轉乘）各系統不同。左邊的清單依運量排。',
        en: 'Total annual ridership of each country’s metro systems (millions; each system’s latest year, mostly 2024 or 2025). The busiest systems are Shanghai (3.77 billion), Beijing (3.62 billion) and Guangzhou (3.26 billion); Taipei Metro carried 767 million in 2025. Counting methods (entries, transfers) differ between systems. The list on the left is sorted by ridership.',
      },
      unit: { zh: '百萬人次', en: 'million rides' },
      file: 'metro-ridership.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      timeless: true,
      format: (v) => tr({ zh: `${formatLargeNumber(v * 1e6)} 人次`, en: `${formatLargeNumber(v * 1e6)} rides` }),
      formatTick: (v) => formatLargeTick(v * 1e6),
      missing: { zh: '清單裡沒有地鐵的運量', en: 'No metro ridership in the list' },
    },
    {
      id: 'monorails',
      label: { zh: '磁浮與單軌', en: 'Maglev and monorail' },
      description: {
        zh: '交通用的單軌鐵路與磁浮（不收遊樂園、動物園的），依通車年份出現。營運中的磁浮有 6 條，都在中國與日本：上海磁浮（2003，時速 300 公里）、日本愛知的 Linimo（2005）、長沙（2016）、北京 S1 線（2017）、鳳凰（2022）、清遠（2025）；仁川機場磁浮 2022 年停駛、2025 年改當觀光設施，不算。重慶 3 號線是最長、最繁忙的單軌。台灣沒有營運中的磁浮或單軌。國家的值同地鐵路網長度。',
        en: 'Transit monorails and maglev lines (not those in amusement parks or zoos), appearing in the year they opened. Six maglev lines are in service, all in China and Japan: Shanghai (2003, 300 km/h), Linimo in Aichi (2005), Changsha (2016), Beijing Line S1 (2017), Fenghuang (2022) and Qingyuan (2025); Incheon Airport’s maglev closed in 2022 and reopened in 2025 as a tourist attraction, so it is excluded. Chongqing Line 3 is the longest and busiest monorail. Taiwan has none in service. Country values are metro network length.',
      },
      unit: { zh: '公里', en: 'km' },
      file: 'metro-length.json',
      layer: { kind: 'none' },
      overlayTime: 'cumulative',
      format: kmText,
    },
  ],
};

// ── 跨國鐵路、貨運量（鐵路主題） ───────────────────────────────

const countries = (v: number) => tr({ zh: `${fixed(v, 0)} 國`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'country' : 'countries'}` });

export const transportExtra: { sources: SourceDef[]; indicators: IndicatorDef[] } = {
  sources: [
    {
      name: { zh: 'World Bank, World Development Indicators（UIC、OECD 的鐵路貨運量）', en: 'World Bank, World Development Indicators (rail freight from UIC and OECD)' },
      url: 'https://data.worldbank.org/indicator/IS.RRS.GOOD.MT.K6',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'ITF（OECD 國際運輸論壇）：Annual freight transport', en: 'ITF (OECD International Transport Forum), Annual freight transport' },
      url: 'https://data-explorer.oecd.org/',
      license: { zh: 'OECD 資料條款（可轉載、改作，需註明出處）', en: 'OECD Terms and Conditions (reuse with attribution)' },
    },
  ],
  indicators: [
    {
      id: 'rail-neighbours',
      label: { zh: '鐵路相連的鄰國', en: 'Rail-linked neighbours' },
      description: {
        zh: '跟幾個鄰國有鐵路相連（依 Natural Earth 2017 年的鐵路線，線經過國界就算，包括停駛或軌距不同要換軌的；再人工補上中老鐵路〔2021〕、巴庫–第比利斯–卡爾斯〔2017〕、阿富汗與烏茲別克、土庫曼、伊朗的鐵路等新線）。俄羅斯 12 國最多，德國 10、法國、奧地利、塞爾維亞各 8；英國經英法海底隧道接法國、經北愛爾蘭接愛爾蘭。滑過看是哪些國家。台灣是島國，沒有。跨國客運列車沒有做。',
        en: 'How many neighbouring countries a country is linked to by rail (Natural Earth railways as of 2017, counted wherever a line crosses a border, including disused lines and gauge breaks; new links added by hand: China–Laos in 2021, Baku–Tbilisi–Kars in 2017, and Afghanistan’s lines to Uzbekistan, Turkmenistan and Iran). Russia has the most (12), then Germany (10) and France, Austria and Serbia (8 each); Britain connects to France through the Channel Tunnel and to Ireland via Northern Ireland. Hover to see which. Taiwan, an island, has none. Cross-border passenger services are not shown.',
      },
      unit: { zh: '國', en: 'countries' },
      file: 'rail-neighbours.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 3, 5, 8] } },
      integer: true,
      timeless: true,
      format: countries,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'rail-freight',
      label: { zh: '鐵路貨運量', en: 'Rail freight' },
      description: {
        zh: '一年的鐵路貨運量（百萬延噸公里，世界銀行 WDI，1995–2021，各國最新的一年），圓的面積與它成正比。中國 301.8 萬（2019）、俄羅斯 263.9 萬、美國 223.9 萬、印度 72.0 萬（2021）；國土大的國家本來就高。台灣沒有，附註寫臺鐵的貨運量。',
        en: 'Rail freight carried in a year (million tonne-km; World Bank WDI, 1995–2021, each country’s latest year); circle area is proportional to it. China 3.02 million (2019), Russia 2.64 million, the US 2.24 million and India 720,000 (2021); large countries naturally rank high. Taiwan is not included; its note gives Taiwan Railway’s freight figures.',
      },
      unit: { zh: '百萬延噸公里', en: 'million tonne-km' },
      file: 'rail-freight.json',
      layer: { kind: 'bubble', legendValues: [1000, 100000, 1000000] },
      format: tkm,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'road-freight',
      label: { zh: '公路貨運量', en: 'Road freight' },
      description: {
        zh: '一年的公路貨運量（百萬延噸公里，ITF，2015 年起，約 50 國，多是 OECD 與歐洲國家）。中國 739.5 萬（2023）、美國 340.3 萬（2022）、印度 243.6 萬（2017）。世界銀行的公路貨運量是國際道路聯盟（IRF）的資料，條款不准轉載，所以改用 ITF。台灣沒有。',
        en: 'Road freight carried in a year (million tonne-km; ITF, from 2015, about 50 countries, mostly OECD and European). China 7.40 million (2023), the US 3.40 million (2022), India 2.44 million (2017). The World Bank’s road freight series comes from the International Road Federation, whose terms forbid redistribution, so ITF data are used instead. Taiwan is not included.',
      },
      unit: { zh: '百萬延噸公里', en: 'million tonne-km' },
      file: 'road-freight.json',
      layer: { kind: 'bubble', legendValues: [10000, 100000, 1000000] },
      format: tkm,
      formatTick: formatLargeTick,
    },
    {
      id: 'rail-freight-share',
      label: { zh: '鐵路占陸路貨運的比例', en: 'Rail share of land freight' },
      description: {
        zh: '鐵路貨運量 ÷（鐵路＋公路），都用 ITF 的延噸公里（同一年，約 48 國）。國土大、運煤礦的澳洲、加拿大約六成，奧地利五成、瑞士與美國約四成、德國三成，法國 17%、英國 9%、日本 7%。',
        en: 'Rail freight ÷ (rail + road), both in ITF tonne-km for the same year (about 48 countries). Large countries hauling coal and ore, such as Australia and Canada, move about 60% by rail; Austria about half, Switzerland and the US about 40% and Germany 32%, against France’s 17%, the UK’s 9% and Japan’s 7%.',
      },
      unit: '%',
      file: 'rail-freight-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 40, 60, 80] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
    },
  ],
};
