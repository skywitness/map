import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { CategoryDef, IndicatorDef, ScaleSpec, TopicDefinition } from './types';

/**
 * 血型分布（pipeline/topics/blood_types.py）：英文維基百科「Blood type distribution by country」第一個表
 * （revid 1378379911）的各國 ABO 與 Rh 血型比例。各國的數字來源不同（捐血人、醫院、研究樣本，年代也不同），
 * 不分年份（timeless）。沒有出處的國家（包括台灣）照常畫，tooltip 與側欄標「維基百科沒有註明出處」。
 * 資料檔依 CC BY-SA 4.0 分享（DESIGN.md 第 8 節第 100 點）。
 */

const PCT = '%';
/** 比例到 0.1%；Rh 陰性在東亞只有零點幾，小於 1% 時寫到 0.01% */
const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;
const pctTick = (v: number) => `${fixed(v, v < 1 ? 1 : 0)}%`;

/** 最多的血型（pipeline 的代碼：O 1、A 2、B 3、AB 4；AB 型在表上沒有一國是最多的，圖例不列；pipeline 遇到 AB 型最多的國家會報錯，要加回來） */
const MAIN: CategoryDef[] = [
  { value: 1, label: { zh: 'O 型', en: 'Type O' } },
  { value: 2, label: { zh: 'A 型', en: 'Type A' } },
  { value: 3, label: { zh: 'B 型', en: 'Type B' } },
];
const AB: Text = { zh: 'AB 型', en: 'Type AB' };

const SCALES: Record<string, ScaleSpec> = {
  o: { type: 'sequential', thresholds: [30, 35, 40, 45, 50, 60] },
  a: { type: 'sequential', thresholds: [20, 25, 30, 35, 40] },
  b: { type: 'sequential', thresholds: [10, 15, 20, 25, 30] },
  ab: { type: 'sequential', thresholds: [2, 4, 6, 8, 10] },
};

function shareIndicator(group: 'O' | 'A' | 'B' | 'AB', description: Text): IndicatorDef {
  const id = group.toLowerCase();
  return {
    id,
    label: { zh: `${group} 型的比例`, en: `Type ${group}` },
    description,
    unit: PCT,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: SCALES[id] },
    format: pct,
    formatTick: pctTick,
    unranked: true,
  };
}

export const bloodTypes: TopicDefinition = {
  id: 'blood-types',
  title: { zh: '各國的血型分布', en: 'Blood types by country' },
  shortTitle: { zh: '血型分布', en: 'Blood types' },
  timeless: true,
  defaultIndicator: 'main',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「Blood type distribution by country」（2026 年 10 月 4 日的版本，各國的數字引用的資料見側欄）',
        en: 'Wikipedia, “Blood type distribution by country” (revision of 4 October 2026; the source each country’s row cites is in the side panel)',
      },
      url: 'https://en.wikipedia.org/w/index.php?oldid=1378379911',
      license: 'CC BY-SA 4.0',
    },
  ],
  note: {
    zh: '依英文維基百科「Blood type distribution by country」第一個表（2026 年 10 月 4 日的版本）。各國的數字來源不同：捐血人、醫院的病人或研究的樣本，年代也從 1970 年代到 2020 年代都有，不是同一套調查，國與國之間只能大略比較；126 國裡只有 73 國那一列註明了出處（側欄有連結），台灣等 53 國維基百科沒有註明出處，照樣畫出，tooltip 與側欄有標示。8 種血型加起來不一定是 100%（四捨五入或原始資料不完整）。O、A、B、AB 型的比例是 Rh 陽性加陰性。這個主題的資料檔依 CC BY-SA 4.0 分享。',
    en: 'From the first table of the English Wikipedia article “Blood type distribution by country” (revision of 4 October 2026). Each country’s figures come from a different kind of source—blood donors, hospital patients or study samples—from the 1970s to the 2020s, not from one common survey, so comparisons between countries are only rough. Only 73 of the 126 rows cite a source (linked in the side panel); Taiwan and 52 other countries have no source cited on Wikipedia and are still shown, marked in the tooltip and side panel. The eight types do not always add up to 100% (rounding or incomplete original data). Types O, A, B and AB include both Rh-positive and Rh-negative. The data files for this topic are shared under CC BY-SA 4.0.',
  },
  panelExtra: () => import('./panels/BloodTypesPanel'),
  indicators: [
    {
      id: 'main',
      label: { zh: '最多的血型', en: 'Most common type' },
      description: {
        zh: 'O、A、B、AB 四型（Rh 陽性加陰性）裡比例最高的一型。大部分國家是 O 型；歐洲大部分國家（德國、法國、北歐、東歐）、土耳其、日本、韓國是 A 型；巴基斯坦與孟加拉是 B 型。',
        en: 'The most common of types O, A, B and AB (Rh-positive and negative combined). Most countries are O; most of Europe (Germany, France, the Nordic countries, Eastern Europe), Turkey, Japan and South Korea are A; Pakistan and Bangladesh are B.',
      },
      unit: '',
      file: 'main.json',
      layer: { kind: 'categorical', categories: MAIN },
      format: (v) => tr(MAIN.find((c) => c.value === v)?.label ?? AB),
    },
    shareIndicator('O', {
      zh: 'O 型（O+ 加 O−）占人口的比例。中南美洲原住民比例高的國家最高，厄瓜多、秘魯 70% 以上。',
      en: 'Share of the population with type O (O+ and O−). Highest in Latin American countries with large Indigenous populations—above 70% in Ecuador and Peru.',
    }),
    shareIndicator('A', {
      zh: 'A 型（A+ 加 A−）占人口的比例。歐洲、亞美尼亞、土耳其、日本、韓國較高。',
      en: 'Share of the population with type A (A+ and A−). Higher in Europe, Armenia, Turkey, Japan and South Korea.',
    }),
    shareIndicator('B', {
      zh: 'B 型（B+ 加 B−）占人口的比例。南亞、中亞到東南亞較高，往歐洲與美洲越來越少。',
      en: 'Share of the population with type B (B+ and B−). Higher from South and Central Asia to Southeast Asia, falling towards Europe and the Americas.',
    }),
    shareIndicator('AB', {
      zh: 'AB 型（AB+ 加 AB−）占人口的比例，大部分國家不到 10%，韓國與北韓約 11%。',
      en: 'Share of the population with type AB (AB+ and AB−); under 10% in most countries, about 11% in South and North Korea.',
    }),
    {
      id: 'rh-neg',
      label: { zh: 'Rh 陰性的比例', en: 'Rh-negative' },
      description: {
        zh: 'O−、A−、B−、AB− 合計占人口的比例。歐洲與歐洲移民為主的國家約 15%，東亞與東南亞不到 1%（台灣約 0.3%），所以東亞的 Rh 陰性血特別難找。',
        en: 'Share of the population that is Rh-negative (O−, A−, B− and AB− combined). Around 15% in Europe and countries settled mainly from Europe, under 1% in East and Southeast Asia (about 0.3% in Taiwan), which is why Rh-negative blood is especially scarce there.',
      },
      unit: PCT,
      file: 'rh-neg.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 3, 6, 10, 15] } },
      format: pct,
      formatTick: pctTick,
      unranked: true,
    },
  ],
};
