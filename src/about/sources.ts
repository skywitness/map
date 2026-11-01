import type { Text } from '../i18n/lang';

/** 關於頁的資料來源一覽的一筆（scripts/topic-catalog.mjs 產生 sources.gen.ts）：同一個網址的來源合併，列出用到的主題 */
export interface AboutSource {
  name: Text;
  url: string;
  /** 各主題寫的授權（同一個來源在不同主題寫法不同時都留著） */
  licenses: Text[];
  /** 用到的主題 id */
  topics: string[];
}

/** 授權的大類（關於頁的篩選）：一個來源寫了好幾種授權時可以屬於好幾類 */
export type LicenseKind = 'by' | 'by-sa' | 'odbl' | 'nc' | 'pd' | 'gov-tw' | 'facts' | 'other';

export const LICENSE_KINDS: { id: LicenseKind; label: Text; note?: Text }[] = [
  { id: 'by', label: { zh: 'CC BY 等（註明出處）', en: 'CC BY and similar (attribution)' } },
  {
    id: 'by-sa',
    label: { zh: 'CC BY-SA（相同方式分享）', en: 'CC BY-SA (share-alike)' },
    note: { zh: '用到這些資料的資料檔也用 CC BY-SA 分享。', en: 'Data files built from these are shared under CC BY-SA too.' },
  },
  {
    id: 'odbl',
    label: { zh: 'ODbL（相同方式分享）', en: 'ODbL (share-alike)' },
    note: { zh: '用到這些資料的資料檔也用 ODbL 分享。', en: 'Data files built from these are shared under the ODbL too.' },
  },
  {
    id: 'nc',
    label: { zh: '只准非商業使用', en: 'Non-commercial only' },
    note: {
      zh: '這些資料只能用在非商業用途；資料檔與匯出的圖片也一樣，有相同方式分享的照同一種授權。',
      en: 'These data may be used only for non-commercial purposes; the same applies to data files and exported images, under the same licence where it is share-alike.',
    },
  },
  { id: 'pd', label: { zh: '公有領域、CC0', en: 'Public domain, CC0' } },
  { id: 'gov-tw', label: { zh: '政府資料開放授權條款（台灣）', en: 'Taiwan Open Government Data Licence' } },
  { id: 'facts', label: { zh: '只引用事實', en: 'Facts only' } },
  { id: 'other', label: { zh: '機構自己的條款', en: 'Own terms of the organisation' } },
];

/** 一種授權寫法屬於哪一類（依中文寫法判斷，英文只有授權代碼，例如「CC BY 4.0」，中英文相同） */
export function licenseKind(license: Text): LicenseKind {
  const text = typeof license === 'string' ? license : license.zh;
  if (/NC|非商業/.test(text)) return 'nc';
  if (/ODbL/.test(text)) return 'odbl';
  if (/BY-SA/.test(text)) return 'by-sa';
  if (/政府資料開放授權條款|資料開放宣告/.test(text)) return 'gov-tw';
  if (/CC0|公有領域|美國政府|沒有使用限制|使用限制：無|不受著作權|不是著作權|沒有著作權|無著作權|公開資料/.test(text)) return 'pd';
  if (/CC BY|ODC-By|Etalab|Open Licence|PDL|公共資料利用規約/.test(text)) return 'by';
  if (/事實|自行整理|只引用|引用統計|史實|名次/.test(text)) return 'facts';
  return 'other';
}

/** 來源的所有授權類別（不重複，照 LICENSE_KINDS 的順序） */
export function sourceKinds(source: AboutSource): LicenseKind[] {
  const kinds = new Set(source.licenses.map(licenseKind));
  return LICENSE_KINDS.map((k) => k.id).filter((id) => kinds.has(id));
}
