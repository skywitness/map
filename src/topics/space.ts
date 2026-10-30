import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { PointRecord, TopicDefinition } from './types';

/**
 * 太空（pipeline/topics/space.py）：GCAT 的在軌酬載（依擁有國）、入軌發射（依發射業者的國家），發射場畫成點。
 * 蘇聯的酬載與發射算在俄羅斯；國際組織（ESA、EUMETSAT、Intelsat…）的酬載只算進世界合計。
 */

const n0 = (v: number) => fixed(v, 0);
// 數字寫完整：formatLargeNumber 的中文萬取整數，美國的 13,203 顆會寫成「1 萬」
export const payloads = (v: number) =>
  tr({ zh: `${n0(v)} 顆`, en: `${n0(v)} ${Math.round(v) === 1 ? 'payload' : 'payloads'}` });
export const objects = (v: number) =>
  tr({ zh: `${n0(v)} 個`, en: `${n0(v)} ${Math.round(v) === 1 ? 'object' : 'objects'}` });
const launches = (v: number) => tr({ zh: `${n0(v)} 次`, en: `${n0(v)} ${Math.round(v) === 1 ? 'launch' : 'launches'}` });

/** 發射場的 tooltip：短名稱是標題，國家與入軌發射次數、年份範圍，GCAT 的完整英文名稱放在不翻譯的那一行 */
function siteTooltip(p: PointRecord, ctx: { countryName: (iso3: string) => string }) {
  const parts: string[] = [];
  if (typeof p.iso3 === 'string') parts.push(ctx.countryName(p.iso3));
  const n = typeof p.n === 'number' ? p.n : 0;
  const span = p.first === p.last ? String(p.first) : `${p.first}–${p.last}`;
  parts.push(tr({ zh: `入軌發射 ${n0(n)} 次（${span}）`, en: `${launches(n)} to orbit (${span})` }));
  return {
    title: String(p.name ?? ''),
    detail: parts.join(' · '),
    properNoun: typeof p.full === 'string' && p.full !== p.name ? p.full : undefined,
  };
}

export const space: TopicDefinition = {
  id: 'space',
  title: { zh: '太空：衛星與發射', en: 'Space: satellites and launches' },
  shortTitle: { zh: '太空', en: 'Space' },
  defaultIndicator: 'in-orbit',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: 'Jonathan McDowell, General Catalog of Artificial Space Objects（GCAT）Release 1.8.8',
        en: 'Jonathan McDowell, General Catalog of Artificial Space Objects (GCAT), Release 1.8.8',
      },
      url: 'https://planet4589.org/space/gcat/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '資料來自 Jonathan McDowell 的 GCAT（data from GCAT, J. McDowell, planet4589.org/space/gcat），到 2026 年 10 月 29 日，所以 2026 年是到目前為止。酬載是衛星、太空船與太空站艙段，含已經失效的衛星，不含火箭殘骸與碎片；國家是擁有者所屬的國家。太空垃圾是火箭殘骸、碎片與零件，只有追蹤得到、編進目錄的物體（大約 10 公分以上），更小的碎片是模型推算的、不在這裡；碎片算在原本那個物體的擁有國，年份用它產生（分離或解體）的日期。發射是入軌發射（成功與失敗都算），國家是發射業者所屬的國家（阿利安太空公司在法屬圭亞那發射算法國、Rocket Lab 在紐西蘭發射算美國）。蘇聯的酬載與發射算在繼承國俄羅斯；歐洲太空總署、EUMETSAT、Intelsat 等國際組織的酬載只算進世界合計。',
    en: 'Data from GCAT (J. McDowell, planet4589.org/space/gcat) up to 29 October 2026, so 2026 is year to date. Payloads are satellites, spacecraft and space station modules, including defunct satellites but not rocket bodies or debris, assigned to the owner’s country. Space debris covers rocket bodies, fragments and components that are tracked and catalogued (roughly 10 cm and larger); smaller debris is only modelled and is not shown. Fragments count for the owner of the object they came from, dated by when they separated or broke up. Launches are orbital launch attempts (successes and failures), assigned to the launch provider’s country (Arianespace from French Guiana counts for France, Rocket Lab from New Zealand for the United States). Soviet payloads and launches count for Russia as the successor state; payloads of international organisations such as ESA, EUMETSAT and Intelsat count only in the world total.',
  },
  panelExtra: () => import('./panels/SpacePanel'),
  overlays: [
    {
      kind: 'points',
      id: 'sites',
      file: 'sites.json',
      label: { zh: '發射場（入軌發射）', en: 'Launch sites (orbital)' },
      radius: { field: 'n', stops: [[1, 1.6], [10, 3], [100, 5.5], [1000, 10], [2500, 14]] },
      color: MAP_TOKENS.hues.red,
      sortField: 'n',
      timeField: 'first',
      sizeLegend: { title: { zh: '入軌發射次數', en: 'Orbital launches' }, values: [10, 100, 1000], format: n0 },
      tooltip: siteTooltip,
    },
  ],
  indicators: [
    {
      id: 'in-orbit',
      label: { zh: '在軌酬載（依擁有國）', en: 'Payloads in orbit' },
      description: {
        zh: '這一年年底還在地球軌道上的衛星與太空船（含已經失效的），依擁有者所屬的國家；2020 年代美國的數字大多是 SpaceX 的星鏈（Starlink）。點是發射場。',
        en: 'Satellites and spacecraft still in Earth orbit at the end of the year (including defunct ones), by the owner’s country; in the 2020s most of the US total is SpaceX’s Starlink. Dots are launch sites.',
      },
      unit: { zh: '顆', en: 'payloads' },
      file: 'in-orbit.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000] },
      overlayTime: 'cumulative',
      format: payloads,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'debris',
      label: { zh: '太空垃圾（依擁有國）', en: 'Space debris' },
      description: {
        zh: '這一年年底還在地球軌道上的火箭殘骸、碎片與零件（整流罩、轉接環等），依擁有國；碎片算在原本那個物體的擁有國。2026 年約 1.46 萬個：俄羅斯（含蘇聯）4,908、美國 4,458、中國 4,441，其中 2007 年中國反衛星試射擊碎的風雲一號 C 還有 2,313 個碎片。反衛星試射、衛星或火箭爆炸讓一國的數字一年跳上幾千。台灣擁有的 2 個碎片都已經再入大氣層。',
        en: 'Rocket bodies, debris and components (fairings, adapters and the like) still in Earth orbit at the end of the year, by the owner’s country; fragments count for the owner of the object they came from. About 14,600 in 2026: Russia (including the Soviet Union) 4,908, the US 4,458 and China 4,441, of which 2,313 are still fragments of the Fengyun-1C satellite destroyed in China’s 2007 anti-satellite test. Anti-satellite tests and explosions of satellites or rockets can add thousands in a single year. Taiwan’s two debris objects have both re-entered.',
      },
      unit: { zh: '個', en: 'objects' },
      file: 'debris.json',
      layer: { kind: 'bubble', legendValues: [100, 1000, 5000] },
      overlayTime: 'cumulative',
      format: objects,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'launches',
      label: { zh: '每年入軌發射次數', en: 'Orbital launches per year' },
      description: {
        zh: '這一年的入軌發射次數（成功與失敗都算），依發射業者所屬的國家。1957 年蘇聯發射史普尼克一號以來，美蘇（俄）長期領先，2010 年代起中國追上，2020 年代 SpaceX 讓美國的次數大增。',
        en: 'Orbital launch attempts in the year (successes and failures), by the launch provider’s country. Since Sputnik in 1957 the US and the Soviet Union (Russia) led for decades; China caught up in the 2010s, and SpaceX sent US numbers soaring in the 2020s.',
      },
      unit: { zh: '次', en: 'launches' },
      file: 'launches.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 100] },
      overlayTime: 'cumulative',
      format: launches,
      formatTick: n0,
      shareOfWorld: true,
    },
    {
      id: 'launches-cumulative',
      label: { zh: '累計入軌發射次數', en: 'Orbital launches (cumulative)' },
      description: {
        zh: '1957 年起到這一年的入軌發射次數（成功與失敗都算），依發射業者所屬的國家；蘇聯的算在俄羅斯。',
        en: 'Orbital launch attempts from 1957 up to the selected year (successes and failures), by the launch provider’s country; Soviet launches count for Russia.',
      },
      unit: { zh: '次', en: 'launches' },
      file: 'launches-cumulative.json',
      layer: { kind: 'bubble', legendValues: [10, 100, 1000] },
      overlayTime: 'cumulative',
      format: launches,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
  ],
};
