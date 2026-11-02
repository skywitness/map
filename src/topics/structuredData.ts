/**
 * 主題頁的結構化資料（schema.org Dataset，製作手冊第十六批 267，2026-11-01）：建置時 vite.config.ts 的 topicPages 在每個
 * t/<主題>/index.html 加一段 `<script type="application/ld+json">`，讓 Google 資料集搜尋找得到。
 *
 * - 主題的名稱、指標、資料檔、來源由 scripts/topic-catalog.mjs 從主題定義整理成 datasets.gen.json（catalog.ts 的
 *   datasetEntry()）；年份範圍（temporalCoverage）在建置時讀資料檔的 years 算，資料更新時不必重跑主題目錄。
 * - 授權：來源的授權都一樣時寫在 `license`；不一樣時不寫，每個來源在 `isBasedOn` 寫自己的授權。認得的授權寫網址
 *   （LICENSE_URLS），認不得的只寫名稱。
 * - vite.config.ts 會載入這個檔，所以不 import i18n（模組載入時會讀 window）。
 * - i18n-ignore-file：只在建置時用，不是介面；中文是授權的正式名稱、網站的中文名稱與建置錯誤訊息（JSON-LD 的語言是
 *   zh-Hant，跟主題頁的 HTML 一樣）。
 */

/** 雙語文字（同 i18n/lang 的 Text；這裡不 import 它） */
export type DatasetText = string | { zh: string; en: string };

export interface DatasetSource {
  name: DatasetText;
  url: string;
  license: DatasetText;
}

/** datasets.gen.json 的一個主題 */
export interface DatasetEntry {
  name: { zh: string; en: string };
  /** 預設指標的說明（中文） */
  about: string;
  /** 全部指標的中文名稱 */
  indicators: string[];
  /** 指標的資料檔（data/ 底下的路徑，子項目用預設的），建置時讀 years 算年份範圍 */
  files: string[];
  sources: DatasetSource[];
}

const CC = 'https://creativecommons.org/';

/**
 * 授權名稱 → 網址（2026-11-01 每個網址都打開過，Etalab 2.0 的官方頁 cloud 連不上，沒有收）。比對前統一大小寫、空白，
 * 中文與英文名稱都比。
 */
const LICENSE_URLS: [string[], string][] = [
  [['CC BY 4.0'], `${CC}licenses/by/4.0/`],
  [['CC BY 3.0'], `${CC}licenses/by/3.0/`],
  [['CC BY 3.0 IGO'], `${CC}licenses/by/3.0/igo/`],
  [['CC BY-SA 4.0'], `${CC}licenses/by-sa/4.0/`],
  [['CC BY-SA 3.0'], `${CC}licenses/by-sa/3.0/`],
  [['CC BY-NC-SA 4.0'], `${CC}licenses/by-nc-sa/4.0/`],
  [['CC BY-NC-SA 3.0'], `${CC}licenses/by-nc-sa/3.0/`],
  [['CC BY-NC-SA 3.0 IGO'], `${CC}licenses/by-nc-sa/3.0/igo/`],
  [['CC0', 'CC0 1.0'], `${CC}publicdomain/zero/1.0/`],
  [['ODbL', 'ODbL 1.0', 'Open Database License (ODbL)'], 'https://opendatacommons.org/licenses/odbl/1-0/'],
  [['ODC-By 1.0'], 'https://opendatacommons.org/licenses/by/1-0/'],
  [['MIT'], 'https://opensource.org/license/mit'],
  [['Unicode License v3'], 'https://www.unicode.org/license.txt'],
  [['Statistics Canada Open Licence'], 'https://www.statcan.gc.ca/en/reference/licence'],
  [['PDL 1.0'], 'https://www.digital.go.jp/resources/open_data/public_data_license_v1.0'],
  [
    ['政府資料開放授權條款', '政府資料開放授權條款第 1 版', '政府資料開放授權條款－第 1 版', 'Open Government Data License, Taiwan'],
    'https://data.gov.tw/license',
  ],
];

const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const URL_OF = new Map(LICENSE_URLS.flatMap(([names, url]) => names.map((n) => [norm(n), url] as const)));

/**
 * 名稱後面括號裡只說明「這裡的資料檔也用同一個授權」或「非商業」的（「ODbL 1.0（© OpenStreetMap 貢獻者；資料檔也是）」），
 * 括號前面就是授權；括號裡有條款、事實、附加條件的（「CC BY 4.0（另有 WHO 的附加條款）」「CC BY-SA 4.0（引用事實）」）不算
 */
const NOTE = /^(.*?)\s*[（(]([^（）()]*)[）)]$/;
const PLAIN_NOTE = /資料檔|data files?|非商業|non-commercial/i;
const OTHER_TERMS = /條款|terms|事實|facts|附加|additional|引用|cited/i;

const zhOf = (text: DatasetText) => (typeof text === 'string' ? text : text.zh);

/** 授權的網址；認不得的回傳 null */
export function licenseUrl(license: DatasetText): string | null {
  const names = typeof license === 'string' ? [license] : [license.zh, license.en];
  for (const name of names) {
    const url = URL_OF.get(norm(name));
    if (url) return url;
    const m = NOTE.exec(name.trim());
    if (m && PLAIN_NOTE.test(m[2]) && !OTHER_TERMS.test(m[2])) {
      const inner = URL_OF.get(norm(m[1]));
      if (inner) return inner;
    }
  }
  return null;
}

type LicenseValue = string | { '@type': 'CreativeWork'; name: string };

/** 認得的寫網址，認不得的寫名稱（schema.org 的 license 要網址或 CreativeWork） */
function licenseValue(license: DatasetText): LicenseValue {
  return licenseUrl(license) ?? { '@type': 'CreativeWork', name: zhOf(license) };
}

/**
 * 資料檔的年份 → temporalCoverage（ISO 8601 的期間「1950/2100」，只有一年時寫那一年，西元 1000 年以前補 0 成四位數
 * 「0578/2026」）；沒有年份時 null。有西元前的年份時也是 null：資料檔的「-3400」是西元前 3400 年（沒有西元 0 年），
 * ISO 8601 的年份有 0 年、負數還要另外約定位數，寫了容易被讀錯，所以不寫
 */
export function temporalCoverage(years: Iterable<unknown>): string | null {
  let min = Infinity;
  let max = -Infinity;
  for (const y of years) {
    if (typeof y !== 'number' || !Number.isInteger(y) || y > 9999) continue;
    if (y < 1) return null;
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  if (!Number.isFinite(min)) return null;
  const iso = (y: number) => String(y).padStart(4, '0');
  return min === max ? iso(min) : `${iso(min)}/${iso(max)}`;
}

export const SITE_NAME = { zh: '世界資料地圖', en: 'World Data Map' };

/** Google 的 Dataset 說明要 50–5,000 字 */
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 5000;

/**
 * 一個主題的 Dataset。description 是頁面的說明（meta description）加上預設指標的說明，超過 5,000 字時截掉
 */
export function datasetJsonLd(
  entry: DatasetEntry,
  page: { url: string; site: string; description: string; temporalCoverage: string | null },
): Record<string, unknown> {
  let description = `${page.description}${entry.about}`.trim();
  if ([...description].length > DESCRIPTION_MAX) description = `${[...description].slice(0, DESCRIPTION_MAX - 1).join('')}…`;
  const licenses = entry.sources.map((s) => licenseValue(s.license));
  const keys = new Set(licenses.map((l) => (typeof l === 'string' ? l : `name:${l.name}`)));
  const same = licenses.length > 0 && keys.size === 1;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: entry.name.zh,
    alternateName: entry.name.en,
    description,
    url: page.url,
    inLanguage: ['zh-Hant', 'en'],
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: SITE_NAME.zh, alternateName: SITE_NAME.en, url: page.site },
    spatialCoverage: 'World',
    ...(page.temporalCoverage && { temporalCoverage: page.temporalCoverage }),
    ...(entry.indicators.length && { keywords: entry.indicators }),
    ...(same && { license: licenses[0] }),
    ...(entry.sources.length && {
      isBasedOn: entry.sources.map((s, i) => ({
        '@type': 'CreativeWork',
        name: zhOf(s.name),
        url: s.url,
        ...(!same && { license: licenses[i] }),
      })),
    }),
  };
}

/** JSON-LD 放進 <script>：`<` 換成 \u003c，內容裡的「</script>」不會提早結束 */
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/**
 * 建置時的檢查：頁面裡的 JSON-LD 能解析，Google 要的欄位都有（name、description 50–5,000 字、url、creator、
 * license 或每個來源都有授權）。回傳問題清單，空的就是沒問題
 */
export function datasetProblems(html: string, url: string): string[] {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) return [`JSON-LD 應該剛好一段，有 ${scripts.length} 段`];
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(scripts[0][1]);
  } catch (e) {
    return [`JSON-LD 不能解析：${(e as Error).message}`];
  }
  const problems: string[] = [];
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  if (data['@context'] !== 'https://schema.org' || data['@type'] !== 'Dataset') problems.push('不是 schema.org 的 Dataset');
  if (!text(data.name)) problems.push('沒有 name');
  const length = typeof data.description === 'string' ? [...data.description].length : 0;
  if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) problems.push(`description 有 ${length} 字（要 ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}）`);
  if (data.url !== url) problems.push(`url 是 ${String(data.url)}，不是 ${url}`);
  const creator = data.creator as { name?: unknown; url?: unknown } | undefined;
  if (!creator || !text(creator.name) || !text(creator.url)) problems.push('creator 沒有名稱或網址');
  if (data.temporalCoverage !== undefined && !/^\d{4}(\/\d{4})?$/.test(String(data.temporalCoverage))) {
    problems.push(`temporalCoverage 的格式不對：${String(data.temporalCoverage)}`);
  }
  const based = (data.isBasedOn ?? []) as { name?: unknown; url?: unknown; license?: unknown }[];
  if (based.some((s) => !text(s.name) || !text(s.url))) problems.push('isBasedOn 有來源沒有名稱或網址');
  if (data.license === undefined && (!based.length || based.some((s) => s.license === undefined))) {
    problems.push('沒有 license，isBasedOn 也沒有每個來源的授權');
  }
  return problems;
}
