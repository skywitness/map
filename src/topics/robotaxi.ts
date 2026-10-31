import { getLang, tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, ListPanelDef, ListRow, PointRecord, PointsOverlayDef, SourceDef } from './types';

/**
 * 叫車服務的擴充：無人計程車（2026-10-31，製作手冊第十批 179；pipeline/topics/robotaxi.py，DESIGN.md 第 8 節第 261 點）。
 * 只收車上沒有安全員、對一般乘客收費的城市，依開始的年份出現；停止營運的也記（Cruise 舊金山）。
 */

/** 公司（pipeline 的 COMPANIES） */
const COMPANIES: { value: number; label: Text; color: string }[] = [
  { value: 1, label: { zh: 'Waymo', en: 'Waymo' }, color: MAP_TOKENS.categorical[0] },
  { value: 2, label: { zh: 'Tesla', en: 'Tesla' }, color: MAP_TOKENS.categorical[7] },
  { value: 3, label: { zh: 'Zoox', en: 'Zoox' }, color: MAP_TOKENS.categorical[4] },
  { value: 4, label: { zh: 'Cruise（已停止）', en: 'Cruise (stopped)' }, color: MAP_TOKENS.context },
  { value: 5, label: { zh: '百度蘿蔔快跑（Apollo Go）', en: 'Baidu Apollo Go' }, color: MAP_TOKENS.categorical[1] },
  { value: 6, label: { zh: '小馬智行（Pony.ai）', en: 'Pony.ai' }, color: MAP_TOKENS.categorical[3] },
  { value: 7, label: { zh: '文遠知行（WeRide）', en: 'WeRide' }, color: MAP_TOKENS.categorical[6] },
];
const SHORT: Record<number, Text> = { 4: { zh: 'Cruise', en: 'Cruise' }, 5: { zh: '蘿蔔快跑', en: 'Apollo Go' }, 6: { zh: '小馬智行', en: 'Pony.ai' }, 7: { zh: '文遠知行', en: 'WeRide' } };
const company = (co: unknown) => tr(SHORT[Number(co)] ?? COMPANIES.find((c) => c.value === co)?.label ?? '');

const city = (p: PointRecord) => String((getLang() === 'zh' ? p.zh : p.en) ?? p.en);
const since = (p: PointRecord) =>
  tr({ zh: `${p.y} 年 ${p.mo} 月起`, en: `From ${new Date(Date.UTC(Number(p.y), Number(p.mo) - 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })} ${p.y}` });
const ended = (p: PointRecord) => typeof p.end === 'number';

function facts(p: PointRecord): string[] {
  const note = getLang() === 'zh' ? p.note : p.noteEn;
  return [
    ended(p) ? tr({ zh: `${since(p)}，${Number(p.end) - 1} 年停止`, en: `${since(p)}; stopped in ${Number(p.end) - 1}` }) : since(p),
    typeof note === 'string' ? note : '',
  ].filter(Boolean);
}

const INDICATORS = ['robotaxi-cities'];

const ROBOTAXI: PointsOverlayDef = {
  kind: 'points',
  id: 'robotaxi',
  file: 'robotaxi.json',
  label: { zh: '無人計程車營運的城市', en: 'Cities with robotaxi service' },
  indicators: INDICATORS,
  radius: 5,
  color: {
    field: 'co',
    title: { zh: '公司', en: 'Company' },
    thresholds: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
    classes: COMPANIES.map(({ label, color }) => ({ label, color })),
  },
  timeField: 'y',
  endField: 'end',
  tooltip: (p, { countryName }) => ({
    title: `${city(p)} · ${company(p.co)}`,
    detail: countryName(String(p.iso3)),
    extra: facts(p),
  }),
};

/** 左邊的清單：依開始的日期，停止營運的淡一點；點了移到那個城市 */
const LIST: ListPanelDef = {
  label: { zh: '無人計程車營運的城市', en: 'Robotaxi cities' },
  indicators: INDICATORS,
  file: 'robotaxi.json',
  rows: (points, { countryName }) =>
    [...points]
      .sort((a, b) => Number(a.y) - Number(b.y) || Number(a.mo) - Number(b.mo) || Number(a.co) - Number(b.co))
      .map(
        (p): ListRow => ({
          key: `${p.en}-${p.co}`,
          title: `${city(p)} · ${company(p.co)}`,
          lines: [countryName(String(p.iso3)), ...facts(p)],
          muted: ended(p),
          target: { lon: Number(p.lon), lat: Number(p.lat), zoom: 9 },
        }),
      ),
};

const cities = (v: number) => tr({ zh: `${fixed(v, 0)} 個城市`, en: `${fixed(v, 0)} ${Math.round(v) === 1 ? 'city' : 'cities'}` });

export const robotaxiExtra: { sources: SourceDef[]; overlays: PointsOverlayDef[]; indicators: IndicatorDef[]; listPanel: ListPanelDef } = {
  sources: [
    {
      name: {
        zh: '英文維基百科「Robotaxi」「Waymo」「Apollo Go」「Tesla Robotaxi」「Zoox」（revid 1382922653、1382926112、1351784932、1381652528、1382135242）',
        en: 'English Wikipedia, “Robotaxi”, “Waymo”, “Apollo Go”, “Tesla Robotaxi” and “Zoox” (revisions 1382922653, 1382926112, 1351784932, 1381652528, 1382135242)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=Waymo&oldid=1382926112',
      license: { zh: 'CC BY-SA 4.0（引用事實）', en: 'CC BY-SA 4.0 (facts cited)' },
    },
    {
      name: { zh: '各公司的公告與新聞（小馬智行、文遠知行、蘿蔔快跑杜拜、北京市政府；出處見程式）', en: 'Company announcements and news (Pony.ai, WeRide, Apollo Go Dubai, Beijing government; see the pipeline)' },
      url: 'https://github.com/skywitness/map/blob/main/pipeline/topics/robotaxi.py',
      license: { zh: '引用事實並註明出處', en: 'facts cited with sources' },
    },
  ],
  overlays: [ROBOTAXI],
  listPanel: LIST,
  indicators: [
    {
      id: 'robotaxi-cities',
      label: { zh: '無人計程車', en: 'Robotaxis' },
      description: {
        zh: '有無人計程車營運的城市數：只算車上沒有安全員、對一般乘客收費的（只限員工、受邀者，免費試乘或有安全員的不算），依實際開始的年月出現，同一個城市幾家公司算一個。2020 年 10 月 Waymo 在鳳凰城開放一般乘客搭無人的車，2022 年 8 月百度蘿蔔快跑在武漢、重慶拿到中國第一批無安全員的營運許可；2026 年 10 月底美國 15 個都會區（Waymo 15 個，Tesla 在德州與佛州 6 個，Zoox 拉斯維加斯）、中國 5 個城市（蘿蔔快跑、小馬智行、文遠知行）、阿聯 2 個（阿布達比、杜拜）。Cruise 2023 年 10 月在舊金山發生行人被拖行的事故後被吊銷許可、停止營運。台灣沒有。左邊的清單依開始的日期列出每個城市的每家公司。',
        en: 'Cities with robotaxi service: only rides with no safety driver on board that are open to paying members of the public (employee-only, invitation-only, free trials and rides with safety drivers do not count), shown from the month they began; several companies in one city count once. Waymo opened driverless rides to the public in Phoenix in October 2020, and Baidu’s Apollo Go received China’s first permits for commercial rides without safety drivers in Wuhan and Chongqing in August 2022. By late October 2026 there were 15 US metro areas (Waymo in 15, Tesla in 6 in Texas and Florida, Zoox in Las Vegas), 5 Chinese cities (Apollo Go, Pony.ai and WeRide) and 2 in the UAE (Abu Dhabi and Dubai). Cruise lost its permit and stopped after an October 2023 crash in San Francisco in which a pedestrian was dragged. Taiwan has none. The list on the left shows each company in each city by start date.',
      },
      unit: { zh: '個城市', en: 'cities' },
      file: 'robotaxi-cities.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10] } },
      integer: true,
      defaultYear: 2026,
      overlayTime: 'cumulative',
      format: cities,
      formatTick: (v) => fixed(v, 0),
      missing: { zh: '沒有無人計程車的商業營運', en: 'No commercial robotaxi service' },
    },
  ],
};
