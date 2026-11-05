import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { LinesOverlayDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef } from './types';

/**
 * 城市的低排放區與塞車費（2026-11-05，製作手冊第二十三批 410；pipeline/topics/city_traffic.py）：
 * OpenStreetMap 上畫成面的低排放區（boundary=low_emission_zone，線圖層的封閉環加半透明的面），各國的個數上色；
 * 英文維基百科整理的塞車費城市畫成點（依種類上色）。兩件事分圖層、分顏色，不併成一個數字。
 */

const LEZ_FILE = 'low-emission-zones-map.json';
const CHARGE_FILE = 'congestion-charges.json';

const TEXT = {
  unnamed: { zh: '（OSM 上沒有名稱）', en: '(unnamed in OSM)' },
  since: (d: string) => tr({ zh: `開始：${d}`, en: `Started: ${d}` }),
  noDate: { zh: 'OSM 沒有寫開始日期', en: 'No start date in OSM' },
  area: (a: number) => tr({ zh: `約 ${fixed(a, a < 10 ? 1 : 0)} 平方公里`, en: `About ${fixed(a, a < 10 ? 1 : 0)} km²` }),
  year: (y: number) => tr({ zh: `${y} 年起`, en: `Since ${y}` }),
  noYear: { zh: '維基百科條目沒寫開始年份', en: 'Start year not given in the Wikipedia article' },
  join: (parts: string[]) => parts.join(tr({ zh: ' · ', en: ' · ' })),
};

const KINDS: { value: number; color: string; label: Text }[] = [
  // 國家的面量圖是橘色系，點避開橘、綠（低排放區的面）
  { value: 1, color: MAP_TOKENS.categorical[7], label: { zh: '進入市中心收費（塞車費、擁擠稅）', en: 'Charge to enter the centre (congestion charge or tax)' } },
  { value: 2, color: MAP_TOKENS.categorical[1], label: { zh: '收費環與市區收費道路', en: 'Toll rings and urban toll roads' } },
  { value: 3, color: MAP_TOKENS.categorical[2], label: { zh: '古城中心進城收費', en: 'Old-town entry charge' } },
];

/** 區名：中文介面用 OSM 的 name:zh、英文介面用 name:en，沒有的用當地的 name */
function zoneName(p: PointRecord): string {
  const own = typeof p.n === 'string' && p.n ? p.n : '';
  const local = getLang() === 'en' ? p.ne : p.nz;
  return (typeof local === 'string' && local) || own || tr(TEXT.unnamed);
}

function zoneProper(p: PointRecord): string | undefined {
  const own = typeof p.n === 'string' && p.n ? p.n : '';
  return own && own !== zoneName(p) ? own : undefined;
}

function zoneFacts(p: PointRecord): string[] {
  return [
    typeof p.d === 'string' && p.d ? TEXT.since(p.d) : tr(TEXT.noDate),
    typeof p.a === 'number' && p.a >= 0.05 ? TEXT.area(Number(p.a)) : null,
  ].filter((x): x is string => Boolean(x));
}

const LEZ: LinesOverlayDef = {
  kind: 'lines',
  id: 'low-emission-zones',
  file: LEZ_FILE,
  indicators: ['low-emission-zones'],
  label: { zh: '低排放區的範圍（OpenStreetMap）', en: 'Low-emission zone boundaries (OpenStreetMap)' },
  width: 1.2,
  color: {
    title: { zh: '範圍', en: 'Area' },
    classes: [{ value: 1, color: MAP_TOKENS.categorical[3], label: { zh: '低排放區', en: 'Low-emission zone' }, area: 'land' }],
  },
  fill: { field: 'f', value: 1, opacity: 0.25, darkOpacity: 0.3, holeField: 'h', outline: [1], hover: true },
  groupField: 'id',
  hoverHalo: true,
  shareable: false,
  tooltip: (p, { countryName }) => ({
    title: zoneName(p),
    detail: typeof p.iso3 === 'string' ? countryName(p.iso3) : '',
    extra: zoneFacts(p),
    properNoun: zoneProper(p),
  }),
};

function chargeLine(p: PointRecord): string {
  return typeof p.y === 'number' ? TEXT.year(Number(p.y)) : tr(TEXT.noYear);
}

const kindLabel = (p: PointRecord) => tr(KINDS.find((k) => k.value === p.k)?.label ?? '');
const chargeNote = (p: PointRecord) => String((getLang() === 'en' ? p.en : p.zh) ?? '');

const CHARGES: PointsOverlayDef = {
  kind: 'points',
  id: 'congestion-charges',
  file: CHARGE_FILE,
  indicators: ['low-emission-zones'],
  label: { zh: '收塞車費的城市（英文維基百科）', en: 'Cities with congestion charges (English Wikipedia)' },
  radius: 6,
  color: { field: 'k', title: { zh: '種類', en: 'Type' }, thresholds: [1.5, 2.5], classes: KINDS.map(({ color, label }) => ({ color, label })) },
  tooltip: (p, { countryName }) => ({
    title: String(p.n ?? ''),
    properNoun: String(p.n ?? ''),
    detail: TEXT.join([typeof p.iso3 === 'string' ? countryName(p.iso3) : '', kindLabel(p)].filter(Boolean)),
    extra: [chargeLine(p), chargeNote(p)].filter(Boolean),
  }),
};

const LEZ_LIST: ListPanelDef = {
  label: { zh: '低排放區', en: 'Low-emission zones' },
  indicators: ['low-emission-zones'],
  file: LEZ_FILE,
  lines: { groupField: 'id' },
  countryField: 'iso3',
  sorts: [
    { id: 'date', label: { zh: '依開始日期', en: 'By start date' } },
    { id: 'area', label: { zh: '依面積', en: 'By area' } },
  ],
  rows: (records, { countryName, sort }) =>
    [...records]
      .filter((p) => p.h !== 1)
      .sort((a, b) =>
        sort === 'area'
          ? Number(b.a) - Number(a.a)
          : // 有日期的從早到晚，沒寫日期的接在後面（依面積）
            Number(!a.d) - Number(!b.d) || String(a.d || '').localeCompare(String(b.d || '')) || Number(b.a) - Number(a.a),
      )
      .map(
        (p): ListRow => ({
          key: `lez-${p.id}`,
          title: zoneName(p),
          properNoun: zoneProper(p),
          lines: [TEXT.join([typeof p.iso3 === 'string' ? countryName(p.iso3) : '', ...zoneFacts(p)].filter(Boolean))],
          target: { box: [Number(p.bw), Number(p.bs), Number(p.be), Number(p.bn)] },
          line: { overlay: 'low-emission-zones', group: Number(p.id) },
        }),
      ),
};

const CHARGE_LIST: ListPanelDef = {
  label: { zh: '收塞車費的城市', en: 'Cities with congestion charges' },
  indicators: ['low-emission-zones'],
  file: CHARGE_FILE,
  countryField: 'iso3',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => (typeof a.y === 'number' ? Number(a.y) : 9999) - (typeof b.y === 'number' ? Number(b.y) : 9999) || String(a.n).localeCompare(String(b.n)))
      .map(
        (p): ListRow => ({
          key: `charge-${p.n}`,
          title: String(p.n ?? ''),
          titleProper: true,
          lines: [TEXT.join([typeof p.iso3 === 'string' ? countryName(p.iso3) : '', chargeLine(p)].filter(Boolean)), chargeNote(p)].filter(Boolean),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 10 },
        }),
      ),
};

const count = (v: number) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} zones` });

const TAIWAN = {
  zh: '台灣沒有低排放區，也沒有塞車費；對應的制度是空氣污染防制法第 40 條的空氣品質維護區。政府資料開放平台上只有桃園市的 3 區：桃園國際機場（2021-08-17 公告）、林口長庚紀念醫院與郵政物流、華亞科技園區（2022-07-15）、內壢（2023-10-19），全時段禁止 1999 年 6 月 30 日（內壢是 2006 年 9 月 30 日）以前出廠的柴油大客車、大貨車進入。',
  en: 'Taiwan has no low-emission zones and no congestion charges; the closest equivalent is the air quality maintenance zone under Article 40 of the Air Pollution Control Act. The open-data portal lists only Taoyuan’s three: Taoyuan International Airport (announced 17 Aug 2021), Linkou Chang Gung Memorial Hospital with the postal logistics and Hwa Ya technology parks (15 Jul 2022) and Neili (19 Oct 2023), each closed at all times to diesel buses and lorries made before 30 June 1999 (30 Sep 2006 in Neili).',
};

export const cityTrafficPart: TopicPart = {
  name: { zh: '低排放區與塞車費', en: 'Low-emission zones and congestion charges' },
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者：boundary=low_emission_zone（經 QLever 查詢，2026-11-05）', en: 'OpenStreetMap contributors: boundary=low_emission_zone (queried through QLever, 5 Nov 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: 'ODbL 1.0',
    },
    {
      name: { zh: '英文維基百科「Congestion pricing」（2026-10-14 的版本）', en: 'English Wikipedia, “Congestion pricing” (revision of 14 Oct 2026)' },
      url: 'https://en.wikipedia.org/wiki/Congestion_pricing?oldid=1380197393',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: '桃園市政府環境保護局：桃園市空氣品質維護區（政府資料開放平台 149351）', en: 'Taoyuan Environmental Protection Bureau: air quality maintenance zones (data.gov.tw 149351)' },
      url: 'https://data.gov.tw/dataset/149351',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: `低排放區是 OpenStreetMap 上畫成面的 boundary=low_emission_zone（同一個範圍畫兩次的只算一次，誤標的不收），面簡化到約 20 公尺；數字是 OSM 上畫出來的，不是官方清單，各國畫得完不完整差很多（例如義大利的限制通行區多半畫在道路上，不是面）。塞車費的城市照英文維基百科條目寫到已經實施的整理，位置是 Wikidata 的城市座標。${TAIWAN.zh}`,
    en: `Low-emission zones are the areas tagged boundary=low_emission_zone in OpenStreetMap (an area mapped twice counts once; mistagged ones are left out), simplified to about 20 m. The counts are what OSM contributors have mapped, not an official list, and completeness varies a lot (Italy’s limited traffic zones are mostly tagged on roads, not as areas). Cities with congestion charges are those the English Wikipedia article describes as in operation, placed at the city’s Wikidata coordinates. ${TAIWAN.en}`,
  },
  overlays: [LEZ, CHARGES],
  listPanel: [LEZ_LIST, CHARGE_LIST],
  indicators: [
    {
      id: 'low-emission-zones',
      label: { zh: '低排放區與塞車費', en: 'Low-emission zones and congestion charges' },
      description: {
        zh: `OpenStreetMap 上畫成面的低排放區共 223 個（2026-11-05），國家的顏色是個數：西班牙 44、德國 43、法國 42、英國 27、荷蘭 24、義大利 8、希臘 6。最大的是倫敦的低排放區（約 1,523 平方公里）、德國魯爾區（867）、曼谷的甘乍那披色環路（752）、法國里爾（671）。只有 70 個寫了開始日期，最早是倫敦（2008-02-04），2025 年開始的有 26 個。點是收塞車費的 20 個城市：新加坡 1975 年最早、1998 年改成電子收費，挪威卑爾根 1986 年的收費環、倫敦 2003 年、斯德哥爾摩 2006 年試辦、米蘭 2008 年、哥德堡 2013 年、紐約 2025 年。數字是 OSM 上畫出來的，不是官方清單。${TAIWAN.zh}`,
        en: `OpenStreetMap has 223 low-emission zones mapped as areas (5 Nov 2026); countries are shaded by the count: Spain 44, Germany 43, France 42, the UK 27, the Netherlands 24, Italy 8 and Greece 6. The largest are London’s Low Emission Zone (about 1,523 km²), Germany’s Ruhr (867), Bangkok’s Kanchanaphisek ring (752) and Lille (671). Only 70 have a start date, the earliest London (4 Feb 2008); 26 began in 2025. Dots mark 20 cities with congestion charges: Singapore first in 1975 (electronic since 1998), then Bergen’s toll ring in 1986, London in 2003, Stockholm’s trial in 2006, Milan in 2008, Gothenburg in 2013 and New York in 2025. The counts are what OSM contributors have mapped, not an official list. ${TAIWAN.en}`,
      },
      unit: { zh: '個', en: 'zones' },
      file: 'low-emission-zones.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 25] } },
      format: count,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: 'OSM 上沒有畫成面的低排放區', en: 'No low-emission zone mapped as an area in OSM' },
      noValue: { TWN: { zh: '沒有低排放區；對應的是空氣品質維護區（桃園市 3 區）', en: 'No low-emission zones; the closest equivalent is the air quality maintenance zone (three in Taoyuan)' } },
    },
  ],
};
