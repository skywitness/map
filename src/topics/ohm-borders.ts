import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import { SINICA_SOURCE, sinicaLayer } from './sinica';
import type { LinesOverlayDef, ListPanelDef, ListRow, PointRecord } from './types';

/**
 * 帝國與疆界的擴充（2026-11-03，製作手冊第十七批 279、280）：
 * - 依日期的殖民地與帝國疆界（OpenHistoricalMap，pipeline/topics/ohm_borders.py）：殖民地、保護國、屬地與手冊點名的
 *   帝國（日本、俄羅斯、鄂圖曼、美國、清）1800 年以後的時段，畫在「殖民帝國」指標上，時間軸是那一年的 12 月 31 日。
 *   滑過看起訖日期與事件；左側欄列出那一年的疆界變動，或依政體列出全部時段。
 * - 日治的行政區界（中研院臺灣百年歷史地圖的圖磚，sinica.ts）：1901 年的廳、1930 年的州廳與郡市，時間軸在那個時期才畫。
 */

/** OHM 有標的殖民國（pipeline 的 _colonizer，跟殖民帝國指標的 COLONIZERS 同一組代碼；empires.ts 會引用這個檔，不從那裡拿以免循環） */
const COLONIZERS: { value: number; label: Text }[] = [
  { value: 1, label: { zh: '英國', en: 'Britain' } },
  { value: 2, label: { zh: '法國', en: 'France' } },
  { value: 3, label: { zh: '西班牙', en: 'Spain' } },
  { value: 4, label: { zh: '葡萄牙', en: 'Portugal' } },
  { value: 5, label: { zh: '荷蘭', en: 'Netherlands' } },
  { value: 6, label: { zh: '比利時、德國或義大利', en: 'Belgium, Germany or Italy' } },
  { value: 7, label: { zh: '日本', en: 'Japan' } },
];

const CLASS: Record<number, Text> = {
  1: { zh: '殖民地、保護國與屬地', en: 'Colonies, protectorates and dependencies' },
  2: { zh: '帝國的範圍（日本、俄羅斯、鄂圖曼、美國、清）', en: 'Empires (Japan, Russia, Ottoman, US, Qing)' },
};

const name = (p: PointRecord) => (getLang() !== 'en' && typeof p.z === 'string' && p.z ? p.z : String(p.e ?? ''));
const span = (p: PointRecord) => `${p.s ?? '?'} – ${typeof p.t === 'string' ? p.t : tr({ zh: '至今', en: 'present' })}`;

function facts(p: PointRecord): string[] {
  const out: string[] = [];
  const colonizer = COLONIZERS.find((c) => c.value === p.k);
  if (colonizer) out.push(tr({ zh: `殖民國：${tr(colonizer.label)}`, en: `Colonial power: ${tr(colonizer.label)}` }));
  if (typeof p.se === 'string') out.push(tr({ zh: `開始：${p.se}`, en: `Began: ${p.se}` }));
  if (typeof p.ee === 'string') out.push(tr({ zh: `結束：${p.ee}`, en: `Ended: ${p.ee}` }));
  if (p.fx) out.push(tr({ zh: 'OpenHistoricalMap 沒有，依史實補（範圍是台灣本島）', en: 'Not in OpenHistoricalMap; added from historical sources (Taiwan’s main island)' }));
  return out;
}

const OHM: LinesOverlayDef = {
  kind: 'lines',
  id: 'ohm-borders',
  file: 'ohm-borders.json',
  label: { zh: '依日期的殖民地與帝國疆界（OpenHistoricalMap，那一年年底）', en: 'Dated colonial and imperial borders (OpenHistoricalMap, at year end)' },
  width: 1.3,
  color: {
    title: { zh: '疆界', en: 'Borders' },
    classes: [
      { value: 1, color: MAP_TOKENS.categorical[5], label: CLASS[1] },
      { value: 2, color: MAP_TOKENS.ink, label: CLASS[2], dash: true },
    ],
  },
  timeField: 'a',
  endField: 'b',
  overlayTime: 'cumulative',
  groupField: 'r',
  hoverHalo: true,
  indicators: ['colonizer'],
  shareable: false,
  tooltip: (p) => ({
    title: name(p),
    detail: span(p),
    extra: facts(p),
    properNoun: getLang() !== 'en' && typeof p.z === 'string' && p.z && typeof p.e === 'string' ? p.e : undefined,
  }),
};

const year4 = (date: unknown) => (typeof date === 'string' ? Number(date.slice(0, date.startsWith('-') ? 5 : 4)) : NaN);

/** 左側欄：那一年開始或結束的時段（依日期），或依政體列出全部時段 */
const LIST: ListPanelDef = {
  label: { zh: '殖民地與帝國的疆界變動', en: 'Changes to colonial and imperial borders' },
  indicators: ['colonizer'],
  file: 'ohm-borders.json',
  lines: { groupField: 'r' },
  sorts: [
    { id: 'year', label: { zh: '這一年的變動', en: 'This year' } },
    { id: 'polity', label: { zh: '依政體', en: 'By polity' } },
  ],
  empty: { zh: '這一年沒有收錄的疆界變動', en: 'No border changes recorded this year' },
  rows: (records, { year, sort }) => {
    const row = (p: PointRecord, title: string, lines: string[], group?: string): ListRow => ({
      key: `${p.r}`,
      title,
      lines,
      target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
      line: { overlay: 'ohm-borders', group: Number(p.r) },
      // 點了換到這個範圍存在的第一年（不到一年的時段沒有年底，換到開始那一年）
      year: Number(p.a) < Number(p.b) ? Number(p.a) : year4(p.s),
      ...(group ? { group } : {}),
    });
    if (sort === 'polity') {
      return [...records]
        .sort((a, b) => name(a).localeCompare(name(b)) || String(a.s).localeCompare(String(b.s)))
        .map((p) => row(p, span(p), facts(p).slice(0, 2), name(p)));
    }
    const out: { date: string; p: PointRecord; begins: boolean }[] = [];
    for (const p of records) {
      if (year4(p.s) === year) out.push({ date: String(p.s), p, begins: true });
      if (year4(p.t) === year) out.push({ date: String(p.t), p, begins: false });
    }
    return out
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ date, p, begins }) =>
        row(
          p,
          name(p),
          [
            begins ? tr({ zh: `${date} 起`, en: `From ${date}` }) : tr({ zh: `到 ${date}`, en: `Until ${date}` }),
            ...(begins ? (typeof p.se === 'string' ? [p.se] : []) : typeof p.ee === 'string' ? [p.ee] : []),
          ],
        ),
      );
  },
};

export const ohmBordersPart: TopicPart = {
  name: { zh: '依日期的疆界', en: 'Dated borders' },
  sources: [
    {
      name: {
        zh: 'OpenHistoricalMap 貢獻者（國家層級的疆界，1800 年以後的殖民地與帝國；簡化到約 3–8 公里，台灣民主國依史實補）',
        en: 'OpenHistoricalMap contributors (country-level boundaries: colonies and empires after 1800; simplified to about 3–8 km, Republic of Formosa added from historical sources)',
      },
      url: 'https://www.openhistoricalmap.org/copyright',
      license: 'CC0 1.0',
    },
    SINICA_SOURCE,
  ],
  note: {
    zh:
      '「殖民帝國」指標上另外畫 OpenHistoricalMap（OHM，CC0）依日期的疆界：殖民地、保護國與屬地（OHM 標了 colony_of 等，或名稱看得出是殖民地的），加上 COLDAT 沒有收的日本、俄羅斯、鄂圖曼、美國與清的帝國範圍（虛線），1800 年以後、到那一年 12 月 31 日還在的時段；不到一年、沒有跨過年底的時段只在左側欄。' +
      'OHM 是志願者依各種歷史地圖畫的，範圍與日期是一種說法，也有漏（例如清朝 1895–1898 年沒有時段）；很多殖民地沒有標殖民國，只寫在有標的 tooltip。1800 年以後的台灣：清到 1895-04-17、大日本帝國 1895-05-08 到 1945-10-25 跟史實一致；OHM 沒有台灣民主國（1895-05-25 到 1895-10-21），依史實補在左側欄。' +
      '日治的行政區界（1901 年的廳、1930 年的州廳與郡市）是中研院臺灣百年歷史地圖的圖磚（CC BY-NC），放大到台灣、時間軸在那個時期才畫。',
    en:
      'The “Colonial rule” indicator also draws dated borders from OpenHistoricalMap (OHM, CC0): colonies, protectorates and dependencies (tagged colony_of and the like in OHM, or recognisable as colonies by name), plus the empires COLDAT leaves out (Japan, Russia, the Ottoman Empire, the US and Qing, dashed), for periods after 1800 that still existed on 31 December of the selected year; periods that never spanned a year end are listed on the left only. ' +
      'OHM is drawn by volunteers from many historical maps, so its extents and dates are one account and have gaps (Qing has no period for 1895–1898, for example); many colonies carry no colonial power, which the tooltip gives only where tagged. Taiwan after 1800: Qing until 1895-04-17 and the Empire of Japan from 1895-05-08 to 1945-10-25 match the historical record; OHM lacks the Republic of Formosa (1895-05-25 to 1895-10-21), which is added in the list from historical sources. ' +
      'Japanese-era administrative boundaries (the 1901 prefectures and the 1930 prefectures and districts) are tiles from Academia Sinica’s Taiwan History and Culture in Maps (CC BY-NC), drawn when zoomed in on Taiwan with the time slider in that period.',
  },
  overlays: [
    OHM,
    sinicaLayer('sinica-admin-1901', 'Admin_1901a', 'png', { zh: '日治行政區界：1901 年的廳（中研院）', en: 'Japanese-era boundaries: 1901 prefectures (Academia Sinica)' }, {
      maxzoom: 14,
      minzoom: 5,
      years: [1901, 1919],
      hidden: false,
      opacity: 1,
      indicators: ['colonizer', 'polities'],
      note: { zh: '時間軸在 1901–1919 年、放大到台灣才畫', en: 'Drawn for 1901–1919 when zoomed in on Taiwan' },
    }),
    sinicaLayer('sinica-admin-1930', 'Admin_1930a', 'png', { zh: '日治行政區界：1930 年的州廳（中研院）', en: 'Japanese-era boundaries: 1930 prefectures (Academia Sinica)' }, {
      maxzoom: 14,
      minzoom: 5,
      years: [1920, 1945],
      hidden: false,
      opacity: 1,
      indicators: ['colonizer', 'polities'],
      note: { zh: '時間軸在 1920–1945 年、放大到台灣才畫', en: 'Drawn for 1920–1945 when zoomed in on Taiwan' },
    }),
    sinicaLayer('sinica-admin-1930b', 'Admin_1930b', 'png', { zh: '日治行政區界：1930 年的郡市（中研院，預設關閉）', en: 'Japanese-era boundaries: 1930 districts (Academia Sinica, off by default)' }, {
      maxzoom: 14,
      minzoom: 5,
      years: [1920, 1945],
      opacity: 1,
      indicators: ['colonizer', 'polities'],
    }),
  ],
  indicators: [],
  listPanel: [LIST],
};
