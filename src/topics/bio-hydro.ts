import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { TopicPart } from './parts';
import type { ColorClasses, DimensionDef, PointsOverlayDef } from './types';

/**
 * 發電廠地圖的擴充：生質能與垃圾發電廠、水力的三種型式（2026-11-07，製作手冊第二十七批 618，候選 1352、1353；
 * pipeline/topics/bio_hydro.py，資料在 public/data/topics/power-plants/）：GEM 的 Global Bioenergy Power Tracker（新檔）
 * 與 GIPT 的水力型式。不從 power-plants.ts 匯入（那個檔匯入這一份），容量的格式另外寫。
 */
const mw = (v: number) => `${fixed(v, v < 10 ? 1 : 0)} MW`;
const mwTick = (v: number) => (v >= 1000 ? `${fixed(v / 1000, 0)} GW` : `${fixed(v, 0)} MW`);
const C = MAP_TOKENS.categorical;
// 代碼要跟 pipeline/topics/bio_hydro.py 的 BIO（1–7）、other（8）一致
const BIO_FUELS = [
  { id: 'waste', label: { zh: '垃圾（都市與工業廢棄物）', en: 'Refuse (municipal and industrial waste)' }, color: C[5] },
  { id: 'landfill', label: { zh: '垃圾掩埋場沼氣', en: 'Landfill gas' }, color: C[7] },
  { id: 'agri', label: { zh: '農業廢棄物（蔗渣、稻殼等）', en: 'Agricultural waste (bagasse, rice husks…)' }, color: C[4] },
  { id: 'wood', label: { zh: '木材與其他固體生質', en: 'Wood and other solid biomass' }, color: C[3] },
  { id: 'paper', label: { zh: '紙廠廢料（黑液等）', en: 'Paper mill waste (black liquor…)' }, color: C[2] },
  { id: 'sludge', label: { zh: '污泥與廢水沼氣', en: 'Sewage sludge and wastewater biogas' }, color: C[0] },
  { id: 'liquid', label: { zh: '液體生質燃料（生質柴油等）', en: 'Liquid biofuels (biodiesel…)' }, color: C[1] },
  { id: 'other', label: { zh: '不明或其他', en: 'Unknown or other' }, color: MAP_TOKENS.categoricalOther },
];
const BIO_CLASSES: ColorClasses = {
  field: 'fuel',
  title: { zh: '燃料', en: 'Fuel' },
  thresholds: BIO_FUELS.slice(1).map((_, i) => i + 1.5),
  classes: BIO_FUELS.map((f) => ({ color: f.color, label: f.label })),
};
const HYDRO_TYPES = [
  { id: 'storage', label: { zh: '水庫式', en: 'Reservoir (conventional storage)' }, color: C[0] },
  { id: 'ror', label: { zh: '川流式', en: 'Run-of-river' }, color: C[2] },
  { id: 'pumped', label: { zh: '抽蓄', en: 'Pumped storage' }, color: C[6] },
  { id: 'mixed', label: { zh: '水庫兼川流', en: 'Reservoir and run-of-river' }, color: C[4] },
  { id: 'unknown', label: { zh: '不明', en: 'Unknown' }, color: MAP_TOKENS.categoricalOther },
];
const HYDRO_CLASSES: ColorClasses = {
  field: 'type',
  title: { zh: '水力的型式', en: 'Hydro type' },
  thresholds: HYDRO_TYPES.slice(1).map((_, i) => i + 1.5),
  classes: HYDRO_TYPES.map((f) => ({ color: f.color, label: f.label })),
};
/** 半徑（px，縮放 2 時）：GBPT 有很多 20 MW 以下的小廠，從 1 MW 起畫 */
const MW_STOPS: [number, number][] = [
  [1, 1],
  [20, 1.2],
  [100, 1.6],
  [300, 2.2],
  [1000, 3.2],
  [3000, 5.5],
  [10000, 10],
  [25000, 15.8],
];
const SIZE_LEGEND = { title: { zh: '裝置容量', en: 'Capacity' }, values: [10, 100, 1000, 10000], format: mwTick };

const BIO_PLANTS: PointsOverlayDef = {
  kind: 'points',
  id: 'bio-plants',
  file: 'bio-plants.json',
  label: { zh: '生質能電廠（GBPT，運轉中）', en: 'Bioenergy plants (GBPT, operating)' },
  indicators: ['bio-fuel'],
  radius: { field: 'mw', stops: MW_STOPS },
  color: BIO_CLASSES,
  sizeLegend: SIZE_LEGEND,
  tooltip: (p, ctx) => {
    const fuel = BIO_FUELS[(typeof p.fuel === 'number' ? p.fuel : 8) - 1];
    return {
      title: `${tr(fuel.label)} · ${typeof p.mw === 'number' ? mw(p.mw) : ''}`,
      detail: [
        typeof p.units === 'number' && p.units > 1 ? tr({ zh: `${p.units} 部機組`, en: `${p.units} units` }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
      extra: [
        p.cofire ? tr({ zh: '跟化石燃料混燒', en: 'Co-fires fossil fuel' }) : null,
        p.approx ? tr({ zh: '位置是大約的', en: 'Approximate location' }) : null,
      ].filter((x): x is string => Boolean(x)),
    };
  },
};

const HYDRO_PLANTS: PointsOverlayDef = {
  kind: 'points',
  id: 'hydro-plants',
  file: 'hydro-plants.json',
  label: { zh: '水力電廠（依型式，運轉中）', en: 'Hydro plants by type (operating)' },
  indicators: ['hydro-type'],
  radius: { field: 'mw', stops: MW_STOPS },
  color: HYDRO_CLASSES,
  sizeLegend: SIZE_LEGEND,
  tooltip: (p, ctx) => {
    const t = HYDRO_TYPES[(typeof p.type === 'number' ? p.type : 5) - 1];
    return {
      title: `${tr(t.label)} · ${typeof p.mw === 'number' ? mw(p.mw) : ''}`,
      detail: [
        typeof p.start === 'number' ? tr({ zh: `${p.start} 年啟用`, en: `opened ${p.start}` }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
    };
  },
};

const BIO_DIM: DimensionDef = {
  label: { zh: '燃料', en: 'Fuel' },
  options: [{ id: 'all', label: { zh: '全部生質能', en: 'All bioenergy' } }, ...BIO_FUELS.map(({ id, label }) => ({ id, label }))],
  defaultOption: 'waste',
};
const HYDRO_DIM: DimensionDef = {
  label: { zh: '型式', en: 'Type' },
  options: HYDRO_TYPES.map(({ id, label }) => ({ id, label })),
  defaultOption: 'storage',
};

export const bioHydroPart: TopicPart = {
  name: { zh: '生質能與水力的型式', en: 'Bioenergy and hydro types' },
  sources: [
    {
      name: { zh: 'Global Energy Monitor：Global Bioenergy Power Tracker（2026 年 9 月版）', en: 'Global Energy Monitor: Global Bioenergy Power Tracker (September 2026 release)' },
      url: 'https://globalenergymonitor.org/projects/global-bioenergy-power-tracker/',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '生質能用 GEM 的 Global Bioenergy Power Tracker（GBPT），沒有收錄門檻，比「發電廠地圖」本身用的 GIPT（生質能 20 MW 以上）多很多小廠；兩份有重疊，所以生質能的容量另外算、不跟上面的容量相加。燃料是 GEM 寫的第一個生質燃料，跟化石燃料混燒的照樣算（點上會標）。水力的型式是 GIPT 的機組分類，水力只收 30 MW 以上；抽蓄含「水庫兼抽蓄」的混合式；跨國電廠只算第一個國家。都是 2026 年 9 月版、只有一個時間點。',
    en: 'Bioenergy comes from GEM’s Global Bioenergy Power Tracker (GBPT), which has no size threshold and so includes many more small plants than the GIPT data used elsewhere in this topic (bioenergy 20 MW and up); the two overlap, so bioenergy capacity here is counted separately and not added to the totals above. Fuel is the first bioenergy fuel GEM lists; plants co-firing fossil fuel are included and flagged. Hydro types are GIPT unit classifications, covering hydro of 30 MW or more; pumped storage includes mixed conventional-and-pumped plants; cross-border plants count for the first country only. Both are the September 2026 release, a single snapshot.',
  },
  overlays: [BIO_PLANTS, HYDRO_PLANTS],
  indicators: [
    {
      id: 'bio-fuel',
      label: { zh: '生質能與垃圾發電', en: 'Bioenergy and waste-to-energy' },
      description: {
        zh: '運轉中的生質能發電容量，依燃料（子項目；GEM GBPT，2026 年 9 月）。全世界 3,228 座、119,988 MW、98 國：農業廢棄物 38,026 MW（巴西 12,242、中國 11,194、印度 4,375）、垃圾 33,790（中國 22,389 MW、765 座；美國 2,190、德國 1,707、英國 1,483、荷蘭 675、日本 545）、木材 28,140（日本 3,987、英國 3,726、美國 3,265）、紙廠廢料 15,943。台灣 19 座都是垃圾焚化廠、合計 503 MW：高雄南區 49 MW、北投 48、八里 41、桃園 40、岡山 38。',
        en: 'Operating bioenergy capacity by fuel (sub-items; GEM GBPT, September 2026). Worldwide 3,228 plants, 119,988 MW, in 98 countries: agricultural waste 38,026 MW (Brazil 12,242, China 11,194, India 4,375), refuse 33,790 (China 22,389 MW at 765 plants; the US 2,190, Germany 1,707, the UK 1,483, the Netherlands 675 and Japan 545), wood 28,140 (Japan 3,987, the UK 3,726 and the US 3,265) and paper mill waste 15,943. Taiwan’s 19 plants are all waste incinerators, 503 MW in total: Kaohsiung South 49 MW, Beitou 48, Bali 41, Taoyuan 40 and Gangshan 38.',
      },
      unit: 'MW',
      file: 'bio-fuel/{item}.json',
      dimension: BIO_DIM,
      layer: { kind: 'bubble', legendValues: [10, 100, 1000, 10000] },
      format: mw,
      formatTick: mwTick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: 'GBPT 沒有這種燃料的運轉中電廠', en: 'No operating plants of this fuel in GBPT' },
    },
    {
      id: 'hydro-type',
      label: { zh: '水力的型式：水庫式、川流式與抽蓄', en: 'Hydro by type: reservoir, run-of-river and pumped storage' },
      description: {
        zh: '運轉中的水力發電容量，依型式（子項目；GEM GIPT，30 MW 以上）。全世界 1,278,940 MW：水庫式 854,842 MW（66.8%，中國 270,640、巴西 71,012、加拿大 56,617）、川流式 192,957（15.1%，巴西 35,597、中國 23,263、印度 22,825）、抽蓄 199,973（15.6%，中國 68,436、日本 25,061、美國 22,483）；抽蓄的 340 部機組只占機組數的 6.9%，容量卻占 15.6%。水庫式會淹沒土地，川流式不會。台灣：抽蓄 2,602 MW（明潭 1,602、大觀二廠 1,000），水庫式 1,707 MW（大甲溪的青山、德基、谷關、天輪等）。',
        en: 'Operating hydropower capacity by type (sub-items; GEM GIPT, 30 MW and up). Worldwide 1,278,940 MW: reservoir 854,842 MW (66.8%; China 270,640, Brazil 71,012, Canada 56,617), run-of-river 192,957 (15.1%; Brazil 35,597, China 23,263, India 22,825) and pumped storage 199,973 (15.6%; China 68,436, Japan 25,061, the US 22,483); pumped storage’s 340 units are 6.9% of all units but 15.6% of capacity. Reservoirs flood land; run-of-river plants do not. Taiwan: pumped storage 2,602 MW (Mingtan 1,602 and Daguan II 1,000) and reservoir 1,707 MW (Chingshan, Deji, Kukuan, Tienlun and others on the Dajia River).',
      },
      unit: 'MW',
      file: 'hydro-type/{item}.json',
      dimension: HYDRO_DIM,
      layer: { kind: 'bubble', legendValues: [100, 1000, 10000, 100000] },
      format: mw,
      formatTick: mwTick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: 'GIPT 沒有這種型式的運轉中水力', en: 'No operating hydro of this type in GIPT' },
    },
  ],
};
