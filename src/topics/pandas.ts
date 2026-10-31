import { getLang, tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 熊貓外交（pipeline/topics/pandas.py、sources/panda_diplomacy.py）：中國贈送或租借大熊貓到各國動物園的每一次，
 * 依開始的年份累積出現。手工整理自英文維基百科三個條目的固定版本（CC BY-SA 4.0，資料檔也用 CC BY-SA 4.0）。
 * 台灣那一筆只寫事實，不寫政治定性（使用者 2026-10-29 決定）。
 */

/** 種類（pipeline 的 GIFT_ROC、GIFT、SHORT、LOAN、TAIWAN）：類別色依序取前 5 色 */
const KINDS = [
  { value: 1, label: { zh: '中華民國贈送（1941）', en: 'Gift from the Republic of China (1941)' } },
  { value: 2, label: { zh: '贈送（1957–1983）', en: 'Gift (1957–1983)' } },
  { value: 3, label: { zh: '短期出借（1984–1988）', en: 'Short-term loan (1984–1988)' } },
  { value: 4, label: { zh: '長期租借（1984 年以後）', en: 'Long-term loan (from 1984)' } },
  { value: 5, label: { zh: '台灣', en: 'Taiwan' } },
];
const KIND_COLORS: ColorClasses = {
  field: 'k',
  title: { zh: '種類', en: 'Type' },
  thresholds: [2, 3, 4, 5],
  classes: KINDS.map((k, i) => ({ color: MAP_TOKENS.categorical[i], label: k.label })),
};
const kindLabel = (k: unknown) => tr(KINDS.find((x) => x.value === k)?.label ?? '');

/** 動物園的名稱：中文介面用 Wikidata 的中文名稱；條目沒寫是哪個動物園的寫國家 */
function zooName(p: PointRecord, countryName: (iso3: string) => string): string {
  const country = countryName(String(p.iso3 ?? ''));
  if (typeof p.zoo !== 'string') return tr({ zh: `${country}（條目沒寫哪個動物園）`, en: `${country} (zoo not named)` });
  return getLang() === 'zh' && typeof p.zooZh === 'string' ? p.zooZh : p.zoo;
}

export function placementText(p: PointRecord): string {
  const start = Number(p.a);
  const end = typeof p.e === 'number' ? p.e : null;
  const span = end === null ? tr({ zh: `${start} 年起`, en: `from ${start}` }) : end === start ? String(start) : `${start}–${end}`;
  return `${kindLabel(p.k)} · ${span}`;
}

function zooTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const note = getLang() === 'zh' ? p.zh : p.en;
  const title = zooName(p, ctx.countryName);
  return {
    title,
    detail: placementText(p),
    extra: [typeof p.names === 'string' ? p.names : null, typeof note === 'string' ? note : null].filter((x): x is string => Boolean(x)),
    properNoun: getLang() === 'zh' && typeof p.zoo === 'string' && title !== p.zoo ? p.zoo : undefined,
  };
}

/**
 * 那一年在國外的大熊貓（第十二批 203）：時間軸那一年在國外動物園的（開始年份 ≤ 那一年、還沒結束或那一年才結束），
 * 依國家分組（國名依語言排），組內依開始年份；每列：動物園、熊貓的名字、贈送或租借與期間。點了移到動物園
 */
const ABROAD_LIST: ListPanelDef = {
  label: { zh: '那一年在國外的大熊貓', en: 'Pandas abroad that year' },
  file: 'zoos.json',
  countryField: 'iso3',
  empty: { zh: '這一年國外沒有大熊貓', en: 'No pandas abroad this year' },
  rows: (points, { countryName, year }) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    const country = (p: PointRecord) => countryName(String(p.iso3 ?? ''));
    return points
      .filter((p) => Number(p.a) <= year && (typeof p.e !== 'number' || p.e >= year))
      .sort((a, b) => collator.compare(country(a), country(b)) || Number(a.a) - Number(b.a))
      .map((p, i): ListRow => {
        const title = zooName(p, countryName);
        // 贈送、短期出借沒寫結束年份的：條目沒寫熊貓什麼時候死亡或送回，不一定還在，淡一點並註明
        const unknownEnd = typeof p.e !== 'number' && Number(p.k) !== 4 && Number(p.k) !== 5;
        return {
          key: `${p.zoo ?? p.iso3}-${p.a}-${i}`,
          title,
          properNoun: getLang() === 'zh' && typeof p.zoo === 'string' && title !== p.zoo ? p.zoo : undefined,
          lines: [
            typeof p.names === 'string' ? p.names : null,
            placementText(p) + (unknownEnd ? tr({ zh: '（條目沒寫結束的年份）', en: ' (end year not given)' }) : ''),
          ].filter((x): x is string => Boolean(x)),
          muted: unknownEnd,
          group: country(p),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 12 },
        };
      });
  },
};

const times = (v: number) => tr({ zh: `${fixed(v, 0)} 次`, en: `${fixed(v, 0)} ${v === 1 ? 'time' : 'times'}` });

export const pandas: TopicDefinition = {
  id: 'pandas',
  title: { zh: '熊貓外交', en: 'Panda diplomacy' },
  shortTitle: { zh: '熊貓外交', en: 'Panda diplomacy' },
  defaultIndicator: 'received',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「Panda diplomacy」「List of giant pandas」「Tuan Tuan and Yuan Yuan」（2026 年 10 月的版本，手工整理成表）',
        en: 'Wikipedia: “Panda diplomacy”, “List of giant pandas” and “Tuan Tuan and Yuan Yuan” (October 2026 revisions, compiled by hand)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Panda_diplomacy&oldid=1379504972',
      license: { zh: 'CC BY-SA 4.0（這個主題的資料檔同樣用 CC BY-SA 4.0 分享）', en: 'CC BY-SA 4.0 (this topic’s data files are shared under CC BY-SA 4.0 too)' },
    },
    { name: { zh: 'Wikidata（動物園的位置與中文名稱）', en: 'Wikidata (zoo locations and Chinese names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
  ],
  note: {
    zh:
      '每一個點是一次到某個動物園（同一個動物園先贈送、後來又租借的算兩次），依開始的年份累積出現，結束的（死亡、送回）照樣留在地圖上，tooltip 寫年份。弧線從成都畫出（大熊貓的家鄉，1941 年那一次從重慶交接），只表示來自中國，不是實際的路線。' +
      '1984 年以前是贈送；之後改成租借，起初是幾個月的短期展出，1988 年起改成通常 10 年一約的長期租借，名義是合作研究，在租借國出生的幼仔也屬於中國。' +
      '條目沒寫開始年份、只知道某一年已經在的（例如那一年在那裡出生了幼仔），用那一年並寫「最晚」；條目沒有任何年份的（孟菲斯、神戶王子動物園、卡達）不收；香港、澳門是中國境內，不收。',
    en:
      'Each dot is one placement at a zoo (a zoo that received a gift and later a loan counts twice), appearing in its starting year and staying on the map after it ended (by death or return), with the years in the tooltip. Arcs are drawn from Chengdu, the pandas’ home region (the 1941 handover was in Chongqing), only to show they came from China, not the actual route. ' +
      'Pandas were gifts until 1984; then China lent them, first for exhibitions of a few months and from 1988 under long-term agreements of usually 10 years described as research cooperation, with cubs born abroad also belonging to China. ' +
      'Where the articles give no start year but show a panda was there by a certain year (such as a cub born there), that year is used and marked “by … at the latest”; placements with no year at all (Memphis, Kobe Oji Zoo, Qatar) are left out, as are Hong Kong and Macau, which are part of China.',
  },
  panelExtra: () => import('./panels/PandasPanel'),
  listPanel: ABROAD_LIST,
  overlays: [
    {
      kind: 'lines',
      id: 'arcs',
      file: 'arcs.json',
      label: { zh: '從中國出發的弧線', en: 'Arcs from China' },
      width: 1,
      opacity: 0.6,
      color: { classes: KINDS.map((k, i) => ({ value: k.value, color: MAP_TOKENS.categorical[i], label: k.label })) },
      keyClasses: false,
      timeField: 'a',
    },
    {
      kind: 'points',
      id: 'zoos',
      file: 'zoos.json',
      label: { zh: '動物園', en: 'Zoos' },
      radius: 4,
      color: KIND_COLORS,
      timeField: 'a',
      tooltip: zooTooltip,
    },
  ],
  indicators: [
    {
      id: 'received',
      label: { zh: '收到大熊貓的次數', en: 'Times pandas were received' },
      description: {
        zh: '到這一年為止，這個國家的動物園收到中國大熊貓的次數（贈送與租借都算）。拖動時間軸，從 1941 年中華民國送給美國的那一對看起：1957–1983 年毛澤東時代送給 9 國，1984 年起改成租借，美國 13 次最多。點是每一次的動物園，滑過看熊貓的名字與年份；左邊的清單依國家列出那一年在國外的大熊貓。',
        en: 'How many times a country’s zoos had received giant pandas from China by the selected year (gifts and loans). Drag the timeline from the pair the Republic of China gave the US in 1941: nine countries received gifts between 1957 and 1983, loans replaced gifts from 1984, and the US leads with 13. Dots mark each placement; hover for the pandas and years. The list on the left shows, by country, the pandas abroad in the selected year.',
      },
      unit: { zh: '次', en: 'times' },
      file: 'received.json',
      layer: { kind: 'bubble', legendValues: [1, 3, 10] },
      overlayTime: 'cumulative',
      format: times,
      formatTick: (v) => fixed(v, 0),
      integer: true,
    },
  ],
};
