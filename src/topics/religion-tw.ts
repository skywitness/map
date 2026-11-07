import { getLang, tr, type Text } from '../i18n/lang';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 宗教的台灣層：內政部登記的寺廟與法人教會（2026-11-07，製作手冊第二十七批 557；pipeline/topics/temples_tw.py）。
 * 點依主祀神祇分 8 類（g 1–8，關鍵字歸類）、法人教會是 9；側欄的縣市統計在 panels/ReligionPanel.tsx。
 */

const C = MAP_TOKENS.categorical;
/** 跟 pipeline/topics/temples_tw.py 的 NAMES 一致；其他神明用中性灰 */
export const TW_GROUPS: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '媽祖', en: 'Mazu' }, color: C[7] },
  { value: 2, label: { zh: '土地公', en: 'Tudigong (earth god)' }, color: C[5] },
  { value: 3, label: { zh: '王爺', en: 'Wangye (royal lords)' }, color: C[1] },
  { value: 4, label: { zh: '玄天上帝', en: 'Xuantian Shangdi' }, color: C[6] },
  { value: 5, label: { zh: '關聖帝君', en: 'Guan Yu' }, color: C[4] },
  { value: 6, label: { zh: '觀音', en: 'Guanyin' }, color: C[2] },
  { value: 7, label: { zh: '佛與菩薩（不含觀音）', en: 'Buddhas and bodhisattvas (not Guanyin)' }, color: C[3] },
  { value: 8, label: { zh: '其他神明', en: 'Other deities' }, color: MAP_TOKENS.context },
  { value: 9, label: { zh: '法人教會', en: 'Incorporated churches' }, color: C[0] },
];
export const twGroupLabel = (g: unknown) => tr(TW_GROUPS.find((x) => x.value === g)?.label ?? '');

const TAIWAN: [number, number, number, number] = [119.3, 21.8, 122.1, 25.4];

/** 內政部資料的縣市（行政區欄）→ 英文名稱 */
export const COUNTY_EN: Record<string, string> = {
  臺北市: 'Taipei City', // i18n-ignore（資料的鍵）
  新北市: 'New Taipei City', // i18n-ignore
  桃園市: 'Taoyuan City', // i18n-ignore
  臺中市: 'Taichung City', // i18n-ignore
  臺南市: 'Tainan City', // i18n-ignore
  高雄市: 'Kaohsiung City', // i18n-ignore
  基隆市: 'Keelung City', // i18n-ignore
  新竹市: 'Hsinchu City', // i18n-ignore
  嘉義市: 'Chiayi City', // i18n-ignore
  新竹縣: 'Hsinchu County', // i18n-ignore
  苗栗縣: 'Miaoli County', // i18n-ignore
  彰化縣: 'Changhua County', // i18n-ignore
  南投縣: 'Nantou County', // i18n-ignore
  雲林縣: 'Yunlin County', // i18n-ignore
  嘉義縣: 'Chiayi County', // i18n-ignore
  屏東縣: 'Pingtung County', // i18n-ignore
  宜蘭縣: 'Yilan County', // i18n-ignore
  花蓮縣: 'Hualien County', // i18n-ignore
  臺東縣: 'Taitung County', // i18n-ignore
  澎湖縣: 'Penghu County', // i18n-ignore
  金門縣: 'Kinmen County', // i18n-ignore
  連江縣: 'Lienchiang County', // i18n-ignore
};
/** 縣市的名稱：中文介面照原文，英文介面用英文名稱 */
export const countyName = (c: string) => (getLang() === 'zh' ? c : (COUNTY_EN[c] ?? c));
const str = (v: unknown) => (typeof v === 'string' && v ? v : '');

function facts(p: PointRecord): string[] {
  // 英文介面只寫縣市的英文名稱（鄉鎮市區沒有對照表）
  const place = getLang() === 'zh' ? `${str(p.c)}${str(p.a)}` : countyName(str(p.c));
  if (p.g === 9) return [twGroupLabel(9), place].filter(Boolean);
  return [
    [str(p.d) || tr({ zh: '（沒有填主祀神祇）', en: '(main deity not given)' }), str(p.r)].filter(Boolean).join(' · '),
    place,
  ].filter(Boolean);
}

const NOTE: Text = {
  zh: '內政部全國宗教資訊系統的登記寺廟（12,427 座）與財團法人教會（1,036 個），2026 年 11 月的快照（政府資料開放授權條款）。只有向政府登記的：沒有登記的神壇、私人宮廟，以及沒有立案成財團法人的教會、堂會都不在裡面（內政部統計 2025 年底登記的教會〔堂〕有 2,855 所）。主祀神祇是自由填寫的文字（1,950 種寫法），依關鍵字歸成 8 類，同時寫好幾尊神的算第一個對上的。505 座寺廟、107 個教會沒有座標，不畫點，但算進縣市的數目。',
  en: 'Temples registered in the Ministry of the Interior’s national religion information system (12,427) and incorporated churches (1,036), as of November 2026 (Open Government Data License). Only registered places are included: unregistered shrines and private temples, and churches not incorporated as foundations, are left out (the ministry counted 2,855 registered churches at the end of 2025). The main deity is free text (1,950 spellings), grouped by keyword into 8 groups; when several deities are listed, the first match counts. 505 temples and 107 churches have no coordinates and are not drawn, but are counted in county totals.',
};

export const TW_TEMPLES: PointsOverlayDef = {
  kind: 'points',
  id: 'tw-temples',
  file: 'tw-temples.json',
  label: { zh: '台灣的寺廟與法人教會（內政部）', en: 'Temples and incorporated churches in Taiwan (Ministry of the Interior)' },
  indicators: ['tw-temples'],
  radius: 2.6,
  color: {
    field: 'g',
    title: { zh: '主祀神祇', en: 'Main deity' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5],
    classes: TW_GROUPS.map(({ label, color }) => ({ label, color })),
  },
  tooltip: (p) => ({ title: str(p.n), extra: facts(p), properNoun: str(p.n) || undefined }),
};

export const TW_TEMPLE_LIST: ListPanelDef = {
  label: { zh: '台灣的寺廟與法人教會', en: 'Temples and churches in Taiwan' },
  indicators: ['tw-temples'],
  file: 'tw-temples.json',
  rows: (points) =>
    [...points]
      .sort((a, b) => `${str(a.c)}${str(a.a)}${str(a.n)}`.localeCompare(`${str(b.c)}${str(b.a)}${str(b.n)}`, 'zh-Hant'))
      .map((p, i): ListRow => ({
        key: `tw-${i}`,
        title: str(p.n),
        lines: facts(p),
        properNoun: str(p.n) || undefined,
        target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 16 },
      })),
};

export const TW_TEMPLES_INDICATOR: IndicatorDef = {
  id: 'tw-temples',
  label: { zh: '台灣的寺廟與教會（主祀神祇）', en: 'Taiwan’s temples and churches (main deity)' },
  description: {
    zh: `${tr(NOTE, 'zh')}依主祀神祇：佛與菩薩 1,626 座、王爺 1,563、土地公 1,404、媽祖 1,045、觀音 1,035、玄天上帝 778、關聖帝君 533，其他神明 4,443（保生大帝、三山國王、中壇元帥、清水祖師等）；寫得最多的是福德正神 1,262 座、釋迦牟尼佛 976、天上聖母 910。臺南市 1,671 座、高雄市 1,505、屏東縣 1,146 最多；每十萬人連江縣 492、澎湖縣 180、嘉義縣 151 最多，臺北市 11.5、桃園市 13.5 最少。王爺廟在金門（24%）、澎湖（22%）、雲林（19%）比例最高，土地公在基隆（34%）、新竹市（30%）；法人教會臺北市 234 個、新北市 146 個最多。點選台灣看各縣市的統計，左邊的清單可以搜尋廟名、神明或鄉鎮。`,
    en: `${tr(NOTE, 'en')} By main deity: Buddhas and bodhisattvas 1,626, Wangye 1,563, Tudigong 1,404, Mazu 1,045, Guanyin 1,035, Xuantian Shangdi 778 and Guan Yu 533, with 4,443 for other deities (Baosheng Dadi, the Three Mountain Kings, Nezha, Qingshui Zushi and more); the most common entries are Fude Zhengshen (Tudigong, 1,262), Shakyamuni Buddha (976) and Tianshang Shengmu (Mazu, 910). Tainan has the most temples (1,671), followed by Kaohsiung (1,505) and Pingtung (1,146); per 100,000 people Lienchiang (492), Penghu (180) and Chiayi County (151) have the most and Taipei (11.5) and Taoyuan (13.5) the fewest. Wangye temples are most common in Kinmen (24%), Penghu (22%) and Yunlin (19%), and Tudigong temples in Keelung (34%) and Hsinchu City (30%); Taipei (234) and New Taipei (146) have the most incorporated churches. Select Taiwan for county figures; the list on the left can be searched by temple, deity or township.`,
  },
  unit: '',
  file: 'tw-temples-ind.json',
  layer: { kind: 'none' },
  focus: TAIWAN,
  timeless: true,
  unranked: true,
  rankingBars: false,
  panelChart: false,
  format: () => '',
  missing: { zh: '只有台灣：內政部的登記寺廟與法人教會', en: 'Taiwan only: temples and incorporated churches registered with the Ministry of the Interior' },
};
