import { tr } from '../i18n/lang';
import type { PointTooltip } from '../topics/types';

/**
 * Wikimedia Commons 的照片（2026-11-06，城2，參考 thecastlemap.com 的照片卡）：tooltip 滑過時才載入縮圖，
 * 瀏覽器直接讀 upload.wikimedia.org（跟 NASA GIBS、USGS 一樣是讀公開的資源，網站不送任何統計）。
 * 照片不存在版本庫裡（城堡 9,000 張約 100 MB）。
 *
 * 資料檔存 Commons 的縮圖路徑「2/23/檔名」（pipeline 用檔名的 MD5 算前兩段，跟 Commons 存檔的方式一樣），
 * 這裡組成縮圖的網址。寬度用 Commons 的標準寬度（330、500 px；2025 年起其他寬度可能被限流）。
 */
const WIDTHS = [330, 500] as const;

/** 縮圖的網址：TIFF 的縮圖是 JPEG、SVG 與 XCF 的是 PNG（檔名後面再加副檔名） */
export function commonsThumb(path: string, width: number): string {
  const [a, b, ...rest] = path.split('/');
  const name = rest.join('/');
  const enc = encodeURIComponent(name);
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const suffix = ext === 'tif' || ext === 'tiff' ? '.jpg' : ext === 'svg' || ext === 'xcf' ? '.png' : '';
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${b}/${enc}/${width}px-${enc}${suffix}`;
}

/** Commons 上的檔案頁 */
export function commonsPage(path: string): string {
  const name = path.split('/').slice(2).join('/');
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`;
}

/** 授權的名稱：英文的照原樣（CC BY-SA 3.0 等），少數幾個寫成中文 */
const LICENCE_NAMES: Record<string, { zh: string; en: string }> = {
  'Public domain': { zh: '公有領域', en: 'Public domain' },
  'Copyrighted free use': { zh: '可自由使用', en: 'Copyrighted free use' },
  'No restrictions': { zh: '沒有限制', en: 'No restrictions' },
  Attribution: { zh: '標示出處即可使用', en: 'Attribution' },
};

function licenceText(lic: string): string {
  return LICENCE_NAMES[lic] ? tr(LICENCE_NAMES[lic]) : lic;
}

/** 照片的出處：「照片：A.Savin，CC BY-SA 3.0，Wikimedia Commons」 */
export function photoCredit(by: string | null, lic: string | null): string {
  const parts = [by, lic ? licenceText(lic) : null, 'Wikimedia Commons'].filter(Boolean).join(tr({ zh: '，', en: ', ' }));
  return tr({ zh: `照片：${parts}`, en: `Photo: ${parts}` });
}

/** tooltip 的照片：資料檔的縮圖路徑、攝影者、授權 */
export function commonsPhoto(path: unknown, by: unknown, lic: unknown): PointTooltip['photo'] {
  if (typeof path !== 'string' || !path) return undefined;
  const [small, large] = WIDTHS.map((w) => commonsThumb(path, w));
  return {
    src: small,
    srcSet: `${small} ${WIDTHS[0]}w, ${large} ${WIDTHS[1]}w`,
    credit: photoCredit(typeof by === 'string' ? by : null, typeof lic === 'string' ? lic : null),
    // 點一下固定的卡片裡，照片連到 Commons 的檔案頁（原圖、完整的授權）
    page: commonsPage(path),
  };
}

const WIKI_LANGS: Record<string, { zh: string; en: string }> = {
  en: { zh: '英文', en: 'English' },
  zh: { zh: '中文', en: 'Chinese' },
  ja: { zh: '日文', en: 'Japanese' },
  ko: { zh: '韓文', en: 'Korean' },
  de: { zh: '德文', en: 'German' },
  fr: { zh: '法文', en: 'French' },
  es: { zh: '西班牙文', en: 'Spanish' },
  it: { zh: '義大利文', en: 'Italian' },
  pt: { zh: '葡萄牙文', en: 'Portuguese' },
  nl: { zh: '荷蘭文', en: 'Dutch' },
  pl: { zh: '波蘭文', en: 'Polish' },
  cs: { zh: '捷克文', en: 'Czech' },
  ru: { zh: '俄文', en: 'Russian' },
  uk: { zh: '烏克蘭文', en: 'Ukrainian' },
};

/** 維基百科條目的連結：資料檔存「en:Title」 */
export function wikiLink(value: unknown): PointTooltip['link'] {
  if (typeof value !== 'string') return undefined;
  const i = value.indexOf(':');
  if (i < 1) return undefined;
  const lang = value.slice(0, i);
  const title = value.slice(i + 1);
  const name = WIKI_LANGS[lang];
  return {
    href: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    label: name
      ? tr({ zh: `維基百科（${name.zh}）`, en: `Wikipedia (${name.en})` })
      : tr({ zh: `維基百科（${lang}）`, en: `Wikipedia (${lang})` }),
  };
}
