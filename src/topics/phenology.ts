import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, IndicatorDef, PointRecord, PointsOverlayDef } from './types';

/**
 * 各國氣溫與降雨的擴充：日本的櫻花開花與楓葉紅葉（2026-11-06，製作手冊第二十四批 418；pipeline/topics/phenology_jp.py）。
 * 日本氣象廳 102 站的生物季節觀測，1953–2025 年每年一筆。點的欄位：b、f、m、g 加年份是櫻花開花、櫻花滿開、楓葉紅葉、
 * 銀杏黃葉是那一季的第幾天（平年算；櫻花在前一年 12 月開的是負的，楓葉拖到隔年 1 月的大於 365），
 * 再加 s 是那一年用代替種目，n 是平年值。
 */

const FIRST = 1953;
const LAST = 2025;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);

/** 那一季的第幾天 → 月、日（平年） */
function monthDay(doy: number): [number, number] {
  const d = new Date(Date.UTC(2001, 0, 1) + (doy - 1) * 86400000);
  return [d.getUTCMonth() + 1, d.getUTCDate()];
}
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateText(doy: number, lang = getLang()): string {
  const [m, d] = monthDay(doy);
  return tr({ zh: `${m} 月 ${d} 日`, en: `${d} ${EN_MONTHS[m - 1]}` }, lang);
}

function dateClasses(title: Text, field: string, thresholds: number[]): ColorClasses {
  return {
    field,
    title,
    thresholds,
    classes: MAP_TOKENS.sequential.map((color, i) => ({
      color,
      label:
        i === 0
          ? { zh: `${dateText(thresholds[0] - 1, 'zh')}以前`, en: `before ${dateText(thresholds[0], 'en')}` }
          : i === thresholds.length
            ? { zh: `${dateText(thresholds[i - 1], 'zh')}以後`, en: `${dateText(thresholds[i - 1], 'en')} or later` }
            : { zh: `${dateText(thresholds[i - 1], 'zh')}–${dateText(thresholds[i] - 1, 'zh')}`, en: `${dateText(thresholds[i - 1], 'en')}–${dateText(thresholds[i] - 1, 'en')}` },
    })),
  };
}

/** 春天：2 月 1 日、3 月 1 日、3 月 21 日、4 月 1 日、4 月 15 日、5 月 1 日；秋天：11 月 1、11、21 日、12 月 1、11、21 日 */
const SPRING = [32, 60, 80, 91, 105, 121];
const AUTUMN = [305, 315, 325, 335, 345, 355];

export function stationName(p: PointRecord, lang = getLang()): string {
  return String((lang === 'zh' ? p.n : p.ne) ?? p.n ?? '');
}

interface Item {
  id: string;
  key: string;
  label: { zh: string; en: string };
  verb: { zh: string; en: string };
  thresholds: number[];
}
const ITEMS: Item[] = [
  { id: 'sakura-bloom', key: 'b', label: { zh: '櫻花開花', en: 'Cherry blossom' }, verb: { zh: '開花', en: 'first bloom' }, thresholds: SPRING },
  { id: 'sakura-full', key: 'f', label: { zh: '櫻花滿開', en: 'Cherry full bloom' }, verb: { zh: '滿開', en: 'full bloom' }, thresholds: SPRING },
  { id: 'maple-red', key: 'm', label: { zh: '楓葉紅葉', en: 'Maple colour' }, verb: { zh: '紅葉', en: 'leaves turned red' }, thresholds: AUTUMN },
  { id: 'ginkgo-yellow', key: 'g', label: { zh: '銀杏黃葉', en: 'Ginkgo colour' }, verb: { zh: '黃葉', en: 'leaves turned yellow' }, thresholds: AUTUMN },
];

function overlay(item: Item): PointsOverlayDef {
  return {
    kind: 'points',
    id: item.id,
    file: 'phenology.json',
    label: { zh: `${item.label.zh}的日期`, en: `${item.label.en} date` },
    indicators: [item.id],
    radius: 4.2,
    color: dateClasses({ zh: `${item.verb.zh}的日期`, en: `Date of ${item.verb.en}` }, 'd', item.thresholds),
    sortField: 'd',
    epochs: { years: YEARS, values: (p, year) => ({ d: typeof p[`${item.key}${year}`] === 'number' ? (p[`${item.key}${year}`] as number) : null }) },
    minValue: { field: 'd', stops: [[0, -400]] },
    tooltip: (p, ctx) => {
      const v = p[`${item.key}${ctx.year}`];
      const normal = p[`${item.key}n`];
      const diff = typeof v === 'number' && typeof normal === 'number' ? v - normal : null;
      const diffText =
        diff === null
          ? null
          : diff === 0
            ? tr({ zh: '跟平年同一天', en: 'same day as normal' })
            : tr({
                zh: `比平年${diff < 0 ? '早' : '晚'} ${Math.abs(diff)} 天`,
                en: `${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'day' : 'days'} ${diff < 0 ? 'earlier' : 'later'} than normal`,
              });
      return {
        title: stationName(p),
        detail:
          typeof v === 'number'
            ? tr({ zh: `${ctx.year} 年 ${dateText(v)}${item.verb.zh}`, en: `${item.verb.en.replace(/^./, (c) => c.toUpperCase())} ${dateText(v)} ${ctx.year}` })
            : '',
        extra: [
          diffText && typeof normal === 'number' ? tr({ zh: `${diffText}（平年 ${dateText(normal)}）`, en: `${diffText} (normal ${dateText(normal)})` }) : null,
          p[`${item.key}s${ctx.year}`] === 1 ? tr({ zh: '代替種目（不是正規的樹種）', en: 'Substitute species (not the standard tree)' }) : null,
        ].filter((x): x is string => Boolean(x)),
        properNoun: getLang() === 'zh' && typeof p.nj === 'string' && p.nj !== p.n ? p.nj : undefined,
      };
    },
  };
}

const stationsText = (v: number) => tr({ zh: `${fixed(v, 0)} 站`, en: `${fixed(v, 0)} ${v === 1 ? 'station' : 'stations'}` });

const DESCRIPTIONS: Record<string, Text> = {
  'sakura-bloom': {
    zh: '日本氣象廳 102 個氣象台每年觀測標本木的櫻花開花日（多半是染井吉野），點的顏色是時間軸那一年開花的日期，播放時間軸看開花前線從沖繩、九州一路往北推到北海道。兩段都有染井吉野觀測的 47 站，2016–2025 年的平均開花日全都比 1953–1962 年早，中位數早 6.7 天。東京 1953 年 3 月 26 日開花，2020、2021、2023 年都是 3 月 14 日，2025 年 3 月 24 日；京都 1953 年 4 月 5 日、2021 年 3 月 16 日。沖繩、奄美用寒緋櫻，1 月就開（有時是前一年 12 月）；北海道有幾站用蝦夷山櫻、千島櫻，5 月才開；這些代替的樹種不能跟染井吉野直接比，只能各站看自己的趨勢。滑過站看比平年早幾天。台灣沒有官方的開花觀測。',
    en: 'The date the specimen cherry trees (mostly Somei-yoshino) at 102 Japan Meteorological Agency stations first bloomed, each year from 1953 to 2025; dots are coloured by that year’s date, so playing the timeline shows the cherry-blossom front moving north from Okinawa and Kyushu to Hokkaido. At all 47 stations with Somei-yoshino records in both periods, the 2016–2025 average was earlier than 1953–1962, by a median of 6.7 days. Tokyo bloomed on 26 March in 1953, on 14 March in 2020, 2021 and 2023, and on 24 March in 2025; Kyoto on 5 April 1953 and 16 March 2021. Okinawa and Amami use Taiwan cherries, blooming in January (sometimes the previous December), and several Hokkaido stations use Sargent’s or Kuril cherries, blooming in May; these substitute species cannot be compared directly with Somei-yoshino, only each station with itself. Hover over a station to see how many days earlier than normal it was. Taiwan has no official bloom observations.',
  },
  'sakura-full': {
    zh: '同一批標本木的櫻花滿開日（八成以上的花開了），平年值比開花晚 4 到 11 天，中位數 7 天。播放時間軸看賞櫻的季節從南往北走。',
    en: 'Full bloom (80% or more of the flowers open) of the same specimen trees, normally 4 to 11 days after first bloom, 7 days at the median. Play the timeline to watch the viewing season travel north.',
  },
  'maple-red': {
    zh: '日本氣象廳各站的楓樹標本木大部分轉紅的日期，秋天從北海道往南推，跟櫻花反過來。東京 1953 年 11 月 8 日，2025 年 11 月 23 日；兩段都有資料的 36 站裡 35 站變晚，2016–2025 年比 1953–1962 年的平均中位數晚 15.2 天。只有大約一半的站觀測楓葉。',
    en: 'The date most of a specimen maple turned red at each Japan Meteorological Agency station; in autumn the front moves south from Hokkaido, the reverse of the cherry blossom. Tokyo was 8 November in 1953 and 23 November in 2025; of the 36 stations with records in both periods, 35 got later, the 2016–2025 average being a median 15.2 days later than 1953–1962. Only about half the stations observe maples.',
  },
  'ginkgo-yellow': {
    zh: '日本氣象廳各站的銀杏全樹大部分轉黃的日期，跟楓葉一樣從北往南。',
    en: 'The date most of a specimen ginkgo turned yellow at each Japan Meteorological Agency station, moving south from the north like the maples.',
  },
};

const indicators: IndicatorDef[] = ITEMS.map((item) => ({
  id: item.id,
  label: item.label,
  description: DESCRIPTIONS[item.id],
  unit: { zh: '站', en: 'stations' },
  file: `${item.id}-stations.json`,
  defaultYear: LAST,
  layer: { kind: 'none' },
  format: stationsText,
  formatTick: (v) => fixed(v, 0),
  integer: true,
  unranked: true,
  rankingBars: false,
  panelChart: false,
}));

export const phenologyPart: TopicPart = {
  name: { zh: '日本的櫻花與紅葉', en: 'Cherry blossom and autumn leaves in Japan' },
  sources: [
    {
      name: { zh: '日本氣象廳 生物季節觀測累年值（さくら開花・満開、かえで紅葉、いちょう黄葉）', en: 'Japan Meteorological Agency, phenological observations (cherry blossom, maple and ginkgo colour)' },
      url: 'https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html',
      license: { zh: '公共データ利用規約（第 1.0 版），依規定加工並註明出處', en: 'Public Data License (Japan) 1.0, processed and credited as required' },
    },
  ],
  note: {
    zh: '出典：日本氣象廳網站「生物季節觀測累年值」（2026 年 11 月下載），本網站把日期換成那一季的第幾天、依站名對上氣象廳 AMeDAS 站表的座標、把站名換成台灣的寫法。102 站每年各觀測一次；2020 年底氣象廳把植物的觀測項目減到 6 種，這四種都還在測，但有些站中途停測或換了樹種。國家的值是那一年有觀測的站數。',
    en: 'Source: Japan Meteorological Agency website, phenological observation records (downloaded November 2026); this site converted dates to the day of the season, matched stations to coordinates from the JMA AMeDAS station table and edited the data. Each of the 102 stations reports once a year; at the end of 2020 the agency cut its plant observations to six items, and these four remain, though some stations stopped or changed species along the way. The country value is the number of stations reporting that year.',
  },
  overlays: ITEMS.map(overlay),
  indicators,
};
