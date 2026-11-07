import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef } from './types';

/**
 * 半導體的擴充：電腦手機螢幕是誰做的、半導體貿易的三十年重新排隊（2026-11-07，製作手冊第二十七批 593，候選 1316、1320；
 * pipeline/topics/electronics_hs92.py）：Harvard Atlas 的 HS92 四位碼，1995–2024。跟主題原本的 BACI（HS 2017，2017–2024）
 * 是不同的資料與分類，自己的子項目、自己的側欄（panels/Hs92Panel.tsx），兩條線不接。
 */
export const HS92_ITEMS = [
  { id: 'ic', code: '8542', label: { zh: '積體電路（8542）', en: 'Integrated circuits (8542)' } },
  { id: 'computers', code: '8471', label: { zh: '電腦（8471）', en: 'Computers (8471)' } },
  { id: 'computer-parts', code: '8473', label: { zh: '電腦零件（8473）', en: 'Computer parts (8473)' } },
  { id: 'radio', code: '8525', label: { zh: '無線傳輸設備，含手機（8525）', en: 'Radio transmission equipment incl. phones (8525)' } },
  { id: 'monitors', code: '8528', label: { zh: '螢幕與電視（8528）', en: 'Monitors and TVs (8528)' } },
  { id: 'machinery', code: '8479', label: { zh: '其他專用機械，含半導體設備（8479）', en: 'Other special machinery incl. chip equipment (8479)' } },
  { id: 'instruments', code: '9031', label: { zh: '量測與檢測儀器（9031）', en: 'Measuring and checking instruments (9031)' } },
] as const;

const DIMENSION: DimensionDef = {
  label: { zh: '商品（HS92）', en: 'Product (HS92)' },
  options: HS92_ITEMS.map(({ id, label }) => ({ id, label })),
  defaultOption: 'computers',
};
const NOTE = {
  zh: 'Harvard Atlas 的 HS 1992 版四位碼，1995–2024 年，名目美元沒有平減；出口含轉口（香港、新加坡、荷蘭特別多）。跟這個主題其他指標的 CEPII BACI（HS 2017，2017 年起）是不同的資料，數字不完全一樣，不要接在一起看。',
  en: 'Harvard Atlas, HS 1992 four-digit codes, 1995–2024, in nominal US dollars (not deflated); exports include re-exports (large for Hong Kong, Singapore and the Netherlands). This differs from the CEPII BACI data (HS 2017, from 2017) used by the topic’s other indicators, so figures do not match exactly and should not be joined.',
};

export const electronicsHs92Part: TopicPart = {
  name: { zh: '電子產品與晶片的三十年（HS92）', en: 'Thirty years of electronics and chips (HS92)' },
  sources: [
    {
      name: {
        zh: 'The Growth Lab at Harvard University, Atlas of Economic Complexity（HS92 四位碼，1995–2024）',
        en: 'The Growth Lab at Harvard University, Atlas of Economic Complexity (HS92 four-digit, 1995–2024)',
      },
      url: 'https://doi.org/10.7910/DVN/T4CHWJ',
      license: 'CC0',
    },
  ],
  panelExtra: () => import('./panels/Hs92Panel'),
  indicators: [
    {
      id: 'hs92-exports',
      label: { zh: '的出口（1995 年起）', en: 'exports since 1995' },
      description: {
        zh: `各國這一類商品的出口額（美元）。電腦（8471）：2024 年全世界 5,400 億美元，中國 1,666 億、台灣 811 億（第 2）、美國 481 億、墨西哥 385 億、越南 382 億；台灣 1995 年 47 億、2005 年 43 億、2015 年 39 億，二十年幾乎沒變，2024 年暴增到 811 億。積體電路（8542）：1995 年美國 306 億第一、日本 289 億、南韓 159 億，台灣 41 億；2005 年台灣 266 億升到第 3；2024 年中國 1,391 億、台灣 1,388 億、南韓 1,123 億、新加坡 778 億、馬來西亞 707 億。手機在 HS92 屬於 8525：2024 年中國 1,445 億、越南 286 億、印度 188 億。${NOTE.zh}`,
        en: `Exports of the product (US dollars). Computers (8471): worldwide US$540B in 2024, with China $166.6B, Taiwan $81.1B (2nd), the US $48.1B, Mexico $38.5B and Vietnam $38.2B; Taiwan had $4.7B in 1995, $4.3B in 2005 and $3.9B in 2015, barely changing for twenty years before jumping to $81.1B in 2024. Integrated circuits (8542): in 1995 the US led with $30.6B, Japan $28.9B and South Korea $15.9B, Taiwan $4.1B; by 2005 Taiwan had $26.6B and was third; in 2024 China $139.1B, Taiwan $138.8B, South Korea $112.3B, Singapore $77.8B and Malaysia $70.7B. Phones fall under 8525 in HS92: China $144.5B, Vietnam $28.6B and India $18.8B in 2024. ${NOTE.en}`,
      },
      unit: { zh: '美元', en: 'US$' },
      file: 'hs92/{item}.json',
      dimension: DIMENSION,
      layer: { kind: 'bubble', legendValues: 'auto' },
      format: (v) => tr({ zh: `${formatLargeNumber(v)} 美元`, en: `US$${formatLargeNumber(v)}` }),
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    {
      id: 'hs92-share',
      label: { zh: '占全世界出口（1995 年起）', en: 'share of world exports since 1995' },
      description: {
        zh: `各國這一類商品的出口占全世界的比例。電腦：2024 年中國 30.8%、台灣 15.0%、美國 8.9%；積體電路：2024 年中國 18.1%、台灣 18.0%、南韓 14.6%，1995 年美國 23.0%、日本 21.7%、台灣 3.1%。半導體設備在 HS92 沒有自己的代碼（2007 年才有 8486），算在 8479「其他專用機械」裡：2024 年德國 16.3%、中國 15.9%、日本 9.5%，台灣 1.9%。${NOTE.zh}`,
        en: `Each country’s share of world exports of the product. Computers in 2024: China 30.8%, Taiwan 15.0%, the US 8.9%; integrated circuits in 2024: China 18.1%, Taiwan 18.0%, South Korea 14.6%, versus the US 23.0%, Japan 21.7% and Taiwan 3.1% in 1995. Chip-making equipment has no code of its own in HS92 (8486 arrived in 2007), so it sits in 8479 “other special machinery”: Germany 16.3%, China 15.9%, Japan 9.5% and Taiwan 1.9% in 2024. ${NOTE.en}`,
      },
      unit: '%',
      file: 'hs92-share/{item}.json',
      dimension: DIMENSION,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
  ],
};
