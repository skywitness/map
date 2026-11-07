import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 物質流與循環經濟（新主題，2026-11-07，製作手冊第二十五批 490，候選 1168；環境的「污染與廢棄物」）：
 * OECD 的物質流帳（國內物質消費、物質足跡，公噸／人，含台灣的國內物質消費）與 Eurostat 的循環物質使用率
 * （pipeline/topics/materials.py）
 */
const T_PC = { zh: '公噸/人', en: 't/person' };
const GROUP_DIM = {
  label: { zh: '物質', en: 'Material' },
  options: [
    { id: 'all', label: { zh: '全部物質', en: 'All materials' } },
    { id: 'biomass', label: { zh: '生物質（糧食、飼料、木材）', en: 'Biomass (food, feed, wood)' } },
    { id: 'metals', label: { zh: '金屬', en: 'Metals' } },
    { id: 'minerals', label: { zh: '非金屬礦物（砂石、水泥原料等）', en: 'Non-metallic minerals (sand, gravel, cement raw materials, etc.)' } },
    { id: 'fossil', label: { zh: '化石能源', en: 'Fossil fuels' } },
  ],
  defaultOption: 'all',
};
const SCALES: Record<string, ScaleSpec> = {
  all: { type: 'sequential', thresholds: [5, 10, 15, 20, 30, 40] },
  biomass: { type: 'sequential', thresholds: [1, 2, 3, 5, 8, 12] },
  metals: { type: 'sequential', thresholds: [0.2, 0.5, 1, 2, 5, 10] },
  minerals: { type: 'sequential', thresholds: [2, 4, 6, 10, 15, 25] },
  fossil: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8, 15] },
};
const tpc = (v: number) => tr({ zh: `${fixed(v, v < 10 ? 2 : 1)} ${T_PC.zh}`, en: `${fixed(v, v < 10 ? 2 : 1)} ${T_PC.en}` });

export const materials: TopicDefinition = {
  id: 'materials',
  title: { zh: '物質流與循環經濟', en: 'Material flows and the circular economy' },
  shortTitle: { zh: '物質流', en: 'Material flows' },
  defaultIndicator: 'dmc',
  defaultYear: 2024,
  sources: [
    {
      name: { zh: 'OECD：Material flow accounts（DF_MATERIAL_RESOURCES）', en: 'OECD: Material flow accounts (DF_MATERIAL_RESOURCES)' },
      url: 'https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_MATERIAL_RESOURCES%40DF_MATERIAL_RESOURCES&df[ag]=OECD.ENV.EPI',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'Eurostat：Circular material use rate（cei_srm030）', en: 'Eurostat: Circular material use rate (cei_srm030)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/cei_srm030/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '國內物質消費（DMC）是一國境內開採的物質加上進口、減掉出口，算的是「在這個國家用掉的」；礦業與農產品出口國的開採量大，扣掉出口後仍偏高，不代表國民消費多。物質足跡（MF）把進出口商品在生產過程中用掉的原料都換算回來，是從消費的角度算，所以香港、新加坡、盧森堡這類進口多的地方會比國內物質消費高很多。兩個指標要一起看。國內物質消費是負的（蒙特塞拉特）或每人不到 0.5 公噸的（關島、北馬里亞納群島、美屬維京群島等屬地）是貿易數字算出來的異常，沒有畫。台灣（OECD 寫 Chinese Taipei）只有國內物質消費，沒有物質足跡。循環物質使用率是回收再利用的物質占全部物質使用的比例，只有歐盟國家（英國照網站的規則不收）。',
    en: 'Domestic material consumption (DMC) is materials extracted in a country plus imports minus exports – what is used up within its borders. Mining and agricultural exporters extract so much that their DMC stays high even after exports are subtracted, which does not mean their people consume more. The material footprint (MF) converts traded goods back into the raw materials used to make them, a consumption-based measure, so import-heavy places such as Hong Kong, Singapore and Luxembourg have footprints far above their DMC. Read the two together. Negative DMC (Montserrat) or below 0.5 t per person (Guam, the Northern Mariana Islands, the US Virgin Islands and other territories) are artefacts of trade figures and are not shown. Taiwan (Chinese Taipei in OECD data) has DMC but no material footprint. The circular material use rate is recycled material as a share of all material use, for EU countries only (the UK is excluded under the site’s rules).',
  },
  indicators: [
    {
      id: 'dmc',
      label: { zh: '每人的國內物質消費', en: 'Domestic material consumption per person' },
      description: {
        zh: '每人一年在國內用掉的物質（開採＋進口－出口，公噸），2024 年。全世界平均 13.1 公噸；加拿大 57.5、智利 53.1、蒙古 47.5、澳洲 46.2、新喀里多尼亞 41.6、芬蘭 38.6、卡達 34.5，多是礦業或能源出口國；中國 26.8、美國 23.0、南韓 20.0、台灣 12.6、德國 11.7、日本 11.2、荷蘭 8.0、印度 6.1。台灣 1980 年是 10.2、2000 年 13.2。',
        en: 'Materials used up within the country per person per year (extraction + imports − exports, tonnes), 2024. The world average was 13.1 t; Canada 57.5, Chile 53.1, Mongolia 47.5, Australia 46.2, New Caledonia 41.6, Finland 38.6 and Qatar 34.5, mostly mining or energy exporters; China 26.8, the US 23.0, South Korea 20.0, Taiwan 12.6, Germany 11.7, Japan 11.2, the Netherlands 8.0 and India 6.1. Taiwan was at 10.2 in 1980 and 13.2 in 2000.',
      },
      unit: T_PC,
      file: 'dmc/{item}.json',
      dimension: GROUP_DIM,
      layer: { kind: 'choropleth', scale: SCALES.all, itemScales: SCALES },
      format: tpc,
      formatTick: (v) => String(v),
      compareWorld: true,
    },
    {
      id: 'footprint',
      label: { zh: '每人的物質足跡', en: 'Material footprint per person' },
      description: {
        zh: '為了這個國家的最終消費，全世界開採了多少物質（每人，公噸），2024 年。全世界平均 12.8 公噸；盧森堡 74.0、卡達 68.5、新加坡 56.4、香港 49.7、比利時 47.1、瑞士 40.4；荷蘭 32.3（國內物質消費只有 8.0）、美國 31.2、中國 25.8、德國 24.4、南韓 24.3、日本 17.9、印度 5.4；最低的阿富汗 1.23、葉門 1.41、蒲隆地 1.53，最高與最低差 60 倍。台灣沒有資料。',
        en: 'Raw materials extracted worldwide to meet the country’s final consumption (tonnes per person), 2024. The world average was 12.8 t; Luxembourg 74.0, Qatar 68.5, Singapore 56.4, Hong Kong 49.7, Belgium 47.1, Switzerland 40.4; the Netherlands 32.3 (against a DMC of only 8.0), the US 31.2, China 25.8, Germany 24.4, South Korea 24.3, Japan 17.9 and India 5.4; lowest are Afghanistan (1.23), Yemen (1.41) and Burundi (1.53), a 60-fold gap. No data for Taiwan.',
      },
      unit: T_PC,
      file: 'footprint/{item}.json',
      dimension: GROUP_DIM,
      layer: { kind: 'choropleth', scale: SCALES.all, itemScales: SCALES },
      format: tpc,
      formatTick: (v) => String(v),
      compareWorld: true,
    },
    {
      id: 'circular',
      label: { zh: '循環物質使用率', en: 'Circular material use rate' },
      description: {
        zh: '回收再利用的物質占全部物質使用的比例（歐盟國家），2024 年。歐盟 27 國 12.2%（2004 年 8.2%）；荷蘭 32.7%、比利時 22.7%、義大利 21.6%、愛沙尼亞 20.5%、馬爾他 18.6%、法國 17.8%、奧地利 15.2%、捷克與德國 14.8%；最低的羅馬尼亞 1.3%、愛爾蘭與芬蘭 2.0%、葡萄牙 3.0%。',
        en: 'Recycled material as a share of all material use (EU countries), 2024. The EU-27 rate was 12.2% (8.2% in 2004); the Netherlands 32.7%, Belgium 22.7%, Italy 21.6%, Estonia 20.5%, Malta 18.6%, France 17.8%, Austria 15.2%, Czechia and Germany 14.8%; lowest are Romania (1.3%), Ireland and Finland (2.0%) and Portugal (3.0%).',
      },
      unit: '%',
      file: 'circular.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [3, 5, 8, 12, 16, 20] } },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: { zh: '沒有資料（只有歐盟國家）', en: 'No data (EU countries only)' },
    },
  ],
};
