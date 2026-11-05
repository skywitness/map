import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicPart } from './parts';
import type { IndicatorDef } from './types';

/**
 * 都市垃圾（2026-11-04，主題盤點的擴4；pipeline/topics/waste.py，資料在 public/data/topics/waste/）：
 * 世界銀行 What a Waste 3.0 的國家資料，廢棄物與回收主題（plastic.ts）的 withParts 接上。各國的資料年份不同，指標都不分年份，
 * 每個國家的附註寫資料年份。
 */

const PCT = '%';
const pct = (v: number) => `${fixed(v, v < 10 && v !== 0 ? 1 : 0)}%`;
const KG_DAY = { zh: '公斤/人/天', en: 'kg/person/day' };
const TONNES = { zh: '公噸', en: 'tonnes' };

function share(id: string, label: { zh: string; en: string }, description: { zh: string; en: string }, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: PCT,
    file: `../waste/${id}.json`,
    timeless: true,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds } },
    format: pct,
    formatTick: (v) => `${fixed(v, 0)}%`,
  };
}

export const wastePart: TopicPart = {
  name: { zh: '都市垃圾', en: 'Municipal waste' },
  sources: [
    {
      name: {
        zh: 'World Bank, What a Waste 3.0 國家資料（2026 年 3 月；Cook 等 2026）',
        en: 'World Bank, What a Waste 3.0 country dataset (March 2026; Cook et al. 2026)',
      },
      url: 'https://datacatalog.worldbank.org/search/dataset/0039597',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '都市垃圾是家戶、商店、機關等產生、由地方政府負責的垃圾（不含工業、營建、農業廢棄物），各國的定義與量法不同，每個國家的資料年份也不同（2003–2025 年，寫在附註）。處理方式是占產生量的比例，只有各國有報的項目：報的項目加起來不到 95%，或「其他」「不明」加起來三成以上的國家不畫；其他國家沒報的項目當成 0，但回收、堆肥一項都沒報的國家（例如中國）回收的比例是沒有資料。只算正式處理的都市垃圾，拾荒、資源回收業收走的不在裡面。台灣是環境部 2023 年的數字。',
    en: 'Municipal solid waste is waste from households, shops, offices and similar sources that local governments are responsible for (not industrial, construction or agricultural waste); definitions and measurement differ between countries, and so do the data years (2003–2025, given in each country’s note). Treatment shares are percentages of waste generated, using only the categories each country reports: countries whose reported categories add up to less than 95%, or whose “other” and “unaccounted” together reach 30%, are not shown; for the rest, unreported categories count as zero, except that countries reporting no recycling or composting at all (China, for example) have no recycling figure. Only formally managed municipal waste is included, not material taken by waste pickers or the recycling trade. Taiwan’s figures are from its Ministry of Environment for 2023.',
  },
  indicators: [
    {
      id: 'msw-per-capita',
      label: { zh: '每人每天的垃圾', en: 'Municipal waste per person' },
      description: {
        zh: '每人每天產生多少公斤都市垃圾。越富裕的國家通常越多：美國 2.18、德國 1.63，台灣 1.36、南韓 1.22、中國 0.97、日本 0.88；衣索比亞 0.10、布吉納法索 0.06。',
        en: 'Kilograms of municipal waste generated per person per day. Richer countries usually generate more: the US 2.18, Germany 1.63, Taiwan 1.36, South Korea 1.22, China 0.97, Japan 0.88; Ethiopia 0.10, Burkina Faso 0.06.',
      },
      unit: KG_DAY,
      file: '../waste/msw-per-capita.json',
      timeless: true,
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.3, 0.5, 0.8, 1.1, 1.5, 2] } },
      format: (v) => `${fixed(v, 2)} ${tr(KG_DAY)}`,
      formatTick: (v) => fixed(v, 1),
    },
    {
      id: 'msw-total',
      label: { zh: '一年的都市垃圾', en: 'Municipal waste generated' },
      description: {
        zh: '一年產生多少公噸都市垃圾，圓的面積與它成正比。中國約 5 億公噸、美國 2.7 億、印度 2.0 億最多；台灣 1,158 萬公噸。',
        en: 'Tonnes of municipal waste generated in a year; circle area is proportional to the amount. China (about 500 million tonnes), the US (270 million) and India (200 million) generate the most; Taiwan 11.6 million tonnes.',
      },
      unit: TONNES,
      file: '../waste/msw-total.json',
      timeless: true,
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: (v) => `${formatLargeNumber(v)} ${tr(TONNES)}`,
      formatTick: formatLargeTick,
      shareOfWorld: true,
    },
    share(
      'waste-recycled',
      { zh: '回收與堆肥的比例', en: 'Recycled or composted' },
      {
        zh: '都市垃圾有多少比例回收、堆肥或厭氧消化（變成沼氣）。德國 69%、奧地利 69%、南韓 60%、台灣 58%、美國 39%、日本 17%、巴西 2%；中國等沒有報回收的國家是沒有資料。',
        en: 'Share of municipal waste recycled, composted or anaerobically digested. Germany 69%, Austria 69%, South Korea 60%, Taiwan 58%, the US 39%, Japan 17%; Brazil 2%. Countries that report no recycling, such as China, have no data.',
      },
      [5, 10, 20, 30, 45, 60],
    ),
    share(
      'waste-incinerated',
      { zh: '焚化的比例', en: 'Incinerated' },
      {
        zh: '都市垃圾有多少比例焚化（多半有發電）。日本 77%、中國 75%、瑞典 55%、台灣 38%、德國 30%、美國 12%。',
        en: 'Share of municipal waste incinerated (mostly with energy recovery). Japan 77%, China 75%, Sweden 55%, Taiwan 38%, Germany 30%, the US 12%.',
      },
      [5, 15, 30, 45, 60, 75],
    ),
    share(
      'waste-landfilled',
      { zh: '掩埋的比例', en: 'Landfilled' },
      {
        zh: '都市垃圾有多少比例送進掩埋場（衛生、控制或沒有說明的掩埋場，不含露天傾倒）。巴西 78%、美國 49%、中國 19%，台灣、日本、德國都在 2% 以下。',
        en: 'Share of municipal waste sent to landfills (sanitary, controlled or unspecified; not open dumps). Brazil 78%, the US 49%, China 19%; Taiwan, Japan and Germany under 2%.',
      },
      [5, 15, 30, 50, 70, 90],
    ),
    share(
      'waste-dumped',
      { zh: '露天傾倒或沒有收集的比例', en: 'Open-dumped or uncollected' },
      {
        zh: '都市垃圾有多少比例倒在露天垃圾場或根本沒有收集（自己燒掉、丟在路邊、河裡）。巴西 20%；很多低所得國家超過一半，台灣、日本、歐美幾乎是 0。',
        en: 'Share of municipal waste dumped in open dumps or not collected at all (burned, dumped by the roadside or in rivers). Brazil 20%; over half in many low-income countries, and close to zero in Taiwan, Japan, Europe and North America.',
      },
      [1, 5, 15, 30, 50, 75],
    ),
  ],
};
