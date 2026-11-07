import { tr } from '../i18n/lang';
import { fixed } from '../lib/format';
import { withParts } from './parts';
import { foodsPart } from './foods';
import type { CategoryDef, IndicatorDef, ScaleSpec, Text, TopicDefinition } from './types';

const MEAT_FISH = { zh: '肉類與水產', en: 'Meat and seafood' };
const DAIRY_EGGS = { zh: '乳品與蛋', en: 'Dairy and eggs' };
const STAPLES = { zh: '穀物、薯類與豆類', en: 'Cereals, roots and pulses' };
const PRODUCE = { zh: '蔬菜水果', en: 'Fruit and vegetables' };
const OTHER = { zh: '糖、油與酒', en: 'Sugar, oils and alcohol' };
const STIMULANTS = { zh: '咖啡、茶與可可', en: 'Coffee, tea and cocoa' };

/**
 * 地圖上可選的食物（與 pipeline/topics/diet.py 的 FOODS 對應）。
 * 各類食物的人均供給量差好幾倍（蛋最多 25 公斤、乳品超過 500 公斤），所以分級門檻各自訂（thresholds），所有年份共用。
 */
const FOODS: { id: string; label: Text; group: Text; thresholds: number[] }[] = [
  { id: 'meat', label: { zh: '肉類（合計）', en: 'Meat (total)' }, group: MEAT_FISH, thresholds: [10, 20, 40, 60, 80, 100] },
  { id: 'beef', label: { zh: '牛肉（含水牛）', en: 'Beef (incl. buffalo)' }, group: MEAT_FISH, thresholds: [2, 5, 10, 15, 20, 30] },
  { id: 'pork', label: { zh: '豬肉', en: 'Pork' }, group: MEAT_FISH, thresholds: [1, 5, 10, 20, 30, 40] },
  { id: 'poultry', label: { zh: '禽肉', en: 'Poultry' }, group: MEAT_FISH, thresholds: [5, 10, 20, 30, 40, 50] },
  { id: 'fish', label: { zh: '魚類與海鮮', en: 'Fish and seafood' }, group: MEAT_FISH, thresholds: [5, 10, 15, 20, 30, 50] },
  { id: 'milk', label: { zh: '乳品（生乳當量）', en: 'Dairy (milk equivalent)' }, group: DAIRY_EGGS, thresholds: [25, 50, 100, 150, 200, 300] },
  { id: 'eggs', label: { zh: '蛋類', en: 'Eggs' }, group: DAIRY_EGGS, thresholds: [2, 4, 7, 10, 13, 16] },
  { id: 'cereals', label: { zh: '穀物（合計）', en: 'Cereals (total)' }, group: STAPLES, thresholds: [80, 100, 120, 140, 160, 180] },
  { id: 'rice', label: { zh: '稻米（白米當量）', en: 'Rice (milled equivalent)' }, group: STAPLES, thresholds: [5, 10, 25, 50, 75, 100] },
  { id: 'wheat', label: { zh: '小麥', en: 'Wheat' }, group: STAPLES, thresholds: [20, 40, 60, 80, 100, 130] },
  { id: 'maize', label: { zh: '玉米', en: 'Maize' }, group: STAPLES, thresholds: [2, 5, 10, 25, 50, 100] },
  { id: 'roots', label: { zh: '薯類', en: 'Starchy roots' }, group: STAPLES, thresholds: [25, 50, 75, 100, 150, 250] },
  { id: 'pulses', label: { zh: '乾豆類', en: 'Pulses' }, group: STAPLES, thresholds: [2, 4, 6, 8, 12, 20] },
  { id: 'vegetables', label: { zh: '蔬菜', en: 'Vegetables' }, group: PRODUCE, thresholds: [25, 50, 75, 100, 150, 200] },
  { id: 'fruit', label: { zh: '水果', en: 'Fruit' }, group: PRODUCE, thresholds: [25, 50, 75, 100, 125, 150] },
  { id: 'sugar', label: { zh: '糖與甜味劑', en: 'Sugar and sweeteners' }, group: OTHER, thresholds: [10, 20, 30, 40, 50, 60] },
  { id: 'vegetable-oils', label: { zh: '植物油', en: 'Vegetable oils' }, group: OTHER, thresholds: [5, 8, 11, 14, 17, 20] },
  { id: 'alcohol', label: { zh: '酒類', en: 'Alcoholic beverages' }, group: OTHER, thresholds: [5, 15, 30, 50, 75, 100] },
  // 咖啡只有 2010 年起（新舊版接不起來）；三種都把明顯不合理的年份拿掉（資料檔的 noValue，DESIGN.md 第 8 節第 97 點）
  { id: 'coffee', label: { zh: '咖啡（生豆）', en: 'Coffee (green beans)' }, group: STIMULANTS, thresholds: [0.5, 1, 2, 4, 6, 9] },
  { id: 'tea', label: { zh: '茶（含瑪黛茶）', en: 'Tea (incl. mate)' }, group: STIMULANTS, thresholds: [0.1, 0.25, 0.5, 1, 2, 4] },
  { id: 'cocoa', label: { zh: '可可（可可豆）', en: 'Cocoa (beans)' }, group: STIMULANTS, thresholds: [0.25, 0.5, 1, 2, 3, 4] },
];

const KCAL = { zh: '大卡/人/日', en: 'kcal/person/day' };
const GRAMS = { zh: '公克/人/日', en: 'g/person/day' };
const KG = { zh: '公斤/人/年', en: 'kg/person/year' };
const sequential = (thresholds: number[]): ScaleSpec => ({ type: 'sequential', thresholds });

/**
 * 主食（pipeline/topics/diet.py 的 STAPLES，代碼 1–5）：熱量最多的那一類是「主要主食」。
 * 側欄的 staples 依這個順序（rice、wheat…）。其他穀物是小米、高粱、大麥等，薯類是樹薯、馬鈴薯、番薯、山藥等（指標說明寫）
 */
export const STAPLE_KINDS: (CategoryDef & { id: string })[] = [
  { id: 'rice', value: 1, label: { zh: '米', en: 'Rice' } },
  { id: 'wheat', value: 2, label: { zh: '小麥', en: 'Wheat' } },
  { id: 'maize', value: 3, label: { zh: '玉米', en: 'Maize' } },
  { id: 'other-cereals', value: 4, label: { zh: '其他穀物', en: 'Other cereals' } },
  { id: 'roots', value: 5, label: { zh: '薯類', en: 'Starchy roots' } },
];

const stapleLabel = (v: number) => {
  const kind = STAPLE_KINDS.find((k) => k.value === v);
  return kind ? tr(kind.label) : '';
};

function grams(id: string, label: Text, description: Text, thresholds: number[]): IndicatorDef {
  return {
    id,
    label,
    description,
    unit: GRAMS,
    file: `${id}.json`,
    layer: { kind: 'choropleth', scale: sequential(thresholds) },
    format: (v) => `${fixed(v, 1)} ${tr(GRAMS)}`,
    formatTick: (v) => fixed(v, 0),
    compareWorld: true,
  };
}

export const diet: TopicDefinition = withParts({
  id: 'diet',
  title: { zh: '各國飲食', en: 'Diet by country' },
  shortTitle: { zh: '飲食', en: 'Diet' },
  defaultIndicator: 'energy',
  defaultYear: 2023,
  sources: [
    {
      name: { zh: 'Eurostat 家庭預算調查（hbs_str_t211，外食占家庭支出）', en: 'Eurostat Household Budget Survey (hbs_str_t211, eating out)' },
      url: 'https://ec.europa.eu/eurostat/databrowser/view/hbs_str_t211/default/table',
      license: 'CC BY 4.0',
    },
    {
      name: {
        zh: 'FAO, FAOSTAT（糧食平衡表、糧食安全指標）',
        en: 'FAO, FAOSTAT (Food Balance Sheets, Suite of Food Security Indicators)',
      },
      url: 'https://www.fao.org/faostat/',
      license: 'CC BY 4.0',
    },
    {
      name: { zh: '農業部《糧食供需年報》（台灣的對照數字）', en: 'Ministry of Agriculture (Taiwan), food balance sheet (for comparison)' },
      url: 'https://www.moa.gov.tw/ws.php?id=7256',
      license: { zh: '政府資料開放授權條款', en: 'Open Government Data License, Taiwan' },
    },
  ],
  note: {
    zh: '糧食平衡表算的是「供給」：國內生產加進口、減出口與飼料、種子、加工、損耗等用途後，平均每人可以吃到的量，比實際吃下去的多（不含家戶與餐廳的浪費）。FAO 在 2010 年改用新方法，2009 年以前是舊版，個別國家與食物在 2010 年可能跳一下（側欄的垂直虛線）。新版沒有日本等少數國家。咖啡、茶、可可的供給量在轉口地（香港、澳門、盧森堡）與產地（斯里蘭卡、肯亞的茶，象牙海岸的可可）常常遠超過實際喝的量，咖啡 16.5、茶 10、可可 6.5 公斤以上的年份標「數字不可靠」，不畫、不排名；FAOSTAT 2020 年起產茶國的茶大增，也是這個原因。台灣的資料是 FAO 的，側欄附上農業部糧食供需年報的數字對照。各國捕撈與養殖的水產見「海洋與漁業」主題。',
    en: "Food balance sheets measure supply: domestic production plus imports, minus exports and non-food uses such as feed, seed, processing and losses, averaged per person. This is more than people actually eat, as household and restaurant waste is not subtracted. FAO switched to a new method in 2010; earlier years come from the old series, so some countries and foods jump in 2010 (the vertical dashed line in the side panel). A few countries, including Japan, are missing from the new series. Supply of coffee, tea and cocoa in re-export hubs (Hong Kong, Macao, Luxembourg) and producing countries (tea in Sri Lanka and Kenya, cocoa in Côte d'Ivoire) often far exceeds what people drink; years above 16.5 kg of coffee, 10 kg of tea or 6.5 kg of cocoa per person are marked as unreliable and are not shown or ranked, which also covers the jump in tea for tea-growing countries from 2020. Taiwan's figures are FAO's; the side panel adds the Ministry of Agriculture's own food balance sheet for comparison. For fish caught and farmed by country see Oceans and fisheries.",
  },
  dimension: {
    label: { zh: '食物', en: 'Food' },
    options: FOODS.map(({ id, label, group }) => ({ id, label, group })),
    defaultOption: 'meat',
  },
  panelExtra: () => import('./panels/DietPanel'),
  indicators: [
    {
      id: 'energy',
      label: { zh: '熱量供給', en: 'Dietary energy supply' },
      description: {
        zh: '平均每人每天可以從食物得到的熱量（大卡），含酒類。一般成人每天大約需要 2,000–2,500 大卡。',
        en: 'Food calories available per person per day (kcal), including alcoholic beverages. An adult typically needs about 2,000–2,500 kcal a day.',
      },
      unit: KCAL,
      file: 'energy.json',
      layer: { kind: 'choropleth', scale: sequential([2000, 2300, 2600, 2900, 3200, 3500]) },
      format: (v) => `${fixed(v, 0)} ${tr(KCAL)}`,
      formatTick: (v) => fixed(v, 0),
      compareWorld: true,
    },
    grams(
      'protein',
      { zh: '蛋白質供給', en: 'Protein supply' },
      {
        zh: '平均每人每天可以從食物得到的蛋白質（公克），含植物性與動物性。',
        en: 'Protein available per person per day (grams), from plant and animal foods.',
      },
      [50, 60, 75, 90, 105, 120],
    ),
    grams(
      'fat',
      { zh: '脂肪供給', en: 'Fat supply' },
      {
        zh: '平均每人每天可以從食物得到的脂肪（公克），含食用油、肉類與乳品裡的脂肪。',
        en: 'Fat available per person per day (grams), including cooking oils and the fat in meat and dairy.',
      },
      [30, 50, 70, 90, 110, 130],
    ),
    {
      id: 'animal-share',
      label: { zh: '動物性食物占熱量', en: 'Calories from animal products' },
      description: {
        zh: '熱量裡來自肉類、水產、蛋、乳品與動物油脂的比例。',
        en: 'Share of calories that comes from meat, seafood, eggs, dairy and animal fats.',
      },
      unit: '%',
      file: 'animal-share.json',
      layer: { kind: 'choropleth', scale: sequential([5, 10, 15, 20, 25, 30]) },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'staple',
      label: { zh: '主要主食', en: 'Main staple' },
      description: {
        zh: '熱量最多的主食是哪一種：米、小麥、玉米、其他穀物（小米、高粱、大麥等）或薯類（樹薯、馬鈴薯、番薯、山藥等）。依每人每日從各種主食得到的熱量比較；播放時間軸看各國的主食怎麼換。',
        en: 'Which staple supplies the most calories: rice, wheat, maize, other cereals (millet, sorghum, barley and so on) or starchy roots (cassava, potatoes, sweet potatoes, yams and so on), compared by calories per person per day. Play the timeline to see staples change.',
      },
      unit: '',
      file: 'staple.json',
      layer: { kind: 'categorical', categories: STAPLE_KINDS.map(({ value, label }) => ({ value, label })) },
      format: stapleLabel,
    },
    {
      id: 'staple-share',
      label: { zh: '主要主食占熱量', en: 'Calories from the main staple' },
      description: {
        zh: '熱量最多的那種主食占總熱量的比例：越高越依賴單一主食（2023 年剛果民主共和國的薯類 67%、孟加拉的米 64%，台灣的米 13%）。點國家看 5 類主食各提供多少熱量。',
        en: 'Share of all calories supplied by the main staple: the higher it is, the more a diet relies on one staple (in 2023, starchy roots supplied 67% in DR Congo and rice 64% in Bangladesh; rice supplied 13% in Taiwan). Click a country for the calories from each of the five staples.',
      },
      unit: '%',
      file: 'staple-share.json',
      layer: { kind: 'choropleth', scale: sequential([10, 20, 30, 40, 50, 60]) },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    {
      id: 'supply',
      label: { zh: '人均供給量', en: 'Supply per person' },
      description: {
        zh: '平均每人每年可以吃到的量（公斤）。肉類是屠體重量（含骨），乳品換算成生乳；咖啡、茶、可可是生豆、乾茶葉、可可豆的重量，不是杯數，茶含瑪黛茶（阿根廷、巴拉圭、烏拉圭特別高）。2010 年 FAO 改方法，乳品、蔬菜、植物油等在部分國家前後差很多；咖啡兩版差太多，只畫 2010 年起。咖啡、茶、可可在轉口地與產地常算出不可能的數字，那些年份標「數字不可靠」、不畫也不排名。',
        en: 'Quantity available per person per year (kg). Meat is carcass weight (bone-in) and dairy is converted to milk equivalent; coffee, tea and cocoa are the weight of green beans, dry tea leaves and cocoa beans, not cups, and tea includes mate (hence the high figures for Argentina, Paraguay and Uruguay). FAO changed its method in 2010, and dairy, vegetables, vegetable oils and some other foods jump noticeably in some countries; coffee differs too much between the two methods, so it starts in 2010. For coffee, tea and cocoa, re-export hubs and producing countries often get impossible figures; those years are marked as unreliable and are not shown or ranked.',
      },
      unit: KG,
      file: 'supply/{item}.json',
      layer: {
        kind: 'choropleth',
        scale: sequential(FOODS[0].thresholds),
        itemScales: Object.fromEntries(FOODS.map((f) => [f.id, sequential(f.thresholds)])),
      },
      // 咖啡、茶、可可的資料到小數第二位（台灣的茶 1.43、可可 0.67），有第二位才寫；其他食物只到第一位，照舊
      format: (v) => `${fixed(v, v < 10 && Math.round(v * 100) % 10 !== 0 ? 2 : v < 100 ? 1 : 0)} ${tr(KG)}`,
      formatTick: (v) => fixed(v, Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2),
      compareWorld: true,
    },
    {
      id: 'undernourishment',
      label: { zh: '營養不足人口比例', en: 'Prevalence of undernourishment' },
      description: {
        zh: '平時吃不到足夠熱量、無法維持正常活動的人口比例。FAO 依熱量供給與分配推估，三年平均，標在中間那一年；低於 2.5% 只公布「< 2.5%」。',
        en: 'Share of the population whose usual food intake does not provide enough energy for a normal, active life. FAO models it from food supply and its distribution, as a three-year average shown at the middle year; values below 2.5% are only reported as “< 2.5%”.',
      },
      unit: '%',
      file: 'undernourishment.json',
      layer: { kind: 'choropleth', scale: sequential([2.5, 5, 10, 15, 25, 35]) },
      // FAO 只公布「<2.5」的國家在資料裡記成 0
      format: (v) => (v < 2.5 ? '< 2.5%' : `${fixed(v, 1)}%`),
      formatTick: (v) => `${v}%`,
      compareWorld: true,
    },
    // 2026-11-06（製作手冊第二十四批 421；pipeline/topics/eating_out_share.py）：Eurostat 家庭預算調查的餐廳支出比重
    {
      id: 'eating-out-share',
      label: { zh: '外食占家庭支出', en: 'Eating out in household spending' },
      description: {
        zh: '餐廳、咖啡館這類地方的花費占家庭消費支出的比例（Eurostat 家庭預算調查，COICOP「Restaurants, cafés and the like」，大約五年一次，1988–2020 年）。2015 年西班牙 8.3% 最高，賽普勒斯 8.0%、希臘 7.8%、馬爾他 7.6%、葡萄牙 7.5%；德國 3.4%、法國 3.2%，波蘭 1.5%、匈牙利 1.3%、羅馬尼亞 0.7% 最低。2020 年是疫情年，兩波都有的 27 國裡 12 國比 2015 年低（西班牙 8.3% → 5.5%、希臘 7.8% → 6.0%），各國的調查期不同，要小心比較。只有歐洲；台灣的家庭收支調查把外食放在食品類下，分類對不上，沒有畫。比例也受分母影響：住房花費高的國家，外食的比例會被壓低。',
        en: 'Spending at restaurants, cafés and the like as a share of household consumption (Eurostat Household Budget Survey, COICOP “Restaurants, cafés and the like”, roughly every five years, 1988–2020). In 2015 Spain was highest at 8.3%, then Cyprus 8.0%, Greece 7.8%, Malta 7.6% and Portugal 7.5%; Germany 3.4% and France 3.2%; Poland 1.5%, Hungary 1.3% and Romania 0.7% were lowest. 2020 was the pandemic year: of the 27 countries in both waves, 12 were lower than in 2015 (Spain 8.3% → 5.5%, Greece 7.8% → 6.0%); survey periods differ by country, so compare with care. Europe only; Taiwan’s household survey files eating out under food, which does not match the classification, so it is not shown. The share also depends on the denominator: where housing costs are high, eating out looks smaller.',
      },
      unit: '%',
      file: 'eating-out-share.json',
      layer: { kind: 'choropleth', scale: sequential([1.5, 2.5, 3.5, 5, 6.5, 8]) },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      defaultYear: 2015,
    },
    // 2026-11-07（製作手冊第二十七批 562，候選 1268、1269、1270）：FAOSTAT 糧食安全指標（pipeline/topics/diet_security.py），
    // 三年平均標在中間那一年
    {
      id: 'food-insecurity',
      label: { zh: '中度或嚴重的糧食不安全', en: 'Moderate or severe food insecurity' },
      description: {
        zh: 'FAO 的糧食不安全經驗量表（FIES）直接問受訪者過去一年有沒有因為沒錢或資源而擔心沒東西吃、少吃一餐、整天沒吃，中度或嚴重的比例，三年平均標在中間那一年。2023–2025 年 135 國：獅子山 91.1%、南蘇丹 90.4%、海地 86.7%、阿富汗 85.3%、剛果民主共和國 83.5% 最高，賽普勒斯 1.5%、義大利 1.8%、白俄羅斯 1.8%、哈薩克 2.0% 最低；新加坡 12.1%、美國 11.0%、日本 7.4%、南韓 7.3%、德國 5.5%，世界 27.3%。135 國裡 98 國女性比男性高（摩爾多瓦、秘魯差 10 個百分點以上），滑過看男女。跟「營養不足人口比例」（用糧食供給推估的模型值）是不同的方法，同一國常差很多。台灣沒有在 FIES 的調查裡。',
        en: 'FAO’s Food Insecurity Experience Scale asks people directly whether, in the past year, lack of money or resources made them worry about food, skip a meal or go a whole day without eating; this is the share with moderate or severe food insecurity, as a three-year average shown at the middle year. For 2023–2025, of 135 countries, Sierra Leone (91.1%), South Sudan (90.4%), Haiti (86.7%), Afghanistan (85.3%) and DR Congo (83.5%) are highest and Cyprus (1.5%), Italy and Belarus (1.8%) and Kazakhstan (2.0%) lowest; Singapore 12.1%, the US 11.0%, Japan 7.4%, South Korea 7.3% and Germany 5.5%; the world 27.3%. In 98 of the 135 countries women are worse off than men (by more than 10 points in Moldova and Peru); hover for both. It is a different method from the prevalence of undernourishment (a model estimate from food supply), and the two often differ a lot. Taiwan is not covered by the FIES surveys.',
      },
      unit: '%',
      file: 'food-insecurity.json',
      layer: { kind: 'choropleth', scale: sequential([5, 10, 20, 35, 50, 70]) },
      format: (v) => `${fixed(v, 1)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 'latest',
    },
    {
      id: 'food-insecurity-severe',
      label: { zh: '嚴重的糧食不安全', en: 'Severe food insecurity' },
      description: {
        zh: '同一個量表裡嚴重的那一級（整天沒東西吃、斷糧），三年平均。2023–2025 年 133 國：南蘇丹 64.6%、馬拉威 59.5%、海地 48.7%、剛果民主共和國 46.0% 最高；新加坡 4.9%、南韓 2.0%、日本 1.9%、德國 1.9%、美國 1.2%，世界 10.1%；不到 0.5% 的只公布「<0.5」。台灣沒有在 FIES 的調查裡。',
        en: 'The severe level of the same scale (going whole days without food), as a three-year average. For 2023–2025, of 133 countries, South Sudan (64.6%), Malawi (59.5%), Haiti (48.7%) and DR Congo (46.0%) are highest; Singapore 4.9%, South Korea 2.0%, Japan and Germany 1.9% and the US 1.2%; the world 10.1%. Values below 0.5% are only reported as “<0.5”. Taiwan is not covered by the FIES surveys.',
      },
      unit: '%',
      file: 'food-insecurity-severe.json',
      layer: { kind: 'choropleth', scale: sequential([1, 3, 5, 10, 20, 35]) },
      format: (v) => (v < 0.5 ? '< 0.5%' : `${fixed(v, 1)}%`),
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 'latest',
    },
    {
      id: 'cereal-import-dependency',
      label: { zh: '穀物進口依賴度', en: 'Cereal import dependency' },
      description: {
        zh: '穀物（米、小麥、玉米等）的進口減出口，占國內用量（生產加進口減出口）的比例，三年平均。100% 是全部靠進口，負值是淨出口：巴拉圭 −1,894%（出口量約是國內用量的 19 倍）、保加利亞 −1,016%、烏克蘭 −298%、澳洲 −242%、美國 −20%、印度 −12%，2021–2023 年 162 國裡 34 國是淨出口。卡達、馬爾他、千里達及托巴哥等 16 國 100%；台灣 78.3%、南韓 78.5%、中國大陸 9.2%、德國 0.4%，世界 −0.9%。這是穀物的重量，跟農業部以熱量計的糧食自給率（台灣約三成）定義不同。',
        en: 'Cereal (rice, wheat, maize and so on) imports minus exports, as a share of domestic use (production plus imports minus exports), as a three-year average. 100% means everything is imported, and negative values mean net exports: Paraguay −1,894% (exports about 19 times domestic use), Bulgaria −1,016%, Ukraine −298%, Australia −242%, the US −20% and India −12%; 34 of 162 countries were net exporters in 2021–2023. Sixteen, including Qatar, Malta and Trinidad and Tobago, are at 100%; Taiwan 78.3%, South Korea 78.5%, mainland China 9.2% and Germany 0.4%; the world −0.9%. This is by weight of cereals, unlike Taiwan’s official calorie-based food self-sufficiency ratio (about 30%).',
      },
      unit: '%',
      file: 'cereal-import-dependency.json',
      layer: { kind: 'choropleth', scale: { type: 'diverging', thresholds: [-100, -25, -5, 5, 25, 75], reverse: true } },
      format: (v) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), Math.abs(v) >= 100 ? 0 : 1)}%`,
      formatTick: (v) => `${v < 0 ? '−' : ''}${fixed(Math.abs(v), 0)}%`,
      compareWorld: true,
      defaultYear: 'latest',
    },
    {
      id: 'food-imports-share',
      label: { zh: '食物進口占商品出口', en: 'Food imports relative to merchandise exports' },
      description: {
        zh: '食物進口的金額相當於商品出口的幾 %，三年平均：越高越需要靠其他收入（觀光、匯款、援助）買食物。2022–2024 年 193 國：吐瓦魯 20,840%、東加 715%、安地卡及巴布達 661%、葉門 508%、維德角 489%，最高一級是 200% 以上（17 國，多半是小島國，滑過看真值）；挪威、卡達、香港、瑞士 3% 最低；台灣 3%、南韓 5%、中國大陸 5%、日本 7%、美國 9%，世界 7%。',
        en: 'The value of food imports as a percentage of merchandise exports, as a three-year average: the higher it is, the more a country relies on other income (tourism, remittances, aid) to buy food. For 2022–2024, of 193 countries, Tuvalu (20,840%), Tonga (715%), Antigua and Barbuda (661%), Yemen (508%) and Cape Verde (489%) are highest, and the top class is 200% or more (17 countries, mostly small islands; hover for the actual value); Norway, Qatar, Hong Kong and Switzerland are lowest at 3%; Taiwan 3%, South Korea and mainland China 5%, Japan 7% and the US 9%; the world 7%.',
      },
      unit: '%',
      file: 'food-imports-share.json',
      layer: { kind: 'choropleth', scale: sequential([5, 10, 20, 50, 100, 200]) },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 'latest',
    },
    {
      id: 'energy-adequacy',
      label: { zh: '熱量供給充足度', en: 'Dietary energy supply adequacy' },
      description: {
        zh: '平均每人的熱量供給除以平均需求（依人口的年齡、性別與身高估計），三年平均。超過 100% 不代表吃太多：高所得國家的 150% 多半是浪費掉或沒吃到的部分。2023–2025 年 157 國：以色列 163%、塞爾維亞 157%、愛爾蘭 157%、比利時 156%、美國 154% 最高，索馬利亞 80%、海地 84%、馬達加斯加 89%、尚比亞 93% 最低；台灣 120%、印度 116%、南韓 138%、中國大陸 142%，世界 126%。跟「熱量供給」指標是同一份糧食平衡表的不同表達。',
        en: 'Average dietary energy supply per person divided by average requirement (estimated from the population’s age, sex and height), as a three-year average. Above 100% does not mean people eat too much: much of the 150% in rich countries is wasted or not eaten. For 2023–2025, of 157 countries, Israel (163%), Serbia and Ireland (157%), Belgium (156%) and the US (154%) are highest and Somalia (80%), Haiti (84%), Madagascar (89%) and Zambia (93%) lowest; Taiwan 120%, India 116%, South Korea 138% and mainland China 142%; the world 126%. It is another way of expressing the same food balance sheets as the Dietary energy supply indicator.',
      },
      unit: '%',
      file: 'energy-adequacy.json',
      layer: { kind: 'choropleth', scale: sequential([100, 110, 120, 130, 140, 150]) },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 'latest',
    },
    {
      id: 'energy-staples-share',
      label: { zh: '穀物與根莖類占熱量', en: 'Cereals, roots and tubers in dietary energy' },
      description: {
        zh: '熱量供給裡來自穀物、根莖與薯類（米、麵、玉米、樹薯、馬鈴薯等）合計的比例，三年平均：越高吃得越單調。跟「主要主食占熱量」不同：那是最大的一類主食，這是全部加起來，所以一定比較大。2021–2023 年 176 國：剛果民主共和國 82%、馬達加斯加 81%、柬埔寨 75%、獅子山 74% 最高，巴哈馬 21%、愛沙尼亞 22%、格瑞那達 22%、澳洲 23% 最低；台灣 29%、南韓 33%、美國 24%、中國大陸 50%、印度 53%，世界 49%。',
        en: 'Share of dietary energy supply from cereals, roots and tubers together (rice, wheat, maize, cassava, potatoes and so on), as a three-year average: the higher it is, the less varied the diet. Unlike the main staple’s share of calories, which counts only the largest staple, this adds them all up, so it is always larger. For 2021–2023, of 176 countries, DR Congo (82%), Madagascar (81%), Cambodia (75%) and Sierra Leone (74%) are highest and the Bahamas (21%), Estonia and Grenada (22%) and Australia (23%) lowest; Taiwan 29%, South Korea 33%, the US 24%, mainland China 50% and India 53%; the world 49%.',
      },
      unit: '%',
      file: 'energy-staples-share.json',
      layer: { kind: 'choropleth', scale: sequential([25, 35, 45, 55, 65, 75]) },
      format: (v) => `${fixed(v, 0)}%`,
      formatTick: (v) => `${v}%`,
      compareWorld: true,
      defaultYear: 'latest',
    },
  ],
}, foodsPart);
