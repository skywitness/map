import { getLang, tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed } from '../lib/format';
import { decodePoints } from '../map/overlayData';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, PointsData, TopicDefinition } from './types';

/**
 * 各國在讀什麼（pipeline/topics/reads.py）：Wikimedia 的差分隱私每日瀏覽量彙整成每國每月讀最多的維基百科條目。
 * 時間軸是月份：年份欄位是「2000 年 1 月起的第幾個月」，monthText() 換成「2026 年 9 月」。
 * 地圖上在每國寫那個月第一名的條目名稱（點圖層的 label）；側欄是前 10 名。
 */

export function monthOf(index: number): { year: number; month: number } {
  return { year: 2000 + Math.floor(index / 12), month: (index % 12) + 1 };
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 「2026 年 9 月」「September 2026」 */
export function monthText(index: number): string {
  const { year, month } = monthOf(index);
  return tr({ zh: `${year} 年 ${month} 月`, en: `${MONTHS_EN[month - 1]} ${year}` });
}

/** 時間軸刻度上的短寫法：「2026/9」「Sep 2026」 */
export function monthShort(index: number): string {
  const { year, month } = monthOf(index);
  return getLang() === 'en' ? `${MONTHS_EN[month - 1].slice(0, 3)} ${year}` : `${year}/${month}`;
}

/** 瀏覽次數：中文「26.7 萬次」，英文「267,000 views」 */
export function viewsText(v: number): string {
  return tr({
    zh: v >= 10000 ? `${fixed(v / 10000, v >= 1e6 ? 0 : 1)} 萬次` : `${fixed(v, 0)} 次`,
    en: `${fixed(v, 0)} ${v === 1 ? 'view' : 'views'}`,
  });
}

/** 維基百科的語言代碼 → 名稱（常見的幾種；其他照代碼） */
const LANGS: Record<string, { zh: string; en: string }> = {
  en: { zh: '英文', en: 'English' },
  zh: { zh: '中文', en: 'Chinese' },
  ja: { zh: '日文', en: 'Japanese' },
  ko: { zh: '韓文', en: 'Korean' },
  es: { zh: '西班牙文', en: 'Spanish' },
  fr: { zh: '法文', en: 'French' },
  de: { zh: '德文', en: 'German' },
  ru: { zh: '俄文', en: 'Russian' },
  pt: { zh: '葡萄牙文', en: 'Portuguese' },
  it: { zh: '義大利文', en: 'Italian' },
  ar: { zh: '阿拉伯文', en: 'Arabic' },
  fa: { zh: '波斯文', en: 'Persian' },
  tr: { zh: '土耳其文', en: 'Turkish' },
  pl: { zh: '波蘭文', en: 'Polish' },
  nl: { zh: '荷蘭文', en: 'Dutch' },
  id: { zh: '印尼文', en: 'Indonesian' },
  vi: { zh: '越南文', en: 'Vietnamese' },
  th: { zh: '泰文', en: 'Thai' },
  he: { zh: '希伯來文', en: 'Hebrew' },
  uk: { zh: '烏克蘭文', en: 'Ukrainian' },
  sv: { zh: '瑞典文', en: 'Swedish' },
  cs: { zh: '捷克文', en: 'Czech' },
  hu: { zh: '匈牙利文', en: 'Hungarian' },
  el: { zh: '希臘文', en: 'Greek' },
  ro: { zh: '羅馬尼亞文', en: 'Romanian' },
  fi: { zh: '芬蘭文', en: 'Finnish' },
  hi: { zh: '印地文', en: 'Hindi' },
  bn: { zh: '孟加拉文', en: 'Bengali' },
};

export function wikiName(lang: string | number | null): string {
  if (typeof lang !== 'string') return '';
  const name = LANGS[lang] ? tr(LANGS[lang]) : lang;
  return tr({ zh: `${name}維基百科`, en: `${name} Wikipedia` });
}

/**
 * 地圖上寫的名稱：目前語言的名稱（Wikidata），沒有時用原文。原文是 MapLibre 排不好的文字（阿拉伯、天城、泰文等需要
 * 連寫或組合的字母）時不寫在地圖上（tooltip 與側欄是 HTML，照常顯示）
 */
const COMPLEX_SCRIPT = /[֐-ࣿऀ-෿฀-໿က-႟ក-៿]/;

export function localTitle(p: Record<string, unknown>): string {
  const own = getLang() === 'en' ? p.e : p.z;
  if (typeof own === 'string' && own) return own;
  return typeof p.t === 'string' ? p.t : '';
}

function mapLabel(p: PointRecord): string {
  const text = localTitle(p);
  return COMPLEX_SCRIPT.test(text) ? '' : text;
}

function pointTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const local = localTitle(p);
  const original = typeof p.t === 'string' ? p.t : '';
  return {
    title: local,
    detail: tr({
      zh: `${ctx.countryName(String(p.c))}讀最多的條目 · ${monthText(Number(p.m))}`,
      en: `Most read in ${ctx.countryName(String(p.c))} · ${monthText(Number(p.m))}`,
    }),
    extra: [`${wikiName(p.l)} · ${typeof p.v === 'number' ? viewsText(p.v) : ''}`],
    properNoun: original && original !== local ? original : undefined,
  };
}

// ── tooltip 的「讀最多：…」：國家的 tooltip 拿不到點圖層的資料，這裡另外讀同一個檔（fetchJson 有快取） ──────────
let top: Map<string, PointRecord> | null = null;
let loading = false;
function topOf(iso3: string, month: number): PointRecord | undefined {
  if (!top && !loading) {
    loading = true;
    fetchJson<PointsData>('topics/reads/top.json').then(
      (data) => {
        top = new Map(decodePoints(data).map((p) => [`${p.c}:${p.m}`, p]));
      },
      () => (loading = false),
    );
  }
  return top?.get(`${iso3}:${month}`);
}

const MONTH_AXIS = {
  label: { zh: '月份', en: 'Month' },
  year: monthText,
  tick: monthShort,
};

const NOTE_DP = {
  zh: '瀏覽次數加了差分隱私的雜訊，一天不到約 90 次的不公布',
  en: 'View counts include differential-privacy noise, and pages with fewer than about 90 views a day are not published',
};

const indicators: IndicatorDef[] = [
  {
    id: 'top',
    label: { zh: '讀最多的條目', en: 'Most-read article' },
    description: {
      zh: '那個月每個國家讀最多的維基百科條目（各種語言的維基百科合在一起算，不含首頁），名稱寫在地圖上；滑過看瀏覽次數，點國家看前 10 名。國家不上色。',
      en: 'The Wikipedia article most read in each country that month (all language editions together, main pages excluded), written on the map; hover for view counts and click a country for its top 10. Countries are not coloured.',
    },
    unit: { zh: '次', en: 'views' },
    file: 'top-views.json',
    layer: { kind: 'none' },
    overlayTime: 'year',
    unranked: true,
    rankingBars: false,
    panelChart: false,
    format: (v) => tr({ zh: `第一名 ${viewsText(v)}`, en: `Top article: ${viewsText(v)}` }),
    formatTick: (v) => fixed(v, 0),
    timeAxis: MONTH_AXIS,
    missing: { zh: '沒有公布的瀏覽量（人少或差分隱私的門檻）', en: 'No published views (small population or the privacy threshold)' },
  },
  {
    id: 'english',
    label: { zh: '讀英文維基百科的比例', en: 'Reading English Wikipedia' },
    description: {
      zh: `那個月公布的維基百科瀏覽次數裡，英文維基百科占幾 %：英語國家與印度、非洲多數國家很高，有自己語言的大型維基百科的國家（日本、俄羅斯、德國、台灣）低。${NOTE_DP.zh}，小語言的維基百科被拿掉的比較多，比例會偏高。`,
      en: `Share of the month's published Wikipedia views that went to English Wikipedia: high in English-speaking countries, India and most of Africa, low where a large Wikipedia exists in the local language (Japan, Russia, Germany, Taiwan). ${NOTE_DP.en}; smaller language editions lose more to the threshold, so the share is biased upwards.`,
    },
    unit: '%',
    file: 'english.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 90, 95] } },
    format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
    formatTick: (v) => fixed(v, 0),
    timeAxis: MONTH_AXIS,
  },
];

export const reads: TopicDefinition = {
  id: 'reads',
  title: { zh: '各國在讀什麼', en: 'What each country is reading' },
  shortTitle: { zh: '在讀什麼', en: 'Reading' },
  defaultIndicator: 'top',
  defaultYear: 320,
  sources: [
    {
      name: {
        zh: 'Wikimedia 基金會：各國每日瀏覽量（差分隱私，country_project_page）',
        en: 'Wikimedia Foundation: daily pageviews per country (differentially private, country_project_page)',
      },
      url: 'https://analytics.wikimedia.org/published/datasets/country_project_page/00_README.html',
      license: 'CC0',
    },
    {
      name: { zh: 'Wikidata（條目的中文、英文名稱）', en: 'Wikidata (article names in Chinese and English)' },
      url: 'https://www.wikidata.org/',
      license: 'CC0',
    },
  ],
  note: {
    zh: `資料是 Wikimedia 基金會公布的各國每日維基百科瀏覽量（2023 年 2 月起），用差分隱私保護讀者：每位讀者一天只算前 10 個不同的條目，每個數字加了雜訊，一天不到門檻（多半是 90 次，部分國家 550 或 1,000 次）的不公布，所以小國、小語言的條目常常沒有資料。這裡把最近 24 個完整月份的每日資料相加，各種語言的維基百科合在一起排名，只拿掉首頁；熱門條目照原樣列出，可能有成人或聳動的內容；同一個條目同時在很多小國排第一（例如 2026 年 9 月的 Abby Borden 在 18 國、XXX 在 9 國），看起來像沒被濾掉的自動程式流量，也照原樣列出。條目名稱是原文，另外用 Wikidata 查中文與英文的名稱（中文優先用台灣正體的標籤，沒有時把中文維基百科的條目名稱轉成繁體字）；地圖上不寫阿拉伯、天城等文字的原文（地圖的字型排不好），滑過或點國家看。國家依讀者的所在地（IP 位址）判斷。${NOTE_DP.zh}。`,
    en: `The data are the Wikimedia Foundation's published daily Wikipedia pageviews by country (since February 2023), protected with differential privacy: only the first 10 distinct articles per reader per day are counted, every count has noise added, and counts below a threshold (usually 90 a day, 550 or 1,000 in some countries) are not published, so small countries and small language editions often have no data. Daily figures for the last 24 complete months are summed here and all language editions are ranked together, with only the main pages removed; popular articles are listed as they are and may include adult or sensational topics; when the same article tops many small countries at once (Abby Borden in 18 countries and XXX in 9 in September 2026, for example), it looks like automated traffic that was not filtered out, and it is also listed as is. Titles are as written in each Wikipedia, with Chinese and English names looked up in Wikidata; titles in Arabic, Devanagari and similar scripts are not written on the map (the map fonts cannot shape them) but appear on hover and in the side panel. Countries are based on readers' locations (IP addresses). ${NOTE_DP.en}.`,
  },
  panelExtra: () => import('./panels/ReadsPanel'),
  tooltipLines: (iso3, { indicator, year }) => {
    if (indicator !== 'top' || year === undefined) return [];
    const p = topOf(iso3, year);
    if (!p) return [];
    return [tr({ zh: `讀最多：${localTitle(p)}`, en: `Most read: ${localTitle(p)}` })];
  },
  overlays: [
    {
      kind: 'points',
      id: 'top',
      file: 'top.json',
      label: { zh: '讀最多的條目', en: 'Most-read article' },
      radius: 2.2,
      color: MAP_TOKENS.ink,
      timeField: 'm',
      pointLabel: mapLabel,
      tooltip: pointTooltip,
      indicators: ['top'],
      // 每個月一份，年份欄位是月份的編號：疊到別的主題上對不到時間軸，全部畫又太多
      shareable: false,
    },
  ],
  indicators,
};
