import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { TopicDefinition } from './types';

/**
 * 農田的養分流失：氮磷盈餘與氮肥效率（新主題，2026-11-07，製作手冊第二十五批 484，候選 1147；環境的「污染」）：
 * FAOSTAT 的耕地養分收支（ESB），pipeline/topics/nutrients.py。側欄是 panels/NutrientsPanel.tsx（每公頃的氮收支）
 */
const KG_HA = { zh: '公斤/公頃', en: 'kg/ha' };
const SMALL = {
  zh: '沒有資料（耕地不到 2 萬公頃的地區每公頃的值會非常大，不畫）',
  en: 'No data (areas with under 20,000 ha of cropland are not shown because per-hectare values blow up)',
};
const tonnes = (v: number) => tr({ zh: formatLargeNumber(v) + ' 公噸', en: formatLargeNumber(v) + ' t' });

export const nutrients: TopicDefinition = {
  id: 'nutrients',
  title: { zh: '農田的養分流失', en: 'Cropland nutrient surplus' },
  shortTitle: { zh: '養分流失', en: 'Nutrient surplus' },
  defaultIndicator: 'n-surplus',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'FAOSTAT：Cropland Nutrient Balance（ESB）', en: 'FAOSTAT: Cropland Nutrient Balance (ESB)' },
      url: 'https://www.fao.org/faostat/en/#data/ESB',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: 'FAO 把每一國耕地的養分輸入（化肥、糞肥、生物固氮、大氣沉降、種子）減掉輸出（作物收穫帶走的），剩下的是盈餘：會留在土壤、淋溶到地下水或揮發到空氣裡，是河川與地下水硝酸鹽、海岸優養化的來源之一。殘體移除另外列，不算進輸出；淋溶與揮發是 FAO 用係數推估的，盈餘不等於實際進入水體的量。磷是元素量（P），不是 P₂O₅。數字大多是 FAO 的估計值；外部機構提供的數字（Flag X，1961–2000 年部分國家的化肥氮）不用，側欄那一年不畫收支。',
    en: 'FAO subtracts each country’s cropland nutrient outputs (removal in harvested crops) from inputs (mineral fertiliser, manure, biological fixation, atmospheric deposition and seed); the remainder is the surplus, which stays in the soil, leaches to groundwater or volatilises to the air, and is one source of nitrate in rivers and groundwater and of coastal eutrophication. Crop residue removal is listed separately and not counted as an output; leaching and volatilisation are estimated by FAO with coefficients, so the surplus is not the amount that actually reaches water. Phosphorus is elemental P, not P₂O₅. Most figures are FAO estimates; figures from external organisations (flag X, mineral fertiliser nitrogen for some countries in 1961–2000) are not used, and the side panel skips the budget for those years.',
  },
  panelExtra: () => import('./panels/NutrientsPanel'),
  indicators: [
    {
      id: 'n-surplus',
      label: { zh: '每公頃耕地的氮盈餘', en: 'Nitrogen surplus per hectare of cropland' },
      description: {
        zh: '每公頃耕地一年的氮輸入減掉作物收穫帶走的氮。2023 年全世界平均 54.3 公斤；土庫曼 316.6、千里達及托巴哥 275.8、比利時 224.7、卡達 204.7、蘇利南 192.0、愛爾蘭 187.4、南韓 186.7、埃及 185.7、烏茲別克 178.0、台灣 177.0 公斤，荷蘭 157.7、中國 152.1、印度 102.4；法國 59.1、日本 53.9、德國 42.3、美國 35.6。負值是作物帶走的比投入多、在消耗土壤的養分（史瓦帝尼、吉里巴斯、迦納等）。台灣最高是 2001 年的 269.5 公斤。',
        en: 'Nitrogen input per hectare of cropland in a year minus nitrogen removed in harvested crops. The 2023 world average was 54.3 kg; Turkmenistan 316.6, Trinidad and Tobago 275.8, Belgium 224.7, Qatar 204.7, Suriname 192.0, Ireland 187.4, South Korea 186.7, Egypt 185.7, Uzbekistan 178.0 and Taiwan 177.0 kg; the Netherlands 157.7, China 152.1, India 102.4; France 59.1, Japan 53.9, Germany 42.3 and the US 35.6. Negative values mean crops remove more than is added, depleting soil nutrients (Eswatini, Kiribati, Ghana and others). Taiwan peaked at 269.5 kg in 2001.',
      },
      unit: KG_HA,
      file: 'n-surplus.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0, 25, 50, 100, 150, 200] } },
      format: (v) => tr({ zh: fixed(v, 1) + ' 公斤/公頃', en: fixed(v, 1) + ' kg/ha' }),
      formatTick: (v) => String(v),
      missing: SMALL,
    },
    {
      id: 'n-efficiency',
      label: { zh: '氮肥利用效率', en: 'Nitrogen use efficiency' },
      description: {
        zh: '作物收穫帶走的氮占輸入的比例。2023 年全世界 55.3%；台灣 27.9%（七成多的氮沒有被作物帶走）、比利時 29.7%、南韓 30.5%、荷蘭 32.2%、越南 39.0%、印度 43.0%、中國 47.3%、日本 51.5%、德國 68.5%、美國 71.4%、巴西 73.1%。冰島 1.6%、蒙古 5.9%、千里達及托巴哥 5.9% 很低。超過 100% 是帶走的比投入多、在消耗土壤裡的氮（吉里巴斯、萬那杜、索羅門群島等）。',
        en: 'Nitrogen removed in harvested crops as a share of nitrogen input. The 2023 world figure was 55.3%; Taiwan 27.9% (over 70% of the nitrogen is not taken up by crops), Belgium 29.7%, South Korea 30.5%, the Netherlands 32.2%, Vietnam 39.0%, India 43.0%, China 47.3%, Japan 51.5%, Germany 68.5%, the US 71.4% and Brazil 73.1%. Iceland (1.6%), Mongolia (5.9%) and Trinidad and Tobago (5.9%) are very low. Above 100% means crops remove more than is added, drawing down soil nitrogen (Kiribati, Vanuatu, the Solomon Islands and others).',
      },
      unit: '%',
      file: 'n-efficiency.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [20, 30, 40, 50, 70, 100] } },
      format: (v) => fixed(v, 1) + '%',
      formatTick: (v) => v + '%',
      missing: SMALL,
    },
    {
      id: 'p-surplus',
      label: { zh: '每公頃耕地的磷盈餘', en: 'Phosphorus surplus per hectare of cropland' },
      description: {
        zh: '每公頃耕地一年的磷（元素量）輸入減掉作物收穫帶走的。2023 年全世界平均 4.3 公斤；台灣 59.1 公斤最高，荷蘭 50.6、千里達及托巴哥 49.1、卡達 43.6、孟加拉 32.7、南韓 30.3、日本 22.5、越南 21.8、中國 16.6、印度 10.8；美國 −0.8、德國 −0.2、法國 −1.3，已經接近收支平衡。',
        en: 'Phosphorus (elemental) input per hectare of cropland in a year minus phosphorus removed in harvested crops. The 2023 world average was 4.3 kg; Taiwan was highest at 59.1 kg, followed by the Netherlands 50.6, Trinidad and Tobago 49.1, Qatar 43.6, Bangladesh 32.7, South Korea 30.3, Japan 22.5, Vietnam 21.8, China 16.6 and India 10.8; the US (−0.8), Germany (−0.2) and France (−1.3) are close to balance.',
      },
      unit: KG_HA,
      file: 'p-surplus.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0, 5, 10, 20, 30, 50] } },
      format: (v) => tr({ zh: fixed(v, 1) + ' 公斤/公頃', en: fixed(v, 1) + ' kg/ha' }),
      formatTick: (v) => String(v),
      missing: SMALL,
    },
    {
      id: 'n-flows',
      label: { zh: '農田流失的氮', en: 'Nitrogen lost from cropland' },
      description: {
        zh: '氮盈餘的總量，以及 FAO 推估其中淋溶到地下水、揮發到空氣中的量（公噸）。2023 年全世界的盈餘 8,533 萬公噸，淋溶 1,561 萬、揮發 3,903 萬公噸；淋溶最多的是中國 349 萬、印度 228 萬、美國 123 萬、巴西 86 萬公噸，台灣 21,848 公噸。',
        en: 'Total nitrogen surplus, and the amounts FAO estimates leach to groundwater or volatilise to the air (tonnes). In 2023 the world surplus was 85.3 million tonnes, with 15.6 million leached and 39.0 million volatilised; leaching was largest in China (3.49 million t), India (2.28 million), the US (1.23 million) and Brazil (0.86 million), and Taiwan’s was 21,848 t.',
      },
      unit: { zh: '公噸', en: 'tonnes' },
      file: 'n-flows/{item}.json',
      dimension: {
        label: { zh: '去向', en: 'Flow' },
        options: [
          { id: 'leaching', label: { zh: '淋溶到地下水', en: 'Leaching' } },
          { id: 'volatilisation', label: { zh: '揮發到空氣', en: 'Volatilisation' } },
          { id: 'surplus', label: { zh: '盈餘總量', en: 'Total surplus' } },
        ],
        defaultOption: 'leaching',
      },
      layer: { kind: 'bubble', legendValues: [1e4, 1e5, 1e6] },
      format: tonnes,
      formatTick: (v) => formatLargeTick(v),
    },
  ],
};
