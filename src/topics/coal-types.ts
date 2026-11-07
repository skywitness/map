import { fixed } from '../lib/format';
import type { TopicPart } from './parts';
import type { DimensionDef } from './types';

/**
 * 石油、天然氣與煤的擴充：煤的品種、煤燒去哪裡（2026-11-07，製作手冊第二十七批 614，候選 1343、1344；
 * pipeline/topics/coal_types.py，資料在 public/data/topics/fossil-fuels/）：EIA 的四種煤（MTOE）與 UNSD 能源平衡表的煤的用途。
 */
const pct = (v: number) => `${fixed(v, v > 0 && v < 1 ? 1 : 0)}%`;
const pctTick = (v: number) => `${fixed(v, 0)}%`;
const RANKS: DimensionDef = {
  label: { zh: '煤的品種', en: 'Coal rank' },
  options: [
    { id: 'anthracite', label: { zh: '無煙煤', en: 'Anthracite' } },
    { id: 'bituminous', label: { zh: '煙煤', en: 'Bituminous' } },
    { id: 'subbituminous', label: { zh: '次煙煤', en: 'Subbituminous' } },
    { id: 'lignite', label: { zh: '褐煤', en: 'Lignite' } },
  ],
  defaultOption: 'bituminous',
};
const USES: DimensionDef = {
  label: { zh: '用途', en: 'Use' },
  options: [
    { id: 'power', label: { zh: '電廠與汽電共生（發電、供熱）', en: 'Power, heat and CHP plants' } },
    { id: 'coke', label: { zh: '焦爐（煉焦炭）', en: 'Coke ovens' } },
    { id: 'steel', label: { zh: '鋼鐵業直接燒', en: 'Iron and steel (direct use)' } },
    { id: 'cement', label: { zh: '水泥等非金屬礦物', en: 'Cement and other non-metallic minerals' } },
    { id: 'households', label: { zh: '家戶', en: 'Households' } },
    { id: 'other', label: { zh: '其他（煤製油、氣化、其他產業等）', en: 'Other (coal-to-liquids, gasification, other industries…)' } },
  ],
  defaultOption: 'power',
};
const SCALE = { type: 'sequential' as const, thresholds: [5, 15, 30, 50, 75, 95] };

export const coalTypesPart: TopicPart = {
  name: { zh: '煤的品種與用途', en: 'Coal ranks and uses' },
  sources: [
    {
      name: { zh: '聯合國統計司（UNSD）能源平衡表（UNdata）', en: 'UN Statistics Division energy balances (UNdata)' },
      url: 'https://data.un.org/',
      license: { zh: 'UNdata 條款（可自由複製轉載，需註明出處）', en: 'UNdata terms of use (free to copy with citation)' },
    },
  ],
  note: {
    zh: '煤的品種用 EIA 的百萬公噸油當量（四種煤的熱值差一倍，用重量不能相加），四種合計至少 0.5 MTOE 的國家才畫。煤的用途是 UNSD 能源平衡表的原煤（焦炭、煤球這些煤製品是同一批煤轉換來的，不重複算），分母是轉換投入加最終消費，電廠含汽電共生；全部用途至少 10 PJ 的國家才畫，台灣不在 UNSD 裡。',
    en: 'Coal ranks use EIA figures in million tonnes of oil equivalent (heat content differs twofold between ranks, so tonnes cannot be added), for countries with at least 0.5 Mtoe across the four. Coal uses come from UNSD energy balances for primary coal (coke and briquettes are made from the same coal and are not counted again), with transformation inputs plus final consumption as the denominator; power plants include combined heat and power. Only countries using at least 10 PJ are shown; Taiwan is not in the UNSD data.',
  },
  indicators: [
    {
      id: 'coal-rank-production',
      label: { zh: '煤的品種：產量', en: 'Coal ranks: production' },
      description: {
        zh: '各品種的煤占煤產量的 %（依熱值）。2024 年世界 3,889 百萬公噸油當量：煙煤 61%、次煙煤 21%、無煙煤 9%、褐煤 8%。中國 2,051（煙煤 82%、無煙煤 14%）、印度 405（次煙煤 92%）、印尼 396（次煙煤 71%）、美國 229（次煙煤 50%、煙煤 40%、褐煤 9%）、俄羅斯 194（煙煤 64%）；德國、希臘產的全是褐煤，越南全是無煙煤。台灣不產煤。',
        en: 'Each coal rank’s share of coal production (by heat content). In 2024 the world produced 3,889 Mtoe: bituminous 61%, subbituminous 21%, anthracite 9% and lignite 8%. China 2,051 (bituminous 82%, anthracite 14%), India 405 (subbituminous 92%), Indonesia 396 (subbituminous 71%), the US 229 (subbituminous 50%, bituminous 40%, lignite 9%) and Russia 194 (bituminous 64%); Germany and Greece produce only lignite and Vietnam only anthracite. Taiwan produces no coal.',
      },
      unit: '%',
      file: 'coal-rank-production/{item}.json',
      dimension: RANKS,
      layer: { kind: 'choropleth', scale: SCALE },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2024,
      missing: { zh: '不產煤或產量太少', en: 'No or little coal production' },
    },
    {
      id: 'coal-rank-consumption',
      label: { zh: '煤的品種：消費', en: 'Coal ranks: consumption' },
      description: {
        zh: '各品種的煤占煤消費的 %（依熱值）。2024 年德國 30.9 百萬公噸油當量裡 64% 是褐煤、希臘 98% 褐煤、土耳其 39% 褐煤；越南 63% 是無煙煤；台灣 31.7（煙煤 82%、次煙煤 18%，全部進口）；印度 86%、印尼 86% 是次煙煤。',
        en: 'Each coal rank’s share of coal consumption (by heat content). In 2024 lignite made up 64% of Germany’s 30.9 Mtoe, 98% of Greece’s and 39% of Türkiye’s; anthracite 63% of Vietnam’s; Taiwan used 31.7 Mtoe (bituminous 82%, subbituminous 18%, all imported); subbituminous coal made up 86% in both India and Indonesia.',
      },
      unit: '%',
      file: 'coal-rank-consumption/{item}.json',
      dimension: RANKS,
      layer: { kind: 'choropleth', scale: SCALE },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2024,
      missing: { zh: '不用煤或用量太少', en: 'No or little coal use' },
    },
    {
      id: 'coal-use',
      label: { zh: '煤燒去哪裡', en: 'Where coal is used' },
      description: {
        zh: '原煤的各種用途占全部用途的 %（UNSD 能源平衡表，子項目是用途）。2023 年中國 67% 進電廠與汽電共生、16% 進焦爐、5% 給水泥等、3% 鋼鐵直接燒；美國 90% 發電；日本 24%、俄羅斯 35%、荷蘭 39% 進焦爐；英國 12% 給水泥窯；波蘭 10% 燒在家裡；伊朗 73% 進焦爐。南非、越南的「其他」不少（南非有煤製油）。',
        en: 'Share of primary coal going to each use (UNSD energy balances; sub-items are uses). In 2023 China sent 67% to power and CHP plants, 16% to coke ovens, 5% to cement and similar and 3% straight to steelmaking; the US 90% to power; coke ovens took 24% in Japan, 35% in Russia and 39% in the Netherlands; cement kilns 12% in the UK; households 10% in Poland; and coke ovens 73% in Iran. “Other” is large in South Africa (which makes liquid fuels from coal) and Vietnam.',
      },
      unit: '%',
      file: 'coal-use/{item}.json',
      dimension: USES,
      layer: { kind: 'choropleth', scale: SCALE },
      format: pct,
      formatTick: pctTick,
      defaultYear: 2023,
      missing: { zh: '用煤太少或不在 UNSD 裡', en: 'Little coal use or not in UNSD' },
    },
  ],
};
