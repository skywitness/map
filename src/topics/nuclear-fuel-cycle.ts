import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import { topicPart } from './merge';
import type { CategoryDef, TopicDefinition } from './types';

/**
 * 核燃料循環：誰能濃縮鈾、做燃料、再處理（2026-11-08，製作手冊第二十七批 624，候選 1362；pipeline/topics/nuclear_fuel_cycle.py）：
 * 英文維基的濃縮國家與再處理場（只到國家），加上 Eurostat 的歐洲數量。不單獨上架，併進「核能」（nuclear.ts）。
 */
const C = MAP_TOKENS.categorical;
// 代碼要跟 pipeline 的 build() 一致
const CYCLE: CategoryDef[] = [
  { value: 1, label: { zh: '能濃縮，也有再處理場（含已關閉）', en: 'Enrichment and reprocessing sites (incl. closed)' }, color: C[5] },
  { value: 2, label: { zh: '只能濃縮', en: 'Enrichment only' }, color: C[2] },
  { value: 3, label: { zh: '只有再處理場（含已關閉）', en: 'Reprocessing sites only (incl. closed)' }, color: C[1] },
  { value: 4, label: { zh: '過去有濃縮計畫', en: 'Former enrichment programme' }, color: MAP_TOKENS.categoricalOther },
];
const cycleLabel = (v: number) => {
  const l = CYCLE.find((c) => c.value === v)?.label;
  return l ? (typeof l === 'string' ? l : tr(l)) : '';
};
const NONE = { zh: '沒有', en: 'None' };
const EUROSTAT_NONE = { zh: '沒有（Eurostat 只有歐洲）', en: 'None (Eurostat covers Europe only)' };

export const nuclearFuelCycle: TopicDefinition = {
  id: 'nuclear-fuel-cycle',
  title: { zh: '核燃料循環：濃縮、燃料製造與再處理', en: 'Nuclear fuel cycle: enrichment, fuel fabrication and reprocessing' },
  shortTitle: { zh: '核燃料循環', en: 'Nuclear fuel cycle' },
  defaultIndicator: 'fuel-cycle',
  defaultYear: 2026,
  sources: [
    {
      name: {
        zh: '英文維基百科「Enriched uranium」（revid 1377480731）與「Nuclear reprocessing」（revid 1379213282）',
        en: 'English Wikipedia, “Enriched uranium” (revision 1377480731) and “Nuclear reprocessing” (revision 1379213282)',
      },
      url: 'https://en.wikipedia.org/wiki/Nuclear_reprocessing?oldid=1379213282',
      license: 'CC BY-SA 4.0',
    },
    {
      name: { zh: 'Eurostat：核能設施（nrg_inf_nuc）', en: 'Eurostat: nuclear energy facilities (nrg_inf_nuc)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_inf_nuc/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '燃料循環：鈾礦提煉後要先「濃縮」（提高鈾 235 的比例），再做成燃料元件，用過的燃料可以「再處理」取出鈾與鈽。全世界只能看「有沒有」（英文維基，再處理場含已經關閉的）；數量只有 Eurostat 的歐洲，俄羅斯（世界最大的濃縮國之一）、美國、中國都不在裡面。台灣沒有濃縮、燃料製造或再處理設施。',
    en: 'The fuel cycle: mined uranium is first enriched (raising the share of uranium-235), then made into fuel assemblies; spent fuel can be reprocessed to recover uranium and plutonium. Worldwide only presence is shown (English Wikipedia; reprocessing sites include closed ones); quantities are Eurostat figures for Europe only, so Russia (one of the largest enrichers), the US and China are not included. Taiwan has no enrichment, fuel fabrication or reprocessing facilities.',
  },
  indicators: [
    {
      id: 'fuel-cycle',
      label: { zh: '核燃料循環：能濃縮、能再處理的國家', en: 'Nuclear fuel cycle: countries that enrich and reprocess' },
      description: {
        zh: '英文維基列的現在有鈾濃縮設施的 14 國：阿根廷、巴西、中國、法國、德國、印度、伊朗、日本、荷蘭、北韓、巴基斯坦、俄羅斯、英國、美國；過去有濃縮計畫的：利比亞、南非。再處理場表上 35 座（含已關閉、興建中）：法國 6、俄羅斯 5、美國 5、英國 4、印度 4、中國 3、日本 2、巴基斯坦 2，比利時、德國、義大利、以色列各 1。德國、比利時、義大利的都已經關閉；表上寫到現在仍在運轉的有法國馬庫勒的一座、以色列的迪莫納、巴基斯坦的兩座，日本六所村與俄羅斯、中國各一座在興建中。',
        en: 'English Wikipedia lists 14 countries currently operating uranium enrichment facilities: Argentina, Brazil, China, France, Germany, India, Iran, Japan, the Netherlands, North Korea, Pakistan, Russia, the UK and the US; Libya and South Africa had enrichment programmes in the past. Its table lists 35 reprocessing sites (including closed and planned ones): France 6, Russia 5, the US 5, the UK 4, India 4, China 3, Japan 2, Pakistan 2, and Belgium, Germany, Italy and Israel 1 each. Those in Germany, Belgium and Italy have all closed; sites listed as operating to the present are one at Marcoule in France, Dimona in Israel and two in Pakistan, while Rokkasho in Japan and one each in Russia and China are under construction.',
      },
      unit: '',
      file: 'fuel-cycle.json',
      layer: { kind: 'categorical', categories: CYCLE },
      format: cycleLabel,
      timeless: true,
      missing: NONE,
    },
    {
      id: 'enrichment-capacity',
      label: { zh: '歐洲的鈾濃縮能力', en: 'Uranium enrichment capacity in Europe' },
      description: {
        zh: '鈾濃縮工廠一年的分離功（tSWU，Eurostat，只有歐洲）。2024 年法國 7,500、荷蘭 5,000、德國 3,500，其他國家 0。英國照網站的規則不收。',
        en: 'Annual separative work capacity of uranium enrichment plants (tSWU; Eurostat, Europe only). In 2024 France had 7,500, the Netherlands 5,000 and Germany 3,500; all other countries 0. The UK is excluded under this site’s rules.',
      },
      unit: 'tSWU',
      file: 'enrichment-capacity.json',
      layer: { kind: 'bubble', legendValues: [1000, 5000] },
      format: (v) => `${fixed(v, 0)} tSWU`,
      formatTick: formatLargeTick,
      missing: EUROSTAT_NONE,
    },
    {
      id: 'fuel-fabrication',
      label: { zh: '歐洲的核燃料元件產能', en: 'Nuclear fuel fabrication capacity in Europe' },
      description: {
        zh: '新核燃料元件一年最多能做多少（噸重金屬，tHM；Eurostat，只有歐洲）。2024 年法國 1,400、德國 650、瑞典 600、西班牙 500、羅馬尼亞 232；實際產量法國 641、瑞典 347、德國 228、西班牙 224、羅馬尼亞 213。再處理（產能 1,250 tHM、實際 871）與 MOX 燃料（產能 150、實際 82）只有法國。',
        en: 'Maximum annual output of new nuclear fuel assemblies (tonnes of heavy metal, tHM; Eurostat, Europe only). In 2024 France had 1,400, Germany 650, Sweden 600, Spain 500 and Romania 232; actual output was France 641, Sweden 347, Germany 228, Spain 224 and Romania 213. Reprocessing (capacity 1,250 tHM, actual 871) and MOX fuel (capacity 150, actual 82) exist only in France.',
      },
      unit: 'tHM',
      file: 'fuel-fabrication.json',
      layer: { kind: 'bubble', legendValues: [100, 1000] },
      format: (v) => `${fixed(v, 0)} tHM`,
      formatTick: formatLargeTick,
      missing: EUROSTAT_NONE,
    },
    {
      id: 'burnup',
      label: { zh: '用過核燃料的燃耗度', en: 'Burn-up of spent nuclear fuel' },
      description: {
        zh: '退出爐心的燃料平均燒了多少（每噸重金屬產生幾個吉瓦日的熱，GWd/tHM；Eurostat，只有歐洲）。數字越高，同樣的燃料發越多電。2024 年西班牙 50.4、瑞典 49.8、保加利亞 49.6、捷克 47.7、芬蘭 47.1、比利時與匈牙利 47.0、法國 45.4；羅馬尼亞只有 7.2（CANDU 重水堆，用天然鈾）。',
        en: 'Average burn-up of fuel leaving the reactor core (gigawatt-days of heat per tonne of heavy metal, GWd/tHM; Eurostat, Europe only). Higher means more electricity from the same fuel. In 2024 Spain had 50.4, Sweden 49.8, Bulgaria 49.6, Czechia 47.7, Finland 47.1, Belgium and Hungary 47.0 and France 45.4; Romania only 7.2 (CANDU heavy water reactors, which use natural uranium).',
      },
      unit: 'GWd/tHM',
      file: 'burnup.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 40, 45, 48, 50] } },
      format: (v) => `${fixed(v, 1)} GWd/tHM`,
      formatTick: (v) => fixed(v, 0),
      defaultYear: 2024,
      missing: EUROSTAT_NONE,
    },
  ],
};

export const fuelCyclePart = topicPart(nuclearFuelCycle, { name: { zh: '核燃料循環', en: 'Nuclear fuel cycle' } });
