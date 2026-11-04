import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 人工生殖（IVF）（2026-11-04，製作手冊第二十批 312；pipeline/topics/ivf.py）：
 * 歐洲是 ESHRE 的 EIM「ART in Europe, 2019」（各國登錄），其他國家是《Human Reproduction Open》2026 的彙整，
 * 年份各國不同，所以不分年份（timeless）。台灣的療程數用國健署《112 年人工生殖施行結果分析報告》的 Table 12。
 */

const pct1 = (v: number) => `${fixed(v, 1)}%`;

export const ivf: TopicDefinition = {
  id: 'ivf',
  title: { zh: '人工生殖：試管嬰兒有多普遍', en: 'Assisted reproduction: how common is IVF?' },
  shortTitle: { zh: '人工生殖', en: 'IVF' },
  defaultIndicator: 'births-share',
  defaultYear: 2023,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Smeenk 等 2023〈ART in Europe, 2019: results generated from European registries by ESHRE〉，Human Reproduction 38(12)，表 1、表 4',
        en: 'Smeenk et al. 2023, “ART in Europe, 2019: results generated from European registries by ESHRE”, Human Reproduction 38(12), tables 1 and 4',
      },
      url: 'https://doi.org/10.1093/humrep/dead197',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Human Reproduction Open 2026，各國試管嬰兒的「cost-to-baby」研究，表 1',
        en: 'Human Reproduction Open 2026, cost-to-baby study of ART by country, table 1',
      },
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13671746/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'United Nations, World Population Prospects 2024（換算每百萬人）', en: 'United Nations, World Population Prospects 2024 (per-million figures)' },
      url: 'https://population.un.org/wpp/',
      license: 'CC BY 3.0 IGO',
    },
    {
      name: {
        zh: '衛生福利部國民健康署《112 年人工生殖施行結果分析報告》，表 12（台灣，1998–2023 年的療程數與活產數）',
        en: 'Health Promotion Administration (Taiwan), Assisted Reproductive Technology Summary 2023 National Report, Table 12 (Taiwan, cycles and live births, 1998–2023)',
      },
      url: 'https://www.hpa.gov.tw/Pages/ashx/GetFile.ashx?lang=c&type=1&sid=c0f7af55abaa4bac8d65b48e4f33e798',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '人工生殖（ART）包括試管嬰兒（IVF）、單一精蟲顯微注射（ICSI）、冷凍胚胎植入、卵子捐贈等；人工授精（IUI）不算。歐洲是歐洲人類生殖與胚胎學會（ESHRE）彙整各國登錄的 2019 年資料，有些國家不是每一家診所都回報（滑過國家看回報了幾家），數字會偏低；其他國家是 HROpen 2026 從各國登錄、醫學會與估計彙整的，年份大約是 2020–2024 年（印度是 2015 年的估計，中國也是估計），可信度寫在滑過國家的說明。「療程」的定義各國不同（例如有的算開始的週期、有的算取卵或解凍），只能看大概。台灣的療程數用國健署《人工生殖施行結果分析報告》2023 年的全部個案（含夫妻都是外國人的，跟其他國家一樣算在做療程的國家）。',
    en: 'Assisted reproductive technology (ART) covers in-vitro fertilisation (IVF), intracytoplasmic sperm injection (ICSI), frozen embryo transfer, egg donation and so on; intrauterine insemination (IUI) is not included. European figures are 2019 data compiled from national registries by the European Society of Human Reproduction and Embryology (ESHRE); in some countries not every clinic reported (hover over a country to see how many did), so those figures are too low. Other countries come from a 2026 Human Reproduction Open study that compiled registries, professional societies and estimates from roughly 2020–2024 (India’s is a 2015 estimate, and China’s is also an estimate); the hover text gives the data quality. Countries define a “cycle” differently (initiated cycles, egg retrievals or thawings), so treat comparisons as approximate. Taiwan’s cycle count is all cases in 2023 from the Health Promotion Administration’s ART report (including couples who are both foreign nationals, counted where treated as for other countries).',
  },
  indicators: [
    {
      id: 'births-share',
      label: { zh: '試管嬰兒占出生數的比例', en: 'Share of births from ART' },
      description: {
        zh: '一年出生的嬰兒裡，有多少是人工生殖（試管嬰兒）生的。台灣 11.9% 最高，南韓 11.8%、西班牙 11.7%、日本 9.3%、以色列 8.7%、澳洲與紐西蘭 5.6%、中國 3.6%、英國 3.1%、美國 2.5%、加拿大 2.2%，巴西、墨西哥 0.4%、印度 0.2%。生得少、晚生的國家比例高：台灣的生育率世界最低，試管嬰兒的比例卻最高。只有 HROpen 2026 列出的 15 國（澳洲與紐西蘭合在一起），不含歐洲大部分國家。',
        en: 'Share of a year’s births conceived with assisted reproduction. Taiwan is highest at 11.9%, followed by South Korea 11.8%, Spain 11.7%, Japan 9.3%, Israel 8.7%, Australia and New Zealand 5.6%, China 3.6%, the UK 3.1%, the US 2.5% and Canada 2.2%; Brazil and Mexico 0.4%, India 0.2%. Countries where people have fewer children later in life rank high: Taiwan has the world’s lowest fertility rate yet the highest share of IVF births. Only the 15 countries in the HROpen 2026 table (Australia and New Zealand combined); most of Europe is not included.',
      },
      unit: '%',
      file: 'births-share.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8, 10] } },
      format: pct1,
      formatTick: (v) => `${v}%`,
    },
    {
      id: 'cycles',
      label: { zh: '每百萬人口的療程數', en: 'ART cycles per million people' },
      description: {
        zh: '一年做幾個人工生殖療程，每百萬人口。以色列約 7,500 個最多，歐洲是捷克 3,621、比利時 2,960、西班牙約 2,900、愛沙尼亞 2,892、冰島 2,736、丹麥 2,715，法國 1,751、義大利 1,384、英國 1,056；歐洲以外台灣 2,511（國健署 2023 年）、南韓約 2,500、日本約 2,200、美國約 600、印度、墨西哥不到 200。歐洲回報的診所不到一半的國家（阿爾巴尼亞、波士尼亞、愛爾蘭、塞爾維亞、土耳其）不畫。',
        en: 'ART cycles performed in a year per million people. Israel has the most at about 7,500. In Europe: Czechia 3,621, Belgium 2,960, Spain about 2,900, Estonia 2,892, Iceland 2,736 and Denmark 2,715; France 1,751, Italy 1,384 and the UK 1,056. Elsewhere Taiwan 2,511 (Health Promotion Administration, 2023), South Korea about 2,500, Japan about 2,200, the US about 600, and India and Mexico under 200. European countries where fewer than half the clinics reported (Albania, Bosnia, Ireland, Serbia and Turkey) are not shown.',
      },
      unit: { zh: '每百萬人', en: 'per million' },
      file: 'cycles.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [250, 500, 1000, 1500, 2500, 4000] } },
      format: (v) => tr({ zh: `${fixed(v, 0)} 個`, en: `${fixed(v, 0)} cycles` }),
      formatTick: (v) => fixed(v, 0),
    },
    {
      id: 'multiples',
      label: { zh: '雙胞胎、三胞胎占分娩的比例（歐洲）', en: 'Twin and triplet deliveries (Europe)' },
      description: {
        zh: '新鮮週期（IVF、ICSI）的分娩裡，雙胞胎與三胞胎占幾成（2019 年）。一次植入兩三個胚胎容易多胞胎，早產與併發症的風險高；北歐多半只植入一個胚胎（冰島 100%、芬蘭 96%、瑞典 89%），雙胞胎不到 4%；塞爾維亞、蒙特內哥羅、希臘、德國常植入兩個以上，多胞胎近兩成到三成。滑過國家看只植入一個胚胎的比例。分娩不到 50 次的國家不畫。',
        en: 'Share of deliveries from fresh IVF and ICSI cycles that were twins or triplets (2019). Transferring two or three embryos at once often produces multiples, with higher risks of preterm birth and complications. Nordic countries mostly transfer a single embryo (Iceland 100%, Finland 96%, Sweden 89%) and have under 4% twins; Serbia, Montenegro, Greece and Germany often transfer two or more and have roughly 18–30% multiples. Hover to see the share of single-embryo transfers. Countries with fewer than 50 deliveries are not shown.',
      },
      unit: '%',
      file: 'multiples.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [4, 7, 10, 13, 17, 22] } },
      format: pct1,
      formatTick: (v) => `${v}%`,
    },
  ],
};
