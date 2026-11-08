import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { topicPart } from './merge';
import type { ColorClasses, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 小型模組化與微型反應爐的計畫地點（2026-11-08，製作手冊第二十七批 625；pipeline/topics/smr_sites.py）：
 * GEM Global Nuclear Power Tracker 的 208 個機組，狀態代碼 1 興建中、2 施工前、3 已宣布、4 擱置、5 取消
 */
const C = MAP_TOKENS.categorical;
const SITE_STATUS: ColorClasses = {
  field: 'st',
  title: { zh: '狀態', en: 'Status' },
  thresholds: [1.5, 2.5, 3.5, 4.5],
  classes: [
    { color: C[5], label: { zh: '興建中', en: 'Under construction' } },
    { color: C[2], label: { zh: '施工前（取得場址、申請執照）', en: 'Pre-construction' } },
    { color: C[1], label: { zh: '已宣布', en: 'Announced' } },
    { color: MAP_TOKENS.categoricalOther, label: { zh: '擱置', en: 'Shelved' } },
    { color: C[7], label: { zh: '取消', en: 'Cancelled' } },
  ],
};
const siteLayer = (id: 'active' | 'inactive', label: PointsOverlayDef['label'], hidden: boolean, look?: PointsOverlayDef['look']): PointsOverlayDef => ({
  kind: 'points',
  id: `smr-sites-${id}`,
  file: `sites-${id}.json`,
  label,
  ...(hidden ? { hidden: true } : {}),
  ...(look ? { look } : {}),
  indicators: ['smr-projects', 'smr-designs'],
  // 微型反應爐只有 1–20 MW，從 5 MW 起畫得看得見
  radius: { field: 'mw', stops: [[5, 2], [50, 2.6], [300, 3.6], [1000, 5.5], [4000, 9]] },
  color: SITE_STATUS,
  sizeLegend: { title: { zh: '裝置容量', en: 'Capacity' }, values: [50, 300, 1000], format: (v: number) => `${fixed(v, 0)} MW` },
  tooltip: (p, ctx) => {
    const st = typeof p.st === 'number' ? p.st : 3;
    const units = typeof p.units === 'number' ? p.units : 1;
    return {
      title: tr({
        zh: `${p.type === 2 ? '微型反應爐' : '小型模組化反應爐'} · ${typeof p.mw === 'number' ? `${fixed(p.mw, 0)} MW` : ''}`,
        en: `${p.type === 2 ? 'Microreactor' : 'Small modular reactor'} · ${typeof p.mw === 'number' ? `${fixed(p.mw, 0)} MW` : ''}`,
      }),
      detail: [
        tr(SITE_STATUS.classes[st - 1].label),
        units > 1 ? tr({ zh: `${units} 部`, en: `${units} units` }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
      extra: [
        typeof p.model === 'string' && p.model ? tr({ zh: `型號：${p.model}`, en: `Model: ${p.model}` }) : null,
        p.approx ? tr({ zh: '位置是大約的', en: 'Approximate location' }) : null,
      ].filter((x): x is string => Boolean(x)),
    };
  },
});

/**
 * 小型模組化反應爐（SMR）的設計案（2026-11-07，製作手冊第二十五批 532；pipeline/topics/smr.py）：英文維基
 * 「List of small modular reactor designs」固定版本的表，依設計者的國家數件數。不單獨上架，併進「核能」（nuclear.ts）。
 */
export const smrDesigns: TopicDefinition = {
  id: 'smr',
  title: { zh: '小型模組化反應爐（SMR）的設計案', en: 'Small modular reactor (SMR) designs' },
  shortTitle: { zh: '小型模組化反應爐', en: 'SMR designs' },
  defaultIndicator: 'smr-designs',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「List of small modular reactor designs」（revid 1382956151，2026-11-07）',
        en: 'English Wikipedia, “List of small modular reactor designs” (revision 1382956151, 7 November 2026)',
      },
      url: 'https://en.wikipedia.org/w/index.php?title=List_of_small_modular_reactor_designs&oldid=1382956151',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Global Energy Monitor：Global Nuclear Power Tracker（2026 年 8 月版，SMR 與微型反應爐的計畫）', en: 'Global Energy Monitor: Global Nuclear Power Tracker (August 2026; SMR and microreactor projects)' },
      url: 'https://globalenergymonitor.org/projects/global-nuclear-power-tracker/',
      license: 'CC BY 4.0',
    },
  ],
  indicators: [
    {
      id: 'smr-designs',
      label: { zh: '小型模組化反應爐（SMR）的設計案', en: 'Small modular reactor (SMR) designs' },
      description: {
        zh: '依設計者的國家，數英文維基清單上的小型模組化反應爐設計案（96 件，兩國合作的兩國各算一件；國家是設計者所在，不是要蓋在哪裡）；滑過看這一國有哪些。還在進行的：美國 25、俄羅斯 16、法國 11、日本 9、中國 7、加拿大 6。已經申請執照以上的只有 16 件、8 國：美國 7、俄羅斯 4、中國 2（合作案兩國各算）。運轉中的只有中國的 HTR-PM 與俄羅斯的浮動式核電廠 Akademik Lomonosov；興建中的有中國玲龍一號、俄羅斯 BREST-OD-300、美國 Natrium、加拿大安大略的 BWRX-300 等 7 件。台灣沒有設計案。',
        en: 'Small modular reactor designs on the English Wikipedia list (96), counted by the designer’s country (joint designs count for both; the country is where the designer is based, not where it will be built); hover to see which. Still active: the US 25, Russia 16, France 11, Japan 9, China 7, Canada 6. Only 16 designs in 8 countries have reached licensing or beyond: the US 7, Russia 4, China 2 (joint designs counted for each partner). Only China’s HTR-PM and Russia’s floating Akademik Lomonosov are operating; 7 are under construction, including China’s Linglong One, Russia’s BREST-OD-300, Natrium in the US and BWRX-300 in Ontario, Canada. Taiwan has no designs.',
      },
      unit: { zh: '件', en: 'designs' },
      file: 'designs/{item}.json',
      dimension: {
        label: { zh: '階段', en: 'Stage' },
        options: [
          { id: 'active', label: { zh: '還在進行（不含取消、退役）', en: 'Active (excluding cancelled and retired)' } },
          { id: 'advanced', label: { zh: '已申請執照、取得執照、興建中或運轉中', en: 'Seeking a licence, licensed, under construction or operating' } },
        ],
        defaultOption: 'active',
      },
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 3, 5, 8, 12, 20] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 件`, en: `${fixed(v, 0)} ${v === 1 ? 'design' : 'designs'}` }),
      formatTick: (v) => fixed(v, 0),
      timeless: true,
      missing: { zh: '清單上沒有這一國的設計案', en: 'No designs from this country on the list' },
    },
    {
      id: 'smr-projects',
      label: { zh: '小型模組化與微型反應爐的計畫', en: 'Small modular and micro reactor projects' },
      description: {
        zh: '打算蓋在這一國的小型模組化與微型反應爐機組數（GEM，2026 年 8 月；子項目是狀態）。208 部、37,023 MW 裡沒有一部在運轉：興建中 4 部（加拿大達靈頓的 BWRX-300、烏茲別克吉扎克的 2 部 RITM-200N、美國的 Hermes），施工前 30（波蘭 14、美國 6、羅馬尼亞 6、英國 3、加拿大 1），已宣布 115，擱置 37、取消 22。還在進行的 149 部：美國 50、波蘭 40、英國 12、加拿大 8、挪威 8、印尼 6、羅馬尼亞 6。型號最多的是 NuScale 55 部、BWRX-300 36。中國的 HTR-PM 與俄羅斯的浮動核電廠在 GEM 歸別的機型，不在這裡。點的位置多半是大約的。台灣沒有 SMR 計畫。',
        en: 'Small modular and micro reactor units planned in each country (GEM, August 2026; sub-items are statuses). None of the 208 units (37,023 MW) is operating: 4 are under construction (a BWRX-300 at Darlington in Canada, two RITM-200N at Jizzakh in Uzbekistan and Hermes in the US), 30 are in pre-construction (Poland 14, the US 6, Romania 6, the UK 3, Canada 1), 115 are announced, 37 shelved and 22 cancelled. Of the 149 still active, the US has 50, Poland 40, the UK 12, Canada 8, Norway 8, Indonesia 6 and Romania 6. The most common models are NuScale (55 units) and BWRX-300 (36). China’s HTR-PM and Russia’s floating plant are classed as other reactor types by GEM and are not included. Most point locations are approximate. Taiwan has no SMR projects.',
      },
      unit: { zh: '部', en: 'units' },
      file: 'projects/{item}.json',
      dimension: {
        label: { zh: '狀態', en: 'Status' },
        options: [
          { id: 'active', label: { zh: '還在進行（興建中、施工前、已宣布）', en: 'Active (under construction, pre-construction, announced)' } },
          { id: 'construction', label: { zh: '興建中', en: 'Under construction' } },
          { id: 'pre-construction', label: { zh: '施工前', en: 'Pre-construction' } },
          { id: 'announced', label: { zh: '已宣布', en: 'Announced' } },
        ],
        defaultOption: 'active',
      },
      layer: { kind: 'bubble', legendValues: [1, 10, 50] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 部`, en: `${fixed(v, 0)} ${v === 1 ? 'unit' : 'units'}` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: 'GEM 沒有這一國的 SMR 計畫', en: 'No SMR projects in GEM' },
    },
  ],
  overlays: [
    siteLayer('active', { zh: 'SMR 與微型反應爐的計畫地點', en: 'SMR and microreactor project sites' }, false),
    siteLayer('inactive', { zh: '擱置與取消的 SMR 計畫', en: 'Shelved and cancelled SMR projects' }, true, 'faint'),
  ],
};

export const smrPart = topicPart(smrDesigns, { name: { zh: '小型模組化反應爐', en: 'Small modular reactors' } });
