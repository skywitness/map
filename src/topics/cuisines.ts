import { tr, type Text } from '../i18n/lang';
import { fixed } from '../lib/format';
import type { FlowLabels, IndicatorDef, ScaleSpec, TopicDefinition } from './types';
import { withTerritories } from './osm-territories';

/**
 * 菜系走到哪裡（新主題，2026-11-07，製作手冊第二十四批 431；pipeline/topics/cuisines.py）：
 * OpenStreetMap 的 cuisine 標籤，32 個有明確原產國的菜系。點選國家看它的菜在哪些國家（流向圖），
 * 或這國的外國菜從哪裡來；選菜系看各國每百萬人幾家、占有標菜系的店幾成。
 */

const ASIA: Text = { zh: '亞洲', en: 'Asia' };
const EUROPE: Text = { zh: '歐洲', en: 'Europe' };
const AMERICAS: Text = { zh: '美洲', en: 'Americas' };
const MEA: Text = { zh: '中東與非洲', en: 'Middle East and Africa' };

/** 菜系（pipeline 的 CUISINES） */
export const CUISINES: { id: string; label: Text; group: Text }[] = [
  { id: 'chinese', label: { zh: '中國菜', en: 'Chinese' }, group: ASIA },
  { id: 'japanese', label: { zh: '日本菜', en: 'Japanese' }, group: ASIA },
  { id: 'korean', label: { zh: '韓國菜', en: 'Korean' }, group: ASIA },
  { id: 'taiwanese', label: { zh: '台灣菜', en: 'Taiwanese' }, group: ASIA },
  { id: 'thai', label: { zh: '泰國菜', en: 'Thai' }, group: ASIA },
  { id: 'vietnamese', label: { zh: '越南菜', en: 'Vietnamese' }, group: ASIA },
  { id: 'indian', label: { zh: '印度菜', en: 'Indian' }, group: ASIA },
  { id: 'indonesian', label: { zh: '印尼菜', en: 'Indonesian' }, group: ASIA },
  { id: 'malaysian', label: { zh: '馬來西亞菜', en: 'Malaysian' }, group: ASIA },
  { id: 'filipino', label: { zh: '菲律賓菜', en: 'Filipino' }, group: ASIA },
  { id: 'nepalese', label: { zh: '尼泊爾菜', en: 'Nepalese' }, group: ASIA },
  { id: 'pakistani', label: { zh: '巴基斯坦菜', en: 'Pakistani' }, group: ASIA },
  { id: 'georgian', label: { zh: '喬治亞菜', en: 'Georgian' }, group: ASIA },
  { id: 'italian', label: { zh: '義大利菜', en: 'Italian' }, group: EUROPE },
  { id: 'french', label: { zh: '法國菜', en: 'French' }, group: EUROPE },
  { id: 'spanish', label: { zh: '西班牙菜', en: 'Spanish' }, group: EUROPE },
  { id: 'portuguese', label: { zh: '葡萄牙菜', en: 'Portuguese' }, group: EUROPE },
  { id: 'greek', label: { zh: '希臘菜', en: 'Greek' }, group: EUROPE },
  { id: 'german', label: { zh: '德國菜', en: 'German' }, group: EUROPE },
  { id: 'polish', label: { zh: '波蘭菜', en: 'Polish' }, group: EUROPE },
  { id: 'russian', label: { zh: '俄羅斯菜', en: 'Russian' }, group: EUROPE },
  { id: 'ukrainian', label: { zh: '烏克蘭菜', en: 'Ukrainian' }, group: EUROPE },
  { id: 'mexican', label: { zh: '墨西哥菜', en: 'Mexican' }, group: AMERICAS },
  { id: 'peruvian', label: { zh: '秘魯菜', en: 'Peruvian' }, group: AMERICAS },
  { id: 'brazilian', label: { zh: '巴西菜', en: 'Brazilian' }, group: AMERICAS },
  { id: 'argentinian', label: { zh: '阿根廷菜', en: 'Argentinian' }, group: AMERICAS },
  { id: 'turkish', label: { zh: '土耳其菜', en: 'Turkish' }, group: MEA },
  { id: 'lebanese', label: { zh: '黎巴嫩菜', en: 'Lebanese' }, group: MEA },
  { id: 'syrian', label: { zh: '敘利亞菜', en: 'Syrian' }, group: MEA },
  { id: 'persian', label: { zh: '波斯菜（伊朗）', en: 'Persian (Iranian)' }, group: MEA },
  { id: 'moroccan', label: { zh: '摩洛哥菜', en: 'Moroccan' }, group: MEA },
  { id: 'ethiopian', label: { zh: '衣索比亞菜', en: 'Ethiopian' }, group: MEA },
];
const DIMENSION = { label: { zh: '菜系', en: 'Cuisine' }, options: CUISINES, defaultOption: 'italian' };

/** 各菜系每百萬人的門檻（依資料的分布取，菜系之間差好幾倍） */
const DENSITY_SCALES: Record<string, ScaleSpec> = {
  'chinese': { type: 'sequential', thresholds: [2.5, 10, 20, 25.0, 50, 100] },
  'italian': { type: 'sequential', thresholds: [5, 10, 20, 50, 100] },
  'mexican': { type: 'sequential', thresholds: [0.5, 1.0, 2, 5, 10, 20] },
  'japanese': { type: 'sequential', thresholds: [1.0, 2, 5, 10, 20, 50] },
  'indian': { type: 'sequential', thresholds: [2, 5, 10, 20, 25.0, 50] },
  'thai': { type: 'sequential', thresholds: [1.0, 2.5, 5, 10, 20, 50] },
  'korean': { type: 'sequential', thresholds: [0.5, 1.0, 2, 5, 10, 20] },
  'vietnamese': { type: 'sequential', thresholds: [1.0, 2, 5, 10, 20] },
  'turkish': { type: 'sequential', thresholds: [1.0, 2, 5, 10, 20] },
  'french': { type: 'sequential', thresholds: [0.5, 2, 2.5, 5, 10, 20] },
  'greek': { type: 'sequential', thresholds: [0.5, 2, 2.5, 5, 10, 20] },
  'lebanese': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5, 10] },
  'spanish': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5] },
  'german': { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1.0, 2, 5] },
  'peruvian': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2] },
  'ethiopian': { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.5, 1.0, 2] },
  'georgian': { type: 'sequential', thresholds: [0.25, 1.0, 2, 2.5, 5, 10] },
  'persian': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2] },
  'filipino': { type: 'sequential', thresholds: [0.05, 0.2, 0.25, 0.5, 1.0, 2] },
  'indonesian': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5, 10] },
  'nepalese': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 5] },
  'portuguese': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5, 10] },
  'brazilian': { type: 'sequential', thresholds: [0.05, 0.2, 0.25, 0.5, 1.0, 2] },
  'taiwanese': { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.5, 1.0, 2] },
  'malaysian': { type: 'sequential', thresholds: [0.5, 1.0, 2, 5, 10] },
  'moroccan': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 2.5] },
  'russian': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5, 10] },
  'pakistani': { type: 'sequential', thresholds: [0.05, 0.2, 0.25, 0.5, 1.0, 2] },
  'polish': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 2.5] },
  'argentinian': { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1.0, 2, 5] },
  'syrian': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 5] },
  'ukrainian': { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1.0, 2, 5] },
};
const SHARE_SCALES: Record<string, ScaleSpec> = {
  'chinese': { type: 'sequential', thresholds: [0.25, 1.0, 2, 2.5, 5, 10] },
  'italian': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5, 10] },
  'mexican': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 2.5] },
  'japanese': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 5] },
  'indian': { type: 'sequential', thresholds: [0.2, 0.5, 1.0, 2, 5, 10] },
  'thai': { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1.0, 2, 5] },
  'korean': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 2.5] },
  'vietnamese': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2] },
  'turkish': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 5] },
  'french': { type: 'sequential', thresholds: [0.1, 0.25, 0.5, 1.0, 2, 5] },
  'greek': { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.5, 1.0, 2] },
  'lebanese': { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.5, 1.0, 2] },
  'spanish': { type: 'sequential', thresholds: [0.025, 0.1, 0.2, 0.25, 0.5, 1.0] },
  'german': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.5] },
  'peruvian': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.5, 1.0] },
  'ethiopian': { type: 'sequential', thresholds: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5] },
  'georgian': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 2.5] },
  'persian': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.25, 0.5] },
  'filipino': { type: 'sequential', thresholds: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5] },
  'indonesian': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.5, 1.0] },
  'nepalese': { type: 'sequential', thresholds: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5] },
  'portuguese': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2, 5] },
  'brazilian': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.25, 0.5] },
  'taiwanese': { type: 'sequential', thresholds: [0.01, 0.02, 0.05, 0.1, 0.2, 0.25] },
  'malaysian': { type: 'sequential', thresholds: [0.05, 0.1, 0.2, 0.5, 1.0, 2] },
  'moroccan': { type: 'sequential', thresholds: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5] },
  'russian': { type: 'sequential', thresholds: [0.1, 0.2, 0.5, 1.0, 2] },
  'pakistani': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.5, 1.0] },
  'polish': { type: 'sequential', thresholds: [0.005, 0.02, 0.025, 0.05, 0.1, 0.2] },
  'argentinian': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.25, 0.5] },
  'syrian': { type: 'sequential', thresholds: [0.01, 0.02, 0.05, 0.1, 0.2, 0.25] },
  'ukrainian': { type: 'sequential', thresholds: [0.02, 0.05, 0.1, 0.2, 0.5, 1.0] },
};

const PLACES: Text = { zh: '家', en: 'places' };
const places = (v: number) => tr({ zh: `${fixed(v, 0)} 家`, en: `${fixed(v, 0)} ${v === 1 ? 'place' : 'places'}` });

const FLOW_LABELS: Record<'export' | 'import', FlowLabels> = {
  export: {
    partners: { zh: '有這國菜的國家', en: 'countries serving its cuisine' },
    main: { zh: '這國的菜在哪些國家最多', en: 'Where its cuisine is served most' },
    verb: (origin, partner) => tr({ zh: `${partner}的${origin}菜`, en: `${origin} cuisine in ${partner}` }),
  },
  import: {
    partners: { zh: '這裡的外國菜從哪些國家來', en: 'origins of the foreign cuisines here' },
    main: { zh: '這裡最多的外國菜', en: 'Most common foreign cuisines here' },
    verb: (origin, partner) => tr({ zh: `${origin}的${partner}菜`, en: `${partner} cuisine in ${origin}` }),
  },
};

const CAVEAT: Text = {
  zh: '原產國本國的餐廳常常不標菜系（在義大利，義大利菜是預設），所以本國的數字偏低；OSM 畫得完整的程度各國差很多，中國、印度這類國家明顯畫得少。',
  en: 'Restaurants in a cuisine’s home country often omit the tag (in Italy, Italian is the default), so home counts are low; OSM completeness varies widely, and countries such as China and India are clearly under-mapped.',
};

const indicators: IndicatorDef[] = [
  {
    id: 'abroad',
    label: { zh: '這國的菜在國外', en: 'Its cuisine abroad' },
    description: {
      zh: `OpenStreetMap 上標成這國菜系、開在國外的店有幾家（點選國家，畫出它的菜在哪些國家）：義大利菜 64,495 家、中國菜 63,851、墨西哥菜 42,082、印度菜 29,374、日本菜 28,916、泰國菜 17,694、越南菜 12,917、希臘菜 12,360、土耳其菜 9,968、韓國菜 9,692。墨西哥菜有 32,369 家在美國，占全世界標成墨西哥菜的 68%；印度菜在英國 7,539 家最多。台灣菜在國外 732 家：美國 174、日本 124、新加坡 52、香港 41、中國大陸 30。${CAVEAT.zh}`,
      en: `Places tagged on OpenStreetMap with a country’s cuisine outside that country (select a country to draw where its cuisine is served): Italian 64,495, Chinese 63,851, Mexican 42,082, Indian 29,374, Japanese 28,916, Thai 17,694, Vietnamese 12,917, Greek 12,360, Turkish 9,968 and Korean 9,692. 32,369 Mexican places are in the US, 68% of all Mexican places worldwide; Indian is most common in the UK, with 7,539. Taiwanese cuisine has 732 places abroad: the US 174, Japan 124, Singapore 52, Hong Kong 41 and mainland China 30. ${CAVEAT.en}`,
    },
    unit: PLACES,
    file: 'abroad.json',
    layer: { kind: 'flow', file: 'flows.json', direction: 'export', labels: FLOW_LABELS, legendKey: { zh: '由菜系的原產國（淺）到開店的國家（深）', en: 'From the cuisine’s home country (light) to where it is served (dark)' } },
    format: places,
    formatTick: (v) => fixed(v, 0),
    integer: true,
    missing: { zh: '不在這裡收的 32 個菜系', en: 'Not among the 32 cuisines covered' },
  },
  {
    id: 'foreign',
    label: { zh: '外國菜的比例', en: 'Share of foreign cuisines' },
    description: {
      zh: `OpenStreetMap 上有標菜系的店裡，外國菜（32 個有原產國的菜系，不含本國）占幾成；點選國家，畫出它的外國菜從哪些國家來。只畫有標菜系的店至少 200 家的國家。盧森堡 59.9% 最高，汶萊 46.8%、新加坡 46.0%、紐西蘭 41.7%；英國 34.7%、德國 33.3%、美國 24.3%、法國 21.0%、日本 17.9%、南韓 12.7%、台灣 11.6%（標中式的不算外國菜）；義大利 7.4%、土耳其 4.6%、中國 4.2% 最低。分母含披薩、漢堡、咖啡這類不分國家的標籤。`,
      en: `Of the places with a cuisine tag on OpenStreetMap, the share serving a foreign national cuisine (among the 32 covered, excluding the country’s own); select a country to draw where its foreign cuisines come from. Only countries with at least 200 tagged places are shaded. Luxembourg is highest at 59.9%, then Brunei 46.8%, Singapore 46.0% and New Zealand 41.7%; the UK 34.7%, Germany 33.3%, the US 24.3%, France 21.0%, Japan 17.9%, South Korea 12.7% and Taiwan 11.6% (places tagged Chinese are not counted as foreign); Italy 7.4%, Türkiye 4.6% and China 4.2% are lowest. The denominator includes tags without a country, such as pizza, burger or coffee shop.`,
    },
    unit: '%',
    file: 'foreign.json',
    layer: { kind: 'flow', file: 'flows.json', direction: 'import', labels: FLOW_LABELS, legendKey: { zh: '由菜系的原產國（淺）到開店的國家（深）', en: 'From the cuisine’s home country (light) to where it is served (dark)' } },
    format: (v) => `${fixed(v, 1)}%`,
    formatTick: (v) => `${v}%`,
    missing: { zh: '有標菜系的店不到 200 家', en: 'Fewer than 200 places with a cuisine tag' },
  },
  {
    id: 'cuisine-density',
    label: { zh: '每百萬人幾家', en: 'Places per million people' },
    description: {
      zh: `選一個菜系，看各國每百萬人有幾家標成這個菜系的店，只替 OSM 覆蓋良好的國家上色。例如義大利菜盧森堡 340 家、義大利 283、瑞士 197、德國 172；中國菜盧森堡 164、紐西蘭 135、英國 119，台灣 104；日本菜日本 157，台灣 52 排第 5；台灣菜台灣 45、新加坡 8.8。${CAVEAT.zh}`,
      en: `Pick a cuisine to see places tagged with it per million people, shaded only where OSM is reasonably complete. Italian: Luxembourg 340, Italy 283, Switzerland 197 and Germany 172; Chinese: Luxembourg 164, New Zealand 135, the UK 119 and Taiwan 104; Japanese: Japan 157, with Taiwan fifth at 52; Taiwanese: Taiwan 45 and Singapore 8.8. ${CAVEAT.en}`,
    },
    unit: { zh: '家／百萬人', en: 'per million' },
    file: 'density/{item}.json',
    dimension: DIMENSION,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [1, 5, 10, 20, 50, 100] }, itemScales: DENSITY_SCALES },
    format: (v) => tr({ zh: `每百萬人 ${fixed(v, v < 10 ? 1 : 0)} 家`, en: `${fixed(v, v < 10 ? 1 : 0)} per million` }),
    formatTick: (v) => fixed(v, v < 10 ? 1 : 0),
    panelChart: false,
  },
  {
    id: 'cuisine-share',
    label: { zh: '占有標菜系的店幾成', en: 'Share of tagged places' },
    description: {
      zh: '選一個菜系，看它占各國有標菜系的店幾成（只畫有標菜系的店至少 200 家的國家）。比每百萬人少受 OSM 畫得完不完整的影響，但一樣受「本國不標」的影響。例如中國菜在中國 28.4%、千里達 20.7%、馬來西亞 19.0%，台灣 10.8%；日本菜在日本 21.2%、新加坡 8.3%、香港 7.9%、台灣 5.3%；墨西哥菜在墨西哥 28.8%、美國 8.8%。',
      en: 'Pick a cuisine to see its share of places with a cuisine tag (countries with at least 200 tagged places). This is less sensitive to how completely OSM is mapped than the per-million rate, but still affected by home countries not tagging. Chinese: China 28.4%, Trinidad and Tobago 20.7%, Malaysia 19.0% and Taiwan 10.8%; Japanese: Japan 21.2%, Singapore 8.3%, Hong Kong 7.9% and Taiwan 5.3%; Mexican: Mexico 28.8% and the US 8.8%.',
    },
    unit: '%',
    file: 'share/{item}.json',
    dimension: DIMENSION,
    layer: { kind: 'choropleth', scale: { type: 'sequential', thresholds: [0.5, 1, 2, 5, 10, 20] }, itemScales: SHARE_SCALES },
    format: (v) => `${fixed(v, v < 1 ? 2 : 1)}%`,
    formatTick: (v) => `${v}%`,
    panelChart: false,
  },
];

export const cuisines: TopicDefinition = {
  id: 'cuisines',
  title: { zh: '菜系走到哪裡：各國的外國菜', en: 'Where cuisines travel' },
  shortTitle: { zh: '菜系', en: 'Cuisines' },
  defaultIndicator: 'abroad',
  defaultYear: 2026,
  timeless: true,
  sources: [
    {
      name: { zh: 'OpenStreetMap 貢獻者（cuisine 標籤，經 QLever 查詢，2026 年 11 月）', en: 'OpenStreetMap contributors (cuisine tags, queried via QLever, November 2026)' },
      url: 'https://www.openstreetmap.org/copyright',
      license: { zh: 'ODbL 1.0，© OpenStreetMap 貢獻者', en: 'ODbL 1.0, © OpenStreetMap contributors' },
    },
  ],
  note: withTerritories({
    zh: '資料是 OpenStreetMap 上餐廳、小吃店等標的 cuisine（菜系），2026 年 11 月的快照（© OpenStreetMap contributors），只收 32 個有明確原產國的菜系；披薩、壽司、烤肉串、漢堡、「亞洲菜」這類標籤分不出國家，不算。一家店標了好幾個菜系（「italian;pizza」）就每個各算一次。台灣、香港、澳門標中式的與北韓的朝鮮菜算同一個飲食圈，不算外國菜，也不算中國菜、韓國菜流到國外。' +
      CAVEAT.zh +
      '美國的墨西哥菜裡有很多是德州墨西哥菜與連鎖店，在美國的「墨西哥菜」跟在墨西哥的意思不一樣。這是標籤的計數，不是正式的餐廳普查。',
    en: 'The data are the cuisine tags on restaurants, eateries and similar places on OpenStreetMap, a November 2026 snapshot (© OpenStreetMap contributors), limited to 32 cuisines with a clear country of origin; tags such as pizza, sushi, kebab, burger or “Asian” cannot be assigned to a country and are left out. A place with several cuisines (“italian;pizza”) counts once for each. Places tagged Chinese in Taiwan, Hong Kong and Macao and Korean places in North Korea count as the same food culture, not as foreign cuisines and not as Chinese or Korean cuisine abroad. ' +
      CAVEAT.en +
      ' Many Mexican places in the US are Tex-Mex or chains, so “Mexican” means something different there. These are tag counts, not an official restaurant census.',
  }),
  indicators,
};
