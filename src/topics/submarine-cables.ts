import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { IndicatorDef, PointRecord, TopicDefinition } from './types';
import { cctld } from './cctld';
import { ipAddresses } from './ip-addresses';
import { hostOnly, topicPart } from './merge';
import { withParts } from './parts';

/**
 * 海底電纜（pipeline/topics/submarine_cables.py，資料是 TeleGeography Submarine Cable Map 2022 年 11 月以 CC BY-NC-SA 3.0
 * 公開的最後一版；2026-11-01 起不再用網站 API 的現在的資料，製作手冊第十八批 286）。
 * 地圖上畫電纜路線（線疊加圖層，營運中實線、2022 年時規劃中的虛線）與登陸點（點疊加圖層，有 iso3），
 * 兩者都依 RFS（ready for service）年份跟著時間軸累積到 2022 年；國家的統計是每年年底的累計值，只算營運中的電纜。
 */

/** 這一版的日期（pipeline 的 telegeography.SNAPSHOT） */
const SNAPSHOT_YEAR = 2022;

const n0 = (v: number) => fixed(v, 0);

export const cableCount = (v: number) =>
  tr({ zh: `${n0(v)} 條電纜`, en: `${n0(v)} ${Math.round(v) === 1 ? 'cable' : 'cables'}` });
export const kilometres = (v: number) => tr({ zh: `${n0(v)} 公里`, en: `${n0(v)} km` });
const placeCount = (v: number) =>
  tr({ zh: `${n0(v)} 個國家或地區`, en: `${n0(v)} ${Math.round(v) === 1 ? 'country or territory' : 'countries and territories'}` });
const landingCount = (v: number) =>
  tr({ zh: `${n0(v)} 個登陸點`, en: `${n0(v)} ${Math.round(v) === 1 ? 'landing point' : 'landing points'}` });

/**
 * 顏色（MAP_TOKENS；OKLab ΔE×100，一般／紅色盲／綠色盲）：
 * - 營運中：洋紅 categorical[7] #e7298a，跟藍色的海（#a0c8f0 等）33/32/20、淺色陸地 39/42/30、深色底圖的水 44/28/39。
 * - 規劃中：琥珀 hues.yellow #eda100（虛線），跟海 24/24/23、深色底圖 55/50/56，跟營運中的洋紅 29/30/21。
 * - 登陸點：深灰 inkSecondary 加白色外框，跟海 39/41/38、跟兩種線色都分得開；深色底圖上靠白框。
 * 比例圓是紫色 #6250d6，跟洋紅只有 27/13/23，但比例圓是半透明的大圓、電纜是細線，形狀分得開。
 */
const IN_SERVICE_COLOR = MAP_TOKENS.categorical[7];
const PLANNED_COLOR = MAP_TOKENS.hues.yellow;
const LANDING_COLOR = MAP_TOKENS.inkSecondary;
/** 線的分類代碼，跟 pipeline 的 IN_SERVICE、PLANNED 一致 */
const IN_SERVICE = 1;
const PLANNED = 2;

/** 電纜的 tooltip：名稱，第二行啟用年份與長度，第三行擁有者（原文，tooltip 只帶前 4 家） */
function cableTooltip(p: PointRecord) {
  const rfs = typeof p.rfs === 'number' ? p.rfs : null;
  const parts = [
    p.plan
      ? rfs
        ? tr({ zh: `${SNAPSHOT_YEAR} 年的狀態：規劃中，預計 ${rfs} 年啟用`, en: `As of ${SNAPSHOT_YEAR}: planned, expected ${rfs}` })
        : tr({ zh: `${SNAPSHOT_YEAR} 年的狀態：規劃中，啟用年份未定`, en: `As of ${SNAPSHOT_YEAR}: planned, date to be determined` })
      : rfs
        ? tr({ zh: `${rfs} 年啟用`, en: `In service since ${rfs}` })
        : tr({ zh: '營運中（啟用年份不明）', en: 'In service (year unknown)' }),
  ];
  if (typeof p.len === 'number') parts.push(kilometres(p.len));
  const total = typeof p.nown === 'number' ? p.nown : 0;
  const shown = typeof p.own === 'string' ? p.own : '';
  const more = total > 4 ? tr({ zh: ` 等 ${total} 家`, en: ` and ${total - 4} more` }) : '';
  return {
    title: typeof p.name === 'string' ? p.name : tr({ zh: '海底電纜', en: 'Submarine cable' }),
    detail: parts.join(' · '),
    properNoun: shown ? `${tr({ zh: '擁有者：', en: 'Owners: ' })}${shown}${more}` : undefined,
  };
}

/** 登陸點的 tooltip：國家與電纜數，地名（TeleGeography 的英文原名）放在不翻譯的那一行 */
function landingTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const n = typeof p.n === 'number' ? p.n : 0;
  const planned = typeof p.np === 'number' ? p.np : 0;
  const parts: string[] = [];
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  parts.push(
    planned
      ? tr({ zh: `${cableCount(n)}（${n0(planned)} 條規劃中）`, en: `${cableCount(n)} (${n0(planned)} planned)` })
      : cableCount(n),
  );
  if (p.tbd) parts.push(tr({ zh: '確切位置未定', en: 'exact site to be determined' }));
  return {
    title: tr({ zh: '海底電纜登陸點', en: 'Cable landing point' }),
    detail: parts.join(' · '),
    properNoun: typeof p.name === 'string' ? p.name : undefined,
  };
}

const COUNTED = {
  zh: '有登陸點在這個國家、營運中的不同電纜數（每年年底累計，到 2022 年）',
  en: 'Distinct cables in service with a landing point in the country (cumulative at year end, up to 2022)',
};

const indicators: IndicatorDef[] = [
  {
    id: 'map',
    label: { zh: '海底電纜地圖', en: 'Cable map' },
    description: {
      zh: 'TeleGeography 2022 年 11 月公開的最後一版：461 條營運中與 66 條當時還在規劃的海底電纜。洋紅色實線是營運中、琥珀色虛線是 2022 年時還在規劃，點是登陸點。拖動時間軸看電纜依啟用年份一條條鋪設（到 2022 年）；滑鼠移到電纜上看名稱、啟用年份與擁有者，移到國家上看登陸的電纜數。2022 年以後新增的電纜不在這一版裡。',
      en: 'The last public version of TeleGeography’s data, from November 2022: 461 submarine cables in service and 66 that were still planned. Solid magenta lines are in service, dashed amber lines were planned in 2022, and dots are landing points. Drag the time slider to watch cables appear by ready-for-service year (up to 2022). Hover over a cable for its name, year and owners, or over a country for the number of cables landing there. Cables added after 2022 are not in this version.',
    },
    unit: { zh: '條', en: 'cables' },
    file: 'cables.json',
    layer: { kind: 'none' },
    overlayTime: 'cumulative',
    format: (v) => tr({ zh: `${cableCount(v)}登陸`, en: `${cableCount(v)} landing` }),
    formatTick: n0,
  },
  {
    id: 'cables',
    label: { zh: '登陸的電纜數', en: 'Cables landing' },
    description: {
      zh: `${COUNTED.zh}。一條電纜在同一國有好幾個登陸點也只算一條；國內電纜（例如島嶼之間）也算。`,
      en: `${COUNTED.en}. A cable with several landing points in one country counts once; domestic cables (between islands, for example) count too.`,
    },
    unit: { zh: '條', en: 'cables' },
    file: 'cables.json',
    layer: { kind: 'bubble', legendValues: [10, 40, 100] },
    overlayTime: 'cumulative',
    format: cableCount,
    formatTick: n0,
  },
  {
    id: 'partners',
    label: { zh: '國際連線數', en: 'Countries linked' },
    description: {
      zh: '經由營運中的海底電纜直接連到的其他國家或地區數：同一條電纜登陸的其他國家都算（TeleGeography 沒有分段的資料，主幹與支線分不開）。每年年底累計，到 2022 年；沒有電纜登陸的國家（包括內陸國）是 0。',
      en: 'Number of other countries and territories directly linked by submarine cables in service: every other country a cable lands in counts (TeleGeography does not split cables into segments, so trunks and branches are not distinguished). Cumulative at year end, up to 2022. Countries with no cable landing (including landlocked ones) show 0.',
    },
    unit: { zh: '國', en: 'countries' },
    file: 'partners.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 30, 45] } },
    overlayTime: 'cumulative',
    format: placeCount,
    formatTick: n0,
  },
  {
    id: 'landings',
    label: { zh: '登陸點數', en: 'Landing points' },
    description: {
      zh: '有營運中的海底電纜登陸的地點數（登陸站所在的城鎮；同一個地點有好幾條電纜也只算一個），每年年底累計，到 2022 年。',
      en: 'Number of places where submarine cables in service come ashore (the town of the landing station; several cables at one place count once). Cumulative at year end, up to 2022.',
    },
    unit: { zh: '處', en: 'landing points' },
    file: 'landings.json',
    layer: { kind: 'bubble', legendValues: [10, 50, 150] },
    overlayTime: 'cumulative',
    format: landingCount,
    formatTick: n0,
  },
];

const submarineCablesOwn: TopicDefinition = {
  id: 'submarine-cables',
  title: { zh: '海底電纜', en: 'Submarine cables' },
  shortTitle: { zh: '海底電纜', en: 'Cables' },
  defaultIndicator: 'map',
  defaultYear: SNAPSHOT_YEAR,
  sources: [
    {
      name: {
        zh: 'TeleGeography：Submarine Cable Map 的資料（2022-11-14 最後公開的版本，GitHub 儲存庫已刪除，連到 Wayback Machine 的存檔）',
        en: 'TeleGeography, Submarine Cable Map data (last public version, 14 November 2022; the GitHub repository has been deleted, so this links to the Wayback Machine copy)',
      },
      url: 'https://web.archive.org/web/20221110120103/https://github.com/telegeography/www.submarinecablemap.com',
      license: 'CC BY-NC-SA 3.0',
    },
  ],
  // 頁尾要短：英文版太長會把地圖擠扁（細節寫在指標說明、側欄與 DESIGN.md）
  note: {
    zh: '資料停在 2022 年 11 月：TeleGeography 之後改成年費授權，只有 2022 年以 CC BY-NC-SA 3.0 公開的最後一版可以用，所以之後新增的電纜沒有畫，「規劃中」是當時的狀態。TeleGeography 只收營運中與規劃中的電纜，已經退役的（例如 1988 年的 TAT-8）不在裡面，早年的數字偏少；年份是 RFS（開始營運）年份。國內的離島電纜大多沒有收，台灣的見附註。這個主題的衍生資料檔、匯出的地圖圖片與 CSV 也依 CC BY-NC-SA 3.0（https://creativecommons.org/licenses/by-nc-sa/3.0/ ，姓名標示—非商業性—相同方式分享）分享。',
    en: 'The data stop in November 2022: TeleGeography later moved to an annual licence, and only its last public version from 2022, released under CC BY-NC-SA 3.0, can be used, so cables added since are not shown and “planned” means planned at that time. TeleGeography lists only cables in service or planned; retired ones (such as TAT-8, 1988) are missing, so early years are undercounted. Years are ready-for-service years. Most domestic island cables are not listed; see the note for Taiwan. The derived data files, map images and CSV files of this topic are shared under CC BY-NC-SA 3.0 (https://creativecommons.org/licenses/by-nc-sa/3.0/; attribution, non-commercial, share-alike) too.',
  },
  panelExtra: () => import('./panels/SubmarineCablesPanel'),
  overlays: [
    {
      kind: 'lines',
      id: 'cables',
      file: 'cables-lines.json',
      label: { zh: '海底電纜', en: 'Submarine cables' },
      width: 1.1,
      timeField: 'year',
      color: {
        title: { zh: '狀態', en: 'Status' },
        classes: [
          { value: IN_SERVICE, color: IN_SERVICE_COLOR, label: { zh: '營運中', en: 'In service' } },
          { value: PLANNED, color: PLANNED_COLOR, dash: true, label: { zh: '規劃中（2022 年的狀態）', en: 'Planned (as of 2022)' } },
        ],
      },
      tooltip: cableTooltip,
    },
    {
      kind: 'points',
      id: 'landings',
      file: 'landing-points.json',
      label: { zh: '登陸點', en: 'Landing points' },
      radius: 2.2,
      color: LANDING_COLOR,
      timeField: 'year',
      tooltip: landingTooltip,
    },
  ],
  indicators,
};

/**
 * 網路的骨幹（2026-11-08 使用者要求「網路與連線」併成更少的主題（9 個併成 4 個），放到科技的「太空」下面；併進來的主題的定義檔照舊留著，舊網址由 redirects.ts 轉過來）：
 * 海底電纜（主體）＋網路位址 IPv4 與 IPv6（ip-addresses.ts）＋國家網域 ccTLD（cctld.ts），資料照舊在各自的資料夾
 */
export const submarineCables: TopicDefinition = withParts(
  {
    ...hostOnly(submarineCablesOwn),
    title: { zh: '網路的骨幹：海底電纜、IP 位址與國家網域', en: 'The internet’s backbone: submarine cables, IP addresses and country domains' },
    shortTitle: { zh: '網路的骨幹', en: 'Internet backbone' },
  },
  topicPart(ipAddresses),
  topicPart(cctld),
);
