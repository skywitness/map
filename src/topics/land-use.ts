import { tr } from '../i18n/lang';
import { fixed, formatLargeNumber, formatLargeTick } from '../lib/format';
import type { ScaleSpec, TopicDefinition } from './types';

/**
 * 土地利用（新主題，2026-11-07，製作手冊第二十五批 491，候選 1154、1155；環境的「土地」）：
 * FAOSTAT 的土地利用（RL，1961–2024）與土地覆蓋（LC 的 ESA CCI，1992–2022），pipeline/topics/land_use.py。
 * 側欄 panels/LandUsePanel.tsx 是這一國那一年的土地利用結構
 */
const USE_DIM = {
  label: { zh: '土地', en: 'Land' },
  options: [
    { id: 'cropland', label: { zh: '耕地', en: 'Cropland' } },
    { id: 'arable', label: { zh: '可耕地（一年生作物、休耕、短期牧草）', en: 'Arable land (temporary crops, fallow, temporary pasture)' } },
    { id: 'permanent', label: { zh: '永久作物（果園、茶園、橡膠等）', en: 'Permanent crops (orchards, tea, rubber, etc.)' } },
    { id: 'pasture', label: { zh: '永久草地與牧地', en: 'Permanent meadows and pastures' } },
    { id: 'agri', label: { zh: '農業用地（耕地＋牧地）', en: 'Agricultural land (cropland + pasture)' } },
    { id: 'other', label: { zh: '其他土地（非農非林）', en: 'Other land (not farmed or forested)' } },
  ],
  defaultOption: 'cropland',
};
const COVER_DIM = {
  label: { zh: '覆蓋類別', en: 'Cover class' },
  options: [
    { id: 'artificial', label: { zh: '人工地表（都市與相關）', en: 'Artificial surfaces (urban and associated)' } },
    { id: 'herbaceous', label: { zh: '草本作物', en: 'Herbaceous crops' } },
    { id: 'woody', label: { zh: '木本作物', en: 'Woody crops' } },
    { id: 'layered', label: { zh: '多層作物', en: 'Multiple or layered crops' } },
    { id: 'tree', label: { zh: '樹冠覆蓋', en: 'Tree-covered areas' } },
    { id: 'mangrove', label: { zh: '紅樹林', en: 'Mangroves' } },
    { id: 'shrub', label: { zh: '灌叢', en: 'Shrub-covered areas' } },
    { id: 'flooded', label: { zh: '濕生植被（經常淹水）', en: 'Aquatic or regularly flooded vegetation' } },
    { id: 'grass', label: { zh: '草地', en: 'Grassland' } },
    { id: 'sparse', label: { zh: '稀疏植被', en: 'Sparsely vegetated areas' } },
    { id: 'barren', label: { zh: '裸地', en: 'Barren land' } },
    { id: 'snow', label: { zh: '永久冰雪', en: 'Permanent snow and glaciers' } },
    { id: 'water', label: { zh: '內陸水體', en: 'Inland water bodies' } },
    { id: 'coastal', label: { zh: '沿海水體與潮間帶', en: 'Coastal water bodies and intertidal areas' } },
  ],
  defaultOption: 'artificial',
};
const SHARE_SCALES: Record<string, ScaleSpec> = {
  cropland: { type: 'sequential', thresholds: [5, 10, 20, 30, 45, 60] },
  arable: { type: 'sequential', thresholds: [5, 10, 20, 30, 45, 60] },
  permanent: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] },
  pasture: { type: 'sequential', thresholds: [5, 10, 20, 35, 50, 70] },
  agri: { type: 'sequential', thresholds: [10, 20, 35, 50, 65, 80] },
  other: { type: 'sequential', thresholds: [5, 10, 20, 35, 50, 70] },
};
const COVER_SCALE: ScaleSpec = { type: 'sequential', thresholds: [1, 5, 10, 20, 40, 60] };
const COVER_SCALES: Record<string, ScaleSpec> = { artificial: { type: 'sequential', thresholds: [0.5, 1, 2, 4, 8, 15] } };
const pct = (v: number) => fixed(v, v < 10 ? 2 : 1) + '%';
const ha = (v: number) => tr({ zh: formatLargeNumber(v) + ' 公頃', en: formatLargeNumber(v) + ' ha' });
const NO_PASTURE_TW = { zh: '台灣沒有永久草地與牧地的資料', en: 'No permanent meadow and pasture data for Taiwan' };

export const landUse: TopicDefinition = {
  id: 'land-use',
  title: { zh: '土地利用', en: 'Land use' },
  shortTitle: { zh: '土地利用', en: 'Land use' },
  defaultIndicator: 'share',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'FAOSTAT：Land Use（RL）', en: 'FAOSTAT: Land Use (RL)' },
      url: 'https://www.fao.org/faostat/en/#data/RL',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: 'FAOSTAT：Land Cover（LC，ESA CCI Land Cover）', en: 'FAOSTAT: Land Cover (LC, ESA CCI Land Cover)' },
      url: 'https://www.fao.org/faostat/en/#data/LC',
      license: 'CC BY 4.0',
    },
  ],
  note: {
    zh: '土地利用（耕地、牧地等）是各國向聯合國糧農組織（FAO）申報或 FAO 估計的統計，1961 年起；土地覆蓋是 FAO 把歐洲太空總署的衛星分類（ESA CCI Land Cover，300 公尺）加總到國家，1992–2022 年。兩者口徑不同：統計說的「耕地」與衛星看到的「作物」不一樣，FAO 的森林與衛星的樹冠覆蓋也不一樣。土地覆蓋 FAO 還有 MODIS、Copernicus 等另外三個來源，同一國同一年可以差好幾倍，這裡只用 CCI 一個。衛星分類在乾旱地區草地與裸地之間會來回跳，人工地表的成長也有一部分是感測器與演算法變好，只能看大趨勢。外部機構提供的數字（Flag X）沒有用。人口用聯合國 WPP 2024。',
    en: 'Land use (cropland, pasture and so on) is statistics reported by countries to the UN Food and Agriculture Organization (FAO) or estimated by FAO, from 1961; land cover is FAO’s national totals of the European Space Agency’s satellite classification (ESA CCI Land Cover, 300 m), 1992–2022. They measure different things: statistical “cropland” is not the same as the “crops” a satellite sees, nor is FAO forest the same as tree cover. FAO also publishes land cover from MODIS, Copernicus and two other sources, which can differ several-fold for the same country and year; only CCI is used here. Satellite classes flip between grassland and bare land in dry regions, and some of the growth in artificial surfaces comes from better sensors and algorithms, so read only the broad trends. Figures from external organisations (flag X) are not used. Population is from UN WPP 2024.',
  },
  panelExtra: () => import('./panels/LandUsePanel'),
  indicators: [
    {
      id: 'share',
      label: { zh: '占國土的比例', en: 'Share of land area' },
      description: {
        zh: '各類土地占國土（不含內陸水域）的比例，2023 年。耕地：吐瓦魯 99.96%、葛摩 71.5%、盧安達 70.0%、孟加拉 67.6%、摩爾多瓦 64.9%、丹麥 59.9%、烏克蘭 58.3%、印度 56.6%；德國 34.0%、台灣 22.0%、美國 16.9%、南韓 15.5%、中國 13.7%、日本 11.8%、巴西 7.6%、澳洲 4.1%。永久草地與牧地：土庫曼 80.8%、沙烏地 79.1%、烏拉圭 74.2%、蒙古 68.2%、澳洲 43.1%；台灣沒有這一項。',
        en: 'Each type of land as a share of land area (excluding inland water), 2023. Cropland: Tuvalu 99.96%, Comoros 71.5%, Rwanda 70.0%, Bangladesh 67.6%, Moldova 64.9%, Denmark 59.9%, Ukraine 58.3%, India 56.6%; Germany 34.0%, Taiwan 22.0%, the US 16.9%, South Korea 15.5%, China 13.7%, Japan 11.8%, Brazil 7.6%, Australia 4.1%. Permanent meadows and pastures: Turkmenistan 80.8%, Saudi Arabia 79.1%, Uruguay 74.2%, Mongolia 68.2%, Australia 43.1%; no figure for Taiwan.',
      },
      unit: '%',
      file: 'share/{item}.json',
      dimension: USE_DIM,
      layer: { kind: 'choropleth', scale: SHARE_SCALES.cropland, itemScales: SHARE_SCALES },
      format: pct,
      formatTick: (v) => v + '%',
      noValue: { TWN: NO_PASTURE_TW },
    },
    {
      id: 'area',
      label: { zh: '面積', en: 'Area' },
      description: {
        zh: '各類土地的面積（公頃），1961–2024 年，拉時間軸看 63 年的變化。耕地：美國 1961 年 1.83 億公頃、2023 年 1.55 億（少 15%）；巴西 3,144 萬 → 6,357 萬（多 102%）、阿根廷 1,947 萬 → 4,829 萬、印尼 1,897 萬 → 4,370 萬、澳洲 1,455 萬 → 3,165 萬；中國 1.04 億 → 1.29 億、印度 1.61 億 → 1.68 億；台灣 88.4 萬 → 77.9 萬公頃。牧地：澳洲 4.60 億 → 3.32 億公頃、中國 3.19 億 → 2.63 億、蒙古 1.40 億 → 1.06 億；沙烏地從 8,500 萬剛好變成 1.7 億是統計口徑改變，不是真的倍增。',
        en: 'Area of each type of land (hectares), 1961–2024; move the time slider to see 63 years of change. Cropland: the US went from 183 million hectares in 1961 to 155 million in 2023 (−15%); Brazil 31.4 → 63.6 million (+102%), Argentina 19.5 → 48.3 million, Indonesia 19.0 → 43.7 million, Australia 14.6 → 31.7 million; China 104 → 129 million, India 161 → 168 million; Taiwan 884,000 → 779,000 ha. Pasture: Australia 460 → 332 million ha, China 319 → 263 million, Mongolia 140 → 106 million; Saudi Arabia’s jump from exactly 85 to 170 million reflects a change in definitions, not a real doubling.',
      },
      unit: { zh: '公頃', en: 'ha' },
      file: 'area/{item}.json',
      dimension: USE_DIM,
      layer: { kind: 'bubble', legendValues: [1e6, 1e7, 1e8] },
      format: ha,
      formatTick: formatLargeTick,
      noValue: { TWN: NO_PASTURE_TW },
    },
    {
      id: 'cropland-pc',
      label: { zh: '每人耕地', en: 'Cropland per person' },
      description: {
        zh: '耕地面積除以人口（公頃／人），2023 年。哈薩克 1.50、澳洲 1.20、阿根廷 1.06、加拿大 0.98、烏克蘭 0.90、俄羅斯 0.85；美國 0.45、巴西 0.30、德國 0.14、印度 0.12、中國 0.09；日本 0.035、台灣 0.033、南韓 0.029，新加坡與香港幾乎是 0。',
        en: 'Cropland divided by population (hectares per person), 2023. Kazakhstan 1.50, Australia 1.20, Argentina 1.06, Canada 0.98, Ukraine 0.90, Russia 0.85; the US 0.45, Brazil 0.30, Germany 0.14, India 0.12, China 0.09; Japan 0.035, Taiwan 0.033, South Korea 0.029; Singapore and Hong Kong are close to zero.',
      },
      unit: { zh: '公頃/人', en: 'ha/person' },
      file: 'cropland-pc.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.03, 0.06, 0.1, 0.2, 0.4, 0.8] } },
      format: (v) => tr({ zh: fixed(v, 3) + ' 公頃/人', en: fixed(v, 3) + ' ha/person' }),
      formatTick: (v) => String(v),
    },
    {
      id: 'cover',
      label: { zh: '衛星看到的土地覆蓋', en: 'Land cover seen by satellite' },
      description: {
        zh: '14 類土地覆蓋各占全國的比例（ESA CCI，1992–2022 年）。人工地表 2022 年：摩納哥 47.6%、直布羅陀 44.2%、新加坡 37.3%、澳門 35.2%、香港 12.9%；德國 5.2%、日本 5.0%、台灣 4.6%、南韓 3.1%、中國 1.3%、美國 1.2%。樹冠覆蓋：法屬圭亞那 96.5%、蘇利南 95.6%；日本 66.2%、台灣 60.5%、巴西 51.7%。',
        en: 'Each of 14 land cover classes as a share of the country (ESA CCI, 1992–2022). Artificial surfaces in 2022: Monaco 47.6%, Gibraltar 44.2%, Singapore 37.3%, Macau 35.2%, Hong Kong 12.9%; Germany 5.2%, Japan 5.0%, Taiwan 4.6%, South Korea 3.1%, China 1.3%, the US 1.2%. Tree cover: French Guiana 96.5%, Suriname 95.6%; Japan 66.2%, Taiwan 60.5%, Brazil 51.7%.',
      },
      unit: '%',
      file: 'cover/{item}.json',
      dimension: COVER_DIM,
      layer: { kind: 'choropleth', scale: COVER_SCALE, itemScales: { ...Object.fromEntries(COVER_DIM.options.map((o) => [o.id, COVER_SCALE])), ...COVER_SCALES } },
      format: pct,
      formatTick: (v) => v + '%',
    },
    {
      id: 'built-change',
      label: { zh: '人工地表比 1992 年增加', en: 'Growth of artificial surfaces since 1992' },
      description: {
        zh: '衛星看到的人工地表（都市、道路等）比 1992 年多了幾 %（ESA CCI）。2022 年：中國 +362%、印度 +322%、台灣 +248%（4.8 萬 → 16.8 萬公頃）、南韓 +191%、巴西 +122%、日本 +106%、俄羅斯 +103%、德國 +87%、美國 +85%；吉爾吉斯、土庫曼、肯亞、巴基斯坦超過 9 倍。1992 年不到 1,000 公頃的國家不畫。一部分是感測器與演算法變好，倍數不要看得太精確。',
        en: 'How much more artificial surface (urban areas, roads, etc.) a satellite sees than in 1992 (ESA CCI). In 2022: China +362%, India +322%, Taiwan +248% (48,000 → 168,000 ha), South Korea +191%, Brazil +122%, Japan +106%, Russia +103%, Germany +87%, the US +85%; Kyrgyzstan, Turkmenistan, Kenya and Pakistan grew more than tenfold. Countries with under 1,000 ha in 1992 are not shown. Part of the growth reflects better sensors and algorithms, so do not read the multiples too precisely.',
      },
      unit: '%',
      file: 'built-change.json',
      layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [50, 100, 150, 250, 400, 700] } },
      format: (v) => (v > 0 ? '+' : '') + fixed(v, 0) + '%',
      formatTick: (v) => '+' + v + '%',
    },
  ],
};
