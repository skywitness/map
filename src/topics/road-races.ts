import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ListPanelDef, ListRow, PointRecord, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 馬拉松、超馬與鐵人賽事（2026-11-04，製作手冊第二十一批 362；pipeline/topics/road_races.py）：
 * Wikidata 上 P31 是全馬、半馬、超馬、鐵人三項賽的條目，某一屆的條目併回母賽事。使用者決定只做 Wikidata 有的，
 * 所以這張圖量的是「維基寫過哪些賽事」，不是各國實際辦了幾場。
 */

const KINDS: { label: Text; color: string }[] = [
  { label: { zh: '全程馬拉松', en: 'Marathon' }, color: MAP_TOKENS.categorical[0] },
  { label: { zh: '半程馬拉松', en: 'Half marathon' }, color: MAP_TOKENS.categorical[1] },
  { label: { zh: '超級馬拉松', en: 'Ultramarathon' }, color: MAP_TOKENS.categorical[4] },
  { label: { zh: '鐵人三項', en: 'Triathlon' }, color: MAP_TOKENS.categorical[6] },
];

function names(p: PointRecord): { title: string; proper?: string } {
  const zh = typeof p.zh === 'string' && p.zh ? p.zh : null;
  const en = String(p.en ?? '');
  return getLang() === 'zh' && zh ? { title: zh, proper: en } : { title: en };
}

function facts(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const kind = KINDS[Number(p.k) - 1];
  return [
    [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, kind ? tr(kind.label) : null].filter(Boolean).join(' · '),
    p.y != null
      ? tr({ zh: `創辦：${p.y} 年（Wikidata）`, en: `Founded: ${p.y} (Wikidata)` })
      : tr({ zh: 'Wikidata 沒有創辦年', en: 'No founding year on Wikidata' }),
  ];
}

const LIST: ListPanelDef = {
  label: { zh: '賽事（依創辦年）', en: 'Races by founding year' },
  file: 'list.json',
  rows: (points, { countryName, year }) =>
    [...points]
      .sort((a, b) => (a.y == null ? 9999 : Number(a.y)) - (b.y == null ? 9999 : Number(b.y)) || String(a.en).localeCompare(String(b.en)))
      .map((p, i): ListRow => {
        const { title, proper } = names(p);
        return {
          key: `${p.q}-${i}`,
          title,
          lines: facts(p, countryName),
          properNoun: proper,
          // 時間軸那一年還沒創辦的淡一點
          muted: p.y != null && Number(p.y) > year,
          target: Number(p.pt) === 1 ? { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 } : { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
        };
      }),
};

const points = (id: string, indicators: string[], timed: boolean): PointsOverlayDef => ({
  kind: 'points',
  id,
  file: 'points.json',
  indicators,
  label: { zh: '賽事（有座標的）', en: 'Races (with coordinates)' },
  radius: 4,
  color: { field: 'k', title: { zh: '類別', en: 'Type' }, thresholds: [2, 3, 4], classes: KINDS },
  ...(timed && { timeField: 'y' }),
  tooltip: (p, { countryName }) => {
    const { title, proper } = names(p);
    return { title, extra: facts(p, countryName), properNoun: proper };
  },
});

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 場`, en: fixed(v, 0) });

export const roadRaces: TopicDefinition = {
  id: 'road-races',
  title: { zh: '馬拉松、超馬與鐵人賽事', en: 'Marathons, ultramarathons and triathlons' },
  shortTitle: { zh: '路跑賽事', en: 'Road races' },
  defaultIndicator: 'races',
  defaultYear: 2026,
  sources: [{ name: { zh: 'Wikidata（2026 年 11 月 4 日查詢）', en: 'Wikidata (queried 4 November 2026)' }, url: 'https://www.wikidata.org/', license: 'CC0' }],
  note: {
    zh: 'Wikidata 上標成全程馬拉松、半程馬拉松、超級馬拉松或鐵人三項賽的條目（639 場、90 國），「2023 Taipei Marathon」這類某一屆的條目併回母賽事。Wikidata 只收了維基百科寫過的賽事，各國實際上一年辦的路跑多得多（中國一年五百多場馬拉松，這裡只有 9 場），所以這張圖畫的是「維基寫過哪些賽事」，英語圈與歐洲特別多，不能拿來比各國的路跑風氣。點只畫有座標的（賽事本身或所在地有座標，480 場）；左邊的清單全部列出，沒有座標的點了框住國家。創辦年照 Wikidata（407 場有），某一屆的年份不算創辦年。',
    en: 'Wikidata items classed as marathons, half marathons, ultramarathons or triathlons (639 races in 90 countries), with items for a single edition such as “2023 Taipei Marathon” merged into the race. Wikidata only holds races that Wikipedia has written about; many more are actually held (China holds more than 500 marathons a year, but only 9 are here), so this map shows which races Wikipedia covers, with English-speaking countries and Europe over-represented, and cannot compare how popular running is. Dots show only races with coordinates (on the race or its location, 480 races); the list on the left includes all, and those without coordinates zoom to the country. Founding years follow Wikidata (407 races have one); the year of a single edition is not taken as the founding year.',
  },
  listPanel: LIST,
  overlays: [points('races-now', ['races'], false), points('races-founded', ['founded'], true)],
  indicators: [
    {
      id: 'races',
      label: { zh: 'Wikidata 上有幾場賽事', en: 'Races on Wikidata' },
      description: {
        zh: '各國在 Wikidata 上的馬拉松、超馬與鐵人賽事場數。美國 134 場最多，英國 66、德國 52、法國與加拿大 23、日本 21、俄羅斯 20、印度 19、義大利、波蘭與西班牙 18、丹麥 17；中國 9、南韓 5、台灣 3（新北市萬金石馬拉松、高雄富邦馬拉松、臺北馬拉松）。多寡反映的是維基的覆蓋，不是實際辦了幾場。',
        en: 'Number of marathons, ultramarathons and triathlons on Wikidata by country. The US has the most at 134, followed by the UK 66, Germany 52, France and Canada 23, Japan 21, Russia 20, India 19, Italy, Poland and Spain 18 and Denmark 17; China 9, South Korea 5 and Taiwan 3 (the Wan Jin Shi Marathon in New Taipei, the Kaohsiung Marathon and the Taipei Marathon). The counts reflect Wikipedia’s coverage, not how many races are actually held.',
      },
      unit: { zh: '場', en: 'races' },
      file: 'races.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 50] } },
      format: count,
      formatTick: (v) => `${v}`,
      integer: true,
      shareOfWorld: true,
    },
    {
      id: 'founded',
      label: { zh: '依創辦年累積的賽事', en: 'Races by founding year (cumulative)' },
      description: {
        zh: '到那一年為止已經創辦的賽事（只算 Wikidata 有創辦年的 407 場）。波士頓馬拉松 1897 年最早；1950 年只有 10 場，1980 年 78 場，2000 年 227 場，大多數是 1980 年代的路跑熱潮以後才辦的。拖動時間軸看賽事怎麼擴散；台灣的新北市萬金石馬拉松在 Wikidata 寫 1979 年創辦。',
        en: 'Races founded up to the selected year (only the 407 races with a founding year on Wikidata). The Boston Marathon (1897) is the oldest; there were only 10 by 1950, 78 by 1980 and 227 by 2000, most of them founded after the running boom of the 1980s. Drag the time slider to watch them spread; Wikidata gives 1979 as the founding year of Taiwan’s Wan Jin Shi Marathon.',
      },
      unit: { zh: '場', en: 'races' },
      file: 'founded.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 20, 50] } },
      overlayTime: 'cumulative',
      format: count,
      formatTick: (v) => `${v}`,
      integer: true,
    },
  ],
};
