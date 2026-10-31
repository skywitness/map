import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 核廢料的最終處置場（2026-10-31，製作手冊第十批 166；pipeline/topics/nuclear_waste.py）：英文維基「Deep geological repository」
 * 的處置場表，狀態逐一對照條目內文與官方消息（使用者決定，寫明日期）。使用者決定獨立成主題，左邊的清單依狀態分組、組內依年份。
 */

/** 狀態（pipeline 的 status）：已關閉是用過之後封閉的，取消是沒有蓋成的 */
const STATUS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '運轉中', en: 'In operation' }, color: MAP_TOKENS.categorical[3] },
  { value: 2, label: { zh: '興建中', en: 'Under construction' }, color: MAP_TOKENS.categorical[1] },
  { value: 3, label: { zh: '選址中、申請許可中', en: 'Siting or licensing' }, color: MAP_TOKENS.categorical[2] },
  { value: 4, label: { zh: '已關閉', en: 'Closed' }, color: MAP_TOKENS.inkMuted },
  { value: 5, label: { zh: '取消', en: 'Cancelled' }, color: MAP_TOKENS.categorical[7] },
];
const statusLabel = (v: unknown) => tr(STATUS.find((s) => s.value === v)?.label ?? '');

const WASTE: Record<number, Text> = {
  1: { zh: '低中放射性廢棄物', en: 'Low- and intermediate-level waste' },
  2: { zh: '高放射性廢棄物', en: 'High-level waste' },
  3: { zh: '用過核子燃料', en: 'Spent fuel' },
  4: { zh: '超鈾廢棄物', en: 'Transuranic waste' },
};

const STATUS_COLORS: ColorClasses = {
  field: 'st',
  title: { zh: '狀態', en: 'Status' },
  thresholds: [1.5, 2.5, 3.5, 4.5],
  classes: STATUS.map((s) => ({ color: s.color, label: s.label })),
};

const zhOrEn = (p: PointRecord, zh: string, en: string) => {
  const v = getLang() === 'zh' ? p[zh] : p[en];
  return typeof v === 'string' && v ? v : null;
};
const siteName = (p: PointRecord) => zhOrEn(p, 'zh', 'en') ?? '';

function siteLines(p: PointRecord, countryName: (iso3: string) => string): string[] {
  const where = [typeof p.iso3 === 'string' ? countryName(p.iso3) : null, zhOrEn(p, 'pz', 'pe')].filter(Boolean).join(' · ');
  const rock = [zhOrEn(p, 'gz', 'ge'), typeof p.d === 'string' ? tr({ zh: `深 ${p.d}`, en: `${p.d} deep` }) : null]
    .filter(Boolean)
    .join(tr({ zh: '，', en: ', ' }));
  return [where, typeof p.w === 'number' ? tr(WASTE[p.w]) : '', rock].filter(Boolean);
}

/**
 * 左邊的清單（使用者 2026-10-30 決定）：依狀態分組（運轉中、興建中、選址中、已關閉、取消），組內依年份；
 * 每組第一列的標籤寫狀態與數量。表格沒寫地點的（中國、日本等）點了框住那個國家
 */
const LIST: ListPanelDef = {
  label: { zh: '處置場', en: 'Repositories' },
  file: 'list.json',
  rows: (points, { countryName }) => {
    const sorted = [...points].sort(
      (a, b) =>
        (a.st as number) - (b.st as number) ||
        ((a.y as number | null) ?? 9999) - ((b.y as number | null) ?? 9999) ||
        String(a.en).localeCompare(String(b.en)),
    );
    const groupSize = (st: unknown) => points.filter((p) => p.st === st).length;
    return sorted.map((p, i): ListRow => {
      const first = i === 0 || sorted[i - 1].st !== p.st;
      const box = typeof p.box === 'string' ? (p.box.split(',').map(Number) as [number, number, number, number]) : null;
      return {
        key: `${p.iso3}-${p.en}-${i}`,
        title: siteName(p),
        lines: [
          [statusLabel(p.st), typeof p.y === 'number' ? String(p.y) : null].filter(Boolean).join(' · '),
          ...siteLines(p, countryName),
        ],
        muted: p.st === 4 || p.st === 5,
        badge: first ? tr({ zh: `${statusLabel(p.st)} ${groupSize(p.st)}`, en: `${statusLabel(p.st)} (${groupSize(p.st)})` }) : undefined,
        target: box ? { box } : { lon: p.lon as number, lat: p.lat as number, zoom: 8 },
      };
    });
  },
};

export const nuclearWaste: TopicDefinition = {
  id: 'nuclear-waste',
  title: { zh: '核廢料的最終處置場', en: 'Nuclear waste repositories' },
  shortTitle: { zh: '核廢料處置場', en: 'Waste repositories' },
  defaultIndicator: 'map',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「Deep geological repository」的處置場表（revid 1381499099），狀態對照相關條目與官方消息（2026-10-31）',
        en: 'English Wikipedia, “Deep geological repository”, table of repository sites (revision 1381499099), statuses checked against linked articles and official sources (31 Oct 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1381499099',
      license: 'CC BY-SA 4.0',
    },
    { name: { zh: 'Wikidata（位置）', en: 'Wikidata (locations)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: {
        zh: '核能安全委員會：核能電廠用過核子燃料貯存數量、低放射性廢棄物貯存現況（台灣附註）',
        en: 'Nuclear Safety Commission: spent fuel and low-level waste in storage at nuclear plants (Taiwan note)',
      },
      url: 'https://data.gov.tw/dataset/119186',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '收英文維基處置場表的 22 個處置場或國家計畫：深層地質處置場，以及放在地下的低中放射性廢棄物處置場；放在地表的低放處置場（法國奧布、西班牙 El Cabril、日本六所村等）與中期貯存設施不收。表格的狀態有的過時（瑞典的用過燃料處置場還寫 2011 年申請），逐一對照條目內文、相關條目與官方網站，寫明日期與出處（滑過點或看左邊的清單）。中國、日本、南韓的高放處置場、瑞士、英國還沒有選定地點，只在左邊的清單。位置用 Wikidata 的座標，處置場本身沒有座標的用所在的電廠或城鎮（寫「位置是大約的」）。台灣沒有最終處置場，用過核子燃料與低放射性廢棄物都是貯存，見台灣的附註。',
    en: 'The 22 repositories or national programmes in English Wikipedia’s table of repository sites: deep geological repositories and underground repositories for low- and intermediate-level waste. Near-surface low-level repositories (France’s Aube, Spain’s El Cabril, Japan’s Rokkasho and others) and interim storage are not included. Some statuses in the table are out of date (Sweden’s spent fuel repository is still listed as a 2011 application), so each was checked against the article text, linked articles and official websites, with the date and source given (hover over a site or see the list on the left). China, Japan and South Korea’s high-level repositories, Switzerland and the UK have no chosen site yet and appear only in the list. Locations are Wikidata coordinates, or those of the nearby plant or town where the repository itself has none (marked as approximate). Taiwan has no final repository; its spent fuel and low-level waste are in storage, as described in Taiwan’s note.',
  },
  noValue: { TWN: { zh: '沒有最終處置場（見附註）', en: 'No final repository (see note)' } },
  listPanel: LIST,
  overlays: [
    {
      kind: 'points',
      id: 'repositories',
      file: 'points.json',
      label: { zh: '核廢料處置場', en: 'Nuclear waste repositories' },
      radius: 6,
      color: STATUS_COLORS,
      tooltip: (p, ctx) => ({
        title: siteName(p),
        detail: [statusLabel(p.st), typeof p.y === 'number' ? String(p.y) : null].filter(Boolean).join(' · '),
        extra: [
          ...siteLines(p, ctx.countryName),
          zhOrEn(p, 'sz', 'se') ?? '',
          p.ap === 1 ? tr({ zh: '位置是大約的（所在的電廠或城鎮）', en: 'Location is approximate (nearby plant or town)' }) : '',
        ].filter(Boolean),
        properNoun: getLang() === 'zh' && typeof p.en === 'string' ? p.en : undefined,
      }),
    },
  ],
  indicators: [
    {
      id: 'map',
      label: { zh: '處置場地圖', en: 'Repository map' },
      description: {
        zh: '世界的核廢料最終處置場，顏色是狀態。運轉中的 5 座都是低中放射性或超鈾廢棄物：芬蘭奧爾基洛托（1992）、洛維薩（1998）、瑞典 SFR（1988）、南韓月城（2015）、美國 WIPP（1999）。用過核子燃料的處置場還沒有一座正式運轉：芬蘭昂卡洛 2026 年 8 月開始鑽處置孔、運轉執照還在審查，瑞典福什馬克 2025 年動工；法國 Cigéo 2023 年申請許可，加拿大 2024 年選定伊格納斯。德國阿瑟二號、莫斯萊本已關閉，美國猶卡山 2010 年取消。台灣沒有最終處置場。',
        en: 'The world’s final repositories for nuclear waste, coloured by status. The five in operation all take low- and intermediate-level or transuranic waste: Finland’s Olkiluoto (1992) and Loviisa (1998), Sweden’s SFR (1988), South Korea’s Wolseong (2015) and the US WIPP (1999). No spent fuel repository is in full operation yet: Finland’s Onkalo began drilling disposal holes in August 2026 while its operating licence is under review, and Sweden’s Forsmark broke ground in 2025; France’s Cigéo applied for a licence in 2023 and Canada chose Ignace in 2024. Germany’s Asse II and Morsleben are closed, and the US Yucca Mountain project was cancelled in 2010. Taiwan has no final repository.',
      },
      unit: { zh: '處', en: 'sites' },
      file: 'map.json',
      layer: { kind: 'none' },
      integer: true,
      timeless: true,
      format: (v) => tr({ zh: `${v} 處（含計畫）`, en: v === 1 ? '1 site or programme' : `${v} sites or programmes` }),
      missing: { zh: '英文維基的表格沒有這個國家', en: 'Not in the English Wikipedia table' },
    },
  ],
};
