import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 大型哺乳類還剩下幾種（2026-11-05，製作手冊第二十二批 398；pipeline/topics/megafauna.py）：PHYLACINE 1.2（CC0）
 * 每一種哺乳類「現在」與「沒有人類影響時」的分布，國界柵格化到約 96.5 km 的網格，算陸生、44 公斤以上的種數。
 * 使用者決定只做國家指標（不畫個別物種的分布）。
 */

const species = (v: number) => tr({ zh: `${fixed(v, 0)} 種`, en: `${fixed(v, 0)} species` });

export const megafauna: TopicDefinition = {
  id: 'megafauna',
  title: { zh: '大型哺乳類還剩下幾種', en: 'How many large mammals are left' },
  shortTitle: { zh: '大型哺乳類', en: 'Large mammals' },
  defaultIndicator: 'lost-share',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Faurby 等（2018），PHYLACINE 1.2：The Phylogenetic Atlas of Mammal Macroecology（Zenodo）',
        en: 'Faurby et al. (2018), PHYLACINE 1.2: The Phylogenetic Atlas of Mammal Macroecology (Zenodo)',
      },
      url: 'https://zenodo.org/records/4954990',
      license: 'CC0 1.0',
    },
  ],
  note: {
    zh: 'PHYLACINE 1.2 收最後一次間冰期（約 13 萬年前）以來的 5,831 種哺乳類，每一種有「現在」與「沒有人類影響的現在」兩張分布圖；後者是模型推估，不是觀測。這裡只算陸生、體重 44 公斤以上的種（不含海獅這類鰭足類與人屬），共 330 種，其中 176 種已經沒有野生族群（包括猛瑪象、大地懶這類更新世末滅絕的物種，原因是氣候還是人類有學術爭議）。國界依約 96.5 公里的網格算（格子中心在國內的格子），邊界附近可能多算或少算鄰國的動物；面積不到 1 萬平方公里的國家不畫。資料是 2019 年的版本，分類與 IUCN 狀態停在那時。',
    en: 'PHYLACINE 1.2 covers the 5,831 mammal species that have lived since the last interglacial (about 130,000 years ago), each with a “current” range and a “present natural” range (where it would live without human influence), the latter a model estimate rather than an observation. Only terrestrial species weighing 44 kg or more are counted here (excluding pinnipeds such as sea lions, and the genus Homo): 330 species, 176 of which no longer have wild populations, including late-Pleistocene extinctions such as mammoths and giant ground sloths whose causes (climate or humans) are debated. Countries are matched on a grid of about 96.5 km (cells whose centres fall inside the country), so border areas may gain or lose neighbouring species; countries under 10,000 km² are not shown. The data are the 2019 release, with taxonomy and IUCN status as of then.',
  },
  panelExtra: () => import('./panels/MegafaunaPanel'),
  indicators: [
    {
      id: 'lost-share',
      label: { zh: '少了幾成', en: 'Share lost' },
      description: {
        zh: '沒有人類影響時應該在這裡的大型哺乳類（陸生、44 公斤以上），現在有幾成已經不在（PHYLACINE 1.2）。159 國的中位數是 69%。澳洲 24 種只剩 1 種（95.8%，雙門齒獸、巨袋鼠都不見了），馬達加斯加 7 種全沒了（侏儒河馬、巨狐猴），英國 88.9%、巴西 85.4%、德國 84.0%、阿根廷 80.7%、美國 72.2%；非洲中部保留最多，剛果民主共和國 17.1%、坦尚尼亞 17.9%、肯亞 20.9%。台灣 4 種少了梅花鹿 1 種（25%；野外的梅花鹿是後來復育野放的，PHYLACINE 的「現在」沒有算）。',
        en: 'Share of the large mammals (terrestrial, 44 kg or more) that would live here without human influence but no longer do (PHYLACINE 1.2). The median across 159 countries is 69%. Australia has 1 of 24 left (95.8%; diprotodons and giant kangaroos are gone), Madagascar has lost all 7 (dwarf hippos, giant lemurs), the UK 88.9%, Brazil 85.4%, Germany 84.0%, Argentina 80.7% and the US 72.2%; central Africa keeps the most, with DR Congo at 17.1%, Tanzania 17.9% and Kenya 20.9%. Taiwan has lost 1 of 4, the sika deer (25%; today’s wild sika deer were reintroduced, which PHYLACINE’s current range does not include).',
      },
      unit: '%',
      file: 'lost-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 35, 50, 65, 80, 90] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
    },
    {
      id: 'now',
      label: { zh: '現在有幾種', en: 'Species today' },
      description: {
        zh: '現在野外還有的大型哺乳類（陸生、44 公斤以上）有幾種（PHYLACINE 1.2 的「現在」分布）。肯亞 35 種最多，剛果民主共和國 34、坦尚尼亞 33、中國 32、印度 31；美國 15、日本 4、德國 4、英國 2、澳洲 1，馬達加斯加 0；台灣 3 種。',
        en: 'Number of large mammal species (terrestrial, 44 kg or more) still living in the wild (PHYLACINE 1.2 current ranges). Kenya has the most with 35, then DR Congo 34, Tanzania 33, China 32 and India 31; the US 15, Japan 4, Germany 4, the UK 2, Australia 1 and Madagascar 0; Taiwan 3.',
      },
      unit: { zh: '種', en: 'species' },
      file: 'now.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [2, 5, 10, 15, 20, 30] } },
      format: species,
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'natural',
      label: { zh: '沒有人類影響時應有幾種', en: 'Species without human impact' },
      description: {
        zh: '如果沒有人類的影響，現在應該有幾種大型哺乳類（PHYLACINE 1.2 的「present natural」，模型推估）。阿根廷、玻利維亞 57 種最多，中國、美國 54、俄羅斯 51；南美與北美本來的種數，比現在種數最多的肯亞（35 種）還多。台灣 4 種。',
        en: 'Number of large mammal species that would live here today without human influence (PHYLACINE 1.2 “present natural”, a model estimate). Argentina and Bolivia top the list with 57, then China and the US 54 and Russia 51; South and North America would have had more than Kenya, the richest country today (35). Taiwan 4.',
      },
      unit: { zh: '種', en: 'species' },
      file: 'natural.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [5, 10, 20, 30, 40, 50] } },
      format: species,
      formatTick: (v) => fixed(v, 0),
    },
  ],
};
