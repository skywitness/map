import { tr, type Text } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import { choroplethColors } from '../map/categories';
import { MAP_TOKENS } from '../theme/tokens';
import type { ClassGridOverlayDef, IndicatorDef, TopicDefinition } from './types';

/**
 * 紅血球的遺傳性狀（2026-11-03，製作手冊第十九批 289；pipeline/topics/red_cell_traits.py）：蠶豆症（G6PD 缺乏）、
 * 鐮刀型血球、血紅素 C、Duffy 陰性。國家值是 Howes 2012、Piel 2013 的表或 Malaria Atlas Project 網格的國內平均，
 * 地圖上另外疊 MAP 的約 0.17° 網格（類別網格，分級跟國家的面量圖同一組門檻與顏色）。
 * 這些性狀多半跟瘧疾有關（帶一個基因的人比較不會得重症瘧疾），所以在瘧疾流行過的地方特別常見。
 */

const pct = (v: number) => `${fixed(v, v < 1 ? 2 : 1)}%`;
const pctTick = (v: number) => `${v}%`;

/** 網格與國家的分級（跟 pipeline 的 GRIDS 一樣） */
const THRESHOLDS: Record<'g6pd' | 'hbs' | 'hbc' | 'duffy', number[]> = {
  g6pd: [1, 3, 5, 10, 15, 20],
  hbs: [1, 2, 5, 8, 12],
  hbc: [1, 2, 5, 10],
  duffy: [1, 10, 30, 60, 90],
};
/** 網格的範圍（pipeline 寫在 grid/bounds.json，這裡照抄；MAP 的圖到北緯 85°、南緯 60° 或只有一個區域） */
const BOUNDS: Record<keyof typeof THRESHOLDS, [number, number, number, number]> = {
  g6pd: [-121, -57.07642, 170.04167, 56.04167],
  hbs: [-180, -60, 180, 85],
  hbc: [-18, -34.95833, 52, 37.54167],
  duffy: [-180, -60, 180, 85],
};

function gridLayer(key: keyof typeof THRESHOLDS, indicator: string, label: Text): ClassGridOverlayDef {
  const t = THRESHOLDS[key];
  const colors = choroplethColors({ type: 'sequential', thresholds: t }, MAP_TOKENS);
  const range = (i: number): Text =>
    i === 0
      ? { zh: `不到 ${t[0]}%`, en: `Under ${t[0]}%` }
      : i === t.length
        ? { zh: `${t[t.length - 1]}% 以上`, en: `${t[t.length - 1]}% and over` }
        : { zh: `${t[i - 1]}–${t[i]}%`, en: `${t[i - 1]}–${t[i]}%` };
  return {
    kind: 'classGrid',
    id: `grid-${key}`,
    label,
    file: () => `grid/${key}.png`,
    classes: colors.map((color, i) => ({ value: i + 1, color, short: range(i), label: range(i), group: 0 })),
    groups: [{ zh: '網格（約 18 公里）', en: 'Grid (about 18 km)' }],
    opacity: 0.85,
    bounds: BOUNDS[key],
    indicators: [indicator],
  };
}

const MAP_SOURCE = {
  zh: 'Malaria Atlas Project：血液疾病的 5 公里網格（G6PD、HbS、HbC、Duffy，2010 年左右的模型），抽稀成約 0.17°',
  en: 'Malaria Atlas Project: 5 km blood disorder grids (G6PD, HbS, HbC and Duffy; models for around 2010), thinned to about 0.17°',
};

const indicators: IndicatorDef[] = [
  {
    id: 'g6pd',
    label: { zh: '蠶豆症（G6PD 缺乏）', en: 'G6PD deficiency' },
    description: {
      zh: 'G6PD 缺乏的等位基因頻率，約等於男性得蠶豆症的比例（基因在 X 染色體上，女性要兩條都有才會發病，比例低很多）。剛果民主共和國 19.2%、奈及利亞 16.9%、柬埔寨 14.3%、泰國 13.6%、沙烏地 12.4%、印度 8.0%、巴西 4.8%、中國 4.7%；台灣約 2.2%（網格推估）。蠶豆症的人吃蠶豆、用某些藥（例如治瘧疾的 primaquine）會溶血，所以台灣的新生兒都要篩檢：國健署的新生兒篩檢 2024 年篩出 2,958 例，每千名 22.0 例（男女合計，1995 年以後大多每千名 17–22 例），跟網格推估接近。國家值是 Howes 等 2012 的 99 個瘧疾流行國，表上沒有的（台灣、香港、新加坡等 7 處）用網格的國內平均；網格只涵蓋 2010 年的瘧疾流行區，歐洲、日本、美國沒有值。',
      en: 'G6PD deficiency allele frequency, roughly the share of males with the deficiency (the gene is on the X chromosome, so females need two copies and are affected far less often). DR Congo 19.2%, Nigeria 16.9%, Cambodia 14.3%, Thailand 13.6%, Saudi Arabia 12.4%, India 8.0%, Brazil 4.8%, China 4.7%; Taiwan about 2.2% (grid estimate). People with the deficiency can suffer haemolysis after eating fava beans or taking certain drugs (such as the antimalarial primaquine), which is why all newborns in Taiwan are screened: Taiwan’s newborn screening found 2,958 cases in 2024, 22.0 per 1,000 (both sexes; mostly 17–22 per 1,000 since 1995), close to the grid estimate. National values are for the 99 malaria-endemic countries in Howes et al. 2012; seven places not in that table (Taiwan, Hong Kong, Singapore and others) use the grid average within the country. The grid covers only areas malaria-endemic in 2010, so Europe, Japan and the US have no value.',
    },
    unit: '%',
    file: 'g6pd.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: THRESHOLDS.g6pd } },
    format: pct,
    formatTick: pctTick,
    unranked: true,
  },
  {
    id: 'sca',
    label: { zh: '新生兒的鐮刀型血球症', en: 'Sickle cell anaemia at birth' },
    description: {
      zh: '每 1,000 名新生兒有幾個鐮刀型血球症（從父母各得到一個鐮刀型血紅素基因，HbSS），2010 年的模型估計。奈及利亞 14、剛果民主共和國 13、貝南 13、安哥拉 11；印度、沙烏地、巴林 1–4；台灣、東亞幾乎沒有（台灣常見的血紅素疾病是海洋性貧血）。地圖上的網格是鐮刀型血紅素（HbS）的等位基因頻率：西非、中非 10% 以上，阿拉伯半島與印度中部也高。',
      en: 'Newborns with sickle cell anaemia (inheriting a sickle haemoglobin gene from each parent, HbSS) per 1,000 births, a 2010 model estimate. Nigeria 14, DR Congo 13, Benin 13, Angola 11; India, Saudi Arabia and Bahrain 1–4; almost none in Taiwan and East Asia (Taiwan’s common haemoglobin disorder is thalassaemia). The grid on the map is the sickle haemoglobin (HbS) allele frequency: over 10% in West and Central Africa, and also high in the Arabian Peninsula and central India.',
    },
    unit: '‰',
    file: 'sca.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 2, 5, 8, 12] } },
    format: (v) => tr({ zh: `每千名新生兒 ${fixed(v, 0)} 名`, en: `${fixed(v, 0)} per 1,000 births` }),
    formatTick: (v) => fixed(v, 0),
    unranked: true,
  },
  {
    id: 'sca-births',
    label: { zh: '鐮刀型血球症的新生兒數', en: 'Babies born with sickle cell anaemia' },
    description: {
      zh: '2010 年出生時有鐮刀型血球症的新生兒人數（模型估計）：全世界約 30 萬人，奈及利亞 9.1 萬、剛果民主共和國 4.0 萬、印度 4.4 萬。',
      en: 'Newborns with sickle cell anaemia in 2010 (model estimate): about 300,000 worldwide, including 91,000 in Nigeria, 40,000 in DR Congo and 44,000 in India.',
    },
    unit: { zh: '人', en: 'babies' },
    file: 'sca-births.json',
    layer: { kind: 'bubble', legendValues: [1000, 10000, 50000] },
    format: (v) => tr({ zh: `${formatLargeNumber(v)} 人`, en: `${formatLargeNumber(v)} babies` }),
    formatTick: formatLargeTick,
  },
  {
    id: 'hbc',
    label: { zh: '血紅素 C', en: 'Haemoglobin C' },
    description: {
      zh: '血紅素 C（HbC）的等位基因頻率，西非最高：國家平均布吉納法索 12.3%、迦納 8.6%，網格最高約 18%。HbC 也能保護人不得重症瘧疾；帶兩個 HbC 或跟鐮刀型血紅素各一個（HbSC）會貧血。只有非洲的網格，國家值是網格在國內的面積平均（不是人口加權）。',
      en: 'Haemoglobin C (HbC) allele frequency, highest in West Africa: national averages of 12.3% in Burkina Faso and 8.6% in Ghana, up to about 18% in the grid. HbC also protects against severe malaria; two copies, or one with sickle haemoglobin (HbSC), cause anaemia. Only an Africa grid exists; national values are the area average of the grid within each country (not population-weighted).',
    },
    unit: '%',
    file: 'hbc.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: THRESHOLDS.hbc } },
    format: pct,
    formatTick: pctTick,
    unranked: true,
  },
  {
    id: 'duffy',
    label: { zh: 'Duffy 陰性', en: 'Duffy-negative' },
    description: {
      zh: '紅血球表面沒有 Duffy 抗原的人的比例：撒哈拉以南非洲幾乎 100%，阿拉伯半島約三到四成（沙烏地 38.5%、葉門 37.8%），歐洲、東亞（包括台灣）0%。Duffy 陰性的人幾乎不會得間日瘧，白血球數也常偏低（不是疾病，判讀檢驗時要知道）。國家值是網格在國內的面積平均（不是人口加權），美洲因為移民，城市與鄉間差很多。',
      en: 'Share of people whose red blood cells lack the Duffy antigen: nearly 100% in sub-Saharan Africa, about 30–40% in the Arabian Peninsula (Saudi Arabia 38.5%, Yemen 37.8%), and 0% in Europe and East Asia (including Taiwan). Duffy-negative people almost never get vivax malaria and often have lower white blood cell counts (not a disease, but worth knowing when reading test results). National values are the area average of the grid within each country (not population-weighted); in the Americas, migration makes cities and countryside differ widely.',
    },
    unit: '%',
    file: 'duffy.json',
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: THRESHOLDS.duffy } },
    format: pct,
    formatTick: pctTick,
    unranked: true,
  },
];

export const redCellTraits: TopicDefinition = {
  id: 'red-cell-traits',
  title: { zh: '紅血球的遺傳性狀', en: 'Inherited red blood cell traits' },
  shortTitle: { zh: '紅血球的遺傳性狀', en: 'Red cell traits' },
  defaultIndicator: 'g6pd',
  defaultYear: 2010,
  timeless: true,
  sources: [
    {
      name: {
        zh: 'Howes 等 2012〈G6PD Deficiency Prevalence and Estimates of Affected Populations in Malaria Endemic Countries〉，PLoS Medicine 9(11):e1001339，Table S1',
        en: 'Howes et al. 2012, “G6PD Deficiency Prevalence and Estimates of Affected Populations in Malaria Endemic Countries”, PLoS Medicine 9(11):e1001339, Table S1',
      },
      url: 'https://doi.org/10.1371/journal.pmed.1001339',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'Piel 等 2013〈Global Burden of Sickle Cell Anaemia in Children under Five, 2010–2050〉，PLoS Medicine 10(7):e1001484，Table S2',
        en: 'Piel et al. 2013, “Global Burden of Sickle Cell Anaemia in Children under Five, 2010–2050”, PLoS Medicine 10(7):e1001484, Table S2',
      },
      url: 'https://doi.org/10.1371/journal.pmed.1001484',
      license: 'CC BY 4.0',
    },
    { name: MAP_SOURCE, url: 'https://malariaatlas.org/', license: 'CC BY 3.0' },
    {
      name: {
        zh: '衛生福利部國民健康署「新生兒先天性代謝異常疾病篩檢歷年成果表」（台灣蠶豆症的個案數，附註）',
        en: 'Health Promotion Administration, Ministry of Health and Welfare, newborn screening results (G6PD cases in Taiwan, in the note)',
      },
      url: 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=4083&pid=401',
      license: { zh: '政府資料開放授權條款第 1 版', en: 'Open Government Data License, version 1.0' },
    },
  ],
  note: {
    zh: '都是 2010 年左右的模型估計（彙整各地的抽樣調查，再依地理位置推估沒有調查的地方），不是普查。蠶豆症、鐮刀型血球與血紅素 C 的「等位基因頻率」是帶這個基因的染色體的比例，不是帶因者或病人的比例。這些性狀跟瘧疾有關，所以在瘧疾流行過的地方特別常見，跟種族沒有必然關係，地圖上的高低不代表任何族群的優劣。網格是 Malaria Atlas Project 以 CC BY 3.0 公開的血液疾病圖層（G6PD 來自 Howes 等 2012 的模型；Duffy 陰性的原始論文 Howes 等 2011、鐮刀型血紅素的 Piel 等 2010 是非商業授權，這裡只用 MAP 的網格，不用論文本身）。台灣常見的血紅素疾病是海洋性貧血，這幾份資料沒有。台灣的蠶豆症另有國健署新生兒篩檢的個案數（附註與「新生兒篩檢」主題的側欄）：篩檢的是新生兒的酵素活性，男女都算，跟這裡的等位基因頻率（約等於男性的比例）不是同一個量。',
    en: 'All are model estimates for around 2010 (pooling local sample surveys and predicting unsurveyed places from geography), not censuses. The “allele frequency” for G6PD deficiency, sickle haemoglobin and haemoglobin C is the share of chromosomes carrying the gene, not the share of carriers or patients. These traits are linked to malaria, which is why they are common where malaria was widespread; they are not tied to race, and higher or lower values say nothing about any group. The grids are the Malaria Atlas Project’s blood disorder layers published under CC BY 3.0 (G6PD from the Howes et al. 2012 model; the original Duffy paper by Howes et al. 2011 and the sickle haemoglobin paper by Piel et al. 2010 are non-commercial, so only the MAP grids are used, not the papers themselves). Thalassaemia, Taiwan’s common haemoglobin disorder, is not covered by these data. For G6PD deficiency in Taiwan there are also case counts from the Health Promotion Administration’s newborn screening (in the note and the “Newborn screening” topic’s side panel); screening measures enzyme activity in newborns of both sexes, which is not the same quantity as the allele frequency here (roughly the share of males).',
  },
  overlays: [
    gridLayer('g6pd', 'g6pd', { zh: '蠶豆症的網格（G6PD 缺乏的等位基因頻率）', en: 'G6PD deficiency grid (allele frequency)' }),
    gridLayer('hbs', 'sca', { zh: '鐮刀型血紅素的網格（HbS 的等位基因頻率）', en: 'Sickle haemoglobin grid (HbS allele frequency)' }),
    gridLayer('hbc', 'hbc', { zh: '血紅素 C 的網格（非洲）', en: 'Haemoglobin C grid (Africa)' }),
    gridLayer('duffy', 'duffy', { zh: 'Duffy 陰性的網格', en: 'Duffy-negative grid' }),
  ],
  indicators,
};
