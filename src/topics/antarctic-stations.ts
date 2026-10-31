import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { ColorClasses, ListPanelDef, ListRow, PointRecord, TopicDefinition } from './types';

/**
 * 南極研究站（pipeline/topics/antarctic_stations.py）：Wikidata 收錄的南極研究站的點，與各國經營、運作中的站數。
 * 使用者 2026-10-29 決定 Wikidata 為主、COMNAP 只拿來核對：Wikidata 常沒標關閉，所以沒標關閉的再跟 COMNAP 2024 年的名單
 * 核對位置，對到的才算運作中（只用對不對得到，不轉載 COMNAP 的內容）。
 */

/** COMNAP 2024 年 11 月版的總數（只引用總數，說明涵蓋率） */
export const COMNAP_TOTAL = 114;
export const COMNAP_MATCHED = 101;

export const STATUSES: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: '運作中', en: 'Operating' }, color: MAP_TOKENS.categorical[0] },
  { value: 2, label: { zh: '已關閉', en: 'Closed' }, color: MAP_TOKENS.categorical[6] },
  { value: 3, label: { zh: '不在 COMNAP 名單（多半已關閉或是營地）', en: 'Not on the COMNAP list (mostly closed, or camps)' }, color: MAP_TOKENS.categorical[2] },
];

const STATUS_COLORS: ColorClasses = {
  field: 's',
  title: { zh: '狀態', en: 'Status' },
  thresholds: [2, 3],
  classes: STATUSES.map((s) => ({ color: s.color, label: s.label })),
};

export const statusLabel = (s: unknown) => tr(STATUSES.find((x) => x.value === s)?.label ?? '');

export function stationName(p: PointRecord, lang = getLang()): string {
  if (lang === 'zh' && typeof p.zh === 'string') return p.zh;
  return String(p.en ?? p.zh ?? '');
}

/** 成立、關閉年份與海拔 */
export function stationFacts(p: PointRecord): string {
  const parts: string[] = [];
  if (typeof p.y === 'number') parts.push(tr({ zh: `${p.y} 年成立`, en: `established ${p.y}` }));
  if (typeof p.e === 'number') parts.push(tr({ zh: `${p.e} 年關閉`, en: `closed ${p.e}` }));
  if (typeof p.h === 'number') parts.push(tr({ zh: `海拔 ${fixed(p.h, 0)} m`, en: `${fixed(p.h, 0)} m above sea level` }));
  return parts.join(' · ');
}

const stationsText = (v: number) => tr({ zh: `${fixed(v, 0)} 處`, en: `${fixed(v, 0)} ${v === 1 ? 'station' : 'stations'}` });

/**
 * 研究站清單（第十二批 208）：依經營國分組（國名依語言排，兩國合營的兩國都列），組內運作中的在前、再依成立年份；
 * 每列：名稱、狀態、成立與關閉年份、海拔。Wikidata 與這份資料沒有常年站、夏季站的區分，所以不分開
 */
const STATION_LIST: ListPanelDef = {
  label: { zh: '南極研究站', en: 'Antarctic research stations' },
  indicators: ['operating'],
  file: 'stations.json',
  countryField: 'iso3',
  rows: (points, { countryName, country }) => {
    const collator = new Intl.Collator(getLang() === 'zh' ? 'zh-Hant-TW' : 'en');
    // 兩國合營的站在兩國各列一次（選了國家時只列那一國那一組）
    const entries = points.flatMap((p) =>
      [p.iso3, p.iso3b]
        .filter((c): c is string => typeof c === 'string' && (!country || c === country))
        .map((c) => ({ p, c, name: countryName(c) })),
    );
    return entries
      .sort((a, b) => collator.compare(a.name, b.name) || (a.p.s === 1 ? 0 : 1) - (b.p.s === 1 ? 0 : 1) || Number(a.p.y ?? 9999) - Number(b.p.y ?? 9999))
      .map(({ p, c, name }, i): ListRow => {
        const title = stationName(p);
        return {
          key: `${c}-${p.en ?? p.zh}-${i}`,
          title,
          properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== title ? p.en : undefined,
          lines: [statusLabel(p.s), stationFacts(p)].filter(Boolean),
          muted: p.s !== 1,
          group: name,
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 8 },
        };
      });
  },
};

/** 南極主題（antarctica.ts）的研究站部分：2026-10-30 起跟企鵝、冰下湖合成一個主題 */
export const stationsPart = {
  sources: [
    { name: { zh: 'Wikidata（研究站的位置、經營者、成立與關閉年份、海拔、名稱）', en: 'Wikidata (locations, operators, opening and closing years, elevations, names)' }, url: 'https://www.wikidata.org/', license: 'CC0' },
    {
      name: { zh: 'COMNAP Antarctic Facilities（2024 年 11 月版，只用來核對哪些站還在運作）', en: 'COMNAP Antarctic Facilities (November 2024, used only to check which stations still operate)' },
      url: 'https://www.comnap.aq/antarctic-facilities-information',
      license: { zh: '只引用核對結果與總數', en: 'check results and totals cited only' },
    },
  ],
  note: {
    zh:
      `點是 Wikidata 收錄、南緯 50 度以南的南極研究站（含南喬治亞、布韋島這類亞南極島嶼）。經營國依 Wikidata 的經營者（兩國合營的兩國都算，例如法國與義大利的康宏站），沒寫的用項目的國家或說明文字；蘇聯的站算俄羅斯。` +
      `Wikidata 常沒標關閉，所以沒標關閉的再跟 COMNAP（國家南極計畫管理者理事會）2024 年 11 月的設施名單核對位置：名單上 ${COMNAP_TOTAL} 處設施各自對到 15 公里內最近的一站，對到的 ${COMNAP_MATCHED} 處算「運作中」，其他的是「不在 COMNAP 名單」，多半是已關閉的歷史站（例如阿蒙森的 Framheim）或臨時營地。國家的值只算運作中的站。` +
      `COMNAP 的資料只能用於教育與非商業用途，這裡只用核對的結果，不轉載它的內容。台灣不是《南極條約》的締約方，沒有南極研究站。`,
    en:
      `Dots are the Antarctic research stations in Wikidata south of 50°S, including sub-Antarctic islands such as South Georgia and Bouvet Island. The operating country comes from Wikidata’s operator (both countries count for joint stations such as French–Italian Concordia), otherwise from the item’s country or description; Soviet stations count for Russia. ` +
      `Wikidata often lacks closing dates, so stations without one were checked by position against COMNAP’s (Council of Managers of National Antarctic Programs) facilities list of November 2024: each of its ${COMNAP_TOTAL} facilities was matched to the nearest station within 15 km, and the ${COMNAP_MATCHED} matched stations count as operating; the rest are “not on the COMNAP list”, mostly closed historic bases (such as Amundsen’s Framheim) or temporary camps. Country values count operating stations only. ` +
      `COMNAP’s data may be used for educational and non-commercial purposes only; only the check results are used here, not its contents. Taiwan is not a party to the Antarctic Treaty and has no Antarctic station.`,
  },
  overlays: [
    {
      kind: 'points',
      id: 'stations',
      file: 'stations.json',
      label: { zh: '研究站', en: 'Research stations' },
      indicators: ['operating'],
      radius: { field: 'sl', stops: [[0, 2.6], [10, 3.4], [30, 4.6], [55, 6]] },
      color: STATUS_COLORS,
      sortField: 'sl',
      tooltip: (p, ctx) => {
        const countries = [p.iso3, p.iso3b].filter((x): x is string => typeof x === 'string').map(ctx.countryName);
        const name = stationName(p);
        return {
          title: name,
          detail: [statusLabel(p.s), countries.length ? tr({ zh: `${countries.join('、')}經營`, en: `run by ${countries.join(' and ')}` }) : null]
            .filter(Boolean)
            .join(' · '),
          extra: [stationFacts(p)].filter(Boolean),
          properNoun: getLang() === 'zh' && typeof p.en === 'string' && p.en !== name ? p.en : undefined,
        };
      },
    },
  ],
  indicators: [
    {
      id: 'operating',
      label: { zh: '運作中的研究站', en: 'Operating stations' },
      description: {
        zh: `各國在南極經營、還在運作的研究站數（含夏季站與營地，兩國合營的兩國都算），依 Wikidata 並跟 COMNAP 2024 年的名單核對。阿根廷、俄羅斯、智利最多；點是每一個研究站，滑過看成立年份與海拔，紫色是已關閉的、橘黃色是 COMNAP 名單上沒有的；左邊的清單依國家列出每一站。`,
        en: `Antarctic research stations each country runs that are still operating (including summer stations and camps; joint stations count for both countries), from Wikidata checked against COMNAP’s 2024 list. Argentina, Russia and Chile run the most; dots mark each station – hover for the year it opened and its elevation; purple ones are closed and amber ones are not on the COMNAP list. The list on the left groups every station by country.`,
      },
      unit: { zh: '處', en: 'stations' },
      file: 'operating.json',
      noValue: { TWN: { zh: '沒有南極研究站（不是《南極條約》的締約方）', en: 'No Antarctic station (not a party to the Antarctic Treaty)' } },
      layer: { kind: 'bubble', legendValues: [1, 5, 10] },
      format: stationsText,
      formatTick: (v) => fixed(v, 0),
      integer: true,
      panelChart: false,
      shareOfWorld: true,
    },
  ],
  listPanel: STATION_LIST,
} satisfies Partial<TopicDefinition>;
