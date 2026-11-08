import { getLang, tr } from '../i18n/lang';
import { fetchJson } from '../lib/data';
import { fixed } from '../lib/format';
import { decodePoints } from '../map/overlayData';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, IndicatorDef, PointRecord, PointsData, TopicDefinition } from './types';
import { withParts, type TopicPart } from './parts';

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

/** 語言代碼 → 名稱（沒有的照代碼） */
export const langName = (lang: string) => (LANGS[lang] ? tr(LANGS[lang]) : lang);

/** 姊妹計畫（2026-11-07，製作手冊 558 的編輯者側欄） */
const SISTERS: Record<string, { zh: string; en: string }> = {
  wiktionary: { zh: '維基詞典', en: 'Wiktionary' },
  wikisource: { zh: '維基文庫', en: 'Wikisource' },
  wikibooks: { zh: '維基教科書', en: 'Wikibooks' },
  wikiversity: { zh: '維基學院', en: 'Wikiversity' },
  wikivoyage: { zh: '維基導遊', en: 'Wikivoyage' },
  wikiquote: { zh: '維基語錄', en: 'Wikiquote' },
  wikinews: { zh: '維基新聞', en: 'Wikinews' },
};
/** 跨語言的計畫（geoeditors 的 project 寫成 en.wikidata、en.commons，不是英文） */
const CROSS: Record<string, { zh: string; en: string }> = {
  wikidata: { zh: 'Wikidata', en: 'Wikidata' },
  commons: { zh: '維基共享資源', en: 'Wikimedia Commons' },
  meta: { zh: '元維基', en: 'Meta-Wiki' },
  mediawiki: { zh: 'MediaWiki', en: 'MediaWiki' },
  species: { zh: '維基物種', en: 'Wikispecies' },
  incubator: { zh: '維基孵育場', en: 'Wikimedia Incubator' },
};

/** geoeditors 的計畫名稱（zh.wikipedia、en.commons、ja.wiktionary）→ 顯示的名稱 */
export function projectName(project: string): string {
  const [lang, kind] = project.split('.');
  if (kind === 'wikipedia') return wikiName(lang);
  if (CROSS[kind]) return tr(CROSS[kind]);
  if (SISTERS[kind]) return tr({ zh: `${langName(lang)}${SISTERS[kind].zh}`, en: `${langName(lang)} ${SISTERS[kind].en}` });
  return project;
}

export function wikiName(lang: string | number | null): string {
  if (typeof lang !== 'string') return '';
  const name = langName(lang);
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

/**
 * 讀最多、編最多的語言版本（2026-11-07，製作手冊第二十七批 558；pipeline/topics/reads_languages.py 的 LANG_CLASSES）：
 * 7 種常見的語言加其他（日文、中文、韓文等本國語言的大型維基百科都在「其他」，滑過看名稱）
 */
const LANG_CLASSES: CategoryDef[] = [
  { value: 1, label: { zh: '英文', en: 'English' } },
  { value: 2, label: { zh: '法文', en: 'French' } },
  { value: 3, label: { zh: '西班牙文', en: 'Spanish' } },
  { value: 4, label: { zh: '俄文', en: 'Russian' } },
  { value: 5, label: { zh: '阿拉伯文', en: 'Arabic' } },
  { value: 6, label: { zh: '德文', en: 'German' } },
  { value: 7, label: { zh: '葡萄牙文', en: 'Portuguese' } },
  { value: 8, label: { zh: '其他語言', en: 'Other languages' }, color: MAP_TOKENS.categoricalOther },
];
const langClass = (v: number) => tr(LANG_CLASSES.find((c) => c.value === v)?.label ?? '');
const NOTE_PROTECTED = {
  zh: 'Wikimedia 為了保護讀者與編輯者，中國、俄羅斯、伊朗、沙烏地阿拉伯、越南、緬甸、北韓、古巴等國的資料不公布',
  en: 'To protect readers and editors, Wikimedia does not publish data for China, Russia, Iran, Saudi Arabia, Vietnam, Myanmar, North Korea, Cuba and some other countries',
};
const NOTE_GEO = {
  zh: '編輯者是 Wikimedia 每月公布的各國編輯者數（geoeditors，2023 年 7 月起；更早的檔只有以十為一級的區間，接不起來），國家看 IP 位址，用 VPN 會歸錯國；數字加了差分隱私的雜訊，太小的格子不公布',
  en: 'Editors are Wikimedia’s monthly counts by country (geoeditors, from July 2023; earlier files give only ranges in steps of ten and cannot be joined), located by IP address, so VPN users may be placed in the wrong country; counts include differential-privacy noise and small cells are suppressed',
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
  // 2026-11-07（製作手冊第二十七批 558，候選 1260、1258、1259）：讀與寫的語言、編輯者（pipeline/topics/reads_languages.py）
  {
    id: 'read-language',
    label: { zh: '讀最多的維基百科語言版本', en: 'Most-read Wikipedia language edition' },
    description: {
      zh: `那個月公布的瀏覽次數裡，哪一種語言的維基百科最多（跟「讀英文維基百科的比例」同一份數字）；滑過看前三名的比例，點國家看前五名。2026 年 9 月 231 國有值：英文 137 國、法文 26、西班牙文 19、俄文 6、阿拉伯文 5、德文 4、葡萄牙文 4，其他 30 國讀自己語言的維基百科（日文、中文、韓文、波蘭文等）。台灣中文 99%、英文 1%；日本日文 99%；南韓韓文 89%、英文 11%；烏克蘭烏克蘭文 51%、俄文 45%；新加坡英文 93%、中文 6%。${NOTE_DP.zh}，小語言被拿掉的比較多；${NOTE_PROTECTED.zh}。`,
      en: `Which language edition of Wikipedia got the most of the month's published views (the same figures as “Reading English Wikipedia”); hover for the top three shares and click a country for the top five. In September 2026, 231 countries have a value: English leads in 137, French in 26, Spanish in 19, Russian in 6, Arabic in 5, German in 4 and Portuguese in 4, while 30 read mainly in their own language (Japanese, Chinese, Korean, Polish and so on). Taiwan reads Chinese 99% and English 1%; Japan Japanese 99%; South Korea Korean 89% and English 11%; Ukraine Ukrainian 51% and Russian 45%; Singapore English 93% and Chinese 6%. ${NOTE_DP.en}, and small languages lose more; ${NOTE_PROTECTED.en}.`,
    },
    unit: '',
    file: 'read-language.json',
    layer: { kind: 'categorical', categories: LANG_CLASSES },
    format: langClass,
    timeAxis: MONTH_AXIS,
  },
  {
    id: 'editors',
    label: { zh: '每百萬人幾位維基百科編輯者', en: 'Wikipedia editors per million people' },
    description: {
      zh: `那個月在任何語言的維基百科編輯 5 次以上的人，每百萬人（各語言版本的人數相加，同一個人編兩種語言會算兩次；人口是聯合國 WPP 2024，人口不到 100 萬的不畫）。2026 年 10 月 113 國有值：愛沙尼亞 184、以色列 155、芬蘭 140、瑞典 103、瑞士 100 最多，法國 93、英國 85、德國 83、台灣 72、美國 65、日本 52、南韓 29、印度 2.3。台灣編中文維基的有 6,129 人（含 1–4 次），英文維基 724 人、Wikidata 414 人、日文維基 305 人。${NOTE_GEO.zh}；${NOTE_PROTECTED.zh}。`,
      en: `People who made 5 or more edits that month to any language edition of Wikipedia, per million people (counts for each edition are added, so someone editing two languages counts twice; population is UN WPP 2024, and countries under 1 million are not shown). In October 2026, 113 countries have a value: Estonia (184), Israel (155), Finland (140), Sweden (103) and Switzerland (100) have the most, followed by France 93, the UK 85, Germany 83, Taiwan 72, the US 65, Japan 52, South Korea 29 and India 2.3. In Taiwan 6,129 people edited Chinese Wikipedia (including those with 1–4 edits), 724 English Wikipedia, 414 Wikidata and 305 Japanese Wikipedia. ${NOTE_GEO.en}; ${NOTE_PROTECTED.en}.`,
    },
    unit: { zh: '人／百萬人', en: 'per million' },
    file: 'editors.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 25, 50, 75, 100] } },
    format: (v) => tr({ zh: `每百萬人 ${fixed(v, v < 10 ? 1 : 0)} 人`, en: `${fixed(v, v < 10 ? 1 : 0)} per million` }),
    formatTick: (v) => fixed(v, 0),
    timeAxis: MONTH_AXIS,
    defaultYear: 'latest',
  },
  {
    id: 'editors-english',
    label: { zh: '編英文維基百科的比例', en: 'Editing English Wikipedia' },
    description: {
      zh: `那個月這一國的維基百科編輯者（含只編 1–4 次的）有幾 % 編的是英文維基百科（各語言版本的人數相加；Wikidata、維基共享資源等跨語言的計畫不算），跟「讀英文維基百科的比例」對照：讀與寫不一定一樣。各語言版本合計不到 50 人的國家不畫。2026 年 10 月 128 國有值：美國 94%、英國 93%、印度 83%、新加坡 74%；南韓 19%、德國 17%、法國 12%、烏克蘭 11%、台灣 9.8%、日本 6.7%。${NOTE_GEO.zh}；${NOTE_PROTECTED.zh}。`,
      en: `Share of the country's Wikipedia editors that month (including those with only 1–4 edits) who edited English Wikipedia (counts for each edition added up; cross-language projects such as Wikidata and Commons are not counted), to compare with “Reading English Wikipedia”: reading and writing need not match. Countries with fewer than 50 editors in all are not shown. In October 2026, 128 countries have a value: the US 94%, the UK 93%, India 83% and Singapore 74%; South Korea 19%, Germany 17%, France 12%, Ukraine 11%, Taiwan 9.8% and Japan 6.7%. ${NOTE_GEO.en}; ${NOTE_PROTECTED.en}.`,
    },
    unit: '%',
    file: 'editors-english.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 25, 50, 75, 90, 95] } },
    format: (v) => `${fixed(v, v < 10 ? 1 : 0)}%`,
    formatTick: (v) => fixed(v, 0),
    timeAxis: MONTH_AXIS,
    defaultYear: 'latest',
  },
  {
    id: 'edit-language',
    label: { zh: '編輯者最多的維基百科語言版本', en: 'Wikipedia language edition with the most editors' },
    description: {
      zh: `那個月這一國的編輯者（含只編 1–4 次的）最多人編的是哪一種語言的維基百科；各語言版本合計不到 50 人的國家不畫，點國家看編輯者最多的計畫（含 Wikidata、維基共享資源）。2026 年 10 月 128 國有值：英文 47 國、西班牙文 17、法文 13、阿拉伯文 7、德文 3、葡萄牙文 2、俄文 2，其他 37 國編自己語言的維基百科（台灣、日本、南韓、印尼、土耳其等）。${NOTE_GEO.zh}；${NOTE_PROTECTED.zh}。`,
      en: `Which language edition of Wikipedia had the most editors from the country that month (including those with only 1–4 edits); countries with fewer than 50 editors in all are not shown, and clicking a country lists the projects with the most editors (including Wikidata and Commons). In October 2026, 128 countries have a value: English leads in 47, Spanish in 17, French in 13, Arabic in 7, German in 3, Portuguese in 2 and Russian in 2, while 37 edit mainly in their own language (Taiwan, Japan, South Korea, Indonesia, Türkiye and others). ${NOTE_GEO.en}; ${NOTE_PROTECTED.en}.`,
    },
    unit: '',
    file: 'edit-language.json',
    layer: { kind: 'categorical', categories: LANG_CLASSES },
    format: langClass,
    timeAxis: MONTH_AXIS,
    defaultYear: 'latest',
  },
];

/**
 * 從哪裡取得新聞（2026-11-06，製作手冊第二十四批 423；pipeline/topics/news_dnr.py）：Reuters Institute 數位新聞報告，
 * 一年一次的問卷。年份是一般的年，不是「讀最多的條目」的月份，所以不用那個側欄（ReadsPanel 把年份當月份）
 */
const newsPart: TopicPart = {
  name: { zh: '從哪裡取得新聞', en: 'Where people get news' },
  sources: [
    {
      name: {
        zh: 'Reuters Institute《Digital News Report 2026》（新聞 podcast、AI 聊天機器人、信任、付費、社群與影音平台的觸達；DOI 10.60625/risj-4vgf-s811）',
        en: 'Reuters Institute, Digital News Report 2026 (news podcasts, AI chatbots, trust, payment, social and video platform reach; DOI 10.60625/risj-4vgf-s811)',
      },
      url: 'https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026',
      license: 'CC BY 4.0',
    },
  ],
  panelExtra: () => Promise.resolve({ default: () => null }),
  indicators: [
    {
      id: 'news-podcasts',
      label: { zh: '每週聽新聞 podcast 的人', en: 'Weekly news podcast use' },
      description: {
        zh: '上週用新聞 podcast 取得新聞的人的比例（Reuters Institute《Digital News Report 2026》，2026 年 1–2 月的線上問卷，43 個市場）。印尼 17% 最高，秘魯、香港 16%，羅馬尼亞、保加利亞 15%，美國 14%；台灣 8%；西班牙、比利時 6%，土耳其 5%，阿根廷 4%，日本 3% 最低。只算新聞類的 podcast，不是所有 podcast 的收聽率；樣本是上網的人。',
        en: 'Share who used a news podcast in the last week (Reuters Institute Digital News Report 2026, online survey in January–February 2026, 43 markets). Indonesia is highest at 17%, then Peru and Hong Kong 16%, Romania and Bulgaria 15% and the US 14%; Taiwan 8%; Spain and Belgium 6%, Türkiye 5%, Argentina 4% and Japan 3% are lowest. Only news podcasts count, not podcast listening in general; the sample is online.',
      },
      unit: '%',
      file: 'news-podcasts.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 7, 9, 11, 13, 15] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡', en: 'Not covered by the Digital News Report' },
    },
    {
      id: 'news-ai-chatbots',
      label: { zh: '每週用 AI 聊天機器人看新聞的人', en: 'Weekly news use via AI chatbots' },
      description: {
        zh: '上週用 ChatGPT 這類 AI 聊天機器人取得新聞的人的比例（Reuters Institute《Digital News Report 2026》，43 個市場）。土耳其、南韓 14% 最高，香港、巴西 13%，印尼、希臘 12%；台灣 7%；法國、芬蘭、丹麥、德國 5%，英國 4% 最低。',
        en: 'Share who used an AI chatbot such as ChatGPT for news in the last week (Reuters Institute Digital News Report 2026, 43 markets). Türkiye and South Korea are highest at 14%, then Hong Kong and Brazil 13%, Indonesia and Greece 12%; Taiwan 7%; France, Finland, Denmark and Germany 5% and the UK 4% are lowest.',
      },
      unit: '%',
      file: 'news-ai-chatbots.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 7, 9, 11, 13] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡', en: 'Not covered by the Digital News Report' },
    },
    {
      id: 'news-trust',
      label: { zh: '信任新聞的人', en: 'Trust in news' },
      description: {
        zh: '認為「大部分的新聞大部分時候可以信任」的人的比例（Reuters Institute《Digital News Report 2026》，44 個市場，全體平均 37%）。奈及利亞、肯亞 68% 最高，芬蘭 63%，丹麥 55%、挪威 53%、瑞典 52%；台灣、美國 25%；羅馬尼亞 23%、保加利亞 21%、斯洛伐克 19%、希臘 18%、匈牙利 17% 最低。',
        en: 'Share who say they trust “most news most of the time” (Reuters Institute Digital News Report 2026, 44 markets; average 37%). Nigeria and Kenya are highest at 68%, then Finland 63%, Denmark 55%, Norway 53% and Sweden 52%; Taiwan and the US 25%; Romania 23%, Bulgaria 21%, Slovakia 19%, Greece 18% and Hungary 17% are lowest.',
      },
      unit: '%',
      file: 'news-trust.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [25, 30, 35, 40, 50, 60] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡', en: 'Not covered by the Digital News Report' },
    },
    {
      id: 'news-avoid',
      label: { zh: '有時或常常避開新聞的人', en: 'Avoid the news' },
      description: {
        zh: '有時或常常刻意避開新聞的人的比例（Reuters Institute《Digital News Report 2026》，48 個市場）。克羅埃西亞 63%、土耳其、希臘、保加利亞 60%、塞爾維亞 53% 最高；日本 12% 最低，台灣 19%、新加坡 26%、香港 28%、南韓 29%。',
        en: 'Share who sometimes or often actively avoid the news (Reuters Institute Digital News Report 2026, 48 markets). Croatia is highest at 63%, then Türkiye, Greece and Bulgaria 60% and Serbia 53%; Japan is lowest at 12%, followed by Taiwan 19%, Singapore 26%, Hong Kong 28% and South Korea 29%.',
      },
      unit: '%',
      file: 'news-avoid.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 45, 50, 60] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡', en: 'Not covered by the Digital News Report' },
    },
    {
      id: 'news-pay',
      label: { zh: '付費看線上新聞的人', en: 'Pay for online news' },
      description: {
        zh: '過去一年付費看線上新聞的人的比例（Reuters Institute《Digital News Report 2026》，37 個市場有數字）。挪威 40% 最高，瑞典 32%、芬蘭與澳洲 23%、愛爾蘭 22%、丹麥 20%；美國 16%、台灣 10%；葡萄牙、義大利、克羅埃西亞、希臘 8%，匈牙利 6% 最低。',
        en: 'Share who paid for online news in the last year (Reuters Institute Digital News Report 2026, 37 markets with figures). Norway is highest at 40%, then Sweden 32%, Finland and Australia 23%, Ireland 22% and Denmark 20%; the US 16% and Taiwan 10%; Portugal, Italy, Croatia and Greece 8% and Hungary 6% are lowest.',
      },
      unit: '%',
      file: 'news-pay.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [8, 10, 12, 15, 20, 30] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡，或那一頁沒有付費的數字', en: 'Not covered, or no payment figure for this market' },
    },
    // 2026-11-08（製作手冊第二十七批 658，候選 1440）：每個市場頁的平台觸達表
    {
      id: 'social-reach',
      label: { zh: '每週用社群與影音平台的人', en: 'Weekly use of social and video platforms' },
      description: {
        zh: '每週用這個平台做任何事的人的比例（Reuters Institute《Digital News Report 2026》每個市場頁的平台表，48 個市場；樣本是上網的人）。子項目切換平台。YouTube 48 個市場都有，肯亞 84% 最高，塞爾維亞、南韓、香港 80%、台灣 79%，丹麥 53% 最低；Facebook 菲律賓 84% 最高，日本 18%、南韓 27% 最低，台灣 72%；Instagram 奈及利亞 73% 最高、泰國 34% 最低，台灣 47%；TikTok 有 45 個市場，肯亞 79%、泰國與祕魯 71% 最高，丹麥 16% 最低，台灣 25%。表只列每個市場前幾名的平台，沒列的不畫。',
        en: 'Share who used the platform for any purpose in the last week (the platform table on each market page of the Reuters Institute Digital News Report 2026, 48 markets; samples are internet users). Sub-items switch platforms. YouTube covers all 48 markets: Kenya is highest at 84%, Serbia, South Korea and Hong Kong 80% and Taiwan 79%, with Denmark lowest at 53%; Facebook is highest in the Philippines (84%) and lowest in Japan (18%) and South Korea (27%), with Taiwan at 72%; Instagram is highest in Nigeria (73%) and lowest in Thailand (34%), with Taiwan at 47%; TikTok has 45 markets, highest in Kenya (79%) and Thailand and Peru (71%), lowest in Denmark (16%), with Taiwan at 25%. Each table lists only a market’s top platforms; unlisted ones are not shown.',
      },
      unit: '%',
      file: 'social-reach/{item}.json',
      dimension: {
        label: { zh: '平台', en: 'Platform' },
        options: [
          { id: 'youtube', label: 'YouTube' },
          { id: 'facebook', label: 'Facebook' },
          { id: 'instagram', label: 'Instagram' },
          { id: 'tiktok', label: 'TikTok' },
        ],
        defaultOption: 'youtube',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 50, 60, 70] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡，或這個平台不在那一國的表上', en: 'Not covered, or the platform is not in this market’s table' },
    },
    {
      id: 'social-news',
      label: { zh: '每週在社群與影音平台看新聞的人', en: 'Weekly news use on social and video platforms' },
      description: {
        zh: '每週在這個平台看新聞的人的比例（同一張表的「看新聞」欄）。YouTube 肯亞 66%、南韓 61%、印度 58% 最高，台灣 48%、美國 33%、日本 30%、英國 16%；Facebook 菲律賓 72%、泰國 69% 最高，台灣 47%，日本 5% 最低；Instagram 奈及利亞 50%、巴西 49%、土耳其 48% 最高，台灣與南韓 19%；TikTok 肯亞 58%、泰國 55% 最高，台灣 11%，日本、德國、英國 7%。',
        en: 'Share who used the platform for news in the last week (the “for news” column of the same table). YouTube is highest in Kenya (66%), South Korea (61%) and India (58%), with Taiwan at 48%, the US 33%, Japan 30% and the UK 16%; Facebook is highest in the Philippines (72%) and Thailand (69%), with Taiwan at 47% and Japan lowest at 5%; Instagram is highest in Nigeria (50%), Brazil (49%) and Turkey (48%), with Taiwan and South Korea at 19%; TikTok is highest in Kenya (58%) and Thailand (55%), with Taiwan at 11% and Japan, Germany and the UK at 7%.',
      },
      unit: '%',
      file: 'social-news/{item}.json',
      dimension: {
        label: { zh: '平台', en: 'Platform' },
        options: [
          { id: 'youtube', label: 'YouTube' },
          { id: 'facebook', label: 'Facebook' },
          { id: 'instagram', label: 'Instagram' },
          { id: 'tiktok', label: 'TikTok' },
        ],
        defaultOption: 'youtube',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 50, 60] } },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2026,
      missing: { zh: '不在數位新聞報告的市場裡，或這個平台不在那一國的表上', en: 'Not covered, or the platform is not in this market’s table' },
    },
  ],
};

export const reads: TopicDefinition = withParts({
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
      name: { zh: 'Wikimedia 基金會：各國每月的編輯者（差分隱私，geoeditors_monthly）', en: 'Wikimedia Foundation: monthly editors per country (differentially private, geoeditors_monthly)' },
      url: 'https://analytics.wikimedia.org/published/datasets/geoeditors_monthly/00_README.html',
      license: 'CC0',
    },
    {
      name: { zh: '聯合國《世界人口展望 2024》（每百萬人的編輯者）', en: 'UN World Population Prospects 2024 (editors per million)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
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
}, newsPart);
