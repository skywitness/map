import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 移民與難民的擴充：移民路上的死亡與失蹤（2026-11-03，製作手冊第十七批 276；pipeline/topics/missing_migrants.py）。
 * IOM Missing Migrants Project 2014 年起的每一起事件，一年一個點檔（missing-migrants/{year}.json），地圖與左側欄只讀時間軸那一年；
 * 點的顏色是死因、大小是死亡與失蹤的人數。國家的值是那一年發生在國內或外海的人數（IOM 的 Country of Incident）。
 * 台灣附近的 2 起 IOM 寫 China，使用者決定依座標改歸台灣（fix = 1，tooltip 與附註寫明）。
 */

/** 死因（pipeline 的 CAUSES 順序，最後一個是多種或不明） */
const CAUSES: Text[] = [
  { zh: '溺水', en: 'Drowning' },
  { zh: '交通事故、危險的交通工具', en: 'Vehicle accident or hazardous transport' },
  { zh: '惡劣環境（缺乏遮蔽、食物、水）', en: 'Harsh conditions (no shelter, food or water)' },
  { zh: '生病、得不到醫療', en: 'Sickness or no access to healthcare' },
  { zh: '暴力', en: 'Violence' },
  { zh: '意外', en: 'Accidental death' },
  { zh: '多種或不明', en: 'Mixed or unknown' },
];

/** 路線（pipeline 的 ROUTES 順序；0 是 IOM 沒有歸到任何路線） */
const ROUTES: Text[] = [
  { zh: '沒有歸到路線', en: 'No route assigned' },
  { zh: '地中海中線', en: 'Central Mediterranean' },
  { zh: '地中海西線', en: 'Western Mediterranean' },
  { zh: '地中海東線', en: 'Eastern Mediterranean' },
  { zh: '西非到加那利群島的大西洋路線', en: 'Western Africa / Atlantic route to the Canary Islands' },
  { zh: '穿越撒哈拉沙漠', en: 'Sahara Desert crossing' },
  { zh: '美墨邊境', en: 'US–Mexico border crossing' },
  { zh: '達連隘口', en: 'Darién' },
  { zh: '加勒比海到美國', en: 'Caribbean to US' },
  { zh: '多明尼加到波多黎各', en: 'Dominican Republic to Puerto Rico' },
  { zh: '海地到多明尼加', en: 'Haiti to Dominican Republic' },
  { zh: '委內瑞拉到加勒比海', en: 'Venezuela to Caribbean' },
  { zh: '加勒比海到中美洲', en: 'Caribbean to Central America' },
  { zh: '阿富汗到伊朗', en: 'Afghanistan to Iran' },
  { zh: '伊朗到土耳其', en: 'Iran to Türkiye' },
  { zh: '敘利亞到土耳其', en: 'Syria to Türkiye' },
  { zh: '土耳其到歐洲的陸路', en: 'Türkiye–Europe land route' },
  { zh: '西巴爾幹', en: 'Western Balkans' },
  { zh: '白俄羅斯與歐盟的邊界', en: 'Belarus–EU border' },
  { zh: '歐洲大陸到英國', en: 'Mainland Europe to the UK' },
  { zh: '義大利到法國', en: 'Italy to France' },
  { zh: '烏克蘭到歐洲', en: 'Ukraine to Europe' },
  { zh: '東線（往返東非與非洲之角）', en: 'Eastern Route to/from the East and Horn of Africa' },
  { zh: '從東非與非洲之角往北', en: 'Northern Route from the East and Horn of Africa' },
  { zh: '非洲之角路線', en: 'Horn of Africa Route' },
  { zh: '往南部非洲', en: 'Route to Southern Africa' },
  { zh: '剛果民主共和國到烏干達', en: 'DRC to Uganda' },
  { zh: '渡海到馬約特', en: 'Sea crossings to Mayotte' },
  { zh: '孟加拉灣、安達曼海', en: 'Bay of Bengal / Andaman Sea' },
  { zh: '渡過納夫河', en: 'Naf River crossing' },
];

const label = (list: Text[], v: unknown) => (typeof v === 'number' && list[v] ? tr(list[v]) : '');

const CAUSE_COLORS: ColorClasses = {
  field: 'c',
  title: { zh: '死因', en: 'Cause of death' },
  thresholds: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5],
  classes: [
    { color: MAP_TOKENS.categorical[1], label: CAUSES[0] },
    { color: MAP_TOKENS.categorical[2], label: CAUSES[1] },
    { color: MAP_TOKENS.categorical[5], label: CAUSES[2] },
    { color: MAP_TOKENS.categorical[0], label: CAUSES[3] },
    { color: MAP_TOKENS.categorical[7], label: CAUSES[4] },
    { color: MAP_TOKENS.categorical[3], label: CAUSES[5] },
    { color: MAP_TOKENS.context, label: CAUSES[6] },
  ],
};

const people = (v: number) => tr({ zh: `${fixed(v, 0)} 人`, en: `${fixed(v, 0)} ${v === 1 ? 'person' : 'people'}` });
const tollText = (p: PointRecord) => tr({ zh: `${fixed(Number(p.n ?? 0), 0)} 人死亡或失蹤`, en: `${fixed(Number(p.n ?? 0), 0)} dead or missing` });

function dateText(p: PointRecord, year: number): string {
  const md = typeof p.md === 'number' ? p.md : 0;
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${year}-${pad(Math.floor(md / 100))}-${pad(md % 100)}`;
}

/** 第二行起：死亡與失蹤各幾人、倖存、原籍國、路線、改歸台灣 */
function facts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const parts = [
    typeof p.d === 'number' && p.d > 0 ? tr({ zh: `死亡 ${fixed(p.d, 0)}`, en: `${fixed(p.d, 0)} dead` }) : null,
    typeof p.m === 'number' && p.m > 0 ? tr({ zh: `失蹤 ${fixed(p.m, 0)}`, en: `${fixed(p.m, 0)} missing` }) : null,
    typeof p.s === 'number' && p.s > 0 ? tr({ zh: `倖存 ${fixed(p.s, 0)}`, en: `${fixed(p.s, 0)} survived` }) : null,
  ].filter(Boolean);
  const origin = typeof p.o === 'string' && p.o ? p.o.split(' ').map(countryName).join(tr({ zh: '、', en: ', ' })) : null;
  return [
    [label(CAUSES, p.c), ...parts].join(' · '),
    [p.r ? label(ROUTES, p.r) : null, origin ? tr({ zh: `來自${origin}`, en: `from ${origin}` }) : null].filter(Boolean).join(' · '),
    p.fix ? tr({ zh: 'IOM 寫中國，依座標改歸台灣', en: 'Listed under China by IOM; moved to Taiwan by its coordinates' }) : '',
  ].filter(Boolean);
}

const OVERLAY: PointsOverlayDef = {
  kind: 'points',
  id: 'missing-migrants',
  file: 'missing-migrants/{year}.json',
  label: { zh: '移民死亡與失蹤的事件（IOM）', en: 'Migrant deaths and disappearances (IOM)' },
  indicators: ['missing-migrants'],
  radius: { field: 'n', stops: [[1, 3], [10, 5], [100, 9], [1000, 15]] },
  color: CAUSE_COLORS,
  sortField: 'n',
  sizeLegend: { title: { zh: '死亡與失蹤', en: 'Dead and missing' }, values: [1, 10, 100, 1000], format: (v) => fixed(v, 0) },
  tooltip: (p, ctx) => ({
    title: `${tollText(p)} · ${dateText(p, ctx.year)}`,
    detail: [typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null, ...facts(p, ctx.countryName).slice(0, 1)].filter(Boolean).join(' · '),
    extra: [...facts(p, ctx.countryName).slice(1), ...(typeof p.src === 'string' ? [tr({ zh: `消息來源：${p.src}`, en: `Source: ${p.src}` })] : [])],
    properNoun: typeof p.pl === 'string' ? p.pl : undefined,
  }),
};

/** 左側欄：依日期（最新在上）、依人數、依路線分組 */
const BY_DATE = 300;
const BY_TOLL = 100;
const PER_ROUTE = 30;
const LIST: ListPanelDef = {
  label: { zh: '移民路上的死亡與失蹤', en: 'Migrant deaths and disappearances' },
  indicators: ['missing-migrants'],
  file: 'missing-migrants/{year}.json',
  countryField: 'iso3',
  sorts: [
    { id: 'date', label: { zh: '依日期', en: 'By date' } },
    { id: 'toll', label: { zh: '依人數', en: 'By number' } },
    { id: 'route', label: { zh: '依路線', en: 'By route' } },
  ],
  empty: { zh: '這一年沒有收錄的事件', en: 'No incidents recorded this year' },
  rows: (points, { countryName, year, sort, country }) => {
    const row = (p: PointRecord, i: number, group?: string): ListRow => ({
      key: `${p.md}-${p.lon}-${p.lat}-${i}`,
      title: [tollText(p), typeof p.iso3 === 'string' ? countryName(p.iso3) : null].filter(Boolean).join(' · '),
      properNoun: typeof p.pl === 'string' ? p.pl : undefined,
      lines: [dateText(p, year), ...facts(p, countryName)],
      target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 7 },
      ...(typeof p.url === 'string' ? { link: { href: p.url, label: typeof p.src === 'string' ? p.src : p.url } } : {}),
      ...(group ? { group } : {}),
    });
    const all = country ? Infinity : undefined;
    const byToll = [...points].sort((a, b) => Number(b.n ?? 0) - Number(a.n ?? 0) || Number(b.md) - Number(a.md));
    if (sort === 'toll') return byToll.slice(0, all ?? BY_TOLL).map((p, i) => row(p, i));
    if (sort === 'route') {
      // 路線依那一年的人數排，沒有路線的放最後
      const total = new Map<number, number>();
      for (const p of points) total.set(Number(p.r ?? 0), (total.get(Number(p.r ?? 0)) ?? 0) + Number(p.n ?? 0));
      const routes = [...total.keys()].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : (total.get(b) ?? 0) - (total.get(a) ?? 0)));
      return routes.flatMap((r) => {
        const n = people(total.get(r) ?? 0);
        const name = tr({ zh: `${label(ROUTES, r)}（${n}）`, en: `${label(ROUTES, r)} (${n})` });
        return byToll
          .filter((p) => Number(p.r ?? 0) === r)
          .slice(0, all ?? PER_ROUTE)
          .map((p, i) => row(p, i, name));
      });
    }
    return [...points]
      .sort((a, b) => Number(b.md) - Number(a.md) || Number(b.n ?? 0) - Number(a.n ?? 0))
      .slice(0, all ?? BY_DATE)
      .map((p, i) => row(p, i));
  },
};

export const missingMigrantsPart: TopicPart = {
  name: { zh: '移民路上的死亡與失蹤', en: 'Migrant deaths and disappearances' },
  sources: [
    {
      name: {
        zh: "國際移民組織（IOM）Missing Migrants Project（IOM's Missing Migrants Project；台灣附近的 2 起依座標改歸台灣）",
        en: "IOM's Missing Migrants Project (International Organization for Migration; the 2 incidents near Taiwan are moved to Taiwan by their coordinates)",
      },
      url: 'https://missingmigrants.iom.int/downloads',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh:
      'IOM 記錄的是移民（含難民與尋求庇護者）在前往另一個國家的路上死亡或失蹤的人，不管合不合法；在收容所、拘留所或抵達後才死亡的多半不算。數字是最低估計（很多死亡沒有人知道），位置多半是大概的；海上的事件 IOM 寫最近的國家，所以地中海中線多算在利比亞、突尼西亞。' +
      'IOM 沒有台灣的類別，台灣附近的事件寫中國（2018 年屏東到台東的海岸 3 人、2023 年台灣西部海域 14 人），這裡依座標改歸台灣。最近一年只到資料更新的那一天。沒有座標的 3 起不畫點，國家的人數照算。',
    en:
      'IOM records migrants (including refugees and asylum seekers) who die or go missing on the way to another country, whatever their legal status; deaths in shelters, detention or after arrival are mostly excluded. Figures are minimum estimates (many deaths are never known) and locations are mostly approximate; incidents at sea are assigned to the nearest country, so the Central Mediterranean counts mostly towards Libya and Tunisia. ' +
      'IOM has no category for Taiwan and lists incidents near it under China (3 people on the Pingtung–Taitung coast in 2018 and 14 at sea west of Taiwan in 2023); here they are moved to Taiwan by their coordinates. The latest year runs only up to the latest update. The 3 incidents without coordinates are not drawn but count towards their countries.',
  },
  overlays: [OVERLAY],
  indicators: [
    {
      id: 'missing-migrants',
      label: { zh: '移民路上的死亡與失蹤', en: 'Migrant deaths and disappearances' },
      description: {
        zh: '國際移民組織（IOM）Missing Migrants Project 2014 年起記錄的移民死亡與失蹤：點是每一起事件，顏色是死因、大小是死亡與失蹤的人數；國家的值是那一年發生在國內或外海的人數。地中海中線、穿越撒哈拉、阿富汗到伊朗、美墨邊境最多。左邊的清單可以依日期、人數或路線列出。',
        en: "Migrant deaths and disappearances recorded by IOM's Missing Migrants Project since 2014: each dot is an incident, coloured by cause of death and sized by the number dead or missing; a country's value is the number in its territory or off its coast in the selected year. The Central Mediterranean, the Sahara crossing, Afghanistan to Iran and the US–Mexico border have the most. The list on the left can be sorted by date, number or route.",
      },
      unit: { zh: '人', en: 'people' },
      file: 'missing-migrants.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 20, 50, 200, 500] } },
      defaultYear: 2025,
      format: people,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      shareOfWorld: true,
    },
  ],
  listPanel: [LIST],
};
