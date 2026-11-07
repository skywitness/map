import { tr } from '../i18n/lang';
import { fixed, formatLargeTick } from '../lib/format';
import { MAP_TOKENS } from '../theme/tokens';
import type { CategoryDef, ColorClasses, DimensionDef, PointsOverlayDef, TopicDefinition } from './types';

/**
 * 核電機組：機型、型號與機齡（新主題，2026-11-07，製作手冊第二十七批 622，候選 1359、1360；能源・核能，
 * 這一項把「核能」從「電力」獨立成小類）：GEM 的 Global Nuclear Power Tracker 加上 GIPT 的併網年份
 * （pipeline/topics/nuclear_reactors.py）。
 */
const C = MAP_TOKENS.categorical;
// 代碼要跟 pipeline/topics/nuclear_reactors.py 的 TYPE_CODE 一致
const TYPES: CategoryDef[] = [
  { value: 1, label: { zh: '壓水式（PWR）', en: 'Pressurised water (PWR)' }, color: C[0] },
  { value: 2, label: { zh: '沸水式（BWR）', en: 'Boiling water (BWR)' }, color: C[1] },
  { value: 3, label: { zh: '重水式（CANDU 等）', en: 'Heavy water (CANDU…)' }, color: C[2] },
  { value: 4, label: { zh: '氣冷式（含高溫氣冷）', en: 'Gas-cooled (incl. high-temperature)' }, color: C[3] },
  { value: 5, label: { zh: '輕水石墨式（RBMK）', en: 'Light water graphite (RBMK)' }, color: C[5] },
  { value: 6, label: { zh: '快中子式', en: 'Fast reactor' }, color: C[6] },
  { value: 7, label: { zh: '小型模組化與微型', en: 'Small modular and micro' }, color: C[7] },
  { value: 8, label: { zh: '不明', en: 'Unknown' }, color: MAP_TOKENS.categoricalOther },
];
const TYPE_CLASSES: ColorClasses = {
  field: 'type',
  title: { zh: '機型', en: 'Reactor type' },
  thresholds: TYPES.slice(1).map((t) => t.value - 0.5),
  classes: TYPES.map((t) => ({ color: t.color!, label: t.label })),
};
const typeLabel = (v: number) => {
  const l = TYPES.find((t) => t.value === v)?.label;
  return l ? (typeof l === 'string' ? l : tr(l)) : '';
};
const STATUS = [
  { zh: '運轉中', en: 'Operating' },
  { zh: '興建中', en: 'Under construction' },
  { zh: '規劃中', en: 'Planned' },
];
const mw = (v: number) => `${fixed(v, v < 10 ? 1 : 0)} MW`;
const MW_STOPS: [number, number][] = [
  [1, 1],
  [100, 1.6],
  [500, 2.6],
  [1500, 4],
  [4000, 6.5],
  [8000, 9],
];
const SIZE_LEGEND = { title: { zh: '裝置容量', en: 'Capacity' }, values: [100, 1000, 5000], format: (v: number) => `${fixed(v, 0)} MW` };

const reactorLayer = (id: string, label: PointsOverlayDef['label'], hidden: boolean, look?: PointsOverlayDef['look']): PointsOverlayDef => ({
  kind: 'points',
  id: `reactors-${id}`,
  file: `reactors-${id}.json`,
  label,
  ...(hidden ? { hidden: true } : {}),
  ...(look ? { look } : {}),
  radius: { field: 'mw', stops: MW_STOPS },
  color: TYPE_CLASSES,
  sizeLegend: SIZE_LEGEND,
  indicators: ['main-type', 'fleet-age', 'type-capacity'],
  tooltip: (p, ctx) => {
    const st = typeof p.st === 'number' ? p.st : 1;
    const units = typeof p.units === 'number' ? p.units : 1;
    return {
      title: `${typeLabel(typeof p.type === 'number' ? p.type : 8)} · ${typeof p.mw === 'number' ? mw(p.mw) : ''}`,
      detail: [
        tr(STATUS[st - 1]),
        units > 1 ? tr({ zh: `${units} 部機組`, en: `${units} units` }) : null,
        typeof p.start === 'number' ? tr({ zh: `${p.start} 年起併網`, en: `grid connection from ${p.start}` }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
      extra: [
        typeof p.model === 'string' && p.model ? tr({ zh: `型號：${p.model}`, en: `Model: ${p.model}` }) : null,
        typeof p.operator === 'string' && p.operator ? tr({ zh: `營運者：${p.operator}`, en: `Operator: ${p.operator}` }) : null,
      ].filter((x): x is string => Boolean(x)),
    };
  },
});

// 狀態用不同樣式（同發電廠地圖）：運轉中實心、興建中空心、規劃中淡色並預設關閉
const OPERATING = reactorLayer('operating', { zh: '運轉中的機組', en: 'Operating reactors' }, false);
const CONSTRUCTION = reactorLayer('construction', { zh: '興建中的機組', en: 'Reactors under construction' }, false, 'hollow');
const PLANNED = reactorLayer('planned', { zh: '規劃中的機組', en: 'Planned reactors' }, true, 'faint');

/** 已退役的機組（第二十七批 623）：依退役年份累計出現 */
const RETIRED: PointsOverlayDef = {
  kind: 'points',
  id: 'reactors-retired',
  file: 'reactors-retired.json',
  label: { zh: '已退役的機組', en: 'Retired reactors' },
  indicators: ['retired-capacity', 'retired-count'],
  radius: { field: 'mw', stops: MW_STOPS },
  color: TYPE_CLASSES,
  sizeLegend: SIZE_LEGEND,
  timeField: 'end',
  tooltip: (p, ctx) => {
    const units = typeof p.units === 'number' ? p.units : 1;
    return {
      title: `${typeLabel(typeof p.type === 'number' ? p.type : 8)} · ${typeof p.mw === 'number' ? mw(p.mw) : ''}`,
      detail: [
        typeof p.end === 'number' ? tr({ zh: `${p.end} 年退役`, en: `retired ${p.end}` }) : null,
        units > 1 ? tr({ zh: `${units} 部機組`, en: `${units} units` }) : null,
        typeof p.start === 'number' ? tr({ zh: `${p.start} 年併網`, en: `connected ${p.start}` }) : null,
        typeof p.iso3 === 'string' ? ctx.countryName(p.iso3) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      properNoun: typeof p.name === 'string' ? p.name : undefined,
    };
  },
};

const TYPE_DIM: DimensionDef = {
  label: { zh: '機型', en: 'Reactor type' },
  options: [
    { id: 'pwr', label: { zh: '壓水式', en: 'Pressurised water' } },
    { id: 'bwr', label: { zh: '沸水式', en: 'Boiling water' } },
    { id: 'phwr', label: { zh: '重水式', en: 'Heavy water' } },
    { id: 'gas', label: { zh: '氣冷式', en: 'Gas-cooled' } },
    { id: 'lwgr', label: { zh: '輕水石墨式（RBMK）', en: 'Light water graphite (RBMK)' } },
    { id: 'fast', label: { zh: '快中子式', en: 'Fast reactor' } },
  ],
  defaultOption: 'pwr',
};

export const nuclearReactors: TopicDefinition = {
  id: 'nuclear-reactors',
  title: { zh: '核電機組：機型、型號與機齡', en: 'Nuclear reactors: types, models and ages' },
  shortTitle: { zh: '核電機組', en: 'Nuclear reactors' },
  defaultIndicator: 'main-type',
  defaultYear: 2026,
  sources: [
    {
      name: { zh: 'Global Energy Monitor：Global Nuclear Power Tracker（2026 年 8 月版）、Global Integrated Power Tracker（2026 年 9 月版，併網年份）', en: 'Global Energy Monitor: Global Nuclear Power Tracker (August 2026), Global Integrated Power Tracker (September 2026, grid connection years)' },
      url: 'https://globalenergymonitor.org/projects/global-nuclear-power-tracker/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '核能安全委員會：核能電廠基本資料（data.gov.tw 109454）', en: 'Nuclear Safety Commission (Taiwan): basic data on nuclear power plants (data.gov.tw 109454)' },
      url: 'https://data.gov.tw/dataset/109454',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, Taiwan, v1' },
    },
    {
      name: { zh: 'Eurostat：核能設施與核熱（nrg_inf_nuc）、各燃料的毛發電量（nrg_bal_peh）', en: 'Eurostat: nuclear infrastructure and heat (nrg_inf_nuc), gross electricity production by fuel (nrg_bal_peh)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_inf_nuc/default/table',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '機型與型號是 GEM 的核電追蹤資料（2026 年 8 月），只有一個時間點；機齡是 2026 年減掉 GIPT 記的併網年份（不是第一次臨界），各國用容量加權平均。點是運轉中、興建中與規劃中的機組，同一座電廠同一狀態同一機型併成一點；已退役的機組在退役的兩個指標另有圖層，依退役年份累計。熱效率只有 Eurostat 的歐洲。核融合裝置不算。台灣的資料用核能安全委員會的核能電廠基本資料。',
    en: 'Reactor types and models come from GEM’s nuclear power tracker (August 2026), a single snapshot; age is 2026 minus the grid connection year recorded in GIPT (not first criticality), averaged by capacity for each country. Points show operating, under-construction and planned reactors, with units of the same type and status at one plant merged; retired reactors have their own layer on the two retirement indicators, appearing by retirement year. Thermal efficiency covers Europe only (Eurostat). Fusion devices are excluded. Taiwan details come from the Nuclear Safety Commission’s basic data on nuclear plants.',
  },
  overlays: [OPERATING, CONSTRUCTION, PLANNED, RETIRED],
  indicators: [
    {
      id: 'main-type',
      label: { zh: '主要的反應爐機型', en: 'Main reactor type' },
      description: {
        zh: '每一國運轉中容量最大的反應爐機型。全世界運轉中 424 部、407,801 MW，壓水式 319,620 MW 占 78%，32 國裡 24 國以壓水式為主；加拿大、印度、阿根廷、羅馬尼亞以重水式（CANDU 等）為主，瑞典、墨西哥以沸水式為主，英國是氣冷式（AGR）。型號最多的（含興建中與規劃中）是 AP-1000 117 部、華龍一號（HPR-1000）66、NuScale 61、BWRX-300 47。點地圖上的機組看型號與營運者。',
        en: 'The reactor type with the most operating capacity in each country. The world has 424 operating reactors with 407,801 MW; pressurised water reactors make up 319,620 MW (78%) and dominate in 24 of 32 countries. Canada, India, Argentina and Romania mainly use heavy water reactors (CANDU and similar), Sweden and Mexico boiling water reactors, and the UK gas-cooled reactors (AGR). The most common models, including those under construction or planned, are the AP-1000 (117 units), HPR-1000 (Hualong One, 66), NuScale (61) and BWRX-300 (47). Hover a reactor for its model and operator.',
      },
      unit: '',
      file: 'main-type.json',
      layer: { kind: 'categorical', categories: TYPES.slice(0, 6) },
      format: typeLabel,
      timeless: true,
      missing: { zh: '沒有運轉中的核電機組', en: 'No operating nuclear reactors' },
    },
    {
      id: 'fleet-age',
      label: { zh: '核電機組的平均機齡', en: 'Average age of nuclear reactors' },
      description: {
        zh: '運轉中核電機組的平均機齡（2026 年減併網年份，依容量加權）。全世界 31.7 年。最老：荷蘭 53.0（只有 1 部）、瑞士 47.0、亞美尼亞 46.0、比利時 45.7、瑞典 43.3、美國 43.2、加拿大 41.9、西班牙 40.6、法國 38.4、日本 31.2；最新：阿聯 3.5、白俄羅斯 4.0、巴基斯坦 8.4、中國 10.5、伊朗 13.0、印度 16.8、南韓 23.3。台灣最後一部核三廠 2 號機的執照 2025 年 5 月 17 日到期。',
        en: 'Average age of operating nuclear reactors (2026 minus the grid connection year, weighted by capacity). The world average is 31.7 years. Oldest: the Netherlands 53.0 (a single reactor), Switzerland 47.0, Armenia 46.0, Belgium 45.7, Sweden 43.3, the US 43.2, Canada 41.9, Spain 40.6, France 38.4 and Japan 31.2; newest: the UAE 3.5, Belarus 4.0, Pakistan 8.4, China 10.5, Iran 13.0, India 16.8 and South Korea 23.3. Taiwan’s last reactor, Maanshan unit 2, reached the end of its licence on 17 May 2025.',
      },
      unit: { zh: '年', en: 'years' },
      file: 'fleet-age.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [10, 20, 30, 40, 45] } },
      format: (v) => tr({ zh: `${fixed(v, 1)} 年`, en: `${fixed(v, 1)} years` }),
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
      timeless: true,
      missing: { zh: '沒有運轉中的核電機組', en: 'No operating nuclear reactors' },
    },
    {
      id: 'type-capacity',
      label: { zh: '各機型的運轉中容量', en: 'Operating capacity by reactor type' },
      description: {
        zh: '運轉中核電機組的容量，依機型（子項目）。壓水式 319,620 MW：美國 68,019、法國 65,690、中國 64,412、南韓 25,259、俄羅斯 21,310；沸水式 48,338（美國 34,456、瑞典 4,896、日本 3,001）；重水式 25,855（加拿大 14,629、印度 6,240）；輕水石墨式（RBMK）只剩俄羅斯 7,000；氣冷式 5,500（英國 5,284）；快中子式只有俄羅斯 1,485。小型模組化反應爐還沒有運轉中的，都在興建或規劃中。',
        en: 'Operating nuclear capacity by reactor type (sub-items). Pressurised water 319,620 MW: the US 68,019, France 65,690, China 64,412, South Korea 25,259 and Russia 21,310; boiling water 48,338 (the US 34,456, Sweden 4,896, Japan 3,001); heavy water 25,855 (Canada 14,629, India 6,240); light water graphite (RBMK) only in Russia, 7,000; gas-cooled 5,500 (the UK 5,284); fast reactors only in Russia, 1,485. No small modular reactors are yet operating; all are under construction or planned.',
      },
      unit: 'MW',
      file: 'type-capacity/{item}.json',
      dimension: TYPE_DIM,
      layer: { kind: 'bubble', legendValues: [1000, 10000, 50000] },
      format: mw,
      formatTick: formatLargeTick,
      timeless: true,
      shareOfWorld: true,
      missing: { zh: '沒有這種機型的運轉中機組', en: 'No operating reactors of this type' },
    },
    // 第二十七批 623：已退役的機組（GIPT 的退役年份，依年份累計）與核電廠的熱效率（Eurostat）
    {
      id: 'retired-capacity',
      label: { zh: '已退役的核電容量（累計）', en: 'Retired nuclear capacity (cumulative)' },
      description: {
        zh: '到這一年為止退役的核電機組容量合計（MW，依退役年份累計）。到 2026 年全世界退役 230 部、115,932 MW：德國 27,862 MW（36 部）最多，美國 21,077（45 部）、日本 17,881（27 部）、英國 9,163（36 部）、法國 6,087（15 部）、俄羅斯 5,915（19 部）、台灣 5,144（6 部，2018–2025 年）。依退役年代：1960 年代 11 部、1970 年代 20、1980 年代 28、1990 年代 42、2000 年代 37、2010 年代 60 最多、2020 年代到目前 32。GEM 的「退役」不分永久關閉、等待除役與除役完成；封存的不算。拉時間軸看退役的機組一部一部出現。',
        en: 'Total capacity of nuclear reactors retired up to the year (MW, cumulative by retirement year). By 2026 the world had retired 230 reactors with 115,932 MW: Germany the most at 27,862 MW (36 reactors), then the US 21,077 (45), Japan 17,881 (27), the UK 9,163 (36), France 6,087 (15), Russia 5,915 (19) and Taiwan 5,144 (6, in 2018–2025). By decade: 11 in the 1960s, 20 in the 1970s, 28 in the 1980s, 42 in the 1990s, 37 in the 2000s, a peak of 60 in the 2010s and 32 so far in the 2020s. GEM’s “retired” does not distinguish permanent shutdown, awaiting decommissioning and decommissioned; mothballed reactors are excluded. Move the time slider to watch retired reactors appear.',
      },
      unit: 'MW',
      file: 'retired-capacity.json',
      layer: { kind: 'bubble', legendValues: [1000, 10000, 25000] },
      format: mw,
      formatTick: formatLargeTick,
      overlayTime: 'cumulative',
      shareOfWorld: true,
      missing: { zh: '還沒有退役的核電機組', en: 'No retired nuclear reactors' },
    },
    {
      id: 'retired-count',
      label: { zh: '已退役的核電機組數（累計）', en: 'Retired nuclear reactors (cumulative)' },
      description: {
        zh: '到這一年為止退役的核電機組部數（依退役年份累計）。到 2026 年美國 45 部最多，德國、英國各 36 部（英國多是小型的早期氣冷式，容量只有德國的三分之一），日本 27、俄羅斯 19、法國 15、瑞典 7，台灣、加拿大各 6，烏克蘭、義大利、保加利亞各 4。',
        en: 'Number of nuclear reactors retired up to the year (cumulative by retirement year). By 2026 the US had retired the most, 45, then Germany and the UK 36 each (the UK’s mostly small early gas-cooled reactors, with a third of Germany’s capacity), Japan 27, Russia 19, France 15, Sweden 7, Taiwan and Canada 6 each, and Ukraine, Italy and Bulgaria 4 each.',
      },
      unit: { zh: '部', en: 'reactors' },
      file: 'retired-count.json',
      layer: { kind: 'bubble', legendValues: [1, 10, 40] },
      format: (v) => tr({ zh: `${fixed(v, 0)} 部`, en: `${fixed(v, 0)} reactors` }),
      formatTick: (v) => fixed(v, 0),
      integer: true,
      overlayTime: 'cumulative',
      shareOfWorld: true,
      missing: { zh: '還沒有退役的核電機組', en: 'No retired nuclear reactors' },
    },
    {
      id: 'thermal-efficiency',
      label: { zh: '核電廠的熱效率', en: 'Thermal efficiency of nuclear plants' },
      description: {
        zh: '反應爐產生的熱有多少變成電（Eurostat 的核熱與核能毛發電量，只有歐洲）。2024 年法國核熱 88,138 千公噸油當量＝1,025.0 TWh 的熱、毛發電 380.5 TWh，熱效率 37.1%；荷蘭 37.1%、芬蘭 36.6%、斯洛維尼亞 36.6%、瑞典 36.0%、比利時 35.8%、捷克 34.5%、匈牙利 34.0%、西班牙 33.0%。其餘三分之二變成廢熱排到河、海或大氣，這是蒸汽循環的物理上限，不是浪費。台灣的設計值（核安會）：核一廠 34.6%、核二廠 32.8%、核三廠 33.7%。',
        en: 'How much of the heat produced by reactors becomes electricity (Eurostat nuclear heat and gross nuclear generation, Europe only). In 2024 France produced 88,138 ktoe of nuclear heat (1,025.0 TWh) and 380.5 TWh of gross electricity, an efficiency of 37.1%; the Netherlands 37.1%, Finland 36.6%, Slovenia 36.6%, Sweden 36.0%, Belgium 35.8%, Czechia 34.5%, Hungary 34.0% and Spain 33.0%. The other two-thirds becomes waste heat released to rivers, the sea or the air, a physical limit of the steam cycle rather than waste. Taiwan’s design values (Nuclear Safety Commission): Jinshan 34.6%, Kuosheng 32.8%, Maanshan 33.7%.',
      },
      unit: '%',
      file: 'thermal-efficiency.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [32, 33, 34, 35, 36] } },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${fixed(v, 0)}%`,
      defaultYear: 2024,
      missing: { zh: 'Eurostat 只有歐洲；沒有核電', en: 'Eurostat covers Europe only; no nuclear power' },
    },
  ],
};
